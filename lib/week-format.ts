/**
 * Week formatting utilities (NFR-006).
 * Week start is always a Monday (ISO).
 */

import type { WeekId, WeekLabel, WeekStart } from './types';

export type { WeekId, WeekLabel, WeekStart };

// ─── ISO Week helpers ─────────────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * ISO week number (1–53) for a Date.
 */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * ISO year for week numbering (may differ from calendar year near year boundaries).
 */
export function isoYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute week_start (Monday) from any Date.
 * e.g. 2025-04-16 (Wednesday) → "2025-04-14" (Monday)
 */
export function toWeekStart(date: Date): WeekStart {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day; // go back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute week_end (Sunday) from any Date.
 * e.g. 2025-04-16 (Wednesday) → "2025-04-20" (Sunday)
 */
export function toWeekEnd(date: Date): string {
  const monday = new Date(toWeekStart(date));
  monday.setDate(monday.getDate() + 6);
  return monday.toISOString().slice(0, 10);
}

/**
 * Get the Monday of the current week (in local time).
 */
export function getCurrentWeekStart(): WeekStart {
  return toWeekStart(new Date());
}

/**
 * Build a WeekLabel from a WeekStart string.
 * e.g. "2025-04-07" → "W15 (07 Apr – 13 Apr, 2025)"
 */
export function formatWeek(weekStartStr: string): WeekLabel {
  const start = new Date(weekStartStr + 'T00:00:00Z');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const year = start.getUTCFullYear();
  const week = isoWeekNumber(start);

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = start.toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' }).split(' ')[1];
  const endMonth = end.toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' }).split(' ')[1];

  return `W${week} (${pad(startDay)} ${startMonth} – ${pad(endDay)} ${endMonth}, ${year})`;
}

/** Alias for formatWeek — used throughout the codebase. */
export const weekLabel = formatWeek;

/**
 * Build a WeekId from a WeekStart string.
 */
export function getWeekId(weekStart: WeekStart): WeekId {
  const date = new Date(weekStart + 'T00:00:00Z');
  return {
    weekStart,
    weekNumber: isoWeekNumber(date),
    year: isoYear(date),
  };
}

/**
 * Return the Monday and Sunday dates for a given WeekStart.
 */
export function getWeekRange(weekStart: string): { start: Date; end: Date } {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}
