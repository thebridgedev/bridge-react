# Bridge React Examples

Complete guide to using Bridge in your React application.

---

## Table of Contents

- [Router Integration](#router-integration)
  - [Without a Router (Default)](#without-a-router-default)
  - [React Router v6](#react-router-v6)
  - [TanStack Router](#tanstack-router)
  - [Wouter](#wouter)
  - [Custom Router Adapter](#custom-router-adapter)
- [Authentication](#authentication)
  - [Adding a Login Button](#adding-a-login-button)
  - [Pre-built Login Component](#pre-built-login-component)
  - [Handling OAuth Callback](#handling-oauth-callback)
  - [Checking Authentication Status](#checking-authentication-status)
  - [User Profile Information](#user-profile-information)
  - [Route Protection](#route-protection)
  - [Automatic Token Renewal](#automatic-token-renewal)
  - [Logout](#logout)
- [Feature Flags](#feature-flags)
  - [Basic Feature Flag Usage](#basic-feature-flag-usage)
  - [Live vs Cached Feature Flags](#live-vs-cached-feature-flags)
  - [Programmatic Flag Checking](#programmatic-flag-checking)
  - [Conditional Rendering](#conditional-rendering)
  - [Bulk Flag Access](#bulk-flag-access)
- [Team Management](#team-management)
  - [Embedded Team Portal](#embedded-team-portal)
  - [Getting Team Management URL](#getting-team-management-url)
  - [Opening in New Window](#opening-in-new-window)
- [Subscription Management](#subscription-management)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Provider Configuration](#provider-configuration)
  - [Getting Config Values](#getting-config-values)
- [Advanced Usage](#advanced-usage)
  - [Token Status Monitoring](#token-status-monitoring)
  - [Custom Error Handling](#custom-error-handling)
  - [State Management Integration](#state-management-integration)

---

## Router Integration

Bridge React works with any React router or no router at all. Here's how to integrate with popular routers:

### Without a Router (Default)

If you're not using a router, Bridge will use `window.location` by default:

```tsx
// src/App.tsx
import { useEffect } from 'react';
import { useAuth, ProtectedRoute } from '@nebulr-group/bridge-react';

function App() {
  const { isAuthenticated, handleCallback } = useAuth();
  
  // Handle OAuth callback
  useEffect(() => {
    if (window.location.pathname === '/auth/oauth-callback') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      if (code) {
        handleCallback(code).then(() => {
          window.location.href = '/';
        });
      }
    }
  }, [handleCallback]);
  
  // Simple routing based on pathname
  const currentPath = window.location.pathname;
  
  if (currentPath === '/auth/oauth-callback') {
    return <div>Authenticating...</div>;
  }
  
  if (currentPath === '/login') {
    return <LoginPage />;
  }
  
  if (currentPath === '/dashboard') {
    return (
      <ProtectedRoute redirectTo="/login">
        <Dashboard />
      </ProtectedRoute>
    );
  }
  
  return <HomePage />;
}
```

### React Router v6

Full integration with React Router v6:

```tsx
// src/index.tsx
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { BridgeProvider, setRouterAdapter } from '@nebulr-group/bridge-react';
import App from './App';

// Router adapter component
function RouterSetup({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => {
        navigate(path, { replace: options?.replace });
      },
      replace: (path) => {
        navigate(path, { replace: true });
      },
      getCurrentPath: () => window.location.pathname
    });
  }, [navigate]);
  
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BridgeProvider>
      <BrowserRouter>
        <RouterSetup>
          <App />
        </RouterSetup>
      </BrowserRouter>
    </BridgeProvider>
  </React.StrictMode>
);

// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, ProtectedRoute } from '@nebulr-group/bridge-react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CallbackPage from './pages/CallbackPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/oauth-callback" element={<CallbackPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute redirectTo="/login">
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

// src/pages/CallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@nebulr-group/bridge-react';

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  
  useEffect(() => {
    const code = searchParams.get('code');
    
    if (code) {
      handleCallback(code)
        .then(() => navigate('/dashboard'))
        .catch((error) => {
          console.error('Authentication failed:', error);
          navigate('/login');
        });
    }
  }, [searchParams, handleCallback, navigate]);
  
  return (
    <div>
      <p>Authenticating...</p>
    </div>
  );
}
```

### TanStack Router

Integration with TanStack Router:

```tsx
// src/main.tsx
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, useNavigate } from '@tanstack/react-router';
import { BridgeProvider, setRouterAdapter } from '@nebulr-group/bridge-react';
import { router } from './router';

function RouterSetup({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => {
        navigate({ to: path, replace: options?.replace });
      },
      replace: (path) => {
        navigate({ to: path, replace: true });
      },
      getCurrentPath: () => window.location.pathname
    });
  }, [navigate]);
  
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BridgeProvider>
      <RouterProvider router={router}>
        <RouterSetup>
          <Outlet />
        </RouterSetup>
      </RouterProvider>
    </BridgeProvider>
  </React.StrictMode>
);
```

### Wouter

Integration with Wouter:

```tsx
// src/App.tsx
import { useEffect } from 'react';
import { Router, Route, useLocation } from 'wouter';
import { setRouterAdapter } from '@nebulr-group/bridge-react';

function RouterSetup({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => {
        setLocation(path, { replace: options?.replace });
      },
      replace: (path) => {
        setLocation(path, { replace: true });
      },
      getCurrentPath: () => window.location.pathname
    });
  }, [setLocation]);
  
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <RouterSetup>
        <Route path="/" component={HomePage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/auth/oauth-callback" component={CallbackPage} />
        <Route path="/dashboard" component={DashboardPage} />
      </RouterSetup>
    </Router>
  );
}
```

### Custom Router Adapter

Create your own router adapter for any routing solution:

```tsx
import { setRouterAdapter, RouterAdapter } from '@nebulr-group/bridge-react';

// Define your custom adapter
const myCustomAdapter: RouterAdapter = {
  navigate: (path: string, options?: { replace?: boolean }) => {
    // Your custom navigation logic
    if (options?.replace) {
      myRouter.replace(path);
    } else {
      myRouter.push(path);
    }
  },
  
  replace: (path: string) => {
    // Your custom replace logic
    myRouter.replace(path);
  },
  
  getCurrentPath: () => {
    // Return current pathname
    return myRouter.currentPath;
  }
};

// Set the adapter
setRouterAdapter(myCustomAdapter);
```

---

## Authentication

### Adding a Login Button

The simplest way to add login functionality:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function LoginButton() {
  const { login, logout, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <button disabled>Loading...</button>;
  }
  
  return (
    <div>
      {isAuthenticated ? (
        <button onClick={() => logout()}>
          Sign Out
        </button>
      ) : (
        <button onClick={() => login()}>
          Sign In
        </button>
      )}
    </div>
  );
}
```

### Pre-built Login Component

Use the pre-built `Login` component:

```tsx
import { Login } from '@nebulr-group/bridge-react';

function LoginPage() {
  return (
    <div>
      <h1>Welcome to My App</h1>
      <p>Please sign in to continue</p>
      <Login />
    </div>
  );
}
```

With custom redirect:

```tsx
import { Login } from '@nebulr-group/bridge-react';

function LoginPage() {
  return (
    <div>
      <h1>Welcome</h1>
      <Login redirectUri="/dashboard" />
    </div>
  );
}
```

### Handling OAuth Callback

Handle the OAuth callback after login:

#### Simple Callback Handler:

```tsx
// src/pages/CallbackPage.tsx
import { useEffect } from 'react';
import { useAuth } from '@nebulr-group/bridge-react';

export default function CallbackPage() {
  const { handleCallback } = useAuth();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      handleCallback(code).then(() => {
        window.location.href = '/';
      }).catch((error) => {
        console.error('Authentication error:', error);
        window.location.href = '/login';
      });
    }
  }, [handleCallback]);
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <div>
        <h2>Authenticating...</h2>
        <p>Please wait while we sign you in</p>
      </div>
    </div>
  );
}
```

#### With Error Handling:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@nebulr-group/bridge-react';

export default function CallbackPage() {
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');
    
    if (errorParam) {
      setError('Authentication failed. Please try again.');
      setTimeout(() => window.location.href = '/login', 3000);
      return;
    }
    
    if (code) {
      handleCallback(code)
        .then(() => {
          window.location.href = '/';
        })
        .catch((err) => {
          setError('Failed to authenticate. Please try again.');
          console.error('Authentication error:', err);
          setTimeout(() => window.location.href = '/login', 3000);
        });
    }
  }, [handleCallback]);
  
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <p>Redirecting to login...</p>
      </div>
    );
  }
  
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h2>Authenticating...</h2>
      <p>Please wait while we sign you in</p>
    </div>
  );
}
```

### Checking Authentication Status

Check if a user is currently authenticated:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function AuthStatus() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading authentication status...</div>;
  }
  
  return (
    <div>
      {isAuthenticated ? (
        <p>✅ You are logged in</p>
      ) : (
        <p>❌ Please log in to continue</p>
      )}
    </div>
  );
}
```

### User Profile Information

Access the current user's profile:

```tsx
import { useProfile } from '@nebulr-group/bridge-react';

function UserProfile() {
  const { profile, isLoading, error } = useProfile();
  
  if (isLoading) {
    return <div>Loading profile...</div>;
  }
  
  if (error) {
    return <div>Error loading profile: {error}</div>;
  }
  
  if (!profile) {
    return <div>No user logged in</div>;
  }
  
  return (
    <div>
      <h2>User Profile</h2>
      <p><strong>Name:</strong> {profile.fullName}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Username:</strong> {profile.username}</p>
      <p><strong>Email Verified:</strong> {profile.emailVerified ? 'Yes' : 'No'}</p>
      
      {profile.tenant && (
        <div>
          <h3>Organization</h3>
          <p><strong>Name:</strong> {profile.tenant.name}</p>
          <p><strong>ID:</strong> {profile.tenant.id}</p>
        </div>
      )}
    </div>
  );
}
```

Access specific profile properties:

```tsx
import { useProfile } from '@nebulr-group/bridge-react';

function UserGreeting() {
  const { profile, isOnboarded, hasMultiTenantAccess } = useProfile();
  
  return (
    <div>
      <h1>Welcome, {profile?.fullName || 'Guest'}!</h1>
      
      {!isOnboarded() && (
        <div className="alert">
          Please complete your profile setup
        </div>
      )}
      
      {hasMultiTenantAccess() && (
        <div>
          <p>You have access to multiple organizations</p>
        </div>
      )}
    </div>
  );
}
```

### Route Protection

Protect routes from unauthenticated access:

#### Basic Protection:

```tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';

function App() {
  return (
    <div>
      {/* Public content */}
      <HomePage />
      
      {/* Protected content */}
      <ProtectedRoute redirectTo="/login">
        <Dashboard />
      </ProtectedRoute>
    </div>
  );
}
```

#### With React Router:

```tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@nebulr-group/bridge-react';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute redirectTo="/login">
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute redirectTo="/login">
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}
```

#### Layout-Level Protection:

```tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { Outlet } from 'react-router-dom';

function ProtectedLayout() {
  return (
    <ProtectedRoute redirectTo="/login">
      <div>
        <Navbar />
        <Sidebar />
        <main>
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}

// In your router
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  
  <Route element={<ProtectedLayout />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Route>
</Routes>
```

#### Manual Protection:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';

function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated, isLoading]);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Protected content */}
    </div>
  );
}
```

### Automatic Token Renewal

bridge automatically handles token renewal. Monitor the renewal status:

```tsx
import { TokenStatus } from '@nebulr-group/bridge-react';

function DevPanel() {
  return (
    <div>
      <h2>Development Panel</h2>
      <TokenStatus />
    </div>
  );
}
```

The `TokenStatus` component shows:
- Token expiry time
- Last renewal timestamp
- Current renewal status
- Manual refresh button

### Logout

Log out the current user:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function LogoutButton() {
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
    // Optionally redirect after logout
    window.location.href = '/';
  };
  
  return (
    <button onClick={handleLogout}>
      Sign Out
    </button>
  );
}
```

With confirmation:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function LogoutButton() {
  const { logout } = useAuth();
  
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      window.location.href = '/';
    }
  };
  
  return (
    <button onClick={handleLogout}>
      Sign Out
    </button>
  );
}
```

---

## Feature Flags

### Basic Feature Flag Usage

Conditionally render content based on feature flags:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

function MyComponent() {
  return (
    <div>
      <h1>My App</h1>
      
      <FeatureFlag flagName="new-feature">
        <NewFeatureComponent />
      </FeatureFlag>
      
      <FeatureFlag 
        flagName="premium-feature"
        fallback={<div>Upgrade to premium to access this feature</div>}
      >
        <PremiumFeatureComponent />
      </FeatureFlag>
    </div>
  );
}
```

### Live vs Cached Feature Flags

#### Cached (Recommended):

Uses 5-minute cache for better performance:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

function CachedExample() {
  return (
    <FeatureFlag flagName="demo-flag">
      <p>This uses cached feature flag values (5-minute cache)</p>
    </FeatureFlag>
  );
}
```

#### Live Updates:

Checks the flag in real-time, bypassing cache:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

function LiveExample() {
  return (
    <FeatureFlag 
      flagName="demo-flag"
      forceLive={true}
    >
      <p>This checks the feature flag live (no cache)</p>
    </FeatureFlag>
  );
}
```

### Programmatic Flag Checking

Use the hook for programmatic flag checking:

```tsx
import { useFeatureFlag } from '@nebulr-group/bridge-react';

function MyComponent() {
  const isPremiumEnabled = useFeatureFlag('premium-features');
  const isBetaEnabled = useFeatureFlag('beta-features');
  
  return (
    <div>
      {isPremiumEnabled && <PremiumBanner />}
      {isBetaEnabled && <BetaBadge />}
      
      <div className={isPremiumEnabled ? 'premium-layout' : 'standard-layout'}>
        {/* Content */}
      </div>
    </div>
  );
}
```

### Conditional Rendering

Multiple ways to conditionally render based on flags:

#### Using `negate` Prop:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

function ConditionalContent() {
  return (
    <div>
      {/* Show when flag is enabled */}
      <FeatureFlag flagName="new-ui">
        <NewUI />
      </FeatureFlag>
      
      {/* Show when flag is disabled */}
      <FeatureFlag flagName="new-ui" negate>
        <LegacyUI />
      </FeatureFlag>
    </div>
  );
}
```

#### Using `fallback` Prop:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

function ConditionalContent() {
  return (
    <FeatureFlag 
      flagName="new-ui"
      fallback={<LegacyUI />}
    >
      <NewUI />
    </FeatureFlag>
  );
}
```

#### Using Hook with Ternary:

```tsx
import { useFeatureFlag } from '@nebulr-group/bridge-react';

function ConditionalContent() {
  const useNewUI = useFeatureFlag('new-ui');
  
  return (
    <div>
      {useNewUI ? <NewUI /> : <LegacyUI />}
    </div>
  );
}
```

### Bulk Flag Access

Access all feature flags at once:

```tsx
import { useFeatureFlagsContext } from '@nebulr-group/bridge-react';

function FeatureFlagsPanel() {
  const { flags, refreshFlags } = useFeatureFlagsContext();
  
  return (
    <div>
      <h2>Feature Flags Status</h2>
      <button onClick={refreshFlags}>Refresh All Flags</button>
      
      <ul>
        {Object.entries(flags).map(([key, enabled]) => (
          <li key={key}>
            <strong>{key}:</strong> {enabled ? '✅ Enabled' : '❌ Disabled'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Team Management

### Embedded Team Portal

Embed the team management portal in your app:

```tsx
import { Team } from '@nebulr-group/bridge-react';

function TeamPage() {
  return (
    <div style={{ height: '100vh' }}>
      <h1>Team Management</h1>
      <Team />
    </div>
  );
}
```

With custom styling:

```tsx
import { Team } from '@nebulr-group/bridge-react';

function TeamPage() {
  return (
    <div className="team-container">
      <header>
        <h1>Manage Your Team</h1>
        <p>Invite members, assign roles, and manage permissions</p>
      </header>
      
      <div style={{ height: '80vh' }}>
        <Team className="team-iframe" />
      </div>
    </div>
  );
}
```

### Getting Team Management URL

Get the team management URL programmatically:

```tsx
import { useTeamManagement } from '@nebulr-group/bridge-react';

function TeamButton() {
  const { getTeamManagementUrl, isLoading, error } = useTeamManagement();
  
  const handleClick = async () => {
    try {
      const url = await getTeamManagementUrl();
      console.log('Team management URL:', url);
    } catch (err) {
      console.error('Failed to get team URL:', err);
    }
  };
  
  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Get Team URL'}
    </button>
  );
}
```

### Opening in New Window

Open team management in a new window:

```tsx
import { useTeamManagement } from '@nebulr-group/bridge-react';

function TeamButton() {
  const { launchTeamManagement, isLoading } = useTeamManagement();
  
  const handleClick = async () => {
    try {
      await launchTeamManagement();
    } catch (err) {
      console.error('Failed to launch team management:', err);
    }
  };
  
  return (
    <button onClick={handleClick} disabled={isLoading}>
      Open Team Management
    </button>
  );
}
```

---

## Subscription Management

Redirect users to subscription/plan selection:

```tsx
import { Subscription } from '@nebulr-group/bridge-react';

function UpgradePage() {
  return <Subscription />;
}
```

Or handle it manually:

```tsx
import { useEffect } from 'react';
import { useTeamManagement, useAuth } from '@nebulr-group/bridge-react';

function UpgradePage() {
  const { getSubscriptionUrl } = useTeamManagement();
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated) {
      getSubscriptionUrl().then(url => {
        window.location.href = url;
      });
    }
  }, [isAuthenticated, getSubscriptionUrl]);
  
  return <div>Redirecting to subscription selection...</div>;
}
```

Or use the `usePlanService` hook for a simple redirect to plan selection (handover protocol):

```tsx
import { usePlanService } from '@nebulr-group/bridge-react';

function ManagePlanButton() {
  const { redirectToPlanSelection } = usePlanService();

  const handleClick = async () => {
    try {
      await redirectToPlanSelection();
    } catch (error) {
      console.error('Failed to redirect:', error);
    }
  };

  return <button onClick={handleClick}>Manage plan</button>;
}
```

You can also call `planService.redirectToPlanSelection(config, accessToken)` directly when you have config and token available.

---

## Configuration

### Environment Variables

Configure bridge using environment variables:

#### Create React App:

```env
# Required
REACT_APP_BRIDGE_APP_ID=your-app-id-here

# Optional
REACT_APP_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev/auth
REACT_APP_BRIDGE_CALLBACK_URL=/auth/oauth-callback
REACT_APP_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
REACT_APP_BRIDGE_LOGIN_ROUTE=/login
REACT_APP_BRIDGE_TEAM_MANAGEMENT_URL=https://api.thebridge.dev/cloud-views/user-management-portal/users
REACT_APP_BRIDGE_DEBUG=false
```

#### Vite:

```env
# Required
VITE_BRIDGE_APP_ID=your-app-id-here

# Optional
VITE_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev/auth
VITE_BRIDGE_CALLBACK_URL=/auth/oauth-callback
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
VITE_BRIDGE_LOGIN_ROUTE=/login
VITE_BRIDGE_TEAM_MANAGEMENT_URL=https://api.thebridge.dev/cloud-views/user-management-portal/users
VITE_BRIDGE_DEBUG=false
```

### Provider Configuration

Configure bridge via props (environment variables take priority):

```tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';

function Root() {
  return (
    <BridgeProvider
      appId="your-app-id"
      authBaseUrl="https://api.thebridge.dev/auth"
      defaultRedirectRoute="/dashboard"
      loginRoute="/signin"
      debug={true}
    >
      <App />
    </BridgeProvider>
  );
}
```

Or with a config object:

```tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';

const bridgeConfig = {
  appId: 'your-app-id',
  authBaseUrl: 'https://api.thebridge.dev/auth',
  callbackUrl: '/auth/callback',
  defaultRedirectRoute: '/dashboard',
  loginRoute: '/signin',
  teamManagementUrl: 'https://api.thebridge.dev/cloud-views/user-management-portal/users',
  debug: process.env.NODE_ENV === 'development'
};

function Root() {
  return (
    <BridgeProvider config={bridgeConfig}>
      <App />
    </BridgeProvider>
  );
}
```

### Getting Config Values

Access configuration values in your app:

```tsx
import { useBridgeConfig } from '@nebulr-group/bridge-react';

function ConfigDisplay() {
  const config = useBridgeConfig();
  
  return (
    <div>
      <h2>bridge Configuration</h2>
      <dl>
        <dt>App ID:</dt>
        <dd>{config.appId}</dd>
        
        <dt>Auth Base URL:</dt>
        <dd>{config.authBaseUrl}</dd>
        
        <dt>Callback URL:</dt>
        <dd>{config.callbackUrl}</dd>
        
        <dt>Debug Mode:</dt>
        <dd>{config.debug ? 'Enabled' : 'Disabled'}</dd>
      </dl>
    </div>
  );
}
```

---

## Advanced Usage

### Token Status Monitoring

Monitor token status for debugging:

```tsx
import { TokenStatus } from '@nebulr-group/bridge-react';

function DevTools() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="dev-panel">
      <h3>Development Tools</h3>
      <TokenStatus />
    </div>
  );
}
```

### Custom Error Handling

Handle authentication errors:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';
import { useEffect, useState } from 'react';

function App() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  
  useEffect(() => {
    if (error) {
      setAuthError(error);
      // Log to error tracking service
      console.error('Authentication error:', error);
    }
  }, [error]);
  
  if (authError) {
    return (
      <div className="error-page">
        <h1>Authentication Error</h1>
        <p>{authError}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }
  
  return <YourApp />;
}
```

### State Management Integration

Integrate with Redux or other state management:

#### With Redux:

```tsx
// authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { isAuthenticated: false, user: null } as AuthState,
  reducers: {
    setAuthenticated(state, action: PayloadAction<boolean>) {
      state.isAuthenticated = action.payload;
    },
    setUser(state, action: PayloadAction<any>) {
      state.user = action.payload;
    },
  },
});

export const { setAuthenticated, setUser } = authSlice.actions;
export default authSlice.reducer;

// AuthSync.tsx
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth, useProfile } from '@nebulr-group/bridge-react';
import { setAuthenticated, setUser } from './authSlice';

export function AuthSync() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  
  useEffect(() => {
    dispatch(setAuthenticated(isAuthenticated));
  }, [isAuthenticated, dispatch]);
  
  useEffect(() => {
    if (profile) {
      dispatch(setUser(profile));
    }
  }, [profile, dispatch]);
  
  return null;
}
```

---

## Summary

This guide covers all major features of bridge-react:

✅ Router integration (any router or no router)  
✅ Authentication (login, logout, callbacks, protection)  
✅ Feature flags (cached, live, conditional)  
✅ Team management (embedded, new window)  
✅ User profiles  
✅ Subscription management  
✅ Configuration (env vars, props)  
✅ Advanced usage (monitoring, error handling)

For more examples, check out the [demo application](../../demo/).

