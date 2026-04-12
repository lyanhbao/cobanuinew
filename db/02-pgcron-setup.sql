-- pg_cron setup for COBAN weekly crawl scheduling
-- Run AFTER db/01-create-coban-schema.sql
-- Schedule: Every Sunday at 12:00 PM (Asia/Ho_Chi_Minh)

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to database (run as superuser)
GRANT USAGE ON SCHEMA cron TO PUBLIC;

-- 2. Helper: Crawl Delta Job (Job 1 from DB_SCHEMA_DESIGN.md)
-- Runs every Sunday at 12:00 PM
-- FOR EACH group:
--   FOR EACH brand IN group (primary + competitors):
--     crawl_from = Jan 1 of current_year (always, NOT from last_crawl_time)
--     Fetch posts, deduplicate, upsert
--     Update last_crawl_time

-- 3. Helper: Gap Calculation Job (Job 2)
-- Runs after Job 1 completes
-- W (current week) vs W-1 (previous week) per post
-- Post in both W and W-1 → gap = perf_W - perf_W-1
-- Post only in W → gap = perf_W
-- Post only in W-1 → gap = 0 (excluded)

-- 4. Helper: Weekly Aggregation Job (Job 3)
-- Runs after Job 2 completes
-- sum(gap_results) → WEEKLY_STATS (brand × group × week)
-- Compute trend = (W - W-1) / W-1

-- 5. Helper: Rankings & SoV Job (Job 4)
-- Runs after Job 3 completes
-- Per group: SOV, rank, beat_rate
-- Alert for new brands (added_at this week)

-- 6. Helper: Activity Report Job (Job 5)
-- Runs after Job 4 completes
-- viral_posts = gap > 2x prev perf
-- reengaged = exist W-1 + new eng in W

-- ============================================================
-- CLEANUP: Remove any existing coban cron jobs (idempotent)
-- ============================================================
DELETE FROM cron.job
WHERE jobname LIKE 'coban_%';

-- ============================================================
-- Weekly Crawl Delta Schedule (Sundays at 12:00 PM)
-- Cron expression: 0 12 * * 0  (minute=0, hour=12, every day-of-month, every month, day-of-week=0/Sunday)
-- ============================================================
SELECT cron.schedule(
  'coban-weekly-crawl-delta',
  '0 12 * * 0',
  $$
  SELECT cron.job_runner(
    'coban_crawl_delta',
    now(),
    interval '4 hours'
  );
  $$
);

-- ============================================================
-- Gap Calculation Schedule (Sundays at 4:30 PM — after crawl)
-- ============================================================
SELECT cron.schedule(
  'coban-weekly-gap-calculation',
  '30 16 * * 0',
  $$
  SELECT cron.job_runner(
    'coban_gap_calculation',
    now(),
    interval '1 hour'
  );
  $$
);

-- ============================================================
-- Weekly Stats Aggregation Schedule (Sundays at 6:00 PM)
-- ============================================================
SELECT cron.schedule(
  'coban-weekly-stats-aggregation',
  '0 18 * * 0',
  $$
  SELECT cron.job_runner(
    'coban_stats_aggregation',
    now(),
    interval '2 hours'
  );
  $$
);

-- ============================================================
-- Rankings & SoV Calculation Schedule (Sundays at 8:30 PM)
-- ============================================================
SELECT cron.schedule(
  'coban-weekly-rankings',
  '30 20 * * 0',
  $$
  SELECT cron.job_runner(
    'coban_rankings',
    now(),
    interval '30 minutes'
  );
  $$
);

-- ============================================================
-- Refresh Materialized View Schedule (Sundays at 9:00 PM)
-- ============================================================
SELECT cron.schedule(
  'coban-refresh-rankings-mv',
  '0 21 * * 0',
  $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_rankings;
  $$
);

-- ============================================================
-- Cleanup old crawl_job partitions (first day of each month, 2:00 AM)
-- Keep 12 months of history
-- ============================================================
SELECT cron.schedule(
  'coban-cleanup-old-crawl-jobs',
  '0 2 1 * *',
  $$
  SELECT cron.job_runner(
    'coban_cleanup_old_jobs',
    now(),
    interval '10 minutes'
  );
  $$
);

-- ============================================================
-- Archive old brand_activity entries (first day of each month, 3:00 AM)
-- Entries older than 1 year are archived
-- ============================================================
SELECT cron.schedule(
  'coban-archive-old-activity',
  '0 3 1 * *',
  $$
  DELETE FROM brand_activity
  WHERE week_start < now() - interval '1 year'
    AND notified = true;
  $$
);

-- ============================================================
-- Unschedule helper (keep for reference)
-- Usage: SELECT cron.unschedule('coban-weekly-crawl-delta');
-- ============================================================

-- ============================================================
-- Verify schedules
-- ============================================================
-- SELECT * FROM cron.job WHERE jobname LIKE 'coban_%';
