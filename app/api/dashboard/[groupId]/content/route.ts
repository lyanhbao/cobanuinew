/**
 * GET /api/dashboard/[groupId]/content
 * Format performance + top keywords + top 20 posts for the latest week.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import type { Platform, FormatType } from '../../../../../lib/types';
import { verifyJwt } from '../../../../../lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  platform: z.enum(['youtube', 'facebook', 'tiktok']).optional(),
  brandType: z.enum(['primary', 'competitor']).optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

interface WeekInfo {
  label: string;
  start: string;
  number: number;
  year: number;
}

/**
 * Simple keyword extraction from post content.
 * Strips HTML, splits on whitespace/punctuation, filters stopwords and short tokens.
 */
function extractKeywords(
  contents: (string | null)[],
  topN = 20,
): { keyword: string; count: number }[] {
  const STOPWORDS = new Set([
    'và', 'của', 'là', 'có', 'được', 'trong', 'với', 'cho', 'để', 'tại',
    'https', 'http', 'www', 'com', 'vn', 'html', 'the', 'and', 'for', 'of',
    'to', 'in', 'on', 'with', 'by', 'from', 'this', 'that', 'it', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
    'video', 'clip', 'watch', 'xem', 'phim', 'nhạc', 'nhạc',
  ]);

  const counts = new Map<string, number>();

  for (const content of contents) {
    if (!content) continue;
    // Strip HTML tags and URLs
    const text = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^\p{L}\s]/gu, ' ')
      .toLowerCase()
      .trim();

    const words = text.split(/\s+/).filter(
      (w) => w.length >= 3 && !STOPWORDS.has(w),
    );

    for (const w of words) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([keyword, count]) => ({ keyword, count }));
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
    const { groupId, platform, brandType } = paramsSchema.parse({
      groupId: (await params).groupId,
      ...searchParams,
    });

    const platformFilter = platform ? `AND p.platform = '${platform}'` : '';
    const brandTypeFilter =
      brandType === 'primary' ? `AND b.is_primary = 't'`
      : brandType === 'competitor' ? `AND b.is_primary = 'f'`
      : '';

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
      return NextResponse.json({
        success: true,
        data: { week: null, format_performance: [], top_keywords: [], top_posts: [] },
      });
    }

    const week = weekResult.rows[0]!;
    const weekStart = week.week_start;
    const weekInfo: WeekInfo = {
      label: weekLabel(weekStart),
      start: weekStart,
      number: week.week_number,
      year: week.year,
    };

    // Format performance: aggregate from post table by platform × format
    const formatResult = await query<{
      platform: Platform;
      format: string;
      total_impressions: string;
      total_views: string;
      total_reactions: string;
      total_posts: number;
    }>(
      `SELECT
         p.platform,
         COALESCE(p.format, 'Unknown') AS format,
         COALESCE(SUM(p.impressions), 0)::bigint AS total_impressions,
         COALESCE(SUM(p.views), 0)::bigint AS total_views,
         COALESCE(SUM(p.reactions), 0)::bigint AS total_reactions,
         COUNT(*)::int AS total_posts
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date ${platformFilter}
       GROUP BY p.platform, format
       ORDER BY p.platform, total_impressions DESC`,
      [groupId, weekStart],
    );

    const format_performance = formatResult.rows.map((r) => {
      const impressions = Number(r.total_impressions);
      const reactions = Number(r.total_reactions);
      return {
        format: r.format as FormatType,
        engagement: reactions,
        er: impressions > 0 ? parseFloat(((reactions / impressions) * 100).toFixed(1)) : 0,
        posts: r.total_posts,
      };
    });

    // Top keywords: collect all post content then extract in JS
    const keywordResult = await query<{ content: string | null }>(
      `SELECT p.content
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date ${platformFilter}`,
      [groupId, weekStart],
    );

    const top_keywords = extractKeywords(keywordResult.rows.map((r) => r.content));

    // Top 20 posts by impressions
    const topPostsResult = await query<{
      id: string;
      platform: Platform;
      content: string | null;
      posted_at: string;
      impressions: string;
      views: string;
      reactions: string;
      format: string | null;
      link: string | null;
      brand_name: string;
    }>(
      `SELECT
         p.id,
         p.platform,
         p.content,
         p.posted_at,
         p.impressions,
         p.views,
         p.reactions,
         p.format,
         p.link,
         cb.name AS brand_name
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date ${platformFilter}
       ORDER BY p.impressions DESC
       LIMIT 20`,
      [groupId, weekStart],
    );

    const top_posts = topPostsResult.rows.map((r) => {
      const impressions = Number(r.impressions);
      const reactions = Number(r.reactions);
      return {
        id: r.id,
        platform: r.platform,
        format: r.format as FormatType | null,
        content: r.content ? r.content.slice(0, 200) : null,
        posted_at: r.posted_at,
        engagement: reactions,
        impressions,
        er: impressions > 0
          ? parseFloat(((reactions / impressions) * 100).toFixed(1))
          : 0,
        link: r.link,
        brand_name: r.brand_name,
      };
    });

    return NextResponse.json({
      success: true,
      data: { week: weekInfo, format_performance, top_keywords, top_posts },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load content data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
