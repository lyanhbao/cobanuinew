/**
 * Crawl status helpers and display constants.
 */

import type { CrawlStatus } from './types';

export const CRAWL_STATUS_LABELS: Record<CrawlStatus, string> = {
  pending: 'Chờ xử lý',
  crawling: 'Đang crawl',
  ready: 'Sẵn sàng',
  error: 'Lỗi',
} as const;

export const CRAWL_STATUS_COLORS: Record<CrawlStatus, string> = {
  pending: '#94A3B8',   // slate-400
  crawling: '#3B82F6',  // blue-500
  ready: '#22C55E',     // green-500
  error: '#EF4444',     // red-500
} as const;

/**
 * Returns true when a crawl job is actively running.
 */
export function isCrawlActive(status: CrawlStatus): boolean {
  return status === 'crawling';
}
