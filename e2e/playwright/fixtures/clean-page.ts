import type { Browser, BrowserContext, Page } from '@playwright/test';
import { currentWorkerApp } from './worker-app';

/**
 * A context with no auth tokens — but still carrying THIS worker's app id
 * (`bridge:appId`, seeded by global-setup). Without it the demo would boot with
 * whatever VITE_BRIDGE_APP_ID says, which on stage is nothing at all, and a
 * worker would read one app's settings while its fixtures wrote another's.
 */

export async function createCleanContext(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  cleanup: () => Promise<void>;
}> {
  const context = await browser.newContext({
    storageState: currentWorkerApp().storageStatePath,
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
