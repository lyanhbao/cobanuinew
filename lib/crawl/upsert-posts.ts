/**
 * Upsert Posts to DB — COBAN Pipeline
 *
 * Đọc raw crawl results → transform → upsert vào PostgreSQL.
 * Tự động map profile → curated_brand_id (bằng brand_handles).
 *
 * Usage:
 *   npx ts-node lib/crawl/upsert-posts.ts
 *   npx ts-node lib/crawl/upsert-posts.ts --input recrawl-results.json
 *   npx ts-node lib/crawl/upsert-posts.ts --dry-run
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { query, transaction } from '../db';
import type { PoolClient } from 'pg';
import { toWeekStart, isoWeekNumber, isoYear } from '../week-format';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnrichedPost {
  post_id: string;
  platform: 'tiktok';
  profile: string;
  profile_id: string;
  content: string;
  posted_at: string;
  week_start: string;
  week_number: number;
  year: number;
  views: number;
  reactions: number;
  comments: number;
  shares: number;
  link: string;
  external_links: string[];
  source_hashtag?: string;
  campaign_type?: string;
  post_type?: 'ad' | 'seeding' | 'unknown';
  campaign_name?: string;
  raw?: unknown;
}

interface UpsertResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ─── Brand handle → curated_brand mapping ─────────────────────────────────────

interface BrandMapping {
  curated_brand_id: string;
  brand_name: string;
  handles: string[]; // TikTok handles for this brand
  is_primary: boolean;
}

// Fallback: static mapping (nên load từ DB trong production)
const BRAND_MAP: BrandMapping[] = [
  { curated_brand_id: '', brand_name: 'Tiger', handles: ['tigerbeervietnam', 'tigerbeer'], is_primary: true },
  { curated_brand_id: '', brand_name: 'Heineken', handles: ['heinekenvietnam', 'heineken_vn'], is_primary: false },
  { curated_brand_id: '', brand_name: 'Saigon', handles: ['saigonbeer_official', 'saigonbeer'], is_primary: false },
  { curated_brand_id: '', brand_name: 'Larue', handles: ['laruebeer'], is_primary: false },
  { curated_brand_id: '', brand_name: 'Budweiser', handles: ['budweiser_vn', 'budweiser'], is_primary: false },
];

// ─── Map profile → curated_brand_id ───────────────────────────────────────────

async function loadBrandMap(): Promise<BrandMapping[]> {
  try {
    const result = await query<{
      curated_brand_id: string;
      brand_name: string;
      is_primary: boolean;
      tiktok: string | null;
    }>(`
      SELECT
        cb.id AS curated_brand_id,
        cb.name AS brand_name,
        b.is_primary,
        (cb.social_handles->>'tiktok') AS tiktok
      FROM curated_brand cb
      JOIN brand b ON b.curated_brand_id = cb.id
      JOIN "group" g ON g.id = b.group_id
      WHERE g.is_active = true
        AND cb.social_handles ? 'tiktok'
    `);

    return result.rows.map(r => ({
      curated_brand_id: r.curated_brand_id,
      brand_name: r.brand_name,
      handles: r.tiktok ? [r.tiktok.replace('@', '').toLowerCase()] : [],
      is_primary: r.is_primary,
    }));
  } catch {
    // Fallback to static map
    return BRAND_MAP;
  }
}

function matchBrand(profile: string, brandMap: BrandMapping[]): string | null {
  const p = profile.toLowerCase().replace('@', '');

  for (const brand of brandMap) {
    for (const handle of brand.handles) {
      if (p.includes(handle) || handle.includes(p)) {
        return brand.curated_brand_id;
      }
    }
  }

  // Fuzzy match by brand name
  for (const brand of brandMap) {
    const nameParts = brand.brand_name.toLowerCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 3 && p.includes(part)) {
        return brand.curated_brand_id;
      }
    }
  }

  return null;
}

// ─── Transform post → DB row ────────────────────────────────────────────────

function transformPost(
  post: EnrichedPost,
  curatedBrandId: string | null,
): {
  curated_brand_id: string;
  platform: string;
  post_id: string;
  profile: string | null;
  content: string | null;
  posted_at: Date;
  week_start: string;
  week_number: number;
  year: number;
  views: bigint;
  impressions: bigint;
  reactions: bigint;
  comments: bigint;
  shares: bigint;
  link: string | null;
  post_type: string | null;
  campaign_name: string | null;
} | null {
  if (!curatedBrandId) return null;

  const postedAt = new Date(post.posted_at);
  const weekStartStr = toWeekStart(postedAt);
  const weekNum = isoWeekNumber(postedAt);
  const yearNum = isoYear(postedAt);

  return {
    curated_brand_id: curatedBrandId,
    platform: 'tiktok',
    post_id: post.post_id,
    profile: post.profile,
    content: post.content,
    posted_at: postedAt,
    week_start: weekStartStr,
    week_number: weekNum,
    year: yearNum,
    views: BigInt(post.views),
    impressions: BigInt(post.views), // TikTok: impressions ≈ views
    reactions: BigInt(post.reactions),
    comments: BigInt(post.comments),
    shares: BigInt(post.shares),
    link: post.link,
    post_type: post.post_type || null,
    campaign_name: post.campaign_type || null,
  };
}

// ─── Upsert core ─────────────────────────────────────────────────────────────

async function upsertPostsToDb(
  posts: EnrichedPost[],
  dryRun = false,
): Promise<UpsertResult> {
  const brandMap = await loadBrandMap();
  const result: UpsertResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  console.log(`[*] Mapping ${posts.length} posts to brands...`);

  const rows = posts
    .map(p => ({ post: p, brandId: matchBrand(p.profile || '', brandMap) }))
    .filter(x => x.brandId !== null)
    .map(x => ({ post: x.post, brandId: x.brandId! }));

  if (rows.length === 0) {
    console.warn('[!] No posts matched any brand. Check BRAND_HANDLES mapping.');
    return result;
  }

  console.log(`[+] Matched ${rows.length}/${posts.length} posts to brands`);
  console.log(`[*] ${dryRun ? '[DRY RUN] ' : ''}Upserting to DB...`);

  if (dryRun) {
    result.skipped = rows.length;
    return result;
  }

  await transaction(async (client: PoolClient) => {
    for (const { post, brandId } of rows) {
      const row = transformPost(post, brandId);
      if (!row) { result.skipped++; continue; }

      try {
        const r = await client.query<{ id: string }>(`
          INSERT INTO post (
            curated_brand_id, platform, post_id, profile, content,
            posted_at, week_start, week_number, year,
            views, impressions, reactions, comments, shares, link,
            post_type, campaign_name
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (platform, post_id) DO UPDATE SET
            profile       = EXCLUDED.profile,
            content       = EXCLUDED.content,
            views         = EXCLUDED.views,
            impressions   = EXCLUDED.impressions,
            reactions     = EXCLUDED.reactions,
            comments      = EXCLUDED.comments,
            shares        = EXCLUDED.shares,
            link          = EXCLUDED.link,
            post_type     = COALESCE(EXCLUDED.post_type, post_type),
            campaign_name = COALESCE(EXCLUDED.campaign_name, campaign_name),
            updated_at    = NOW()
          RETURNING id
        `, [
          row.curated_brand_id, row.platform, row.post_id,
          row.profile, row.content,
          row.posted_at, row.week_start, row.week_number, row.year,
          row.views, row.impressions, row.reactions, row.comments, row.shares, row.link,
          row.post_type, row.campaign_name,
        ]);
        void r;
        result.created++;
      } catch (e) {
        result.errors.push(`${post.post_id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  });

  return result;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Upsert Posts to DB — COBAN Pipeline
Usage:
  npx ts-node lib/crawl/upsert-posts.ts
  npx ts-node lib/crawl/upsert-posts.ts --input recrawl-results.json
  npx ts-node lib/crawl/upsert-posts.ts --dry-run
`);
    return;
  }

  const inputFile = args.find(a => a.startsWith('--input='))?.split('=')[1]
    || 'recrawl-results.json';
  const dryRun = args.includes('--dry-run');

  const inputPath = join(process.cwd(), inputFile);

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Upsert Posts to DB — COBAN         ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`[*] Input:  ${inputPath}`);
  console.log(`[*] Mode:   ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}\n`);

  // Load input
  let posts: EnrichedPost[];
  try {
    const raw = readFileSync(inputPath, 'utf8');
    posts = JSON.parse(raw);
  } catch {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`[*] Loaded ${posts.length} posts`);

  // Load brand map
  const brandMap = await loadBrandMap();
  console.log(`[*] Brand map: ${brandMap.length} brands`);

  // Run upsert
  const result = await upsertPostsToDb(posts, dryRun);

  console.log('\n═══ Results ════════════════════════════');
  console.log(`  Created:  ${result.created}`);
  console.log(`  Updated:  ${result.updated}`);
  console.log(`  Skipped:  ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`  Errors:   ${result.errors.length}`);
    result.errors.slice(0, 5).forEach(e => console.log(`    → ${e}`));
  }

  if (result.created > 0 || result.updated > 0) {
    console.log(`\n[+] ✅ Successfully upserted ${result.created + result.updated} posts!`);
  }
}

main().catch(err => {
  console.error('[UNCAUGHT]', err);
  process.exit(1);
});