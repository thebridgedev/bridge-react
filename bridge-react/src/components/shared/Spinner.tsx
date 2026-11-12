import type { HTMLAttributes } from 'react';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
	readonly size?: number;
}

export function Spinner({ size = 24, style, ...rest }: SpinnerProps) {
	return <span style={{ width: `${size}px`, height: `${size}px`, ...style }} data-bridge-spinner="" {...rest} />;
}

export default Spinner;
