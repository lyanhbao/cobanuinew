import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const CreateCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

interface JwtPayload {
  sub: string;
  accountId: string;
  role: string;
}

interface DbCategory {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
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

export async function GET() {
  // Public endpoint — no auth required for category tree
  const result = await query<DbCategory>(
    `SELECT id, parent_id, name, slug, sort_order, created_at
     FROM category
     ORDER BY sort_order ASC, name ASC`
  );

  // Build tree: parent → children
  const roots: DbCategory[] = [];
  const childrenMap = new Map<string, DbCategory[]>();

  for (const cat of result.rows) {
    if (!cat.parent_id) {
      roots.push(cat);
    } else {
      const existing = childrenMap.get(cat.parent_id) ?? [];
      existing.push(cat);
      childrenMap.set(cat.parent_id, existing);
    }
  }

  const tree = roots.map((root) => ({
    id: root.id,
    parentId: root.parent_id,
    name: root.name,
    slug: root.slug,
    sortOrder: root.sort_order,
    createdAt: root.created_at,
    children: (childrenMap.get(root.id) ?? []).map((child) => ({
      id: child.id,
      parentId: child.parent_id,
      name: child.name,
      slug: child.slug,
      sortOrder: child.sort_order,
      createdAt: child.created_at,
    })),
  }));

  return NextResponse.json({ success: true, data: tree });
}

export async function POST(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (payload.role !== 'platform_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: CreateCategoryInput;
  try {
    body = CreateCategorySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const slug = makeSlug(body.name);

  // Check slug uniqueness
  const slugDup = await query<{ id: string }>(
    `SELECT id FROM category WHERE slug = $1`,
    [slug]
  );
  if (slugDup.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'A category with this slug already exists' },
      { status: 409 }
    );
  }

  // Verify parent exists if provided
  if (body.parentId) {
    const parentCheck = await query<{ id: string }>(
      `SELECT id FROM category WHERE id = $1`,
      [body.parentId]
    );
    if (parentCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Parent category not found' }, { status: 404 });
    }
  }

  // Auto-assign sort order if not provided
  let sortOrder = body.sortOrder;
  if (!sortOrder) {
    const maxResult = await query<{ max_order: number | null }>(
      `SELECT MAX(sort_order) FROM category ${body.parentId ? 'WHERE parent_id = $1' : 'WHERE parent_id IS NULL'}`,
      body.parentId ? [body.parentId] : []
    );
    sortOrder = (maxResult.rows[0].max_order ?? 0) + 1;
  }

  const result = await query<DbCategory>(
    `INSERT INTO category (name, slug, parent_id, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, parent_id, name, slug, sort_order, created_at`,
    [body.name, slug, body.parentId ?? null, sortOrder]
  );

  const cat = result.rows[0];
  return NextResponse.json(
    {
      success: true,
      data: {
        id: cat.id,
        parentId: cat.parent_id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sort_order,
        createdAt: cat.created_at,
      },
    },
    { status: 201 }
  );
}
