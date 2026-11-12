import type { HTMLAttributes, ReactNode } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
	readonly variant?: 'error' | 'info' | 'success';
	readonly children?: ReactNode;
}

export function Alert({ variant = 'error', children, ...rest }: AlertProps) {
	if (children === undefined || children === null || children === false || children === '') return null;
	return (
		<div data-variant={variant} data-bridge-alert="" role="alert" {...rest}>
			{children}
		</div>
	);
}

export default Alert;
