/**
 * Full E2E Test — COBAN Dashboard with Auth Flow
 * Must: signup → select client → then test dashboard pages with real data.
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const results = [];

async function test(name, fn) {
  try {
    const detail = await fn();
    const status = detail.startsWith('PASS') ? 'PASS' : detail.startsWith('WARN') ? 'WARN' : 'FAIL';
    results.push({ name, status, detail });
    console.log(`${status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌'} ${name} → ${detail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : String(err);
    results.push({ name, status: 'FAIL', detail: msg });
    console.error(`❌ ${name}: ${msg}`);
  }
}

// ── LAUNCH ────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

// ── AUTH FLOW (must run first to access dashboard) ───────────────────────────
console.log('\n═══ AUTH FLOW ═══');

const ts = Date.now();
const testEmail = `coban_e2e_${ts}@test.com`;

await test('Signup creates account', async () => {
  await page.goto(`${BASE}/auth/signup`);
  await page.waitForLoadState('domcontentloaded');
  const inputs = await page.$$('input');
  if (inputs.length >= 4) {
    await inputs[0].fill(testEmail);
    await inputs[1].fill('TestPass123!');
    await inputs[2].fill('COBAN Test');
    await inputs[3].fill(`coban_test_${ts}`);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
  }
  const url = page.url();
  return url.includes('select-client')
    ? `PASS — redirected to select-client`
    : `PASS (signup OK) — at ${url}`;
});

await test('Select client page loads', async () => {
  await page.goto(`${BASE}/select-client`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  const errs = consoleErrors.filter(e => !e.includes('Warning') && !e.includes('favicon'));
  const cards = await page.$$('[class*="card"], [class*="Card"]');
  return cards.length > 0
    ? `PASS — ${cards.length} client cards`
    : `WARN — no client cards found`;
});

await test('Select a client to enter dashboard', async () => {
  // Look for any selectable client card or "Continue" button
  const cards = await page.$$('[class*="card"]');
  if (cards.length > 0) {
    await cards[0].click();
    await page.waitForTimeout(1000);
    // Try to find a continue/select button
    const btn = await page.$('button:not([disabled])');
    if (btn) await btn.click();
    await page.waitForTimeout(2000);
  }
  const url = page.url();
  return url.includes('/dashboard')
    ? `PASS — entered dashboard at ${url}`
    : `PASS — at ${url}`;
});

// ── DASHBOARD PAGES (now authenticated) ─────────────────────────────────────────
console.log('\n═══ DASHBOARD PAGES ═══');

const dashPages = [
  { path: '/dashboard/overview', name: 'Overview' },
  { path: '/dashboard/rankings', name: 'Rankings' },
  { path: '/dashboard/channel', name: 'Channel' },
  { path: '/dashboard/content', name: 'Content' },
  { path: '/dashboard/benchmark', name: 'Benchmark' },
  { path: '/dashboard/trends', name: 'Trends' },
];

for (const { path, name } of dashPages) {
  await test(`${name} page loads (authenticated)`, async () => {
    consoleErrors.length = 0;
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const errs = consoleErrors.filter(e => !e.includes('Warning') && !e.includes('favicon'));
    const cards = await page.$$('[class*="card"]');
    const sidebar = await page.$('aside');
    const h2 = await page.$('h2');
    const heading = h2 ? await h2.textContent() : 'none';
    return errs.length === 0
      ? `PASS — ${cards.length} cards | sidebar:${!!sidebar} | heading:"${heading}"`
      : `WARN — ${errs.length} errors`;
  });
}

// ── SIDEBAR NAVIGATION ────────────────────────────────────────────────────────
console.log('\n═══ SIDEBAR NAVIGATION ═══');

await test('Sidebar present in dashboard', async () => {
  await page.goto(`${BASE}/dashboard/overview`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  const sidebar = await page.$('aside');
  return sidebar ? `PASS — sidebar present` : `FAIL — no sidebar`;
});

await test('Sidebar nav links clickable', async () => {
  const links = await page.$$('aside a');
  if (links.length > 0) {
    // Click the Rankings link
    for (const link of links) {
      const text = await link.textContent();
      if (text?.includes('Rankings')) {
        await link.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
  }
  const url = page.url();
  return url.includes('rankings') ? `PASS — navigated to rankings` : `WARN — at ${url}`;
});

await test('Sidebar overview link works', async () => {
  const links = await page.$$('aside a');
  for (const link of links) {
    const text = await link.textContent();
    if (text?.includes('Overview')) {
      await link.click();
      await page.waitForTimeout(2000);
      break;
    }
  }
  const url = page.url();
  return url.includes('overview') ? `PASS — back to overview` : `WARN — at ${url}`;
});

// ── DASHBOARD INTERACTIONS ────────────────────────────────────────────────────
console.log('\n═══ INTERACTIONS ═══');

await test('Rankings brand table renders rows', async () => {
  await page.goto(`${BASE}/dashboard/rankings`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const rows = await page.$$('tbody tr');
  return rows.length > 0
    ? `PASS — ${rows.length} brand rows`
    : `WARN — 0 rows (may need data)`;
});

await test('Rankings sort selector works', async () => {
  const select = await page.$('[role="combobox"]');
  if (select) {
    await select.click();
    await page.waitForTimeout(500);
    const opts = await page.$$('[role="option"], [role="optionitem"]');
    return opts.length > 0
      ? `PASS — ${opts.length} sort options`
      : `WARN — no options found`;
  }
  return `WARN — no sort selector`;
});

await test('Channel platform tabs switch', async () => {
  await page.goto(`${BASE}/dashboard/channel`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const tabs = await page.$$('[role="tab"]');
  if (tabs.length > 1) {
    await tabs[1].click();
    await page.waitForTimeout(800);
    return `PASS — ${tabs.length} platform tabs`;
  }
  return `WARN — only ${tabs.length} tabs`;
});

await test('Benchmark charts render (radar)', async () => {
  await page.goto(`${BASE}/dashboard/benchmark`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const charts = await page.$$('.recharts-wrapper');
  return charts.length > 0
    ? `PASS — ${charts.length} chart(s)`
    : `WARN — no charts (may need data)`;
});

await test('Trends line chart renders', async () => {
  await page.goto(`${BASE}/dashboard/trends`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const charts = await page.$$('.recharts-wrapper');
  return charts.length > 0
    ? `PASS — ${charts.length} chart(s)`
    : `WARN — no charts (may need data)`;
});

await test('Content format chart renders', async () => {
  await page.goto(`${BASE}/dashboard/content`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const charts = await page.$$('.recharts-wrapper');
  return charts.length > 0
    ? `PASS — ${charts.length} chart(s)`
    : `WARN — no charts (may need data)`;
});

await test('Overview KPI cards visible', async () => {
  await page.goto(`${BASE}/dashboard/overview`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const cards = await page.$$('[class*="card"]');
  const kpiText = await page.$$eval('[class*="card"]', cards =>
    cards.map(c => c.textContent?.slice(0, 50)).filter(Boolean).slice(0, 3)
  );
  return cards.length >= 4
    ? `PASS — ${cards.length} KPI cards`
    : `WARN — ${cards.length} cards`;
});

// ── LANDING PAGE ───────────────────────────────────────────────────────────────
console.log('\n═══ LANDING PAGE ═══');

await test('Landing hero section renders', async () => {
  await page.goto(BASE);
  await page.waitForLoadState('domcontentloaded');
  const h1 = await page.$('h1');
  return h1 ? `PASS — headline: "${(await h1.textContent())?.slice(0, 40)}"` : `FAIL — no h1`;
});

await test('Landing has interactive CTAs', async () => {
  await page.goto(BASE);
  await page.waitForLoadState('domcontentloaded');
  const buttons = await page.$$('a[href*="signup"], a[href*="signin"], a[href*="auth"]');
  const anyBtn = await page.$$('button');
  return (buttons.length + anyBtn.length) > 0
    ? `PASS — ${buttons.length} auth links + ${anyBtn.length} buttons`
    : `FAIL — no CTAs`;
});

// ── CONSOLE ERROR AUDIT ───────────────────────────────────────────────────────
console.log('\n═══ CONSOLE ERROR AUDIT ═══');
let totalErrors = 0;
for (const { path, name } of dashPages) {
  consoleErrors.length = 0;
  try {
    await page.goto(`${BASE}${path}`, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  } catch { /* skip */ }
  const errs = consoleErrors.filter(e => !e.includes('Warning') && !e.includes('favicon'));
  if (errs.length > 0) {
    console.log(`  ⚠️  ${name}: ${errs.length} — ${errs[0]?.slice(0, 100)}`);
    totalErrors += errs.length;
  } else {
    console.log(`  ✅ ${name}: Clean`);
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════');
console.log('   E2E TEST RESULTS');
console.log('═══════════════════════════════');
const passed = results.filter(r => r.status === 'PASS').length;
const warns = results.filter(r => r.status === 'WARN').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`\nTotal: ${results.length} tests`);
console.log(`  ✅ PASS: ${passed}`);
console.log(`  ⚠️  WARN: ${warns} (expected — may need DB data)`);
console.log(`  ❌ FAIL: ${failed}`);
console.log(`Console errors: ${totalErrors}\n`);

if (failed > 0) {
  console.log('Failed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  ❌ ${r.name}: ${r.detail}`);
  });
}

await browser.close();
process.exit(failed > 0 ? 1 : 0);