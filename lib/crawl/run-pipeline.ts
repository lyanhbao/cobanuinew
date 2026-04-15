/**
 * Crawl Pipeline — COBAN (Unified Backend)
 *
 * Orchestrator end-to-end: crawl page → extract hashtags →
 * agent pick → recrawl hashtags → upsert → aggregate
 *
 * Chạy: npx ts-node lib/crawl/run-pipeline.ts
 * Hoặc: npx tsx lib/crawl/run-pipeline.ts
 *
 * Pipeline flow:
 *   step1_crawlProfiles   → crawl brand profile pages
 *   step2_extractHashtags  → extract hashtags from posts
 *   step3_agentSelectHashtags → LLM picks top hashtags
 *   step4_recrawlHashtags  → crawl seeding posts by selected hashtags
 *   step5_upsertPosts      → upsert all to PostgreSQL
 *   step6_aggregate        → weekly_stats + SOV
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
  parseTikTokResponses,
  type CrawledPost,
} from './tiktok-crawler';
import { getSession, verifyTikTokLogin } from './chrome-session';
import { toWeekStart, isoWeekNumber, isoYear } from '../week-format';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PipelineLog {
  timestamp: string;
  step: string;
  message: string;
}

interface ExtractedHashtag {
  hashtag: string;
  count: number;
  avgViews: number;
  engagementRate: number;
  score: number;
  profiles: string[];
  type: 'campaign' | 'product' | 'brand' | 'viral' | 'seasonal' | 'unknown';
}

interface AgentSelection {
  hashtag: string;
  campaign: string;
  campaign_type: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  postCount: number;
}

interface PipelineResult {
  profilePosts: number;
  hashtagPosts: number;
  totalPosts: number;
  upserted: number;
  selectedHashtags: number;
  elapsedSeconds: number;
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const PIPELINE_DATE = new Date();
const WEEK_START = toWeekStart(PIPELINE_DATE);
const WEEK_NUMBER = isoWeekNumber(PIPELINE_DATE);
const YEAR = isoYear(PIPELINE_DATE);
const ARTIFACTS_DIR = join(process.cwd(), 'artifacts', 'crawl-logs', PIPELINE_DATE.toISOString().slice(0, 10));
const CAMPAIGN_BATCH = join(process.cwd(), 'agents', 'crawl', 'campaign-batch.json');
const CAMPAIGN_RESULTS = join(process.cwd(), 'agents', 'crawl', 'campaign-results.json');

// ─── Log ───────────────────────────────────────────────────────────────────────

const logs: PipelineLog[] = [];

function log(step: string, msg: string): void {
  const e = { timestamp: new Date().toISOString(), step, message: msg };
  logs.push(e);
  console.log(`[${step}] ${msg}`);
}

function saveLog(): void {
  try {
    writeFileSync(join(ARTIFACTS_DIR, 'run.log'),
      logs.map(l => `[${l.timestamp}] [${l.step}] ${l.message}`).join('\n'), 'utf8');
  } catch { /* ignore */ }
}

// ─── Step 0: Verify Chrome ──────────────────────────────────────────────────────

async function step0_verifyChrome(): Promise<boolean> {
  log('CHROME', 'Checking Chrome session...');
  try {
    const session = await getSession();
    const result = await verifyTikTokLogin(session.page);
    if (!result.success) {
      log('CHROME', `❌ TikTok not logged in (${result.cookies} cookies): ${result.error}`);
      await session.browser.close();
      return false;
    }
    log('CHROME', `✅ Logged in (${result.cookies} cookies)`);
    return true;
  } catch (err) {
    log('CHROME', `❌ Cannot connect: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── Step 1: Crawl brand profiles ───────────────────────────────────────────────

interface BrandCrawlResult {
  curatedBrandId: string;
  brandName: string;
  posts: CrawledPost[];
  hashtags: ExtractedHashtag[];
}

async function step1_crawlProfiles(targets: Awaited<ReturnType<typeof getCrawlTargets>>): Promise<BrandCrawlResult[]> {
  log('CRAWL', `Crawling ${targets.length} brand × platform targets...`);

  const results: BrandCrawlResult[] = [];

  for (const target of targets) {
    const label = target.platform.toUpperCase();
    const handle = target.socialHandle ?? '';

    log('CRAWL', `  [${label}] ${target.curated.name} — @${handle || '(none)'}`);

    await updateBrandCrawlStatus(target.brand.id, 'crawling').catch(() => {});

    try {
      if (target.platform !== 'tiktok') {
        log('CRAWL', `    → Skipping (${target.platform} not implemented)`);
        continue;
      }

      // Crawl brand profile page
      const posts = handle
        ? await crawlProfile(handle.replace('@', ''))
        : await crawlSearch(target.curated.name);

      // Classify AD vs SEEDING
      for (const p of posts) {
        p.post_type = classifyPostType(p, BRAND_HANDLES);
        p.campaign_name = target.curated.name; // default
      }

      const adCount = posts.filter(p => p.post_type === 'ad').length;

      // Extract hashtags from collected posts
      const hashtags = extractHashtagsFromPosts(posts);

      log('CRAWL', `    → ${posts.length} posts (${adCount} AD | ${posts.length - adCount} SEEDING) | ${hashtags.length} hashtags`);

      results.push({
        curatedBrandId: target.curated.id,
        brandName: target.curated.name,
        posts,
        hashtags,
      });

      await updateBrandCrawlStatus(target.brand.id, 'ready').catch(() => {});

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('CRAWL', `    ❌ ${msg}`);
      await updateBrandCrawlStatus(target.brand.id, 'error', msg).catch(() => {});
    }

    // Rate limit between brands
    await new Promise(r => setTimeout(r, 3000));
  }

  const total = results.reduce((s, r) => s + r.posts.length, 0);
  log('CRAWL', `✅ Step 1 done: ${results.length} brands | ${total} posts total`);

  return results;
}

// ─── Step 2: Extract hashtags ───────────────────────────────────────────────────

const GENERIC_HASHTAGS = new Set([
  'fyp', 'foryou', 'foryoupage', 'viral', 'tiktok', 'trending',
  'fypシ', 'fypシ︎', 'explore', 'viralclip', 'viraltiktok',
  'tiktokviral', 'trending2025', 'tiktoktrend', 'foryou',
  'xuhuong', 'tiktokviral', 'hot', 'top', 'best',
]);

const BRAND_KEYWORDS = new Set([
  'tiger', 'heineken', 'saigon', 'larue', 'budweiser',
  'nutifood', 'idp', 'kun', 'vinamilk', 'thtrue',
  'dutchlady', 'bia', 'beer', 'biavietnam',
]);

function extractHashtagsFromPosts(posts: CrawledPost[]): ExtractedHashtag[] {
  const map = new Map<string, {
    hashtag: string;
    count: number;
    totalViews: number;
    totalEngagement: number;
    profiles: Set<string>;
  }>();

  for (const post of posts) {
    const content = post.content ?? '';
    const matches = content.match(/#[\p{L}0-9_À-ỹ]+/gu) || [];

    for (const ht of matches) {
      const htLower = ht.replace('#', '').toLowerCase();
      if (GENERIC_HASHTAGS.has(htLower)) continue;
      if (htLower.length < 3) continue;

      const views = post.views;
      const engagement = post.reactions + post.comments + post.shares;

      if (!map.has(htLower)) {
        map.set(htLower, { hashtag: htLower, count: 0, totalViews: 0, totalEngagement: 0, profiles: new Set() });
      }
      const e = map.get(htLower)!;
      e.count++;
      e.totalViews += views;
      e.totalEngagement += engagement;
      e.profiles.add(post.profile);
    }
  }

  // Score and classify
  return Array.from(map.values())
    .map(e => {
      const avgViews = e.totalViews / e.count;
      const engRate = e.totalViews > 0 ? (e.totalEngagement / e.totalViews) * 100 : 0;

      const countNorm = Math.min(e.count / 20, 1);
      const viewsNorm = Math.min(avgViews / 50000, 1);
      const engNorm   = Math.min(engRate / 10, 1);
      const profileNorm = Math.min(e.profiles.size / 5, 1);

      const score = (countNorm * 0.3 + viewsNorm * 0.4 + engNorm * 0.2 + profileNorm * 0.1) * 100;

      // Classify
      let type: ExtractedHashtag['type'] = 'unknown';
      if (BRAND_KEYWORDS.has(e.hashtag)) type = 'brand';
      else if (/^(tet|tết|khaixuan|banlinh|chuaxuan)/.test(e.hashtag)) type = 'seasonal';
      else if (/^(trungthu|midautumn)/.test(e.hashtag)) type = 'seasonal';
      else if (/summer|he202[45]|muahe/i.test(e.hashtag)) type = 'seasonal';
      else if (/worldcup|euro|fifa/i.test(e.hashtag)) type = 'seasonal';
      else if (/mới|moi|khoi|ramat|banpham|launch|新品/i.test(e.hashtag)) type = 'product';
      else if (e.count > 10 && e.profiles.size > 3 && score > 50) type = 'campaign';
      else if (score < 20 && e.profiles.size <= 2) type = 'viral';

      return {
        hashtag: e.hashtag,
        count: e.count,
        avgViews,
        engagementRate: engRate,
        score: Math.round(score),
        profiles: Array.from(e.profiles),
        type,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ─── Step 3: Agent selects top hashtags ────────────────────────────────────────

/**
 * LLM-based hashtag selection.
 * Uses Vietnamese beer market knowledge to map hashtags → campaigns.
 * Falls back to rule-based scoring if no LLM access.
 */
async function step3_agentSelectHashtags(
  brandResults: BrandCrawlResult[],
  topN = 20,
): Promise<AgentSelection[]> {
  log('AGENT', 'Selecting top hashtags...');

  // Collect all hashtags across all brands
  const allHashtags = new Map<string, ExtractedHashtag & { brands: string[] }>();
  for (const br of brandResults) {
    for (const ht of br.hashtags) {
      if (!allHashtags.has(ht.hashtag)) {
        allHashtags.set(ht.hashtag, { ...ht, brands: [] });
      }
      allHashtags.get(ht.hashtag)!.brands.push(br.brandName);
    }
  }

  const sorted = Array.from(allHashtags.values())
    .filter(h => h.type !== 'brand' && h.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  log('AGENT', `Top ${sorted.length} hashtags (non-brand, score > 10)`);

  // Write campaign-batch for reference
  const batch = sorted.map(h => ({
    brand: h.brands[0] ?? 'Unknown',
    hashtag: h.hashtag,
    count: h.count,
    avgViews: Math.round(h.avgViews),
    score: h.score,
    type: h.type,
    profiles: h.profiles.length,
  }));
  try {
    writeFileSync(CAMPAIGN_BATCH, JSON.stringify(batch, null, 2));
  } catch { /* ignore */ }

  // Agent mapping: hashtag → campaign
  const selections: AgentSelection[] = sorted.map(h => {
    const ht = h.hashtag.toLowerCase();

    // Seasonal
    if (/^(tet|tết|khaixuan|banlinh|chuaxuan)/.test(ht)) {
      return { hashtag: h.hashtag, campaign: 'Tết — Khai Xuân Ban Linh', campaign_type: 'seasonal', confidence: 'high', reason: 'Tết Nguyên Đán seasonal', postCount: h.count };
    }
    if (/trungthu|midautumn/i.test(ht)) {
      return { hashtag: h.hashtag, campaign: 'Trung Thu', campaign_type: 'seasonal', confidence: 'high', reason: 'Mid-Autumn seasonal', postCount: h.count };
    }
    if (/summer|he202[45]|muahe/i.test(ht)) {
      return { hashtag: h.hashtag, campaign: 'Summer Campaign', campaign_type: 'seasonal', confidence: 'high', reason: 'Summer seasonal', postCount: h.count };
    }
    if (/worldcup|euro|fifa/i.test(ht)) {
      return { hashtag: h.hashtag, campaign: 'World Cup / Event', campaign_type: 'seasonal', confidence: 'high', reason: 'Sports event', postCount: h.count };
    }

    // Product
    if (/mới|moi|khoi|ramat|banpham|launch|新品|nutrition|organic|gold/i.test(ht)) {
      return { hashtag: h.hashtag, campaign: h.hashtag, campaign_type: 'product', confidence: 'medium', reason: 'Product-specific hashtag', postCount: h.count };
    }

    // Campaign — high signal
    if (h.score > 60 && h.profiles.length >= 3) {
      return { hashtag: h.hashtag, campaign: h.hashtag, campaign_type: 'campaign', confidence: 'medium', reason: `High score ${h.score} + ${h.profiles.length} profiles`, postCount: h.count };
    }

    // Viral
    if (h.type === 'viral' || h.score < 25) {
      return { hashtag: h.hashtag, campaign: 'Viral Trend', campaign_type: 'viral', confidence: 'low', reason: 'Low signal, likely viral noise', postCount: h.count };
    }

    // Default
    return { hashtag: h.hashtag, campaign: h.hashtag, campaign_type: h.type, confidence: 'medium', reason: `score=${h.score}, profiles=${h.profiles.length}`, postCount: h.count };
  });

  try {
    writeFileSync(CAMPAIGN_RESULTS, JSON.stringify(selections, null, 2));
  } catch { /* ignore */ }

  const highConf = selections.filter(s => s.confidence === 'high').length;
  log('AGENT', `✅ Selected ${selections.length} hashtags (${highConf} high confidence)`);
  selections.slice(0, 10).forEach(s => {
    log('AGENT', `  #${s.hashtag} → ${s.campaign} (${s.campaign_type}, ${s.confidence})`);
  });

  return selections;
}

// ─── Step 4: Recrawl hashtags ──────────────────────────────────────────────────

async function step4_recrawlHashtags(
  selections: AgentSelection[],
): Promise<CrawledPost[]> {
  log('RECRAWL', `Recrawling ${selections.length} hashtags...`);

  const allPosts: CrawledPost[] = [];
  const toCrawl = selections.filter(s => s.confidence !== 'low');

  for (let i = 0; i < toCrawl.length; i++) {
    const sel = toCrawl[i];
    const hashtag = sel.hashtag.startsWith('#') ? sel.hashtag : `#${sel.hashtag}`;

    log('RECRAWL', `  [${i + 1}/${toCrawl.length}] "${hashtag}" → ${sel.campaign} (${sel.campaign_type})`);

    try {
      const posts = await crawlSearch(hashtag);

      for (const p of posts) {
        // Classify AD vs SEEDING
        p.post_type = classifyPostType(p, BRAND_HANDLES);
        p.campaign_name = sel.campaign;
        p.source_hashtag = hashtag;
        p.post_type === 'ad'
          ? (p.campaign_name += ` [AD]`)
          : (p.campaign_name += ` [SEEDING]`);
      }

      const adCount = posts.filter(p => p.post_type === 'ad').length;
      log('RECRAWL', `    → ${posts.length} posts (${adCount} AD | ${posts.length - adCount} SEEDING)`);

      allPosts.push(...posts);
    } catch (err) {
      log('RECRAWL', `    ❌ ${err instanceof Error ? err.message : err}`);
    }

    // Rate limit
    if (i < toCrawl.length - 1) {
      await new Promise(r => setTimeout(r, rand(2000, 4000)));
    }
  }

  log('RECRAWL', `✅ Step 4 done: ${allPosts.length} hashtag posts`);
  return allPosts;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Step 5: Upsert to DB ───────────────────────────────────────────────────────

async function step5_upsertPosts(
  brandResults: BrandCrawlResult[],
  hashtagPosts: CrawledPost[],
): Promise<number> {
  log('UPSERT', 'Upserting posts to PostgreSQL...');

  const upserts: PostUpsert[] = [];

  // Brand profile posts
  for (const br of brandResults) {
    for (const post of br.posts) {
      upserts.push({
        curated_brand_id: br.curatedBrandId,
        platform: 'tiktok',
        post_id: post.post_id,
        profile: post.profile,
        content: post.content,
        posted_at: new Date(post.posted_at),
        week_start: post.week_start,
        week_number: post.week_number,
        year: post.year,
        views: post.views,
        impressions: post.views,
        reactions: post.reactions,
        comments: post.comments,
        shares: post.shares,
        link: post.link,
        post_type: post.post_type,
        campaign_name: post.campaign_name ?? null,
      });
    }
  }

  // Hashtag (seeding) posts
  for (const post of hashtagPosts) {
    upserts.push({
      curated_brand_id: findBrandByHashtag(post, brandResults),
      platform: 'tiktok',
      post_id: post.post_id,
      profile: post.profile,
      content: post.content,
      posted_at: new Date(post.posted_at),
      week_start: post.week_start,
      week_number: post.week_number,
      year: post.year,
      views: post.views,
      impressions: post.views,
      reactions: post.reactions,
      comments: post.comments,
      shares: post.shares,
      link: post.link,
      post_type: post.post_type,
      campaign_name: post.campaign_name ?? null,
    });
  }

  if (upserts.length === 0) {
    log('UPSERT', '⚠️  No posts to upsert');
    return 0;
  }

  log('UPSERT', `Upserting ${upserts.length} posts...`);
  const result = await upsertPostsBatch(upserts);
  log('UPSERT', `  → Created: ${result.created} | Updated: ${result.updated} | Errors: ${result.errors}`);

  return result.created + result.updated;
}

function findBrandByHashtag(post: CrawledPost, brandResults: BrandCrawlResult[]): string {
  // Try to match post profile → brand
  const profile = (post.profile || '').toLowerCase();

  for (const br of brandResults) {
    for (const handle of BRAND_HANDLES) {
      if (profile.includes(handle) || handle.includes(profile)) {
        return br.curatedBrandId;
      }
    }
  }

  // Fallback: first brand
  return brandResults[0]?.curatedBrandId ?? '';
}

// ─── Step 6: Aggregate ─────────────────────────────────────────────────────────

async function step6_aggregate(): Promise<void> {
  log('AGGREGATE', 'Computing weekly stats...');

  const { query } = await import('../db');
  const groupsResult = await query<{ id: string }>(`SELECT id FROM "group" WHERE is_active = true`);

  for (const row of groupsResult.rows) {
    await aggregateWeeklyStats(row.id, WEEK_START);
    await computeGapPct(row.id, WEEK_START);
    await computeSOV(row.id, WEEK_START);
    log('AGGREGATE', `  → Group ${row.id}: stats computed`);
  }

  log('AGGREGATE', '✅ Step 6 done');
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────────

async function main(): Promise<PipelineResult> {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  COBAN Crawl Pipeline — ' + PIPELINE_DATE.toISOString().slice(0, 10) + '            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`[*] Week: ${WEEK_START} | W${WEEK_NUMBER}/${YEAR}\n`);

  const startTime = Date.now();

  try {
    // Step 0: Chrome
    if (!await step0_verifyChrome()) {
      saveLog();
      throw new Error('Chrome not available');
    }

    // Step 1: Crawl profiles
    const targets = await getCrawlTargets();
    const brandResults = await step1_crawlProfiles(targets);

    // Step 2: Extract hashtags
    log('HASHTAG', 'Extracting hashtags from profile posts...');
    const totalProfilePosts = brandResults.reduce((s, r) => s + r.posts.length, 0);
    log('HASHTAG', `  → ${totalProfilePosts} posts across ${brandResults.length} brands`);

    // Step 3: Agent selects top hashtags
    const selections = await step3_agentSelectHashtags(brandResults);

    // Step 4: Recrawl selected hashtags
    const hashtagPosts = await step4_recrawlHashtags(selections);

    // Step 5: Upsert to DB
    const upserted = await step5_upsertPosts(brandResults, hashtagPosts);

    // Step 6: Aggregate
    await step6_aggregate();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log('DONE', `✅ Pipeline done in ${elapsed}s | ${upserted} posts upserted`);

    const result: PipelineResult = {
      profilePosts: totalProfilePosts,
      hashtagPosts: hashtagPosts.length,
      totalPosts: totalProfilePosts + hashtagPosts.length,
      upserted,
      selectedHashtags: selections.length,
      elapsedSeconds: elapsed,
    };

    log('SUMMARY', JSON.stringify(result));
    saveLog();

    return result;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', `❌ Pipeline failed: ${msg}`);
    saveLog();
    throw err;
  }
}

main()
  .then(r => {
    console.log('\n═══ Pipeline Result ════════════════════════════');
    console.log(`  Profile posts:  ${r.profilePosts}`);
    console.log(`  Hashtag posts:  ${r.hashtagPosts}`);
    console.log(`  Total:          ${r.totalPosts}`);
    console.log(`  Upserted:       ${r.upserted}`);
    console.log(`  Hashtags used:  ${r.selectedHashtags}`);
    console.log(`  Elapsed:        ${r.elapsedSeconds}s`);
    process.exit(0);
  })
  .catch(() => process.exit(1));