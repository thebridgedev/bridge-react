/**
 * A small badge with the Live connection's status, for development builds:
 * `open` (live), `polling` (no socket; checking every few seconds),
 * `connecting`, `closed` or `off`.
 */
import type { HTMLAttributes } from 'react';
import { useLiveStatus } from '../../react/hooks.js';

const LABELS: Record<string, string> = {
	open: 'Live',
	polling: 'Live (polling)',
	connecting: 'Connecting…',
	closed: 'Live closed',
	off: 'Live off',
};

export function LiveStatusBadge(props: HTMLAttributes<HTMLSpanElement>) {
	const status = useLiveStatus();
	return (
		<span data-bridge-live-status={status} role="status" {...props}>
			{LABELS[status] ?? status}
		</span>
	);
}

export default LiveStatusBadge;
