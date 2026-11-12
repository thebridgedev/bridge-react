/**
 * Confirms a checkout the person just came back from, and says how it went.
 * `<BridgeBillingRoutes>` shows it on its pages; to land a checkout anywhere
 * else, put it on that page:
 *
 * ```tsx
 * <CheckoutNotice />
 * ```
 *
 * It renders nothing unless the address is a return from checkout. It then
 * confirms the checkout once, shows the outcome, takes the checkout's
 * parameters off the address and fetches the billing facts again. `children`
 * (a function of the outcome) replaces the text.
 */
import { readCheckoutReturn, type BillingFacts } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { billing } from '../../core/resources.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';

// One confirmation per checkout, however many notices are on the page.
let lastConfirmation: { readonly session: string; readonly facts: Promise<BillingFacts> } | null = null;

export type CheckoutOutcome =
	| { readonly state: 'confirming' }
	| { readonly state: 'success'; readonly planName: string | null }
	| { readonly state: 'failed'; readonly error: string };

export interface CheckoutNoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
	/** Show a close button once the outcome is known. @default true */
	readonly dismissible?: boolean;
	/** Called once the checkout is confirmed, with the new facts. */
	readonly onConfirmed?: (facts: BillingFacts) => void;
	/** Replaces the text. */
	readonly children?: (outcome: CheckoutOutcome) => ReactNode;
}

export function CheckoutNotice({ dismissible = true, onConfirmed, children, className, ...rest }: CheckoutNoticeProps) {
	const t = useTranslator();
	const router = useBridgeRouter();
	const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);
	// The latest callbacks, without running the confirmation again when they change.
	const latest = useRef({ onConfirmed, router, t });
	latest.current = { onConfirmed, router, t };

	useEffect(() => {
		const checkout = readCheckoutReturn(window.location.href);
		if (checkout === null) return;
		let alive = true;
		setOutcome({ state: 'confirming' });
		let confirmation = lastConfirmation;
		const first = confirmation === null || confirmation.session !== checkout.session;
		if (confirmation === null || confirmation.session !== checkout.session) {
			confirmation = { session: checkout.session, facts: getBridge().billing.confirmCheckout(checkout.session) };
			lastConfirmation = confirmation;
		}
		confirmation.facts
			.then(
				(facts) => {
					if (!alive) return;
					setOutcome({ state: 'success', planName: facts.plan?.name ?? null });
					latest.current.onConfirmed?.(facts);
				},
				(error: unknown) => {
					if (alive) setOutcome({ state: 'failed', error: errorMessage(error, latest.current.t, 'error.generic') });
				},
			)
			.finally(() => {
				if (!first) return;
				// The checkout's parameters come off the address, through the router so it stays in step.
				const url = new URL(window.location.href);
				url.searchParams.delete('stripe_success');
				url.searchParams.delete('session_id');
				latest.current.router.navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });
				void billing.refresh();
			});
		return () => {
			alive = false;
		};
	}, []);

	if (outcome === null) return null;
	return (
		<div
			className={['bridge-checkout-notice', className].filter(Boolean).join(' ')}
			data-bridge-checkout-notice=""
			data-state={outcome.state}
			role={outcome.state === 'failed' ? 'alert' : 'status'}
			{...rest}
		>
			<svg className="bridge-checkout-notice-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
				<circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6" />
				{outcome.state === 'failed' ? (
					<path d="M10 5.5v5.5M10 14v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				) : outcome.state === 'success' ? (
					<path d="M6 10.2l2.6 2.6L14 7.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
				) : null}
			</svg>
			<div className="bridge-checkout-notice-body">
				{children ? (
					children(outcome)
				) : outcome.state === 'confirming' ? (
					<strong className="bridge-checkout-notice-title">Confirming your payment…</strong>
				) : outcome.state === 'success' ? (
					<>
						<strong className="bridge-checkout-notice-title">{outcome.planName ? `You're on ${outcome.planName} now` : 'Your new plan is active'}</strong>
						<span className="bridge-checkout-notice-text">Your payment went through and the new plan is active.</span>
					</>
				) : (
					<>
						<strong className="bridge-checkout-notice-title">We couldn't confirm your payment</strong>
						<span className="bridge-checkout-notice-text">{outcome.error} The payment may still have gone through; check your plan again in a moment.</span>
					</>
				)}
			</div>
			{dismissible && outcome.state !== 'confirming' && (
				<button type="button" className="bridge-checkout-notice-close" aria-label="Dismiss" onClick={() => setOutcome(null)}>
					×
				</button>
			)}
		</div>
	);
}

export default CheckoutNotice;
