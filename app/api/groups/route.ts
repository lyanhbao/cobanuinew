import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const CreateGroupSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid().optional(),
  benchmarkCategoryId: z.string().uuid().nullable().optional(),
});

type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
}

interface DbGroup {
  id: string;
  client_id: string;
  name: string;
  benchmark_category_id: string | null;
  crawl_status: string;
  created_at: string;
  updated_at: string;
}

interface DbClient {
  id: string;
}

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  let sql = `
    SELECT g.id, g.client_id, g.name, g.benchmark_category_id, g.crawl_status, g.created_at, g.updated_at
    FROM "group" g
    JOIN client c ON c.id = g.client_id
    WHERE c.account_id = $1
  `;
  const params: unknown[] = [payload.accountId];

  if (clientId) {
    sql += ` AND g.client_id = $2`;
    params.push(clientId);
  }

  const countSql = sql.replace('SELECT g.id, g.client_id, g.name, g.benchmark_category_id, g.crawl_status, g.created_at, g.updated_at', 'SELECT COUNT(*)::text');
  const selectSql = `${sql} ORDER BY g.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  params.push(limit, offset);

  const [groupsResult, countResult] = await Promise.all([
    query<DbGroup>(selectSql, params),
    query<{ count: string }>(countSql, clientId ? [payload.accountId, clientId] : [payload.accountId]),
  ]);

  return NextResponse.json({
    success: true,
    data: groupsResult.rows.map((g) => ({
      id: g.id,
      clientId: g.client_id,
      name: g.name,
      benchmarkCategoryId: g.benchmark_category_id,
      crawlStatus: g.crawl_status,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    })),
    meta: {
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    },
  });
}

export async function POST(req: NextRequest) {
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

  // Default to first client if not provided
  let targetClientId = body.clientId;
  if (!targetClientId) {
    const firstClient = await query<DbClient>(
      `SELECT id FROM client WHERE account_id = $1 AND is_active = true LIMIT 1`,
      [payload.accountId]
    );
    if (firstClient.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active client found. Provide clientId or create a client first.' },
        { status: 400 }
      );
    }
    targetClientId = firstClient.rows[0].id;
  } else {
    // Verify client belongs to account
    const clientCheck = await query<{ id: string }>(
      `SELECT id FROM client WHERE id = $1 AND account_id = $2 AND is_active = true`,
      [targetClientId, payload.accountId]
    );
    if (clientCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
  }

  // Check duplicate name within client
  const dupResult = await query<{ id: string }>(
    `SELECT id FROM "group" WHERE client_id = $1 AND name = $2`,
    [targetClientId, body.name]
  );
  if (dupResult.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Group with this name already exists in this client' },
      { status: 409 }
    );
  }

  // FIX: removed non-existent column `created_by` from INSERT.
  // The "group" table schema does not have this column.
  const result = await query<DbGroup>(
    `INSERT INTO "group" (client_id, name, benchmark_category_id)
     VALUES ($1, $2, $3)
     RETURNING id, client_id, name, benchmark_category_id, crawl_status, created_at, updated_at`,
    [targetClientId, body.name, body.benchmarkCategoryId ?? null]
  );

  const group = result.rows[0];
  return NextResponse.json(
    {
      success: true,
      data: {
        id: group.id,
        clientId: group.client_id,
        name: group.name,
        benchmarkCategoryId: group.benchmark_category_id,
        crawlStatus: group.crawl_status,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      },
    },
    { status: 201 }
  );
}
