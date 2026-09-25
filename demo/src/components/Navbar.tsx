import { Login, ProfileName, getBridgeAuth, useAuth } from '@nebulr-group/bridge-react';
import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { getDemoEnvironment } from '../utils/env';

/** The app id the SDK actually initialized with (env beats props in the provider). */
function resolvedAppId(): string {
  try {
    return getBridgeAuth().getApiContext().appId ?? '';
  } catch {
    return '';
  }
}

interface NavItem {
  label: string;
  to: string;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Dashboard', to: '/dashboard', requiresAuth: true },
  { label: 'Profile', to: '/profile', requiresAuth: true },
  { label: 'Feature Flags', to: '/feature-flags', requiresAuth: true },
  // { label: 'Team', to: '/team', requiresAuth: true },
  { label: 'Subscription', to: '/subscription', requiresAuth: true },
  { label: 'API Tokens', to: '/api-tokens', requiresAuth: true },
  { label: 'Token Status', to: '/token-status', requiresAuth: true }
];

function Navbar() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  const filteredItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.requiresAuth && !isAuthenticated) {
          return false;
        }
        return true;
      }),
    [isAuthenticated]
  );

  return (
    <header className="nav-bar">
      <div className="nav-inner">
        <div className="nav-brand">bridge React Demo</div>
        {/* Which backend this build talks to, and with which app. The Playwright
            global-setup asserts both against the project it is running, so a
            demo started in the wrong --mode fails loudly (TBP-721). */}
        <span className="pill env-pill" data-env={getDemoEnvironment()} data-app-id={resolvedAppId()}>
          {getDemoEnvironment()}
        </span>
        <nav className="nav-links">
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                ['nav-link', isActive ? 'nav-link-active' : undefined]
                  .filter(Boolean)
                  .join(' ')
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}

          {isAuthenticated ? (
            <div className="nav-links">
              {!isLoading && <ProfileName className="pill" />}
              <button type="button" className="nav-button" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="nav-links">
              <Login />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;

