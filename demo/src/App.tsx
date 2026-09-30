import { BridgePaywallPage, ProtectedRoute } from '@nebulr-group/bridge-react';
import { BridgeAuthRoutes, BridgeBillingRoutes, useBridgeRouter } from '@nebulr-group/bridge-react/react-router';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import FeatureFlagsPage from './pages/FeatureFlagsPage';
import FlagContextDemoPage from './pages/FlagContextDemoPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ApiTokensPage from './pages/ApiTokensPage';
import ProfilePage from './pages/ProfilePage';
import SubscriptionRelativePage from './pages/SubscriptionRelativePage';
import TeamPage from './pages/TeamPage';
import TeamPanelPage from './pages/TeamPanelPage';
import WorkspacesPage from './pages/WorkspacesPage';
import TokenStatusPage from './pages/TokenStatusPage';
import ProtectedPage from './pages/ProtectedPage';

function App() {
  // Bridge's own navigation (the route guard, the paywall) goes through React
  // Router. <BridgeAuthRoutes>/<BridgeBillingRoutes> also register it; this
  // covers pages that render neither.
  useBridgeRouter();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/flag-context-demo" element={<FlagContextDemoPage />} />

        {/* TBP-743 — every sign-in page (login, signup, the OAuth callback,
            set-password, forgot-password, magic-link, setup-passkey,
            workspaces) from one route. Public: not behind ProtectedRoute. */}
        <Route path="/auth/*" element={<BridgeAuthRoutes />} />

        {/* The demo's own onboarding paywall (billing.paywallRoute: '/welcome').
            PUBLIC so a plan-less user can land and pick a plan. */}
        <Route path="/welcome" element={<BridgePaywallPage heading="Welcome — let's pick your plan" />} />

        {/* Wrap all protected routes under one ProtectedRoute */}
        <Route
          path="/*"
          element={(
            <ProtectedRoute>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/protected" element={<ProtectedPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/feature-flags" element={<FeatureFlagsPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/team-panel" element={<TeamPanelPage />} />
                <Route path="/workspaces" element={<WorkspacesPage />} />
                {/* TBP-743 — the subscription page, /subscription/plan,
                    /subscription/success and /subscription/error. */}
                <Route path="/subscription/*" element={<BridgeBillingRoutes />} />
                <Route path="/subscription-relative" element={<SubscriptionRelativePage />} />
                <Route path="/api-tokens" element={<ApiTokensPage />} />
                <Route path="/token-status" element={<TokenStatusPage />} />
              </Routes>
            </ProtectedRoute>
          )}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
