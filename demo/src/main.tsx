import { BridgeProvider } from '@nebulr-group/bridge-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { BridgeWindowExpose } from './components/BridgeWindowExpose';
// The plugin's styles (tokens + component CSS). The demo imports the source
// file because it aliases the package to source; an app writes
// `import '@nebulr-group/bridge-react/styles'`.
import '../../bridge-react/src/styles.css';
import './assets/styles.css';
// Demo-only: the e2e suite's per-worker app id.
import { withTestFixtures } from './utils/env';

// The app id and API address come from VITE_BRIDGE_APP_ID /
// VITE_BRIDGE_API_BASE_URL (TBP-743). `loginRoute` switches sign-in to the
// in-app pages <BridgeAuthRoutes> serves; `/welcome` is the demo's own
// onboarding paywall (<BridgePaywallPage>).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider config={withTestFixtures({ loginRoute: '/auth/login', billing: { paywallRoute: '/welcome' } })}>
      <BridgeWindowExpose />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>
);
