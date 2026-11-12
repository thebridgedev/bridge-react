/**
 * Every sign-in page from one route: mount it on `/auth/*` in your router.
 *
 * ```tsx
 * <Route path="/auth/*" element={<BridgeAuthRoutes />} />
 * ```
 *
 * Serves sign-in, sign-up, verify-email, forgot-password, set-password,
 * invite, workspaces, handoff, magic-link (a sign-in link's landing),
 * passkey-setup (a passkey setup link's landing) and callback (hosted mode's
 * return from Bridge's page). An unknown page renders `notFound`.
 *
 * Customising, in rungs:
 *   1. `--bridge-*` CSS tokens restyle the forms.
 *   2. `frame(page, form)` replaces everything around the form on every page;
 *      `heading(page)` replaces the form's heading on each page.
 *   3. To own one page, add a route for it before `/auth/*`
 *      (`<Route path="/auth/sign-in" element={<MySignIn />} />`): routers
 *      prefer the specific route, and the other pages keep working.
 *   4. Headless: build on `getBridge()`.
 */
import { readReturnTo } from '@nebulr-group/bridge-auth-core';
import type { ReactNode } from 'react';
import { peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { normalizePath } from '../../core/guard.js';
import { authPageAt, type AuthPage } from '../../core/routes.js';
import { useBridgeConfig, useBridgeRouter, useSignedIn, useTranslator } from '../../react/hooks.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { ForgotPassword } from './ForgotPassword.js';
import { HandoffSignIn } from './HandoffSignIn.js';
import { HostedCallback } from './HostedCallback.js';
import { HostedSignIn } from './HostedSignIn.js';
import { InviteLanding } from './InviteLanding.js';
import { MagicLinkLanding } from './MagicLinkLanding.js';
import { PasskeySetupLanding } from './PasskeySetupLanding.js';
import { SetPassword } from './SetPassword.js';
import { SignInForm } from './SignInForm.js';
import { SignUpForm } from './SignUpForm.js';
import { VerifyEmail } from './VerifyEmail.js';
import { WorkspaceChooser } from './WorkspaceChooser.js';

export interface BridgeAuthRoutesProps {
	/** Where this route is mounted, when not at the config's `auth.base` (a second, framed set of pages). @default `auth.base` */
	readonly base?: string;
	/** Replaces everything around the form, on every page. */
	readonly frame?: (page: AuthPage, form: ReactNode) => ReactNode;
	/** Replaces the form's heading, per page. */
	readonly heading?: (page: AuthPage) => ReactNode;
	readonly messages?: BridgeMessages;
	/** Shown for a path under the auth base that is none of the pages. @default nothing */
	readonly notFound?: ReactNode;
}

export function BridgeAuthRoutes({ base, frame, heading, messages, notFound = null }: BridgeAuthRoutesProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const config = useBridgeConfig() ?? peekConfig();
	const signedIn = useSignedIn();
	const page = authPageAt(normalizePath(router.location.pathname), (base ?? config?.authBase ?? '/auth').replace(/\/+$/, ''));
	if (page === null) return <>{notFound}</>;

	const pageHeading = heading ? heading(page) : undefined;
	const props = { heading: pageHeading, messages };

	function afterSwitch() {
		router.navigate(readReturnTo(router.location.search, config?.returnToParam) ?? config?.afterSignIn ?? '/');
	}

	let body: ReactNode;
	switch (page) {
		case 'sign-in':
			body = config?.hosted ? <HostedSignIn {...props} /> : <SignInForm {...props} />;
			break;
		case 'callback':
			body = <HostedCallback {...props} />;
			break;
		case 'sign-up':
			body = <SignUpForm {...props} />;
			break;
		case 'verify-email':
			body = <VerifyEmail {...props} />;
			break;
		case 'forgot-password':
			body = <ForgotPassword {...props} />;
			break;
		case 'set-password':
			body = <SetPassword {...props} />;
			break;
		case 'invite':
			body = <InviteLanding {...props} />;
			break;
		case 'magic-link':
			body = <MagicLinkLanding {...props} />;
			break;
		case 'passkey-setup':
			body = <PasskeySetupLanding {...props} />;
			break;
		case 'handoff':
			body = <HandoffSignIn {...props} />;
			break;
		case 'workspaces':
			body = signedIn ? (
				<AuthFormWrapper heading={pageHeading === undefined ? t('workspace.chooseHeading') : pageHeading}>
					<WorkspaceChooser onSwitch={afterSwitch} messages={messages} />
				</AuthFormWrapper>
			) : (
				<SignInForm {...props} />
			);
			break;
	}

	// Keyed by page: moving between pages starts each one fresh, as a new route would.
	const form = <AuthPageBody key={page}>{body}</AuthPageBody>;
	return (
		<div data-bridge-auth-route={page} style={{ display: 'contents' }}>
			{frame ? frame(page, form) : <div className="bridge-auth-page">{form}</div>}
		</div>
	);
}

function AuthPageBody({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

export default BridgeAuthRoutes;
