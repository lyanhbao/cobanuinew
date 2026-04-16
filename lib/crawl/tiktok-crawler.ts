/**
 * TikTok Crawler — COBAN Pipeline
 *
 * Crawl TikTok via Chrome CDP session (Profile 4, port 9223).
 *
 * TWO modes:
 *   1. Profile mode  — navigate to /@handle, lazy-load + capture /api/post/item_list/
 *      Best for: getting ALL brand official posts (high signal, no noise)
 *   2. Search mode   — navigate to /search/video?q=, scroll + capture /api/search/item/full/
 *      Best for: getting seeding/UGC posts by hashtag (higher volume, noisier)
 *
 * Usage (via run-pipeline.ts):
 *   crawlProfile('@tigerbeervietnam')  → CrawledPost[]
 *   crawlSearch('#khaixuanbanlinh')    → CrawledPost[]
 */
import { getSession, verifyTikTokLogin } from './chrome-session';
import { toWeekStart, isoWeekNumber, isoYear } from '../week-format';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrawledPost {
  post_id: string;
  platform: 'tiktok';
  profile: string;
  profile_id: string;
  content: string;
  posted_at: string;   // ISO string
  week_start: string;
  week_number: number;
  year: number;
  views: number;
  reactions: number;
  comments: number;
  shares: number;
  link: string;
  external_links: string[];
  post_type?: 'ad' | 'seeding';
  source_hashtag?: string;
  campaign_name?: string;
  raw: unknown;
}

export interface CrawlOptions {
  /** Max lazy-load iterations (default: 30) */
  scrollLimit?: number;
  /** Stop after N scrolls with no new data (default: 5) */
  stuckThreshold?: number;
  /** Delay between scrolls in ms (default: random 1500-3500) */
  scrollDelay?: [number, number];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isProfileUrl(url: string): boolean {
  return /^@[\w.]+$/.test(url.replace('https://www.tiktok.com/', '').split('?')[0]);
}

// ─── Core: Profile Page Crawl ────────────────────────────────────────────────

const PROFILE_API = 'api/post/item_list';
const STICKY_THRESHOLD = 5;
const MAX_SCROLLS = 30;

/**
 * Crawl a TikTok profile page via lazy-load pagination.
 *
 * Approach:
 *   1. Navigate to https://www.tiktok.com/@handle
 *   2. Listen for /api/post/item_list/ responses (each = 1 cursor batch)
 *   3. Gently scroll → TikTok lazy-loads → new API batch triggers
 *   4. Stop when API says hasMore=false OR stuck for too long
 *
 * @param handle  TikTok handle WITHOUT @ (e.g. "tigerbeervietnam")
 */
export async function crawlProfile(
  handle: string,
  options: CrawlOptions = {},
): Promise<CrawledPost[]> {
  const { scrollLimit = MAX_SCROLLS, stuckThreshold = STICKY_THRESHOLD } = options;

  const session = await getSession();
  const { context } = session;

  // Verify login first
  const login = await verifyTikTokLogin(session.page);
  if (!login.success) {
    throw new Error(`TikTok not logged in (${login.cookies} cookies): ${login.error}`);
  }

  const page = await context.newPage();

  const collected: Array<{
    cursor: number;
    hasMore: boolean;
    data: unknown;
    url: string;
  }> = [];
  const seenCursors = new Set<number>();

  // ── Listen for profile API responses ──
  page.on('response', (resp: import('playwright').Response) => {
    if (!resp.url().includes(PROFILE_API)) return;

    let cursor = 0;
    try {
      const urlObj = new URL(resp.url());
      cursor = parseInt(urlObj.searchParams.get('cursor') || '0', 10);
    } catch {}

    if (seenCursors.has(cursor)) return;
    seenCursors.add(cursor);

    resp.json().then((json) => {
      const data = json as { itemList?: unknown[]; item_list?: unknown[]; hasMore?: boolean; has_more?: boolean };
      const count = data?.itemList?.length || data?.item_list?.length || 0;
      const hasMore = data?.hasMore || data?.has_more || false;
      process.stdout.write(`\r  [+${cursor}] ${count} videos ${hasMore ? '→' : '✓done'}  `);
      collected.push({ cursor, hasMore, data, url: resp.url() });
    }).catch(() => {});
  });

  // ── Navigate ──
  const profileUrl = `https://www.tiktok.com/@${handle.replace('@', '')}`;
  console.log(`[*] Profile: ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(rand(2000, 4000));

  // ── Lazy-load scroll ──
  let prevCount = 0;
  let stuck = 0;
  let scrollNum = 0;

  while (stuck < stuckThreshold && scrollNum < scrollLimit) {
    const vp = page.viewportSize() || { width: 1280, height: 800 };

    // Human-like hover
    await page.mouse.move(
      rand(300, vp.width - 300),
      rand(200, vp.height - 200),
    );
    await sleep(rand(200, 800));

    // Scroll gently (300px → 60% viewport)
    const scrollPx = rand(300, Math.floor(vp.height * 0.6));
    await page.mouse.wheel(0, scrollPx);
    scrollNum++;

    await sleep(rand(1500, 3500));

    const current = collected.length;
    console.log(`\r  Scroll #${scrollNum} (+${scrollPx}px) → ${current} API calls`);

    if (current === prevCount) {
      stuck++;
      if (stuck < stuckThreshold) {
        // Extra gentle scroll when stuck
        await page.mouse.wheel(0, rand(200, 400));
        await sleep(rand(2000, 4000));
      }
    } else {
      stuck = 0;
      prevCount = current;
    }
  }

  // Check final batch
  if (collected.length > 0) {
    const last = collected[collected.length - 1];
    const lastData = last.data as { hasMore?: boolean; has_more?: boolean };
    if (lastData?.hasMore === false || lastData?.has_more === false) {
      console.log(`  ✓ All posts loaded (hasMore=false)`);
    }
  }

  console.log(`\n[+] ${handle}: ${collected.length} API batches → ${collected.reduce((s, c) => {
    const d = c.data as { itemList?: unknown[]; item_list?: unknown[] };
    return s + (d?.itemList || d?.item_list || []).length;
  }, 0)} posts`);

  await page.close();

  // ── Parse ──
  return parseResponses(collected.map(c => c.data));
}

// ─── Core: Search Crawl ─────────────────────────────────────────────────────

// Tag pages use /api/item/detail/ and /api/comment/list/ for lazy loading
const SEARCH_API_PATTERNS = ['/api/challenge/item_list/'];
const SEARCH_SCROLL_MAX = 20;

/**
 * Crawl TikTok tag page (e.g. #khaixuanbanlinh → /tag/khaixuanbanlinh).
 * Falls back to /search/video?q= for plain keywords.
 *
 * @param keyword  Tag or search term (e.g. "#khaixuanbanlinh", "bia tiger")
 */
export async function crawlSearch(
  keyword: string,
  options: CrawlOptions = {},
): Promise<CrawledPost[]> {
  const { scrollLimit = SEARCH_SCROLL_MAX, stuckThreshold = 3 } = options;

  const session = await getSession();
  const { context } = session;

  const login = await verifyTikTokLogin(session.page);
  if (!login.success) {
    throw new Error(`TikTok not logged in: ${login.error}`);
  }

  const page = await context.newPage();
  const collected: unknown[] = [];
  const seen = new Set<string>();

  page.on('response', (resp: import('playwright').Response) => {
    if (!resp.url().includes('/api/challenge/item_list/')) return;
    resp.json().then((json) => {
      // /api/challenge/item_list/ — has itemList (not item_list)
      const data = json as {
        itemList?: TikTokVideoItem[];
        items?: TikTokVideoItem[];
        hasMore?: boolean;
        cursor?: number;
      };
      const items = data?.itemList || data?.items || [];
      for (const v of items as Array<{ id?: string }>) {
        if (v?.id && !seen.has(v.id)) {
          seen.add(v.id);
          collected.push(json);
        }
      }
    }).catch(() => {});
  });

  const tagClean = keyword.startsWith('#') ? keyword.slice(1) : keyword;
  const encoded = encodeURIComponent(tagClean);
  const searchUrl = `https://www.tiktok.com/tag/${encoded}`;
  console.log(`[*] Search: "${keyword}" → ${searchUrl}`);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(3000);

  let prevCount = 0;
  let stuck = 0;
  let scrollNum = 0;

  while (stuck < stuckThreshold && scrollNum < scrollLimit) {
    const vp = page.viewportSize() || { width: 1280, height: 800 };

    await page.mouse.move(
      (vp.width / 2) + rand(-50, 50),
      50 + rand(-10, 10),
    );
    await sleep(500);

    // Multi-burst scroll
    for (let i = 0; i < rand(2, 4); i++) {
      await page.mouse.wheel(0, rand(800, 1600));
      await sleep(rand(500, 1000));
    }
    scrollNum++;

    const current = collected.length;
    console.log(`  Scroll #${scrollNum} → ${current} items`);

    await sleep(rand(2000, 3000));

    if (current === prevCount) {
      stuck++;
    } else {
      stuck = 0;
      prevCount = current;
    }
  }

  console.log(`[+] Search "${keyword}": ${collected.length} unique posts`);
  await page.close();

  // De-duplicate: only keep the response that contains each unique post
  const uniquePosts = new Map<string, unknown>();
  for (const resp of collected) {
    const data = resp as { itemList?: Array<{ id?: string }>; item_list?: Array<{ id?: string }> };
    for (const v of (data?.itemList || data?.item_list || [])) {
      if (v?.id) uniquePosts.set(v.id, resp);
    }
  }

  return parseTikTokResponses(Array.from(uniquePosts.values()), keyword);
}

/**
 * Alias for crawlSearch — backward compatibility.
 */
export const crawlTikTokSearch = crawlSearch;

// ─── Parse raw API → CrawledPost[] ─────────────────────────────────────────

export function parseTikTokResponses(responses: unknown[], targetHashtag?: string): CrawledPost[] {
  const normTag = targetHashtag ? targetHashtag.replace(/^#+/, '').toLowerCase() : null;
  const posts: CrawledPost[] = [];
  let skippedNoTag = 0;
  for (const resp of responses) {
    const data = resp as { itemList?: TikTokVideoItem[]; item_list?: TikTokVideoItem[] };
    for (const v of data?.itemList || data?.item_list || []) {
      const post = videoToPost(v);
      // Filter: skip posts that DON'T contain the target hashtag (wrong recommendations)
      if (normTag) {
        const postTags = (post.content ?? '').match(/#[\p{L}0-9_À-ỹ]+/gu) ?? [];
        const postTagsNorm = postTags.map(t => t.replace(/^#+/, '').toLowerCase());
        if (!postTagsNorm.includes(normTag)) {
          skippedNoTag++;
          continue; // discard wrong posts
        }
      }
      posts.push(post);
    }
  }
  if (skippedNoTag > 0) {
    console.log(`    [filtered: ${skippedNoTag} posts without #${normTag} — discarded]`);
  }
  return posts;
}

function videoToPost(video: TikTokVideoItem): CrawledPost {
  const postedAt = new Date((video.createTime ?? 0) * 1000);
  const stats = video.stats ?? {};

  const views = Number(stats.playCount ?? 0);
  const reactions = Number(stats.diggCount ?? 0);
  const comments = Number(stats.commentCount ?? 0);
  const shares = Number(stats.shareCount ?? 0);
  const profile = video.author?.uniqueId ?? '';
  const profileId = video.author?.id ?? '';
  const content = video.desc ?? '';

  // Extract non-TikTok URLs from content
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const urlMatches = content.match(urlRe) ?? [];
  const externalLinks = urlMatches
    .filter(l => {
      const l2 = l.toLowerCase();
      return !l2.includes('tiktok') &&
             !l2.includes('tiktokcdn') &&
             !l2.includes('ibytedtos') &&
             !l2.includes('tiktokv') &&
             !l2.includes('byteintl') &&
             !l2.includes('akamaized');
    })
    .map(l => l.replace(/[\\",\]\}]+$/, ''));

  return {
    post_id: video.id ?? '',
    platform: 'tiktok',
    profile,
    profile_id: profileId,
    content,
    posted_at: postedAt.toISOString(),
    week_start: toWeekStart(postedAt),
    week_number: isoWeekNumber(postedAt),
    year: isoYear(postedAt),
    views,
    reactions,
    comments,
    shares,
    link: `https://www.tiktok.com/@${profile}/video/${video.id}`,
    external_links: [...new Set(externalLinks)],
    raw: video,
  };
}

// ─── High-level: crawl by brand handle ─────────────────────────────────────

export interface CrawlResult {
  handle: string;
  posts: CrawledPost[];
  postsAd: number;
  postsSeeding: number;
  errors: string[];
}

/**
 * Crawl a brand handle (profile) + optionally classify post types.
 *
 * @param handle       TikTok handle (e.g. "@tigerbeervietnam" or "tigerbeervietnam")
 * @param brandHandles Set of official brand handles for AD classification
 */
export async function crawlBrand(
  handle: string,
  brandHandles?: Set<string>,
): Promise<CrawlResult> {
  const clean = handle.replace('@', '').trim();

  const posts = await crawlProfile(clean);
  const errors: string[] = [];

  const brandSet = brandHandles ?? BRAND_HANDLES;
  const postsAd = posts.filter(p => classifyPostType(p, brandSet) === 'ad').length;
  const postsSeeding = posts.length - postsAd;

  return { handle: clean, posts, postsAd, postsSeeding, errors };
}

/**
 * Classify a post as AD (brand official) or SEEDING (user/UGC).
 */
export function classifyPostType(
  post: CrawledPost,
  brandHandles: Set<string>,
): 'ad' | 'seeding' {
  const profile = (post.profile || '').toLowerCase().replace('@', '');

  for (const handle of brandHandles) {
    if (profile.includes(handle) || handle.includes(profile)) {
      return 'ad';
    }
  }

  // Pattern match on known brands
  for (const pattern of BRAND_PATTERNS) {
    if (pattern.test(profile)) return 'ad';
  }

  return 'seeding';
}

// ─── Brand handles for classification ────────────────────────────────────────

export const BRAND_HANDLES = new Set([
  'tigerbeervietnam', 'tigerbeer',
  'heinekenvietnam', 'heineken_vn',
  'saigonbeer_official', 'saigonbeer', 'biasaigon', 'biasaigonngon',
  'laruebeer',
  'budweiser_vn', 'budweiser',
  'nutifood_official',
  'idpvietnam',
  'kunvietnam',
  'vinamilk',
  'thtruemilk',
  'dutchladyvietnam',
  'thtrue_milk',
  'heineken',
]);

const BRAND_PATTERNS = [
  /tiger/i, /heineken/i, /saigon/i, /larue/i, /budweiser/i,
  /nutifood/i, /idp/i, /kun/i, /vinamilk/i, /thtrue/i,
  /dutch.?lady/i, /bia.?saigon/i,
];

// ─── TikTok API type ──────────────────────────────────────────────────────────

interface TikTokVideoItem {
  id?: string;
  createTime?: number;
  desc?: string;
  author?: { uniqueId?: string; id?: string };
  stats?: {
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
    playCount?: number;
  };
}
