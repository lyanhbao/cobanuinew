import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const UpdateMemberRoleSchema = z.object({ role: z.enum(['admin', 'analyst', 'viewer']) });
type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

interface JwtPayload { sub: string; accountId: string; }

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  let body: UpdateMemberRoleInput;
  try { body = UpdateMemberRoleSchema.parse(await req.json()); } catch { return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 }); }
  const { id, userId } = await params;
  const check = await query<{ id: string }>(`SELECT id FROM client WHERE id = $1 AND account_id = $2`, [id, payload.accountId]);
  if (!check.rows.length) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  const result = await query(
    `UPDATE user_client_role SET role = $1 WHERE user_id = $2 AND client_id = $3 RETURNING id, user_id, client_id, role, created_at, updated_at`,
    [body.role, userId, id]
  );
  if (!result.rowCount) return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
  const m = result.rows[0];
  const user = await query<{ email: string; full_name: string; avatar_url: string | null }>(`SELECT email, full_name, avatar_url FROM "user" WHERE id = $1`, [userId]);
  const u = user.rows[0];
  return NextResponse.json({ success: true, data: {
    id: m.id, userId: m.user_id, clientId: m.client_id, role: m.role,
    email: u?.email ?? null, fullName: u?.full_name ?? null, avatarUrl: u?.avatar_url ?? null,
    createdAt: m.created_at, updatedAt: m.updated_at,
  } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id, userId } = await params;
  const check = await query<{ id: string }>(`SELECT id FROM client WHERE id = $1 AND account_id = $2`, [id, payload.accountId]);
  if (!check.rows.length) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  if (userId === payload.sub) return NextResponse.json({ success: false, error: 'Cannot remove yourself' }, { status: 400 });
  const result = await query(`DELETE FROM user_client_role WHERE user_id = $1 AND client_id = $2`, [userId, id]);
  if (!result.rowCount) return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: { userId } });
}
