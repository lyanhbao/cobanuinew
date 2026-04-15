/**
 * Save LLM-selected hashtags to brand_hashtag table
 *
 * Usage:
 *   node --import tsx/esm lib/crawl/save-hashtags-to-db.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', '..', 'artifacts', 'crawl-logs');
const RANKED_PATH = join(OUT_DIR, 'csv-hashtags-ranked.json');
const SELECTED_PATH = join(OUT_DIR, 'csv-hashtags-llm-selected.json');

// Tiger Beer curated_brand ID
const BRAND_ID = 'a0000001-0000-0000-0000-000000000001';

async function main() {
  const ranked = JSON.parse(readFileSync(RANKED_PATH, 'utf-8'));
  const selected = JSON.parse(readFileSync(SELECTED_PATH, 'utf-8'));

  // Build quick lookup from ranked
  const rankedMap = {};
  for (const h of ranked) {
    rankedMap[h.hashtag] = h;
  }

  console.log(`[i] Saving ${selected.length} LLM-selected hashtags to DB...`);

  // Import pg dynamically (same as lib/crawl/db.ts pattern)
  const { default: pg } = await import('pg');
  const { Pool } = pg;

  // Read DB URL from .env.local
  const envContent = readFileSync(join(__dirname, '..', '..', '.env.local'), 'utf-8');
  const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (!dbUrlMatch) throw new Error('DATABASE_URL not found in .env.local');

  const pool = new Pool({ connectionString: dbUrlMatch[1] });

  for (const s of selected) {
    // hashtag stored with '#' prefix in s.hashtag, e.g. '#khaixuanbanlinh'
    const tagRaw = String(s.hashtag).replace(/^#+/, '').toLowerCase();
    const rankedData = rankedMap[tagRaw] ?? {};

    const count = rankedData.count ?? 0;
    const totalViews = rankedData.totalViews ?? 0;
    const avgViews = rankedData.avgViewsPerPost ?? 0;
    const engRate = rankedData.engagementRate ?? 0;
    const profiles = Array.isArray(rankedData.profiles) ? rankedData.profiles.length : 0;
    const firstSeen = rankedData.first_seen ?? null;
    const lastSeen = rankedData.last_seen ?? null;
    const score = rankedData.score ?? 0;

    await pool.query(`
      INSERT INTO brand_hashtag (
        curated_brand_id, platform, hashtag, hashtag_lower, source,
        campaign_name, classification, post_count, total_views,
        avg_views_per_post, engagement_rate, unique_profiles,
        score, priority, reason, expected_volume,
        first_seen_at, last_seen_at, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)
      ON CONFLICT (curated_brand_id, platform, hashtag_lower, source)
      DO UPDATE SET
        post_count = EXCLUDED.post_count,
        total_views = EXCLUDED.total_views,
        avg_views_per_post = EXCLUDED.avg_views_per_post,
        engagement_rate = EXCLUDED.engagement_rate,
        unique_profiles = EXCLUDED.unique_profiles,
        score = EXCLUDED.score,
        priority = EXCLUDED.priority,
        reason = EXCLUDED.reason,
        expected_volume = EXCLUDED.expected_volume,
        first_seen_at = EXCLUDED.first_seen_at,
        last_seen_at = EXCLUDED.last_seen_at,
        last_analyzed_at = now(),
        updated_at = now()
    `, [
      BRAND_ID,
      'tiktok',
      `#${tagRaw}`,
      tagRaw,
      'profile', // source = 'profile' (extracted from brand's own posts)
      null, // campaign_name
      s.type ?? 'campaign',
      count,
      totalViews,
      avgViews,
      engRate,
      profiles,
      score,
      s.priority ?? 'medium',
      s.reason ?? 'LLM selected',
      s.expected_volume ?? 'medium',
      firstSeen ? new Date(firstSeen) : null,
      lastSeen ? new Date(lastSeen) : null,
    ]);

    console.log(`  ✓ #${tagRaw} (${s.priority}) — ${count} posts, score ${Math.round(score)}`);
  }

  await pool.end();
  console.log(`\n[+] Saved ${selected.length} hashtags to brand_hashtag table`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});