/**
 * Brand Color System — deterministic oklch palette for COBAN dashboard.
 *
 * Auto-assigns distinct brand colors from a 12-color palette based on
 * the brand name. Consistent across all tabs and views.
 */

// 12-color oklch palette — vibrant, distinct, dashboard-optimized
export const BRAND_PALETTE: string[] = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
];

/**
 * Simple deterministic hash from a brand name string.
 * Returns a consistent index 0–(palette.length-1) for the given name.
 */
function hashBrandName(name: string): number {
  const lower = name.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = lower.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // keep as 32-bit int
  }
  return Math.abs(hash) % BRAND_PALETTE.length;
}

/**
 * Get the hex color for a single brand name.
 * The same name always returns the same color.
 */
export function getBrandColor(brandName: string): string {
  return BRAND_PALETTE[hashBrandName(brandName)];
}

/**
 * Get a full mapping of brand names → hex colors.
 * Any brand not in the list gets its deterministic color.
 */
export function getBrandPalette(brands: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const brand of brands) {
    result[brand] = getBrandColor(brand);
  }
  return result;
}
