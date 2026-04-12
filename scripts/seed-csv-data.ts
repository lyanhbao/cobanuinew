/**
 * Seed script: imports CSV competitor data into the COBAN database.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm ts-node scripts/seed-csv-data.ts
 *   # or
 *   npx ts-node scripts/seed-csv-data.ts
 *
 * What it does (in a single transaction):
 *   1. Creates a demo account + client + group if they don't exist
 *   2. Creates curated_brand records: KUN, Nutricare
 *   3. Creates brand records linking curated brands to the demo group
 *   4. Inserts all parsed post records (idempotent via ON CONFLICT DO NOTHING)
 *   5. Creates brand_aliases for name normalization
 *   6. Aggregates and upserts weekly_stats
 *   7. Upserts weekly_report for the group
 *
 * Idempotent: existing records are skipped (ON CONFLICT DO NOTHING / DO UPDATE
 * for stats). Run as many times as you want.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── CSV parsing (mirrors application/ingestion/CsvParser.ts) ─────────────────

const PLATFORM_MAP: Record<string, string> = {
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  TIKTOK: 'tiktok',
};

const FORMAT_MAP: Record<string, string> = {
  Image: 'Image',
  Video: 'Video',
  'True view': 'True view',
  Bumper: 'Bumper',
  Short: 'Short',
  Story: 'Story',
  Carousel: 'Carousel',
};

const YT_FORMAT_MAP: Record<string, string> = {
  Short: 'Short',
  Normal: 'Normal',
};

interface RawCsvRow {
  'Post Date': string;
  Profile: string;
  Network: string;
  Format: string;
  Cost: string;
  Message: string;
  'Reactions, Comments & Shares': string;
  Link: string;
  'Messag ID': string;
  Views: string;
  Duration: string;
  Advertiser: string;
  Brand: string;
  Categories: string;
  Impression: string;
  'YT Format': string;
}

interface ParsedCsvRow {
  platform: string;
  post_id: string;
  content: string;
  posted_at: Date;
  week_start: string;
  week_number: number;
  year: number;
  format: string | null;
  yt_format: string | null;
  cost: number;
  views: number;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  duration: number | null;
  link: string;
  advertiser: string;
  profile: string;
  brands: string[];
  categories: string[];
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

function parseCurrency(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replace(/[^\d,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseReactions(value: string): { reactions: number; comments: number; shares: number } {
  const trimmed = value.trim();
  if (!trimmed) return { reactions: 0, comments: 0, shares: 0 };
  const cleaned = trimmed.replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return { reactions: num, comments: 0, shares: 0 };
  }
  const parts = trimmed.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
    return { reactions: parts[0]!, comments: parts[1]!, shares: parts[2]! };
  }
  if (parts.length === 2 && parts.every((p) => !isNaN(p))) {
    return { reactions: parts[0]!, comments: parts[1]!, shares: 0 };
  }
  return { reactions: 0, comments: 0, shares: 0 };
}

function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num;
}

function safeNum(n: number): number {
  return isNaN(n) || !isFinite(n) ? 0 : Math.round(n * 100) / 100;
}

function trunc255(s: string): string {
  return s.length > 255 ? s.slice(0, 255) : s;
}

function trunc500(s: string): string {
  return s.length > 500 ? s.slice(0, 500) : s;
}

function parseJsonArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[]') return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [String(parsed)];
  } catch {
    const matches = trimmed.match(/"([^"]+)"/g);
    if (matches) return matches.map((m) => m.slice(1, -1));
    return [trimmed];
  }
}

function parseCsvLine(line: string): RawCsvRow | null {
  if (!line.trim()) return null;
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += char;
    i++;
  }
  result.push(current.trim());
  const headers = [
    'Post Date', 'Profile', 'Network', 'Format', 'Cost',
    'Message', 'Reactions, Comments & Shares', 'Link', 'Messag ID',
    'Views', 'Duration', 'Advertiser', 'Brand', 'Categories',
    'Impression', 'YT Format',
  ];
  if (result.length < headers.length) return null;
  const row: Partial<RawCsvRow> = {};
  headers.forEach((h, idx) => {
    (row as Record<string, string>)[h] = result[idx] ?? '';
  });
  return row as RawCsvRow;
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function toWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function safeDateStr(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function toWeekEnd(weekStart: string): string {
  // Handle both string (ISO date) and Date object from pg driver
  const s = typeof weekStart === 'string' ? weekStart : String(weekStart);
  const d = new Date(s.startsWith('20') ? s + 'T00:00:00.000Z' : s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function mapRow(raw: RawCsvRow): ParsedCsvRow | null {
  const postDate = parseDate(raw['Post Date']);
  if (!postDate) return null;
  const platform = PLATFORM_MAP[raw['Network'].trim().toUpperCase()];
  if (!platform) return null;
  // post_id is "NA" for all rows; generate a stable post_id from advertiser + link + profile
  const advertiser = raw['Advertiser'].trim();
  const link = raw['Link'].trim();
  const postId = link
    || `${raw['Profile'].trim()}_${raw['Post Date'].trim()}_${raw['Network'].trim()}`;
  if (!postId) return null;
  const weekStartDate = toWeekStart(postDate);
  const weekNumber = isoWeekNumber(postDate);
  const year = postDate.getFullYear();
  const reactionsData = parseReactions(raw['Reactions, Comments & Shares']);
  return {
    platform,
    post_id: postId,
    content: raw['Message'].trim(),
    posted_at: postDate,
    week_start: weekStartDate,
    week_number: weekNumber,
    year,
    format: FORMAT_MAP[raw['Format'].trim()] ?? null,
    yt_format: YT_FORMAT_MAP[raw['YT Format'].trim()] ?? null,
    cost: parseCurrency(raw['Cost']),
    views: parseNumber(raw['Views']),
    impressions: parseNumber(raw['Impression']),
    reactions: reactionsData.reactions,
    comments: reactionsData.comments,
    shares: reactionsData.shares,
    duration: raw['Duration'].trim() ? parseFloat(raw['Duration']) : null,
    link: raw['Link'].trim(),
    advertiser: advertiser,
    profile: raw['Profile'].trim(),
    brands: parseJsonArray(raw['Brand']),
    categories: parseJsonArray(raw['Categories']),
  };
}

function parseCsv(content: string): ParsedCsvRow[] {
  const results: ParsedCsvRow[] = [];
  // Accumulate records, treating newlines inside quoted fields as spaces
  const records: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    const next = content[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        currentLine += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) records.push(currentLine);
      currentLine = '';
      i++;
      continue;
    }
    if (char === '\n' && inQuotes) {
      // Literal newline inside quoted field — preserve as a space
      currentLine += ' ';
      i++;
      continue;
    }
    if (char === '\r') { i++; continue; }
    currentLine += char;
    i++;
  }
  if (currentLine.trim()) records.push(currentLine);
  const headerIdx = records.findIndex((l) => l.trim().length > 0);
  if (headerIdx === -1) return results;
  for (let j = headerIdx + 1; j < records.length; j++) {
    const raw = parseCsvLine(records[j]!);
    if (!raw) continue;
    const mapped = mapRow(raw);
    if (!mapped) continue;
    results.push(mapped);
  }
  return results;
}

// ─── Brand normalization ───────────────────────────────────────────────────────

/**
 * Normalize a brand name string from CSV to a canonical curated_brand name.
 * Handles variants: "Kun", "KUN", "lof_kun" → "KUN"
 *                   "NUTRICARE - THƯƠNG HIỆU QUỐC GIA..." → "Nutricare"
 */
function normalizeBrandName(name: string): string {
  const s = name.trim();
  if (!s) return '';
  const upper = s.toUpperCase();
  if (upper === 'KUN') return 'KUN';
  if (upper === 'LOF_KUN') return 'KUN';
  if (upper === 'IDP') return 'KUN';
  if (upper.includes('NUTRICARE')) return 'Nutricare';
  return s;
}

// ─── DB connection ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('  Example: DATABASE_URL="postgresql://user:pass@127.0.0.1:5433/coban" pnpm ts-node scripts/seed-csv-data.ts');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

interface QueryResult {
  rows: unknown[];
  rowCount: number;
}

async function query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
  const result: QueryResult = await pool.query(sql, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

// ─── Main seed logic ─────────────────────────────────────────────────────────

interface WeekAggregate {
  week_start: string;
  week_end: string;
  week_number: number;
  year: number;
  canonical_name: string;
  curated_brand_id: string;
  brand_id: string;
  total_posts: number;
  total_views: number;
  total_impressions: number;
  total_reactions: number;
  total_comments: number;
  total_shares: number;
  total_cost: number;
  network_breakdown: Record<string, number>;
  format_breakdown: Record<string, number>;
}

async function main() {
  const startTime = Date.now();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  COBAN CSV Seed Script');
  console.log('══════════════════════════════════════════════════════\n');

  // ── Step 1: Parse CSV ─────────────────────────────────────────────────────
  console.log('[1/7] Parsing CSV file...');
  const csvPath = resolve(__dirname, '..', 'total data dairy 12_3 - Competitor (1).csv');
  let csvContent: string;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch {
    console.error(`  ERROR: Could not read CSV at: ${csvPath}`);
    console.error('  Make sure the CSV file exists in the project root.');
    process.exit(1);
  }
  const rows = parseCsv(csvContent);
  console.log(`  Parsed ${rows.length.toLocaleString('vi-VN')} rows from CSV`);
  if (rows.length === 0) {
    console.error('  ERROR: No valid rows parsed from CSV. Check the file format.');
    process.exit(1);
  }

  // ── Step 2: Create demo account/client/group ─────────────────────────────
  console.log('\n[2/7] Setting up demo account, client, and group...');

  // Upsert demo account
  const accountResult = await query<{ id: string }>(`
    INSERT INTO account (name, type, plan, country, timezone, billing_email)
    VALUES ('COBAN Demo', 'agency', 'startup', 'VN', 'Asia/Ho_Chi_Minh', 'demo@coban.vn')
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  const accountId = accountResult.rows[0]?.id;
  const existingAccount = await query<{ id: string }>(`SELECT id FROM account WHERE name = 'COBAN Demo' LIMIT 1`);
  const accId = accountId ?? existingAccount.rows[0]?.id;
  console.log(`  Account: ${accId}`);

  // Upsert demo client
  const clientResult = await query<{ id: string }>(`
    INSERT INTO client (account_id, name, industry)
    VALUES ($1, 'Dairy & Nutrition Demo', 'food_beverage')
    ON CONFLICT ON CONSTRAINT unique_account_client_name DO UPDATE SET name = EXCLUDED.name
    RETURNING id
    `, [accId]);
  const clientId = clientResult.rows[0].id;
  console.log(`  Client:  ${clientId}`);

  // Upsert demo group
  const groupResult = await query<{ id: string }>(`
    INSERT INTO "group" (client_id, name)
    VALUES ($1, 'Dairy Competitors')
    ON CONFLICT ON CONSTRAINT unique_client_group_name DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [clientId]);
  const groupId = groupResult.rows[0].id;
  console.log(`  Group:   ${groupId}`);

  // ── Step 3: Create curated brands ──────────────────────────────────────────
  console.log('\n[3/7] Creating/upserting curated brands...');

  const brandsToUpsert = [
    { name: 'KUN', slug: 'kun', advertiser: 'IDP', categories: ['Drinking yogurt', 'Liquid Milk'] },
    { name: 'Nutricare', slug: 'nutricare', advertiser: 'Nutricare', categories: ['Infant formula', 'Growing up milk'] },
  ];

  const curatedBrandIds: Record<string, string> = {};
  for (const b of brandsToUpsert) {
    const result = await query<{ id: string }>(`
      INSERT INTO curated_brand (name, slug, advertiser, categories)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slug) DO UPDATE SET advertiser = EXCLUDED.advertiser, categories = EXCLUDED.categories, name = EXCLUDED.name
      RETURNING id
    `, [b.name, b.slug, b.advertiser, b.categories]);
    curatedBrandIds[b.name] = result.rows[0].id;
    console.log(`  CuratedBrand: ${b.name} → ${result.rows[0].id}`);
  }

  // ── Step 4: Create brand records in the group ─────────────────────────────
  console.log('\n[4/7] Creating brand records (linking curated brands to group)...');

  const brandRecords: Record<string, string> = {};
  for (const [name, curatedId] of Object.entries(curatedBrandIds)) {
    const isPrimary = name === 'KUN';
    const result = await query<{ id: string }>(`
      INSERT INTO brand (curated_brand_id, group_id, is_primary, crawl_status, last_crawl_at)
      VALUES ($1, $2, $3, 'ready', now())
      ON CONFLICT ON CONSTRAINT unique_group_curated DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        crawl_status = 'ready',
        last_crawl_at = now()
      RETURNING id
    `, [curatedId, groupId, isPrimary]);
    brandRecords[name] = result.rows[0].id;
    console.log(`  Brand: ${name} → ${result.rows[0].id} ${isPrimary ? '(PRIMARY)' : ''}`);
  }

  // ── Step 5: Insert posts ──────────────────────────────────────────────────
  console.log('\n[5/7] Inserting posts...');

  // Collect all canonical brand names that appear in the data
  const canonicalNames = new Set<string>();
  for (const row of rows) {
    for (const b of row.brands) {
      const canonical = normalizeBrandName(b);
      if (canonical && curatedBrandIds[canonical]) {
        canonicalNames.add(canonical);
      }
    }
  }

  // Batch insert posts for performance
  const BATCH_SIZE = 500;
  let postsInserted = 0;
  let postsSkipped = 0;
  let totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchRows = rows.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const row of batchRows) {
      // Determine the curated_brand_id for this post.
      // Prefer KUN, then Nutricare, based on what appears in the brands array.
      let matchedBrandId: string | null = null;
      let matchedCuratedId: string | null = null;
      for (const b of row.brands) {
        const canonical = normalizeBrandName(b);
        if (curatedBrandIds[canonical]) {
          matchedCuratedId = curatedBrandIds[canonical];
          matchedBrandId = brandRecords[canonical];
          break;
        }
      }
      if (!matchedCuratedId) continue; // Skip rows with no matching brand

      const weekStartDate = toWeekStart(row.posted_at);
      placeholders.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      values.push(
        matchedCuratedId,
        row.platform,
        row.post_id,
        row.content,
        row.posted_at.toISOString(),
        weekStartDate,
        row.format,
        row.yt_format,
        row.cost,
        row.views,
        row.impressions,
        (row.reactions + row.comments + row.shares),
        row.duration,
        row.link,
        row.advertiser,
        row.profile,
      );
    }

    if (placeholders.length === 0) continue;

    // Insert posts with brands/categories as separate JSONB arrays
    // (We store them as the CSV provided, not canonicalized)
    const insertSql = `
      INSERT INTO post (
        curated_brand_id, platform, post_id, content, posted_at, week_start,
        format, yt_format, cost, views, impressions, reactions, duration,
        link, advertiser, profile,
        brands, categories
      )
      SELECT * FROM (VALUES ${placeholders.join(', ')}) AS t(
        curated_brand_id, platform, post_id, content, posted_at, week_start,
        format, yt_format, cost, views, impressions, reactions, duration,
        link, advertiser, profile
      )
      CROSS JOIN (SELECT $${paramIdx++}::jsonb AS brands, $${paramIdx++}::jsonb AS categories) AS meta
      ON CONFLICT (platform, post_id) DO NOTHING
    `;

    // Since CROSS JOIN doesn't work cleanly with parameterized VALUES,
    // let's do a simpler approach: add brands/categories as additional params per row
    // Re-build with brands/categories in the VALUES
    const values2: unknown[] = [];
    const placeholders2: string[] = [];
    let paramIdx2 = 1;

    for (const row of batchRows) {
      let matchedCuratedId: string | null = null;
      for (const b of row.brands) {
        const canonical = normalizeBrandName(b);
        if (curatedBrandIds[canonical]) {
          matchedCuratedId = curatedBrandIds[canonical];
          break;
        }
      }
      if (!matchedCuratedId) continue;

      const weekStartDate = toWeekStart(row.posted_at);
      placeholders2.push(
        `($${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}, $${paramIdx2++}::jsonb, $${paramIdx2++}::jsonb)`
      );
      values2.push(
        matchedCuratedId,
        row.platform,
        trunc255(row.post_id),
        trunc255(row.content),
        row.posted_at.toISOString(),
        weekStartDate,
        row.format,
        row.yt_format,
        safeNum(row.cost),
        safeNum(row.views),
        safeNum(row.impressions),
        safeNum(safeNum(row.reactions) + safeNum(row.comments) + safeNum(row.shares)),
        row.duration !== null && !isNaN(row.duration) ? row.duration : null,
        trunc500(row.link),
        trunc255(row.advertiser),
        trunc255(row.profile),
        JSON.stringify(row.brands),
        JSON.stringify(row.categories),
      );
    }

    if (values2.length === 0) continue;

    const result = await query(`
      INSERT INTO post (
        curated_brand_id, platform, post_id, content, posted_at, week_start,
        format, yt_format, cost, views, impressions, reactions, duration,
        link, advertiser, profile, brands, categories
      )
      VALUES ${placeholders2.join(', ')}
      ON CONFLICT (platform, post_id) DO NOTHING
    `, values2);

    postsInserted += result.rowCount ?? 0;
    postsSkipped += (batchRows.length - (result.rowCount ?? 0));

    if ((batch + 1) % 5 === 0 || batch === totalBatches - 1) {
      process.stdout.write(`\r  Progress: ${Math.min((batch + 1) * BATCH_SIZE, rows.length).toLocaleString('vi-VN')} / ${rows.length.toLocaleString('vi-VN')} rows`);
    }
  }
  console.log(`\n  Posts inserted: ${postsInserted.toLocaleString('vi-VN')}`);
  console.log(`  Posts skipped (duplicate): ${postsSkipped.toLocaleString('vi-VN')}`);

  // ── Step 6: Create brand_aliases ──────────────────────────────────────────
  console.log('\n[6/7] Creating brand aliases for normalization...');

  // Known aliases from CSV data
  const aliasesToUpsert = [
    { curatedBrand: 'KUN', alias: 'Kun' },
    { curatedBrand: 'KUN', alias: 'kun' },
    { curatedBrand: 'KUN', alias: 'lof_kun' },
    { curatedBrand: 'Nutricare', alias: 'NUTRICARE - THƯƠNG HIỆU QUỐC GIA DINH DƯỠNG Y HỌC' },
  ];

  for (const { curatedBrand, alias } of aliasesToUpsert) {
    const curatedId = curatedBrandIds[curatedBrand];
    if (!curatedId) continue;
    await query(`
      INSERT INTO brand_alias (curated_brand_id, alias)
      VALUES ($1, $2)
      ON CONFLICT (alias) DO NOTHING
    `, [curatedId, alias]);
  }
  console.log(`  Upserted ${aliasesToUpsert.length} brand aliases`);

  // ── Step 7: Aggregate weekly_stats ──────────────────────────────────────
  console.log('\n[7/7] Aggregating weekly stats and generating weekly report...');

  // Aggregate from post table grouped by brand × week
  const aggResult = await query<{
    week_start: string;
    week_number: number;
    year: number;
    curated_brand_id: string;
    brand_id: string;
    total_posts: string;
    total_views: string;
    total_impressions: string;
    total_reactions: string;
    total_comments: string;
    total_shares: string;
    total_cost: string;
    network_breakdown: Record<string, number>;
    format_breakdown: Record<string, number>;
    yt_short_views: string;
    yt_normal_views: string;
  }>(`
    SELECT
      p.week_start,
      EXTRACT(week FROM p.week_start)::int AS week_number,
      EXTRACT(year FROM p.week_start)::int AS year,
      p.curated_brand_id,
      b.id AS brand_id,
      COUNT(*)::int AS total_posts,
      SUM(p.views)::numeric(18,2) AS total_views,
      SUM(p.impressions)::numeric(18,2) AS total_impressions,
      SUM(p.reactions)::numeric(18,2) AS total_reactions,
      SUM(p.comments)::numeric(18,2) AS total_comments,
      SUM(p.shares)::numeric(18,2) AS total_shares,
      SUM(p.cost)::numeric(18,2) AS total_cost,
      JSONB_BUILD_OBJECT(
        'youtube',  SUM(CASE WHEN p.platform = 'youtube'  THEN p.views ELSE 0 END)::int,
        'facebook', SUM(CASE WHEN p.platform = 'facebook' THEN p.views ELSE 0 END)::int,
        'tiktok',   SUM(CASE WHEN p.platform = 'tiktok'   THEN p.views ELSE 0 END)::int
      ) AS network_breakdown,
      JSONB_BUILD_OBJECT(
        'Image',      SUM(CASE WHEN p.format = 'Image'      THEN 1 ELSE 0 END)::int,
        'Video',      SUM(CASE WHEN p.format = 'Video'      THEN 1 ELSE 0 END)::int,
        'True view',  SUM(CASE WHEN p.format = 'True view'  THEN 1 ELSE 0 END)::int,
        'Bumper',     SUM(CASE WHEN p.format = 'Bumper'     THEN 1 ELSE 0 END)::int,
        'Short',      SUM(CASE WHEN p.format = 'Short'      THEN 1 ELSE 0 END)::int,
        'Story',      SUM(CASE WHEN p.format = 'Story'       THEN 1 ELSE 0 END)::int,
        'Carousel',   SUM(CASE WHEN p.format = 'Carousel'    THEN 1 ELSE 0 END)::int,
        'Unknown',    SUM(CASE WHEN p.format IS NULL       THEN 1 ELSE 0 END)::int
      ) AS format_breakdown,
      SUM(CASE WHEN p.yt_format = 'Short' THEN p.views ELSE 0 END)::numeric(18,2) AS yt_short_views,
      SUM(CASE WHEN p.yt_format = 'Normal' THEN p.views ELSE 0 END)::numeric(18,2) AS yt_normal_views
    FROM post p
    JOIN brand b ON b.curated_brand_id = p.curated_brand_id AND b.group_id = $1
    WHERE b.group_id = $1
    GROUP BY p.curated_brand_id, b.id, p.week_start
    ORDER BY p.week_start
  `, [groupId]);

  console.log(`  Computing stats for ${aggResult.rows.length} brand × week combinations...`);

  // Upsert weekly_stats
  let statsUpserted = 0;
  for (const agg of aggResult.rows) {
    const weekEnd = toWeekEnd(agg.week_start);
    const avgEngagementRate = parseFloat(agg.total_views) > 0
      ? (parseFloat(agg.total_reactions) / parseFloat(agg.total_views)) * 100
      : 0;
    const safeAvg = isNaN(avgEngagementRate) || !isFinite(avgEngagementRate) ? 0 : avgEngagementRate;

    // Compute gap_pct vs previous week
    const aggWeekStart = safeDateStr(agg.week_start);
    const prevWeekRes = await query<{ total_impressions: string }>(`
      SELECT total_impressions FROM weekly_stats
      WHERE brand_id = $1 AND week_start < $2
      ORDER BY week_start DESC LIMIT 1
    `, [agg.brand_id, aggWeekStart]);

    let gapPct: number | null = null;
    if (prevWeekRes.rows.length > 0) {
      const prevImpressions = parseFloat(prevWeekRes.rows[0].total_impressions);
      const currImpressions = parseFloat(agg.total_impressions);
      if (prevImpressions > 0) {
        const raw = ((currImpressions - prevImpressions) / prevImpressions) * 100;
        gapPct = isNaN(raw) || !isFinite(raw) ? null : raw;
      }
    }

    const result = await query(`
      INSERT INTO weekly_stats (
        brand_id, group_id, year, week_number, week_start, week_end,
        total_posts, total_views, total_impressions, total_reactions,
        total_cost, avg_engagement_rate, gap_pct, is_new,
        network_breakdown, format_breakdown
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, $14, $15)
      ON CONFLICT ON CONSTRAINT unique_ws_group_brand_week DO UPDATE SET
        total_posts = EXCLUDED.total_posts,
        total_views = EXCLUDED.total_views,
        total_impressions = EXCLUDED.total_impressions,
        total_reactions = EXCLUDED.total_reactions,
        total_cost = EXCLUDED.total_cost,
        avg_engagement_rate = EXCLUDED.avg_engagement_rate,
        gap_pct = EXCLUDED.gap_pct,
        network_breakdown = EXCLUDED.network_breakdown,
        format_breakdown = EXCLUDED.format_breakdown,
        updated_at = now()
    `, [
      agg.brand_id, groupId, agg.year, agg.week_number, safeDateStr(agg.week_start), weekEnd,
      agg.total_posts, agg.total_views, agg.total_impressions, agg.total_reactions,
      agg.total_cost, safeAvg, gapPct,
      JSON.stringify(agg.network_breakdown),
      JSON.stringify(agg.format_breakdown),
    ]);
    statsUpserted += result.rowCount ?? 0;
  }
  console.log(`  Weekly stats upserted: ${statsUpserted}`);

  // Upsert weekly_report (group-level rollup)
  const reportResult = await query<{
    week_start: string;
    week_number: number;
    year: number;
    total_posts: string;
    total_views: string;
    total_impressions: string;
    total_reactions: string;
    total_cost: string;
  }>(`
    SELECT
      week_start,
      week_number,
      year,
      SUM(total_posts)::int AS total_posts,
      SUM(total_views)::numeric(18,2) AS total_views,
      SUM(total_impressions)::numeric(18,2) AS total_impressions,
      SUM(total_reactions)::numeric(18,2) AS total_reactions,
      SUM(total_cost)::numeric(18,2) AS total_cost
    FROM weekly_stats
    WHERE group_id = $1
    GROUP BY week_start, week_number, year
    ORDER BY week_start
  `, [groupId]);

  let reportsUpserted = 0;
  for (const r of reportResult.rows) {
    const weekEnd = toWeekEnd(r.week_start);
    const result = await query(`
      INSERT INTO weekly_report (group_id, year, week_number, week_start, week_end,
        total_posts, total_views, total_impressions, total_reactions, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'finalized')
      ON CONFLICT ON CONSTRAINT unique_wr_group_week DO UPDATE SET
        total_posts = EXCLUDED.total_posts,
        total_views = EXCLUDED.total_views,
        total_impressions = EXCLUDED.total_impressions,
        total_reactions = EXCLUDED.total_reactions,
        updated_at = now()
    `, [groupId, r.year, r.week_number, safeDateStr(r.week_start), weekEnd,
        r.total_posts, safeNum(parseFloat(r.total_views)), safeNum(parseFloat(r.total_impressions)), safeNum(parseFloat(r.total_reactions))]);
    reportsUpserted += result.rowCount ?? 0;
  }
  console.log(`  Weekly reports upserted: ${reportsUpserted}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Seed Complete');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Duration:        ${elapsed}s`);
  console.log(`  CSV rows:        ${rows.length.toLocaleString('vi-VN')}`);
  console.log(`  Posts inserted:  ${postsInserted.toLocaleString('vi-VN')}`);
  console.log(`  Posts skipped:  ${postsSkipped.toLocaleString('vi-VN')}`);
  console.log(`  Brand aliases:   ${aliasesToUpsert.length}`);
  console.log(`  Stats rows:     ${statsUpserted}`);
  console.log(`  Report rows:    ${reportsUpserted}`);
  console.log(`  Account:        ${accId}`);
  console.log(`  Client:         ${clientId}`);
  console.log(`  Group:          ${groupId}`);
  for (const [name, id] of Object.entries(brandRecords)) {
    console.log(`  Brand (${name}): ${id}`);
  }
  console.log('══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
