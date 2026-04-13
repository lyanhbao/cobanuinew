/**
 * GET /api/dashboard/[groupId]/competitive-heatmap
 * Returns brand x metric matrix for the heatmap visualization.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import { verifyJwt } from '@/lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  week: z.string().optional(),
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

interface MetricRow {
  brand_id: string;
  total_views: string;
  total_engagement: string;
  sov_impressions_pct: string;
  total_spend: string;
  total_posts: number;
}

interface FormatRow {
  brand_id: string;
  format_count: number;
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
    const { groupId, week: requestedWeek } = rawParams;

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
        return NextResponse.json({ success: true, data: { brands: [], metrics: [], week: null } });
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

    const metricRows = await query<MetricRow>(
      `SELECT
         ws.brand_id,
         COALESCE(SUM(ws.total_views), 0)::bigint AS total_views,
         COALESCE(SUM(ws.total_reactions + ws.total_comments + ws.total_shares), 0)::bigint AS total_engagement,
         COALESCE(AVG(ws.sov_impressions_pct), 0)::numeric AS sov_impressions_pct,
         COALESCE(SUM(ws.total_spend), 0)::numeric AS total_spend,
         COALESCE(SUM(ws.total_posts), 0) AS total_posts
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start = $2::date
       GROUP BY ws.brand_id`,
      [groupId, weekStart],
    );

    const formatRows = await query<FormatRow>(
      `SELECT p.brand_id, COUNT(DISTINCT p.format) AS format_count
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2
       GROUP BY p.brand_id`,
      [groupId, weekStart],
    );

    const metricMap = new Map(metricRows.rows.map((r) => [r.brand_id, r]));
    const formatMap = new Map(formatRows.rows.map((r) => [r.brand_id, r]));

    const allMetrics = metricRows.rows.map((r) => ({
      views: Number(r.total_views),
      engagement: Number(r.total_engagement),
      sov: Number(r.sov_impressions_pct),
      spend: Number(r.total_spend),
    }));

    const avg = {
      views: allMetrics.length > 0 ? allMetrics.reduce((s, m) => s + m.views, 0) / allMetrics.length : 0,
      engagement: allMetrics.length > 0 ? allMetrics.reduce((s, m) => s + m.engagement, 0) / allMetrics.length : 0,
      sov: allMetrics.length > 0 ? allMetrics.reduce((s, m) => s + m.sov, 0) / allMetrics.length : 0,
      spend: allMetrics.length > 0 ? allMetrics.reduce((s, m) => s + m.spend, 0) / allMetrics.length : 0,
    };

    const maxFormatCount = Math.max(...formatRows.rows.map((r) => r.format_count), 1);

    const brands = brandRows.rows.map((brand) => {
      const m = metricMap.get(brand.brand_id);
      const f = formatMap.get(brand.brand_id);

      const views = m ? Number(m.total_views) : 0;
      const engagement = m ? Number(m.total_engagement) : 0;
      const sov = m ? Number(m.sov_impressions_pct) : 0;
      const spend = m ? Number(m.total_spend) : 0;
      const posts = m ? Number(m.total_posts) : 0;
      const formatDiversity = f ? f.format_count : 0;
      const formatDivScore = maxFormatCount > 0 ? (formatDiversity / maxFormatCount) * 100 : 0;

      return {
        brandId: brand.brand_id,
        brandName: brand.brand_name,
        isPrimary: brand.is_primary === 't',
        cells: {
          views: { value: views, delta: avg.views > 0 ? ((views - avg.views) / avg.views) * 100 : 0 },
          engagement: { value: engagement, delta: avg.engagement > 0 ? ((engagement - avg.engagement) / avg.engagement) * 100 : 0 },
          sov: { value: sov, delta: avg.sov > 0 ? sov - avg.sov : 0 },
          spend: { value: spend, delta: avg.spend > 0 ? ((spend - avg.spend) / avg.spend) * 100 : 0 },
          formatDiversity: { value: formatDivScore, delta: 0 },
        },
        posts,
      };
    });

    brands.sort((a, b) => {
      const gapA = Math.abs(a.cells.views.delta) + Math.abs(a.cells.engagement.delta);
      const gapB = Math.abs(b.cells.views.delta) + Math.abs(b.cells.engagement.delta);
      return gapB - gapA;
    });

    return NextResponse.json({
      success: true,
      data: { brands, week: { weekStart, label: `Week starting ${weekStart}` } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load heatmap';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
