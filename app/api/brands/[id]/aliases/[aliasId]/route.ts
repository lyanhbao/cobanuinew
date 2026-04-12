import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';

interface JwtPayload {
  sub: string;
  accountId: string;
  role: string;
}

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aliasId: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Only platform_admin can delete aliases
  if (payload.role !== 'platform_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id, aliasId } = await params;

  // Verify alias belongs to this brand
  const aliasResult = await query<{ id: string }>(
    `SELECT id FROM brand_alias WHERE id = $1 AND curated_brand_id = $2`,
    [aliasId, id]
  );

  if (aliasResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Alias not found' }, { status: 404 });
  }

  await query(`DELETE FROM brand_alias WHERE id = $1`, [aliasId]);

  return NextResponse.json({ success: true, data: { id: aliasId } });
}
