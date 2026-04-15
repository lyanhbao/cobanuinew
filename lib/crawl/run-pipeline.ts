/**
 * Crawl Pipeline Runner — COBAN
 *
 * Entry point cho toàn bộ crawl pipeline.
 * Chạy: npx ts-node lib/crawl/run-pipeline.ts
 *
 * Pipeline: crawl brand pages → extract hashtags → map campaigns →
 *           recrawl hashtags → upsert posts → aggregate stats → notify
 *
 * Flow per brand:
 *   1. crawlProfile(handle)  → brand official posts (AD)
 *   2. crawlSearch(keyword) → seeding/UGC posts
 *   3. upsertPostsBatch()   → PostgreSQL
 *   4. aggregateWeeklyStats() → weekly_stats table
 */
import {
  getCrawlTargets,
  updateBrandCrawlStatus,
  aggregateWeeklyStats,
  computeGapPct,
  computeSOV,
  upsertPostsBatch,
  type PostUpsert,
} from './db';
import {
  crawlProfile,
  crawlSearch,
  BRAND_HANDLES,
  classifyPostType,
  type CrawledPost,
} from './tiktok-crawler';
import { getSession, verifyTikTokLogin } from './chrome-session';
import { toWeekStart, isoWeekNumber, isoYear } from '../week-format';
import { writeFileSync } from 'fs';
import { join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const PIPELINE_DATE = new Date();
const WEEK_START = toWeekStart(PIPELINE_DATE);
const WEEK_NUMBER = isoWeekNumber(PIPELINE_DATE);
const YEAR = isoYear(PIPELINE_DATE);
const YEAR_INT = PIPELINE_DATE.getFullYear();
const JAN_1 = `${YEAR_INT}-01-01`;

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts', 'crawl-logs', PIPELINE_DATE.toISOString().slice(0, 10));
const CAMPAIGN_BATCH_FILE = join(process.cwd(), 'agents', 'crawl', 'campaign-batch.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineLog {
  timestamp: string;
  step: string;
  message: string;
}

interface Step1Result {
  totalPosts: number;
  postsByBrand: Map<string, CrawledPost[]>;
}

// ─── Log helpers ─────────────────────────────────────────────────────────────

const logs: PipelineLog[] = [];

function log(step: string, message: string): void {
  const entry = { timestamp: new Date().toISOString(), step, message };
  logs.push(entry);
  console.log(`[${step}] ${message}`);
}

function saveLog(): void {
  try {
    writeFileSync(join(ARTIFACTS_DIR, 'run.log'), logs.map(l =>
      `[${l.timestamp}] [${l.step}] ${l.message}`
    ).join('\n'), 'utf8');
  } catch {
    // ignore
  }
}

// ─── Step 0: Verify Chrome ─────────────────────────────────────────────────────

async function step0_verifyChrome(): Promise<boolean> {
  log('CHROME', 'Đang kiểm tra Chrome session...');
  try {
    const session = await getSession();
    const result = await verifyTikTokLogin(session.page);

    if (!result.success) {
      log('CHROME', `❌ Chrome chưa login TikTok (${result.cookies} cookies): ${result.error}`);
      await session.browser.close();
      return false;
    }

    log('CHROME', `✅ Chrome đã login (${result.cookies} cookies)`);
    // Keep browser open — crawl functions reuse the same Chrome instance
    return true;
  } catch (err) {
    log('CHROME', `❌ Không kết nối được Chrome: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── Step 1: Crawl brand pages ───────────────────────────────────────────────

async function step1_crawlBrandPages(): Promise<Step1Result> {
  log('CRAWL', 'Bắt đầu crawl brand pages...');

  const targets = await getCrawlTargets();
  log('CRAWL', `Tìm thấy ${targets.length} targets (brand × platform)`);

  const postsByBrand = new Map<string, CrawledPost[]>();
  let totalPosts = 0;

  for (const target of targets) {
    const platformLabel = target.platform.toUpperCase();
    const handle = target.socialHandle ?? '';

    log('CRAWL', `  [${platformLabel}] ${target.curated.name} — handle: ${handle || '(none)'}`);

    // Update status → crawling
    await updateBrandCrawlStatus(target.brand.id, 'crawling').catch(() => {});

    try {
      if (target.platform === 'tiktok') {
        let posts: CrawledPost[] = [];

        if (handle) {
          // Brand profile: crawl via crawlProfile (official posts)
          const cleanHandle = handle.replace('@', '');
          posts = await crawlProfile(cleanHandle);
          log('CRAWL', `    → ${posts.length} posts from @${cleanHandle}`);
        } else {
          // No handle → crawl by brand name via search
          posts = await crawlSearch(target.curated.name);
          log('CRAWL', `    → ${posts.length} posts from search "${target.curated.name}"`);
        }

        // Classify AD vs SEEDING
        let adCount = 0;
        for (const p of posts) {
          p.post_type = classifyPostType(p, BRAND_HANDLES);
          if (p.post_type === 'ad') adCount++;
        }

        log('CRAWL', `    → ${posts.length} posts (${adCount} AD | ${posts.length - adCount} SEEDING)`);
        postsByBrand.set(target.curated.id, posts);
        totalPosts += posts.length;

        await updateBrandCrawlStatus(target.brand.id, 'ready').catch(() => {});
      }
      // Facebook, YouTube stubs — extend when available
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('CRAWL', `    ❌ Lỗi: ${msg}`);
      await updateBrandCrawlStatus(target.brand.id, 'error', msg).catch(() => {});
    }

    // Rate limit between brands
    await new Promise(r => setTimeout(r, 3000));
  }

  log('CRAWL', `✅ Hoàn thành: ${postsByBrand.size}/${targets.length} targets, ${totalPosts} total posts`);
  return { totalPosts, postsByBrand };
}

// ─── Step 2: Upsert posts to DB ───────────────────────────────────────────────

async function step2_upsertPosts(postsByBrand: Map<string, CrawledPost[]>): Promise<number> {
  log('UPSERT', 'Upserting posts to PostgreSQL...');

  const allUpserts: PostUpsert[] = [];

  for (const [curatedBrandId, posts] of postsByBrand) {
    for (const post of posts) {
      const postedAt = new Date(post.posted_at);
      allUpserts.push({
        curated_brand_id: curatedBrandId,
        platform: 'tiktok',
        post_id: post.post_id,
        profile: post.profile,
        content: post.content,
        posted_at: postedAt,
        week_start: post.week_start,
        week_number: post.week_number,
        year: post.year,
        views: post.views,
        impressions: post.views, // TikTok: impressions ≈ views
        reactions: post.reactions,
        comments: post.comments,
        shares: post.shares,
        link: post.link,
        post_type: post.post_type,
        campaign_name: post.campaign_name ?? null,
      });
    }
  }

  if (allUpserts.length === 0) {
    log('UPSERT', '⚠️  Không có posts để upsert');
    return 0;
  }

  log('UPSERT', `Upserting ${allUpserts.length} posts...`);
  const result = await upsertPostsBatch(allUpserts);
  log('UPSERT', `  → Created: ${result.created} | Updated: ${result.updated} | Errors: ${result.errors}`);

  return result.created + result.updated;
}

// ─── Step 3: Aggregate ───────────────────────────────────────────────────────

async function step3_aggregate(): Promise<void> {
  log('AGGREGATE', 'Đang tính weekly stats...');

  const { query } = await import('../db');
  const groupsResult = await query<{ id: string }>(`SELECT id FROM "group" WHERE is_active = true`);

  for (const row of groupsResult.rows) {
    await aggregateWeeklyStats(row.id, WEEK_START);
    await computeGapPct(row.id, WEEK_START);
    await computeSOV(row.id, WEEK_START);
    log('AGGREGATE', `  → Group ${row.id}: weekly stats computed`);
  }

  log('AGGREGATE', '✅ Aggregate hoàn tất');
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   COBAN Crawl Pipeline — ' + PIPELINE_DATE.toISOString().slice(0, 10) + '        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`[*] Week: ${WEEK_START} | W${WEEK_NUMBER}/${YEAR}\n`);

  const startTime = Date.now();

  try {
    // Step 0: Chrome
    const chromeOk = await step0_verifyChrome();
    if (!chromeOk) {
      log('ERROR', 'Chrome không sẵn sàng. Dừng pipeline.');
      saveLog();
      process.exit(1);
    }

    // Step 1: Crawl
    const { totalPosts, postsByBrand } = await step1_crawlBrandPages();

    // Step 2: Upsert to DB
    const upserted = await step2_upsertPosts(postsByBrand);

    // Step 3: Aggregate
    await step3_aggregate();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log('DONE', `✅ Pipeline hoàn tất trong ${elapsed}s | ${upserted} posts upserted`);
    saveLog();

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', `❌ Pipeline thất bại: ${msg}`);
    saveLog();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[UNCAUGHT]', err);
  process.exit(1);
});
