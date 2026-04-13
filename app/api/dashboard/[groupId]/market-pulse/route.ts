/**
 * GET /api/dashboard/[groupId]/market-pulse
 * Composite market energy score (0-100) based on WoW deltas across all brands.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../lib/db";
import { z } from "zod";
import { weekLabel } from "../../../../../lib/week-format";
import { verifyJwt } from "../../../../../lib/auth";

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  week: z.string().optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyJwt(auth.slice(7));
}

interface WeekRow { week_start: string; week_number: number; year: number }

interface AggRow {
  total_cost: string;
  total_impressions: string;
  total_reactions: string;
  total_posts: string;
  total_engagement: string;
}

interface SovRow {
  sov_pct: string;
  total_impressions?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawParams = paramsSchema.parse({
      ...Object.fromEntries(req.nextUrl.searchParams),
      ...await params,
    });
    const { groupId, week: requestedWeek } = rawParams;

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

    // Resolve current week
    let weekStart: string;
    let weekNumber: number;
    let weekYear: number;

    if (requestedWeek) {
      const weekInfoRow = await query<WeekRow>(
        `SELECT week_start::text AS week_start, week_number, year
         FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date LIMIT 1`,
        [groupId, requestedWeek],
      );
      if (weekInfoRow.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: { score: null, trend: null, breakdown: null, week: null },
        });
      }
      const w = weekInfoRow.rows[0]!;
      weekStart = w.week_start;
      weekNumber = w.week_number;
      weekYear = w.year;
    } else {
      const weekRows = await query<WeekRow>(
        `SELECT week_start::text AS week_start, week_number, year
         FROM weekly_stats WHERE group_id = $1 ORDER BY week_start DESC LIMIT 1`,
        [groupId],
      );
      if (weekRows.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: { score: null, trend: null, breakdown: null, week: null },
        });
      }
      const w = weekRows.rows[0]!;
      weekStart = w.week_start;
      weekNumber = w.week_number;
      weekYear = w.year;
    }

    const weekInfo = { label: weekLabel(weekStart), start: weekStart, number: weekNumber, year: weekYear };

    // Compute prev week
    const prevWeekRows = await query<{ week_start: string }>(
      `SELECT week_start::text AS week_start FROM weekly_stats
       WHERE group_id = $1 AND week_start < $2::date ORDER BY week_start DESC LIMIT 1`,
      [groupId, weekStart],
    );
    const prevWeekStart = prevWeekRows.rows[0]?.week_start;

    // Aggregate stats for current week
    const currAggRows = await query<AggRow>(
      `SELECT
         0::numeric AS total_cost,
         COALESCE(SUM(ws.total_impressions), 0)::bigint AS total_impressions,
         COALESCE(SUM(ws.total_reactions), 0)::bigint AS total_reactions,
         COALESCE(SUM(ws.total_posts), 0)::bigint AS total_posts,
         COALESCE(SUM(ws.total_reactions), 0)::bigint AS total_engagement
       FROM weekly_stats ws WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
      [groupId, weekStart],
    );
    const curr = currAggRows.rows[0]!;

    // Aggregate stats for previous week
    let prev: AggRow | null = null;
    if (prevWeekStart) {
      const prevAggRows = await query<AggRow>(
        `SELECT
           0::numeric AS total_cost,
           COALESCE(SUM(ws.total_impressions), 0)::bigint AS total_impressions,
           COALESCE(SUM(ws.total_reactions), 0)::bigint AS total_reactions,
           COALESCE(SUM(ws.total_posts), 0)::bigint AS total_posts,
           COALESCE(SUM(ws.total_reactions), 0)::bigint AS total_engagement
         FROM weekly_stats ws WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
        [groupId, prevWeekStart],
      );
      prev = prevAggRows.rows[0]!;
    }

    // Compute per-brand SOV for current and previous week
    const currSovRows = await query<SovRow>(
      `SELECT
         SUM(ws.total_impressions)::numeric AS total_impressions,
         COALESCE(SUM(ws.total_impressions), 0)::numeric AS brand_impressions
       FROM weekly_stats ws WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
      [groupId, weekStart],
    );
    const totalImpressionsCurr = Number(currSovRows.rows[0]?.total_impressions ?? 0);

    let prevSov = 0;
    if (prevWeekStart) {
      const prevSovRows = await query<SovRow>(
        `SELECT COALESCE(SUM(total_impressions), 0)::numeric AS total_impressions
         FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date`,
        [groupId, prevWeekStart],
      );
      prevSov = Number(prevSovRows.rows[0]?.total_impressions ?? 0);
    }

    // Get primary brand SOV for current and previous
    const primarySovCurrRows = await query<SovRow>(
      `SELECT COALESCE(SUM(ws.total_impressions), 0)::numeric / NULLIF($2, 0) * 100 AS sov_pct
       FROM weekly_stats ws JOIN brand b ON b.id = ws.brand_id
       WHERE ws.group_id = $1 AND ws.week_start = $3::date AND b.is_primary = 't'`,
      [groupId, totalImpressionsCurr || 1, weekStart],
    );
    const primarySovCurr = Number(primarySovCurrRows.rows[0]?.sov_pct ?? 0);

    let primarySovPrev = 0;
    if (prevWeekStart) {
      const prevSovTotalRows = await query<{ total: string }>(
        `SELECT COALESCE(SUM(total_impressions), 0)::numeric AS total
         FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date`,
        [groupId, prevWeekStart],
      );
      const prevTotal = Number(prevSovTotalRows.rows[0]?.total ?? 1);
      const prevPrimaryRows = await query<SovRow>(
        `SELECT COALESCE(SUM(ws.total_impressions), 0)::numeric / NULLIF($2, 0) * 100 AS sov_pct
         FROM weekly_stats ws JOIN brand b ON b.id = ws.brand_id
         WHERE ws.group_id = $1 AND ws.week_start = $3::date AND b.is_primary = 't'`,
        [groupId, prevTotal || 1, prevWeekStart],
      );
      primarySovPrev = Number(prevPrimaryRows.rows[0]?.sov_pct ?? 0);
    }

    // Compute deltas
    const spendCurr = Number(curr.total_cost) || 0;
    const spendPrev = prev ? Number(prev.total_cost) || 0 : spendCurr;
    const engagementCurr = Number(curr.total_engagement) || 0;
    const engagementPrev = prev ? Number(prev.total_engagement) || 0 : engagementCurr;
    const postsCurr = Number(curr.total_posts) || 0;
    const postsPrev = prev ? Number(prev.total_posts) || 0 : postsCurr;

    const spendDelta = spendPrev > 0 ? ((spendCurr - spendPrev) / spendPrev) * 100 : 0;
    const engagementDelta = engagementPrev > 0 ? ((engagementCurr - engagementPrev) / engagementPrev) * 100 : 0;
    const frequencyDelta = postsPrev > 0 ? ((postsCurr - postsPrev) / postsPrev) * 100 : 0;
    const sovShift = primarySovCurr - primarySovPrev;

    // Min-max normalization for each metric, then composite score
    // For normalization, use reasonable bounds; for deltas that can be negative, shift to 0-1
    // spend_delta: typically -20 to +50
    const normSpend = Math.max(0, Math.min(1, (spendDelta + 20) / 70));
    // engagement_delta: typically -30 to +80
    const normEngagement = Math.max(0, Math.min(1, (engagementDelta + 30) / 110));
    // frequency_delta: typically -40 to +60
    const normFrequency = Math.max(0, Math.min(1, (frequencyDelta + 40) / 100));
    // sov_shift: typically -10 to +10
    const normSovShift = Math.max(0, Math.min(1, (sovShift + 10) / 20));

    // Weighted composite: spend 20%, engagement 40%, frequency 15%, sov 25%
    const composite = Math.round(
      (normSpend * 0.20 + normEngagement * 0.40 + normFrequency * 0.15 + normSovShift * 0.25) * 100,
    );

    // Trend: compare current composite vs previous composite
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (prev && prevWeekStart) {
      // We don't have prev composite, so trend based on deltas
      const avgDelta = (spendDelta + engagementDelta + frequencyDelta) / 3;
      if (avgDelta > 5) trend = 'up';
      else if (avgDelta < -5) trend = 'down';
      else trend = 'stable';
    }

    const breakdown = {
      spend: {
        value: spendCurr,
        delta: spendDelta,
        label: 'Industry Spend',
        performance: spendDelta >= 0 ? 'positive' as const : 'negative' as const,
      },
      engagement: {
        value: engagementCurr,
        delta: engagementDelta,
        label: 'Total Engagement',
        performance: engagementDelta >= 0 ? 'positive' as const : 'negative' as const,
      },
      frequency: {
        value: postsCurr,
        delta: frequencyDelta,
        label: 'Post Frequency',
        performance: frequencyDelta >= 0 ? 'positive' as const : 'negative' as const,
      },
      sovShift: {
        value: primarySovCurr,
        delta: sovShift,
        label: 'Primary SOV',
        performance: sovShift >= 0 ? 'positive' as const : 'negative' as const,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        score: composite,
        trend,
        breakdown,
        week: weekInfo,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load market pulse";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
