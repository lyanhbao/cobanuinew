/**
 * Job 5: ActivityReport — create brand_activity records.
 *
 * Identifies notable activity per brand per week:
 *   - viral_post: impressions > 2x weekly average
 *   - reengaged_post: reactions > 3x weekly average
 *   - anomaly: gap_pct > 50% or gap_pct < -30%
 *   - new_post: is_new brand with first data
 */
import { GroupId, ActivityType, AlertLevel } from '../../lib/types';
import { query } from '../../lib/db';

export interface ActivityResult {
  groupId: GroupId;
  activitiesCreated: number;
}

/**
 * Generate brand_activity records for all brands in a group.
 */
export async function generateActivityReport(
  groupId: GroupId,
): Promise<ActivityResult> {
  // Get latest week stats
  const latestWeekResult = await query<{
    brand_id: string;
    week_start: string;
    total_impressions: number;
    total_reactions: number;
    gap_pct: number | null;
    is_new: boolean;
  }>(
    `SELECT ws.brand_id, ws.week_start, ws.total_impressions, ws.total_reactions,
            ws.gap_pct, ws.is_new
     FROM weekly_stats ws
     WHERE ws.group_id = $1
       AND ws.week_start = (SELECT MAX(week_start) FROM weekly_stats WHERE group_id = $1)
     ORDER BY ws.total_impressions DESC`,
    [groupId],
  );

  let activitiesCreated = 0;

  // Compute group averages
  const avgResult = await query<{ avg_impressions: number; avg_reactions: number }>(
    `SELECT
       AVG(total_impressions)::float AS avg_impressions,
       AVG(total_reactions)::float AS avg_reactions
     FROM weekly_stats
     WHERE group_id = $1
       AND week_start = (SELECT MAX(week_start) FROM weekly_stats WHERE group_id = $1)`,
    [groupId],
  );

  const avgImpressions = Number(avgResult.rows[0]?.avg_impressions) || 1;
  const avgReactions = Number(avgResult.rows[0]?.avg_reactions) || 1;

  for (const row of latestWeekResult.rows) {
    const activities: {
      activity_type: ActivityType;
      alert_level: AlertLevel;
      title: string;
      description: string;
      metric_value: number;
      gap_pct: number | null;
    }[] = [];

    // Viral post: impressions > 2x average
    if (Number(row.total_impressions) > avgImpressions * 2) {
      activities.push({
        activity_type: 'viral',
        alert_level: 'warning',
        title: 'Viral Post Detected',
        description: `Impressions ${formatNum(row.total_impressions)} exceeded 2x weekly average`,
        metric_value: Number(row.total_impressions),
        gap_pct: row.gap_pct,
      });
    }

    // Re-engaged post: reactions > 3x average
    if (Number(row.total_reactions) > avgReactions * 3) {
      activities.push({
        activity_type: 'reengaged',
        alert_level: 'info',
        title: 'Re-engaged Audience',
        description: `Reactions ${formatNum(row.total_reactions)} exceeded 3x weekly average`,
        metric_value: Number(row.total_reactions),
        gap_pct: row.gap_pct,
      });
    }

    // Anomaly: gap_pct > 50% or < -30%
    if (row.gap_pct !== null) {
      if (row.gap_pct > 50 || row.gap_pct < -30) {
        const level: AlertLevel = row.gap_pct > 50 ? 'critical' : 'warning';
        activities.push({
          activity_type: 'anomaly',
          alert_level: level,
          title: `Performance ${row.gap_pct > 0 ? 'Spike' : 'Drop'}`,
          description: `Impressions changed by ${row.gap_pct > 0 ? '+' : ''}${row.gap_pct.toFixed(1)}% week-over-week`,
          metric_value: Number(row.total_impressions),
          gap_pct: row.gap_pct,
        });
      }
    }

    // New post: brand is new
    if (row.is_new) {
      activities.push({
        activity_type: 'new_post',
        alert_level: 'info',
        title: 'New Brand Tracking',
        description: 'Brand appeared for the first time in this competitive group',
        metric_value: Number(row.total_impressions),
        gap_pct: null,
      });
    }

    // Get a sample post_id for this brand/week
    const postResult = await query<{ id: string }>(
      `SELECT p.id FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.id = $1 AND p.week_start = $2::date
       LIMIT 1`,
      [row.brand_id, row.week_start],
    );

    const postId = postResult.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000';

    // Insert activities
    for (const activity of activities) {
      await query(
        `INSERT INTO brand_activity (
           brand_id, post_id, activity_type, alert_level, title,
           description, metric_value, curr_perf, change_pct, week_start, year
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)`,
        [
          row.brand_id,
          postId,
          activity.activity_type,
          activity.alert_level,
          activity.title,
          activity.description,
          activity.metric_value,
          activity.gap_pct,
          row.week_start,
          new Date(row.week_start).getFullYear(),
        ],
      );
      activitiesCreated++;
    }
  }

  return { groupId, activitiesCreated };
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
