/**
 * TBP-743 (port of bridge-svelte TBP-702) — a paywall page at an address of
 * the app's choosing, e.g. onboarding at /welcome:
 *
 *   <Route path="/welcome" element={<BridgePaywallPage heading="Pick a plan to get started" />} />
 *   <BridgeProvider config={{ billing: { paywallRoute: '/welcome' } }}>
 *
 * `<BridgeBillingRoutes>` already serves a paywall at /subscription/plan; this
 * is only for an app that wants its own. The paywall redirect has to know the
 * address before this page has ever been visited — that is what the config
 * line is for. Mounted anywhere else, this page says so in the dev console.
 *
 * A completed checkout lands on the subscription success page
 * (`<billing.manageRoute>/success`); a cancelled one comes back here.
 */
import { useEffect, type ReactNode } from 'react';
import type { Plan, PriceOfferSdk } from '@nebulr-group/bridge-auth-core';
import { ensureSubscription } from '../../core/bridge-instance';
import { billingRoutes } from '../../core/billing-routes';
import { isDevBuild } from '../../core/realtime-dev-badge';
import { logger } from '../../utils/logger';
import { PlanSelector } from './PlanSelector';

export interface BridgePaywallPageProps {
  /** The page heading. @default 'Choose a plan' */
  heading?: ReactNode;
  /** Content between the heading and the plans — a welcome line, a checklist. */
  children?: ReactNode;
  /** Where a completed checkout lands. @default `<billing.manageRoute>/success` */
  successRedirect?: string;
  /** Where a cancelled checkout lands. @default this page */
  cancelRedirect?: string;
  /** Called after a free-plan or direct plan change (not the Stripe redirect path). */
  onSelect?: (detail: { plan: Plan; price: PriceOfferSdk }) => void;
}

export function BridgePaywallPage({
  heading = 'Choose a plan',
  children,
  successRedirect,
  cancelRedirect,
  onSelect,
}: BridgePaywallPageProps) {
  const routes = billingRoutes();
  const here = typeof window !== 'undefined' ? window.location.pathname : '/';

  useEffect(() => {
    void ensureSubscription();
    if (isDevBuild() && routes.paywallRoute !== here) {
      logger.warn(
        `[bridge] <BridgePaywallPage> is on ${here}, but plan-less workspaces are sent to ` +
          `${routes.paywallRoute ?? '(nowhere — the paywall redirect is off)'}. ` +
          `Add billing: { paywallRoute: '${here}' } to <BridgeProvider>'s config.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bridge-paywall-page" data-bridge-paywall-page>
      {typeof heading === 'string' ? <h1 className="bridge-paywall-page-heading">{heading}</h1> : heading}
      {children}
      <PlanSelector
        successRedirect={successRedirect ?? routes.successRoute}
        cancelRedirect={cancelRedirect ?? here}
        onSelect={onSelect}
      />
    </div>
  );
}

export default BridgePaywallPage;
