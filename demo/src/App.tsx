import { CallbackHandler, ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import FeatureFlagsPage from './pages/FeatureFlagsPage';
import FlagContextDemoPage from './pages/FlagContextDemoPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SdkLoginPage from './pages/SdkLoginPage';
import SdkSignupPage from './pages/SdkSignupPage';
import SdkMagicLinkPage from './pages/SdkMagicLinkPage';
import SdkForgotPasswordPage from './pages/SdkForgotPasswordPage';
import SdkSetPasswordPage from './pages/SdkSetPasswordPage';
import SdkSetupPasskeyPage from './pages/SdkSetupPasskeyPage';
import NotFoundPage from './pages/NotFoundPage';
import ApiTokensPage from './pages/ApiTokensPage';
import ProfilePage from './pages/ProfilePage';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionCancelPage from './pages/SubscriptionCancelPage';
import SubscriptionRelativePage from './pages/SubscriptionRelativePage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import TeamPage from './pages/TeamPage';
import TeamPanelPage from './pages/TeamPanelPage';
import WorkspacesPage from './pages/WorkspacesPage';
import TokenStatusPage from './pages/TokenStatusPage';
import WelcomePage from './pages/WelcomePage';
import PaymentErrorPage from './pages/PaymentErrorPage';
import ProtectedPage from './pages/ProtectedPage';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
      getCurrentPath: () => window.location.pathname
    });
  }, [navigate]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/flag-context-demo" element={<FlagContextDemoPage />} />
        <Route path="/auth/oauth-callback" element={<CallbackHandler />} />

        {/* SDK Auth — in-app auth flows (public, not behind ProtectedRoute) */}
        <Route path="/auth/login" element={<SdkLoginPage />} />
        <Route path="/auth/signup" element={<SdkSignupPage />} />
        <Route path="/auth/magic-link" element={<SdkMagicLinkPage />} />
        <Route path="/auth/forgot-password" element={<SdkForgotPasswordPage />} />
        <Route path="/auth/set-password/:token" element={<SdkSetPasswordPage />} />
        <Route path="/auth/setup-passkey/:token" element={<SdkSetupPasskeyPage />} />

        {/* Billing paywall routes — PUBLIC (outside ProtectedRoute) so the
            paywall redirect target and the Stripe-confirm-failure landing are
            reachable without bouncing in a redirect loop. */}
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/payment-error" element={<PaymentErrorPage />} />

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
                <Route path="/subscription" element={<SubscriptionPage />} />
                <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
                <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
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
