/**
 * GET /api/dashboard/weeks
 * Returns min/max week_start for all groups the current user can access.
 * Used by AppContext to populate availableWeeks with the real data range.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { verifyJwt } from '../../../../lib/auth';

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(
  _req: NextRequest,
): Promise<NextResponse> {
  const payload = authUser(_req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query<{ min_week: string; max_week: string }>(
      `SELECT
         MIN(ws.week_start::text) AS min_week,
         MAX(ws.week_start::text) AS max_week
       FROM weekly_stats ws
       JOIN brand b ON b.id = ws.brand_id
       JOIN "group" g ON g.id = b.group_id
       JOIN client c ON c.id = g.client_id
       WHERE c.account_id = $1`,
      [payload.accountId],
    );

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        minWeek: row?.min_week ?? '2024-12-30',
        maxWeek: row?.max_week ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load weeks';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
