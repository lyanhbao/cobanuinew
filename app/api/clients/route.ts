import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query, transaction } from '@/lib/db';
import { z } from 'zod';
import type { PoolClient } from 'pg';

const CreateClientSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1).optional(),
  country: z.string().length(2).default('VN'),
});

type CreateClientInput = z.infer<typeof CreateClientSchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
}

interface DbClient {
  id: string;
  account_id: string;
  name: string;
  industry: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbAccount {
  id: string;
  max_clients: number | null;
  plan: string;
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
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const [clientsResult, countResult] = await Promise.all([
    query<DbClient>(
      `SELECT id, account_id, name, industry, country, is_active, created_at, updated_at
       FROM client
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [payload.accountId, limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM client WHERE account_id = $1`,
      [payload.accountId]
    ),
  ]);

  return NextResponse.json({
    success: true,
    data: clientsResult.rows.map((c) => ({
      id: c.id,
      accountId: c.account_id,
      name: c.name,
      industry: c.industry,
      country: c.country,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
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

  let body: CreateClientInput;
  try {
    body = CreateClientSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  try {
    const result = await transaction(async (client: PoolClient) => {
      // Check plan limits
      const accountResult = await client.query<DbAccount>(
        `SELECT id, max_clients, plan FROM account WHERE id = $1`,
        [payload.accountId]
      );
      const account = accountResult.rows[0];
      if (!account) throw new Error('Account not found');

      if (account.max_clients !== null) {
        const countResult = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM client WHERE account_id = $1`,
          [payload.accountId]
        );
        const currentCount = parseInt(countResult.rows[0].count, 10);
        if (currentCount >= account.max_clients) {
          throw new Error(`Client limit reached (plan: ${account.plan})`);
        }
      }

      // Check duplicate name
      const dupResult = await client.query(
        `SELECT id FROM client WHERE account_id = $1 AND name = $2`,
        [payload.accountId, body.name]
      );
      if (dupResult.rows.length > 0) {
        throw new Error('Client with this name already exists');
      }

      const insertResult = await client.query<DbClient>(
        `INSERT INTO client (account_id, name, industry, country)
         VALUES ($1, $2, $3, $4)
         RETURNING id, account_id, name, industry, country, is_active, created_at, updated_at`,
        [payload.accountId, body.name, body.industry ?? null, body.country]
      );
      return insertResult.rows[0];
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.id,
          accountId: result.account_id,
          name: result.name,
          industry: result.industry,
          country: result.country,
          isActive: result.is_active,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create client';
    const status = message.includes('limit') || message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
