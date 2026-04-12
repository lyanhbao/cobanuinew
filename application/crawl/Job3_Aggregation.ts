/**
 * Job 3: Aggregation — compute weekly_stats for all brands in a group.
 *
 * For each brand, aggregates post data into weekly_stats rows:
 *   - total_posts, total_views, total_impressions, total_reactions,
 *     total_comments, total_shares, total_cost
 *   - avg_engagement_rate = total_reactions / total_views * 100
 *   - network_breakdown, format_breakdown
 *
 * Target weeks: the last 4 complete weeks (or fewer if data is sparse).
 */
import { GroupId, WeekStart, toWeekStart } from '../../lib/types';
import { query, transaction } from '../../lib/db';

export interface AggregationResult {
  groupId: GroupId;
  weeksProcessed: number;
  brandsProcessed: number;
}

/**
 * Aggregate post data into weekly_stats for all brands in a group.
 */
export async function aggregateWeeklyStats(
  groupId: GroupId,
): Promise<AggregationResult> {
  // Determine target weeks: last 4 complete weeks
  const today = new Date();
  const weeks: { week_start: string; week_number: number; year: number }[] = [];

  for (let i = 1; i <= 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const ws = toWeekStart(d);
    const weekNum = getIsoWeekNumber(d);
    weeks.push({ week_start: ws, week_number: weekNum, year: d.getFullYear() });
  }

  // Get all brands in group
  const brandResult = await query<{ brand_id: string; curated_brand_id: string }>(
    `SELECT b.id AS brand_id, b.curated_brand_id
     FROM brand b WHERE b.group_id = $1`,
    [groupId],
  );

  let brandsProcessed = 0;
  let weeksProcessed = 0;

  for (const brand of brandResult.rows) {
    for (const week of weeks) {
      const result = await aggregateBrandWeek(
        groupId,
        brand.brand_id,
        brand.curated_brand_id,
        week.week_start,
        week.week_number,
        week.year,
      );
      if (result) weeksProcessed++;
    }
    brandsProcessed++;
  }

  return { groupId, weeksProcessed, brandsProcessed };
}

interface AggregationRow {
  total_posts: number;
  total_views: number;
  total_impressions: number;
  total_reactions: number;
  total_comments: number;
  total_shares: number;
  total_cost: number;
  network_breakdown: Record<string, number>;
  format_breakdown: Record<string, number>;
}

/**
 * Aggregate posts for a single brand × week.
 */
async function aggregateBrandWeek(
  groupId: string,
  brandId: string,
  curatedBrandId: string,
  weekStart: string,
  weekNumber: number,
  year: number,
): Promise<boolean> {
  const weekEnd = new Date(weekStart + 'T00:00:00Z');
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const aggResult = await query<AggregationRow>(
    `SELECT
       COUNT(*)::int AS total_posts,
       COALESCE(SUM(views), 0) AS total_views,
       COALESCE(SUM(impressions), 0) AS total_impressions,
       COALESCE(SUM(reactions), 0) AS total_reactions,
       COALESCE(SUM(comments), 0) AS total_comments,
       COALESCE(SUM(shares), 0) AS total_shares,
       COALESCE(SUM(cost), 0) AS total_cost,
       COALESCE(
         jsonb_object_agg(platform, agg_views)::jsonb,
         '{}'::jsonb
       ) AS network_breakdown,
       COALESCE(
         jsonb_object_agg(fmt, agg_fmt_views)::jsonb,
         '{}'::jsonb
       ) AS format_breakdown
     FROM (
       SELECT platform, SUM(views) AS agg_views
       FROM post
       WHERE curated_brand_id = $1
         AND week_start = $2::date
       GROUP BY platform
     ) AS network_agg
     CROSS JOIN (
       SELECT COALESCE(format, 'Unknown') AS fmt, SUM(views) AS agg_fmt_views
       FROM post
       WHERE curated_brand_id = $1
         AND week_start = $2::date
       GROUP BY format
     ) AS format_agg
     CROSS JOIN LATERAL (
       SELECT COUNT(*)::int AS total_posts,
              COALESCE(SUM(views), 0) AS total_views,
              COALESCE(SUM(impressions), 0) AS total_impressions,
              COALESCE(SUM(reactions), 0) AS total_reactions,
              COALESCE(SUM(comments), 0) AS total_comments,
              COALESCE(SUM(shares), 0) AS total_shares,
              COALESCE(SUM(cost), 0) AS total_cost
       FROM post
       WHERE curated_brand_id = $1 AND week_start = $2::date
     ) AS totals`,
    [curatedBrandId, weekStart],
  );

  // The cross join approach above is awkward; use a simpler aggregation
  const agg = await query<AggregationRow>(
    `SELECT
       COUNT(*)::int AS total_posts,
       COALESCE(SUM(views), 0) AS total_views,
       COALESCE(SUM(impressions), 0) AS total_impressions,
       COALESCE(SUM(reactions), 0) AS total_reactions,
       COALESCE(SUM(comments), 0) AS total_comments,
       COALESCE(SUM(shares), 0) AS total_shares,
       COALESCE(SUM(cost), 0) AS total_cost
     FROM post
     WHERE curated_brand_id = $1
       AND week_start = $2::date`,
    [curatedBrandId, weekStart],
  );

  const agg2 = await query<{ platform: string; views: number }>(
    `SELECT platform, COALESCE(SUM(views), 0) AS views
     FROM post
     WHERE curated_brand_id = $1 AND week_start = $2::date
     GROUP BY platform`,
    [curatedBrandId, weekStart],
  );

  const agg3 = await query<{ fmt: string; views: number }>(
    `SELECT COALESCE(format, 'Unknown') AS fmt,
            COALESCE(SUM(views), 0) AS views
     FROM post
     WHERE curated_brand_id = $1 AND week_start = $2::date
     GROUP BY format`,
    [curatedBrandId, weekStart],
  );

  const row = agg.rows[0];
  if (!row || row.total_posts === 0) return false;

  const networkBreakdown: Record<string, number> = {};
  for (const r of agg2.rows) networkBreakdown[r.platform] = Number(r.views);

  const formatBreakdown: Record<string, number> = {};
  for (const r of agg3.rows) formatBreakdown[r.fmt] = Number(r.views);

  const engagementRate =
    Number(row.total_views) > 0
      ? (Number(row.total_reactions) / Number(row.total_views)) * 100
      : 0;

  const weekEndDate = new Date(weekStart + 'T00:00:00Z');
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO weekly_stats (
         brand_id, group_id, year, week_number, week_start, week_end,
         total_posts, total_views, total_impressions, total_reactions,
         total_comments, total_shares, total_cost,
         avg_engagement_rate, network_breakdown, format_breakdown
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (group_id, brand_id, week_start) DO UPDATE SET
         total_posts = EXCLUDED.total_posts,
         total_views = EXCLUDED.total_views,
         total_impressions = EXCLUDED.total_impressions,
         total_reactions = EXCLUDED.total_reactions,
         total_comments = EXCLUDED.total_comments,
         total_shares = EXCLUDED.total_shares,
         total_cost = EXCLUDED.total_cost,
         avg_engagement_rate = EXCLUDED.avg_engagement_rate,
         network_breakdown = EXCLUDED.network_breakdown,
         format_breakdown = EXCLUDED.format_breakdown,
         updated_at = now()`,
      [
        brandId, groupId, year, weekNumber, weekStart,
        weekEndDate.toISOString().slice(0, 10),
        row.total_posts, row.total_views, row.total_impressions,
        row.total_reactions, row.total_comments, row.total_shares,
        row.total_cost, engagementRate,
        JSON.stringify(networkBreakdown),
        JSON.stringify(formatBreakdown),
      ],
    );
  });

  return true;
}

/**
 * Get ISO week number for a Date.
 */
function getIsoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
