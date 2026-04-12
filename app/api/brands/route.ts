import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const SearchBrandsSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateCuratedBrandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  advertiser: z.string().optional(),
  categories: z.array(z.string()).optional(),
  socialHandles: z.record(z.string()).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

type SearchBrandsInput = z.infer<typeof SearchBrandsSchema>;
type CreateCuratedBrandInput = z.infer<typeof CreateCuratedBrandSchema>;

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

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  let parsed: SearchBrandsInput;
  try {
    parsed = SearchBrandsSchema.parse({
      q: url.searchParams.get('q') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      page: url.searchParams.get('page') ?? 1,
      limit: url.searchParams.get('limit') ?? 20,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid query parameters' }, { status: 400 });
  }

  const { q, status, page, limit } = parsed;
  const offset = (page - 1) * limit;

  if (q && q.length > 0) {
    // Fuzzy search using GIN trigram similarity
    const searchResult = await query<DbCuratedBrand & { similarity: number }>(
      `SELECT cb.*, similarity(cb.name, $2) AS sim
       FROM curated_brand cb
       WHERE cb.name % $2
         AND ($3::text IS NULL OR cb.status = $3)
       ORDER BY sim DESC, cb.name ASC
       LIMIT $4 OFFSET $5`,
      [makeSlug(q), q, status ?? null, limit, offset]
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text FROM curated_brand cb WHERE cb.name % $1 AND ($2::text IS NULL OR cb.status = $2)`,
      [makeSlug(q), status ?? null]
    );

    return NextResponse.json({
      success: true,
      data: searchResult.rows.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        advertiser: b.advertiser,
        categories: b.categories,
        socialHandles: b.social_handles,
        status: b.status,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      })),
      meta: {
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit,
      },
    });
  }

  // No search query — return all with optional status filter
  let sql = 'SELECT * FROM curated_brand';
  const params: unknown[] = [];
  if (status) {
    sql += ' WHERE status = $1';
    params.push(status);
  }
  sql += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const [brandsResult, countResult] = await Promise.all([
    query<DbCuratedBrand>(sql, params),
    query<{ count: string }>(
      `SELECT COUNT(*)::text FROM curated_brand ${status ? 'WHERE status = $1' : ''}`,
      status ? [status] : []
    ),
  ]);

  return NextResponse.json({
    success: true,
    data: brandsResult.rows.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      advertiser: b.advertiser,
      categories: b.categories,
      socialHandles: b.social_handles,
      status: b.status,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    })),
    meta: {
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    },
  });
}

export async function POST(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Only platform_admin can create curated brands
  if (payload.role !== 'platform_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: CreateCuratedBrandInput;
  try {
    body = CreateCuratedBrandSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const slug = body.slug ?? makeSlug(body.name);

  // Check name uniqueness
  const nameDup = await query<{ id: string }>(
    `SELECT id FROM curated_brand WHERE name = $1`,
    [body.name]
  );
  if (nameDup.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'A brand with this name already exists' },
      { status: 409 }
    );
  }

  // Check slug uniqueness
  const slugDup = await query<{ id: string }>(
    `SELECT id FROM curated_brand WHERE slug = $1`,
    [slug]
  );
  if (slugDup.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'A brand with this slug already exists' },
      { status: 409 }
    );
  }

  const result = await query<DbCuratedBrand>(
    `INSERT INTO curated_brand (name, slug, advertiser, categories, social_handles, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      body.name,
      slug,
      body.advertiser ?? null,
      body.categories ?? [],
      body.socialHandles ?? {},
      body.status,
    ]
  );

  const brand = result.rows[0];
  return NextResponse.json(
    {
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
    },
    { status: 201 }
  );
}
