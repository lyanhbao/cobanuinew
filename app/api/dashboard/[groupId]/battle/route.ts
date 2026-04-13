/**
 * GET /api/dashboard/[groupId]/battle
 * Head-to-head battle comparison between two brands.
 * Query params: brand1 (BrandId), brand2 (BrandId), week (optional, default current)
 * Returns current week metrics + 4-week history for both brands.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import { verifyJwt } from '../../../../../lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  brand1: z.string().uuid(),
  brand2: z.string().uuid(),
  week: z.string().optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

interface MetricValue {
  label: string;
  brand1: number;
  brand2: number;
  winner: 'brand1' | 'brand2' | 'tie';
}

interface HistoryPoint {
  week: string;
  weekLabel: string;
  brand1: number;
  brand2: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const { groupId, brand1: brand1Id, brand2: brand2Id, week: requestedWeek } = paramsSchema.parse({
      groupId: (await params).groupId,
      ...searchParams,
    });

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    // Verify both brands belong to the group
    const brandsCheck = await query<{ id: string; name: string }>(
      `SELECT b.id, cb.name
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1 AND b.id = ANY($2::uuid[])`,
      [groupId, [brand1Id, brand2Id]],
    );
    if (brandsCheck.rows.length !== 2) {
      return NextResponse.json({ success: false, error: 'One or both brands not found in this group' }, { status: 404 });
    }

    const brand1Name = brandsCheck.rows.find((r) => r.id === brand1Id)?.name ?? 'Brand 1';
    const brand2Name = brandsCheck.rows.find((r) => r.id === brand2Id)?.name ?? 'Brand 2';

    // Get latest week with stats for this group
    const weekResult = await query<{ week_start: string; week_number: number; year: number }>(
      `SELECT week_start::text AS week_start, week_number, year
       FROM weekly_stats
       WHERE group_id = $1
       ORDER BY week_start DESC
       LIMIT 1`,
      [groupId],
    );

    if (weekResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          brand1: brand1Name,
          brand2: brand2Name,
          brand1Id,
          brand2Id,
          current: [],
          history: { weeks: [], brand1Data: [], brand2Data: [] },
          scores: { brand1: 0, brand2: 0 },
          week: null,
        },
      });
    }

    let resolvedWeekStart: string;
    if (requestedWeek) {
      const weekInfoRow = await query<{ week_start: string; week_number: number; year: number }>(
        `SELECT week_start::text AS week_start, week_number, year
         FROM weekly_stats WHERE group_id = $1 AND week_start = $2::date LIMIT 1`,
        [groupId, requestedWeek],
      );
      if (weekInfoRow.rows.length > 0) {
        const w = weekInfoRow.rows[0]!;
        resolvedWeekStart = w.week_start;
      } else {
        resolvedWeekStart = weekResult.rows[0]!.week_start;
      }
    } else {
      resolvedWeekStart = weekResult.rows[0]!.week_start;
    }

    const weekInfo = {
      label: weekLabel(resolvedWeekStart),
      start: resolvedWeekStart,
      number: weekResult.rows[0]!.week_number,
      year: weekResult.rows[0]!.year,
    };

    // Get 5 weeks of stats: current + 4 prior weeks
    const weeksResult = await query<{
      brand_id: string;
      week_start: string;
      week_number: number;
      year: number;
      total_views: string;
      total_impressions: string;
      total_reactions: string;
      total_cost: string;
      avg_engagement_rate: string;
      sov_impressions_pct: string;
      sov_views_pct: string;
    }>(
      `SELECT
         ws.brand_id,
         ws.week_start::text AS week_start,
         ws.week_number,
         ws.year,
         ws.total_views::text,
         ws.total_impressions::text,
         ws.total_reactions::text,
         ws.total_cost::text,
         ws.avg_engagement_rate::text,
         COALESCE(ws.sov_impressions_pct, 0)::text AS sov_impressions_pct,
         COALESCE(ws.sov_views_pct, 0)::text AS sov_views_pct
       FROM weekly_stats ws
       WHERE ws.group_id = $1
         AND ws.brand_id = ANY($2::uuid[])
         AND ws.week_start <= $3::date
         AND ws.week_start > $3::date - INTERVAL '28 days'
       ORDER BY ws.week_start ASC`,
      [groupId, [brand1Id, brand2Id], resolvedWeekStart],
    );

    // Organize by brand and week
    const dataByBrand = new Map<string, Map<string, Record<string, number>>>();
    for (const row of weeksResult.rows) {
      if (!dataByBrand.has(row.brand_id)) {
        dataByBrand.set(row.brand_id, new Map());
      }
      dataByBrand.get(row.brand_id)!.set(row.week_start, {
        views: Number(row.total_views) || 0,
        impressions: Number(row.total_impressions) || 0,
        reactions: Number(row.total_reactions) || 0,
        comments: 0,
        shares: 0,
        cost: Number(row.total_cost) || 0,
        avg_er: Number(row.avg_engagement_rate) || 0,
        sov_impressions: Number(row.sov_impressions_pct) || 0,
        sov_views: Number(row.sov_views_pct) || 0,
      });
    }

    const b1Data = dataByBrand.get(brand1Id) ?? new Map();
    const b2Data = dataByBrand.get(brand2Id) ?? new Map();

    // Current week metrics
    const b1Current = b1Data.get(resolvedWeekStart) ?? {
      views: 0, impressions: 0, reactions: 0, comments: 0,
      shares: 0, cost: 0, avg_er: 0, sov_impressions: 0, sov_views: 0,
    };
    const b2Current = b2Data.get(resolvedWeekStart) ?? {
      views: 0, impressions: 0, reactions: 0, comments: 0,
      shares: 0, cost: 0, avg_er: 0, sov_impressions: 0, sov_views: 0,
    };
    // Suppress unused variable warnings — comments/shares are 0 (no data in weekly_stats)
    void b1Current.comments; void b1Current.shares;
    void b2Current.comments; void b2Current.shares;

    type MetricKey = 'views' | 'impressions' | 'reactions' | 'comments' | 'shares' | 'cost' | 'avg_er' | 'sov_impressions' | 'sov_views';
    type MetricDef = { key: MetricKey; label: string; format: 'number' | 'percent' | 'currency' };

    const metricDefs: MetricDef[] = [
      { key: 'impressions', label: 'Impressions', format: 'number' },
      { key: 'views', label: 'Views', format: 'number' },
      { key: 'reactions', label: 'Reactions', format: 'number' },
      { key: 'comments', label: 'Comments', format: 'number' },
      { key: 'shares', label: 'Shares', format: 'number' },
      { key: 'cost', label: 'Spend', format: 'currency' },
      { key: 'avg_er', label: 'Engagement Rate', format: 'percent' },
      { key: 'sov_impressions', label: 'SOV (Impressions)', format: 'percent' },
      { key: 'sov_views', label: 'SOV (Views)', format: 'percent' },
    ];

    const metrics: MetricValue[] = metricDefs.map((def) => {
      const v1 = b1Current[def.key];
      const v2 = b2Current[def.key];
      let winner: MetricValue['winner'];
      if (def.key === 'cost') {
        // Lower cost wins
        winner = v1 < v2 ? 'brand1' : v1 > v2 ? 'brand2' : 'tie';
      } else {
        winner = v1 > v2 ? 'brand1' : v1 < v2 ? 'brand2' : 'tie';
      }
      return {
        label: def.label,
        brand1: v1,
        brand2: v2,
        winner,
      };
    });

    // 4-week history
    const sortedWeeks = Array.from(new Set([
      ...b1Data.keys(),
      ...b2Data.keys(),
    ])).sort();

    const historyWeeks: string[] = [];
    const brand1History: Record<MetricKey, number[]> = { views: [], impressions: [], reactions: [], comments: [], shares: [], cost: [], avg_er: [], sov_impressions: [], sov_views: [] };
    const brand2History: Record<MetricKey, number[]> = { views: [], impressions: [], reactions: [], comments: [], shares: [], cost: [], avg_er: [], sov_impressions: [], sov_views: [] };

    for (const wk of sortedWeeks) {
      historyWeeks.push(wk);
      const b1wk = b1Data.get(wk) ?? { views: 0, impressions: 0, reactions: 0, comments: 0, shares: 0, cost: 0, avg_er: 0, sov_impressions: 0, sov_views: 0 };
      const b2wk = b2Data.get(wk) ?? { views: 0, impressions: 0, reactions: 0, comments: 0, shares: 0, cost: 0, avg_er: 0, sov_impressions: 0, sov_views: 0 };

      (Object.keys(b1wk) as MetricKey[]).forEach((k) => {
        brand1History[k].push(b1wk[k]);
        brand2History[k].push(b2wk[k]);
      });
    }

    const historyLabeled = historyWeeks.map((wk) => ({
      week: wk,
      weekLabel: weekLabel(wk),
    }));

    // Battle scores: count wins per brand
    let b1Wins = 0;
    let b2Wins = 0;
    for (const m of metrics) {
      if (m.winner === 'brand1') b1Wins++;
      else if (m.winner === 'brand2') b2Wins++;
    }

    return NextResponse.json({
      success: true,
      data: {
        brand1: brand1Name,
        brand2: brand2Name,
        brand1Id,
        brand2Id,
        week: weekInfo,
        metrics,
        history: {
          weeks: historyLabeled,
          brand1Data: brand1History,
          brand2Data: brand2History,
        },
        scores: { brand1: b1Wins, brand2: b2Wins },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load battle data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
