import { CallbackHandler, ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import FeatureFlagsPage from './pages/FeatureFlagsPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';
import SubscriptionPage from './pages/SubscriptionPage';
import TeamPage from './pages/TeamPage';
import TokenStatusPage from './pages/TokenStatusPage';

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
        <Route path="/auth/oauth-callback" element={<CallbackHandler />} />

        {/* Wrap all protected routes under one ProtectedRoute */}
        <Route
          path="/*"
          element={(
            <ProtectedRoute>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/feature-flags" element={<FeatureFlagsPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/subscription" element={<SubscriptionPage />} />
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
