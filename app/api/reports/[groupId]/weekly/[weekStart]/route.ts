/**
 * GET  /api/reports/[groupId]/weekly/[weekStart]
 * POST /api/reports/[groupId]/weekly/[weekStart]/export  (CSV export)
 * Specific week report — fetches weekly report for a given week_start.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../../lib/db';
import { z } from 'zod';
import { formatWeek } from '../../../../../../lib/week-format';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

interface WeekInfo {
  label: string;
  start: string;
  number: number;
  year: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; weekStart: string }> },
): Promise<NextResponse> {
  try {
    const { groupId, weekStart } = paramsSchema.parse(await params);

    const reportResult = await query<{
      id: string;
      week_start: string;
      week_end: string;
      week_number: number;
      year: number;
      total_posts: number;
      total_views: string;
      total_impressions: string;
      total_reactions: string;
      status: string;
      alerts: unknown;
      created_at: string;
    }>(
      `SELECT id, week_start, week_end, week_number, year,
              total_posts, total_views, total_impressions, total_reactions,
              status, alerts, created_at
       FROM weekly_report
       WHERE group_id = $1 AND week_start = $2::date`,
      [groupId, weekStart],
    );

    if (reportResult.rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    const report = reportResult.rows[0]!;
    const weekInfo: WeekInfo = {
      label: formatWeek(report.week_start),
      start: report.week_start,
      number: report.week_number,
      year: report.year,
    };

    // Brand-level breakdown
    // FIX: aligned with weekly_stats schema — no sov_impressions_pct column.
    // SOV is computed client-side from total_impressions.
    const breakdownResult = await query<{
      brand_id: string;
      brand_name: string;
      is_primary: boolean;
      total_impressions: string;
      total_reactions: string;
      total_posts: number;
      gap_pct: string | null;
    }>(
      `SELECT
         b.id AS brand_id,
         cb.name AS brand_name,
         b.is_primary,
         ws.total_impressions,
         ws.total_reactions,
         ws.total_posts,
         ws.gap_pct
       FROM weekly_stats ws
       JOIN brand b ON b.id = ws.brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE ws.group_id = $1 AND ws.week_start = $2::date
       ORDER BY ws.total_impressions DESC`,
      [groupId, weekStart],
    );

    // Compute SOV percentage from total impressions
    let totalGroupImpressions = 0;
    for (const r of breakdownResult.rows) {
      totalGroupImpressions += Number(r.total_impressions);
    }

    const breakdown = breakdownResult.rows.map((r) => ({
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      is_primary: r.is_primary,
      impressions: Number(r.total_impressions),
      reactions: Number(r.total_reactions),
      posts: r.total_posts,
      sov_pct: totalGroupImpressions > 0
        ? parseFloat(((Number(r.total_impressions) / totalGroupImpressions) * 100).toFixed(2))
        : null,
      gap_pct: r.gap_pct !== null ? Number(r.gap_pct) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        week: weekInfo,
        report: {
          id: report.id,
          week_start: report.week_start,
          week_end: report.week_end,
          week_number: report.week_number,
          year: report.year,
          total_posts: report.total_posts,
          total_views: Number(report.total_views),
          total_impressions: Number(report.total_impressions),
          total_reactions: Number(report.total_reactions),
          status: report.status,
          alerts: report.alerts,
          created_at: report.created_at,
        },
        breakdown,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load weekly report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
