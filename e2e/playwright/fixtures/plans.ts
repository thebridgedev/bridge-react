/**
 * Plans the suite provisions ahead of time, on every worker app, in global-setup.
 * Shared from here so the specs and the setup cannot drift apart.
 */

/**
 * The plan bridge-api's `createPlaywrightTestAccount` binds every new test
 * tenant to. When an app is missing it, EVERY `testUser` fixture fails with
 * `404 The app: … has no plan with key: TEAM` — which is how 21 stage tests
 * failed before TBP-721: welcome-paywall deleted this plan mid-run to force a
 * plan-less tenant, and recreated it in a `finally` whose failure was swallowed.
 *
 * Definition mirrors the one bridge-api seeds in `createAppWithOwner`.
 */
export const TEAM_PLAN = {
  key: 'TEAM',
  name: 'Team',
  trial: true,
  trialDays: 14,
  prices: [{ amount: 99, currency: 'EUR', recurrenceInterval: 'month' }],
};

/**
 * `welcome-paywall.spec.ts` drives a real Stripe Checkout, so its plan's Stripe
 * price has to be synced and active *before* the test clicks "Select". A plan
 * created inside the test races bridge-api's async price-sync/archive sweep
 * (`_getActiveStripePrice` → 500 "Cannot find a matching Stripe price").
 *
 * The key is therefore STABLE and the plan is created via `ensure-plan`
 * (create-if-absent) once per worker app and never deleted — so on every run
 * after the first it is simply reused, with no Stripe work at all.
 */
export const PAYWALL_PLAN = {
  key: 'e2e-paywall-pro',
  currency: 'USD',
  definition: {
    key: 'e2e-paywall-pro',
    name: 'Paywall Pro',
    description: 'Paid plan for welcome-paywall E2E (stable, reused across runs)',
    trial: false,
    trialDays: 0,
    prices: [{ amount: 2900, currency: 'USD', recurrenceInterval: 'month' }],
  },
};
