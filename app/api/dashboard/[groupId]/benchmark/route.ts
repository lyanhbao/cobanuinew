/**
 * GET /api/dashboard/[groupId]/benchmark
 * Returns radar, head-to-head, and gap analysis matching the BenchmarkData interface
 * expected by the benchmark page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import { verifyJwt } from '../../../../../lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
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
    const { groupId } = paramsSchema.parse(await params);

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

    // All brands with stats for the week, ordered by impressions desc
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
       WHERE ws.group_id = $1 AND ws.week_start = $2::date
       ORDER BY ws.total_impressions DESC`,
      [groupId, weekStart],
    );

    const rows = brandsResult.rows;
    // is_primary is 't'/'f' string in DB, not boolean
    const primaryRow = rows.find((r) => r.is_primary === true || r.is_primary === 't') ?? rows[0];
    // competitor = highest-impressions non-primary brand (second in sorted list)
    const competitorRow = rows.find((r) => r !== primaryRow) ?? rows[1];

    if (!primaryRow) {
      return NextResponse.json({
        success: true,
        data: {
          week: { label: weekLabel(weekStart), start: weekStart, number: week.week_number, year: week.year },
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

    const c = competitorRow
      ? {
          impressions: Number(competitorRow.total_impressions) || 0,
          views: Number(competitorRow.total_views) || 0,
          reactions: Number(competitorRow.total_reactions) || 0,
          posts: competitorRow.total_posts,
          er: Number(competitorRow.avg_engagement_rate) || 0,
        }
      : { impressions: 0, views: 0, reactions: 0, posts: 0, er: 0 };

    // ── Radar: normalized 0-100 scores per metric dimension ──────────────────
    const [normImpressions] = normalize(p.impressions, c.impressions);
    const [normViews] = normalize(p.views, c.views);
    const [normReactions] = normalize(p.reactions, c.reactions);
    const [normPosts] = normalize(p.posts, c.posts);
    const [normER] = normalize(p.er, c.er);

    const radar: RadarPoint[] = [
      { metric: 'Impressions', primary: normImpressions, competitor: 100 },
      { metric: 'Views', primary: normViews, competitor: 100 },
      { metric: 'Reactions', primary: normReactions, competitor: 100 },
      { metric: 'Posts', primary: normPosts, competitor: 100 },
      { metric: 'Engagement Rate', primary: normER, competitor: 100 },
    ];

    // ── Head-to-head: direct comparison on key metrics ────────────────────────
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

    // ── Gap analysis: primary gap vs each competitor's gap ─────────────────────
    // gap_pct is the brand's own WoW gap. Here we show the delta between
    // primary's gap and each competitor's gap as the "metric" label.
    const gap_analysis: GapPoint[] = rows
      .filter((r) => r.gap_pct !== null && !r.is_primary)
      .map((r) => {
        const compGap = Number(r.gap_pct) ?? 0;
        const primaryGap = Number(primaryRow.gap_pct) ?? 0;
        const gap = primaryGap - compGap;
        const category: GapPoint['category'] =
          gap > 0.5 ? 'positive' : gap < -0.5 ? 'negative' : 'neutral';
        return {
          metric: r.brand_name,
          gap: Math.round(gap * 10) / 10,
          category,
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        week: { label: weekLabel(weekStart), start: weekStart, number: week.week_number, year: week.year },
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
