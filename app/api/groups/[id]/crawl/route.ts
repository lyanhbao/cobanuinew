import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';

function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Verify group belongs to account
  const groupCheck = await query(
    `SELECT g.id, g.name, g.crawl_status
     FROM "group" g
     JOIN client c ON c.id = g.client_id
     WHERE g.id = $1 AND c.account_id = $2`,
    [groupId, payload.accountId]
  );
  if (groupCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
  }

  // Queue a crawl job for this group
  try {
    const result = await query(
      `INSERT INTO crawl_job (group_id, crawl_from, crawl_to)
       VALUES ($1, date_trunc('year', now())::date, now()::date)
       RETURNING id, group_id, status, crawl_from, crawl_to, created_at`,
      [groupId]
    );
    const job = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        groupId: job.group_id,
        status: job.status,
        crawlFrom: job.crawl_from,
        crawlTo: job.crawl_to,
        createdAt: job.created_at,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start crawl';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
