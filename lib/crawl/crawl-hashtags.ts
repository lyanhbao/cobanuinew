/**
 * Crawl Hashtags from LLM Selection — COBAN Pipeline
 *
 * Đọc csv-hashtags-llm-selected.json → crawl TikTok hashtag
 * → classify AD vs SEEDING → save results + upsert to DB
 *
 * Usage:
 *   node --import tsx/esm lib/crawl/crawl-hashtags.ts
 *   node --import tsx/esm lib/crawl/crawl-hashtags.ts --limit=50
 *   node --import tsx/esm lib/crawl/crawl-hashtags.ts --top=5
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { crawlTikTokSearch, BRAND_HANDLES } from './tiktok-crawler';
import { upsertPostsBatch } from './db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', '..', 'artifacts', 'crawl-logs');
const SELECTED_PATH = join(OUT_DIR, 'csv-hashtags-llm-selected.json');
const RESULTS_PATH = join(OUT_DIR, 'hashtag-crawl-results.json');

// Tiger Beer curated_brand ID
const BRAND_ID = 'a0000001-0000-0000-0000-000000000001';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LLMHashtag {
  hashtag: string;   // '#khaixuanbanlinh'
  reason: string;
  priority: string;
  type: string;
  expected_volume: string;
}

interface CrawledPostEnriched {
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
  post_type: 'ad' | 'seeding' | 'unknown';
  source_hashtag: string;
  crawl_source: 'hashtag';
  raw: unknown;
}

// ─── Classify post ───────────────────────────────────────────────────────────

function classifyPost(profile: string): 'ad' | 'seeding' | 'unknown' {
  const p = profile.toLowerCase().replace('@', '');

  for (const h of BRAND_HANDLES) {
    if (p.includes(h) || h.includes(p)) return 'ad';
  }
  const patterns = [/tiger/i, /heineken/i, /saigon/i, /larue/i, /budweiser/i];
  for (const re of patterns) {
    if (re.test(p)) return 'ad';
  }
  return 'seeding';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const topN = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] ?? '999', 10);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '50', 10);
  const dryRun = args.includes('--dry-run');
  const skipDb = args.includes('--skip-db');

  if (!existsSync(SELECTED_PATH)) {
    console.error(`❌ File not found: ${SELECTED_PATH}`);
    console.error('   → Chạy extract-csv-hashtags.ts trước');
    process.exit(1);
  }

  const selected: LLMHashtag[] = JSON.parse(readFileSync(SELECTED_PATH, 'utf-8'));
  const toCrawl = selected.slice(0, topN);

  console.log('╔════════════════════════════════════════╗');
  console.log('║  Crawl Hashtags — LLM Selection       ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`[*] Hashtags: ${toCrawl.length} (top ${topN})`);
  console.log(`[*] Scroll limit per hashtag: ${limit}`);
  console.log(`[*] Dry run: ${dryRun ? 'YES' : 'no'}`);
  console.log(`[*] DB upsert: ${skipDb ? 'SKIP' : 'YES'}\n`);

  if (dryRun) {
    for (const h of toCrawl) {
      const tag = h.hashtag.startsWith('#') ? h.hashtag : `#${h.hashtag}`;
      console.log(`  ${tag} (${h.priority}) — ${h.type}`);
    }
    return;
  }

  // ── Crawl each hashtag ──
  const allPosts: CrawledPostEnriched[] = [];
  let totalPosts = 0;
  let totalAd = 0;
  let totalSeeding = 0;

  for (let i = 0; i < toCrawl.length; i++) {
    const h = toCrawl[i];
    const tag = h.hashtag.startsWith('#') ? h.hashtag : `#${h.hashtag}`;
    const tagNorm = h.hashtag.replace(/^#+/, '').toLowerCase();

    console.log(`\n[*] [${i + 1}/${toCrawl.length}] ${tag}`);
    console.log(`    type=${h.type} priority=${h.priority} expected=${h.expected_volume}`);

    try {
      const posts = await crawlTikTokSearch(tag, { scrollLimit: limit });

      const enriched: CrawledPostEnriched[] = posts.map(p => ({
        ...p,
        post_type: classifyPost(p.profile) as 'ad' | 'seeding' | 'unknown',
        source_hashtag: tagNorm,
        crawl_source: 'hashtag' as const,
        raw: p.raw,
      }));

      const adCount = enriched.filter(p => p.post_type === 'ad').length;
      const seedCount = enriched.filter(p => p.post_type === 'seeding').length;

      totalPosts += enriched.length;
      totalAd += adCount;
      totalSeeding += seedCount;

      console.log(`    → ${enriched.length} posts (${adCount} AD | ${seedCount} SEEDING | ${enriched.length - adCount - seedCount} unknown)`);

      allPosts.push(...enriched);

      // Save partial results after each hashtag
      writeFileSync(RESULTS_PATH, JSON.stringify(allPosts, null, 2));

    } catch (e) {
      console.error(`    ❌ Error: ${e instanceof Error ? e.message : e}`);
    }

    // Random delay between hashtags
    if (i < toCrawl.length - 1) {
      const delay = Math.floor(Math.random() * 4000) + 2000;
      console.log(`    [wait ${delay}ms...]`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // ── Summary ──
  console.log('\n═══ Summary ══════════════════════════════════════');
  console.log(`  Hashtags crawled:  ${toCrawl.length}`);
  console.log(`  Total posts:      ${totalPosts}`);
  console.log(`  AD posts:        ${totalAd} (${totalPosts ? ((totalAd / totalPosts) * 100).toFixed(1) : 0}%)`);
  console.log(`  Seeding posts:   ${totalSeeding} (${totalPosts ? ((totalSeeding / totalPosts) * 100).toFixed(1) : 0}%)`);
  console.log(`  Results file:     ${RESULTS_PATH}`);

  // ── Upsert to DB ──
  if (!skipDb && allPosts.length > 0) {
    console.log('\n[*] Upserting posts to DB...');
    try {
      await upsertPostsBatch(allPosts.map(p => ({
        ...p,
        curated_brand_id: BRAND_ID,
        platform: 'tiktok' as const,
        content: p.content,
        posted_at: p.posted_at,
        views: p.views,
        reactions: p.reactions,
        comments: p.comments,
        shares: p.shares,
        link: p.link,
        external_links: p.external_links,
        post_type: p.post_type === 'ad' ? 'ad' : p.post_type === 'seeding' ? 'seeding' : undefined,
        source_hashtag: p.source_hashtag,
        crawl_source: 'hashtag' as const,
        week_start: p.week_start,
        week_number: p.week_number,
        year: p.year,
        raw: p.raw,
      })));
      console.log(`[+] Upserted ${allPosts.length} posts to DB`);
    } catch (e) {
      console.error(`❌ DB upsert failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
