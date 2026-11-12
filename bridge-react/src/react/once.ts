import { useEffect, useRef } from 'react';

/**
 * Runs `effect` once per mounted component, also under React's strict mode,
 * which runs effects twice in development. For work that must not happen
 * twice: taking an email link's token from the address, spending a link.
 */
export function useMountOnce(effect: () => void | Promise<void>): void {
	const done = useRef(false);
	useEffect(() => {
		if (done.current) return;
		done.current = true;
		void effect();
		// Once per mount, by design.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
}
