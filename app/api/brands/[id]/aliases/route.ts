import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const AddAliasSchema = z.object({
  alias: z.string().min(1),
  aliasType: z.enum(['exact', 'fuzzy', 'advertiser']).default('exact'),
});

type AddAliasInput = z.infer<typeof AddAliasSchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
  role: string;
}

interface DbAlias {
  id: string;
  curated_brand_id: string;
  alias: string;
  alias_type: string;
  created_at: string;
}

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const brandResult = await query<{ id: string }>(
    `SELECT id FROM curated_brand WHERE id = $1`,
    [id]
  );
  if (brandResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  const result = await query<DbAlias>(
    `SELECT id, curated_brand_id, alias, alias_type, created_at
     FROM brand_alias
     WHERE curated_brand_id = $1
     ORDER BY alias ASC`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: result.rows.map((a) => ({
      id: a.id,
      curatedBrandId: a.curated_brand_id,
      alias: a.alias,
      aliasType: a.alias_type,
      createdAt: a.created_at,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Only platform_admin can manage aliases
  if (payload.role !== 'platform_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: AddAliasInput;
  try {
    body = AddAliasSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id } = await params;

  // Verify brand exists
  const brandResult = await query<{ id: string }>(
    `SELECT id FROM curated_brand WHERE id = $1`,
    [id]
  );
  if (brandResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  // Check alias uniqueness across all brands
  const dupResult = await query<{ id: string }>(
    `SELECT id FROM brand_alias WHERE alias = $1`,
    [body.alias]
  );
  if (dupResult.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'This alias is already in use' },
      { status: 409 }
    );
  }

  const result = await query<DbAlias>(
    `INSERT INTO brand_alias (curated_brand_id, alias, alias_type)
     VALUES ($1, $2, $3)
     RETURNING id, curated_brand_id, alias, alias_type, created_at`,
    [id, body.alias, body.aliasType]
  );

  const alias = result.rows[0];
  return NextResponse.json(
    {
      success: true,
      data: {
        id: alias.id,
        curatedBrandId: alias.curated_brand_id,
        alias: alias.alias,
        aliasType: alias.alias_type,
        createdAt: alias.created_at,
      },
    },
    { status: 201 }
  );
}
