/**
 * Bootstrap / Bridge initialization tests for bridge-react demo.
 */

import { test, expect } from '@playwright/test';
import { MED_TIMEOUT } from '../../fixtures/timeouts';

test.describe('Bridge Initialization', () => {
  test('demo app loads without critical console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // "Booted" is the thing this test waits for: the provider has mounted and
    // exposed the SDK surface, and the app has rendered. Not network idle — the
    // demo holds a persistent realtime WebSocket, so idle never arrives (TBP-721).
    await page.waitForFunction(() => !!(window as unknown as { bridge?: unknown }).bridge, undefined, {
      timeout: MED_TIMEOUT,
    });
    await expect(page.locator('h1')).toBeVisible({ timeout: MED_TIMEOUT });

    const critical = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('404') &&
        !err.includes('Failed to load resource')
    );
    expect(critical).toEqual([]);
  });

  test('home page renders with bridge demo content', async ({ page }) => {
    await page.goto('/');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: MED_TIMEOUT });
    await expect(heading).toContainText('bridge');
  });
});
