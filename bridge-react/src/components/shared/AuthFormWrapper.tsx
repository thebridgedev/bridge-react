/**
 * The frame of every sign-in form: an optional heading and description, then
 * the form. Pass `heading={null}` and `description={null}` when your page
 * writes its own title; each is suppressed on its own. A string heading is
 * drawn as the form's `<h2>`; any other node replaces it as given.
 */
import type { HTMLAttributes, ReactNode } from 'react';

export interface AuthFormWrapperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
	/** Heading: text for the form's `<h2>`, or your own node. `null` or `''` renders none. */
	readonly heading?: ReactNode;
	/** The line under the heading: text, or your own node. `null` or `''` renders none. */
	readonly description?: ReactNode;
	readonly children?: ReactNode;
	readonly [data: `data-${string}`]: string | number | boolean | null | undefined;
}

export function AuthFormWrapper({ heading, description, children, ...rest }: AuthFormWrapperProps) {
	return (
		<div data-bridge-auth-form="" {...rest}>
			{typeof heading === 'string' ? heading !== '' && <h2 className="bridge-auth-heading">{heading}</h2> : heading}
			{typeof description === 'string' ? description !== '' && <p className="bridge-step-desc">{description}</p> : description}
			{children}
		</div>
	);
}

export default AuthFormWrapper;
