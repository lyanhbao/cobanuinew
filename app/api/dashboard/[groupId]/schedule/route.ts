/**
 * GET /api/dashboard/[groupId]/schedule
 * Returns brand activity timeline for Gantt-style visualization.
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     weeks: string[],        // week labels (W1, W2, ...) — chronological
 *     weekStarts: string[],   // ISO dates for positioning
 *     today: string | null,   // current week start (marker line)
 *     brands: BrandTimeline[]
 *   }
 * }
 *
 * BrandTimeline:
 * {
 *   brand_id: string
 *   brand_name: string
 *   is_primary: boolean
 *   channels: ChannelRow[]
 * }
 *
 * ChannelRow:
 * {
 *   platform: 'facebook' | 'youtube' | 'tiktok'
 *   platform_label: string
 *   segments: ActivitySegment[]
 * }
 *
 * ActivitySegment:
 * {
 *   week_start: string   // start of the continuous block
 *   week_count: number   // how many consecutive weeks
 *   impressions: number  // total for the block
 *   reactions: number
 *   post_count: number
 *   has_high_activity: boolean  // true if > 75th percentile in group
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { weekLabel } from "@/lib/week-format";
import { verifyJwt } from "@/lib/auth";

const paramsSchema = z.object({
  groupId: z.string().uuid(),
  week: z.string().optional(),
  months: z.coerce.number().min(1).max(52).default(26).optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyJwt(auth.slice(7));
}

interface WeekMeta {
  week_start: string;
  week_number: number;
  year: number;
}

interface PostSegment {
  platform: string;
  week_start: string;
  week_end: string;
  impression_sum: string;
  reaction_sum: string;
  post_count: string;
}

interface BrandRow {
  brand_id: string;
  brand_name: string;
  is_primary: boolean | string;
}

interface AggregatedRow {
  brand_id: string;
  brand_name: string;
  is_primary: boolean | string;
  platform: string;
  week_start: string;
  week_end: string;
  impression_sum: string;
  reaction_sum: string;
  post_count: string;
}

// ─── Helper: merge consecutive weeks into continuous segments ────────────────

interface Segment {
  week_start: string;
  week_end: string;
  week_count: number;
  impression_sum: number;
  reaction_sum: number;
  post_count: number;
}

function buildSegments(rows: AggregatedRow[]): { platform: string; segments: Segment[] } {
  if (!rows.length) return { platform: '', segments: [] };

  const platform = rows[0]!.platform;

  // Sort by week_start
  const sorted = [...rows].sort((a, b) => a.week_start.localeCompare(b.week_start));

  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const row of sorted) {
    const imp = Number(row.impression_sum) || 0;
    if (imp === 0) continue; // Skip weeks with 0 impressions

    if (current) {
      // Check if this week is immediately after the current block
      const prevEnd = new Date(current.week_end + 'T00:00:00Z');
      const currStart = new Date(row.week_start + 'T00:00:00Z');
      const daysDiff = Math.round((currStart.getTime() - prevEnd.getTime()) / 86400000);

      if (daysDiff === 7) {
        // Consecutive — extend current segment
        current.week_end = row.week_end;
        current.week_count += 1;
        current.impression_sum += imp;
        current.reaction_sum += Number(row.reaction_sum) || 0;
        current.post_count += Number(row.post_count) || 0;
        continue;
      }
    }

    // Start new segment
    if (current) segments.push(current);
    current = {
      week_start: row.week_start,
      week_end: row.week_end,
      week_count: 1,
      impression_sum: imp,
      reaction_sum: Number(row.reaction_sum) || 0,
      post_count: Number(row.post_count) || 0,
    };
  }
  if (current) segments.push(current);

  return { platform, segments };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const { groupId, week: requestedWeek, months } = paramsSchema.parse({
      groupId: (await params).groupId,
      ...searchParams,
    });

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

    // Number of weeks to show (default 26 ≈ 6 months)
    const numWeeks = months ?? 26;

    // Determine week range: from numWeeks ago to the requested/current week
    let endWeekStart: string;

    if (requestedWeek) {
      endWeekStart = requestedWeek;
    } else {
      // Use the most recent week that has data
      const latestRow = await query<{ week_start: string }>(
        `SELECT week_start::text AS week_start
         FROM weekly_stats
         WHERE group_id = $1
         ORDER BY week_start DESC LIMIT 1`,
        [groupId],
      );
      if (latestRow.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            weeks: [], weekStarts: [], today: null,
            brands: [], weekCount: 0,
          },
        });
      }
      endWeekStart = latestRow.rows[0]!.week_start;
    }

    // Calculate start week: endWeekStart - numWeeks + 1
    const endDate = new Date(endWeekStart + 'T00:00:00Z');
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (numWeeks - 1) * 7);

    // Get all weeks in range with Monday as start
    const weekList: WeekMeta[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * 7);
      const weekStart = d.toISOString().slice(0, 10);
      const { week_number, year } = { week_number: 0, year: d.getUTCFullYear() };
      weekList.push({
        week_start: weekStart,
        week_number: 0, // filled from DB or computed
        year: d.getUTCFullYear(),
      });
    }

    // Fetch week metadata from DB to get correct week numbers
    const weekMetaRows = await query<WeekMeta>(
      `SELECT DISTINCT ws.week_start::text AS week_start,
              ws.week_number, ws.year
       FROM weekly_stats ws
       WHERE ws.group_id = $1
         AND ws.week_start >= $2::date
         AND ws.week_start <= $3::date
       ORDER BY ws.week_start`,
      [groupId, startDate.toISOString().slice(0, 10), endWeekStart],
    );

    // Build week index map
    const weekMetaMap = new Map<string, WeekMeta>();
    for (const row of weekMetaRows.rows) {
      weekMetaMap.set(row.week_start, row);
    }

    // Also fill in missing weeks that have post data but no weekly_stats
    const postWeeks = await query<{ week_start: string }>(
      `SELECT DISTINCT p.week_start::text AS week_start
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE b.group_id = $1
         AND p.week_start >= $2::date
         AND p.week_start <= $3::date
       ORDER BY p.week_start`,
      [groupId, startDate.toISOString().slice(0, 10), endWeekStart],
    );
    for (const row of postWeeks.rows) {
      if (!weekMetaMap.has(row.week_start)) {
        weekMetaMap.set(row.week_start, {
          week_start: row.week_start,
          week_number: 0,
          year: new Date(row.week_start + 'T00:00:00Z').getUTCFullYear(),
        });
      }
    }

    // Build ordered week list
    const sortedWeekStarts = [...weekMetaMap.keys()].sort();
    const weekLabels = sortedWeekStarts.map((ws) => weekLabel(ws));

    // Today's week (current week start)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    today.setDate(today.getDate() + diff);
    const todayWeekStart = today.toISOString().slice(0, 10);
    const todayLabel = sortedWeekStarts.includes(todayWeekStart) ? todayWeekStart : null;

    // Compute max impressions per brand×channel for activity threshold
    const activityThreshold = await query<{ max_imp: string }>(
      `SELECT COALESCE(MAX(s.total_impressions), 0)::bigint AS max_imp
       FROM weekly_stats s
       JOIN brand b ON b.id = s.brand_id
       WHERE b.group_id = $1
         AND s.week_start >= $2::date
         AND s.week_start <= $3::date`,
      [groupId, startDate.toISOString().slice(0, 10), endWeekStart],
    );
    const threshold75 = Math.max(
      Number(activityThreshold.rows[0]?.max_imp ?? 0) * 0.75,
      100_000,
    );

    // Get all brands in this group
    const brandRows = await query<BrandRow>(
      `SELECT b.id AS brand_id, cb.name AS brand_name, b.is_primary
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1
       ORDER BY b.is_primary DESC, cb.name ASC`,
      [groupId],
    );

    // Get per-brand, per-channel, per-week post aggregations
    const postRows = await query<AggregatedRow>(
      `SELECT
         b.id AS brand_id,
         cb.name AS brand_name,
         b.is_primary,
         p.platform,
         p.week_start::text AS week_start,
         (p.week_start::date + INTERVAL '6 days')::text AS week_end,
         COALESCE(SUM(p.impressions), 0)::bigint AS impression_sum,
         COALESCE(SUM(p.reactions), 0)::bigint AS reaction_sum,
         COUNT(*)::int AS post_count
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE b.group_id = $1
         AND p.week_start >= $2::date
         AND p.week_start <= $3::date
       GROUP BY b.id, cb.name, b.is_primary, p.platform, p.week_start
       ORDER BY b.id, p.platform, p.week_start`,
      [groupId, startDate.toISOString().slice(0, 10), endWeekStart],
    );

    // Group post rows by brand
    const postsByBrand = new Map<string, AggregatedRow[]>();
    for (const row of postRows.rows) {
      if (!postsByBrand.has(row.brand_id)) {
        postsByBrand.set(row.brand_id, []);
      }
      postsByBrand.get(row.brand_id)!.push(row);
    }

    // Build brand timelines
    const platforms = ['facebook', 'youtube', 'tiktok'] as const;
    const PLATFORM_LABELS: Record<string, string> = {
      facebook: 'Facebook',
      youtube: 'YouTube',
      tiktok: 'TikTok',
    };

    const brands = brandRows.rows.map((brand: BrandRow) => {
      const brandPosts = postsByBrand.get(brand.brand_id) ?? [];

      const channels = platforms.map((platform) => {
        const platformRows = brandPosts.filter((r) => r.platform === platform);
        const { segments } = buildSegments(platformRows);

        return {
          platform,
          platform_label: PLATFORM_LABELS[platform],
          segments: segments.map((seg) => ({
            week_start: seg.week_start,
            week_count: seg.week_count,
            impressions: seg.impression_sum,
            reactions: seg.reaction_sum,
            post_count: seg.post_count,
            has_high_activity: seg.impression_sum >= threshold75,
          })),
        };
      });

      return {
        brand_id: brand.brand_id,
        brand_name: brand.brand_name,
        is_primary: brand.is_primary === 't' || brand.is_primary === true,
        channels,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        weeks: weekLabels,
        weekStarts: sortedWeekStarts,
        today: todayLabel,
        brands,
        weekCount: sortedWeekStarts.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load schedule";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}