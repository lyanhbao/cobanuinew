import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const SearchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

type SearchInput = z.infer<typeof SearchSchema>;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));

  if (q.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const result = await query(
      `SELECT cb.id, cb.name, cb.slug, cb.advertiser, cb.categories, cb.social_handles, cb.status, cb.created_at, cb.updated_at,
              similarity(cb.name, $1) AS sim
       FROM curated_brand cb
       WHERE cb.name % $1 OR cb.name ILIKE '%' || $1 || '%'
       ORDER BY sim DESC, cb.name ASC
       LIMIT $2`,
      [q, limit]
    );

    return NextResponse.json({
      success: true,
      data: result.rows.map((b) => ({
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
    });
  } catch (err) {
    // If pg_trgm is not available, fall back to ILIKE search
    try {
      const fallback = await query(
        `SELECT cb.id, cb.name, cb.slug, cb.advertiser, cb.categories, cb.social_handles, cb.status, cb.created_at, cb.updated_at
         FROM curated_brand cb
         WHERE cb.name ILIKE '%' || $1 || '%'
         ORDER BY cb.name ASC
         LIMIT $2`,
        [q, limit]
      );
      return NextResponse.json({
        success: true,
        data: fallback.rows.map((b) => ({
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
      });
    } catch {
      return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
    }
  }
}
