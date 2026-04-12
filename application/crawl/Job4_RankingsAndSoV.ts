/**
 * Job 4: RankingsAndSoV — compute SOV (Share of Voice) and rankings.
 *
 * For the latest week, computes:
 *   - sov_impressions_pct per brand = brand_impressions / total_group_impressions * 100
 *   - sov_views_pct, sov_reactions_pct, sov_posts_pct
 *   - Rank by total_impressions DESC
 */
import { GroupId } from '../../lib/types';
import { query } from '../../lib/db';

export interface RankingsResult {
  groupId: GroupId;
  brandsUpdated: number;
  weekStart: string;
}

/**
 * Compute SOV and rankings for all brands in a group for the latest week.
 */
export async function computeRankingsAndSoV(
  groupId: GroupId,
): Promise<RankingsResult> {
  // Find the latest week with stats
  const latestWeekResult = await query<{ week_start: string }>(
    `SELECT MAX(week_start) AS week_start
     FROM weekly_stats
     WHERE group_id = $1`,
    [groupId],
  );

  const weekStart = latestWeekResult.rows[0]?.week_start;
  if (!weekStart) return { groupId, brandsUpdated: 0, weekStart: '' };

  // Compute total impressions for SOV calculation
  const totalResult = await query<{ total: number }>(
    `SELECT COALESCE(SUM(total_impressions), 0) AS total
     FROM weekly_stats
     WHERE group_id = $1 AND week_start = $2::date`,
    [groupId, weekStart],
  );

  const totalImpressions = Number(totalResult.rows[0]?.total) || 1;

  // Update SOV percentages
  const updateResult = await query(
    `UPDATE weekly_stats ws SET
       sov_impressions_pct = CASE
         WHEN $3 > 0 THEN (ws.total_impressions / $3) * 100
         ELSE 0
       END,
       sov_views_pct = CASE
         WHEN (SELECT SUM(total_views) FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date) > 0
           THEN (ws.total_views / (SELECT SUM(total_views) FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date)) * 100
         ELSE 0
       END,
       sov_reactions_pct = CASE
         WHEN (SELECT SUM(total_reactions) FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date) > 0
           THEN (ws.total_reactions / (SELECT SUM(total_reactions) FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date)) * 100
         ELSE 0
       END,
       sov_posts_pct = CASE
         WHEN (SELECT SUM(total_posts) FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date) > 0
           THEN (ws.total_posts::float / (SELECT SUM(total_posts) FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date)) * 100
         ELSE 0
       END
     WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
    [groupId, weekStart, totalImpressions],
  );

  // Count updated brands
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM weekly_stats
     WHERE group_id = $1 AND week_start = $2::date AND sov_impressions_pct IS NOT NULL`,
    [groupId, weekStart],
  );

  // Refresh materialized view
  await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_rankings`);

  return {
    groupId,
    brandsUpdated: parseInt(countResult.rows[0]?.count ?? '0', 10),
    weekStart,
  };
}
