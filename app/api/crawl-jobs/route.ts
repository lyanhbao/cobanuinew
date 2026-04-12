/**
 * GET /api/crawl-jobs
 * List crawl jobs with optional filters: status, group_id, date range.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { z } from 'zod';
import { JobStatus } from '../../../lib/types';
import { verifyJwt } from '@/lib/auth';

const listSchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'failed']).optional(),
  groupId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const payload = authUser(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const { status, groupId, from, to, limit, offset } = parsed.data;

    // FIX: added authorization filter — only show crawl jobs for groups
    // belonging to the authenticated account.
    const conditions: string[] = [`g.account_id = $${1}`];
    const paramsArr: unknown[] = [payload.accountId];
    let pIdx = 2;

    if (status) {
      conditions.push(`cj.status = $${pIdx++}`);
      paramsArr.push(status);
    }
    if (groupId) {
      conditions.push(`cj.group_id = $${pIdx++}`);
      paramsArr.push(groupId);
    }
    if (from) {
      conditions.push(`cj.created_at >= $${pIdx++}::timestamptz`);
      paramsArr.push(from);
    }
    if (to) {
      conditions.push(`cj.created_at <= $${pIdx++}::timestamptz`);
      paramsArr.push(to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const dataResult = await query<{
      id: string;
      group_id: string;
      brand_id: string;
      job_type: string;
      status: JobStatus;
      crawl_from: string;
      crawl_to: string;
      posts_fetched: number;
      posts_upserted: number;
      started_at: string | null;
      completed_at: string | null;
      error_message: string | null;
      created_at: string;
    }>(
      `SELECT cj.id, cj.group_id, cj.brand_id, cj.job_type, cj.status,
              cj.crawl_from, cj.crawl_to, cj.posts_fetched, cj.posts_upserted,
              cj.started_at, cj.completed_at, cj.error_message, cj.created_at
       FROM crawl_job cj
       JOIN "group" g ON g.id = cj.group_id
       ${whereClause}
       ORDER BY cj.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...paramsArr, limit, offset],
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM crawl_job cj
       JOIN "group" g ON g.id = cj.group_id
       ${whereClause}`,
      paramsArr,
    );

    // FIX: consistent response format with other API routes.
    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.count ?? '0', 10),
        limit,
        offset,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list crawl jobs';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
