/**
 * A value that can be read now and watched for changes: the shape auth-core's
 * own stores have, so React reads both the same way (`useSyncExternalStore`).
 */
export interface Watchable<T> {
	get(): T;
	/** Calls `listener` on every change. Returns the way to stop. */
	subscribe(listener: (value: T) => void): () => void;
}

/** A value this package owns: set it, and every watcher hears. */
export class Value<T> implements Watchable<T> {
	private readonly listeners = new Set<(value: T) => void>();
	constructor(private current: T) {}

	get(): T {
		return this.current;
	}

	set(next: T): void {
		if (Object.is(next, this.current)) return;
		this.current = next;
		for (const listener of [...this.listeners]) listener(next);
	}

	update(change: (value: T) => T): void {
		this.set(change(this.current));
	}

	subscribe(listener: (value: T) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}
