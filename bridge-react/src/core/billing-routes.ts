// TBP-743 (port of bridge-svelte TBP-702) — one route serves the subscription
// page, the paywall, and the pages a checkout returns to.
//
// The plugin used to redirect a failed checkout to `/payment-error` and point
// every Manage/Upgrade button at `/billing`, and no guide told anyone to
// create either page. With `<BridgeBillingRoutes />` mounted at
// `/subscription/*`, the defaults below point at pages that exist.

import type { BridgeConfig } from '../types/config';
import { getBridgeConfig } from './bridge-instance';

/** Every page `<BridgeBillingRoutes>` serves. `manage` is the mount point's own address. */
export const BRIDGE_BILLING_PAGES = ['manage', 'plan', 'success', 'error'] as const;

/** One of the pages `<BridgeBillingRoutes>` serves. */
export type BridgeBillingPage = (typeof BRIDGE_BILLING_PAGES)[number];

/** A parsed billing route. */
export interface BridgeBillingRoute {
  page: BridgeBillingPage;
}

/**
 * Parse the part of the path below the mount point into a billing page, or
 * `null` when it names none. The bare address (`/subscription`, rest `''`) is
 * the manage page; `plan`, `success` and `error` are one segment each.
 */
export function parseBridgeBillingRoute(rest: string | undefined | null): BridgeBillingRoute | null {
  if (typeof rest !== 'string') return null;
  const segments = rest.split('/').filter((s) => s !== '');
  if (segments.length === 0) return { page: 'manage' };
  if (segments.length !== 1) return null;
  const [first] = segments;
  if (first === 'plan' || first === 'success' || first === 'error') return { page: first };
  return null;
}

/** Where each billing destination points when the app configures nothing. */
export const BRIDGE_BILLING_DEFAULTS = {
  manageRoute: '/subscription',
  paywallRoute: '/subscription/plan',
  paymentErrorRoute: '/subscription/error',
} as const;

/** The billing destinations in effect. */
export interface BridgeBillingRoutes {
  /** The subscription page — where Manage/Upgrade buttons go. */
  manageRoute: string;
  /** Where a plan-less workspace is sent; `null` when the redirect is turned off. */
  paywallRoute: string | null;
  /**
   * True when `paywallRoute` is the built-in default rather than the app's own
   * choice. The default only applies to an app that uses billing (see
   * `appUsesBilling`).
   */
  paywallIsDefault: boolean;
  /** Where a failed checkout confirmation lands. */
  paymentErrorRoute: string;
  /** Where a completed checkout lands by default: `<manageRoute>/success`. */
  successRoute: string;
}

/**
 * Resolve the billing destinations from a `billing` config block. An unset
 * route takes its default; `paywallRoute: false` turns the paywall redirect off.
 */
export function resolveBillingRoutes(billing?: BridgeConfig['billing']): BridgeBillingRoutes {
  const manageRoute = billing?.manageRoute || BRIDGE_BILLING_DEFAULTS.manageRoute;
  const paywall = billing?.paywallRoute;
  return {
    manageRoute,
    paywallRoute: paywall === false ? null : paywall || BRIDGE_BILLING_DEFAULTS.paywallRoute,
    paywallIsDefault: paywall !== false && !paywall,
    paymentErrorRoute: billing?.paymentErrorRoute || BRIDGE_BILLING_DEFAULTS.paymentErrorRoute,
    successRoute: `${manageRoute.replace(/\/+$/, '')}/success`,
  };
}

/**
 * The billing destinations for the running app. Before `<BridgeProvider>` has
 * resolved its config the defaults apply — the same answer an app that
 * configures nothing gets.
 */
export function billingRoutes(): BridgeBillingRoutes {
  return resolveBillingRoutes(getBridgeConfig()?.billing);
}

/**
 * Whether the app uses billing, for the default paywall: it has at least one
 * plan. Every workspace of an app with no billing is plan-less, so without this
 * the default would send all of its users to `/subscription/plan`.
 */
export function appUsesBilling(plans: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(plans) && plans.length > 0;
}

/**
 * Whether the paywall redirect must leave `pathname` alone: the paywall itself
 * (no loop), and the payment-error page — a plan-less workspace whose checkout
 * failed has to be able to read why.
 */
export function isPaywallExempt(pathname: string, routes: BridgeBillingRoutes): boolean {
  return pathname === routes.paywallRoute || pathname === routes.paymentErrorRoute;
}
