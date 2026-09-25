/**
 * Token persistence — after login, tokens survive page reload.
 */

import { test, expect } from '../../fixtures/auth';
import { MED_TIMEOUT } from '../../fixtures/timeouts';

/** True when auth-core's namespaced `bridge_tokens:<appId>` holds an access token. */
function hasNamespacedTokens(): boolean {
  const key = Object.keys(localStorage).find(
    (k) => k === 'bridge_tokens' || k.startsWith('bridge_tokens:'),
  );
  const raw = key ? localStorage.getItem(key) : null;
  if (!raw) return false;
  try {
    return !!JSON.parse(raw)?.accessToken;
  } catch {
    return false;
  }
}

test.describe('Token persistence', () => {
  test('after login, tokens persist after page reload', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');

    const hasBefore = await page.evaluate(hasNamespacedTokens);
    expect(hasBefore).toBe(true);

    await page.reload();

    // The claim under test is that the reloaded app comes back authenticated, so
    // wait for the authenticated nav before reading storage — not for the network
    // to go idle, which the demo's realtime WebSocket prevents (TBP-721).
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible({
      timeout: MED_TIMEOUT,
    });

    const hasAfter = await page.evaluate(hasNamespacedTokens);
    expect(hasAfter).toBe(true);
  });
});
