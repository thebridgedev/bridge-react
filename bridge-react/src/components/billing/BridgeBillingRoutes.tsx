/**
 * Every billing page from one route: mount it on `/subscription/*` in your
 * router.
 *
 * ```tsx
 * <Route path="/subscription/*" element={<BridgeBillingRoutes />} />
 * ```
 *
 * Serves, under `billing.base`:
 *   (the base)  the current plan, "Manage billing" and the plans to change to
 *   plan        the paywall: where the route guard sends a workspace whose app
 *               is not active. Once a plan is active it goes on to the page the
 *               person was headed for.
 *   success     a confirmation page
 *   error       where a failed checkout lands
 * A return from checkout is confirmed on any of the first three. An unknown
 * page renders `notFound`.
 *
 * Customising, in rungs:
 *   1. `--bridge-*` CSS tokens restyle the pages.
 *   2. `frame(page, content)` replaces everything around the content on every
 *      page; `heading(page)` replaces each page's heading.
 *   3. To own one page, add a more specific route for it
 *      (`/subscription/plan`) before this one; the other pages keep working.
 *   4. Headless: PlanPicker, SubscriptionStatus, BillingPortalButton,
 *      CheckoutNotice and the `useBilling` and `usePlans` hooks.
 */
import { readReturnTo, STANDARD_FLAGS } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { normalizePath } from '../../core/guard.js';
import { parseBillingPage, type BillingPage } from '../../core/routes.js';
import { useBilling, useBridgeConfig, useBridgeRouter, useFlag } from '../../react/hooks.js';
import { Link } from '../shared/Link.js';
import { BillingPortalButton } from './BillingPortalButton.js';
import { CheckoutNotice } from './CheckoutNotice.js';
import { PlanPicker } from './PlanPicker.js';
import { SubscriptionStatus } from './SubscriptionStatus.js';
import { subscriptionMeta } from './plan-format.js';

export interface BridgeBillingRoutesProps {
	/** Replaces everything around the content, on every page. */
	readonly frame?: (page: BillingPage, content: ReactNode) => ReactNode;
	/** Replaces each page's heading. */
	readonly heading?: (page: BillingPage) => ReactNode;
	/** Where "Continue" on the success page goes. @default the return address, else `auth.afterSignIn` */
	readonly redirectTo?: string;
	/** Confirm and announce a return from checkout. `false` leaves it to your own CheckoutNotice. @default true */
	readonly checkoutNotice?: boolean;
	/** Shown for a path under `billing.base` that is none of the pages. @default nothing */
	readonly notFound?: ReactNode;
}

const DEFAULT_HEADINGS: Record<BillingPage, string> = {
	manage: 'Subscription',
	plan: 'Choose a plan',
	success: "You're all set",
	error: "We couldn't confirm your payment",
};

export function BridgeBillingRoutes({ frame, heading, redirectTo, checkoutNotice = true, notFound = null }: BridgeBillingRoutesProps) {
	const config = useBridgeConfig();
	const router = useBridgeRouter();
	const billing = useBilling();
	const base = config?.billingBase ?? '/subscription';
	const manageHref = base || '/';
	const appActive = useFlag(config?.flagKeys.appActive ?? STANDARD_FLAGS.appActive).value === true;

	const path = normalizePath(router.location.pathname);
	const current = path === base || path.startsWith(`${base}/`) ? parseBillingPage(path.slice(base.length)) : null;
	const returnTo = readReturnTo(router.location.search, config?.returnToParam) ?? config?.afterSignIn ?? '/';
	const meta = subscriptionMeta(billing.value);

	// On the plan page: once a plan was chosen here and the app is active, go on.
	const [chosen, setChosen] = useState(false);
	const leaving = useRef(false);
	useEffect(() => {
		if (current !== 'plan' || !chosen || !appActive || leaving.current) return;
		leaving.current = true;
		router.navigate(returnTo);
	}, [current, chosen, appActive, returnTo]);

	if (current === null) return <>{notFound}</>;
	const p = current;

	const content = (
		<>
			{checkoutNotice && p !== 'error' && <CheckoutNotice onConfirmed={p === 'plan' ? () => setChosen(true) : undefined} />}
			{heading ? heading(p) : <h1 className="bridge-billing-heading">{DEFAULT_HEADINGS[p]}</h1>}

			{p === 'manage' ? (
				<>
					<p className="bridge-billing-text">Your plan, what it includes, and billing.</p>
					<div className="bridge-billing-summary" data-bridge-billing-summary="">
						<div className="bridge-billing-summary-plan">
							<span className="bridge-billing-label">Current plan</span>
							<SubscriptionStatus className="bridge-billing-summary-status" />
							{meta && (
								<span className="bridge-billing-summary-meta" data-bridge-billing-meta="">
									{meta}
								</span>
							)}
						</div>
						<BillingPortalButton />
					</div>
					<PlanPicker heading="Change plan" />
				</>
			) : p === 'plan' ? (
				<>
					<p className="bridge-billing-text">Pick a plan to start using the app.</p>
					<PlanPicker onChanged={() => setChosen(true)} />
				</>
			) : p === 'success' ? (
				<>
					<p className="bridge-billing-text">Your plan is active.</p>
					<div className="bridge-billing-current">
						<span className="bridge-billing-label">Current plan</span>
						<SubscriptionStatus />
					</div>
					<Link className="bridge-btn-primary bridge-billing-action" href={redirectTo ?? returnTo}>
						Continue
					</Link>
				</>
			) : (
				<>
					<p className="bridge-billing-text">The payment may still have gone through. Check your subscription in a moment; if it has not changed, try again.</p>
					<Link className="bridge-btn-primary bridge-billing-action" href={manageHref}>
						Back to subscription
					</Link>
				</>
			)}
		</>
	);

	return (
		<div data-bridge-billing-route={p} style={{ display: 'contents' }}>
			{frame ? frame(p, content) : <div className="bridge-billing-page">{content}</div>}
		</div>
	);
}

export default BridgeBillingRoutes;
