import { BridgeProvider } from '@nebulr-group/bridge-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { BridgeWindowExpose } from './components/BridgeWindowExpose';
// Bridge plugin's structural CSS for its UI components (PlanSelector,
// ApiTokenManagement, Billing 2.0 drop-ins, etc.). Mirrors svelte/nextjs demos
// importing `@nebulr-group/<framework>/styles`; here we import the source file
// directly because the demo aliases the package to source (no built dist).
import '../../bridge-react/src/styles.css';
import './assets/styles.css';
import { getBridgeConfig } from './utils/env';

const bridgeConfig = getBridgeConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider config={bridgeConfig}>
      <BridgeWindowExpose />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>
);
