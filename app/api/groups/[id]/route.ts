import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const UpdateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  benchmarkCategoryId: z.string().uuid().nullable().optional(),
});

type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
}

interface DbGroup {
  id: string;
  client_id: string;
  name: string;
  benchmark_category_id: string | null;
  crawl_status: string;
  created_at: string;
  updated_at: string;
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

function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const groupResult = await query<DbGroup>(
    `SELECT g.id, g.client_id, g.name, g.benchmark_category_id, g.crawl_status, g.created_at, g.updated_at
     FROM "group" g
     JOIN client c ON c.id = g.client_id
     WHERE g.id = $1 AND c.account_id = $2`,
    [id, payload.accountId]
  );

  const group = groupResult.rows[0];
  if (!group) {
    return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
  }

  const brandsResult = await query<DbBrand>(
    `SELECT id, curated_brand_id, group_id, is_primary, source, crawl_status, created_at
     FROM brand
     WHERE group_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [id]
  );

  const brandsWithDetails = await Promise.all(
    brandsResult.rows.map(async (b) => {
      const cbResult = await query<{ name: string; slug: string; advertiser: string | null; categories: string[] }>(
        `SELECT name, slug, advertiser, categories FROM curated_brand WHERE id = $1`,
        [b.curated_brand_id]
      );
      const cb = cbResult.rows[0];
      return {
        id: b.id,
        curatedBrandId: b.curated_brand_id,
        groupId: b.group_id,
        isPrimary: b.is_primary,
        source: b.source,
        crawlStatus: b.crawl_status,
        brandName: cb?.name ?? null,
        brandSlug: cb?.slug ?? null,
        advertiser: cb?.advertiser ?? null,
        categories: cb?.categories ?? [],
        createdAt: b.created_at,
      };
    })
  );

  return NextResponse.json({
    success: true,
    data: {
      id: group.id,
      clientId: group.client_id,
      name: group.name,
      benchmarkCategoryId: group.benchmark_category_id,
      crawlStatus: group.crawl_status,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      brands: brandsWithDetails,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: UpdateGroupInput;
  try {
    body = UpdateGroupSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id } = await params;

  // Verify group belongs to account
  const existing = await query<{ id: string; client_id: string }>(
    `SELECT g.id, g.client_id
     FROM "group" g
     JOIN client c ON c.id = g.client_id
     WHERE g.id = $1 AND c.account_id = $2`,
    [id, payload.accountId]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
  }

  // Check duplicate name if renaming
  if (body.name) {
    const dup = await query<{ id: string }>(
      `SELECT id FROM "group" WHERE client_id = $1 AND name = $2 AND id != $3`,
      [existing.rows[0].client_id, body.name, id]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Group with this name already exists in this client' },
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
  if (body.benchmarkCategoryId !== undefined) {
    fields.push(`benchmark_category_id = $${paramIndex++}`);
    values.push(body.benchmarkCategoryId);
  }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(id);
  const result = await query<DbGroup>(
    `UPDATE "group" SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, client_id, name, benchmark_category_id, crawl_status, created_at, updated_at`,
    values
  );

  const group = result.rows[0];
  return NextResponse.json({
    success: true,
    data: {
      id: group.id,
      clientId: group.client_id,
      name: group.name,
      benchmarkCategoryId: group.benchmark_category_id,
      crawlStatus: group.crawl_status,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify group belongs to account
  const existing = await query<{ id: string }>(
    `SELECT g.id
     FROM "group" g
     JOIN client c ON c.id = g.client_id
     WHERE g.id = $1 AND c.account_id = $2`,
    [id, payload.accountId]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
  }

  await query(`DELETE FROM "group" WHERE id = $1`, [id]);

  return NextResponse.json({ success: true, data: { id } });
}
