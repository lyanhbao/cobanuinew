import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const CreateGroupSchema = z.object({
  name: z.string().min(1),
  benchmark_category: z.string().optional(),
});

type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const clientCheck = await query(
    `SELECT id FROM client WHERE id = $1 AND account_id = $2 AND is_active = true`,
    [id, payload.accountId]
  );
  if (clientCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  }

  const groupsResult = await query(
    `SELECT id, client_id, name, benchmark_category_id, crawl_status, created_at, updated_at
     FROM "group" WHERE client_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: groupsResult.rows.map((g: Record<string, unknown>) => ({
      id: g.id,
      clientId: g.client_id,
      name: g.name,
      benchmarkCategoryId: g.benchmark_category_id,
      crawlStatus: g.crawl_status,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateGroupInput;
  try {
    body = CreateGroupSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id } = await params;

  const clientCheck = await query(
    `SELECT id FROM client WHERE id = $1 AND account_id = $2 AND is_active = true`,
    [id, payload.accountId]
  );
  if (clientCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  }

  const dup = await query(
    `SELECT id FROM "group" WHERE client_id = $1 AND name = $2`,
    [id, body.name]
  );
  if (dup.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Group with this name already exists in this client' },
      { status: 409 }
    );
  }

  const result = await query(
    `INSERT INTO "group" (client_id, name, benchmark_category_id)
     VALUES ($1, $2, $3)
     RETURNING id, client_id, name, benchmark_category_id, crawl_status, created_at, updated_at`,
    [id, body.name, body.benchmark_category ?? null]
  );

  const g = result.rows[0];
  return NextResponse.json({
    success: true,
    data: {
      id: g.id,
      clientId: g.client_id,
      name: g.name,
      benchmarkCategoryId: g.benchmark_category_id,
      crawlStatus: g.crawl_status,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    },
  }, { status: 201 });
}
