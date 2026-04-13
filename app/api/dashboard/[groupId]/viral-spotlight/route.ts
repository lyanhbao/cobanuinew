/**
 * GET /api/dashboard/[groupId]/viral-spotlight
 * Top 3 viral posts by total engagement (reactions + comments + shares).
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

interface PostRow {
  id: string;
  brand_name: string;
  platform: string;
  content: string;
  impressions: string;
  reactions: string;
  comments: string;
  shares: string;
  posted_at: string;
  link: string | null;
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
        return NextResponse.json({ success: true, data: { posts: [], week: null } });
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
        return NextResponse.json({ success: true, data: { posts: [], week: null } });
      }
      const w = weekRows.rows[0]!;
      weekStart = w.week_start;
      weekNumber = w.week_number;
      weekYear = w.year;
    }

    const weekInfo = { label: weekLabel(weekStart), start: weekStart, number: weekNumber, year: weekYear };

    // Query top 3 posts by engagement
    const postsRows = await query<PostRow>(
      `SELECT
         p.id,
         cb.name AS brand_name,
         p.platform,
         p.content,
         COALESCE(p.impressions, 0)::bigint AS impressions,
         COALESCE(p.reactions, 0)::bigint AS reactions,
         COALESCE(p.comments, 0)::bigint AS comments,
         COALESCE(p.shares, 0)::bigint AS shares,
         p.posted_at::text AS posted_at,
         p.link
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1 AND p.week_start = $2::date
       ORDER BY (COALESCE(p.reactions, 0) + COALESCE(p.comments, 0) + COALESCE(p.shares, 0)) DESC
       LIMIT 3`,
      [groupId, weekStart],
    );

    const posts = postsRows.rows.map((r) => ({
      id: r.id,
      brand_name: r.brand_name,
      platform: r.platform,
      content: r.content ? r.content.substring(0, 200) : '',
      content_full: r.content ?? '',
      impressions: Number(r.impressions),
      reactions: Number(r.reactions),
      comments: Number(r.comments),
      shares: Number(r.shares),
      total_engagement: Number(r.reactions) + Number(r.comments) + Number(r.shares),
      posted_at: r.posted_at,
      link: r.link,
    }));

    return NextResponse.json({
      success: true,
      data: { posts, week: weekInfo },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load viral spotlight";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
