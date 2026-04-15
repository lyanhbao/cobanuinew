/**
 * Crawl Database Operations — COBAN Pipeline
 *
 * Tất cả DB queries liên quan đến crawl pipeline.
 * Dùng chung Pool từ lib/db.ts.
 */
import { query, transaction } from '../db';
import type { Brand, CuratedBrand } from '../types';
import type { PoolClient } from 'pg';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrawlTarget {
  brand: Brand;
  curated: CuratedBrand;
  socialHandle: string | null;
  platform: 'tiktok' | 'facebook' | 'youtube';
}

export interface PostUpsert {
  curated_brand_id: string;
  platform: string;
  post_id: string;
  profile: string | null;
  content: string | null;
  posted_at: Date;
  week_start: string;
  week_number: number;
  year: number;
  views: number;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  link: string | null;
  post_type?: 'ad' | 'seeding' | null;
  campaign_name?: string | null;
  raw?: unknown;
}

// ─── Brand / Group queries ───────────────────────────────────────────────────

/**
 * Lấy tất cả brand + curated_brand + social handle cần crawl.
 */
export async function getCrawlTargets(): Promise<CrawlTarget[]> {
  const rows = await query<{
    brand_id: string;
    curated_brand_id: string;
    group_id: string;
    is_primary: boolean;
    crawl_status: string;
    curated_name: string;
    curated_slug: string;
    curated_advertiser: string | null;
    curated_categories: string[];
    social_handles: Record<string, unknown>;
    tiktok: string | null;
    facebook: string | null;
    youtube: string | null;
  }>(`
    SELECT
      b.id                          AS brand_id,
      b.curated_brand_id,
      b.group_id,
      b.is_primary,
      b.crawl_status,
      cb.name                       AS curated_name,
      cb.slug                       AS curated_slug,
      cb.advertiser                 AS curated_advertiser,
      cb.categories                  AS curated_categories,
      cb.social_handles,
      (cb.social_handles->>'tiktok')   AS tiktok,
      (cb.social_handles->>'facebook')  AS facebook,
      (cb.social_handles->>'youtube')  AS youtube
    FROM brand b
    JOIN curated_brand cb ON cb.id = b.curated_brand_id
    JOIN "group" g ON g.id = b.group_id
    WHERE b.crawl_status != 'crawling'
      AND g.is_active = true
    ORDER BY b.is_primary DESC, b.group_id
  `);

  const targets: CrawlTarget[] = [];

  for (const row of rows.rows) {
    const brand: Brand = {
      id: row.brand_id,
      curated_brand_id: row.curated_brand_id,
      group_id: row.group_id,
      is_primary: row.is_primary,
      crawl_status: row.crawl_status as Brand['crawl_status'],
      crawl_source: 'api',
      first_crawl_at: null,
      last_crawl_at: null,
      added_at: '',
      created_at: '',
      updated_at: '',
    };

    const curated: CuratedBrand = {
      id: row.curated_brand_id,
      name: row.curated_name,
      slug: row.curated_slug,
      advertiser: row.curated_advertiser ?? null,
      categories: row.curated_categories ?? [],
      social_handles: (row.social_handles ?? {}) as Record<string, string>,
      status: 'active',
      created_at: '',
      updated_at: '',
    };

    if (row.tiktok) targets.push({ brand, curated, socialHandle: row.tiktok, platform: 'tiktok' });
    if (row.facebook) targets.push({ brand, curated, socialHandle: row.facebook, platform: 'facebook' });
    if (row.youtube) targets.push({ brand, curated, socialHandle: row.youtube, platform: 'youtube' });
  }

  return targets;
}

// ─── Post upsert ─────────────────────────────────────────────────────────────

/**
 * Upsert a single post — INSERT ... ON CONFLICT (platform, post_id) DO UPDATE.
 * Uses BIGINT for views/impressions/comments/shares per schema.
 * Posts belong to curated_brand (conflict key is platform + post_id).
 */
export async function upsertPost(p: PostUpsert): Promise<'created' | 'updated' | 'skipped'> {
  const result = await query<{ id: string }>(`
    INSERT INTO post (
      curated_brand_id, platform, post_id, profile, content,
      posted_at, week_start, week_number, year,
      views, impressions, reactions, comments, shares, link,
      post_type, campaign_name
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (platform, post_id) DO UPDATE SET
      profile       = EXCLUDED.profile,
      content       = EXCLUDED.content,
      views         = EXCLUDED.views,
      impressions   = EXCLUDED.impressions,
      reactions     = EXCLUDED.reactions,
      comments      = EXCLUDED.comments,
      shares        = EXCLUDED.shares,
      link          = EXCLUDED.link,
      post_type     = COALESCE(EXCLUDED.post_type, post_type),
      campaign_name = COALESCE(EXCLUDED.campaign_name, campaign_name),
      updated_at    = NOW()
    RETURNING id
  `, [
    p.curated_brand_id,
    p.platform,
    p.post_id,
    p.profile ?? null,
    p.content ?? null,
    p.posted_at,
    p.week_start,
    p.week_number,
    p.year,
    BigInt(p.views),
    BigInt(p.impressions),
    BigInt(p.reactions),
    BigInt(p.comments),
    BigInt(p.shares),
    p.link ?? null,
    p.post_type ?? null,
    p.campaign_name ?? null,
  ]);

  return result.rows.length > 0 ? 'created' : 'skipped';
}

/**
 * Upsert posts — batch version (chunked for efficiency).
 * Returns { created, updated, errors }.
 */
export async function upsertPostsBatch(
  posts: PostUpsert[],
): Promise<{ created: number; updated: number; errors: number }> {
  if (posts.length === 0) return { created: 0, updated: 0, errors: 0 };

  let created = 0;
  let updated = 0;
  let errors = 0;

  await transaction(async (client: PoolClient) => {
    const chunkSize = 50;
    for (let i = 0; i < posts.length; i += chunkSize) {
      const chunk = posts.slice(i, i + chunkSize);

      for (const p of chunk) {
        try {
          // Check if post already exists (for accurate created/updated count)
          const existing = await client.query<{ id: string }>(`
            SELECT id FROM post WHERE platform = $1 AND post_id = $2
          `, [p.platform, p.post_id]);

          await client.query(`
            INSERT INTO post (
              curated_brand_id, platform, post_id, profile, content,
              posted_at, week_start, week_number, year,
              views, impressions, reactions, comments, shares, link,
              post_type, campaign_name
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (platform, post_id) DO UPDATE SET
              profile       = EXCLUDED.profile,
              content       = EXCLUDED.content,
              views         = EXCLUDED.views,
              impressions   = EXCLUDED.impressions,
              reactions     = EXCLUDED.reactions,
              comments      = EXCLUDED.comments,
              shares        = EXCLUDED.shares,
              link          = EXCLUDED.link,
              post_type     = COALESCE(EXCLUDED.post_type, post_type),
              campaign_name = COALESCE(EXCLUDED.campaign_name, campaign_name),
              updated_at    = NOW()
          `, [
            p.curated_brand_id,
            p.platform,
            p.post_id,
            p.profile ?? null,
            p.content ?? null,
            p.posted_at,
            p.week_start,
            p.week_number,
            p.year,
            BigInt(p.views),
            BigInt(p.impressions),
            BigInt(p.reactions),
            BigInt(p.comments),
            BigInt(p.shares),
            p.link ?? null,
            p.post_type ?? null,
            p.campaign_name ?? null,
          ]);

          if (existing.rows.length > 0) updated++;
          else created++;
        } catch {
          errors++;
        }
      }
    }
  });

  return { created, updated, errors };
}

// ─── Brand crawl status ──────────────────────────────────────────────────────

export async function updateBrandCrawlStatus(
  brandId: string,
  status: 'pending' | 'crawling' | 'ready' | 'error',
  errorMessage?: string,
): Promise<void> {
  await query(`
    UPDATE brand SET
      crawl_status    = $2::group_crawl_status,
      last_crawl_at   = NOW(),
      error_message   = $3,
      updated_at      = NOW()
    WHERE id = $1
  `, [brandId, status, errorMessage ?? null]);
}

// ─── Hashtag extraction ───────────────────────────────────────────────────────

export interface ExtractedHashtag {
  curated_brand_id: string;
  hashtag: string;
  count: number;
  first_seen: string;
  last_seen: string;
}

/**
 * Extract hashtags from all posts for a given week.
 * Uses PostgreSQL regex to split content on #hashtags.
 */
export async function extractHashtagsFromPosts(
  weekStart: string,
): Promise<ExtractedHashtag[]> {
  // Skip if week_start is for a partition that might not exist yet
  const rows = await query<{
    curated_brand_id: string;
    hashtag: string;
    count: string;
    first_seen: string;
    last_seen: string;
  }>(`
    SELECT
      p.curated_brand_id,
      LOWER(ht.raw_tag) AS hashtag,
      COUNT(*)          AS count,
      MIN(p.posted_at)::date AS first_seen,
      MAX(p.posted_at)::date AS last_seen
    FROM post p
    CROSS JOIN LATERAL (
      SELECT unnest(
        (regexp_matches(p.content, '(?:^|\\s)(#[\\p{L}0-9_]+)', 'g'))
      ) AS raw_tag
    ) ht
    WHERE p.week_start = $1
      AND p.content IS NOT NULL
      AND p.content != ''
      AND length(replace(ht.raw_tag, '#', '')) >= 3
    GROUP BY p.curated_brand_id, LOWER(ht.raw_tag)
    ORDER BY count DESC
  `, [weekStart]);

  return rows.rows.map(r => ({
    curated_brand_id: r.curated_brand_id,
    hashtag: r.hashtag,
    count: parseInt(r.count, 10),
    first_seen: r.first_seen,
    last_seen: r.last_seen,
  }));
}

// ─── Weekly stats ────────────────────────────────────────────────────────────

/**
 * Aggregate weekly stats for all brands in a group.
 * Uses BIGINT for all numeric columns per schema.
 */
export async function aggregateWeeklyStats(
  groupId: string,
  weekStart: string,
): Promise<void> {
  await query(`
    INSERT INTO weekly_stats (
      brand_id, group_id, week_start, week_number, year,
      total_posts, total_views, total_impressions,
      total_reactions, total_comments, total_shares,
      avg_engagement_rate, gap_pct
    )
    SELECT
      b.id                  AS brand_id,
      $1                    AS group_id,
      $2                    AS week_start,
      EXTRACT(week FROM $2::date)::int AS week_number,
      EXTRACT(year FROM $2::date)::int  AS year,
      COUNT(p.id)           AS total_posts,
      COALESCE(SUM(p.views::bigint), 0)        AS total_views,
      COALESCE(SUM(p.impressions::bigint), 0)   AS total_impressions,
      COALESCE(SUM(p.reactions::bigint), 0)     AS total_reactions,
      COALESCE(SUM(p.comments::bigint), 0)        AS total_comments,
      COALESCE(SUM(p.shares::bigint), 0)         AS total_shares,
      CASE WHEN SUM(p.views::bigint) > 0
        THEN (SUM(p.reactions + p.comments + p.shares)::numeric / NULLIF(SUM(p.views::bigint), 0) * 100)
        ELSE 0
      END AS avg_engagement_rate,
      0 AS gap_pct
    FROM brand b
    LEFT JOIN post p ON p.curated_brand_id = b.curated_brand_id
      AND p.week_start = $2
    WHERE b.group_id = $1
    GROUP BY b.id, b.curated_brand_id
    ON CONFLICT (brand_id, week_start) DO UPDATE SET
      total_posts         = EXCLUDED.total_posts,
      total_views         = EXCLUDED.total_views,
      total_impressions   = EXCLUDED.total_impressions,
      total_reactions     = EXCLUDED.total_reactions,
      total_comments      = EXCLUDED.total_comments,
      total_shares        = EXCLUDED.total_shares,
      avg_engagement_rate = EXCLUDED.avg_engagement_rate,
      updated_at          = NOW()
  `, [groupId, weekStart]);
}

/**
 * Compute gap_pct: (this_week_views - prev_week_views) / prev_week_views * 100.
 */
export async function computeGapPct(
  groupId: string,
  weekStart: string,
): Promise<void> {
  const weekDate = new Date(weekStart + 'T00:00:00Z');
  const prevWeek = new Date(weekDate);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const prevWeekStart = prevWeek.toISOString().slice(0, 10);

  await query(`
    WITH curr AS (
      SELECT brand_id, total_views FROM weekly_stats
      WHERE group_id = $1 AND week_start = $2
    ),
    prev AS (
      SELECT brand_id, total_views FROM weekly_stats
      WHERE group_id = $1 AND week_start = $3
    )
    UPDATE weekly_stats w SET
      gap_pct = CASE
        WHEN p.total_views > 0
          THEN (((c.total_views::numeric - p.total_views) / p.total_views * 100))
        WHEN c.total_views > 0 THEN 100
        ELSE 0
      END,
      updated_at = NOW()
    FROM curr c
    LEFT JOIN prev p ON p.brand_id = c.brand_id
    WHERE w.brand_id = c.brand_id AND w.group_id = $1 AND w.week_start = $2
  `, [groupId, weekStart, prevWeekStart]);
}

/**
 * Compute SOV (Share of Voice) for all brands in a group.
 */
export async function computeSOV(groupId: string, weekStart: string): Promise<void> {
  await query(`
    WITH totals AS (
      SELECT
        brand_id,
        total_views,
        total_reactions,
        total_impressions,
        total_posts,
        SUM(total_views)       OVER (PARTITION BY group_id) AS group_views,
        SUM(total_reactions)   OVER (PARTITION BY group_id) AS group_reactions,
        SUM(total_impressions) OVER (PARTITION BY group_id) AS group_impressions,
        SUM(total_posts)       OVER (PARTITION BY group_id) AS group_posts
      FROM weekly_stats
      WHERE group_id = $1 AND week_start = $2
    )
    UPDATE weekly_stats w SET
      sov_views_pct        = NULLIF(c.total_views, 0)        / NULLIF(c.group_views, 0)       * 100,
      sov_reactions_pct    = NULLIF(c.total_reactions, 0)    / NULLIF(c.group_reactions, 0)   * 100,
      sov_impressions_pct = NULLIF(c.total_impressions, 0) / NULLIF(c.group_impressions, 0) * 100,
      sov_posts_pct        = NULLIF(c.total_posts, 0)        / NULLIF(c.group_posts, 0)       * 100,
      updated_at           = NOW()
    FROM totals c
    WHERE w.brand_id = c.brand_id AND w.group_id = $1 AND w.week_start = $2
  `, [groupId, weekStart]);
}

// ─── Crawl job tracking ───────────────────────────────────────────────────────

/**
 * Insert a new crawl job record.
 */
export async function insertCrawlJob(params: {
  groupId: string;
  brandId?: string;
  jobType: 'full' | 'weekly' | 'hashtag';
  crawlFrom: string;
  crawlTo: string;
}): Promise<string> {
  const rows = await query<{ id: string }>(`
    INSERT INTO crawl_job (group_id, brand_id, job_type, crawl_from, crawl_to, status)
    VALUES ($1, $2, $3::job_type, $4::date, $5::date, 'running')
    RETURNING id
  `, [params.groupId, params.brandId ?? null, params.jobType, params.crawlFrom, params.crawlTo]);
  return rows.rows[0].id;
}

/**
 * Update crawl job as completed.
 */
export async function completeCrawlJob(
  jobId: string,
  stats: { postsTotal: number; postsCreated: number; postsUpdated: number },
): Promise<void> {
  await query(`
    UPDATE crawl_job SET
      status       = 'completed',
      posts_total  = $2,
      posts_created = $3,
      posts_updated = $4,
      completed_at  = NOW()
    WHERE id = $1
  `, [jobId, stats.postsTotal, stats.postsCreated, stats.postsUpdated]);
}

/**
 * Mark crawl job as failed.
 */
export async function failCrawlJob(jobId: string, error: string): Promise<void> {
  await query(`
    UPDATE crawl_job SET
      status     = 'failed',
      error_msg  = $2,
      completed_at = NOW()
    WHERE id = $1
  `, [jobId, error]);
}
