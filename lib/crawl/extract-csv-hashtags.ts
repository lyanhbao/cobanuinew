/**
 * Extract Hashtags from CSV — COBAN Pipeline
 *
 * Đọc tiktok_data_formatted.csv → trích xuất hashtags từ Message
 * → group theo tần suất + views + date range → pick hashtags có giá trị cao
 * → LLM chọn top hashtags để recrawl
 *
 * Usage:
 *   node --import tsx/esm lib/crawl/extract-csv-hashtags.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '..', '..', 'tiktok scrape', 'tiktok_data_formatted.csv');
const OUT_DIR = join(__dirname, '..', '..', 'artifacts', 'crawl-logs');

// ─── Config ───────────────────────────────────────────────────────────────────

const GENERIC_HASHTAGS = new Set([
  'fyp', 'foryou', 'foryoupage', 'viral', 'tiktok', 'trending',
  'fypシ', 'fypシ︎', 'explore', 'viralclip', 'viraltiktok',
  'tiktokviral', 'trending2025', 'tiktoktrend', 'foryou',
  'xuhuong', 'hot', 'top', 'best',
]);

const BRAND_GENERIC = new Set([
  'tiger', 'heineken', 'budweiser', 'saigon', 'larue',
  'bia', 'beer', 'vietnam', 'vn', 'tigerbeer',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ALL leading #, lowercase — canonical form for map key lookup */
const norm = (ht) => String(ht).replace(/^#+/, '').toLowerCase();

// ─── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function loadCSV(path) {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

// Parse Vietnamese date: "12/18/2025, 3:23:08 PM"
function parseDate(dateStr) {
  if (!dateStr) return null;
  // Try "M/D/YYYY, H:MM:SS AM/PM" format
  const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
  if (m) {
    let month = parseInt(m[1], 10) - 1;
    let day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    let hours = parseInt(m[4], 10);
    const mins = parseInt(m[5], 10);
    const secs = parseInt(m[6], 10);
    const ampm = m[7].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return new Date(year, month, day, hours, mins, secs);
  }
  // Fallback: try native Date parsing
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Extract ─────────────────────────────────────────────────────────────────

function extractHashtags(rows) {
  const hashtagMap = {};

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const content = row['Message'] ?? '';
    const views = parseInt(String(row['Views'] ?? '0').replace(/,/g, ''), 10) || 0;
    const likes = parseInt(String(row['Likes'] ?? '0').replace(/,/g, ''), 10) || 0;
    const comments = parseInt(String(row['Comments'] ?? '0').replace(/,/g, ''), 10) || 0;
    const shares = parseInt(String(row['Shares'] ?? '0').replace(/,/g, ''), 10) || 0;
    const profile = row['Handle'] ?? row['Profile'] ?? 'unknown';
    const postId = row['Post-ID'] ?? `row-${ri}`;
    const date = parseDate(row['Date'] ?? '');
    const engagement = likes + comments + shares;

    // Extract hashtags (supports Vietnamese characters)
    const matches = content.match(/#[\p{L}0-9_À-ỹ]+/gu) || [];

    for (const ht of matches) {
      const htKey = norm(ht); // e.g. 'khaixuanbanlinh'

      if (GENERIC_HASHTAGS.has(htKey)) continue;
      if (htKey.length < 3) continue;

      if (!hashtagMap[htKey]) {
        hashtagMap[htKey] = {
          hashtag: htKey, // stored WITHOUT leading '#'
          count: 0,
          totalViews: 0,
          totalEngagement: 0,
          sampleProfiles: new Set(),
          dates: [],
          firstSeen: null,
          lastSeen: null,
        };
      }

      const e = hashtagMap[htKey];
      e.count++;
      e.totalViews += views;
      e.totalEngagement += engagement;
      e.sampleProfiles.add(profile);
      if (date) e.dates.push(date.getTime());
    }
  }

  // Compute derived metrics + score
  for (const key in hashtagMap) {
    const e = hashtagMap[key];
    e.avgViewsPerPost = e.totalViews / e.count;
    e.engagementRate = e.totalViews > 0 ? (e.totalEngagement / e.totalViews) * 100 : 0;
    e.firstSeen = e.dates.length > 0 ? new Date(Math.min(...e.dates)).toISOString().slice(0, 10) : null;
    e.lastSeen = e.dates.length > 0 ? new Date(Math.max(...e.dates)).toISOString().slice(0, 10) : null;

    const countNorm = Math.min(e.count / 20, 1);
    const viewsNorm = Math.min(e.avgViewsPerPost / 50000, 1);
    const engNorm = Math.min(e.engagementRate / 10, 1);
    const profileNorm = Math.min(e.sampleProfiles.size / 5, 1);

    e.score = (
      countNorm * 0.3 +
      viewsNorm * 0.4 +
      engNorm * 0.2 +
      profileNorm * 0.1
    ) * 100;
  }

  return hashtagMap;
}

// ─── Classify type ────────────────────────────────────────────────────────────

function classify(ht, e) {
  const tag = String(ht).replace(/^#+/, '').toLowerCase();

  if (BRAND_GENERIC.has(tag)) return 'brand';
  if (/^(tet|tết|newyear|khaixuan|khai_xuan|summer|remix|streetfootball|street_football|khaixuanbanlinh|sanlocbanlinh)/.test(tag)) return 'campaign';
  if (/^\d{4}$/.test(tag) || /^(moi|khoi|ra_mat|ban_pham|crystal|coolpack|soju|nang Bong Vang|nangbongvang)/.test(tag)) return 'product';
  if (e.count > 5 && e.sampleProfiles.size > 2) return 'viral';
  if (e.score > 50) return 'campaign';
  return 'unknown';
}

// ─── LLM: select hashtags to recrawl ─────────────────────────────────────────

async function llmSelectHashtags(hashtagMap, sortedHashtags, brandHandles) {
  // Sort by score and take top 30
  const sorted = Object.values(hashtagMap)
    .filter(h => classify(h.hashtag, h) !== 'brand')
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const hashtagsList = sorted.map((h, i) => {
    const type = classify(h.hashtag, h);
    return `${i + 1}. #${h.hashtag}
   - posts: ${h.count} | avg_views: ${Math.round(h.avgViewsPerPost).toLocaleString()} | profiles: ${h.sampleProfiles.size}
   - score: ${Math.round(h.score)} | type: ${type} | date_range: ${h.firstSeen ?? '?'} → ${h.lastSeen ?? '?'}
   - engagement_rate: ${h.engagementRate.toFixed(1)}%`;
  }).join('\n');

  const prompt = `Bạn là chuyên gia marketing TikTok Việt Nam.

Từ danh sách hashtags được trích xuất từ các bài đăng của thương hiệu Tiger Beer, hãy chọn những hashtags CÓ GIÁ TRỊ nhất để recrawl (tìm thêm seeding/UGC posts từ hashtag đó).

Danh sách hashtags (đã sort theo score giảm dần, top 30):

${hashtagsList}

Brand handles (official — bỏ qua nếu hashtag chỉ có brand handle):
${brandHandles.map(h => `  - ${h}`).join('\n')}

Qui tắc chọn:
1. Ưu tiên hashtag campaign (Tiger Remix, Tiger Street Football, Tết, Kai Xuân, #SanLocBanLinh...)
2. Ưu tiên hashtag product (Tiger Crystal, Tiger Soju, Tiger Coolpack, #NangBongVang...)
3. Ưu tiên hashtag có nhiều unique profiles (seeding = nhiều người dùng khác nhau)
4. Bỏ qua hashtag brand generic (#tiger, #tigerbeer)
5. Chọn 5-10 hashtags tốt nhất

Trả về JSON array, KHÔNG thêm text giải thích. Bắt đầu:
[`;

  const MODEL = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001';
  const API_KEY = process.env.ANTHROPIC_API_KEY ?? 'sk-aa0b3799a224a979a3efa137a7e8f7046543f87e47903dcad1ead586ec4c04b8';
  const BASE_URL = process.env.ANTHROPIC_BASE_URL ?? 'http://pro-x.io.vn';

  console.log(`[*] LLM model: ${MODEL}`);
  const url = BASE_URL.endsWith('/') ? `${BASE_URL}v1/messages` : `${BASE_URL}/v1/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Extract usage info
  const usage = data.usage ?? {};
  const totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
  console.log(`[*] LLM usage: ${usage.input_tokens ?? 0} in | ${usage.output_tokens ?? 0} out | ${totalTokens} total tokens\n`);

  let text = '';
  for (const item of (data.content ?? [])) {
    if (item.type === 'text') { text = item.text; break; }
  }
  if (!text) {
    for (const item of (data.content ?? [])) {
      if (item.type === 'thinking') { text = item.thinking; break; }
    }
  }

  // Save raw response
  if (existsSync(OUT_DIR)) {
    const debugDir = join(OUT_DIR, 'debug');
    if (!existsSync(debugDir)) mkdirSync(debugDir, { recursive: true });
    writeFileSync(join(debugDir, 'csv-hashtag-llm-response.txt'), text ?? '');
    writeFileSync(join(debugDir, 'csv-hashtag-llm-prompt.txt'), prompt);
  }

  // Parse JSON — handle plain string array AND object array
  let parsed = [];

  // Strategy 1: strip markdown first, then parse
  {
    const clean = (text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const raw = JSON.parse(clean);
      if (Array.isArray(raw) && raw.length > 0) {
        if (typeof raw[0] === 'string') {
          // LLM returned plain strings → build objects from auto data
          parsed = raw.map(tag => {
            const clean2 = norm(tag);
            if (!clean2) return null;
            const auto = sortedHashtags.find(h => h.hashtag === clean2);
            return {
              hashtag: `#${clean2}`,
              reason: auto ? `Top-ranked: ${auto.count} posts, score ${auto.score}` : 'LLM selected',
              priority: auto?.score > 60 ? 'high' : 'medium',
              type: auto ? classify(auto.hashtag, auto) : 'campaign',
              expected_volume: auto?.count > 5 ? 'high' : 'medium',
            };
          }).filter(Boolean);
        } else {
          parsed = raw;
        }
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: line-by-line JSON objects
  if (!parsed.length) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try { parsed.push(JSON.parse(trimmed)); } catch { /* skip */ }
      }
    }
  }

  return parsed;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Extract Hashtags from CSV        ║');
  console.log('╚══════════════════════════════════════╝\n');

  const rows = loadCSV(CSV_PATH);
  console.log(`[*] Loaded ${rows.length} posts from CSV\n`);

  // Parse dates
  const dates = rows.map(r => parseDate(r['Date'] ?? '')).filter(Boolean).sort((a, b) => a - b);
  if (dates.length > 0) {
    console.log(`[*] Date range: ${dates[0].toISOString().slice(0, 10)} → ${dates[dates.length - 1].toISOString().slice(0, 10)}`);
  }

  const hashtagMap = extractHashtags(rows);
  const totalHashtags = Object.keys(hashtagMap).length;
  console.log(`[*] Extracted ${totalHashtags} unique hashtags\n`);

  // Sort by score
  const sorted = Object.values(hashtagMap)
    .sort((a, b) => b.score - a.score);

  console.log('═══ Top 20 Hashtags (auto-ranked) ════════════════════════════');
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const h = sorted[i];
    const type = classify(h.hashtag, h);
    console.log(
      `  ${String(i + 1).padStart(2)}. #${h.hashtag.padEnd(25)} ` +
      `${h.count} posts | ${Math.round(h.avgViewsPerPost).toLocaleString()} avg views | ` +
      `${h.sampleProfiles.size} profiles | score: ${Math.round(h.score)} | [${type}]`
    );
    console.log(`       date: ${h.firstSeen ?? '?'} → ${h.lastSeen ?? '?'}`);
  }

  // Save all hashtags
  const outPath = join(OUT_DIR, 'csv-hashtags-ranked.json');
  const saveSorted = sorted.map(h => ({
    ...h,
    first_seen: h.firstSeen,
    last_seen: h.lastSeen,
    profiles: Array.from(h.sampleProfiles),
  }));
  writeFileSync(outPath, JSON.stringify(saveSorted, null, 2));
  console.log(`\n[+] All hashtags → ${outPath}`);

  // LLM selection
  const BRAND_HANDLES = ['@tigerbeervietnam'];
  console.log('\n═══ LLM: Selecting best hashtags for recrawl ════════════════');

  try {
    const selected = await llmSelectHashtags(hashtagMap, sorted, BRAND_HANDLES);
    console.log(`\n[+] LLM selected ${selected.length} hashtags:\n`);
    for (const s of selected) {
      const raw = norm(s.hashtag ?? '');
      const tag = `#${raw}`;
      // Map key = norm form ('khaixuanbanlinh') — direct lookup
      const orig = hashtagMap[raw] ?? Object.values(hashtagMap).find(h =>
        h.hashtag === raw || raw === h.hashtag
      ) ?? {};
      const type = orig.hashtag ? classify(orig.hashtag, orig) : (s.type ?? 'unknown');
      console.log(`  ★ ${tag} (${s.priority ?? 'medium'})`);
      console.log(`    reason: ${s.reason ?? 'n/a'}`);
      console.log(`    type: ${type} | expected: ${s.expected_volume ?? 'medium'}`);
      console.log(`    raw: ${orig.count ?? '?'} posts | ${orig.firstSeen ?? '?'} → ${orig.lastSeen ?? '?'} | ${(orig.sampleProfiles?.size ?? '?')} profiles`);
    }

    const llmOut = join(OUT_DIR, 'csv-hashtags-llm-selected.json');
    writeFileSync(llmOut, JSON.stringify(selected, null, 2));
    console.log(`\n[+] LLM selection → ${llmOut}`);
  } catch (e) {
    console.error(`\n❌ LLM failed: ${e.message}`);
    console.log('\n[*] Falling back to top 10 by auto-score:');
    const fallback = sorted.slice(0, 10).map(h => ({
      hashtag: h.hashtag,
      reason: 'Top-ranked by auto-score',
      priority: 'high',
      type: classify(h.hashtag, h),
      expected_volume: h.count > 5 ? 'high' : 'medium',
    }));
    for (const f of fallback) {
      console.log(`  ★ #${f.hashtag} (${f.type})`);
    }
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message ?? err);
  process.exit(1);
});
