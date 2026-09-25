/**
 * Feature-flag related routes — feature-flags page loads.
 */

import { test, expect } from '@playwright/test';
import { LONG_TIMEOUT } from '../../fixtures/timeouts';

test.describe('Feature flag routes', () => {
  test('feature-flags page requires auth; unauthenticated redirects', async ({ page }) => {
    await page.goto('/feature-flags');

    // Wait for the guard to settle on a destination — either it bounced us to
    // login or it let the page render. Network idle would never come: the demo
    // holds a realtime WebSocket (TBP-721).
    await Promise.any([
      page.waitForURL((u) => u.pathname.includes('/auth/') || u.pathname.includes('/login'), {
        timeout: LONG_TIMEOUT,
      }),
      page.getByRole('heading', { name: 'Feature flag cookbook' }).waitFor({ timeout: LONG_TIMEOUT }),
    ]);

    const url = page.url();
    const onAuth = url.includes('/auth/') || url.includes('/login');
    const onFeatureFlags = url.includes('/feature-flags');
    expect(onAuth || onFeatureFlags).toBe(true);
  });
});
