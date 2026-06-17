/**
 * Welcome Paywall — first-time-user end-to-end flow
 *
 * Ported from bridge-nextjs's `subscription/welcome-paywall.spec.ts` (itself a
 * near-verbatim port of bridge-svelte's). Covers the full first-time-user
 * paywall flow: the bootstrap gates the paywall redirect on
 * `getSubscriptionStatus()` (shouldSelectPlan + paymentsAutoRedirect). Proves a
 * brand-new user is:
 *
 *   1. Forced to /welcome when they try to hit any protected route
 *   2. Able to complete Stripe Checkout from the PlanSelector on /welcome
 *   3. Landed on an in-app (non-paywall) route after returning from Stripe
 *   4. NOT bounced back to /welcome on subsequent navigation to protected routes
 *
 * Requires STRIPE_TEST_PK / STRIPE_TEST_SK env vars (skipped otherwise).
 *
 * ⚠ DEMO DEPENDENCY (flagged in the report): this spec requires the react demo
 * to expose a `/welcome` paywall route and a paywall-redirect config (svelte's
 * demo wires `billing.paywallRoute: '/welcome'` + a `/welcome` route +
 * `{ match: '/welcome', public: true }` in the route guard). That is
 * bootstrap-layer demo wiring, NOT part of the Billing 2.0 component slice. Until
 * it lands in the react demo this spec will fail step 2 even with Stripe keys —
 * but it is skipped without Stripe keys, so it does not break the suite.
 *
 * Login uses react's in-app SDK-auth helper (`loginViaSdkAuth`), mirroring
 * bridge-svelte's welcome-paywall spec 1:1. react DOES ship an SDK-auth surface
 * (the `<LoginForm>` rendered on `/auth/login`), and SDK auth posts credentials
 * directly to the LOCAL bridge-api (`apiBaseUrl`), so it works against the local
 * test app — unlike the hosted-auth flow, whose login UI lives on the prod
 * `hostedUrl` (auth.thebridge.dev) that doesn't know the local test app.
 */

import { test, expect, loginViaSdkAuth } from '../../fixtures/auth';
import { LONG_TIMEOUT, MED_TIMEOUT } from '../../fixtures/timeouts';

const STRIPE_TEST_PK = process.env.STRIPE_TEST_PK || '';
const STRIPE_TEST_SK = process.env.STRIPE_TEST_SK || '';
const hasStripeKeys = !!STRIPE_TEST_PK && !!STRIPE_TEST_SK;

/** Read the access token from the new-core storage (`bridge_tokens:<appId>`). */
function readAccessToken(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('bridge_tokens')) {
      try {
        return JSON.parse(localStorage.getItem(k) as string).accessToken ?? null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

test.describe('Welcome Paywall — first-time user flow', () => {
  test.skip(!hasStripeKeys, 'STRIPE_TEST_PK / STRIPE_TEST_SK env vars required');

  test('signup → protected route bounces to /welcome → pay → land in app', async ({
    page,
    testUser,
    testDataClient,
    envConfig,
  }) => {
    // Stripe Checkout round-trip alone can take 20-40s; the default 60s
    // budget leaves no room for the rest of the flow + final assertions.
    test.setTimeout(120_000);

    // STABLE, reusable paywall plan key (NOT `paywall-pro-${Date.now()}`).
    //
    // Determinism rationale: the old per-run timestamped key minted a brand-new
    // plan + Stripe price on every run, then immediately drove checkout against
    // it — racing bridge-api's async Stripe price-sync/archive sweep
    // (`_getActiveStripePrice` 500 "Cannot find a matching Stripe price"), and
    // leaking a fresh Stripe price each run that piled up in the shared test
    // account and made the sweep ever slower. With a stable key + create-if-absent
    // (`ensurePlan`), the plan + its Stripe price are created and synced exactly
    // ONCE; every subsequent run reuses them with NO Stripe re-sync, so by
    // checkout time the price has been active+checkout-ready for ages. The plan is
    // intentionally NOT deleted in teardown — it persists for reuse.
    const planKey = 'e2e-paywall-pro';

    try {
      // ---- Arrange: configure the app for Stripe + paywall, and ensure the paid plan
      await testDataClient.configureApp({
        paymentsAutoRedirect: true,
        stripeEnabled: true,
        stripePublicKey: STRIPE_TEST_PK,
        stripeSecretKey: STRIPE_TEST_SK,
        currency: 'USD',
      });

      // Create-if-absent: on the first ever run this creates the plan and syncs
      // its Stripe price once; on every later run it returns the existing plan
      // WITHOUT re-triggering the Stripe archive sweep (the flake source).
      await testDataClient.ensurePlan({
        key: planKey,
        name: 'Paywall Pro',
        description: 'Paid plan for welcome-paywall E2E (stable, reused across runs)',
        trial: false,
        trialDays: 0,
        prices: [{ amount: 2900, currency: 'USD', recurrenceInterval: 'month' }],
      });

      // ---- 1a. Force the "no plan selected" state by deleting the seeded TEAM
      //          plan the new tenant auto-binds to. Recreated in finally.
      await testDataClient.deletePlan('TEAM').catch(() => {});

      // ---- 1. Sign in the fresh test user via in-app SDK auth (no plan yet)
      await loginViaSdkAuth(page, testUser.email, testUser.password);

      // Tokens should be present after login
      const accessToken = await page.evaluate(readAccessToken);
      expect(accessToken).not.toBeNull();

      // ---- 1b. Sanity-check that the API really considers this tenant as
      //          paywall-eligible (shouldSelectPlan=true, paymentsAutoRedirect=true).
      const probeRes = await fetch(`${envConfig.testDataApiUrl}/account/subscription/status`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-app-id': envConfig.appId,
        },
      });
      const probeBody = await probeRes.json();
      expect(probeBody.shouldSelectPlan).toBe(true);
      expect(probeBody.paymentsAutoRedirect).toBe(true);

      // ---- 2. Navigate to a protected route → expect paywall redirect to /welcome.
      await page.goto('/protected', { waitUntil: 'commit' });
      await page.waitForURL('**/welcome', { timeout: LONG_TIMEOUT });
      expect(new URL(page.url()).pathname).toBe('/welcome');

      // ---- 3. PlanSelector renders on /welcome and finishes loading
      const planSelector = page.locator('[data-bridge-plan-selector]');
      await expect(planSelector).toBeVisible({ timeout: MED_TIMEOUT });
      await expect(planSelector).not.toHaveAttribute('data-loading', 'true', {
        timeout: LONG_TIMEOUT,
      });

      // ---- 4. Click "Select" on the paid plan card → redirect to Stripe Checkout
      const paidPlanCard = page
        .locator('[data-bridge-plan-card]')
        .filter({ hasText: 'Paywall Pro' });
      await expect(paidPlanCard).toBeVisible({ timeout: MED_TIMEOUT });
      const paidPlanBtn = paidPlanCard.locator('button').first();
      await expect(paidPlanBtn).toBeVisible({ timeout: MED_TIMEOUT });
      await paidPlanBtn.click();

      await page.waitForURL((url) => url.hostname.includes('stripe.com'), {
        timeout: LONG_TIMEOUT,
      });
      expect(page.url()).toContain('stripe.com');

      // ---- 5. Fill Stripe test card
      const cardInput = page
        .locator('#cardNumber, [data-testid="card-number-input"], input[name="cardNumber"]')
        .first();
      await cardInput.waitFor({ state: 'visible', timeout: MED_TIMEOUT });
      await cardInput.fill('4242424242424242');

      const expiryInput = page
        .locator('#cardExpiry, [data-testid="card-expiry-input"], input[name="cardExpiry"]')
        .first();
      await expiryInput.fill('1234'); // 12/34

      const cvcInput = page
        .locator('#cardCvc, [data-testid="card-cvc-input"], input[name="cardCvc"]')
        .first();
      await cvcInput.fill('123');

      const nameInput = page.locator('#billingName, input[name="billingName"]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Playwright Test');
      }

      const zipInput = page
        .locator('#billingPostalCode, input[name="billingPostalCode"]')
        .first();
      if (await zipInput.isVisible().catch(() => false)) {
        await zipInput.fill('12345');
      }

      const submitButton = page.locator('button[type="submit"], .SubmitButton').first();
      await submitButton.click();

      // ---- 6. Stripe processes payment and redirects back to the demo's callback,
      //         which bootstrap recognises and resolves by confirming the checkout,
      //         refreshing tokens, and redirecting to the success redirect.
      await page.waitForURL(
        (url) => !url.hostname.includes('stripe.com'),
        { timeout: 60_000 } // Stripe processing can take a while
      );
      // Wait for the post-checkout subscription UI to finish rendering its
      // active-billing state. PlanSelector surfaces active billing via
      // data-state="active".
      await expect(page.locator('[data-bridge-plan-selector][data-state="active"]')).toBeVisible({
        timeout: LONG_TIMEOUT,
      });

      const postCheckoutUrl = page.url();
      const postCheckoutPath = new URL(postCheckoutUrl).pathname;

      // ---- 7. We must NOT have been bounced back to /welcome.
      expect(postCheckoutPath).not.toBe('/welcome');
      expect(postCheckoutUrl).not.toContain('stripe.com');

      // ---- 8. Bonus: navigating to a fresh protected route should now succeed.
      await page.goto('/protected');
      const finalPath = new URL(page.url()).pathname;
      expect(finalPath).not.toBe('/welcome');
      expect(finalPath).toBe('/protected');
    } finally {
      // ---- Cleanup: restore the TEAM trial plan that other tests rely on and
      //               disable Stripe.
      //
      // We do NOT delete the stable `e2e-paywall-pro` plan: it is meant to persist
      // and be reused across runs so its Stripe price stays synced+active. Deleting
      // it would re-run the Stripe archive sweep AND force the next run to recreate
      // (and re-race) the price — exactly the flake this change removes.
      await testDataClient
        .createPlan({
          key: 'TEAM',
          name: 'Team',
          trial: true,
          trialDays: 14,
          prices: [{ amount: 99, currency: 'EUR', recurrenceInterval: 'month' }],
        })
        .catch(() => {});
      await testDataClient
        .configureApp({ paymentsAutoRedirect: false, stripeEnabled: false })
        .catch(() => {});
    }
  });
});
