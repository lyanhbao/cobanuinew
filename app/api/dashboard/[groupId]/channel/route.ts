/**
 * GET /api/dashboard/[groupId]/channel
 * Per-platform KPIs with format mix + posting cadence + yt_details for the latest week.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import type { Platform } from '../../../../../lib/types';
import { verifyJwt } from '../../../../../lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  platform: z.enum(['youtube', 'facebook', 'tiktok']).optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

const PLATFORMS = ['youtube', 'facebook', 'tiktok'] as const;

interface WeekInfo {
  label: string;
  start: string;
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
    const { groupId, platform } = paramsSchema.parse({
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

    // Use ::text to bypass JS Date timezone conversion
    const weekResult = await query<{ week_start: string; week_number: number; year: number }>(
      `SELECT week_start::text AS week_start, week_number, year
       FROM weekly_stats
       WHERE group_id = $1
       ORDER BY week_start DESC
       LIMIT 1`,
      [groupId],
    );

    if (weekResult.rows.length === 0) {
      return NextResponse.json({ success: true, data: { week: null, platforms: [] } });
    }

    const week = weekResult.rows[0]!;
    const weekStart = week.week_start; // raw "YYYY-MM-DD" string
    const weekInfo: WeekInfo = {
      label: weekLabel(weekStart),
      start: weekStart,
    };

    // Per-platform KPIs: aggregate from post table for accuracy
    const platformKpiResult = await query<{
      platform: Platform;
      total_views: string;
      total_impressions: string;
      total_reactions: string;
      total_posts: number;
    }>(
      `SELECT
         p.platform,
         COALESCE(SUM(p.views), 0)::bigint AS total_views,
         COALESCE(SUM(p.impressions), 0)::bigint AS total_impressions,
         COALESCE(SUM(p.reactions), 0)::bigint AS total_reactions,
         COUNT(*)::int AS total_posts
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date
       GROUP BY p.platform`,
      [groupId, weekStart],
    );

    // Build a lookup map
    const kpiMap = new Map<Platform, {
      views: number;
      impressions: number;
      reactions: number;
      posts: number;
    }>();
    for (const p of platformKpiResult.rows) {
      kpiMap.set(p.platform, {
        views: Number(p.total_views),
        impressions: Number(p.total_impressions),
        reactions: Number(p.total_reactions),
        posts: p.total_posts,
      });
    }

    // Format mix: platform × format counts
    const formatMixResult = await query<{
      platform: Platform;
      format: string;
      count: number;
    }>(
      `SELECT
         p.platform,
         COALESCE(p.format, 'Unknown') AS format,
         COUNT(*)::int AS count
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date
       GROUP BY p.platform, format
       ORDER BY p.platform, count DESC`,
      [groupId, weekStart],
    );

    const formatMixMap = new Map<Platform, { format: string; count: number }[]>();
    for (const row of formatMixResult.rows) {
      if (!formatMixMap.has(row.platform)) {
        formatMixMap.set(row.platform, []);
      }
      formatMixMap.get(row.platform)!.push({ format: row.format, count: row.count });
    }

    // Compute format mix percentages
    for (const [, formats] of formatMixMap) {
      const total = formats.reduce((s, f) => s + f.count, 0) || 1;
      // Store pct on each entry
      for (const f of formats) {
        (f as unknown as { pct: number }).pct = total > 0 ? (f.count / total) * 100 : 0;
      }
    }

    // Posting cadence: last 8 weeks of post counts per platform
    const cadenceResult = await query<{
      week_start: string;
      week_number: number;
      platform: Platform;
      posts: number;
    }>(
      `SELECT
         p.week_start,
         ws.week_number,
         p.platform,
         COUNT(*)::int AS posts
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       JOIN weekly_stats ws ON ws.brand_id = b.id AND ws.week_start = p.week_start
       WHERE b.group_id = $1
         AND p.week_start >= $2::date - INTERVAL '7 weeks'
       GROUP BY p.week_start, ws.week_number, p.platform
       ORDER BY p.week_start ASC`,
      [groupId, weekStart],
    );

    const cadenceMap = new Map<string, Record<string, number>>();
    for (const row of cadenceResult.rows) {
      // Defensive: ensure week_start is a string
      const ws = String(row.week_start ?? '');
      if (!cadenceMap.has(ws)) {
        cadenceMap.set(ws, { youtube: 0, facebook: 0, tiktok: 0 });
      }
      cadenceMap.get(ws)![row.platform] = row.posts;
    }

    const posting_cadence = Array.from(cadenceMap.entries()).map(([ws, platforms]) => {
      const numRow = cadenceResult.rows.find((r) => String(r.week_start ?? '') === ws);
      return {
        week: `W${numRow?.week_number ?? 0}`,
        posts: (platforms.youtube + platforms.facebook + platforms.tiktok),
        youtube: platforms.youtube,
        facebook: platforms.facebook,
        tiktok: platforms.tiktok,
      };
    });

    // YouTube details: shorts vs normal engagement rates
    const ytDetailsResult = await query<{
      yt_format: string | null;
      total_views: string;
      total_reactions: string;
      total_impressions: string;
      total_posts: number;
    }>(
      `SELECT
         COALESCE(p.yt_format, 'Normal') AS yt_format,
         COALESCE(SUM(p.views), 0)::bigint AS total_views,
         COALESCE(SUM(p.reactions), 0)::bigint AS total_reactions,
         COALESCE(SUM(p.impressions), 0)::bigint AS total_impressions,
         COUNT(*)::int AS total_posts
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date
         AND p.platform = 'youtube'
       GROUP BY yt_format`,
      [groupId, weekStart],
    );

    const ytDetailsMap: Record<string, {
      posts: number;
      er: number;
    }> = {};
    for (const row of ytDetailsResult.rows) {
      const fmt = row.yt_format ?? 'Normal';
      const impressions = Number(row.total_impressions);
      const reactions = Number(row.total_reactions);
      ytDetailsMap[fmt] = {
        posts: row.total_posts,
        er: impressions > 0 ? (reactions / impressions) * 100 : 0,
      };
    }

    // Build final platforms array
    const platformsResult = PLATFORMS
      .filter((p) => !platform || p === platform)
      .map((p) => {
        const kpi = kpiMap.get(p) ?? { views: 0, impressions: 0, reactions: 0, posts: 0 };
        const formats = formatMixMap.get(p) ?? [];
        const totalFormatCount = formats.reduce((s, f) => s + f.count, 0) || 1;
        const format_mix = formats.map((f) => ({
          format: f.format,
          count: f.count,
          pct: totalFormatCount > 0 ? (f.count / totalFormatCount) * 100 : 0,
        }));
        const avg_er = kpi.impressions > 0 ? (kpi.reactions / kpi.impressions) * 100 : 0;

        const entry: {
          platform: string;
          kpis: {
            views: number;
            impressions: number;
            reactions: number;
            posts: number;
            avg_engagement_rate: number;
          };
          format_mix: { format: string; count: number; pct: number }[];
          posting_cadence: typeof posting_cadence;
          yt_details: { shorts: number; normal: number; shorts_er: number; normal_er: number } | null;
        } = {
          platform: p,
          kpis: {
            views: kpi.views,
            impressions: kpi.impressions,
            reactions: kpi.reactions,
            posts: kpi.posts,
            avg_engagement_rate: parseFloat(avg_er.toFixed(1)),
          },
          format_mix,
          posting_cadence,
          yt_details: null,
        };

        if (p === 'youtube') {
          const shorts = ytDetailsMap['Short'];
          const normal = ytDetailsMap['Normal'];
          entry.yt_details = {
            shorts: shorts?.posts ?? 0,
            normal: normal?.posts ?? 0,
            shorts_er: parseFloat((shorts?.er ?? 0).toFixed(1)),
            normal_er: parseFloat((normal?.er ?? 0).toFixed(1)),
          };
        }

        return entry;
      });

    // Build top-level format_mix: { format, youtube, facebook, tiktok }
    // Group by format, sum counts per platform
    const formatByPlatform = new Map<string, Record<string, number>>();
    for (const [p, formats] of formatMixMap.entries()) {
      for (const f of formats) {
        if (!formatByPlatform.has(f.format)) {
          formatByPlatform.set(f.format, { youtube: 0, facebook: 0, tiktok: 0 });
        }
        const entry = formatByPlatform.get(f.format)!;
        if (p === 'youtube' || p === 'facebook' || p === 'tiktok') {
          entry[p] += f.count;
        }
      }
    }
    const topFormatMix = Array.from(formatByPlatform.entries()).map(([format, counts]) => ({
      format,
      youtube: counts.youtube,
      facebook: counts.facebook,
      tiktok: counts.tiktok,
    }));

    return NextResponse.json({ success: true, data: { platforms: platformsResult, format_mix: topFormatMix, cadence: posting_cadence } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load channel data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
