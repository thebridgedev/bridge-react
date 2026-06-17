import { jwtDecode } from 'jwt-decode';
import { FC, useEffect, useState } from 'react';
import { getBridgeAuth } from '../../core/bridge-instance';
import { useBridgeToken } from '../../hooks/use-bridge-token';
import { logger } from '../../utils/logger';

export interface TokenStatusProps {
  /**
   * Additional CSS class names
   */
  className?: string;
}

/** Returns the access-token expiry time in ms epoch, or null if undecodable. */
function getTokenExpiryTime(accessToken: string): number | null {
  try {
    const decoded = jwtDecode<{ exp?: number }>(accessToken);
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Component to display token status. Rides the auth-core singleton for token
 * access + refresh (no legacy TokenService).
 *
 * @example
 * import { TokenStatus } from '@nebulr-group/bridge-react';
 *
 * function MyComponent() {
 *   return <TokenStatus />;
 * }
 */
export const TokenStatus: FC<TokenStatusProps> = ({ className }) => {
  const { getAccessToken } = useBridgeToken();
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [tokenExpiresIn, setTokenExpiresIn] = useState<number | null>(null);
  const [lastRenewal, setLastRenewal] = useState<number | null>(null);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

  useEffect(() => {
    const updateExpiry = () => {
      const accessToken = getAccessToken();
      if (accessToken) {
        setHasToken(true);
        const expiryTime = getTokenExpiryTime(accessToken);
        if (expiryTime) {
          const timeUntilExpiry = expiryTime - Date.now();
          setTokenExpiresIn(Math.floor(timeUntilExpiry / 1000));
        }
      } else {
        setHasToken(false);
        setTokenExpiresIn(null);
      }
    };

    updateExpiry();
    const interval = setInterval(updateExpiry, 1000);
    return () => clearInterval(interval);
  }, [getAccessToken]);

  // Function to refresh token via the auth-core singleton.
  const refreshToken = async () => {
    if (isRenewing) return;

    setIsRenewing(true);
    try {
      const tokens = await getBridgeAuth().refreshTokens();
      if (tokens) {
        setLastRenewal(Date.now());
      }
    } catch (error) {
      logger.error('[TokenStatus] Error refreshing token:', error);
    } finally {
      setIsRenewing(false);
    }
  };

  // Format the time until expiry
  const formatExpiryTime = (seconds: number | null): string => {
    if (seconds === null) return 'No token';

    if (seconds < 0) return 'Expired';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${remainingSeconds}s`;
  };

  // Format the last renewal time
  const formatLastRenewal = (): string => {
    if (!lastRenewal) return 'No renewals yet';

    const date = new Date(lastRenewal);
    return date.toLocaleTimeString();
  };

  return (
    <div className={`bridge-token-status ${className || ''}`}>
      <h3>Token Status</h3>
      <div className="bridge-token-status-content">
        <p>
          <strong>Token expires in:</strong> {formatExpiryTime(tokenExpiresIn)}
        </p>
        <p>
          <strong>Last renewal:</strong> {formatLastRenewal()}
        </p>
        <p>
          <strong>Status:</strong>{' '}
          <span className={`bridge-renewal-status ${isRenewing ? 'bridge-renewing' : ''}`}>
            {isRenewing ? 'Renewing...' : 'Idle'}
          </span>
        </p>
        {hasToken && (
          <button
            className="bridge-refresh-button"
            onClick={refreshToken}
            disabled={isRenewing}
          >
            Refresh Token
          </button>
        )}
      </div>
    </div>
  );
};
