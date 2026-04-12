/**
 * Additional week utilities that complement the types in src/lib/types.ts.
 */

/**
 * ISO week number (1–53) for any Date.
 * Uses UTC arithmetic for consistency across timezones.
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * ISO year used for week numbering.
 * Near year boundaries, this may differ from the calendar year.
 */
export function getISOYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/**
 * Encode a year + week into a compact string: "2025-W13"
 */
export function weekIdString(year: number, week: number): string {
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Decode a "2025-W13" string back to { year, week }.
 */
export function parseWeekIdString(s: string): { year: number; week: number } {
  const trimmed = s.trim();
  const dashIdx = trimmed.indexOf('-W');
  if (dashIdx === -1) {
    throw new Error(`Invalid week ID string: "${s}". Expected format "YYYY-Www".`);
  }
  const year = parseInt(trimmed.slice(0, dashIdx), 10);
  const week = parseInt(trimmed.slice(dashIdx + 2), 10);
  if (isNaN(year) || isNaN(week)) {
    throw new Error(`Invalid week ID string: "${s}". Year and week must be integers.`);
  }
  return { year, week };
}
