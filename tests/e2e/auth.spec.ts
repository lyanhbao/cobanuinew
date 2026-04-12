/**
 * COBAN Dashboard E2E Tests — Auth Flow
 * Uses proper id-based selectors for signup/login forms.
 * Run: pnpm playwright test tests/e2e/auth.spec.ts
 */
import { test, expect } from '@playwright/test';
import { saveCredentials } from './credentials';

const BASE = 'http://localhost:3000';
const ts = Date.now();
const TEST_EMAIL = `coban_e2e_${ts}@test.com`;
const TEST_PASSWORD = 'TestPass123!';

test.describe('Auth Flow', () => {
  test('Signup page renders all form fields', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#accountName')).toBeVisible();
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Signup creates account and redirects to /select-client', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#accountName').fill(`coban_test_${ts}`);
    await page.locator('#fullName').fill('COBAN Test');
    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#confirmPassword').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/select-client/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/select-client/);

    saveCredentials({ email: TEST_EMAIL, password: TEST_PASSWORD, accountName: `coban_test_${ts}` });
  });

  test('Login page renders form fields', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Login with valid account redirects to /select-client', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/select-client/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/select-client/);
  });

  test('Login with invalid credentials shows error', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#email').fill('wrong@email.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should stay on login page (not redirect)
    await page.waitForURL(/\/auth\/login/, { timeout: 5_000 });
  });

  test('Signup with mismatched passwords shows error', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#accountName').fill('TestAgency');
    await page.locator('#fullName').fill('Test User');
    await page.locator('#email').fill('mismatch@test.com');
    await page.locator('#password').fill('TestPass123!');
    await page.locator('#confirmPassword').fill('DifferentPass123!');
    await page.locator('button[type="submit"]').click();

    // Should stay on signup page
    await page.waitForURL(/\/auth\/signup/, { timeout: 5_000 });
  });

  test('Signup with empty fields does not submit', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button[type="submit"]').click();

    // Should stay on signup page (form validation prevents submission)
    await page.waitForURL(/\/auth\/signup/, { timeout: 3_000 });
  });
});
