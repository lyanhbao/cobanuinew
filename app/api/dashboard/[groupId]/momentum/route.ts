/**
 * GET /api/dashboard/[groupId]/momentum
 * Returns 4-week rolling trend signal per brand.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import { verifyJwt } from '@/lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  week: z.string().optional(),
  metric: z.enum(['views', 'engagement', 'sov']).default('views'),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

interface BrandRow {
  brand_id: string;
  brand_name: string;
  is_primary: string;
}

interface WeeklyRow {
  brand_id: string;
  week_start: string;
  total_views: string;
  total_engagement: string;
  sov_impressions_pct: string;
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
    const rawParams = paramsSchema.parse({
      ...Object.fromEntries(req.nextUrl.searchParams),
      ...await params,
    });
    const { groupId, week: requestedWeek, metric } = rawParams;

    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    let weekStart: string;
    if (requestedWeek) {
      weekStart = requestedWeek;
    } else {
      const weekRows = await query<{ week_start: string }>(
        `SELECT week_start::text AS week_start FROM weekly_stats
         WHERE group_id = $1 ORDER BY week_start DESC LIMIT 1`,
        [groupId],
      );
      if (weekRows.rows.length === 0) {
        return NextResponse.json({ success: true, data: { brands: [], week: null } });
      }
      weekStart = weekRows.rows[0]!.week_start;
    }

    const brandRows = await query<BrandRow>(
      `SELECT b.id AS brand_id, cb.name AS brand_name, b.is_primary
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1 AND b.crawl_status = 'ready'
       ORDER BY b.is_primary DESC, cb.name ASC`,
      [groupId],
    );

    const weeklyRows = await query<WeeklyRow>(
      `SELECT ws.brand_id, ws.week_start::text,
              COALESCE(SUM(ws.total_views), 0)::bigint AS total_views,
              COALESCE(SUM(ws.total_reactions), 0)::bigint AS total_engagement,
              COALESCE(AVG(ws.sov_impressions_pct), 0)::numeric AS sov_impressions_pct
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start <= $2::date
       GROUP BY ws.brand_id, ws.week_start
       ORDER BY ws.week_start DESC
       LIMIT $3`,
      [groupId, weekStart, brandRows.rows.length * 4],
    );

    const metricCol =
      metric === 'engagement'
        ? 'total_engagement'
        : metric === 'sov'
          ? 'sov_impressions_pct'
          : 'total_views';

    const seriesMap = new Map<string, { week: string; value: number }[]>();
    for (const row of weeklyRows.rows) {
      if (!seriesMap.has(row.brand_id)) seriesMap.set(row.brand_id, []);
      const series = seriesMap.get(row.brand_id)!;
      if (series.length < 4) {
        series.push({ week: row.week_start, value: Number(row[metricCol as keyof WeeklyRow]) });
      }
    }

    function computeSlope(points: { value: number }[]): number {
      if (points.length < 2) return 0;
      const n = points.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += points[i]!.value;
        sumXY += i * points[i]!.value;
        sumX2 += i * i;
      }
      const denom = n * sumX2 - sumX * sumX;
      if (Math.abs(denom) < 0.0001) return 0;
      return (n * sumXY - sumX * sumY) / denom;
    }

    function computeAvg(points: { value: number }[]): number {
      if (points.length === 0) return 0;
      return points.reduce((s, p) => s + p.value, 0) / points.length;
    }

    function classifySignal(slope: number, avg: number): 'surge' | 'rising' | 'stable' | 'declining' | 'crash' {
      if (avg === 0) return 'stable';
      const relSlope = slope / avg;
      if (relSlope > 0.15) return 'surge';
      if (relSlope > 0.02) return 'rising';
      if (relSlope < -0.15) return 'crash';
      if (relSlope < -0.02) return 'declining';
      return 'stable';
    }

    const brands = brandRows.rows.map((brand) => {
      const series = seriesMap.get(brand.brand_id) ?? [];
      series.reverse();
      const slope = computeSlope(series);
      const avg = computeAvg(series);
      const signal = classifySignal(slope, avg);
      const lastValue = series.length > 0 ? series[series.length - 1]!.value : 0;
      const firstValue = series.length > 0 ? series[0]!.value : 0;
      const totalDelta = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

      return {
        brandId: brand.brand_id,
        brandName: brand.brand_name,
        isPrimary: brand.is_primary === 't',
        signal,
        slope,
        avg,
        totalDelta,
        series: series.slice(-4),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        brands,
        week: { weekStart, label: `Week starting ${weekStart}` },
        metric,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load momentum';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
