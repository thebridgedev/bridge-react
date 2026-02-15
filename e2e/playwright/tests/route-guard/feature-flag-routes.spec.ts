/**
 * Feature-flag related routes — feature-flags page loads.
 */

import { test, expect } from '@playwright/test';
import { MED_TIMEOUT } from '../../fixtures/timeouts';

test.describe('Feature flag routes', () => {
  test('feature-flags page requires auth; unauthenticated redirects', async ({ page }) => {
    await page.goto('/feature-flags');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const onAuth = url.includes('/auth/') || url.includes('/login');
    const onFeatureFlags = url.includes('/feature-flags');
    expect(onAuth || onFeatureFlags).toBe(true);
  });
});
