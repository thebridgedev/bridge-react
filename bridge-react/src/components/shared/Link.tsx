/**
 * A link to a page of this app that goes through the app's router, so a
 * click does not reload the page (with `storage: 'memory'`, a reload signs
 * the person out of this tab). Modified clicks and other targets behave as
 * plain links.
 */
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { useBridgeRouter } from '../../react/hooks.js';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	readonly href: string;
}

export function Link({ href, onClick, target, ...rest }: LinkProps) {
	const router = useBridgeRouter();
	function click(event: MouseEvent<HTMLAnchorElement>) {
		onClick?.(event);
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		if (target !== undefined && target !== '_self') return;
		if (!href.startsWith('/') || href.startsWith('//')) return;
		event.preventDefault();
		router.navigate(href);
	}
	return <a href={href} target={target} onClick={click} {...rest} />;
}

export default Link;
