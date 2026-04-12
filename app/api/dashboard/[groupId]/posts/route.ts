/**
 * GET /api/dashboard/[groupId]/posts
 * Paginated post list with filters: platform, brand, week_start.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../../lib/db';
import { z } from 'zod';
import { Platform } from '../../../../../lib/types';
import { verifyJwt } from '../../../../../lib/auth';

const listSchema = z.object({
  groupId: z.string().uuid(),
  platform: z.enum(['youtube', 'facebook', 'tiktok']).optional(),
  brandId: z.string().uuid().optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.string().optional(),
  sortBy: z.enum(['impressions', 'views', 'reactions', 'posted_at']).default('impressions'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

function authUser(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
): Promise<NextResponse> {
  const payload = authUser(req);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listSchema.safeParse({
      groupId: (await params).groupId,
      ...searchParams,
    });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const { groupId, platform, brandId, weekStart, format, sortBy, order, limit, offset } =
      parsed.data;

    // Verify group belongs to account
    const groupCheck = await query<{ id: string }>(
      `SELECT g.id FROM "group" g JOIN client c ON c.id = g.client_id WHERE g.id = $1 AND c.account_id = $2`,
      [groupId, payload.accountId],
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    const conditions: string[] = ['b.group_id = $1'];
    const paramsArr: unknown[] = [groupId];
    let pIdx = 2;

    if (platform) {
      conditions.push(`p.platform = $${pIdx++}`);
      paramsArr.push(platform as Platform);
    }
    if (brandId) {
      conditions.push(`b.id = $${pIdx++}`);
      paramsArr.push(brandId);
    }
    if (weekStart) {
      conditions.push(`p.week_start = $${pIdx++}::date`);
      paramsArr.push(weekStart);
    }
    if (format) {
      conditions.push(`p.format = $${pIdx++}`);
      paramsArr.push(format);
    }

    const orderMap: Record<string, string> = {
      impressions: 'p.impressions',
      views: 'p.views',
      reactions: 'p.reactions',
      posted_at: 'p.posted_at',
    };
    const orderClause = `ORDER BY ${orderMap[sortBy] ?? 'p.impressions'} ${order.toUpperCase()}`;

    // FIX: removed non-existent columns `comments` and `shares` from post table.
    const dataResult = await query<{
      id: string;
      platform: Platform;
      content: string | null;
      posted_at: string;
      week_start: string;
      impressions: string;
      views: string;
      reactions: string;
      format: string | null;
      link: string | null;
      brand_name: string;
      brand_id: string;
    }>(
      `SELECT p.id, p.platform, p.content, p.posted_at, p.week_start,
              p.impressions, p.views, p.reactions,
              p.format, p.link, cb.name AS brand_name, b.id AS brand_id
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       JOIN curated_brand cb ON cb.id = b.curated_brand_id
       WHERE ${conditions.join(' AND ')}
       ${orderClause}
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...paramsArr, limit, offset],
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM post p
       JOIN brand b ON b.curated_brand_id = p.curated_brand_id
       WHERE ${conditions.join(' AND ')}`,
      paramsArr,
    );

    return NextResponse.json({
      success: true,
      data: {
        posts: dataResult.rows.map((r) => ({
          id: r.id,
          platform: r.platform,
          content: r.content,
          posted_at: r.posted_at,
          week_start: r.week_start,
          impressions: Number(r.impressions),
          views: Number(r.views),
          reactions: Number(r.reactions),
          format: r.format,
          link: r.link,
          brand_name: r.brand_name,
          brand_id: r.brand_id,
        })),
        total: parseInt(countResult.rows[0]?.count ?? '0', 10),
        limit,
        offset,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load posts';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
