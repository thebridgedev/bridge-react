import type { Browser, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';

/**
 * A context with no auth tokens — but still carrying the run's app id
 * (`bridge:appId`, seeded by global-setup). Without it the demo would boot with
 * whatever VITE_BRIDGE_APP_ID says, which on stage is nothing at all (TBP-721).
 */

export async function createCleanContext(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  cleanup: () => Promise<void>;
}> {
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '../.auth/base-state.json'),
  });
  const page = await context.newPage();
  return {
    context,
    page,
    cleanup: async () => {
      await page.close();
      await context.close();
    },
  };
}
