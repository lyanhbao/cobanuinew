import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { query } from '@/lib/db';
import { z } from 'zod';

const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const categoryResult = await query<DbCategory>(
    `SELECT id, parent_id, name, slug, sort_order, created_at
     FROM category
     WHERE id = $1`,
    [id]
  );

  const category = categoryResult.rows[0];
  if (!category) {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }

  // Fetch direct children
  const childrenResult = await query<DbCategory>(
    `SELECT id, parent_id, name, slug, sort_order, created_at
     FROM category
     WHERE parent_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: {
      id: category.id,
      parentId: category.parent_id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sort_order,
      createdAt: category.created_at,
      children: childrenResult.rows.map((c) => ({
        id: c.id,
        parentId: c.parent_id,
        name: c.name,
        slug: c.slug,
        sortOrder: c.sort_order,
        createdAt: c.created_at,
      })),
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

  if (payload.role !== 'platform_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: UpdateCategoryInput;
  try {
    body = UpdateCategorySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { id } = await params;

  // Verify category exists
  const existing = await query<DbCategory>(
    `SELECT id, parent_id, name, slug, sort_order, created_at FROM category WHERE id = $1`,
    [id]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }

  // Prevent setting self as parent (cyclic reference)
  if (body.parentId !== undefined && body.parentId === id) {
    return NextResponse.json(
      { success: false, error: 'A category cannot be its own parent' },
      { status: 400 }
    );
  }

  // Verify parent exists if changing
  if (body.parentId) {
    const parentCheck = await query<{ id: string }>(
      `SELECT id FROM category WHERE id = $1`,
      [body.parentId]
    );
    if (parentCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Parent category not found' }, { status: 404 });
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (body.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(body.name);
  }
  if (body.parentId !== undefined) {
    fields.push(`parent_id = $${paramIndex++}`);
    values.push(body.parentId);
  }
  if (body.sortOrder !== undefined) {
    fields.push(`sort_order = $${paramIndex++}`);
    values.push(body.sortOrder);
  }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(id);
  const result = await query<DbCategory>(
    `UPDATE category SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, parent_id, name, slug, sort_order, created_at`,
    values
  );

  const cat = result.rows[0];

  // Fetch children
  const childrenResult = await query<DbCategory>(
    `SELECT id, parent_id, name, slug, sort_order, created_at
     FROM category
     WHERE parent_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: {
      id: cat.id,
      parentId: cat.parent_id,
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sort_order,
      createdAt: cat.created_at,
      children: childrenResult.rows.map((c) => ({
        id: c.id,
        parentId: c.parent_id,
        name: c.name,
        slug: c.slug,
        sortOrder: c.sort_order,
        createdAt: c.created_at,
      })),
    },
  });
}
