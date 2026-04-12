/**
 * CSV parser for competitor data export files.
 * Handles the "total data dairy 12_3 - Competitor (1).csv" format.
 */
import { Platform, FormatType, YtFormat, toWeekStart, isoWeekNumber } from '../../lib/types';

export interface ParsedCsvRow {
  platform: Platform;
  post_id: string;
  content: string;
  posted_at: Date;
  week_start: string;
  week_number: number;
  year: number;
  format: FormatType | null;
  yt_format: YtFormat | null;
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

interface RawCsvRow {
  'Post Date': string;
  'Profile': string;
  'Network': string;
  'Format': string;
  'Cost': string;
  'Message': string;
  'Reactions, Comments & Shares': string;
  'Link': string;
  'Messag ID': string;
  'Views': string;
  'Duration': string;
  'Advertiser': string;
  'Brand': string;
  'Categories': string;
  'Impression': string;
  'YT Format': string;
}

const PLATFORM_MAP: Record<string, Platform> = {
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  TIKTOK: 'tiktok',
};

const FORMAT_MAP: Record<string, FormatType> = {
  Image: 'Image',
  Video: 'Video',
  'True view': 'True view',
  Bumper: 'Bumper',
  Short: 'Short',
  Story: 'Story',
  Carousel: 'Carousel',
};

const YT_FORMAT_MAP: Record<string, YtFormat> = {
  Short: 'Short',
  Normal: 'Normal',
};

/**
 * Parse a date string like "1/1/2022" → Date
 */
function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Handle "1/1/2022" or "01/01/2022" format
  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

/**
 * Parse Vietnamese currency "49,536,800,316 ₫" → number
 */
function parseCurrency(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed
    .replace(/[^\d,]/g, '')
    .replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse reactions/comments/shares: may be a single number or "123,456,789"
 * Returns { reactions, comments, shares }
 */
function parseReactions(value: string): { reactions: number; comments: number; shares: number } {
  const trimmed = value.trim();
  if (!trimmed) return { reactions: 0, comments: 0, shares: 0 };
  // Remove commas and parse
  const cleaned = trimmed.replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return { reactions: num, comments: 0, shares: 0 };
  }
  // Try splitting by comma
  const parts = trimmed.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
    return { reactions: parts[0]!, comments: parts[1]!, shares: parts[2]! };
  }
  if (parts.length === 2 && parts.every((p) => !isNaN(p))) {
    return { reactions: parts[0]!, comments: parts[1]!, shares: 0 };
  }
  return { reactions: 0, comments: 0, shares: 0 };
}

/**
 * Parse a number from a string, removing commas
 */
function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse JSON array from a string, handling quoted strings
 */
function parseJsonArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[]') return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [String(parsed)];
  } catch {
    // Fallback: try to extract quoted strings manually
    const matches = trimmed.match(/"([^"]+)"/g);
    if (matches) return matches.map((m) => m.slice(1, -1));
    return [trimmed];
  }
}

/**
 * Parse a single CSV line, handling quoted fields properly.
 * Uses a simple CSV parser that handles:
 * - Quoted fields with commas inside
 * - Quoted fields with newlines inside
 * - Escaped quotes ("")
 */
export function parseCsvLine(line: string): RawCsvRow | null {
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
        // Escaped quote
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

/**
 * Normalize network string to Platform
 */
function normalizePlatform(value: string): Platform | null {
  const upper = value.trim().toUpperCase();
  return PLATFORM_MAP[upper] ?? null;
}

/**
 * Normalize format string to FormatType
 */
function normalizeFormat(value: string): FormatType | null {
  const trimmed = value.trim();
  return FORMAT_MAP[trimmed] ?? null;
}

/**
 * Normalize YT format string
 */
function normalizeYtFormat(value: string): YtFormat | null {
  const trimmed = value.trim();
  return YT_FORMAT_MAP[trimmed] ?? null;
}

/**
 * Map a raw CSV row to a ParsedCsvRow.
 * Returns null if the row is invalid.
 */
export function mapRow(raw: RawCsvRow): ParsedCsvRow | null {
  const postDate = parseDate(raw['Post Date']);
  if (!postDate) return null;

  const platform = normalizePlatform(raw['Network']);
  if (!platform) return null;

  const postId = raw['Messag ID'].trim();
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
    format: normalizeFormat(raw['Format']),
    yt_format: normalizeYtFormat(raw['YT Format']),
    cost: parseCurrency(raw['Cost']),
    views: parseNumber(raw['Views']),
    impressions: parseNumber(raw['Impression']),
    reactions: reactionsData.reactions,
    comments: reactionsData.comments,
    shares: reactionsData.shares,
    duration: raw['Duration'].trim() ? parseFloat(raw['Duration']) : null,
    link: raw['Link'].trim(),
    advertiser: raw['Advertiser'].trim(),
    profile: raw['Profile'].trim(),
    brands: parseJsonArray(raw['Brand']),
    categories: parseJsonArray(raw['Categories']),
  };
}

/**
 * Parse full CSV content into ParsedCsvRow array.
 * Handles multi-line quoted fields.
 */
export function parseCsv(content: string): ParsedCsvRow[] {
  const results: ParsedCsvRow[] = [];
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  let i = 0;

  // Split by lines, handling quoted multi-line fields
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
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
      i++;
      continue;
    }

    if (char === '\r') {
      i++;
      continue;
    }

    currentLine += char;
    i++;
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  // Skip header line (first non-empty line)
  const headerIdx = lines.findIndex((l) => l.trim().length > 0);
  if (headerIdx === -1) return results;

  // Skip the header row
  for (let j = headerIdx + 1; j < lines.length; j++) {
    const raw = parseCsvLine(lines[j]!);
    if (!raw) continue;
    const mapped = mapRow(raw);
    if (!mapped) continue;
    results.push(mapped);
  }

  return results;
}
