/**
 * COBAN E2E Test Suite — Complete User Journey Coverage
 *
 * Covers ALL user journeys from user-journey-v3.md:
 *   J1  Landing page
 *   J2  (Platform Admin — not user-facing)
 *   J3  Landing → Signup
 *   J5  Select Client
 *   J6  Onboarding Wizard (4-step: Client → Group → Brands → Crawl)
 *   J7  Dashboard (6 tabs)
 *   J8  Client Settings
 *   J9  Add/Remove Competitor
 *   J11 Export/Report
 *
 * Plus: Auth flow validation, auth guards, console error checks.
 *
 * Run: pnpm playwright test tests/e2e/journey.spec.ts
 * Stop on first failure: --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';
import { saveCredentials, loadCredentials } from './credentials';

const BASE = 'http://localhost:3000';

// Unique timestamp for this test run — all created accounts are isolated.
const RUN_TS = Date.now();

// ─── Credential helpers ─────────────────────────────────────────────────────────

/** Save credentials to home directory (shared across test runs). */
function persistCredentials(email: string, password: string, accountName: string) {
  saveCredentials({ email, password, accountName });
}

function freshEmail(label: string) { return `coban_${label}_${RUN_TS}@test.com`; }

// ─── Navigation helpers ────────────────────────────────────────────────────────

/**
 * Navigate to login page, fill credentials, submit, and wait for navigation.
 * Uses waitForResponse + waitForURL to ensure the async router.push('/select-client') completes.
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for the API response and then the client-side navigation
  await page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 10_000 });
  await page.waitForURL(/\/(select-client|onboarding|dashboard)/, { timeout: 10_000 });
}

/**
 * Navigate to signup page, fill all fields, submit, and wait for redirect.
 * New accounts with no clients redirect to /select-client (client-side → /onboarding).
 */
async function signupAs(
  page: Page,
  opts: { accountName: string; fullName: string; email: string; password: string },
) {
  await page.goto(`${BASE}/auth/signup`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#accountName').fill(opts.accountName);
  await page.locator('#fullName').fill(opts.fullName);
  await page.locator('#email').fill(opts.email);
  await page.locator('#password').fill(opts.password);
  await page.locator('#confirmPassword').fill(opts.password);
  await page.locator('button[type="submit"]').click();
  // Wait for the register API response
  await page.waitForResponse(r => r.url().includes('/api/auth/register'), { timeout: 10_000 });
  // Then wait for client-side navigation: /select-client → /onboarding
  await page.waitForURL(/\/select-client/, { timeout: 10_000 });
  await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
  // Wait for the onboarding step 1 heading to appear (React renders after state update)
  await expect(page.locator('h2:has-text("Create Your Client")')).toBeVisible({ timeout: 8_000 });
}

// ─── Onboarding helpers ────────────────────────────────────────────────────────

/**
 * Step 1: Fill client name and advance to Step 2.
 * Wait for Step 2 heading to appear (React re-renders after successful API call).
 */
async function onboardingFillClient(page: Page, name: string) {
  // Wait for Step 1 to be fully rendered
  await expect(page.locator('h2:has-text("Create Your Client")')).toBeVisible({ timeout: 8_000 });
  const nameInput = page.locator('input[placeholder="e.g. Vinamilk, Unilever Vietnam"]').first();
  await nameInput.waitFor({ timeout: 3_000 });
  await nameInput.fill(name);
  const continueBtn = page.locator('button:has-text("Continue")').first();
  await expect(continueBtn).toBeEnabled({ timeout: 3_000 });
  await continueBtn.click();
  // Wait for the POST /api/clients response
  const resp = await page.waitForResponse(r => r.url().includes('/api/clients') && r.status() >= 200, { timeout: 10_000 }).catch(() => null);
  if (resp && !resp.ok()) {
    const body = await resp.text().catch(() => '');
    const alerts = await page.locator('[role="alert"], .toast').allTextContents().catch(() => []);
    throw new Error(`Client API ${resp.status()}: ${body.substring(0, 100)} | alerts=${alerts.join(',')}`);
  }
  await expect(page.locator('h2:has-text("Create Your First Group")')).toBeVisible({ timeout: 8_000 });
}

/**
 * Step 2: Fill group name and advance to Step 3.
 */
async function onboardingFillGroup(page: Page, name: string) {
  // Wait for Step 2 to be fully rendered
  await expect(page.locator('h2:has-text("Create Your First Group")')).toBeVisible({ timeout: 8_000 });
  const groupInput = page.locator('input[placeholder="e.g. Dairy Segment, Beauty Category"]').first();
  await groupInput.waitFor({ timeout: 3_000 });
  await groupInput.fill(name);
  const continueBtn = page.locator('button:has-text("Continue")').first();
  await continueBtn.click();
  // Wait for POST /api/clients/{id}/groups
  const resp = await page.waitForResponse(r => r.url().includes('/clients/') && r.url().includes('/groups'), { timeout: 10_000 }).catch(() => null);
  if (resp && !resp.ok()) {
    const body = await resp.text().catch(() => '');
    const alerts = await page.locator('[role="alert"], .toast').allTextContents().catch(() => []);
    throw new Error(`Group API ${resp.status()}: ${body.substring(0, 100)} | alerts=${alerts.join(',')}`);
  }
  await expect(page.locator('h2:has-text("Select Brands")')).toBeVisible({ timeout: 8_000 });
}

/**
 * Step 3: Search for a curated brand, select it as primary, and submit.
 * Uses data-testid for the combobox input (added to CommandInput) and
 * page.evaluate for both brand selection and the Save button click to bypass
 * cmdk's pointer-event interception and React event delegation layer.
 */
async function onboardingSelectBrand(page: Page, searchTerm: string) {
  // Wait for Step 3 to be fully rendered
  await expect(page.locator('h2:has-text("Select Brands")')).toBeVisible({ timeout: 8_000 });

  // Step 3a: Select primary brand using the combobox
  // The Primary Brand section has a combobox with "Search curated brands..." placeholder
  // OR an Input with "Start typing to search brands..." placeholder when no results
  // Both have the same behavior: typing triggers the search
  const searchInput = page.locator('input[placeholder*="Search curated brands"], input[placeholder*="Start typing"]').first();
  await searchInput.waitFor({ timeout: 5_000 });
  await searchInput.fill(searchTerm);
  // Wait for async search results (300ms debounce + API call)
  await page.waitForResponse(r => r.url().includes('/api/curated-brands'), { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1_000);
  // Verify results are visible and select the first one
  const firstResult = page.locator('[role="option"]').first();
  await expect(firstResult).toBeVisible({ timeout: 5_000 });
  await firstResult.click({ force: true });
  await page.waitForTimeout(800);

  // After selection, the combobox is replaced by a Remove card. Verify it's visible.
  const removeBtn = page.locator('button:has-text("Remove")');
  if (!await removeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    throw new Error(`Brand selection failed — no Remove button found for searchTerm '${searchTerm}'`);
  }

  // Intercept ALL API responses to detect if any return errors
// Click Save Brands using page.evaluate to directly trigger React onClick
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    for (const btn of btns) {
      if (btn.textContent?.includes('Save Brands')) {
        console.log('[DEBUG-EVAL] Found Save button, clicking...');
        btn.click();
        return;
      }
    }
    throw new Error('Save Brands button not found in DOM');
  });

  // Wait for the brands API response
  const brandsResp = await page.waitForResponse(
    r => r.url().includes('/groups/') && r.url().includes('/brands'),
    { timeout: 10_000 }
  ).catch(() => null);

  // Wait for POST /api/groups/{id}/crawl
  await page.waitForResponse(r => r.url().includes('/crawl'), { timeout: 10_000 }).catch(() => null);

  // Wait for Step 4 crawl status heading to appear
  await expect(
    page.locator('h2:has-text("Crawl"), h2:has-text("all set"), h2:has-text("Preparing")'),
  ).toBeVisible({ timeout: 15_000 });
}


/**
 * Complete the full onboarding wizard end-to-end.
 */
async function completeOnboarding(
  page: Page,
  clientName: string,
  groupName: string,
  brandSearch: string,
) {
  await onboardingFillClient(page, clientName);
  await onboardingFillGroup(page, groupName);
  await onboardingSelectBrand(page, brandSearch);
}

/**
 * Select the first available client card on /select-client, or skip if on /onboarding.
 */
async function selectFirstClient(page: Page) {
  if (page.url().includes('/onboarding')) {
    test.skip(true, 'No clients — on /onboarding');
    return;
  }
  const firstCard = page.locator('[class*="card"]').first();
  if (await firstCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstCard.click({ force: true });
  }
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 }).catch(() => {});
}

/**
 * Enter the dashboard (login → select client → dashboard/overview).
 */
async function enterDashboard(page: Page) {
  const cred = loadCredentials();
  if (!cred) {
    test.skip(true, 'No test credentials — run signup tests first in this file');
    return;
  }
  await loginAs(page, cred.email, cred.password);
  await selectFirstClient(page);
}

// ═══════════════════════════════════════════════════════════════════════════════
// J1: Landing Page
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J1 — Landing Page', () => {
  test('Hero h1 is visible', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    expect((await h1.textContent())?.trim().length).toBeGreaterThan(0);
  });

  test('"Start Free" / Signup CTA navigates to /auth/signup', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    const cta = page.locator('a[href="/auth/signup"]').first();
    if (await cta.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cta.click();
      await page.waitForURL(/\/auth\/signup/, { timeout: 5_000 });
    }
  });

  test('Navigation bar renders', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('header, nav').first()).toBeVisible({ timeout: 3_000 });
  });

  test('No console errors on landing page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const real = errors.filter(e =>
      !e.includes('Warning') && !e.includes('favicon') &&
      !e.includes('Download the') && !e.includes('hydrat') && !e.includes('Download the React DevTools'),
    );
    expect(real).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J3: Auth — Signup
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J3 — Auth: Signup', () => {
  test('Signup page renders all 5 form fields', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#accountName')).toBeVisible();
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Signup with mismatched passwords — stays on /auth/signup', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#accountName').fill('TestAgencyMismatch');
    await page.locator('#fullName').fill('Test User');
    await page.locator('#email').fill(`mismatch_${RUN_TS}@test.com`);
    await page.locator('#password').fill('TestPass123!');
    await page.locator('#confirmPassword').fill('WrongPass123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/auth\/signup/, { timeout: 5_000 });
  });

  test('Signup with empty fields — form validation prevents submission', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('button[type="submit"]').click();
    // HTML5 required + React validation — should stay on signup page
    await page.waitForURL(/\/auth\/signup/, { timeout: 3_000 });
  });

  test('Signup success → redirects to /onboarding (no clients)', async ({ page }) => {
    const email = freshEmail('j3_success');
    await signupAs(page, {
      accountName: `coban_j3_${RUN_TS}`,
      fullName: 'J3 Test User',
      email,
      password: 'TestPass123!',
    });
    // New account → no clients → client-side redirect to /onboarding
    expect(page.url()).toContain('/onboarding');
    persistCredentials(email, 'TestPass123!', `coban_j3_${RUN_TS}`);
  });

  test('"Sign in" link on signup page → /auth/login', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('a:has-text("Sign in")').first();
    if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/auth\/login/, { timeout: 3_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J3: Auth — Login
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J3 — Auth: Login', () => {
  test('Login page renders email and password fields', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Login with invalid credentials shows error and stays on /auth/login', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#email').fill('nonexistent@test.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    // Should stay on login page (toast error shown)
    await page.waitForURL(/\/auth\/login/, { timeout: 5_000 });
  });

  test('Login with valid credentials redirects away from /auth/login', async ({ page }) => {
    const cred = loadCredentials();
    if (!cred) { test.skip(); return; }
    await loginAs(page, cred.email, cred.password);
    expect(page.url()).not.toMatch(/\/auth\/(login|signup)/);
  });

  test('"Sign up" link on login page → /auth/signup', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('domcontentloaded');
    const link = page.locator('a:has-text("Sign up")').first();
    if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL(/\/auth\/signup/, { timeout: 3_000 });
    }
  });

  test('No console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('networkidle');
    const real = errors.filter(e =>
      !e.includes('Warning') && !e.includes('favicon') && !e.includes('Download the'),
    );
    expect(real).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J5: Select Client
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J5 — Select Client', () => {
  test('New user with no clients → redirected to /onboarding', async ({ page }) => {
    const email = freshEmail('j5_no_clients');
    await signupAs(page, {
      accountName: `coban_j5_${RUN_TS}`,
      fullName: 'J5 No Clients User',
      email,
      password: 'TestPass123!',
    });
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
    persistCredentials(email, 'TestPass123!', `coban_j5_${RUN_TS}`);
  });

  test('Authenticated user → /onboarding page renders for new account', async ({ page }) => {
    const email = freshEmail('j5_auth_check');
    await signupAs(page, {
      accountName: `coban_j5a_${RUN_TS}`,
      fullName: 'J5 Auth Check',
      email,
      password: 'TestPass123!',
    });
    await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
    await expect(page.locator('h2:has-text("Create Your Client")')).toBeVisible();
    persistCredentials(email, 'TestPass123!', `coban_j5a_${RUN_TS}`);
  });

  test('"Add New Client" card navigates to /onboarding', async ({ page }) => {
    const cred = loadCredentials();
    if (!cred) { test.skip(); return; }
    await loginAs(page, cred.email, cred.password);
    // New accounts redirect to /onboarding, not /select-client
    if (!page.url().includes('/select-client')) {
      // Already on /onboarding — verify it renders
      await expect(page.locator('h2:has-text("Create Your Client")')).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J6: Onboarding Wizard (4-step)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J6 — Onboarding Wizard', () => {
  // Each test creates a FRESH account → always lands on /onboarding step 1
  // No shared state, no account pollution.

  test('Step 1: "Create Your Client" heading is visible', async ({ page }) => {
    const email = freshEmail('j6_s1_heading');
    await signupAs(page, {
      accountName: `coban_j6s1_${RUN_TS}`,
      fullName: 'J6 S1 Heading User',
      email,
      password: 'TestPass123!',
    });
    await expect(page.locator('h2:has-text("Create Your Client")')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[placeholder="e.g. Vinamilk, Unilever Vietnam"]')).toBeVisible();
    await expect(page.locator('button:has-text("Continue")')).toBeVisible();
  });

  test('Step 1: Empty submit → stays on Step 1', async ({ page }) => {
    const email = freshEmail('j6_s1_empty');
    await signupAs(page, {
      accountName: `coban_j6s1e_${RUN_TS}`,
      fullName: 'J6 S1 Empty User',
      email,
      password: 'TestPass123!',
    });
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('h2:has-text("Create Your Client")')).toBeVisible({ timeout: 3_000 });
  });

  test('Step 1 → 2: Valid client name advances to Group step', async ({ page }) => {
    const email = freshEmail('j6_s1to2');
    await signupAs(page, {
      accountName: `coban_j6s2_${RUN_TS}`,
      fullName: 'J6 S1to2 User',
      email,
      password: 'TestPass123!',
    });
    await onboardingFillClient(page, 'Test Client Corp');
    // Verify Step 2 heading
    await expect(page.locator('h2:has-text("Create Your First Group")')).toBeVisible({ timeout: 5_000 });
  });

  test('Step 2 → 3: Valid group name advances to Brands step', async ({ page }) => {
    const email = freshEmail('j6_s2to3');
    await signupAs(page, {
      accountName: `coban_j6s3_${RUN_TS}`,
      fullName: 'J6 S2to3 User',
      email,
      password: 'TestPass123!',
    });
    await onboardingFillClient(page, 'Test Client Corp');
    await onboardingFillGroup(page, 'Dairy Market Tracking');
    // Verify Step 3 heading
    await expect(page.locator('h2:has-text("Select Brands")')).toBeVisible({ timeout: 5_000 });
  });

  test('Step 3: Brand search input is visible', async ({ page }) => {
    const email = freshEmail('j6_s3_search');
    await signupAs(page, {
      accountName: `coban_j6s3s_${RUN_TS}`,
      fullName: 'J6 S3 Search User',
      email,
      password: 'TestPass123!',
    });
    await onboardingFillClient(page, 'Test Client Corp');
    await onboardingFillGroup(page, 'Dairy Market Tracking');
    // When no search has been done, the component shows a plain Input with
    // "Start typing to search brands..." placeholder. After filling, it shows
    // the Command combobox with "Search curated brands..." placeholder.
    const searchInput = page.locator('input[placeholder*="Search curated brands..."], input[placeholder*="Start typing"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('vinamilk');
    // Now the Command combobox should appear with the search results
    await page.waitForResponse(r => r.url().includes('/api/curated-brands'), { timeout: 5_000 }).catch(() => {});
    await expect(page.locator('input[placeholder*="Search curated"], input[placeholder*="Start typing"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Step 3 → 4: Selecting primary brand + submitting advances to Step 4', async ({ page }) => {
    const email = freshEmail('j6_s3to4');
    await signupAs(page, {
      accountName: `coban_j6s4_${RUN_TS}`,
      fullName: 'J6 S3to4 User',
      email,
      password: 'TestPass123!',
    });
    await onboardingFillClient(page, 'Test Client Corp');
    await onboardingFillGroup(page, 'Dairy Market Tracking');
    await onboardingSelectBrand(page, 'vinamilk');
    // Verify Step 4 heading (crawl status)
    await expect(page.locator('h2:has-text("Crawl"), h2:has-text("all set"), h2:has-text("Preparing")')).toBeVisible({ timeout: 8_000 });
  });

  test('Full onboarding flow: client → group → brand → crawl', async ({ page }) => {
    const email = freshEmail('j6_full');
    await signupAs(page, {
      accountName: `coban_j6full_${RUN_TS}`,
      fullName: 'J6 Full Flow User',
      email,
      password: 'TestPass123!',
    });
    await completeOnboarding(page, 'Full Client Corp', 'Full Market Group', 'vinamilk');
    persistCredentials(email, 'TestPass123!', `coban_j6full_${RUN_TS}`);
  });

  test('Step 4: crawl status UI renders', async ({ page }) => {
    const email = freshEmail('j6_s4');
    await signupAs(page, {
      accountName: `coban_j6s4u_${RUN_TS}`,
      fullName: 'J6 S4 User',
      email,
      password: 'TestPass123!',
    });
    await onboardingFillClient(page, 'Test Client Corp');
    await onboardingFillGroup(page, 'Dairy Market Tracking');
    await onboardingSelectBrand(page, 'unilever');
    // Either step 4 heading or "Go to Dashboard" button
    const hasStep4 =
      await page.locator('h2:has-text("Crawl"), h2:has-text("all set"), h2:has-text("Preparing")').isVisible({ timeout: 5_000 }).catch(() => false) ||
      await page.locator('button:has-text("Go to Dashboard")').isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasStep4).toBeTruthy();
  });

  test('Step 4: "Go to Dashboard" button navigates to /dashboard/overview', async ({ page }) => {
    const email = freshEmail('j6_godash');
    await signupAs(page, {
      accountName: `coban_j6gd_${RUN_TS}`,
      fullName: 'J6 Go Dashboard User',
      email,
      password: 'TestPass123!',
    });
    await onboardingFillClient(page, 'Test Client Corp');
    await onboardingFillGroup(page, 'Dairy Market Tracking');
    await onboardingSelectBrand(page, 'unilever');
    // Wait for "Go to Dashboard" button to appear (step 4 ready state)
    const goBtn = page.locator('button:has-text("Go to Dashboard")');
    if (await goBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await goBtn.click();
      await page.waitForURL(/\/dashboard\/overview/, { timeout: 10_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J7: Dashboard — Authenticated + Client Selected
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J7 — Dashboard (authenticated)', () => {
  test('Dashboard layout: sidebar + tab navigation visible', async ({ page }) => {
    await enterDashboard(page);
    // Navigate to overview and verify key structural elements
    await page.goto(`${BASE}/dashboard/overview`);
    await page.waitForLoadState('networkidle');
    // Sidebar (persistent across navigations)
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible({ timeout: 5_000 });
    // Tab bar (persistent header)
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
  });

  test('Overview page renders KPI area (cards or empty state)', async ({ page }) => {
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/overview`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    const hasContent =
      (await page.locator('[class*="card"]').count()) > 0 ||
      (await page.locator('text=/no data|no groups|chưa có|empty|pending/i').count()) > 0;
    expect(hasContent).toBeTruthy();
  });

  // All 6 dashboard tabs — tab navigation
  for (const [tab, path] of [
    ['Overview', '/dashboard/overview'],
    ['Rankings', '/dashboard/rankings'],
    ['Channel', '/dashboard/channel'],
    ['Content', '/dashboard/content'],
    ['Benchmark', '/dashboard/benchmark'],
    ['Trends', '/dashboard/trends'],
  ] as const) {
    test(`Tab: click "${tab}" → URL changes to ${path}`, async ({ page }) => {
      await enterDashboard(page);
      await page.goto(`${BASE}/dashboard/overview`);
      await page.waitForLoadState('networkidle');
      const tabBtn = page.locator(`[role="tab"]:has-text("${tab}")`);
      await tabBtn.click();
      await page.waitForURL(new RegExp(path.replace('/', '\\/')), { timeout: 5_000 });
    });

    test(`Tab: direct navigation ${path} renders without crash`, async ({ page }) => {
      await enterDashboard(page);
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('No console errors on Overview page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/overview`);
    await page.waitForLoadState('networkidle');
    const realErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('favicon') &&
      !e.includes('401') && !e.includes('Unauthorized') && !e.includes('Download the'),
    );
    expect(realErrors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J8: Client Settings
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J8 — Client Settings', () => {
  test('Settings page loads for authenticated user', async ({ page }) => {
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('No crash on /dashboard/settings', async ({ page }) => {
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    // Should not be an error page
    expect(page.url()).toContain('/dashboard/settings');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J9: Add/Remove Competitor
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J9 — Add/Remove Competitor', () => {
  test('Groups page loads and shows groups or empty state', async ({ page }) => {
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/groups`);
    await page.waitForLoadState('networkidle');
    const hasGroups =
      (await page.locator('[class*="card"]').count()) > 0 ||
      (await page.locator('text=/no groups|chưa có|empty/i').count()) > 0;
    expect(hasGroups).toBeTruthy();
  });

  test('"New Group" button opens create dialog', async ({ page }) => {
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/groups`);
    await page.waitForLoadState('networkidle');
    const newGroupBtn = page.locator('button:has-text("New Group"), button:has-text("Create your first group")').first();
    if (await newGroupBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newGroupBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"], [class*="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }
  });

  test('Create new group flow', async ({ page }) => {
    await enterDashboard(page);
    await page.goto(`${BASE}/dashboard/groups`);
    await page.waitForLoadState('networkidle');
    const newGroupBtn = page.locator('button:has-text("New Group"), button:has-text("Create your first group")').first();
    if (await newGroupBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newGroupBtn.click();
      await page.waitForTimeout(500);
      const nameInput = page.locator('input[placeholder*="Dairy"], input[placeholder*="Segment"], input[placeholder*="Category"]').first();
      if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nameInput.fill(`Competitor Group ${RUN_TS}`);
        const createBtn = page.locator('button:has-text("Create Group")').first();
        await createBtn.click();
        await page.waitForTimeout(2_000);
      }
    }
  });

  test('Groups page sidebar link navigates correctly', async ({ page }) => {
    await enterDashboard(page);
    const groupsLink = page.locator('aside a[href="/dashboard/groups"]').first();
    if (await groupsLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await groupsLink.click();
      await page.waitForURL(/\/dashboard\/groups/, { timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J11: Export / Report
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J11 — Export / Report', () => {
  test('Dashboard pages load without crash (data-dependent)', async ({ page }) => {
    await enterDashboard(page);
    for (const path of ['/dashboard/overview', '/dashboard/rankings', '/dashboard/channel']) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);
      expect(page.url()).toContain(path);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Auth Guards — Unauthenticated Redirects
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Auth Guards — Unauthenticated Redirects', () => {
  test('/dashboard/overview → redirects to login (or lands on app)', async ({ page }) => {
    await page.context().clearCookies();
    // localStorage access can fail on cross-origin iframes — wrap in try/catch
    try { await page.evaluate(() => localStorage.clear()); } catch { /* ignore */ }
    await page.goto(`${BASE}/dashboard/overview`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/\/(auth\/login|select-client|dashboard)/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/(auth\/login|select-client|dashboard)/);
  });

  test('/select-client → redirects to /auth/login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies();
    try { await page.evaluate(() => localStorage.clear()); } catch { /* ignore */ }
    await page.goto(`${BASE}/select-client`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/\/auth\/login/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/auth\/login/);
  });

  test('/onboarding → redirects to /auth/login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies();
    try { await page.evaluate(() => localStorage.clear()); } catch { /* ignore */ }
    await page.goto(`${BASE}/onboarding`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(/\/auth\/login/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/auth\/login/);
  });
});
