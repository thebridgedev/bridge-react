import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useBridgeConfig } from '../hooks/use-bridge-config';
import { TeamManagementService } from '../services/team-management.service';
import { TokenService } from '../services/token.service';

/**
 * Subscription component that redirects users to the plan selection page
 * 
 * This component automatically redirects authenticated users to the subscription/plan
 * selection portal where they can choose or modify their subscription plan.
 * 
 * @example
 * ```tsx
 * import { Route } from 'react-router-dom';
 * import { Subscription } from '@nebulr-group/bridge-react';
 * 
 * <Route path="/subscription" element={<Subscription />} />
 * ```
 * 
 * @example With ProtectedRoute
 * ```tsx
 * import { ProtectedRoute, Subscription } from '@nebulr-group/bridge-react';
 * 
 * <Route path="/subscription" element={
 *   <ProtectedRoute>
 *     <Subscription />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export function Subscription() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const config = useBridgeConfig();
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const redirectToSubscription = async () => {
      // Don't attempt redirect if not authenticated
      if (!isAuthenticated || authLoading) {
        return;
      }

      // Don't redirect if already redirecting
      if (isRedirecting) {
        return;
      }

      setIsRedirecting(true);
      setError(null);

      try {
        // Initialize services
        const teamManagementService = TeamManagementService.getInstance();
        const tokenService = TokenService.getInstance();
        
        teamManagementService.init(config, tokenService);

        // Get subscription URL and redirect
        const url = await teamManagementService.getSubscriptionUrl();
        
        // Use window.location for redirect (external URL)
        window.location.href = url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to redirect to subscription page';
        console.error('Subscription redirect error:', err);
        setError(errorMessage);
        setIsRedirecting(false);
      }
    };

    redirectToSubscription();
  }, [isAuthenticated, authLoading, config, isRedirecting]);

  // Show authentication required message if not authenticated
  if (!isAuthenticated && !authLoading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#721c24',
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '4px',
        margin: '20px'
      }}>
        <h2>Authentication Required</h2>
        <p>You must be logged in to access subscription management.</p>
      </div>
    );
  }

  // Show error message if there's an error
  if (error) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#721c24',
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '4px',
        margin: '20px'
      }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  // Show loading/redirecting state
  return (
    <div style={{
      padding: '20px',
      textAlign: 'center',
      color: '#004085',
      backgroundColor: '#cce5ff',
      border: '1px solid #b8daff',
      borderRadius: '4px',
      margin: '20px'
    }}>
      <p>Loading subscription portal...</p>
    </div>
  );
}

