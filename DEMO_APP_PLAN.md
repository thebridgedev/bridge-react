# Bridge React Demo Application Plan

This document outlines the structure and implementation plan for the bridge-react demo application.

---

## Overview

The demo application will showcase all features of bridge-react in a working example using:
- **Vite** (modern, fast build tool)
- **React Router v6** (most popular routing solution)
- **TypeScript** (type safety)
- **Modern CSS** (no dependencies, clean styling)

---

## Project Structure

```
example-app/
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── src/
│   ├── assets/
│   │   └── styles.css            # Global styles
│   ├── components/
│   │   ├── Navbar.tsx            # Navigation bar
│   │   ├── Layout.tsx            # App layout wrapper
│   │   └── FeatureFlagDemo.tsx   # Feature flag examples
│   ├── pages/
│   │   ├── HomePage.tsx          # Public home page
│   │   ├── LoginPage.tsx         # Login page
│   │   ├── CallbackPage.tsx      # OAuth callback handler
│   │   ├── DashboardPage.tsx     # Protected dashboard
│   │   ├── ProfilePage.tsx       # User profile display
│   │   ├── TeamPage.tsx          # Team management
│   │   ├── FeatureFlagsPage.tsx  # Feature flags demo
│   │   └── TokenStatusPage.tsx   # Token monitoring (dev only)
│   ├── router/
│   │   └── RouterSetup.tsx       # React Router adapter setup
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── vite-env.d.ts
├── .env.example                  # Example environment variables
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

---

## Features to Demonstrate

### 1. **Authentication**
- [x] Login with pre-built component
- [x] Custom login button
- [x] OAuth callback handling
- [x] Authentication status display
- [x] Logout functionality
- [x] Protected routes
- [x] Token auto-renewal monitoring

### 2. **User Profile**
- [x] Display user information
- [x] Show organization/tenant data
- [x] Onboarding status
- [x] Multi-tenant access indicator

### 3. **Feature Flags**
- [x] Basic feature flag usage
- [x] Cached vs live flags
- [x] Conditional rendering
- [x] Negate flag usage
- [x] Fallback content
- [x] Programmatic flag checking
- [x] Bulk flag display

### 4. **Team Management**
- [x] Embedded team portal
- [x] Open in new window option

### 5. **Router Integration**
- [x] React Router v6 setup
- [x] Router adapter configuration
- [x] Protected routes
- [x] Public routes

### 6. **Token Management**
- [x] Token status display
- [x] Manual token refresh
- [x] Expiry countdown
- [x] Renewal history

---

## Page Descriptions

### Home Page (Public)
**Route**: `/`  
**Purpose**: Landing page with app overview

**Content**:
- Welcome message
- Feature overview cards
- Login button (if not authenticated)
- Link to dashboard (if authenticated)
- Link to feature flags demo
- Navigation to all sections

### Login Page (Public)
**Route**: `/login`  
**Purpose**: Dedicated login page

**Content**:
- App logo/branding
- Welcome message
- Pre-built Login component
- Custom login button example
- Redirect to dashboard after login

### Callback Page (Public)
**Route**: `/auth/oauth-callback`  
**Purpose**: Handle OAuth callback

**Content**:
- Loading indicator
- "Authenticating..." message
- Error handling and display
- Auto-redirect after success

### Dashboard Page (Protected)
**Route**: `/dashboard`  
**Purpose**: Main protected area

**Content**:
- Welcome message with user name
- Quick stats/cards
- Links to other features
- Feature flag examples
- Logout button

### Profile Page (Protected)
**Route**: `/profile`  
**Purpose**: Display user profile information

**Content**:
- User avatar (placeholder)
- Full name, email, username
- Email verification status
- Onboarding status
- Organization/tenant information
- Multi-tenant access indicator

### Feature Flags Page (Protected)
**Route**: `/feature-flags`  
**Purpose**: Demonstrate feature flag functionality

**Content**:
- Section 1: Cached feature flag examples
- Section 2: Live feature flag examples
- Section 3: Conditional rendering examples
- Section 4: Programmatic flag checking
- Section 5: All flags display with refresh button
- Code examples for each pattern

### Team Management Page (Protected)
**Route**: `/team`  
**Purpose**: Team management portal

**Content**:
- Page header with description
- Embedded team portal (iframe)
- "Open in new window" button
- Instructions for use

### Token Status Page (Dev Only)
**Route**: `/token-status`  
**Purpose**: Monitor token status for development

**Content**:
- TokenStatus component
- Token expiry countdown
- Last renewal time
- Manual refresh button
- Token debugging information

---

## Component Details

### Navbar Component

```tsx
// Shows navigation links
// Adapts based on authentication status
// Displays user greeting when logged in
// Links: Home, Dashboard, Profile, Feature Flags, Team, Logout
```

**Features**:
- Responsive design
- Active route highlighting
- User avatar/name when authenticated
- Logout button
- Mobile-friendly hamburger menu

### Layout Component

```tsx
// Wraps all pages with consistent layout
// Includes Navbar
// Optional sidebar for protected pages
```

### FeatureFlagDemo Component

```tsx
// Reusable component showing feature flag examples
// Used throughout the app to demonstrate flags
```

---

## Styling Approach

### Design System
- Modern, clean aesthetic
- Inspired by bridge-nextjs demo but adapted for React
- Consistent color palette
- Responsive design (mobile-first)

### CSS Variables

```css
:root {
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-background: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #1e293b;
  --color-text-secondary: #64748b;
  --color-border: #e2e8f0;
  
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Component Patterns

**Button Styles**:
- Primary: Filled with primary color
- Secondary: Outlined
- Danger: Red for logout/delete
- Disabled: Grayed out with cursor not-allowed

**Card Styles**:
- White background
- Subtle border
- Box shadow
- Rounded corners
- Padding for content

**Page Layouts**:
- Max-width container (1200px)
- Centered content
- Padding for mobile
- Grid layouts for feature cards

---

## Environment Variables

### `.env.example`

```env
# Required
VITE_BRIDGE_APP_ID=your-app-id-here

# Optional (with defaults)
VITE_BRIDGE_AUTH_BASE_URL=https://auth.nblocks.cloud
VITE_BRIDGE_CALLBACK_URL=/auth/oauth-callback
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
VITE_BRIDGE_LOGIN_ROUTE=/login
VITE_BRIDGE_DEBUG=false
```

### `.env` (Not committed)

```env
VITE_BRIDGE_APP_ID=<actual-app-id>
VITE_BRIDGE_DEBUG=true
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "@nebulr-group/bridge-react": "file:../",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

---

## Router Configuration

### Router Setup

```tsx
// src/router/RouterSetup.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setRouterAdapter } from '@nebulr-group/bridge-react';

export function RouterSetup({ children }: { children: React.ReactNode }) {
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
```

### Routes Definition

```tsx
// src/App.tsx
<Routes>
  {/* Public routes */}
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/auth/oauth-callback" element={<CallbackPage />} />
  
  {/* Protected routes */}
  <Route path="/dashboard" element={
    <ProtectedRoute redirectTo="/login">
      <DashboardPage />
    </ProtectedRoute>
  } />
  
  <Route path="/profile" element={
    <ProtectedRoute redirectTo="/login">
      <ProfilePage />
    </ProtectedRoute>
  } />
  
  <Route path="/feature-flags" element={
    <ProtectedRoute redirectTo="/login">
      <FeatureFlagsPage />
    </ProtectedRoute>
  } />
  
  <Route path="/team" element={
    <ProtectedRoute redirectTo="/login">
      <TeamPage />
    </ProtectedRoute>
  } />
  
  {/* Dev only */}
  {process.env.NODE_ENV === 'development' && (
    <Route path="/token-status" element={
      <ProtectedRoute redirectTo="/login">
        <TokenStatusPage />
      </ProtectedRoute>
    } />
  )}
  
  {/* 404 */}
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

---

## Code Examples in UI

Each feature demo page should include:

1. **Visual demonstration** (working example)
2. **Code snippet** (showing how it's done)
3. **Description** (explaining the feature)

Example pattern:

```tsx
<section className="demo-section">
  <h2>Basic Feature Flag</h2>
  <p>Conditionally render content based on a feature flag</p>
  
  {/* Working demo */}
  <div className="demo-example">
    <FeatureFlag flagName="demo-flag">
      <div className="success-message">
        Feature flag "demo-flag" is enabled!
      </div>
    </FeatureFlag>
  </div>
  
  {/* Code example */}
  <pre className="code-example">
    <code>{`
      <FeatureFlag flagName="demo-flag">
        <div>Feature is enabled!</div>
      </FeatureFlag>
    `}</code>
  </pre>
</section>
```

---

## README for Demo App

The demo app should have its own README explaining:
- How to run the demo locally
- Where to get a bridge app ID
- How to configure environment variables
- What each page demonstrates
- Links to main documentation

---

## Build & Deployment

### Local Development

```bash
cd example-app
npm install
cp .env.example .env
# Edit .env with your VITE_BRIDGE_APP_ID
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

---

## Testing Checklist

Before considering the demo complete, test:

- [ ] Login flow works
- [ ] OAuth callback redirects correctly
- [ ] Protected routes require authentication
- [ ] Public routes accessible without auth
- [ ] Feature flags display correctly
- [ ] Token auto-renewal works
- [ ] Manual token refresh works
- [ ] Profile data loads
- [ ] Team management iframe loads
- [ ] Logout clears session
- [ ] Router navigation works smoothly
- [ ] Mobile responsive design
- [ ] Works in Chrome, Firefox, Safari
- [ ] Environment variables read correctly

---

## Comparison with bridge-nextjs Demo

### Similarities
- Same overall structure (pages, components)
- Same features demonstrated
- Similar styling/design
- Same user flows

### Differences
- **No middleware** (pure client-side)
- **Router adapter** instead of Next.js routing
- **Vite** instead of Next.js
- **Simpler build** process
- **No server components**
- **Different callback handling** (React Router vs Next.js)
- **Environment variables** (VITE_ vs NEXT_PUBLIC_)

---

## Implementation Order

1. **Phase 1: Project Setup**
   - [ ] Create Vite + React + TypeScript project
   - [ ] Install dependencies
   - [ ] Configure tsconfig
   - [ ] Set up router
   - [ ] Create basic layout

2. **Phase 2: Authentication**
   - [ ] Login page
   - [ ] Callback page
   - [ ] Router adapter setup
   - [ ] Protected routes
   - [ ] Logout functionality

3. **Phase 3: Core Pages**
   - [ ] Home page
   - [ ] Dashboard
   - [ ] Profile page
   - [ ] Navbar component

4. **Phase 4: Feature Demos**
   - [ ] Feature flags page
   - [ ] Team management page
   - [ ] Token status page

5. **Phase 5: Styling**
   - [ ] Global styles
   - [ ] Component styles
   - [ ] Responsive design
   - [ ] Polish and refine

6. **Phase 6: Documentation**
   - [ ] README for demo
   - [ ] Code comments
   - [ ] Environment setup guide

---

## Success Criteria

The demo is successful when:

✅ All bridge-react features are demonstrated  
✅ Code is clean and well-commented  
✅ Styling is modern and professional  
✅ Works reliably in all major browsers  
✅ Mobile-responsive  
✅ Easy to set up and run locally  
✅ Serves as good documentation by example  
✅ Showcases best practices  
✅ README is clear and helpful

---

## Notes

- Keep code simple and readable (it's for demonstration)
- Comment liberally to explain what's happening
- Use TypeScript properly (show good practices)
- Make it visually appealing (first impressions matter)
- Ensure it works out-of-the-box with minimal setup
- Include helpful error messages for missing config

---

**End of Demo App Plan**

