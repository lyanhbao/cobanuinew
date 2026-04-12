/**
 * GET /api/dashboard/[groupId]/overview
 * Returns KPIs, SOV, network breakdown, and insights for the latest week.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import { verifyJwt } from '../../../../../lib/auth';

const paramsSchema = z.object({ groupId: z.string().uuid() });

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

interface WeekRow { week_start: string; week_number: number; year: number }

interface KpiRow {
  total_impressions: string;
  total_views: string;
  total_reactions: string;
  total_posts: string;
  avg_er: string;
}
interface SovRow {
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  total_impressions: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(_req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { groupId } = paramsSchema.parse(await params);

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    // Use ::text to bypass JS Date timezone conversion (pg returns date as UTC midnight)
    const weekRows = await query<WeekRow>(
      `SELECT week_start::text AS week_start, week_number, year
       FROM weekly_stats WHERE group_id = $1 ORDER BY week_start DESC LIMIT 1`,
      [groupId],
    );

    if (weekRows.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { week: null, kpis: null, sov: [], network_breakdown: [], insights: [] },
      });
    }

    const week = weekRows.rows[0]!;
    const weekStart = week.week_start; // already a "YYYY-MM-DD" string

    // KPIs: aggregate all brands in group for this week
    const kpiRows = await query<KpiRow>(
      `SELECT
         COALESCE(SUM(ws.total_impressions), 0) AS total_impressions,
         COALESCE(SUM(ws.total_views), 0) AS total_views,
         COALESCE(SUM(ws.total_reactions), 0) AS total_reactions,
         COALESCE(SUM(ws.total_posts), 0) AS total_posts,
         COALESCE(AVG(ws.avg_engagement_rate), 0) AS avg_er
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
      [groupId, weekStart],
    );
    const kpi = kpiRows.rows[0]!;

    // SOV: impressions per brand + primary brand share
    // LEFT JOIN from brand to include primary brand even if it has no stats this week
    const sovRows = await query<SovRow>(
      `SELECT
         b.id AS brand_id,
         cb.name AS brand_name,
         b.is_primary,
         COALESCE(SUM(ws.total_impressions), 0) AS total_impressions
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       LEFT JOIN weekly_stats ws ON ws.brand_id = b.id AND ws.week_start = $2::date
       WHERE b.group_id = $1
       GROUP BY b.id, cb.name, b.is_primary
       ORDER BY SUM(ws.total_impressions) DESC NULLS LAST`,
      [groupId, weekStart],
    );

    const totalImpressions = Number(kpi.total_impressions) || 1;
    const sov = sovRows.rows.map((r) => ({
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      is_primary: r.is_primary,
      impressions: Number(r.total_impressions),
      sov_pct: Math.round((Number(r.total_impressions) / totalImpressions) * 1000) / 10,
    }));

    const primarySov = sov.find((s) => s.is_primary)?.sov_pct ?? null;

    // Network breakdown: aggregate from all brand JSONB breakdowns
    const netRows = await query<{ nb: Record<string, number> }>(
      `SELECT ws.network_breakdown AS nb
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start = $2::date
       ORDER BY ws.total_impressions DESC
       LIMIT 1`,
      [groupId, weekStart],
    );

    const nbRaw = netRows.rows[0]?.nb ?? {};
    const networkBreakdown = Object.entries(nbRaw as Record<string, number>).map(
      ([platform, impressions]) => ({
        platform,
        impressions,
        pct: Math.round((impressions / totalImpressions) * 1000) / 10,
      }),
    );

    // Insights: WoW changes
    const prevWeekRows = await query<{ week_start: string }>(
      `SELECT week_start FROM weekly_stats
       WHERE group_id = $1 AND week_start < $2::date
       ORDER BY week_start DESC LIMIT 1`,
      [groupId, weekStart],
    );

    const insights: Array<{ brand_name: string; metric: string; change: string; direction: string }> = [];
    if (prevWeekRows.rows.length > 0) {
      const prevWeek = prevWeekRows.rows[0]!.week_start;
      const insightRows = await query<{ brand_name: string; change: string | null }>(
        `SELECT
           cb.name AS brand_name,
           CASE
             WHEN p.total_impressions > 0
               THEN ROUND(((c.total_impressions - p.total_impressions)::numeric / p.total_impressions * 100), 1)
             ELSE NULL
           END AS change
         FROM weekly_stats c
         JOIN brand b ON b.id = c.brand_id
         JOIN curated_brand cb ON cb.id = b.curated_brand_id
         LEFT JOIN weekly_stats p ON p.brand_id = c.brand_id AND p.week_start = $3::date
         WHERE c.group_id = $1 AND c.week_start = $2::date
         ORDER BY change DESC NULLS LAST
         LIMIT 5`,
        [groupId, weekStart, prevWeek],
      );

      for (const row of insightRows.rows) {
        if (row.change === null) continue;
        const pct = Number(row.change);
        insights.push({
          brand_name: row.brand_name,
          metric: 'impressions',
          change: `${pct > 0 ? '+' : ''}${pct}%`,
          direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'neutral',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        week: {
          label: weekLabel(weekStart),
          start: weekStart,
          number: week.week_number,
          year: week.year,
        },
        kpis: {
          total_impressions: Number(kpi.total_impressions),
          total_views: Number(kpi.total_views),
          total_reactions: Number(kpi.total_reactions),
          total_posts: Number(kpi.total_posts),
          avg_engagement_rate: Math.round(Number(kpi.avg_er) * 10) / 10,
          sov_primary: primarySov,
        },
        sov,
        network_breakdown: networkBreakdown,
        insights,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load overview';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}