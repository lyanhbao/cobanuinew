/**
 * Job 2: GapCalculation — post-level W vs W-1 gap analysis.
 *
 * Computes gap_pct for weekly_stats by comparing:
 *   - W (current week) impressions vs W-1 impressions
 *   - W posts vs W-1 posts
 *
 * The gap_pct is: (W_impressions - W-1_impressions) / W-1_impressions * 100
 */
import { GroupId, WeekStart } from '../../lib/types';
import { query } from '../../lib/db';

export interface GapResult {
  groupId: GroupId;
  brandsUpdated: number;
}

/**
 * Calculate weekly gaps for all brands in a group.
 * Compares the latest completed week against the previous week.
 */
export async function calculateGaps(groupId: GroupId): Promise<GapResult> {
  // Get the latest two weeks with stats for this group
  const weeksResult = await query<{ week_start: string }>(
    `SELECT DISTINCT week_start
     FROM weekly_stats
     WHERE group_id = $1
     ORDER BY week_start DESC
     LIMIT 2`,
    [groupId],
  );

  if (weeksResult.rows.length < 2) {
    // Not enough data for gap calculation
    return { groupId, brandsUpdated: 0 };
  }

  const [currentWeek, prevWeek] = [weeksResult.rows[0]!.week_start, weeksResult.rows[1]!.week_start];

  // Compute gaps via join
  const updateResult = await query(
    `UPDATE weekly_stats ws
     SET gap_pct = CASE
         WHEN prev.total_impressions > 0
           THEN ((ws.total_impressions - prev.total_impressions) / prev.total_impressions) * 100
         ELSE 0
       END
     FROM weekly_stats AS prev
     WHERE ws.brand_id = prev.brand_id
       AND ws.group_id = prev.group_id
       AND ws.group_id = $1
       AND ws.week_start = $2::date
       AND prev.week_start = $3::date`,
    [groupId, currentWeek, prevWeek],
  );

  // Get count of updated brands
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT brand_id) AS count
     FROM weekly_stats
     WHERE group_id = $1 AND week_start = $2::date AND gap_pct IS NOT NULL`,
    [groupId, currentWeek],
  );

  return {
    groupId,
    brandsUpdated: parseInt(countResult.rows[0]?.count ?? '0', 10),
  };
}

/**
 * Calculate gap for a specific brand and week.
 */
export async function calculateBrandGap(
  groupId: GroupId,
  brandId: string,
  weekStart: WeekStart,
): Promise<number | null> {
  // Find the previous week
  const prevWeekResult = await query<{ prev_week: string }>(
    `SELECT MAX(week_start) AS prev_week
     FROM weekly_stats
     WHERE group_id = $1 AND brand_id = $2 AND week_start < $3::date`,
    [groupId, brandId, weekStart],
  );

  const prevWeek = prevWeekResult.rows[0]?.prev_week;
  if (!prevWeek) return null;

  const gapResult = await query<{ gap_pct: number | null }>(
    `SELECT
       CASE
         WHEN prev.total_impressions > 0
           THEN ((curr.total_impressions - prev.total_impressions) / prev.total_impressions) * 100
         ELSE 0
       END AS gap_pct
     FROM weekly_stats curr
     JOIN weekly_stats prev ON prev.brand_id = curr.brand_id AND prev.week_start = $4::date
     WHERE curr.group_id = $1 AND curr.brand_id = $2 AND curr.week_start = $3::date`,
    [groupId, brandId, weekStart, prevWeek],
  );

  return gapResult.rows[0]?.gap_pct ?? null;
}
