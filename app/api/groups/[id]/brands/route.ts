import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const AddBrandSchema = z.object({
  curated_brand_id: z.string().uuid(),
  is_primary: z.boolean().optional().default(false),
});

type AddBrandInput = z.infer<typeof AddBrandSchema>;

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
  id: string;
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const clientId = await getGroupClientId(id, payload.accountId);
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
  }

  const brandsResult = await query<DbBrand & DbCuratedBrand>(
    `SELECT b.id, b.curated_brand_id, b.group_id, b.is_primary, b.source, b.crawl_status, b.created_at,
            cb.name, cb.slug, cb.advertiser, cb.categories, cb.status
     FROM brand b
     JOIN curated_brand cb ON cb.id = b.curated_brand_id
     WHERE b.group_id = $1
     ORDER BY b.is_primary DESC, b.created_at ASC`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: brandsResult.rows.map((b) => ({
      id: b.id,
      curatedBrandId: b.curated_brand_id,
      groupId: b.group_id,
      isPrimary: b.is_primary,
      source: b.source,
      crawlStatus: b.crawl_status,
      brandName: b.name,
      brandSlug: b.slug,
      advertiser: b.advertiser,
      categories: b.categories,
      status: b.status,
      createdAt: b.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: AddBrandInput;
  try {
    body = AddBrandSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id } = await params;

  const clientId = await getGroupClientId(id, payload.accountId);
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
  }

  // Verify curated brand exists
  const cbResult = await query<DbCuratedBrand>(
    `SELECT id, name, slug, advertiser, categories, status FROM curated_brand WHERE id = $1`,
    [body.curated_brand_id]
  );
  if (cbResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Curated brand not found' }, { status: 404 });
  }

  // Check if brand already added to this group
  const existingBrand = await query<{ id: string }>(
    `SELECT id FROM brand WHERE group_id = $1 AND curated_brand_id = $2`,
    [id, body.curated_brand_id]
  );
  if (existingBrand.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Brand already exists in this group' },
      { status: 409 }
    );
  }

  // If setting as primary, unset other primaries first
  if (body.is_primary) {
    await query(`UPDATE brand SET is_primary = false WHERE group_id = $1`, [id]);
  }

  const result = await query<DbBrand>(
    `INSERT INTO brand (curated_brand_id, group_id, is_primary, source)
     VALUES ($1, $2, $3, 'curated')
     RETURNING id, curated_brand_id, group_id, is_primary, source, crawl_status, created_at`,
    [body.curated_brand_id, id, body.is_primary]
  );

  const brand = result.rows[0];
  const cb = cbResult.rows[0];

  return NextResponse.json(
    {
      success: true,
      data: {
        id: brand.id,
        curatedBrandId: brand.curated_brand_id,
        groupId: brand.group_id,
        isPrimary: brand.is_primary,
        source: brand.source,
        crawlStatus: brand.crawl_status,
        brandName: cb.name,
        brandSlug: cb.slug,
        advertiser: cb.advertiser,
        categories: cb.categories,
        status: cb.status,
        createdAt: brand.created_at,
      },
    },
    { status: 201 }
  );
}
