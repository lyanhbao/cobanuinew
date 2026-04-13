-- COBAN Platform — Complete Database Schema
-- Based on DB_SCHEMA_DESIGN.md (14 tables, partitioned post table, full indexing)
-- Run with: psql $DATABASE_URL -f db/01-create-coban-schema.sql

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For GIN trigram indexes

-- 2. ENUM Types
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('agency', 'direct_client', 'startup');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'platform_admin',
    'agency_owner',
    'agency_admin',
    'client_admin',
    'analyst',
    'viewer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE client_role AS ENUM ('admin', 'analyst', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE group_crawl_status AS ENUM ('pending', 'crawling', 'ready', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE brand_source AS ENUM ('curated', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE crawl_job_type AS ENUM ('initial', 'weekly', 'retry');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE crawl_job_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('viral', 'reengaged', 'anomaly', 'new_post');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE platform AS ENUM ('facebook', 'youtube', 'tiktok');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. account (Top-level billing entity)
CREATE TABLE IF NOT EXISTS account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(255) NOT NULL,
  type          account_type NOT NULL DEFAULT 'direct_client',
  plan          varchar(20) NOT NULL DEFAULT 'startup',
  max_users     int DEFAULT 5,
  max_clients   int DEFAULT NULL,  -- NULL = unlimited
  country       varchar(2) DEFAULT 'VN',
  timezone      varchar(50) DEFAULT 'Asia/Ho_Chi_Minh',
  billing_email varchar(255),
  monthly_budget bigint DEFAULT 3000000,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_name ON account(name);
CREATE INDEX IF NOT EXISTS idx_account_type ON account(type);

-- 4. client (Brand/company managed by account)
CREATE TABLE IF NOT EXISTS client (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  name          varchar(255) NOT NULL,
  industry      varchar(50) DEFAULT 'other',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT unique_account_client_name UNIQUE(account_id, name)
);
CREATE INDEX IF NOT EXISTS idx_client_account ON client(account_id);

-- 5. "user" (Platform users — quoted because reserved keyword)
CREATE TABLE IF NOT EXISTS "user" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  email         varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,  -- bcrypt
  full_name     varchar(255),
  role          user_role NOT NULL DEFAULT 'analyst',
  avatar_url    varchar(500),
  phone         varchar(20),
  is_active     boolean DEFAULT true,
  last_login    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_account ON "user"(account_id);
CREATE INDEX IF NOT EXISTS idx_user_role ON "user"(role);

-- 6. user_client_role (Per-client RBAC)
CREATE TABLE IF NOT EXISTS user_client_role (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  role          client_role NOT NULL DEFAULT 'viewer',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT unique_user_client UNIQUE(user_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ucr_user ON user_client_role(user_id);
CREATE INDEX IF NOT EXISTS idx_ucr_client ON user_client_role(client_id);

-- 7. curated_brand (Platform-wide brand master — ~200 rows)
CREATE TABLE IF NOT EXISTS curated_brand (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(255) NOT NULL UNIQUE,
  slug          varchar(255) NOT NULL UNIQUE,
  categories    text[] NOT NULL DEFAULT '{}',
  social_handles jsonb DEFAULT '{}',
    -- {"facebook": "@handle", "youtube": "@handle", "tiktok": "@handle"}
  advertiser    varchar(255),  -- Top-level advertiser, e.g. "IDP", "Nestlé"
  status        varchar(20) DEFAULT 'active',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
-- GIN trigram index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_cb_name_gin ON curated_brand USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cb_slug ON curated_brand(slug);
CREATE INDEX IF NOT EXISTS idx_cb_status ON curated_brand(status);
CREATE INDEX IF NOT EXISTS idx_cb_advertiser ON curated_brand(advertiser);

-- 8. client_brand (Brand instance per client)
CREATE TABLE IF NOT EXISTS client_brand (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  curated_brand_id  uuid NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  name              varchar(255) NOT NULL,
  categories        text[] DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT unique_client_curated UNIQUE(client_id, curated_brand_id),
  CONSTRAINT unique_client_name UNIQUE(client_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cbr_client ON client_brand(client_id);
CREATE INDEX IF NOT EXISTS idx_cbr_curated ON client_brand(curated_brand_id);

-- 9. category (Hierarchical product category tree)
CREATE TABLE IF NOT EXISTS category (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     uuid REFERENCES category(id) ON DELETE SET NULL,
  name          varchar(255) NOT NULL,
  slug          varchar(255) NOT NULL UNIQUE,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT no_cyclic_category CHECK (id != parent_id)
);
CREATE INDEX IF NOT EXISTS idx_cat_parent ON category(parent_id);

-- 10. "group" (Brand + Category + Competitors tracking unit)
CREATE TABLE IF NOT EXISTS "group" (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  name                   varchar(255) NOT NULL,
  benchmark_category_id  uuid REFERENCES category(id),
  crawl_status           group_crawl_status DEFAULT 'pending',
    -- Computed as worst status of all brands in this group
  first_crawl_at         timestamptz,
  last_crawl_at         timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  CONSTRAINT unique_client_group_name UNIQUE(client_id, name)
);
CREATE INDEX IF NOT EXISTS idx_group_client ON "group"(client_id);
CREATE INDEX IF NOT EXISTS idx_group_crawl_status ON "group"(crawl_status);

-- 11. brand (Brand-in-group tracking — group-scoped)
-- CRITICAL: brand_id is NOT curated_brand_id!
-- Same brand in different groups = different rows.
-- Each row = one brand being tracked in one group.
CREATE TABLE IF NOT EXISTS brand (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curated_brand_id   uuid NOT NULL REFERENCES curated_brand(id),
  group_id          uuid NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  is_primary        boolean DEFAULT false,
  source            brand_source DEFAULT 'curated',
    -- 'curated' = from platform, 'custom' = user added
  crawl_status      group_crawl_status DEFAULT 'pending',
    -- 'pending' | 'crawling' | 'ready' | 'error'
  is_new            boolean DEFAULT true,
    -- TRUE until 2nd week of crawl in this group
  first_crawl_at    timestamptz,
  last_crawl_at     timestamptz,
  error_message     text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT unique_group_curated UNIQUE(group_id, curated_brand_id)
);
CREATE INDEX IF NOT EXISTS idx_brand_group ON brand(group_id);
CREATE INDEX IF NOT EXISTS idx_brand_curated ON brand(curated_brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_crawl_status ON brand(crawl_status);
CREATE INDEX IF NOT EXISTS idx_brand_is_new ON brand(is_new);

-- 12. crawl_job (Crawl execution history — partitioned by month)
CREATE TABLE IF NOT EXISTS crawl_job (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid NOT NULL REFERENCES "group"(id),
  brand_id         uuid NOT NULL REFERENCES brand(id),
  job_type         crawl_job_type NOT NULL,
    -- 'initial' = 2 years back (J3/J6/J9/J10)
    -- 'weekly' = Sunday cron (J12)
    -- 'retry'  = manual retry after error
  status           crawl_job_status NOT NULL DEFAULT 'queued',
    -- 'queued' | 'running' | 'completed' | 'failed'
  crawl_from       date NOT NULL,  -- Jan 1 or 2y back
  crawl_to         date NOT NULL,  -- current week end
  posts_fetched    int DEFAULT 0,
  posts_upserted   int DEFAULT 0,
  started_at       timestamptz,
  completed_at     timestamptz,
  error_message    text,
  retry_count      int DEFAULT 0,
  created_at       timestamptz DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for crawl_job
CREATE TABLE IF NOT EXISTS crawl_job_2025_01 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_02 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_03 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_04 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_05 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_06 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_07 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_08 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_09 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_10 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_11 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS crawl_job_2025_12 PARTITION OF crawl_job
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS crawl_job_2026_01 PARTITION OF crawl_job
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS crawl_job_2026_02 PARTITION OF crawl_job
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS crawl_job_2026_03 PARTITION OF crawl_job
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS crawl_job_2026_04 PARTITION OF crawl_job
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS crawl_job_2026_05 PARTITION OF crawl_job
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS crawl_job_2026_06 PARTITION OF crawl_job
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- Default partition for future months
CREATE TABLE IF NOT EXISTS crawl_job_default PARTITION OF crawl_job DEFAULT;

CREATE INDEX IF NOT EXISTS idx_cj_group ON crawl_job(group_id);
CREATE INDEX IF NOT EXISTS idx_cj_brand ON crawl_job(brand_id);
CREATE INDEX IF NOT EXISTS idx_cj_status ON crawl_job(status);
CREATE INDEX IF NOT EXISTS idx_cj_created ON crawl_job(created_at DESC);

-- 13. post (Raw social media posts — partitioned by year)
-- PRIMARY KEY: (platform, post_id) for efficient upsert
CREATE TABLE IF NOT EXISTS post (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curated_brand_id uuid NOT NULL REFERENCES curated_brand(id),
    -- Posts belong to brand, not group. One post = one brand regardless of which group tracks it.
  platform         platform NOT NULL,
  post_id          varchar(255) NOT NULL,
    -- External platform ID (e.g. YouTube video ID)
  content          text,
    -- Post message/caption, may contain newlines
  posted_at        timestamp NOT NULL,
    -- Original post date from platform
  week_start       date NOT NULL,
    -- DENORMALIZED: Monday of the week containing posted_at (no DATE_TRUNC needed in queries)
  format           varchar(20),
    -- 'Image' | 'Video' | 'True view' | 'Bumper' | 'Short' | 'Normal'
  yt_format        varchar(20),
    -- 'Short' | 'Normal' (YouTube only)
  cost             numeric(18,2),
    -- Vietnamese VND — parse: replace('₫','').replace('.','').replace(',','.')
  views            numeric(18,2) DEFAULT 0,
  impressions      numeric(18,2) DEFAULT 0,
  reactions        numeric(18,2) DEFAULT 0,
    -- Combined: Reactions + Comments + Shares
  duration         int,
    -- seconds (YouTube only)
  link             varchar(500),
  advertiser       varchar(255),
  profile          varchar(255),
    -- Social handle, e.g. "LOF KUN", "TH true MILK"
  brands           jsonb DEFAULT '[]',
    -- JSON array of brand names from CSV ["Kun"]
  categories       jsonb DEFAULT '[]',
    -- JSON array from CSV ["Drinking yogurt"]
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT unique_post_key UNIQUE(platform, post_id),
  CONSTRAINT chk_cost_non_negative CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT chk_views_non_negative CHECK (views >= 0),
  CONSTRAINT chk_impressions_non_negative CHECK (impressions >= 0)
) PARTITION BY RANGE (week_start);

-- Yearly partitions for post table
CREATE TABLE IF NOT EXISTS post_2022 PARTITION OF post
  FOR VALUES FROM ('2022-01-03') TO ('2023-01-02');
CREATE TABLE IF NOT EXISTS post_2023 PARTITION OF post
  FOR VALUES FROM ('2023-01-02') TO ('2024-01-01');
CREATE TABLE IF NOT EXISTS post_2024 PARTITION OF post
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-06');
CREATE TABLE IF NOT EXISTS post_2025 PARTITION OF post
  FOR VALUES FROM ('2025-01-06') TO ('2026-01-05');
CREATE TABLE IF NOT EXISTS post_2026 PARTITION OF post
  FOR VALUES FROM ('2026-01-05') TO ('2027-01-04');
CREATE TABLE IF NOT EXISTS post_default PARTITION OF post DEFAULT;

CREATE INDEX IF NOT EXISTS idx_post_brand_week ON post(curated_brand_id, week_start);
CREATE INDEX IF NOT EXISTS idx_post_week_start ON post(week_start);
CREATE INDEX IF NOT EXISTS idx_post_platform ON post(platform);
CREATE INDEX IF NOT EXISTS idx_post_posted_at ON post(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_format ON post(format);
CREATE INDEX IF NOT EXISTS idx_post_yt_format ON post(yt_format) WHERE yt_format IS NOT NULL;
  -- Partial index for YouTube Short filter
CREATE INDEX IF NOT EXISTS idx_post_updated_at ON post(updated_at);
  -- For crawl dedup (find posts updated since last crawl)
CREATE INDEX IF NOT EXISTS idx_post_brand_platform ON post(curated_brand_id, platform, week_start);
  -- For platform-specific queries

-- 14. weekly_stats (Pre-aggregated weekly metrics per brand x group x week)
-- THE MOST QUERIED TABLE in the system
CREATE TABLE IF NOT EXISTS weekly_stats (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  group_id           uuid NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  year               int NOT NULL,
  week_number        int NOT NULL,
  week_start         date NOT NULL,
  week_end           date NOT NULL,
  total_posts        int NOT NULL DEFAULT 0,
  total_views        numeric(18,2) DEFAULT 0,
  total_impressions  numeric(18,2) DEFAULT 0,
  total_reactions    numeric(18,2) DEFAULT 0,
  total_cost         numeric(18,2) DEFAULT 0,
  avg_engagement_rate float DEFAULT 0,
    -- total_reactions / total_views × 100
  gap_pct            float,
    -- WoW change, null for first week
  is_new             boolean DEFAULT false,
  network_breakdown  jsonb DEFAULT '{}',
    -- {"facebook": 5000, "youtube": 10000, "tiktok": 3000}
  format_breakdown   jsonb DEFAULT '{}',
    -- {"Image": 1000, "Video": 2000, "True view": 6000}
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  CONSTRAINT unique_ws_group_brand_week UNIQUE(group_id, brand_id, week_start),
  CONSTRAINT chk_week_number CHECK (week_number BETWEEN 1 AND 53),
  CONSTRAINT chk_week_range CHECK (week_start < week_end)
);
CREATE INDEX IF NOT EXISTS idx_ws_group_week ON weekly_stats(group_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_ws_brand_week ON weekly_stats(brand_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_ws_brand_group ON weekly_stats(brand_id, group_id, week_start);
  -- For gap calculation queries (W vs W-1 merge)
CREATE INDEX IF NOT EXISTS idx_ws_year_week ON weekly_stats(year, week_number);
CREATE INDEX IF NOT EXISTS idx_ws_impressions ON weekly_stats(group_id, total_impressions DESC);

-- 15. weekly_report (Group-level weekly rollup)
CREATE TABLE IF NOT EXISTS weekly_report (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           uuid NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  year               int NOT NULL,
  week_number        int NOT NULL,
  week_start         date NOT NULL,
  week_end           date NOT NULL,
  total_posts        int DEFAULT 0,
  total_views        numeric(18,2) DEFAULT 0,
  total_impressions  numeric(18,2) DEFAULT 0,
  total_reactions    numeric(18,2) DEFAULT 0,
  status             varchar(20) DEFAULT 'ongoing',
    -- 'ongoing' | 'finalized'
  alerts             jsonb DEFAULT '[]',
    -- [{type: "new_brand", brand: "Nestlé", note: "..."}]
  email_sent_at      timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  CONSTRAINT unique_wr_group_week UNIQUE(group_id, week_start),
  CONSTRAINT chk_wr_week_number CHECK (week_number BETWEEN 1 AND 53)
);
CREATE INDEX IF NOT EXISTS idx_wr_group_week ON weekly_report(group_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_wr_year_week ON weekly_report(year, week_number);

-- 16. brand_activity (Viral/re-engaged post tracking — partitioned by week_start)
CREATE TABLE IF NOT EXISTS brand_activity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  post_id         uuid,  -- Stored for reference; post table uses composite PK (platform, post_id), not uuid id
  activity_type   activity_type NOT NULL,
    -- 'viral' | 'reengaged' | 'anomaly' | 'new_post'
  week_start      date NOT NULL,
  prev_perf       numeric(18,2),
    -- W-1 metric
  curr_perf       numeric(18,2) NOT NULL,
    -- W metric
  change_pct      float,
    -- (curr - prev) / prev × 100
  summary         text,
    -- "Engagement tăng 300% (2K → 8K)"
  notified        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
) PARTITION BY RANGE (week_start);

-- Monthly partitions for brand_activity
CREATE TABLE IF NOT EXISTS ba_2025_01 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-01-06') TO ('2025-02-03');
CREATE TABLE IF NOT EXISTS ba_2025_02 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-02-03') TO ('2025-03-03');
CREATE TABLE IF NOT EXISTS ba_2025_03 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-03-03') TO ('2025-04-07');
CREATE TABLE IF NOT EXISTS ba_2025_04 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-04-07') TO ('2025-05-05');
CREATE TABLE IF NOT EXISTS ba_2025_05 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-05-05') TO ('2025-06-02');
CREATE TABLE IF NOT EXISTS ba_2025_06 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-06-02') TO ('2025-07-07');
CREATE TABLE IF NOT EXISTS ba_2025_07 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-07-07') TO ('2025-08-04');
CREATE TABLE IF NOT EXISTS ba_2025_08 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-08-04') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS ba_2025_09 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-06');
CREATE TABLE IF NOT EXISTS ba_2025_10 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-10-06') TO ('2025-11-03');
CREATE TABLE IF NOT EXISTS ba_2025_11 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-11-03') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS ba_2025_12 PARTITION OF brand_activity
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-05');
CREATE TABLE IF NOT EXISTS ba_2026_01 PARTITION OF brand_activity
  FOR VALUES FROM ('2026-01-05') TO ('2026-02-02');
CREATE TABLE IF NOT EXISTS ba_2026_02 PARTITION OF brand_activity
  FOR VALUES FROM ('2026-02-02') TO ('2026-03-02');
CREATE TABLE IF NOT EXISTS ba_2026_03 PARTITION OF brand_activity
  FOR VALUES FROM ('2026-03-02') TO ('2026-04-06');
CREATE TABLE IF NOT EXISTS ba_2026_04 PARTITION OF brand_activity
  FOR VALUES FROM ('2026-04-06') TO ('2026-05-04');
CREATE TABLE IF NOT EXISTS ba_default PARTITION OF brand_activity DEFAULT;

CREATE INDEX IF NOT EXISTS idx_ba_brand_week ON brand_activity(brand_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_ba_type_week ON brand_activity(activity_type, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_ba_notified ON brand_activity(notified) WHERE notified = false;

-- 17. brand_alias (Brand name normalization — GIN trigram index)
CREATE TABLE IF NOT EXISTS brand_alias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curated_brand_id uuid NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  alias            varchar(255) NOT NULL UNIQUE,
  created_at       timestamptz DEFAULT now()
);
-- GIN trigram index for fuzzy lookup
-- Example: "Kun", "KUN", "KUN Vietnam", "Kun - Sữa Tươi" → canonical: "Kun"
CREATE INDEX IF NOT EXISTS idx_brand_alias_gin
  ON brand_alias USING GIN (lower(alias) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brand_alias_brand ON brand_alias(curated_brand_id);

-- 18. Materialized View: latest week rankings per group
-- Refresh: every Sunday after crawl completes
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_latest_rankings AS
SELECT
  ws.group_id,
  ws.week_start,
  ROW_NUMBER() OVER (
    PARTITION BY ws.group_id
    ORDER BY ws.total_impressions DESC
  ) AS rank,
  b.id AS brand_id,
  cb.name AS brand_name,
  ws.total_impressions,
  ws.total_reactions,
  ws.gap_pct,
  ws.is_new,
  ws.network_breakdown,
  ws.format_breakdown
FROM weekly_stats ws
JOIN brand b ON b.id = ws.brand_id
JOIN curated_brand cb ON cb.id = b.curated_brand_id
WHERE ws.week_start = (
  SELECT MAX(week_start) FROM weekly_stats
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mlr_group_brand
  ON mv_latest_rankings(group_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_mlr_group_rank
  ON mv_latest_rankings(group_id, rank);

-- 19. Helper functions

-- Function to get ISO week start date (Monday)
CREATE OR REPLACE FUNCTION get_week_start(d date)
RETURNS date AS $$
  SELECT (d - INTERVAL '1 day' * EXTRACT(DOW FROM d)::int + INTERVAL '1 day')::date;
$$ LANGUAGE sql IMMUTABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 20. Triggers for updated_at
CREATE OR REPLACE TRIGGER tr_account_updated_at
  BEFORE UPDATE ON account
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_client_updated_at
  BEFORE UPDATE ON client
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_user_updated_at
  BEFORE UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_user_client_role_updated_at
  BEFORE UPDATE ON user_client_role
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_curated_brand_updated_at
  BEFORE UPDATE ON curated_brand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_client_brand_updated_at
  BEFORE UPDATE ON client_brand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_group_updated_at
  BEFORE UPDATE ON "group"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_brand_updated_at
  BEFORE UPDATE ON brand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_post_updated_at
  BEFORE UPDATE ON post
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_weekly_stats_updated_at
  BEFORE UPDATE ON weekly_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER tr_weekly_report_updated_at
  BEFORE UPDATE ON weekly_report
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 21. Function to compute group crawl_status as worst of all brands
CREATE OR REPLACE FUNCTION update_group_crawl_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "group" g SET
    crawl_status = (
      SELECT COALESCE(
        (
          SELECT b.crawl_status
          FROM brand b
          WHERE b.group_id = g.id
          ORDER BY
            CASE b.crawl_status
              WHEN 'error' THEN 1
              WHEN 'crawling' THEN 2
              WHEN 'pending' THEN 3
              WHEN 'ready' THEN 4
            END ASC
          LIMIT 1
        ), 'pending'
      )
    ),
    last_crawl_at = (
      SELECT MAX(b.last_crawl_at)
      FROM brand b
      WHERE b.group_id = g.id
    )
  WHERE g.id = COALESCE(NEW.group_id, OLD.group_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_brand_crawl_status_change
  AFTER INSERT OR UPDATE OF crawl_status, last_crawl_at ON brand
  FOR EACH ROW EXECUTE FUNCTION update_group_crawl_status();
