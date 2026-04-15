/**
 * Extract Hashtags — COBAN Pipeline
 *
 * Đọc tiktok_api_data.json → trích xuất hashtags từ content
 * → group theo tần suất → pick hashtags có giá trị cao
 * → output: hashtag candidates cho recrawl
 *
 * Usage:
 *   npx ts-node lib/crawl/extract-hashtags.ts
 *   npx ts-node lib/crawl/extract-hashtags.ts --input data/tiktok_api_data.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TikTokVideo {
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

interface RawResponse {
  handle?: string;
  data?: {
    itemList?: TikTokVideo[];
    item_list?: TikTokVideo[];
  };
  url?: string;
  status?: number;
}

interface ExtractedHashtag {
  hashtag: string;
  count: number;         // Số bài đăng chứa hashtag
  totalViews: number;    // Tổng views của các bài đăng đó
  totalEngagement: number; // Tổng engagement
  sampleProfiles: string[]; // Các profile dùng hashtag này
  avgViewsPerPost: number;
  engagementRate: number;
  score: number;          // Composite score để rank
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GENERIC_HASHTAGS = new Set([
  'fyp', 'foryou', 'foryoupage', 'viral', 'tiktok', 'trending',
  'fypシ', 'fypシ︎', 'explore', 'viralclip', 'viraltiktok',
  'tiktokviral', 'trending2025', 'tiktoktrend', 'foryou',
]);

const BRAND_GENERIC = new Set([
  'tiger', 'heineken', 'budweiser', 'saigon', 'larue',
  'bia', 'beer', 'vietnam', 'vn',
]);

// ─── Extract from JSON ───────────────────────────────────────────────────────

function extractHashtagsFromJson(filepath: string): Map<string, ExtractedHashtag> {
  const raw = readFileSync(filepath, 'utf8');
  const responses: RawResponse[] = JSON.parse(raw);

  const hashtagMap = new Map<string, ExtractedHashtag>();

  for (const resp of responses) {
    const list = resp.data?.itemList || resp.data?.item_list || [];

    for (const video of list) {
      const content = video.desc || '';
      const views = video.stats?.playCount || 0;
      const engagement =
        (video.stats?.diggCount || 0) +
        (video.stats?.commentCount || 0) +
        (video.stats?.shareCount || 0);
      const profile = video.author?.uniqueId || 'unknown';

      // Extract hashtags
      const matches = content.match(/#[\p{L}0-9_À-ỹ]+/gu) || [];

      for (const ht of matches) {
        const htLower = ht.toLowerCase();

        // Skip generic TikTok hashtags
        if (GENERIC_HASHTAGS.has(htLower.replace('#', ''))) continue;

        // Skip very short hashtags (< 3 chars after #)
        if (htLower.replace('#', '').length < 3) continue;

        if (!hashtagMap.has(htLower)) {
          hashtagMap.set(htLower, {
            hashtag: htLower,
            count: 0,
            totalViews: 0,
            totalEngagement: 0,
            sampleProfiles: [],
            avgViewsPerPost: 0,
            engagementRate: 0,
            score: 0,
          });
        }

        const entry = hashtagMap.get(htLower)!;
        entry.count++;
        entry.totalViews += views;
        entry.totalEngagement += engagement;
        if (!entry.sampleProfiles.includes(profile)) {
          entry.sampleProfiles.push(profile);
        }
      }
    }
  }

  // Compute derived metrics
  for (const entry of hashtagMap.values()) {
    entry.avgViewsPerPost = entry.totalViews / entry.count;
    entry.engagementRate = entry.totalViews > 0
      ? (entry.totalEngagement / entry.totalViews) * 100
      : 0;

    // Composite score:
    // - count (frequency): weight 0.3
    // - avgViewsPerPost (quality): weight 0.4
    // - engagementRate: weight 0.2
    // - uniqueProfiles (organic): weight 0.1
    const countNorm = Math.min(entry.count / 20, 1);          // normalize: 20 posts = max
    const viewsNorm = Math.min(entry.avgViewsPerPost / 50000, 1); // 50K avg views = max
    const engNorm = Math.min(entry.engagementRate / 10, 1);     // 10% ER = max
    const profileNorm = Math.min(entry.sampleProfiles.length / 5, 1); // 5 profiles = max

    entry.score = (
      countNorm * 0.3 +
      viewsNorm * 0.4 +
      engNorm * 0.2 +
      profileNorm * 0.1
    ) * 100;
  }

  return hashtagMap;
}

// ─── Pick best hashtags ────────────────────────────────────────────────────────

interface HashtagPick {
  hashtag: string;
  reason: string;
  posts: number;
  avgViews: number;
  score: number;
  type: 'campaign' | 'product' | 'brand' | 'viral' | 'unknown';
}

function pickBestHashtags(
  hashtagMap: Map<string, ExtractedHashtag>,
  topN = 20,
): HashtagPick[] {
  // Sort by score descending
  const sorted = Array.from(hashtagMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return sorted.map(e => {
    // Classify type
    let type: HashtagPick['type'] = 'unknown';
    let reason = '';

    const ht = e.hashtag.replace('#', '').toLowerCase();

    if (BRAND_GENERIC.has(ht)) {
      type = 'brand';
      reason = `Brand generic (${e.count} posts, ${e.sampleProfiles.length} profiles)`;
    } else if (/^(tet|tết|newyear|xuan|chuang|trungthu|summer|he2025)/.test(ht)) {
      type = 'campaign';
      reason = `Seasonal/campaign hashtag (score: ${Math.round(e.score)})`;
    } else if (/^\d{4}$/.test(ht) || /^(moi|khoi|ra_mat|ban_pham)/.test(ht)) {
      type = 'product';
      reason = `Product launch keyword detected`;
    } else if (e.count > 10 && e.sampleProfiles.length > 3) {
      type = 'viral';
      reason = `Viral trend (${e.count} posts, ${e.sampleProfiles.length} unique profiles)`;
    } else if (e.score > 50) {
      type = 'campaign';
      reason = `High-value hashtag (score: ${Math.round(e.score)}, ${e.avgViewsPerPost.toLocaleString()} avg views)`;
    } else {
      reason = `Moderate signal (score: ${Math.round(e.score)})`;
    }

    return {
      hashtag: e.hashtag,
      reason,
      posts: e.count,
      avgViews: e.avgViewsPerPost,
      score: Math.round(e.score),
      type,
    };
  });
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const inputFile = args.find(a => !a.startsWith('--')) || 'tiktok_api_data.json';
  const topN = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] ?? '20', 10);
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1]
    || 'hashtag-candidates.json';

  // Resolve path — cwd may already be 'tiktok scrape', so avoid double-path
  let inputPath: string;
  if (process.cwd().endsWith('tiktok scrape') || process.cwd().endsWith('tiktok scrape/')) {
    inputPath = join(process.cwd(), inputFile);
  } else {
    inputPath = join(process.cwd(), 'tiktok scrape', inputFile);
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Extract Hashtags — COBAN Pipeline   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`[*] Input:  ${inputPath}`);
  console.log(`[*] Top N:  ${topN}\n`);

  // Check file exists
  try {
    readFileSync(inputPath, 'utf8');
  } catch {
    console.error(`❌ File not found: ${inputPath}`);
    console.error('   → Chạy bot trước: node bot.js "@tigerbeervietnam"');
    process.exit(1);
  }

  const hashtagMap = extractHashtagsFromJson(inputPath);
  console.log(`[+] Extracted: ${hashtagMap.size} unique hashtags\n`);

  const picks = pickBestHashtags(hashtagMap, topN);

  console.log('═══ Top Hashtags ══════════════════════════════════════');
  for (const p of picks) {
    const typeLabel = `[${p.type.padEnd(10)}]`;
    console.log(
      `  ${typeLabel} ${p.hashtag.padEnd(25)} ` +
      `(${p.posts} posts | ${Math.round(p.avgViews).toLocaleString()} avg views | score: ${p.score})`
    );
    console.log(`           → ${p.reason}`);
  }

  // Save candidates for recrawl
  const output = {
    generated_at: new Date().toISOString(),
    source_file: inputFile,
    total_hashtags: hashtagMap.size,
    candidates: picks,
  };

  writeFileSync(join(process.cwd(), outputFile), JSON.stringify(output, null, 2));
  console.log(`\n[+] Saved → ${outputFile}`);

  // Save for campaign-agent (brand-centric format per campaign-agent.md)
  const campaignBatch = picks
    .filter(p => p.type !== 'brand' && p.type !== 'unknown')
    .map(p => ({
      brand_id: '',
      brand_name: 'TikTok Search',
      hashtag: p.hashtag,
      campaign: p.hashtag.replace('#', ''),
      campaign_type: p.type,
      confidence: p.score > 50 ? 'high' : 'medium',
      platform: 'tiktok',
    }));

  const batchFile = join(process.cwd(), 'agents', 'crawl', 'campaign-batch.json');
  writeFileSync(batchFile, JSON.stringify(campaignBatch, null, 2));
  console.log(`[+] Campaign batch → ${batchFile} (${campaignBatch.length} hashtags)`);
}

main().catch(err => {
  console.error('[UNCAUGHT]', err);
  process.exit(1);
});