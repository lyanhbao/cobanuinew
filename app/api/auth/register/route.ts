import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import { transaction } from '@/lib/db';
import type { PoolClient } from 'pg';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  accountName: z.string().min(1),
});

type RegisterInput = z.infer<typeof RegisterSchema>;

interface DbUser {
  id: string;
  account_id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
}

interface DbAccount {
  id: string;
  name: string;
  type: string;
  plan: string;
}

async function doRegister(input: RegisterInput, client: PoolClient) {
  // Check if email already exists
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM "user" WHERE email = $1`,
    [input.email]
  );
  if (existing.rows.length > 0) {
    return null;
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create account
  const accountResult = await client.query<DbAccount>(
    `INSERT INTO account (name, type)
     VALUES ($1, 'direct_client')
     RETURNING id, name, type, plan`,
    [input.accountName]
  );
  const account = accountResult.rows[0];

  // Create user
  const userResult = await client.query<DbUser>(
    `INSERT INTO "user" (account_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, 'agency_owner')
     RETURNING id, account_id, email, full_name, role, avatar_url`,
    [account.id, input.email, passwordHash, input.fullName]
  );
  const user = userResult.rows[0];

  return { user, account };
}

export async function POST(req: NextRequest) {
  let body: RegisterInput;
  try {
    body = RegisterSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const result = await transaction(async (client) => {
      return doRegister(body, client);
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Email already in use' },
        { status: 409 }
      );
    }

    const { signJwt } = await import('@/lib/auth');
    const token = signJwt({
      sub: result.user.id,
      accountId: result.account.id,
      email: result.user.email,
      role: result.user.role,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: result.user.id,
            accountId: result.user.account_id,
            email: result.user.email,
            fullName: result.user.full_name,
            role: result.user.role,
            avatarUrl: result.user.avatar_url,
          },
          account: {
            id: result.account.id,
            name: result.account.name,
            type: result.account.type,
            plan: result.account.plan,
          },
          token,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
