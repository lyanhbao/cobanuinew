/**
 * GET /api/dashboard/[groupId]/rankings
 * Returns brand rankings with SOV, SOS, WoW metrics, and trend sparklines.
 * Response shape: { week: WeekInfo, brands: BrandRow[] }
 * Matches RankingsData interface used by the rankings page.
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

interface WeekInfo {
  label: string;
  start: string;
  number: number;
  year: number;
}

interface BrandRow {
  rank: number;
  brand_name: string;
  is_primary: boolean;
  impressions: number;
  sov_pct: number;
  sos_pct: number;
  reactions: number;
  posts: number;
  avg_er: number;
  gap_pct: number;
  trend: number[];
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

    // ── Latest week ─────────────────────────────────────────────────────────
    // Use ::text to bypass JS Date timezone conversion (pg returns date as UTC midnight)
    const weekResult = await query<{ week_start: string; week_number: number; year: number }>(
      `SELECT week_start::text AS week_start, week_number, year
       FROM weekly_stats
       WHERE group_id = $1
       ORDER BY week_start DESC
       LIMIT 1`,
      [groupId],
    );

    if (weekResult.rows.length === 0) {
      return NextResponse.json({ success: true, data: { week: null, brands: [] } });
    }

    const week = weekResult.rows[0]!;
    const weekStart = week.week_start;
    const weekInfo: WeekInfo = {
      label: weekLabel(weekStart),
      start: weekStart,
      number: week.week_number,
      year: week.year,
    };

    // ── All brands in group (LEFT JOIN to get ALL brands, not just those with stats) ──
    // Also pull current + previous week in one shot
    const wowResult = await query<{
      brand_id: string;
      brand_name: string;
      is_primary: boolean | string;
      week_start: string | null;
      total_impressions: string | null;
      total_reactions: string | null;
      total_posts: number | null;
      avg_engagement_rate: string | null;
      gap_pct: string | null;
    }>(
      `SELECT
         b.id AS brand_id,
         cb.name AS brand_name,
         b.is_primary,
         ws.week_start::text AS week_start,
         ws.total_impressions::text AS total_impressions,
         ws.total_reactions::text AS total_reactions,
         ws.total_posts,
         ws.avg_engagement_rate::text AS avg_engagement_rate,
         ws.gap_pct::text AS gap_pct
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       LEFT JOIN weekly_stats ws ON ws.brand_id = b.id
         AND ws.week_start IN ($2::date, $2::date - INTERVAL '7 days')
       WHERE b.group_id = $1
       ORDER BY b.is_primary DESC, ws.total_impressions DESC NULLS LAST`,
      [groupId, weekStart],
    );

    // Partition by brand so we can grab current vs previous week
    const byBrand = new Map<string, {
      brand_id: string;
      brand_name: string;
      is_primary: boolean;
      curr_impressions: number;
      curr_reactions: number;
      curr_posts: number;
      curr_avg_er: number;
      curr_gap_pct: number;
      prev_impressions: number;
      prev_reactions: number;
      prev_posts: number;
      prev_avg_er: number;
    }>();

    for (const row of wowResult.rows) {
      const entry = byBrand.get(row.brand_id) ?? {
        brand_id: row.brand_id,
        brand_name: row.brand_name,
        is_primary: row.is_primary === 't' || row.is_primary === true,
        curr_impressions: 0,
        curr_reactions: 0,
        curr_posts: 0,
        curr_avg_er: 0,
        curr_gap_pct: 0,
        prev_impressions: 0,
        prev_reactions: 0,
        prev_posts: 0,
        prev_avg_er: 0,
      };

      if (row.week_start === null) continue; // brand has no weekly_stats at all

      const isCurrent = row.week_start === weekStart;
      if (isCurrent) {
        entry.curr_impressions = Number(row.total_impressions) || 0;
        entry.curr_reactions = Number(row.total_reactions) || 0;
        entry.curr_posts = row.total_posts ?? 0;
        entry.curr_avg_er = Number(row.avg_engagement_rate) || 0;
        entry.curr_gap_pct = Number(row.gap_pct) || 0;
      } else {
        entry.prev_impressions = Number(row.total_impressions) || 0;
        entry.prev_reactions = Number(row.total_reactions) || 0;
        entry.prev_posts = row.total_posts ?? 0;
        entry.prev_avg_er = Number(row.avg_engagement_rate) || 0;
      }

      byBrand.set(row.brand_id, entry);
    }

    // ── SOV: total impressions for the latest week (for percentage calc) ────
    const totalResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(total_impressions), 0)::bigint AS total
       FROM weekly_stats
       WHERE group_id = $1 AND week_start = $2::date`,
      [groupId, weekStart],
    );
    const totalImpressions = Number(totalResult.rows[0]?.total) || 1;

    // ── SOS: total views for the latest week ──────────────────────────────────
    const totalViewsResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(total_views), 0)::bigint AS total
       FROM weekly_stats
       WHERE group_id = $1 AND week_start = $2::date`,
      [groupId, weekStart],
    );
    const totalViews = Number(totalViewsResult.rows[0]?.total) || 1;

    // ── Trend: last 8 weeks of SOV pct per brand (newest last) ──────────────────
    // First get total impressions per week for SOV calculation
    const totalByWeekResult = await query<{ week_start: string; total: string }>(
      `SELECT ws.week_start::text AS week_start,
              COALESCE(SUM(ws.total_impressions), 0)::bigint AS total
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start <= $2::date
       GROUP BY ws.week_start
       ORDER BY ws.week_start ASC`,
      [groupId, weekStart],
    );
    const totalByWeek = new Map<string, number>();
    for (const row of totalByWeekResult.rows) {
      totalByWeek.set(row.week_start, Number(row.total));
    }

    const trendResult = await query<{ brand_id: string; week_start: string; total_impressions: string }>(
      `SELECT ws.brand_id, ws.week_start::text AS week_start, ws.total_impressions
       FROM weekly_stats ws
       WHERE ws.group_id = $1 AND ws.week_start <= $2::date
       ORDER BY ws.brand_id, ws.week_start ASC`,
      [groupId, weekStart],
    );

    const trendByBrand = new Map<string, number[]>();
    for (const row of trendResult.rows) {
      const arr = trendByBrand.get(row.brand_id) ?? [];
      const weekTotal = totalByWeek.get(row.week_start) || 1;
      const sov = (Number(row.total_impressions) / weekTotal) * 100;
      arr.push(Math.round(sov * 100) / 100);
      // Keep only last 8
      if (arr.length > 8) arr.shift();
      trendByBrand.set(row.brand_id, arr);
    }

    // ── Assemble merged brands array ─────────────────────────────────────────
    // Sort by impressions descending for rank order
    const sorted = Array.from(byBrand.values()).sort(
      (a, b) => b.curr_impressions - a.curr_impressions,
    );

    const brands: BrandRow[] = sorted.map((entry, idx) => {
      const impressions = entry.curr_impressions;
      const sov_pct = totalImpressions > 0 ? (impressions / totalImpressions) * 100 : 0;

      // WoW delta for impressions (used as gap_pct)
      const wow_gap_pct = entry.prev_impressions > 0
        ? ((impressions - entry.prev_impressions) / entry.prev_impressions) * 100
        : null;

      return {
        rank: idx + 1,
        brand_name: entry.brand_name,
        is_primary: entry.is_primary,
        impressions,
        sov_pct: parseFloat(sov_pct.toFixed(2)),
        sos_pct: parseFloat(((impressions / totalViews) * 100).toFixed(2)),
        reactions: entry.curr_reactions,
        posts: entry.curr_posts,
        avg_er: parseFloat(entry.curr_avg_er.toFixed(2)),
        gap_pct: wow_gap_pct !== null ? parseFloat(wow_gap_pct.toFixed(2)) : 0,
        trend: trendByBrand.get(entry.brand_id) ?? [],
      };
    });

    return NextResponse.json({
      success: true,
      data: { week: weekInfo, brands },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load rankings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
