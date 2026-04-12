-- COBAN Platform — Core Schema Migration
-- Reference: DB_SCHEMA_DESIGN.md (14 tables)
-- Run: psql -d coban -f db/migrations/001_create_core_schema.sql

BEGIN;

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy brand search

-- 2. ENUM types
CREATE TYPE user_role AS ENUM (
  'platform_admin',
  'agency_owner',
  'agency_admin',
  'agency_user',
  'client_admin',
  'client_user'
);

CREATE TYPE account_type AS ENUM (
  'agency',
  'direct_client'
);

CREATE TYPE account_plan AS ENUM (
  'startup',   -- 1 client, 3 users
  'professional', -- 5 clients, 15 users
  'enterprise'    -- unlimited
);

CREATE TYPE platform AS ENUM (
  'facebook',
  'youtube',
  'tiktok'
);

CREATE TYPE format_type AS ENUM (
  'Image',
  'Video',
  'True view',
  'Bumper',
  'Short',
  'Story',
  'Carousel'
);

CREATE TYPE yt_format AS ENUM (
  'Short',
  'Normal'
);

CREATE TYPE crawl_status AS ENUM (
  'pending',
  'crawling',
  'ready',
  'error'
);

CREATE TYPE job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE job_type AS ENUM (
  'initial',
  'weekly',
  'delta',
  'manual'
);

CREATE TYPE activity_type AS ENUM (
  'viral_post',
  'reengaged_post',
  'new_post',
  'competitor_added',
  'benchmark_updated'
);

CREATE TYPE alert_level AS ENUM (
  'info',
  'warning',
  'critical'
);

CREATE TYPE report_status AS ENUM (
  'pending',
  'generating',
  'finalized',
  'failed'
);

-- 3. Core Tables

-- account: top-level billing & plan container
CREATE TABLE IF NOT EXISTS account (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  type          account_type NOT NULL DEFAULT 'agency',
  plan          account_plan NOT NULL DEFAULT 'startup',
  max_users     INT          NOT NULL DEFAULT 3,
  max_clients   INT          NOT NULL DEFAULT 1,
  country       VARCHAR(2)   NOT NULL DEFAULT 'VN',
  timezone      VARCHAR(50)  NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- "user": platform user belonging to an account
CREATE TABLE "user" (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255),
  role          user_role NOT NULL DEFAULT 'agency_user',
  avatar_url    VARCHAR(500),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_account_id ON "user"(account_id);
CREATE INDEX idx_user_email ON "user"(email);

-- client: top-level workspace (e.g., "IDP Vietnam")
CREATE TABLE client (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id  UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  industry    VARCHAR(100),
  country     VARCHAR(2) DEFAULT 'VN',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_account_id ON client(account_id);
CREATE UNIQUE INDEX idx_client_account_name ON client(account_id, name);

-- user_client_role: M:N user ↔ client with RBAC
CREATE TABLE user_client_role (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  role        VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
  invited_by  UUID REFERENCES "user"(id),
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_ucr_user_id ON user_client_role(user_id);
CREATE INDEX idx_ucr_client_id ON user_client_role(client_id);

-- category: hierarchical benchmark categories (e.g., "Dairy → Drinking Yogurt")
CREATE TABLE category (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id  UUID REFERENCES category(id) ON DELETE SET NULL,
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(255) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_category_parent_id ON category(parent_id);

-- "group": competitive group (client_id → has brands)
CREATE TABLE "group" (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id               UUID NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  name                    VARCHAR(255) NOT NULL,
  benchmark_category_id   UUID REFERENCES category(id) ON DELETE SET NULL,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_by              UUID REFERENCES "user"(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_client_id ON "group"(client_id);

-- curated_brand: platform-wide canonical brand (~200 rows, managed by platform admin)
CREATE TABLE curated_brand (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(255) NOT NULL UNIQUE,
  advertiser     VARCHAR(255),  -- top-level advertiser, e.g. "IDP", "Vinamilk"
  categories     TEXT[],       -- ["Drinking yogurt", "Probiotic"]
  social_handles JSONB DEFAULT '{}',  -- {facebook, youtube, tiktok, instagram}
  status         VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_curated_brand_name ON curated_brand(name);
CREATE INDEX idx_curated_brand_slug ON curated_brand(slug);
-- Fuzzy search on brand name
CREATE INDEX idx_curated_brand_name_trgm ON curated_brand USING gin(name gin_trgm_ops);

-- client_brand: per-client brand instance (links client to curated_brand)
CREATE TABLE client_brand (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  curated_brand_id UUID NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, curated_brand_id)
);

CREATE INDEX idx_cb_client_id ON client_brand(client_id);
CREATE INDEX idx_cb_curated_brand_id ON client_brand(curated_brand_id);

-- brand: group-scoped brand tracking (group_id × curated_brand_id is unique)
-- This is the central table for crawl status tracking per brand per group
CREATE TABLE brand (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curated_brand_id UUID NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  crawl_status     crawl_status NOT NULL DEFAULT 'pending',
  crawl_source     VARCHAR(20) DEFAULT 'csv' CHECK (crawl_source IN ('csv', 'api', 'manual')),
  first_crawl_at   TIMESTAMPTZ,
  last_crawl_at    TIMESTAMPTZ,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- same curated_brand in different groups = separate rows
  UNIQUE(curated_brand_id, group_id)
);

CREATE INDEX idx_brand_group_id ON brand(group_id);
CREATE INDEX idx_brand_curated_brand_id ON brand(curated_brand_id);
CREATE INDEX idx_brand_crawl_status ON brand(crawl_status);
CREATE INDEX idx_brand_group_crawl ON brand(group_id, crawl_status);

-- brand_alias: alias lookup table for CSV brand name → curated_brand normalization
CREATE TABLE brand_alias (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curated_brand_id UUID NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  alias            VARCHAR(255) NOT NULL,
  alias_type       VARCHAR(20) NOT NULL DEFAULT 'exact' CHECK (alias_type IN ('exact', 'fuzzy', 'advertiser')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_alias_alias ON brand_alias(alias);
CREATE INDEX idx_brand_alias_curated_brand_id ON brand_alias(curated_brand_id);
CREATE INDEX idx_brand_alias_alias_trgm ON brand_alias USING gin(alias gin_trgm_ops);
CREATE UNIQUE INDEX idx_brand_alias_unique ON brand_alias(alias, alias_type);

-- post: raw social media post data (partitioned by year)
CREATE TABLE post (
  id               UUID DEFAULT uuid_generate_v4(),
  curated_brand_id  UUID NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  -- composite natural key: platform + post_id is unique per post
  platform         platform NOT NULL,
  post_id          VARCHAR(255) NOT NULL,  -- external platform post ID
  profile          VARCHAR(255),           -- social handle, e.g. "LOF KUN", "TH true MILK"
  content          TEXT,                     -- post message/caption (may contain newlines)
  posted_at        TIMESTAMPTZ NOT NULL,
  week_start       DATE NOT NULL,           -- pre-computed Monday of posted_at week
  week_number      INT NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  year             INT NOT NULL,
  format           format_type,
  yt_format        yt_format,               -- YouTube only: Short | Normal
  cost             NUMERIC(18,2) DEFAULT 0,  -- VND
  views            BIGINT DEFAULT 0,
  impressions      BIGINT DEFAULT 0,
  reactions        BIGINT DEFAULT 0,
  comments         BIGINT DEFAULT 0,
  shares           BIGINT DEFAULT 0,
  duration         INT,                     -- seconds, YouTube only
  link             VARCHAR(1000),
  advertiser       VARCHAR(255),            -- e.g. "IDP", "TH", "Nutifood"
  categories       TEXT[],                  -- from CSV Brands column
  raw_categories   TEXT[],                  -- from CSV Categories column
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (platform, post_id)
) PARTITION BY RANGE (year);

-- Partition by year (handles data from 2022 onward)
CREATE TABLE post_2022 PARTITION OF post FOR VALUES FROM (2022) TO (2023);
CREATE TABLE post_2023 PARTITION OF post FOR VALUES FROM (2023) TO (2024);
CREATE TABLE post_2024 PARTITION OF post FOR VALUES FROM (2024) TO (2025);
CREATE TABLE post_2025 PARTITION OF post FOR VALUES FROM (2025) TO (2026);
CREATE TABLE post_2026 PARTITION OF post FOR VALUES FROM (2026) TO (2027);

CREATE INDEX idx_post_curated_brand_id ON post(curated_brand_id);
CREATE INDEX idx_post_week_start ON post(week_start);
CREATE INDEX idx_post_posted_at ON post(posted_at);
CREATE INDEX idx_post_platform ON post(platform);
CREATE INDEX idx_post_year_week ON post(year, week_number);
CREATE INDEX idx_post_group_week ON post(curated_brand_id, week_start);

-- crawl_job: full crawl execution history (tracks each crawl run)
CREATE TABLE crawl_job (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  brand_id      UUID REFERENCES brand(id) ON DELETE SET NULL,
  job_type      job_type NOT NULL,
  status        job_status NOT NULL DEFAULT 'pending',
  crawl_from    DATE,           -- Jan 1 for initial, last_crawl_at for weekly
  crawl_to      DATE,
  posts_total   INT DEFAULT 0,
  posts_created INT DEFAULT 0,
  posts_updated INT DEFAULT 0,
  posts_failed  INT DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cj_group_id ON crawl_job(group_id);
CREATE INDEX idx_cj_brand_id ON crawl_job(brand_id);
CREATE INDEX idx_cj_status ON crawl_job(status);
CREATE INDEX idx_cj_created_at ON crawl_job(created_at DESC);
CREATE INDEX idx_cj_group_status ON crawl_job(group_id, status);

-- weekly_stats: pre-aggregated brand metrics per (group, brand, week)
-- This is the primary read table for dashboard queries
CREATE TABLE weekly_stats (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id            UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  brand_id            UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  week_start          DATE NOT NULL,
  week_number         INT NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  year                INT NOT NULL,
  total_posts         INT NOT NULL DEFAULT 0,
  total_views         BIGINT NOT NULL DEFAULT 0,
  total_impressions   BIGINT NOT NULL DEFAULT 0,
  total_reactions    BIGINT NOT NULL DEFAULT 0,
  total_comments      BIGINT NOT NULL DEFAULT 0,
  total_shares        BIGINT NOT NULL DEFAULT 0,
  total_cost          NUMERIC(18,2) NOT NULL DEFAULT 0,
  avg_engagement_rate NUMERIC(8,4) DEFAULT 0,
  sov_impressions_pct NUMERIC(6,2),  -- share of impressions in group for this week
  sov_views_pct       NUMERIC(6,2),
  sov_reactions_pct   NUMERIC(6,2),
  sov_posts_pct       NUMERIC(6,2),
  gap_pct             NUMERIC(8,2),  -- WoW change vs previous week
  network_breakdown   JSONB DEFAULT '{}',  -- {facebook: {views,impressions,reactions}, ...}
  format_breakdown    JSONB DEFAULT '{}',  -- {Image: {count,views,reactions}, ...}
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, brand_id, week_start)
);

CREATE INDEX idx_ws_group_week ON weekly_stats(group_id, week_start);
CREATE INDEX idx_ws_brand_id ON weekly_stats(brand_id);
CREATE INDEX idx_ws_year_week ON weekly_stats(year, week_number);
CREATE INDEX idx_ws_group_brand_week ON weekly_stats(group_id, brand_id, week_start);
CREATE INDEX idx_ws_group_ranking ON weekly_stats(group_id, week_start, sov_impressions_pct DESC);

-- weekly_report: per-group weekly summary report
CREATE TABLE weekly_report (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  week_number     INT NOT NULL,
  year            INT NOT NULL,
  status          report_status NOT NULL DEFAULT 'pending',
  total_brands    INT DEFAULT 0,
  total_posts     INT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_reactions BIGINT DEFAULT 0,
  top_brand_id    UUID REFERENCES brand(id),
  generated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, week_start)
);

CREATE INDEX idx_wr_group_week ON weekly_report(group_id, week_start DESC);

-- brand_activity: notable brand events (viral posts, re-engaged, new competitors)
CREATE TABLE brand_activity (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id      UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  post_platform platform,
  post_id       VARCHAR(255),
  activity_type activity_type NOT NULL,
  alert_level   alert_level NOT NULL DEFAULT 'info',
  title         VARCHAR(255),
  description   TEXT,
  metric_value  BIGINT,
  metric_prev   BIGINT,
  gap_pct       NUMERIC(8,2),
  week_start    DATE NOT NULL,
  year          INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ba_brand_id ON brand_activity(brand_id);
CREATE INDEX idx_ba_week_start ON brand_activity(week_start DESC);
CREATE INDEX idx_ba_activity_type ON brand_activity(activity_type);
CREATE INDEX idx_ba_brand_week ON brand_activity(brand_id, week_start DESC);

-- 4. Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_account_updated_at BEFORE UPDATE ON account FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_client_updated_at BEFORE UPDATE ON client FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_group_updated_at BEFORE UPDATE ON "group" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_brand_updated_at BEFORE UPDATE ON brand FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_post_updated_at BEFORE UPDATE ON post FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_weekly_stats_updated_at BEFORE UPDATE ON weekly_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_weekly_report_updated_at BEFORE UPDATE ON weekly_report FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Row Level Security
ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE client ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_client_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE post ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_activity ENABLE ROW LEVEL SECURITY;

-- account: users can only see their own account
CREATE POLICY "account_select_own" ON account
  FOR SELECT USING (id IN (SELECT account_id FROM "user" WHERE id = current_setting('app.current_user_id', true)::uuid));

-- "user": users can manage their own account's users
CREATE POLICY "user_select_own_account" ON "user"
  FOR SELECT USING (account_id IN (SELECT account_id FROM "user" WHERE id = current_setting('app.current_user_id', true)::uuid));

-- client: RBAC via user_client_role
CREATE POLICY "client_select_rbac" ON client
  FOR SELECT USING (id IN (SELECT client_id FROM user_client_role WHERE user_id = current_setting('app.current_user_id', true)::uuid));

CREATE POLICY "client_insert_admin" ON client
  FOR INSERT WITH CHECK (account_id IN (SELECT account_id FROM "user" WHERE id = current_setting('app.current_user_id', true)::uuid AND role IN ('platform_admin', 'agency_owner')));

-- user_client_role: users can see their own roles
CREATE POLICY "ucr_select_own" ON user_client_role
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::uuid
    OR client_id IN (SELECT client_id FROM user_client_role WHERE user_id = current_setting('app.current_user_id', true)::uuid AND role = 'admin'));

-- category: read-only public
CREATE POLICY "category_read_all" ON category FOR SELECT USING (true);

-- "group": RBAC via user_client_role
CREATE POLICY "group_select_rbac" ON "group"
  FOR SELECT USING (client_id IN (SELECT client_id FROM user_client_role WHERE user_id = current_setting('app.current_user_id', true)::uuid));

-- curated_brand: read-only public
CREATE POLICY "curated_brand_read_all" ON curated_brand FOR SELECT USING (true);

-- brand_alias: read-only public
CREATE POLICY "brand_alias_read_all" ON brand_alias FOR SELECT USING (true);

-- brand: RBAC via "group" → user_client_role
CREATE POLICY "brand_select_rbac" ON brand
  FOR SELECT USING (group_id IN (
    SELECT g.id FROM "group" g
    JOIN user_client_role ucr ON ucr.client_id = g.client_id
    WHERE ucr.user_id = current_setting('app.current_user_id', true)::uuid
  ));

-- post: RBAC via curated_brand → brand → "group" → user_client_role
CREATE POLICY "post_select_rbac" ON post
  FOR SELECT USING (curated_brand_id IN (
    SELECT b.curated_brand_id FROM brand b
    JOIN "group" g ON g.id = b.group_id
    JOIN user_client_role ucr ON ucr.client_id = g.client_id
    WHERE ucr.user_id = current_setting('app.current_user_id', true)::uuid
  ));

-- weekly_stats: RBAC via "group"
CREATE POLICY "weekly_stats_select_rbac" ON weekly_stats
  FOR SELECT USING (group_id IN (
    SELECT g.id FROM "group" g
    JOIN user_client_role ucr ON ucr.client_id = g.client_id
    WHERE ucr.user_id = current_setting('app.current_user_id', true)::uuid
  ));

COMMIT;

