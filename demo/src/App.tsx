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

        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/feature-flags"
          element={(
            <ProtectedRoute>
              <FeatureFlagsPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/team"
          element={(
            <ProtectedRoute>
              <TeamPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/subscription"
          element={(
            <ProtectedRoute>
              <SubscriptionPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/token-status"
          element={(
            <ProtectedRoute>
              <TokenStatusPage />
            </ProtectedRoute>
          )}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
