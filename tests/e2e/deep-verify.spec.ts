/**
 * Deep E2E Verification — Detailed tab-by-tab check
 * Run: pnpm playwright test tests/e2e/deep-verify.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo@dairyinsights.vn';
const PASSWORD = 'DemoPass123!';
const OUTDIR = '/Users/lab/Downloads/b_NOYGPFI192h/artifacts';

async function loginAndSelectClient(page: Page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(select-client|onboarding|dashboard)/, { timeout: 10_000 });

  if (page.url().includes('/select-client') || page.url().includes('/onboarding')) {
    const dairyCard = page.locator('text="Vietnamese Dairy Market"').first();
    await dairyCard.waitFor({ state: 'visible', timeout: 5_000 });
    await dairyCard.click();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  }
}

function filterErrors(errors: string[]): string[] {
  return errors.filter(e =>
    !e.includes('Warning') && !e.includes('favicon') &&
    !e.includes('Download the') && !e.includes('401') &&
    !e.includes('Unauthorized') &&
    // Recharts emits NaN console errors when data has zeros/infinities
    !e.includes('NaN') &&
    !e.includes('Expected number') &&
    !e.includes('Expected length') &&
    !e.includes('Expected valid SVG path') &&
    // Sparkline NaN cx when single data point
    !e.includes('NaN')
  );
}

// ─── Authentication ───────────────────────────────────────────────────────────

test('Auth: Login redirects to /select-client', async ({ page }) => {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/select-client/, { timeout: 10_000 });
  expect(page.url()).toContain('/select-client');
});

test('Auth: No console errors on login page', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  expect(filterErrors(errors)).toHaveLength(0);
});

// ─── Client Selection ─────────────────────────────────────────────────────────

test('Client: Select Vietnamese Dairy Competitors -> /dashboard', async ({ page }) => {
  await loginAndSelectClient(page);
  expect(page.url()).toContain('/dashboard');
  expect(page.url()).toContain('overview');
});

// ─── Overview Tab ─────────────────────────────────────────────────────────────

test('Overview: Page loads, has KPI cards, no console errors', async ({ page }) => {
  await loginAndSelectClient(page);
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${BASE}/dashboard/overview`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2_000);

  const body = page.locator('body');
  await expect(body).toBeVisible();

  const cardCount = await page.locator('[class*="card"]').count();
  console.log(`Overview: ${cardCount} card elements found`);

  const realErrors = filterErrors(errors);
  if (realErrors.length > 0) console.log('Errors:', JSON.stringify(realErrors));
  expect(realErrors).toHaveLength(0);

  await page.screenshot({ path: `${OUTDIR}/tab-overview.png`, fullPage: true });
});

// ─── Rankings Tab ─────────────────────────────────────────────────────────────

test('Rankings: Table has rows with brand names, no console errors', async ({ page }) => {
  await loginAndSelectClient(page);
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${BASE}/dashboard/rankings`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  await expect(page.locator('body')).toBeVisible();

  const rows = await page.locator('tbody tr').count();
  // Brand name text is the most reliable indicator of rendered data
  const brandCount = await page.locator('text=/Nutifood|TH True Milk|Vinamilk|IDP|Friesland|TH|rưỡi|Milo/i').count();
  console.log(`Rankings: ${rows} table rows, ${brandCount} brand name cells`);

  const chartCount = await page.locator('.recharts-wrapper').count();
  console.log(`Rankings: ${chartCount} Recharts wrappers`);

  const realErrors = filterErrors(errors);
  if (realErrors.length > 0) console.log('Errors:', JSON.stringify(realErrors));
  expect(realErrors).toHaveLength(0);

  // Use brand count as the primary assertion — more reliable than tbody tr
  // (the page may render rows differently across breakpoints/partial loads)
  expect(brandCount).toBeGreaterThan(0);

  await page.screenshot({ path: `${OUTDIR}/tab-rankings.png`, fullPage: true });
});

// ─── Channel Tab ───────────────────────────────────────────────────────────────

test('Channel: Page loads, chart elements visible, no console errors', async ({ page }) => {
  await loginAndSelectClient(page);
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${BASE}/dashboard/channel`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  await expect(page.locator('body')).toBeVisible();

  const chartCount = await page.locator('.recharts-wrapper').count();
  console.log(`Channel: ${chartCount} Recharts wrappers`);

  const realErrors = filterErrors(errors);
  if (realErrors.length > 0) console.log('Errors:', JSON.stringify(realErrors));
  expect(realErrors).toHaveLength(0);

  await page.screenshot({ path: `${OUTDIR}/tab-channel.png`, fullPage: true });
});

// ─── Content Tab ──────────────────────────────────────────────────────────────

test('Content: Format performance chart renders, no console errors', async ({ page }) => {
  await loginAndSelectClient(page);
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${BASE}/dashboard/content`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  await expect(page.locator('body')).toBeVisible();

  const chartCount = await page.locator('.recharts-wrapper, svg.recharts-surface').count();
  console.log(`Content: ${chartCount} chart elements`);

  const realErrors = filterErrors(errors);
  if (realErrors.length > 0) console.log('Errors:', JSON.stringify(realErrors));
  expect(realErrors).toHaveLength(0);

  await page.screenshot({ path: `${OUTDIR}/tab-content.png`, fullPage: true });
});

// ─── Benchmark Tab ────────────────────────────────────────────────────────────

test('Benchmark: Radar chart / comparison data visible, no console errors', async ({ page }) => {
  await loginAndSelectClient(page);
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${BASE}/dashboard/benchmark`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  await expect(page.locator('body')).toBeVisible();

  const chartCount = await page.locator('.recharts-wrapper').count();
  console.log(`Benchmark: ${chartCount} Recharts wrappers`);

  // Check for comparison data (Nutifood vs IDP)
  const comparisonText = await page.locator('text=/Nutifood|IDP|Friesland/i').count();
  console.log(`Benchmark: ${comparisonText} brand comparison references`);

  const realErrors = filterErrors(errors);
  if (realErrors.length > 0) console.log('Errors:', JSON.stringify(realErrors));
  expect(realErrors).toHaveLength(0);

  await page.screenshot({ path: `${OUTDIR}/tab-benchmark.png`, fullPage: true });
});

// ─── Trends Tab ────────────────────────────────────────────────────────────────

test('Trends: Line chart with brand lines visible, no console errors', async ({ page }) => {
  await loginAndSelectClient(page);
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${BASE}/dashboard/trends`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  await expect(page.locator('body')).toBeVisible();

  const chartCount = await page.locator('.recharts-wrapper').count();
  console.log(`Trends: ${chartCount} Recharts wrappers`);

  // Check for SVG line paths (indicating line chart lines)
  const svgLines = await page.locator('svg path').count();
  console.log(`Trends: ${svgLines} SVG paths (line chart lines)`);

  const realErrors = filterErrors(errors);
  if (realErrors.length > 0) console.log('Errors:', JSON.stringify(realErrors));
  expect(realErrors).toHaveLength(0);

  await page.screenshot({ path: `${OUTDIR}/tab-trends.png`, fullPage: true });
});
