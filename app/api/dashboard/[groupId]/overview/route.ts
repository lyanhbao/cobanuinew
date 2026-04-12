/**
 * GET /api/dashboard/[groupId]/overview
 * Returns KPIs, SOV, network breakdown, and insights for the latest week.
 * KPIs: total_posts from post table; avg_engagement_rate = SUM(reactions)/SUM(impressions)*100
 * network_breakdown: from post table grouped by platform
 * insights: WoW changes using gap_pct from weekly_stats, direction = down if gap_pct < 0
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../lib/db";
import { z } from "zod";
import { weekLabel } from "../../../../../lib/week-format";
import { verifyJwt } from "../../../../../lib/auth";

const paramsSchema = z.object({ groupId: z.string().uuid() });

function authUser(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyJwt(auth.slice(7));
}

interface WeekRow { week_start: string; week_number: number; year: number }

interface SovRow {
  brand_id: string;
  brand_name: string;
  is_primary: boolean | string;
  total_impressions: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(_req);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { groupId } = paramsSchema.parse(await params);

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

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
    const weekStart = week.week_start;

    // KPIs: aggregate from weekly_stats for impressions/views/reactions
    // avg_engagement_rate = SUM(reactions) / SUM(impressions) * 100
    const kpiRows = await query<{
      total_impressions: string;
      total_views: string;
      total_reactions: string;
    }>(
      `SELECT
         COALESCE(SUM(ws.total_impressions), 0) AS total_impressions,
         COALESCE(SUM(ws.total_views), 0) AS total_views,
         COALESCE(SUM(ws.total_reactions), 0) AS total_reactions
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start = $2::date`,
      [groupId, weekStart],
    );
    const kpi = kpiRows.rows[0]!;
    const totalImpressions = Number(kpi.total_impressions) || 1;
    const totalReactions = Number(kpi.total_reactions) || 0;
    const avgEngRate = totalImpressions > 0 ? (totalReactions / totalImpressions) * 100 : 0;

    // total_posts from post table (actual post count)
    const postCountRows = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date`,
      [groupId, weekStart],
    );
    const totalPosts = postCountRows.rows[0]?.count ?? 0;

    // SOV: impressions per brand (LEFT JOIN to include all brands)
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

    const sov = sovRows.rows.map((r) => ({
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      is_primary: r.is_primary === 't' || r.is_primary === true,
      impressions: Number(r.total_impressions),
      sov_pct: Math.round((Number(r.total_impressions) / totalImpressions) * 1000) / 10,
    }));

    const primarySov = sov.find((s) => s.is_primary)?.sov_pct ?? null;

    // Network breakdown: from post table grouped by platform
    const netRows = await query<{ platform: string; impressions: string }>(
      `SELECT
         p.platform,
         COALESCE(SUM(p.impressions), 0)::bigint AS impressions
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date
       GROUP BY p.platform`,
      [groupId, weekStart],
    );

    const networkBreakdown = netRows.rows.map((r) => {
      const imp = Number(r.impressions);
      return {
        platform: r.platform,
        impressions: imp,
        pct: Math.round((imp / totalImpressions) * 1000) / 10,
      };
    });

    // Insights: from gap_pct in weekly_stats (direction = down if gap_pct < 0)
    const insightsRows = await query<{ brand_name: string; gap_pct: string | null }>(
      `SELECT
         cb.name AS brand_name,
         ws.gap_pct::text AS gap_pct
       FROM weekly_stats ws
       JOIN brand b ON b.id = ws.brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE ws.group_id = $1 AND ws.week_start = $2::date
         AND ws.gap_pct IS NOT NULL
       ORDER BY ws.gap_pct DESC
       LIMIT 5`,
      [groupId, weekStart],
    );

    const insights = insightsRows.rows
      .map((r) => {
        const gapPct = Number(r.gap_pct);
        if (isNaN(gapPct)) return null;
        return {
          brand_name: r.brand_name,
          metric: "impressions",
          change: `${gapPct > 0 ? "+" : ""}${gapPct.toFixed(1)}%`,
          direction: gapPct < 0 ? "down" as const : "up" as const,
        };
      })
      .filter(Boolean) as Array<{ brand_name: string; metric: string; change: string; direction: "up" | "down" | "neutral" }>;

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
          total_posts: totalPosts,
          avg_engagement_rate: Math.round(avgEngRate * 10) / 10,
          sov_primary: primarySov,
        },
        sov,
        network_breakdown: networkBreakdown,
        insights,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overview";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
