import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';

interface JwtPayload {
  sub: string;
  accountId: string;
  email: string;
  role: string;
}

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
  max_users: number;
  max_clients: number;
  country: string;
  timezone: string;
  is_active: boolean;
}

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const [userResult, accountResult] = await Promise.all([
    query<DbUser>(
      `SELECT id, account_id, email, full_name, role, avatar_url
       FROM "user"
       WHERE id = $1 AND is_active = true`,
      [payload.sub]
    ),
    query<DbAccount>(
      `SELECT id, name, type, plan, max_users, max_clients, country, timezone, is_active
       FROM account
       WHERE id = $1`,
      [payload.accountId]
    ),
  ]);

  const user = userResult.rows[0];
  const account = accountResult.rows[0];

  if (!user || !account) {
    return NextResponse.json(
      { success: false, error: 'User or account not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        accountId: user.account_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
      },
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        plan: account.plan,
        maxUsers: account.max_users,
        maxClients: account.max_clients,
        country: account.country,
        timezone: account.timezone,
        isActive: account.is_active,
      },
    },
  });
}
