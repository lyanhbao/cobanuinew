/**
 * GET /api/dashboard/[groupId]/trends
 *
 * Returns { brands, trend_data, anomalies, average } shaped for the Trends page.
 * - brands: brand names from the latest week of the time series
 * - trend_data: last 26 weekly rows, each {week: "W13 (12 Apr – 18 Apr, 2025)", [brandName]: impressions}
 * - anomalies: from brand_activity, mapped to {id, brand_name, type, description, severity, week: "W##"}
 * - average: optional { [brandName]: avgImpressions }
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { weekLabel } from '../../../../../lib/week-format';
import { verifyJwt } from '../../../../../lib/auth';

const querySchema = z.object({
  groupId: z.string().uuid(),
  week: z.string().optional(),
  weeks: z.coerce.number().int().min(4).max(52).default(26),
  platform: z.enum(['youtube', 'facebook', 'tiktok']).optional(),
  brandType: z.enum(['primary', 'competitor']).optional(),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
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
    const { groupId, week: requestedWeek, weeks, platform, brandType } = querySchema.parse({
      groupId: (await params).groupId,
      ...searchParams,
    });

    const platformFilter = platform ? `AND p.platform = '${platform}'` : '';
    const brandTypeFilter =
      brandType === 'primary' ? `b.is_primary = 't'`
      : brandType === 'competitor' ? `b.is_primary = 'f'`
      : '';

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    // ── Time series: brand-level impressions, last N weeks ───────────────────
    // Use actual max week_start in data instead of CURRENT_DATE (data may be historical)
    interface RawRow {
      week_start: string;
      brand_id: string;
      brand_name: string;
      total_impressions: string;
    }
    const rows = await query<RawRow>(
      `WITH max_week AS (
         SELECT MAX(ws.week_start) AS max_w FROM weekly_stats ws WHERE ws.group_id = $1
       )
       SELECT
         ws.week_start::text,
         b.id           AS brand_id,
         cb.name         AS brand_name,
         ws.total_impressions
       FROM weekly_stats ws
       JOIN brand b       ON b.id        = ws.brand_id
       JOIN curated_brand cb ON cb.id  = b.curated_brand_id
       CROSS JOIN max_week mw
       WHERE ws.group_id  = $1
         AND ws.week_start >= mw.max_w - (INTERVAL '1 day' * ($2 * 7))
         ${brandTypeFilter ? `AND ${brandTypeFilter}` : ''}
       ORDER BY ws.week_start ASC, cb.name ASC`,
      [groupId, weeks],
    );

    // Build week-ordered list of rows: { week_start, [brandName]: impressions }
    // Also collect unique brands in order of first appearance.
    const weekMap = new Map<string, Record<string, string | number>>();
    const brandOrder = new Map<string, { id: string; name: string }>();

    for (const row of rows.rows) {
      if (!weekMap.has(row.week_start)) {
        weekMap.set(row.week_start, { week: weekLabel(row.week_start) });
      }
      weekMap.get(row.week_start)![row.brand_name] = Number(row.total_impressions);
      if (!brandOrder.has(row.brand_id)) {
        brandOrder.set(row.brand_id, { id: row.brand_id, name: row.brand_name });
      }
    }

    // Last 26 rows
    const allWeeks = Array.from(weekMap.values());
    const trend_data = allWeeks.slice(-26);

    // Brands in order of appearance in the dataset
    const brands = Array.from(brandOrder.values());

    // ── Anomalies: first try brand_activity, fall back to weekly_stats gap_pct ──
    interface RawAnomaly {
      id: string;
      brand_name: string;
      activity_type: string;
      title: string | null;
      description: string | null;
      gap_pct: string | null;
      week_start: string | null;
      week_number: number | null;
    }
    let anomalyRows = await query<RawAnomaly>(
      `SELECT
         ba.id,
         cb.name          AS brand_name,
         ba.activity_type,
         ba.title,
         ba.description,
         ba.gap_pct,
         ba.week_start,
         ws.week_number
       FROM brand_activity ba
       JOIN brand b        ON b.id  = ba.brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       LEFT JOIN weekly_stats ws
              ON ws.brand_id    = b.id
             AND ws.week_start  = ba.week_start
       WHERE b.group_id = $1 ${brandTypeFilter ? `AND ${brandTypeFilter}` : ''}
       ORDER BY
         ABS(COALESCE(ba.gap_pct::numeric, 0)) DESC
       LIMIT 20`,
      [groupId],
    );

    // If brand_activity has no rows, fall back to weekly_stats gap_pct anomalies
    if (anomalyRows.rows.length === 0) {
      anomalyRows = await query<RawAnomaly>(
        `SELECT
           ws.brand_id::text || '-' || ws.week_start::text AS id,
           cb.name           AS brand_name,
           CASE WHEN ws.gap_pct > 0 THEN 'viral' ELSE 'anomaly' END AS activity_type,
           NULL::text        AS title,
           CASE
             WHEN ws.gap_pct > 0
               THEN 'Viral spike detected: +' || ROUND(ABS(ws.gap_pct::numeric), 0) || '% impressions'
             ELSE 'Significant drop detected: ' || ROUND(ws.gap_pct::numeric, 0) || '% impressions'
           END               AS description,
           ws.gap_pct::text AS gap_pct,
           ws.week_start::text AS week_start,
           ws.week_number
         FROM weekly_stats ws
         JOIN brand b        ON b.id  = ws.brand_id
         JOIN curated_brand cb ON cb.id = b.curated_brand_id
         WHERE ws.group_id = $1
           AND ABS(ws.gap_pct::numeric) >= 100
           ${brandTypeFilter ? `AND ${brandTypeFilter}` : ''}
         ORDER BY ABS(ws.gap_pct::numeric) DESC
         LIMIT 20`,
        [groupId],
      );
    }

    function toSeverity(
      gapPct: number | null,
    ): 'critical' | 'warning' | 'info' {
      if (gapPct === null) return 'info';
      if (Math.abs(gapPct) >= 300) return 'critical';
      if (Math.abs(gapPct) >= 100) return 'warning';
      return 'info';
    }

    const anomalies = anomalyRows.rows.map((r) => ({
      id: r.id,
      brand_name: r.brand_name,
      type: r.activity_type,
      description: r.description ?? r.title ?? `${r.activity_type} event detected`,
      severity: toSeverity(r.gap_pct != null ? Number(r.gap_pct) : null),
      week: r.week_number != null ? `W${r.week_number}` : weekLabel(r.week_start ?? ''),
    }));

    // ── Average impressions per brand per week (across the series) ────────────
    const brandTotals = new Map<string, { sum: number; count: number }>();
    for (const row of rows.rows) {
      const existing = brandTotals.get(row.brand_name);
      const val = Number(row.total_impressions);
      if (existing) {
        existing.sum += val;
        existing.count += 1;
      } else {
        brandTotals.set(row.brand_name, { sum: val, count: 1 });
      }
    }
    const average: Record<string, number> = {};
    for (const [brand, { sum, count }] of brandTotals) {
      average[brand] = Math.round(sum / count);
    }

    return NextResponse.json({ success: true, data: { brands, trend_data, anomalies, average } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load trends data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
