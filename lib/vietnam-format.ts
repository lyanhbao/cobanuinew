/**
 * Vietnam number formatting utilities (NFR-008).
 */

const VIETNAM = new Intl.NumberFormat('vi-VN');
const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Format a number in Vietnam style: 1.234.567
 * Uses Intl with vi-VN locale for proper thousand separators.
 */
export function formatVietnamNumber(n: number, decimals?: number): string {
  if (decimals !== undefined) {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  }
  return VIETNAM.format(n);
}

/**
 * Format a number compactly: 1.2M, 18K
 */
export function formatCompact(n: number): string {
  return COMPACT.format(n);
}

/**
 * Format a number as a percentage: 12.3%  or  +18,5%  (positive sign optional)
 */
export function formatPercent(n: number, decimals = 1): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Format a number as Vietnamese currency: 49,5 tỷ ₫
 * Handles up to trillions, switches to tỷ below that threshold.
 */
export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) {
    return `${(n / 1e12).toFixed(1).replace('.', ',')} nghìn tỷ ₫`;
  }
  if (abs >= 1e9) {
    return `${(n / 1e9).toFixed(1).replace('.', ',')} tỷ ₫`;
  }
  if (abs >= 1e6) {
    return `${(n / 1e6).toFixed(1).replace('.', ',')} triệu ₫`;
  }
  if (abs >= 1e3) {
    return `${(n / 1e3).toFixed(1).replace('.', ',')} nghìn ₫`;
  }
  return `${formatVietnamNumber(n)} ₫`;
}

/**
 * Parse a Vietnam-formatted number string back to a Number.
 * Handles both space-and-dot (1.234.567) and comma-decimal (1234,56) styles.
 */
export function parseVietnamNumber(s: string): number {
  // Remove thousand separators (dots in vi-VN) and replace comma decimal with dot
  const cleaned = s
    .replace(/\./g, '')       // remove thousand separators
    .replace(',', '.');       // swap decimal comma to dot
  return parseFloat(cleaned);
}
