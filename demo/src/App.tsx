import { ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import CallbackPage from './pages/CallbackPage';
import DashboardPage from './pages/DashboardPage';
import FeatureFlagsPage from './pages/FeatureFlagsPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/oauth-callback" element={<CallbackPage />} />

        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute redirectTo="/login">
              <DashboardPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/profile"
          element={(
            <ProtectedRoute redirectTo="/login">
              <ProfilePage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/feature-flags"
          element={(
            <ProtectedRoute redirectTo="/login">
              <FeatureFlagsPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/team"
          element={(
            <ProtectedRoute redirectTo="/login">
              <TeamPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/subscription"
          element={(
            <ProtectedRoute redirectTo="/login">
              <SubscriptionPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/token-status"
          element={(
            <ProtectedRoute redirectTo="/login">
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
