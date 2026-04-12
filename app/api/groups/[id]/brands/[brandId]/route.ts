import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const UpdateBrandSchema = z.object({
  isPrimary: z.boolean().optional(),
  crawlSource: z.enum(['csv', 'api', 'manual']).optional(),
});

type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
}

interface DbBrand {
  id: string;
  curated_brand_id: string;
  group_id: string;
  is_primary: boolean;
  source: string;
  crawl_status: string;
  created_at: string;
}

interface DbCuratedBrand {
  name: string;
  slug: string;
  advertiser: string | null;
  categories: string[];
  status: string;
}

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

async function getGroupClientId(groupId: string, accountId: string): Promise<string | null> {
  const result = await query<{ client_id: string }>(
    `SELECT g.client_id
     FROM "group" g
     JOIN client c ON c.id = g.client_id
     WHERE g.id = $1 AND c.account_id = $2`,
    [groupId, accountId]
  );
  return result.rows[0]?.client_id ?? null;
}

async function verifyBrandInGroup(
  brandId: string,
  groupId: string,
  accountId: string
): Promise<DbBrand | null> {
  const result = await query<DbBrand>(
    `SELECT b.id, b.curated_brand_id, b.group_id, b.is_primary, b.source, b.crawl_status, b.created_at
     FROM brand b
     JOIN "group" g ON g.id = b.group_id
     JOIN client c ON c.id = g.client_id
     WHERE b.id = $1 AND b.group_id = $2 AND c.account_id = $3`,
    [brandId, groupId, accountId]
  );
  return result.rows[0] ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; brandId: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, brandId } = await params;

  const brand = await verifyBrandInGroup(brandId, id, payload.accountId);
  if (!brand) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  const cbResult = await query<DbCuratedBrand>(
    `SELECT name, slug, advertiser, categories, status FROM curated_brand WHERE id = $1`,
    [brand.curated_brand_id]
  );
  const cb = cbResult.rows[0];

  return NextResponse.json({
    success: true,
    data: {
      id: brand.id,
      curatedBrandId: brand.curated_brand_id,
      groupId: brand.group_id,
      isPrimary: brand.is_primary,
      source: brand.source,
      crawlStatus: brand.crawl_status,
      brandName: cb?.name ?? null,
      brandSlug: cb?.slug ?? null,
      advertiser: cb?.advertiser ?? null,
      categories: cb?.categories ?? [],
      status: cb?.status ?? null,
      createdAt: brand.created_at,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; brandId: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: UpdateBrandInput;
  try {
    body = UpdateBrandSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id, brandId } = await params;

  const brand = await verifyBrandInGroup(brandId, id, payload.accountId);
  if (!brand) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  // If setting as primary, unset other primaries first
  if (body.isPrimary === true) {
    await query(`UPDATE brand SET is_primary = false WHERE group_id = $1 AND id != $2`, [id, brandId]);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (body.isPrimary !== undefined) {
    fields.push(`is_primary = $${paramIndex++}`);
    values.push(body.isPrimary);
  }
  if (body.crawlSource !== undefined) {
    fields.push(`source = $${paramIndex++}`);
    values.push(body.crawlSource);
  }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(brandId);
  const result = await query<DbBrand>(
    `UPDATE brand SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, curated_brand_id, group_id, is_primary, source, crawl_status, created_at`,
    values
  );

  const updated = result.rows[0];
  const cbResult = await query<DbCuratedBrand>(
    `SELECT name, slug, advertiser, categories, status FROM curated_brand WHERE id = $1`,
    [updated.curated_brand_id]
  );
  const cb = cbResult.rows[0];

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      curatedBrandId: updated.curated_brand_id,
      groupId: updated.group_id,
      isPrimary: updated.is_primary,
      source: updated.source,
      crawlStatus: updated.crawl_status,
      brandName: cb?.name ?? null,
      brandSlug: cb?.slug ?? null,
      advertiser: cb?.advertiser ?? null,
      categories: cb?.categories ?? [],
      status: cb?.status ?? null,
      createdAt: updated.created_at,
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; brandId: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, brandId } = await params;

  const brand = await verifyBrandInGroup(brandId, id, payload.accountId);
  if (!brand) {
    return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
  }

  await query(`DELETE FROM brand WHERE id = $1`, [brandId]);

  return NextResponse.json({ success: true, data: { id: brandId } });
}
