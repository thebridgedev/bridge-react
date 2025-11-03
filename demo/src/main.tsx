import { BridgeProvider } from '@nebulr-group/bridge-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './assets/styles.css';
import { getBridgeConfig } from './utils/env';

const bridgeConfig = getBridgeConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider config={bridgeConfig}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>
);
