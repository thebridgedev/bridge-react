# Bridge React Quickstart Guide

Get started with bridge authentication, feature flags, and team management in your React application.

---

## Step 1: Installation

Install the bridge React plugin:

```bash
npm install @nebulr-group/bridge-react
```

---

## Step 2: Configure Environment Variables

Create a `.env` file in your project root and add your bridge app ID:

### For Create React App:
```env
REACT_APP_BRIDGE_APP_ID=your-app-id-here
```

### For Vite:
```env
VITE_BRIDGE_APP_ID=your-app-id-here
```

> **Note:** You can find your app ID in the bridge Control Center by navigating to the 'Keys' section.

---

## Step 3: Add BridgeProvider

Wrap your application with the `BridgeProvider`. It will automatically read configuration from your environment variables:

### For Create React App:

```tsx
// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BridgeProvider>
      <App />
    </BridgeProvider>
  </React.StrictMode>
);
```

### For Vite:

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BridgeProvider>
      <App />
    </BridgeProvider>
  </React.StrictMode>
);
```

---

## Step 4: Set Up OAuth Callback Route

Create a callback route to handle OAuth responses. The route path should be `/auth/oauth-callback`:

### Without a Router (Using window.location):

```tsx
// src/App.tsx
import { useEffect } from 'react';
import { useAuth } from '@nebulr-group/bridge-react';

function App() {
  const { handleCallback } = useAuth();
  
  useEffect(() => {
    // Check if we're on the callback route
    if (window.location.pathname === '/auth/oauth-callback') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      if (code) {
        handleCallback(code).then(() => {
          // Redirect to home after successful authentication
          window.location.href = '/';
        });
      }
    }
  }, [handleCallback]);

  return (
    <div className="App">
      {/* Your app content */}
    </div>
  );
}
```

### With React Router:

```tsx
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
      handleCallback(code).then(() => {
        navigate('/');
      }).catch((error) => {
        console.error('Authentication failed:', error);
        navigate('/login');
      });
    }
  }, [searchParams, handleCallback, navigate]);
  
  return <div>Authenticating...</div>;
}

// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CallbackPage from './pages/CallbackPage';
import HomePage from './pages/HomePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/oauth-callback" element={<CallbackPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Step 5: Configure Router Adapter (Optional)

If you're using a router library, configure the router adapter so bridge can navigate properly:

### With React Router:

```tsx
// src/index.tsx or src/main.tsx
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { BridgeProvider, setRouterAdapter } from '@nebulr-group/bridge-react';
import App from './App';

function RouterSetup({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
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
```

> **Note:** If you don't set a router adapter, bridge will use `window.location` by default, which works fine for simple apps.

---

## Step 6: Configure OAuth Callback URL in Bridge Control Center

Configure your OAuth callback URL in the bridge Control Center:

1. Go to the [bridge Control Center](https://admin.nblocks.cloud)
2. Navigate to: **Authentication → Authentication → Security**
3. Set the callback URL to match your application:
   - **Production**: `https://your-app.com/auth/oauth-callback`
   - **Local Development**: `http://localhost:3000/auth/oauth-callback`

---

## Step 7: Add Login and Protection

Add login functionality and protect your routes:

```tsx
// src/App.tsx
import { useAuth, ProtectedRoute } from '@nebulr-group/bridge-react';

function LoginPage() {
  const { login } = useAuth();
  
  return (
    <div>
      <h1>Welcome</h1>
      <button onClick={() => login()}>Sign In</button>
    </div>
  );
}

function Dashboard() {
  const { logout, isAuthenticated } = useAuth();
  
  return (
    <div>
      <h1>Dashboard</h1>
      <p>You are logged in!</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="App">
      {isAuthenticated ? (
        <ProtectedRoute redirectTo="/login">
          <Dashboard />
        </ProtectedRoute>
      ) : (
        <LoginPage />
      )}
    </div>
  );
}

export default App;
```

---

## That's it!

You have now set up a complete authentication flow with bridge in your React application!

There is a lot more the bridge-react plugin can do. See [examples](../examples/examples.md) for:
- Advanced route protection
- Feature flags
- Team management
- User profiles
- Custom router integration
- And much more!

---

## Quick Reference

### Required Environment Variables

| Build Tool | Variable Name | Description |
|------------|---------------|-------------|
| Create React App | `REACT_APP_BRIDGE_APP_ID` | Your bridge app ID |
| Vite | `VITE_BRIDGE_APP_ID` | Your bridge app ID |

### Optional Environment Variables

| Build Tool | Variable Name | Default | Description |
|------------|---------------|---------|-------------|
| CRA | `REACT_APP_BRIDGE_AUTH_BASE_URL` | `https://auth.nblocks.cloud` | Auth server URL |
| Vite | `VITE_BRIDGE_AUTH_BASE_URL` | `https://auth.nblocks.cloud` | Auth server URL |
| CRA | `REACT_APP_BRIDGE_DEBUG` | `false` | Enable debug logging |
| Vite | `VITE_BRIDGE_DEBUG` | `false` | Enable debug logging |

### Key Components

- `<BridgeProvider>` - Wrap your app
- `<ProtectedRoute>` - Protect routes from unauthenticated access
- `<Login>` - Pre-built login button
- `<FeatureFlag>` - Conditional rendering based on flags
- `<Team>` - Team management portal

### Key Hooks

- `useAuth()` - Authentication state and methods
- `useFeatureFlag(name)` - Check feature flags
- `useProfile()` - User profile data
- `useTeamManagement()` - Team management functions

---

## Next Steps

- 📖 Read the [full examples guide](../examples/examples.md)
- 🎨 Check out the [demo application](../../example-app/)
- 🔧 Learn about [router integration](../examples/examples.md#router-integration)
- 🚦 Explore [feature flags](../examples/examples.md#feature-flags)
- 👥 Set up [team management](../examples/examples.md#team-management)

