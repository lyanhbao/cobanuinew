/**
 * Playwright type stub — COBAN Crawl Infrastructure
 *
 * The `playwright` package lives in `tiktok scrape/node_modules/playwright`.
 * This file bridges TypeScript resolution for files under `lib/crawl/`.
 *
 * To eliminate this stub: install playwright at project root
 *   pnpm add playwright @playwright/test
 */
declare module 'playwright' {
  // Core types used by crawl scripts
  interface Page {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
    waitForTimeout(ms: number): Promise<void>;
    context(): BrowserContext;
    mouse: { move(x: number, y: number): Promise<void>; wheel(dx: number, dy: number): Promise<void> };
    viewportSize(): { width: number; height: number } | null;
    on(event: 'response', handler: (resp: Response) => void): void;
    close(): Promise<void>;
    url(): string;
  }

  interface Response {
    url(): string;
    json(): Promise<unknown>;
  }

  interface BrowserContext {
    newPage(): Promise<Page>;
    cookies(url?: string): Promise<Array<{
      name: string; value: string; domain?: string; path?: string;
      expires?: number; httpOnly?: boolean; secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None'
    }>>;
    pages(): Page[];
  }

  interface Browser {
    close(): Promise<void>;
    contexts(): BrowserContext[];
    newContext(options?: unknown): Promise<BrowserContext>;
  }

  export { Browser, BrowserContext, Page, Response };
  export const chromium: {
    connectOverCDP(url: string, options?: { timeout?: number }): Promise<Browser>;
  };
}
