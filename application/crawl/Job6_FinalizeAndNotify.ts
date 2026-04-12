/**
 * Job 6: FinalizeAndNotify — finalize weekly_report and notify.
 *
 * Steps:
 *   1. Mark weekly_report as finalized
 *   2. Refresh materialized view
 *   3. Trigger notification (stub)
 */
import { GroupId } from '../../lib/types';
import { query } from '../../lib/db';

export interface FinalizeResult {
  groupId: GroupId;
  weekStart: string;
  reportFinalized: boolean;
  notified: boolean;
}

/**
 * Finalize the weekly report and trigger notifications.
 */
export async function finalizeAndNotify(
  groupId: GroupId,
): Promise<FinalizeResult> {
  // Get the latest week
  const latestWeekResult = await query<{
    week_start: string;
    year: number;
    week_number: number;
  }>(
    `SELECT MAX(week_start) AS week_start,
            EXTRACT(YEAR FROM MAX(week_start))::int AS year,
            EXTRACT(WEEK FROM MAX(week_start))::int AS week_number
     FROM weekly_stats
     WHERE group_id = $1`,
    [groupId],
  );

  const weekRow = latestWeekResult.rows[0];
  if (!weekRow) return { groupId, weekStart: '', reportFinalized: false, notified: false };

  const { week_start: weekStart, year, week_number: weekNumber } = weekRow;

  // Compute week end
  const weekEnd = new Date(weekStart + 'T00:00:00Z');
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Upsert weekly_report
  const reportResult = await query<{ id: string }>(
    `INSERT INTO weekly_report (group_id, year, week_number, week_start, week_end, status)
     VALUES ($1, $2, $3, $4, $5, 'finalized')
     ON CONFLICT (group_id, week_start) DO UPDATE SET
       status = 'finalized',
       updated_at = now()
     RETURNING id`,
    [groupId, year, weekNumber, weekStart, weekEnd.toISOString().slice(0, 10)],
  );

  const reportFinalized = reportResult.rows.length > 0;

  // Refresh materialized view
  await query(`REFRESH MATERIALIZED VIEW mv_latest_rankings`);

  // Update group status
  await query(
    `UPDATE "group" SET
       crawl_status = 'ready',
       last_crawl_at = now()
     WHERE id = $1`,
    [groupId],
  );

  // Notify (stub — replace with actual notification logic)
  let notified = false;
  try {
    notified = await triggerNotification(groupId, weekStart);
  } catch {
    notified = false;
  }

  return { groupId, weekStart, reportFinalized, notified };
}

/**
 * Trigger notification for report completion.
 * Stub: in production, send email/Slack/webhook.
 */
async function triggerNotification(groupId: GroupId, weekStart: string): Promise<boolean> {
  // Get report summary
  const summaryResult = await query<{
    total_posts: number;
    total_impressions: string;
    total_reactions: string;
    brands: string;
  }>(
    `SELECT
       COALESCE(SUM(ws.total_posts), 0)::int AS total_posts,
       COALESCE(SUM(ws.total_impressions), 0)::bigint AS total_impressions,
       COALESCE(SUM(ws.total_reactions), 0)::bigint AS total_reactions,
       COUNT(DISTINCT ws.brand_id) AS brands
     FROM weekly_stats ws
     WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
    [groupId, weekStart],
  );

  void summaryResult.rows[0]; // stub usage

  return true;
}
