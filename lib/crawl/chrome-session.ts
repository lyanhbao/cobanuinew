/**
 * Chrome Session Manager — COBAN Crawl Infrastructure
 *
 * Quản lý Chrome browser trên port riêng (9223) với Profile 4.
 * Dùng CDP để kết nối từ Node.js scripts (không dùng playwright CLI).
 *
 * Profile: /Users/lab/Library/Application Support/Google/Chrome/Profile 4
 * Port:   9223
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawn, execSync } from 'child_process';

// ─── Config ───────────────────────────────────────────────────────────────────

export const CHROME_EXEC =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const CHROME_PROFILE_PATH =
  '/Users/lab/Library/Application Support/Google/Chrome/Profile 4';

export const DEBUG_PORT = 9223;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChromeSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export interface CrawlResult {
  success: boolean;
  cookies: number;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function killChromeOnPort(port: number): void {
  try {
    execSync(`pkill -f "remote-debugging-port=${port}" 2>/dev/null; true`);
    execSync(`pkill -f "Profile 4" 2>/dev/null; true`);
  } catch {}
  try {
    execSync(`rm -f "${CHROME_PROFILE_PATH}/SingletonLock" 2>/dev/null; true`);
  } catch {}
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Kiểm tra Chrome đã chạy trên port chưa.
 */
export async function isChromeRunning(): Promise<boolean> {
  try {
    const browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`, {
      timeout: 3000,
    });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Khởi động Chrome mới trên port riêng (9223).
 * Kill Chrome cũ nếu đang chạy trên port đó.
 */
export async function startChrome(): Promise<void> {
  killChromeOnPort(DEBUG_PORT);
  await sleep(2000);

  spawn(CHROME_EXEC, [
    `--user-data-dir=${CHROME_PROFILE_PATH}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--no-first-run',
    '--profile-directory=Profile 4',
    '--new-window',
    '--no-sandbox',
  ], { detached: true, stdio: 'ignore' }).unref();

  await sleep(8000);
}

/**
 * Kết nối vào Chrome đang chạy, trả về session hoàn chỉnh.
 * Tự động spawn Chrome mới nếu chưa có.
 */
export async function getSession(): Promise<ChromeSession> {
  let browser: Browser;
  let running = false;

  // Thử kết nối Chrome đang chạy
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`, {
      timeout: 5000,
    });
    running = true;
  } catch {
    await startChrome();
    browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`, {
      timeout: 10000,
    });
  }

  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  return { browser, context: ctx, page };
}

/**
 * Verify TikTok login — kiểm tra cookie và URL.
 */
export async function verifyTikTokLogin(page: Page): Promise<CrawlResult> {
  await page.goto('https://www.tiktok.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const cookies = await page.context().cookies('https://www.tiktok.com');

  // Check redirect
  const url = page.url();
  if (url.includes('/login') || url.includes('/auth')) {
    return { success: false, cookies: 0, error: 'redirected to login' };
  }

  // Check cookie count
  if (cookies.length < 5) {
    return { success: false, cookies: cookies.length, error: 'no session cookies' };
  }

  return { success: true, cookies: cookies.length };
}

/**
 * Kiểm tra và hiển thị trạng thái login TikTok.
 */
export async function checkLoginStatus(): Promise<CrawlResult> {
  const session = await getSession();
  const result = await verifyTikTokLogin(session.page);
  // KHÔNG đóng browser — giữ session cho các scripts khác dùng
  return result;
}
