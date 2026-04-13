import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth';
import { query } from '@/lib/db';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginInput = z.infer<typeof LoginSchema>;

interface DbUser {
  id: string;
  account_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
}

async function getUserByEmail(email: string): Promise<DbUser | null> {
  const result = await query<DbUser>(
    `SELECT id, account_id, email, password_hash, full_name, role, avatar_url, is_active
     FROM "user"
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

async function updateLastLogin(userId: string): Promise<void> {
  await query(
    `UPDATE "user" SET last_login_at = now() WHERE id = $1`,
    [userId]
  );
}

export async function POST(req: NextRequest) {
  let body: LoginInput;
  try {
    body = LoginSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid input' },
      { status: 400 }
    );
  }

  const user = await getUserByEmail(body.email);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  if (!user.is_active) {
    return NextResponse.json(
      { success: false, error: 'Account is deactivated' },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  await updateLastLogin(user.id);

  const { signJwt } = await import('@/lib/auth');
  const token = signJwt({
    sub: user.id,
    accountId: user.account_id,
    email: user.email,
    role: user.role,
  });

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
      token,
    },
  });
}
