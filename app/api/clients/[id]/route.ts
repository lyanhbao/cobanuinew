import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().optional(),
  country: z.string().length(2).optional(),
});

type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
interface JwtPayload { sub: string; accountId: string; }
interface DbClient { id: string; account_id: string; name: string; industry: string | null; country: string; is_active: boolean; created_at: string; updated_at: string; }

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = await query<DbClient>(`SELECT id, account_id, name, industry, country, is_active, created_at, updated_at FROM client WHERE id = $1 AND account_id = $2`, [id, payload.accountId]);
  const client = result.rows[0];
  if (!client) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: { id: client.id, accountId: client.account_id, name: client.name, industry: client.industry, country: client.country, isActive: client.is_active, createdAt: client.created_at, updatedAt: client.updated_at } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  let body: UpdateClientInput;
  try { body = UpdateClientSchema.parse(await req.json()); } catch { return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 }); }
  const { id } = await params;
  const check = await query<{ id: string }>(`SELECT id FROM client WHERE id = $1 AND account_id = $2 AND is_active = true`, [id, payload.accountId]);
  if (!check.rows.length) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  if (body.name) {
    const dup = await query<{ id: string }>(`SELECT id FROM client WHERE account_id = $1 AND name = $2 AND id != $3`, [payload.accountId, body.name, id]);
    if (dup.rows.length) return NextResponse.json({ success: false, error: 'Client with this name already exists' }, { status: 409 });
  }
  const fields: string[] = []; const values: unknown[] = []; let i = 1;
  if (body.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.name); }
  if (body.industry !== undefined) { fields.push(`industry = $${i++}`); values.push(body.industry); }
  if (body.country !== undefined) { fields.push(`country = $${i++}`); values.push(body.country); }
  if (!fields.length) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  values.push(id);
  const upd = await query<DbClient>(`UPDATE client SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, account_id, name, industry, country, is_active, created_at, updated_at`, values);
  const client = upd.rows[0];
  return NextResponse.json({ success: true, data: { id: client.id, accountId: client.account_id, name: client.name, industry: client.industry, country: client.country, isActive: client.is_active, createdAt: client.created_at, updatedAt: client.updated_at } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const result = await query(`UPDATE client SET is_active = false WHERE id = $1 AND account_id = $2`, [id, payload.accountId]);
  if (!result.rowCount) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: { id } });
}
