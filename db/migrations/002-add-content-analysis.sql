-- Migration: Add content_analysis fields to post table
-- Run with: psql $DATABASE_URL -f db/migrations/002-add-content-analysis.sql

ALTER TABLE post
  ADD COLUMN IF NOT EXISTS mood          varchar(50)  DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS tone          varchar(50)  DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS info_type    varchar(50)  DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS target       varchar(50)  DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS content_format varchar(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS key_message  text,
  ADD COLUMN IF NOT EXISTS analysis_confidence varchar(10) DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS analyzed_at  timestamptz;

-- Index for content analysis queries
CREATE INDEX IF NOT EXISTS idx_post_mood ON post(mood) WHERE mood IS NOT NULL AND mood != 'unknown';
CREATE INDEX IF NOT EXISTS idx_post_tone ON post(tone) WHERE tone IS NOT NULL AND tone != 'unknown';
CREATE INDEX IF NOT EXISTS idx_post_info_type ON post(info_type) WHERE info_type IS NOT NULL AND info_type != 'unknown';
CREATE INDEX IF NOT EXISTS idx_post_target ON post(target) WHERE target IS NOT NULL AND target != 'unknown';
CREATE INDEX IF NOT EXISTS idx_post_content_format ON post(content_format) WHERE content_format IS NOT NULL AND content_format != 'unknown';
