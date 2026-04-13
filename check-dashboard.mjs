import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const DEMO_EMAIL = 'demo@dairyinsights.vn';
const DEMO_PASSWORD = 'DemoPass123!';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
const failedRequests = [];
page.on('requestfailed', req => {
  failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
});

// Login
await page.goto(`${BASE}/auth/login`);
await page.waitForLoadState('domcontentloaded');
await page.locator('#email').fill(DEMO_EMAIL);
await page.locator('#password').fill(DEMO_PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/(select-client|onboarding|dashboard)/, { timeout: 15000 });

// Select Vietnamese Dairy Market
try {
  const dairyCard = page.locator('text="Vietnamese Dairy Market"').first();
  await dairyCard.waitFor({ state: 'visible', timeout: 5000 });
  await dairyCard.click();
  await page.waitForURL(/\/dashboard/, { timeout: 8000 });
} catch(e) { console.log('WARNING: client selection skipped'); }

const tabs = ['overview', 'rankings', 'channel', 'content', 'benchmark', 'trends'];
for (const tab of tabs) {
  await page.goto(`${BASE}/dashboard/${tab}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const rechartsWrappers = await page.locator('.recharts-wrapper').count();
  const svgElements = await page.locator('svg').count();
  const barElements = await page.locator('.recharts-bar, [class*="bar"]').count();
  const lineElements = await page.locator('.recharts-line').count();
  const headings = await page.locator('h2').allTextContents();
  const errorText = await page.locator('[class*="text-destructive"]').allTextContents();
  const cardCount = await page.locator('[class*="card"]').count();

  console.log(`\n=== ${tab.toUpperCase()} ===`);
  console.log(`  h2: ${JSON.stringify(headings)}`);
  console.log(`  recharts-wrappers: ${rechartsWrappers}`);
  console.log(`  svgs: ${svgElements}`);
  console.log(`  bars: ${barElements}`);
  console.log(`  lines: ${lineElements}`);
  console.log(`  cards: ${cardCount}`);
  if (errorText.length > 0) console.log(`  ERROR: ${JSON.stringify(errorText)}`);
}

console.log(`\n=== ERRORS ===`);
const real = consoleErrors.filter(e => !e.includes('Warning') && !e.includes('favicon') && !e.includes('Download the'));
real.forEach(e => console.log(`  ERR: ${e}`));
failedRequests.forEach(r => console.log(`  FAIL: ${r}`));

await browser.close();
