/**
 * GET /api/dashboard/[groupId]/overview
 * Returns KPIs, SOV, network breakdown, and insights for the latest week.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../lib/db";
import { z } from "zod";
import { weekLabel } from "../../../../../lib/week-format";
import { verifyJwt } from "../../../../../lib/auth";

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  week: z.string().optional(),
  platform: z.enum(["youtube", "facebook", "tiktok"]).optional(),
  brandType: z.enum(["primary", "competitor"]).optional(),
});

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
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { groupId, week: requestedWeek, platform, brandType } = paramsSchema.parse({
      ...Object.fromEntries(req.nextUrl.searchParams),
      ...await params,
    });

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

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
        const fallbackRow = await query<WeekRow>(
          `SELECT week_start::text AS week_start, week_number, year
           FROM weekly_stats WHERE group_id = $1 ORDER BY week_start DESC LIMIT 1`,
          [groupId],
        );
        if (fallbackRow.rows.length === 0) {
          return NextResponse.json({
            success: true,
            data: { week: null, kpis: null, sov: [], network_breakdown: [], insights: [], trends: null },
          });
        }
        const fb = fallbackRow.rows[0]!;
        weekStart = fb.week_start;
        weekNumber = fb.week_number;
        weekYear = fb.year;
      } else {
        const w = weekInfoRow.rows[0]!;
        weekStart = w.week_start;
        weekNumber = w.week_number;
        weekYear = w.year;
      }
    } else {
      const weekRows = await query<WeekRow>(
        `SELECT week_start::text AS week_start, week_number, year
         FROM weekly_stats WHERE group_id = $1 ORDER BY week_start DESC LIMIT 1`,
        [groupId],
      );
      if (weekRows.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: { week: null, kpis: null, sov: [], network_breakdown: [], insights: [], trends: null },
        });
      }
      const w = weekRows.rows[0]!;
      weekStart = w.week_start;
      weekNumber = w.week_number;
      weekYear = w.year;
    }

    const weekInfo = { label: weekLabel(weekStart), start: weekStart, number: weekNumber, year: weekYear };

    // KPIs: aggregate from post table
    const kpiRows = await query<{
      total_impressions: string;
      total_views: string;
      total_reactions: string;
    }>(
      `SELECT
         COALESCE(SUM(p.impressions), 0)::bigint AS total_impressions,
         COALESCE(SUM(p.views), 0)::bigint AS total_views,
         COALESCE(SUM(p.reactions), 0)::bigint AS total_reactions
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date`,
      [groupId, weekStart],
    );
    const kpi = kpiRows.rows[0]!;
    const totalImpressions = Number(kpi.total_impressions) || 1;
    const totalReactions = Number(kpi.total_reactions) || 0;
    const avgEngRate = totalImpressions > 0 ? (totalReactions / totalImpressions) * 100 : 0;

    // total_posts from post table
    const postCountRows = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date`,
      [groupId, weekStart],
    );
    const totalPosts = postCountRows.rows[0]?.count ?? 0;

    // SOV: impressions per brand from weekly_stats
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

    const network_breakdown = netRows.rows.map((r) => {
      const imp = Number(r.impressions);
      return {
        platform: r.platform,
        impressions: imp,
        pct: Math.round((imp / totalImpressions) * 1000) / 10,
      };
    });

    // Insights: from gap_pct in weekly_stats
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

    // Week-over-Week trends: last 4 weeks of impressions by category
    const trendRows = await query<{
      week_start: string;
      week_number: number;
      year: number;
      primary_impressions: string;
      competitor_avg: string;
      total_impressions: string;
    }>(
      `WITH weeks AS (
        SELECT week_start, week_number, year
        FROM weekly_stats
        WHERE group_id = $1
        GROUP BY week_start, week_number, year
        ORDER BY week_start DESC
        LIMIT 4
      ),
      primary_stats AS (
        SELECT ws.week_start,
               COALESCE(SUM(ws.total_impressions), 0)::bigint AS primary_impressions
        FROM weekly_stats ws
        JOIN brand b ON b.id = ws.brand_id
        WHERE ws.group_id = $1 AND b.is_primary = 't'
        GROUP BY ws.week_start
      ),
      competitor_stats AS (
        SELECT ws.week_start,
               COUNT(DISTINCT ws.brand_id) AS competitor_count,
               COALESCE(SUM(ws.total_impressions), 0)::bigint AS competitor_total
        FROM weekly_stats ws
        JOIN brand b ON b.id = ws.brand_id
        WHERE ws.group_id = $1 AND b.is_primary = 'f'
        GROUP BY ws.week_start
      )
      SELECT
        w.week_start::text AS week_start,
        w.week_number,
        w.year,
        COALESCE(ps.primary_impressions, 0) AS primary_impressions,
        CASE WHEN COALESCE(cs.competitor_count, 0) > 0
             THEN ROUND(cs.competitor_total::numeric / cs.competitor_count, 0)
             ELSE 0
        END AS competitor_avg,
        COALESCE(ps.primary_impressions, 0) + COALESCE(cs.competitor_total, 0) AS total_impressions
      FROM weeks w
      LEFT JOIN primary_stats ps ON ps.week_start = w.week_start
      LEFT JOIN competitor_stats cs ON cs.week_start = w.week_start
      ORDER BY w.week_start ASC`,
      [groupId],
    );

    // Also get primary brand name for the legend
    const primaryBrandRow = await query<{ brand_name: string }>(
      `SELECT cb.name AS brand_name
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1 AND b.is_primary = 't'
       LIMIT 1`,
      [groupId],
    );

    const trends = {
      weeks: trendRows.rows.map(r => weekLabel(r.week_start)),
      week_starts: trendRows.rows.map(r => r.week_start),
      primary: trendRows.rows.map(r => Number(r.primary_impressions)),
      competitor_avg: trendRows.rows.map(r => Number(r.competitor_avg)),
      total: trendRows.rows.map(r => Number(r.total_impressions)),
      primary_label: primaryBrandRow.rows[0]?.brand_name ?? 'Primary Brand',
    };

    return NextResponse.json({
      success: true,
      data: {
        week: weekInfo,
        kpis: {
          total_impressions: Number(kpi.total_impressions),
          total_views: Number(kpi.total_views),
          total_reactions: Number(kpi.total_reactions),
          total_posts: totalPosts,
          avg_engagement_rate: Math.round(avgEngRate * 10) / 10,
          sov_primary: primarySov,
        },
        sov,
        network_breakdown,
        insights,
        trends,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overview";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
