/**
 * GET /api/crawl-progress/[groupId]
 * Real-time crawl progress per brand for a group.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { z } from 'zod';
import { verifyJwt } from '@/lib/auth';

const paramsSchema = z.object({
  groupId: z.string().uuid(),
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
    const { groupId } = paramsSchema.parse(await params);

    // FIX: added group ownership check. Without this, any authenticated user
    // could see crawl progress for any group by guessing its UUID.
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    const progressResult = await query<{
      brand_id: string;
      brand_name: string;
      is_primary: boolean;
      crawl_status: string;
      last_crawl_at: string | null;
      posts_count: number;
      posts_last_7d: number;
      error_message: string | null;
    }>(
      `SELECT
         b.id AS brand_id,
         cb.name AS brand_name,
         b.is_primary,
         b.crawl_status,
         b.last_crawl_at,
         COALESCE(pc.posts_count, 0)::int AS posts_count,
         COALESCE(pl7.posts_last_7d, 0)::int AS posts_last_7d,
         b.error_message
       FROM brand b
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       LEFT JOIN (
         SELECT p.curated_brand_id, COUNT(*)::int AS posts_count
         FROM post p
         GROUP BY p.curated_brand_id
       ) pc ON pc.curated_brand_id = b.curated_brand_id
       LEFT JOIN (
         SELECT p.curated_brand_id, COUNT(*)::int AS posts_last_7d
         FROM post p
         WHERE p.posted_at >= (now() - INTERVAL '7 days')
         GROUP BY p.curated_brand_id
       ) pl7 ON pl7.curated_brand_id = b.curated_brand_id
       WHERE b.group_id = $1
       ORDER BY b.is_primary DESC, cb.name ASC`,
      [groupId],
    );

    // Get the most recent crawl job for this group
    const recentJobResult = await query<{
      status: string;
      started_at: string | null;
      completed_at: string | null;
      posts_fetched: number;
      posts_upserted: number;
      error_message: string | null;
    }>(
      `SELECT cj.status, cj.started_at, cj.completed_at,
              cj.posts_fetched, cj.posts_upserted, cj.error_message
       FROM crawl_job cj
       WHERE cj.group_id = $1
       ORDER BY cj.created_at DESC
       LIMIT 1`,
      [groupId],
    );

    const recentJob = recentJobResult.rows[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        groupId,
        brands: progressResult.rows,
        recentJob,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get crawl progress';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
