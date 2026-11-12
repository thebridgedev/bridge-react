import { createContext } from 'react';
import type { BridgeRouter } from '../core/router.js';

/** The router `<BridgeProvider>` was given. */
export const RouterContext = createContext<BridgeRouter | null>(null);
