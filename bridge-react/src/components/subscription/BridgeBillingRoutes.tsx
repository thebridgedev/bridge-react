/**
 * TBP-743 (port of bridge-svelte TBP-702) — the subscription page, the paywall
 * and the checkout return pages, from one route.
 *
 *   // React Router
 *   import { BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';
 *   <Route path="/subscription/*" element={<BridgeBillingRoutes />} />
 *
 *   // TanStack Router
 *   import { BridgeBillingRoutes } from '@nebulr-group/bridge-react/tanstack-router';
 *   createRoute({ getParentRoute: () => rootRoute, path: 'subscription/$', component: BridgeBillingRoutes })
 *
 * Serves, relative to wherever it is mounted:
 *   /subscription          the current plan, the plan picker and "Manage billing"
 *   /subscription/plan     the paywall: where a plan-less workspace is sent
 *   /subscription/success  where a completed checkout lands
 *   /subscription/error    where a failed checkout confirmation lands
 *
 * Those are the defaults of `billing.manageRoute`, `billing.paywallRoute` and
 * `billing.paymentErrorRoute`, so nothing Bridge redirects to is a 404.
 *
 * Customising, in rungs:
 *   1. `--bridge-*` CSS tokens restyle it.
 *   2. `frame(page, children)` replaces everything around the content on every
 *      page; `heading(page)` replaces each page's heading.
 *   3. Take over one page by passing an element:
 *        <BridgeBillingRoutes pages={{ plan: <MyPricing /> }} />
 *   4. Headless: `PlanSelector`, `BridgeSubscriptionStatus`,
 *      `BillingPortalButton` and `useSubscription()` are the pieces.
 */
import { useEffect, type ReactNode } from 'react';
import { ensureSubscription, loadSubscription } from '../../core/bridge-instance';
import { parseBridgeBillingRoute, type BridgeBillingPage } from '../../core/billing-routes';
import { bridgeAuthBase } from '../../core/auth-routes';
import { useWindowRouteLocation, type BridgeRouteLocation } from '../../routing/location';
import { billingRoutes } from '../../core/billing-routes';
import { PlanSelector } from './PlanSelector';
import { BridgeSubscriptionStatus } from './BridgeSubscriptionStatus';
import { BillingPortalButton } from './BillingPortalButton';

export type { BridgeBillingPage };

export interface BridgeBillingRoutesProps {
  /** Everything around the content, on every page. Replaces the default centred column. */
  frame?: (page: BridgeBillingPage, children: ReactNode) => ReactNode;
  /** Each page's heading. Replaces the default one. */
  heading?: (page: BridgeBillingPage) => ReactNode;
  /** Take over a page by passing an element; every other page keeps working. */
  pages?: Partial<Record<BridgeBillingPage, ReactNode>>;
  /** Rendered for an address under the mount point that names no page. */
  notFound?: ReactNode;
  /** Where "Continue" on the success page goes. @default '/' */
  redirectTo?: string;
  /** The mount point when no router adapter supplies the location. @default billing.manageRoute */
  base?: string;
  /** The current location, from a router adapter. */
  location?: BridgeRouteLocation;
}

const DEFAULT_HEADINGS: Record<BridgeBillingPage, string> = {
  manage: 'Subscription',
  plan: 'Choose a plan',
  success: "You're all set",
  error: "We couldn't confirm your payment",
};

export function BridgeBillingRoutes(props: BridgeBillingRoutesProps) {
  const windowLocation = useWindowRouteLocation(props.base ?? billingRoutes().manageRoute);
  return <BillingRoutesBody {...props} location={props.location ?? windowLocation} />;
}

function BillingRoutesBody({
  frame,
  heading,
  pages,
  notFound,
  redirectTo = '/',
  location,
}: BridgeBillingRoutesProps & { location: BridgeRouteLocation }) {
  const rest = location.rest;
  const route = parseBridgeBillingRoute(rest);
  // Links are relative to where the route is mounted, not hard-coded to /subscription.
  const base = bridgeAuthBase(location.pathname, rest) || '/';
  const at = (sub: string) => (base === '/' ? `/${sub}` : `${base}/${sub}`);
  const page = route?.page;

  // Every page reads the subscription, reusing a read younger than 30 s. The
  // success page always re-reads: the checkout just changed it.
  useEffect(() => {
    if (!page) return;
    void (page === 'success' ? loadSubscription() : ensureSubscription());
  }, [page]);

  if (!route || !page) {
    if (rest === null) return null;
    return (
      <div data-bridge-billing-route="not-found" style={{ display: 'contents' }}>
        {notFound ?? <p className="bridge-billing-text">Page not found.</p>}
      </div>
    );
  }

  if (pages && pages[page] !== undefined) {
    return (
      <div data-bridge-billing-route={page} data-bridge-billing-page-owner="app" style={{ display: 'contents' }}>
        {pages[page]}
      </div>
    );
  }

  const content = (
    <>
      {heading ? heading(page) : <h1 className="bridge-billing-heading">{DEFAULT_HEADINGS[page]}</h1>}
      {page === 'manage' ? (
        <>
          <div className="bridge-billing-current">
            <span className="bridge-billing-label">Current plan</span>
            <BridgeSubscriptionStatus />
            <BillingPortalButton />
          </div>
          <PlanSelector successRedirect={at('success')} cancelRedirect={base} />
        </>
      ) : page === 'plan' ? (
        <>
          <p className="bridge-billing-text">Pick a plan to start using the app.</p>
          <PlanSelector successRedirect={at('success')} cancelRedirect={at('plan')} />
        </>
      ) : page === 'success' ? (
        <>
          <p className="bridge-billing-text">Your plan is active.</p>
          <div className="bridge-billing-current">
            <span className="bridge-billing-label">Current plan</span>
            <BridgeSubscriptionStatus />
          </div>
          <a className="bridge-btn-primary bridge-billing-action" href={redirectTo}>
            Continue
          </a>
        </>
      ) : (
        <>
          <p className="bridge-billing-text">
            The payment may still have gone through. Check your subscription in a moment; if it has not changed, try
            again.
          </p>
          <a className="bridge-btn-primary bridge-billing-action" href={base}>
            Back to subscription
          </a>
        </>
      )}
    </>
  );

  return (
    <div data-bridge-billing-route={page} style={{ display: 'contents' }}>
      {frame ? frame(page, content) : <div className="bridge-billing-page">{content}</div>}
    </div>
  );
}

export default BridgeBillingRoutes;
