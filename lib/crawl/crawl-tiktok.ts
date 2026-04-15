/**
 * TikTok Search Crawler — COBAN Integration
 *
 * Dùng Chrome Profile 4 trên port 9223 (từ lib/crawl/chrome-session.ts).
 * Crawl TikTok search → output raw JSON + campaign-batch.json.
 *
 * Standalone: node lib/crawl/crawl-tiktok.js "bia tiger"
 * Hoặc import từ pipeline: import { crawlTikTokSearch } from './tiktok-crawler'
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CHROME_EXEC,
  CHROME_PROFILE_PATH,
  DEBUG_PORT,
  getSession,
  verifyTikTokLogin,
} from './chrome-session';
import { crawlTikTokSearch, parseTikTokResponses, type CrawledPost } from './tiktok-crawler';

const OUT_DIR = join(process.cwd(), 'tiktok scrape');
const RAW_OUT = join(OUT_DIR, 'tiktok_api_data.json');
const CAMPAIGN_BATCH = join(process.cwd(), 'agents', 'crawl', 'campaign-batch.json');

// ─── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TikTok Search Crawler — COBAN
Usage:
  node lib/crawl/crawl-tiktok.js <keyword> [keyword...]

Examples:
  node lib/crawl/crawl-tiktok.js "bia tiger"
  node lib/crawl/crawl-tiktok.js "bia tiger" "bia heineken" "#tet2025"

Options:
  --check      Chỉ kiểm tra Chrome login, không crawl
  --limit N    Giới hạn số scroll (default: 100)
  --quiet      Không log chi tiết scroll
  --help       Hiển thị help

Output:
  tiktok scrape/tiktok_api_data.json     — raw API responses
  agents/crawl/campaign-batch.json     — hashtags cho campaign-agent
`);
    return;
  }

  if (args.includes('--check')) {
    await checkChrome();
    return;
  }

  const keywords = args.filter(a => !a.startsWith('--'));
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '100', 10);
  const quiet = args.includes('--quiet');

  if (keywords.length === 0) {
    console.error('❌ Cần ít nhất 1 keyword. Chạy với --help để xem hướng dẫn.');
    process.exit(1);
  }

  await runCrawl(keywords, { limit, quiet });
}

// ─── Chrome check ───────────────────────────────────────────────────────────────

async function checkChrome() {
  console.log('[*] Kiểm tra Chrome session...\n');

  try {
    const browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`, { timeout: 3000 });
    const ctx = browser.contexts()[0] || await browser.newContext();
    const page = ctx.pages()[0] || await ctx.newPage();

    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const cookies = await ctx.cookies('https://www.tiktok.com');
    const url = page.url();
    const loggedIn = !url.includes('/login') && cookies.length > 5;

    console.log(`  Port:       ${DEBUG_PORT}`);
    console.log(`  Cookies:    ${cookies.length}`);
    console.log(`  URL:        ${url}`);
    console.log(`  Logged in:  ${loggedIn ? '✅ Có' : '❌ Không'}`);

    if (loggedIn) {
      console.log('\n✅ Chrome sẵn sàng! Chạy crawl: node lib/crawl/crawl-tiktok.js <keyword>');
    } else {
      console.log('\n❌ Đăng nhập TikTok trên Chrome Profile 4, rồi chạy lại.');
    }

    await browser.close();
  } catch (e) {
    console.error(`\n❌ Không kết nối được Chrome trên port ${DEBUG_PORT}`);
    console.error(`   → Chạy: node lib/crawl/crawl-tiktok.js --check`);
    console.error(`   → Hoặc: cd "tiktok scrape" && node bot.js`);
  }
}

// ─── Main crawl ───────────────────────────────────────────────────────────────

async function runCrawl(keywords: string[], options: { limit?: number; quiet?: boolean } = {}) {
  const { limit = 100, quiet = false } = options;
  const startTime = Date.now();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   TikTok Search Crawler — COBAN              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`[*] Profile: Profile 4 | Port: ${DEBUG_PORT}`);
  console.log(`[*] Keywords: ${keywords.join(', ')}`);
  console.log(`[*] Scroll limit: ${limit}\n`);

  // ── Verify Chrome ──
  let session;
  try {
    session = await getSession();
  } catch (e) {
    console.error('❌ Không kết nối được Chrome session:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const verifyResult = await verifyTikTokLogin(session.page);
  if (!verifyResult.success) {
    console.error(`❌ TikTok CHƯA login (${verifyResult.cookies} cookies): ${verifyResult.error}`);
    console.error('   → Đăng nhập TikTok trên Chrome Profile 4, rồi chạy lại.');
    await session.browser.close();
    process.exit(1);
  }
  console.log(`[+] TikTok đã login (${verifyResult.cookies} cookies)\n`);

  // ── Crawl each keyword ──
  const allPosts: CrawledPost[] = [];

  for (const keyword of keywords) {
    if (!quiet) console.log(`[*] Crawling: "${keyword}"`);
    const posts = await crawlTikTokSearch(keyword, { scrollLimit: limit });
    allPosts.push(...posts);
    if (!quiet) console.log(`[+] Done: "${keyword}" — ${posts.length} posts\n`);
  }

  // ── Build campaign-batch.json ──
  buildCampaignBatch(allPosts, keywords);

  // ── Done ──
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Hoàn tất! ${allPosts.length} posts trong ${elapsed}s`);
  console.log(`   Raw data:  ${RAW_OUT}`);
  console.log(`   Campaigns: ${CAMPAIGN_BATCH}`);

  await session.browser.close();
}

// ─── Build campaign-batch.json ────────────────────────────────────────────────

function buildCampaignBatch(posts: CrawledPost[], keywords: string[]) {
  // Extract unique hashtags per keyword context
  const hashtagByKeyword = new Map<string, Set<string>>();

  for (const post of posts) {
    const matches = (post.content ?? '').match(/#[\p{L}0-9_]+/gu) ?? [];
    for (const ht of matches) {
      const htLower = ht.toLowerCase();
      // Filter out generic TikTok hashtags
      if (['#fyp', '#foryou', '#viral', '#tiktok', '#fypシ', '#explore'].includes(htLower)) continue;
      if (!hashtagByKeyword.has(htLower)) {
        hashtagByKeyword.set(htLower, new Set());
      }
      hashtagByKeyword.get(htLower)!.add(post.profile);
    }
  }

  const batch = Array.from(hashtagByKeyword.entries()).map(([hashtag, profiles]) => ({
    brand_id: '',
    brand_name: 'TikTok Search',
    hashtags: [hashtag],
    platform: 'tiktok',
    profiles: Array.from(profiles),
  }));

  try {
    writeFileSync(CAMPAIGN_BATCH, JSON.stringify(batch, null, 2));
    console.log(`[+] campaign-batch.json: ${batch.length} hashtags`);
  } catch (e) {
    console.warn('[!] Không ghi được campaign-batch.json:', e instanceof Error ? e.message : e);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[UNCAUGHT]', err);
  process.exit(1);
});