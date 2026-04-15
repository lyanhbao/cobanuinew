-- Migration: Add brand_hashtag table + crawl_source to post
-- Run with: psql $DATABASE_URL -f db/migrations/003-add-brand-hashtag.sql

-- 1. New table: brand_hashtag
CREATE TABLE IF NOT EXISTS brand_hashtag (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curated_brand_id    uuid NOT NULL REFERENCES curated_brand(id) ON DELETE CASCADE,
  platform            platform NOT NULL DEFAULT 'tiktok',
  hashtag             varchar(255) NOT NULL,        -- e.g. '#khaixuanbanlinh'
  hashtag_lower       varchar(255) NOT NULL,       -- lowercase for dedup
  source              varchar(20) NOT NULL,        -- 'profile' | 'hashtag'
  campaign_name       varchar(255),               -- e.g. 'Tết 2025', 'Tiger Remix 2026'
  classification      varchar(30),                -- 'campaign' | 'product' | 'brand' | 'viral' | 'unknown'
  -- Metrics from extraction
  post_count          int DEFAULT 0,              -- số bài đăng chứa hashtag này
  total_views         bigint DEFAULT 0,
  avg_views_per_post  numeric(12, 2) DEFAULT 0,
  engagement_rate     numeric(6, 3) DEFAULT 0,    -- (likes+comments+shares)/views * 100
  unique_profiles     int DEFAULT 0,
  -- LLM analysis
  score               numeric(5, 2) DEFAULT 0,     -- composite score (0-100)
  priority            varchar(10) DEFAULT 'medium', -- 'high' | 'medium' | 'low'
  reason              text,                        -- LLM reasoning
  expected_volume     varchar(10),                -- 'high' | 'medium' | 'low'
  -- Tracking
  first_seen_at       timestamptz DEFAULT now(),
  last_seen_at        timestamptz DEFAULT now(),
  last_analyzed_at    timestamptz,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  -- Unique constraint: one hashtag per brand per source
  CONSTRAINT unique_brand_hashtag_source UNIQUE (curated_brand_id, platform, hashtag_lower, source)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bh_brand ON brand_hashtag(curated_brand_id);
CREATE INDEX IF NOT EXISTS idx_bh_platform ON brand_hashtag(platform);
CREATE INDEX IF NOT EXISTS idx_bh_source ON brand_hashtag(source);
CREATE INDEX IF NOT EXISTS idx_bh_classification ON brand_hashtag(classification);
CREATE INDEX IF NOT EXISTS idx_bh_score ON brand_hashtag(score DESC);
CREATE INDEX IF NOT EXISTS idx_bh_priority ON brand_hashtag(priority);
CREATE INDEX IF NOT EXISTS idx_bh_hashtag_lower ON brand_hashtag(hashtag_lower);
CREATE INDEX IF NOT EXISTS idx_bh_active ON brand_hashtag(is_active) WHERE is_active = true;

-- 2. Add crawl_source to post table
ALTER TABLE post
  ADD COLUMN IF NOT EXISTS crawl_source varchar(20) DEFAULT 'profile';

COMMENT ON COLUMN post.crawl_source IS 'profile | hashtag — where the post was crawled from';

-- 3. Add crawl_source to weekly_stats
ALTER TABLE weekly_stats
  ADD COLUMN IF NOT EXISTS posts_from_profile  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_from_hashtag   int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_from_profile   bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_from_hashtag   bigint DEFAULT 0;
