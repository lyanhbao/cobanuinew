import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const UpdateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  advertiser: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  socialHandles: z.record(z.string()).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
  role: string;
}

interface DbCuratedBrand {
  id: string;
  name: string;
  slug: string;
  advertiser: string | null;
  categories: string[];
  social_handles: Record<string, string>;
  status: string;
  created_at: string;
  updated_at: string;
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

  const brandResult = await query<DbCuratedBrand>(
    `SELECT id, name, slug, advertiser, categories, social_handles, status, created_at, updated_at
     FROM curated_brand
     WHERE id = $1`,
    [id]
  );

  const brand = brandResult.rows[0];
  if (!brand) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  // Get alias count
  const aliasCountResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text FROM brand_alias WHERE curated_brand_id = $1`,
    [id]
  );

  // Get how many groups this brand is tracked in
  const trackingCountResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text FROM brand WHERE curated_brand_id = $1`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      advertiser: brand.advertiser,
      categories: brand.categories,
      socialHandles: brand.social_handles,
      status: brand.status,
      createdAt: brand.created_at,
      updatedAt: brand.updated_at,
      aliasesCount: parseInt(aliasCountResult.rows[0].count, 10),
      trackingCount: parseInt(trackingCountResult.rows[0].count, 10),
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Only platform_admin can update curated brands
  if (payload.role !== 'platform_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: UpdateBrandInput;
  try {
    body = UpdateBrandSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id } = await params;

  // Verify brand exists
  const existing = await query<{ id: string }>(
    `SELECT id FROM curated_brand WHERE id = $1`,
    [id]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  // Check name uniqueness if changing
  if (body.name) {
    const dup = await query<{ id: string }>(
      `SELECT id FROM curated_brand WHERE name = $1 AND id != $2`,
      [body.name, id]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A brand with this name already exists' },
        { status: 409 }
      );
    }
  }

  // Check slug uniqueness if changing
  if (body.slug) {
    const dup = await query<{ id: string }>(
      `SELECT id FROM curated_brand WHERE slug = $1 AND id != $2`,
      [body.slug, id]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A brand with this slug already exists' },
        { status: 409 }
      );
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (body.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(body.name);
  }
  if (body.slug !== undefined) {
    fields.push(`slug = $${paramIndex++}`);
    values.push(body.slug);
  }
  if (body.advertiser !== undefined) {
    fields.push(`advertiser = $${paramIndex++}`);
    values.push(body.advertiser);
  }
  if (body.categories !== undefined) {
    fields.push(`categories = $${paramIndex++}`);
    values.push(body.categories);
  }
  if (body.socialHandles !== undefined) {
    fields.push(`social_handles = $${paramIndex++}`);
    values.push(body.socialHandles);
  }
  if (body.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(body.status);
  }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(id);
  const result = await query<DbCuratedBrand>(
    `UPDATE curated_brand SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, name, slug, advertiser, categories, social_handles, status, created_at, updated_at`,
    values
  );

  const brand = result.rows[0];
  return NextResponse.json({
    success: true,
    data: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      advertiser: brand.advertiser,
      categories: brand.categories,
      socialHandles: brand.social_handles,
      status: brand.status,
      createdAt: brand.created_at,
      updatedAt: brand.updated_at,
    },
  });
}
