/**
 * GET /api/reports/[groupId]/weekly
 * Current week report — fetches the latest available weekly report.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { formatWeek } from '../../../../../lib/week-format';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
});

interface WeekInfo {
  label: string;
  start: string;
  number: number;
  year: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  try {
    const { groupId } = paramsSchema.parse(await params);

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
       WHERE group_id = $1
       ORDER BY week_start DESC
       LIMIT 1`,
      [groupId],
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
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load weekly report';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
