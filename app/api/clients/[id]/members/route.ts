import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'analyst', 'viewer']),
});

type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

interface JwtPayload { sub: string; accountId: string; }

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const check = await query<{ id: string }>(`SELECT id FROM client WHERE id = $1 AND account_id = $2`, [id, payload.accountId]);
  if (!check.rows.length) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  const result = await query(
    `SELECT ucr.id, ucr.user_id, ucr.client_id, ucr.role, ucr.created_at, ucr.updated_at, u.email, u.full_name, u.avatar_url
     FROM user_client_role ucr JOIN "user" u ON u.id = ucr.user_id WHERE ucr.client_id = $1 ORDER BY ucr.created_at ASC`,
    [id]
  );
  return NextResponse.json({ success: true, data: result.rows.map((m: Record<string, unknown>) => ({
    id: m.id, userId: m.user_id, clientId: m.client_id, role: m.role,
    email: m.email, fullName: m.full_name, avatarUrl: m.avatar_url,
    createdAt: m.created_at, updatedAt: m.updated_at,
  })) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  let body: InviteMemberInput;
  try { body = InviteMemberSchema.parse(await req.json()); } catch { return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 }); }
  const { id } = await params;
  const check = await query<{ id: string }>(`SELECT id FROM client WHERE id = $1 AND account_id = $2`, [id, payload.accountId]);
  if (!check.rows.length) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  const userRes = await query<{ id: string; email: string; full_name: string; avatar_url: string | null }>(
    `SELECT id, email, full_name, avatar_url FROM "user" WHERE email = $1 AND account_id = $2`,
    [body.email, payload.accountId]
  );
  if (!userRes.rows.length) return NextResponse.json({ success: false, error: 'User not found in this account. They must register first.' }, { status: 404 });
  const user = userRes.rows[0];
  if (user.id === payload.sub) return NextResponse.json({ success: false, error: 'Cannot add yourself as a member' }, { status: 400 });
  const existing = await query(`SELECT id FROM user_client_role WHERE user_id = $1 AND client_id = $2`, [user.id, id]);
  if (existing.rows.length) return NextResponse.json({ success: false, error: 'User is already a member of this client' }, { status: 409 });
  const member = await query(
    `INSERT INTO user_client_role (user_id, client_id, role) VALUES ($1, $2, $3) RETURNING id, user_id, client_id, role, created_at, updated_at`,
    [user.id, id, body.role]
  );
  const m = member.rows[0];
  return NextResponse.json({ success: true, data: {
    id: m.id, userId: m.user_id, clientId: m.client_id, role: m.role,
    email: user.email, fullName: user.full_name, avatarUrl: user.avatar_url,
    createdAt: m.created_at, updatedAt: m.updated_at,
  } }, { status: 201 });
}
