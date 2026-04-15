/**
 * Recrawl by Hashtags — COBAN Pipeline
 *
 * Đọc hashtag-candidates.json → crawl từng hashtag trên TikTok
 * → Phân biệt AD (brand official) vs SEEDING (user thường)
 * → Output: posts with post_type marked
 *
 * Usage:
 *   npx ts-node lib/crawl/recrawl-hashtags.ts
 *   npx ts-node lib/crawl/recrawl-hashtags.ts --candidates hashtag-candidates.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSession, verifyTikTokLogin } from './chrome-session';
import { crawlTikTokSearch, parseTikTokResponses, type CrawledPost } from './tiktok-crawler';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HashtagCandidate {
  hashtag: string;
  type: string;
  score: number;
  posts: number;
  avg_views: number;
}

interface CandidatesFile {
  generated_at: string;
  source_file: string;
  total_hashtags: number;
  candidates: HashtagCandidate[];
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
  campaign_type: string;
  campaign_name?: string;
  raw: unknown;
}

// ─── Config ───────────────────────────────────────────────────────────────────

// Brand official handles — so sánh để classify AD vs SEEDING
// Nên được load từ DB trong production
const BRAND_HANDLES = new Set([
  'tigerbeervietnam',
  'heinekenvietnam',
  'saigonbeer_official',
  'laruebeer',
  'budweiser_vn',
  'nutifood_official',
  'idpvietnam',
  'kunvietnam',
  'vinamilk',
  'thtruemilk',
  'dutchladyvietnam',
]);

// ─── Classify post type ───────────────────────────────────────────────────────

function classifyPost(post: CrawledPost, brandHandles: Set<string>): 'ad' | 'seeding' | 'unknown' {
  const profile = (post.profile || '').toLowerCase().replace('@', '');

  // Match brand handles
  for (const handle of brandHandles) {
    if (profile.includes(handle) || handle.includes(profile)) {
      return 'ad';
    }
  }

  // Known brand patterns
  const brandPatterns = [
    /tiger/i, /heineken/i, /saigon/i, /larue/i, /budweiser/i,
    /nutifood/i, /idp/i, /kun/i, /vinamilk/i, /thtrue/i,
  ];

  for (const pattern of brandPatterns) {
    if (pattern.test(profile)) {
      return 'ad';
    }
  }

  // High follower count threshold — brand accounts thường có nhiều followers
  // (có thể check từ raw data nếu có)

  return 'seeding';
}

// ─── Recrawl core ─────────────────────────────────────────────────────────────

async function recrawlHashtag(
  hashtag: string,
  brandHandles: Set<string>,
  options: { scrollLimit?: number } = {},
): Promise<CrawledPostEnriched[]> {
  const posts = await crawlTikTokSearch(hashtag, options);

  return posts.map(p => ({
    ...p,
    source_hashtag: hashtag,
    campaign_type: '',
    post_type: classifyPost(p, brandHandles),
  }));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Recrawl by Hashtags — COBAN Pipeline
Usage:
  npx ts-node lib/crawl/recrawl-hashtags.ts
  npx ts-node lib/crawl/recrawl-hashtags.ts --candidates hashtag-candidates.json
  npx ts-node lib/crawl/recrawl-hashtags.ts --top=10

Options:
  --candidates FILE   File chứa hashtag candidates (default: hashtag-candidates.json)
  --top=N             Chỉ crawl top N hashtags (default: all)
  --type=TYPE         Filter by type: campaign, product, viral (default: all)
  --output=FILE       Output file (default: recrawl-results.json)
`);
    return;
  }

  const candidatesFile = args.find(a => a.startsWith('--candidates='))?.split('=')[1]
    || 'hashtag-candidates.json';
  const topN = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] ?? '999', 10);
  const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1] || null;
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1]
    || 'recrawl-results.json';

  const candidatesPath = join(process.cwd(), candidatesFile);

  console.log('╔════════════════════════════════════════╗');
  console.log('║  Recrawl by Hashtags — COBAN Pipeline  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`[*] Candidates: ${candidatesPath}`);
  console.log(`[*] Top N: ${topN}\n`);

  // Load candidates
  let candidates: HashtagCandidate[];
  try {
    const raw = readFileSync(candidatesPath, 'utf8');
    const data: CandidatesFile = JSON.parse(raw);
    candidates = data.candidates;
  } catch {
    console.error(`❌ File not found: ${candidatesPath}`);
    console.error('   → Chạy extract-hashtags trước: npx ts-node lib/crawl/extract-hashtags.ts');
    process.exit(1);
  }

  // Filter by type
  if (typeFilter) {
    candidates = candidates.filter(c => c.type === typeFilter);
    console.log(`[*] Filtered by type="${typeFilter}": ${candidates.length} hashtags\n`);
  }

  // Limit top N
  candidates = candidates.slice(0, topN);

  if (candidates.length === 0) {
    console.error('❌ No candidates to crawl.');
    process.exit(1);
  }

  // ── Chrome session ──
  let session;
  try {
    session = await getSession();
  } catch (e) {
    console.error('❌ Cannot connect to Chrome:', e instanceof Error ? e.message : e);
    console.error('   → Start Chrome with: --remote-debugging-port=9223');
    process.exit(1);
  }

  const loginResult = await verifyTikTokLogin(session.page);
  if (!loginResult.success) {
    console.error(`❌ TikTok CHƯA login (${loginResult.cookies} cookies)`);
    await session.browser.close();
    process.exit(1);
  }
  console.log(`[+] Logged in (${loginResult.cookies} cookies)\n`);

  // ── Recrawl each hashtag ──
  const allResults: CrawledPostEnriched[] = [];
  let totalPosts = 0;
  let totalAd = 0;
  let totalSeeding = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const hashtag = c.hashtag.startsWith('#') ? c.hashtag : `#${c.hashtag}`;

    console.log(`[*] [${i + 1}/${candidates.length}] Crawling: ${hashtag} (${c.type})`);

    try {
      const posts = await recrawlHashtag(hashtag, BRAND_HANDLES);

      // Mark campaign type
      posts.forEach(p => {
        p.campaign_type = c.type;
      });

      const adCount = posts.filter(p => p.post_type === 'ad').length;
      const seedCount = posts.filter(p => p.post_type === 'seeding').length;

      totalPosts += posts.length;
      totalAd += adCount;
      totalSeeding += seedCount;

      console.log(
        `    → ${posts.length} posts (${adCount} AD | ${seedCount} SEEDING) | score: ${c.score}`
      );

      allResults.push(...posts);
    } catch (e) {
      console.error(`    ❌ Error: ${e instanceof Error ? e.message : e}`);
    }

    // Nghỉ giữa các hashtag
    if (i < candidates.length - 1) {
      const gap = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(r => setTimeout(r, gap));
    }
  }

  // ── Save results ──
  writeFileSync(join(process.cwd(), outputFile), JSON.stringify(allResults, null, 2));
  console.log(`\n[+] Saved → ${outputFile}`);

  // Summary
  const summary = {
    hashtags_crawled: candidates.length,
    total_posts: totalPosts,
    ad_posts: totalAd,
    seeding_posts: totalSeeding,
    unknown_posts: totalPosts - totalAd - totalSeeding,
    by_type: candidates.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  console.log('\n═══ Summary ══════════════════════════════════════');
  console.log(`  Hashtags crawled:  ${summary.hashtags_crawled}`);
  console.log(`  Total posts:       ${summary.total_posts}`);
  console.log(`  AD posts:         ${summary.ad_posts} (${((summary.ad_posts / summary.total_posts) * 100).toFixed(1)}%)`);
  console.log(`  Seeding posts:    ${summary.seeding_posts} (${((summary.seeding_posts / summary.total_posts) * 100).toFixed(1)}%)`);
  console.log(`  By campaign type:`, summary.by_type);

  await session.browser.close();
}

main().catch(err => {
  console.error('[UNCAUGHT]', err);
  process.exit(1);
});