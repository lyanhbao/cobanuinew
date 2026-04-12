/**
 * GET /api/dashboard/[groupId]/benchmark
 * Returns radar, head-to-head, and gap analysis matching the BenchmarkData interface
 * expected by the benchmark page.
 * Primary = brand with is_primary='t' (FCV-CP-FrieslandCampina-VN)
 * Competitor = highest impressions non-primary brand (Nutifood-VN)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import { verifyJwt } from '../../../../../lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  brandType: z.enum(['primary', 'competitor']).optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

interface RawBrandRow {
  brand_id: string;
  brand_name: string;
  is_primary: boolean | string;
  total_impressions: string;
  total_views: string;
  total_reactions: string;
  total_posts: number;
  avg_engagement_rate: string;
  gap_pct: string | null;
}

interface RadarPoint {
  metric: string;
  primary: number;
  competitor: number;
}

interface HeadToHeadPoint {
  metric: string;
  primary: number;
  competitor: number;
  primary_label?: string;
  competitor_label?: string;
}

interface GapPoint {
  metric: string;
  gap: number;
  category: 'positive' | 'negative' | 'neutral';
}

function normalize(a: number, b: number): [number, number] {
  const max = Math.max(a, b, 1);
  return [Math.round((a / max) * 100), Math.round((b / max) * 100)];
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
    const { groupId, brandType: rawBrandType } = paramsSchema.parse({
      groupId: (await params).groupId,
      ...searchParams,
    });

    // Primary/competitor: 'primary' = only is_primary='t', 'competitor' = only is_primary != 't'
    const isPrimaryFilter = rawBrandType === 'primary' ? 't' : rawBrandType === 'competitor' ? 'f' : null;

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    // Latest week for this group
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
          week: null,
          radar: [],
          head_to_head: [],
          gap_analysis: [],
          primary_brand: null,
          competitor_brand: null,
        },
      });
    }

    const week = weekResult.rows[0]!;
    const weekStart = week.week_start;

    // If latest week doesn't have the primary brand (is_primary='t'), step back
    // to the most recent week that does. This ensures benchmark always compares the
    // right brands regardless of which week is "latest".
    let benchmarkWeek = weekStart;
    const primaryWeekResult = await query<{ week_start: string; week_number: number; year: number }>(
      `SELECT ws.week_start::text, ws.week_number, ws.year
       FROM weekly_stats ws
       JOIN brand b ON b.id = ws.brand_id
       WHERE ws.group_id = $1 AND b.is_primary = 't'
       ORDER BY ws.week_start DESC
       LIMIT 1`,
      [groupId],
    );
    if (primaryWeekResult.rows.length > 0) {
      const pw = primaryWeekResult.rows[0]!;
      benchmarkWeek = pw.week_start;
    }

    // All brands with stats for the week, ordered by is_primary DESC then impressions DESC
    // is_primary is 't'/'f' string in PostgreSQL, not boolean — sort by it first
    // brandType filter: primary → is_primary='t', competitor → is_primary='f', all → no filter
    let brandFilter = '';
    const brandFilterParams: string[] = [];
    if (isPrimaryFilter !== null) {
      brandFilter = ` AND b.is_primary = $3`;
      brandFilterParams.push(isPrimaryFilter);
    }
    const brandsResult = await query<RawBrandRow>(
      `SELECT
         b.id AS brand_id,
         cb.name AS brand_name,
         b.is_primary,
         ws.total_impressions,
         ws.total_views,
         ws.total_reactions,
         ws.total_posts,
         ws.avg_engagement_rate,
         ws.gap_pct
       FROM weekly_stats ws
       JOIN brand b ON b.id = ws.brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE ws.group_id = $1 AND ws.week_start = $2::date${brandFilter}
       ORDER BY b.is_primary DESC, ws.total_impressions DESC`,
      [groupId, benchmarkWeek, ...brandFilterParams],
    );

    const rows = brandsResult.rows;
    // Primary = brand with is_primary='t' (PostgreSQL string, not boolean)
    const primaryRow = rows.find((r) => r.is_primary === 't' || r.is_primary === true);

    // Competitor = first non-primary brand (for radar/head-to-head comparison)
    // When brandType filter is active, there may be no competitor row — handled below
    const competitorRow = rows.find((r) => r !== primaryRow);

    if (!primaryRow) {
      return NextResponse.json({
        success: true,
        data: {
          week: { label: weekLabel(benchmarkWeek), start: benchmarkWeek, number: week.week_number, year: week.year },
          radar: [],
          head_to_head: [],
          gap_analysis: [],
          primary_brand: null,
          competitor_brand: null,
        },
      });
    }

    const primaryBrandName = primaryRow.brand_name;
    const competitorBrandName = competitorRow?.brand_name ?? null;

    const p = {
      impressions: Number(primaryRow.total_impressions) || 0,
      views: Number(primaryRow.total_views) || 0,
      reactions: Number(primaryRow.total_reactions) || 0,
      posts: primaryRow.total_posts,
      er: Number(primaryRow.avg_engagement_rate) || 0,
    };

    // When competitorRow is null (group has only the primary brand),
    // use small non-zero values so the radar polygon still renders visibly
    // instead of collapsing to a single point at the center
    const c = {
      impressions: competitorRow ? Number(competitorRow.total_impressions) || 0 : 1,
      views: competitorRow ? Number(competitorRow.total_views) || 0 : 1,
      reactions: competitorRow ? Number(competitorRow.total_reactions) || 0 : 1,
      posts: competitorRow ? competitorRow.total_posts : 1,
      er: competitorRow ? Number(competitorRow.avg_engagement_rate) || 0 : 0.01,
    };

    // Radar: normalized 0-100 scores per metric dimension
    const [normImpP, normImpC] = normalize(p.impressions, c.impressions);
    const [normViewP, normViewC] = normalize(p.views, c.views);
    const [normReactP, normReactC] = normalize(p.reactions, c.reactions);
    const [normPostP, normPostC] = normalize(p.posts, c.posts);
    const [normErP, normErC] = normalize(p.er, c.er);

    const radar: RadarPoint[] = [
      { metric: 'Impressions', primary: normImpP, competitor: normImpC },
      { metric: 'Views', primary: normViewP, competitor: normViewC },
      { metric: 'Reactions', primary: normReactP, competitor: normReactC },
      { metric: 'Posts', primary: normPostP, competitor: normPostC },
      { metric: 'Engagement Rate', primary: normErP, competitor: normErC },
    ];

    const head_to_head: HeadToHeadPoint[] = [
      {
        metric: 'Impressions',
        primary: p.impressions,
        competitor: c.impressions,
        primary_label: primaryBrandName,
        competitor_label: competitorBrandName ?? undefined,
      },
      {
        metric: 'Views',
        primary: p.views,
        competitor: c.views,
        primary_label: primaryBrandName,
        competitor_label: competitorBrandName ?? undefined,
      },
      {
        metric: 'Reactions',
        primary: p.reactions,
        competitor: c.reactions,
        primary_label: primaryBrandName,
        competitor_label: competitorBrandName ?? undefined,
      },
      {
        metric: 'Posts',
        primary: p.posts,
        competitor: c.posts,
        primary_label: primaryBrandName,
        competitor_label: competitorBrandName ?? undefined,
      },
      {
        metric: 'Avg. Engagement Rate',
        primary: p.er,
        competitor: c.er,
        primary_label: primaryBrandName,
        competitor_label: competitorBrandName ?? undefined,
      },
    ];

    const gap_analysis: GapPoint[] = rows
      .filter((r) => r.gap_pct !== null && r.is_primary !== 't' && r.is_primary !== true)
      .map((r) => {
        const compGap = Number(r.gap_pct) ?? 0;
        const primaryGap = Number(primaryRow.gap_pct) ?? 0;
        // Clamp gap to [-100, 100] percentage points to keep bars in chart bounds
        const gap = Math.max(-100, Math.min(100, Math.round((primaryGap - compGap) * 10) / 10));
        const category: GapPoint['category'] =
          gap > 0.5 ? 'positive' : gap < -0.5 ? 'negative' : 'neutral';
        return {
          metric: r.brand_name,
          gap,
          category,
        };
      });

    // Use primary week info for the returned week label
    const weekInfo = primaryWeekResult.rows.length > 0
      ? primaryWeekResult.rows[0]!
      : week;

    return NextResponse.json({
      success: true,
      data: {
        week: {
          label: weekLabel(benchmarkWeek),
          start: benchmarkWeek,
          number: weekInfo.week_number,
          year: weekInfo.year,
        },
        radar,
        head_to_head,
        gap_analysis,
        primary_brand: primaryBrandName,
        competitor_brand: competitorBrandName,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load benchmark data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
