import { Login, useAuth, useProfile } from '@nebulr-group/bridge-react';
import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';

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
  // { label: 'Subscription', to: '/subscription', requiresAuth: true },
  { label: 'Token Status', to: '/token-status', requiresAuth: true }
];

function Navbar() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { profile } = useProfile();

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
              {!isLoading && profile?.fullName && (
                <span className="pill">{profile.fullName}</span>
              )}
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

