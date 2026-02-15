import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';
import { BridgeConfig } from '../types/config';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  setTokens: (tokens: TokenSet) => void;
  clearTokens: () => void;
  isAuthenticated: () => boolean;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  getIdToken: () => string | null;
}

// Create a Zustand store for client-side token management with localStorage persistence
export const useTokenStore = create<TokenState>((set, get) => ({
  accessToken: typeof window !== 'undefined' ? localStorage.getItem('bridge_access_token') : null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem('bridge_refresh_token') : null,
  idToken: typeof window !== 'undefined' ? localStorage.getItem('bridge_id_token') : null,
  
  setTokens: (tokens: TokenSet) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bridge_access_token', tokens.accessToken);
      localStorage.setItem('bridge_refresh_token', tokens.refreshToken);
      localStorage.setItem('bridge_id_token', tokens.idToken);
    }
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken
    });
  },
  
  clearTokens: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bridge_access_token');
      localStorage.removeItem('bridge_refresh_token');
      localStorage.removeItem('bridge_id_token');
    }
    set({
      accessToken: null,
      refreshToken: null,
      idToken: null
    });
  },
  
  isAuthenticated: () => {
    const accessToken = get().accessToken;
    if (!accessToken) return false;
    
    try {
      const decoded = jwtDecode(accessToken);
      const expiryTime = (decoded as any).exp * 1000; // Convert to milliseconds
      return Date.now() < expiryTime;
    } catch {
      return false;
    }
  },
  
  getAccessToken: () => get().accessToken,
  getRefreshToken: () => get().refreshToken,
  getIdToken: () => get().idToken
}));

// Token service class for more complex operations
export class TokenService {
  private static instance: TokenService;
  private config: BridgeConfig | null = null;
  private refreshCheckInterval: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing = false;
  private lastRenewalTime: Date | null = null;
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

  private constructor() {}
  
  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  // Helper method to validate a token
  private isValidToken(token: string): boolean {
    try {
      const decoded = jwtDecode(token);
      const expiryTime = (decoded as any).exp * 1000; // Convert to milliseconds
      const isValid = Date.now() < expiryTime;
      return isValid;
    } catch (error) {
      return false;
    }
  }
  
  // Client-side methods
  setTokens(tokens: TokenSet): void {
    useTokenStore.getState().setTokens(tokens);
  }
  
  clearTokens(): void {
    useTokenStore.getState().clearTokens();
  }
  
  async isAuthenticated(): Promise<boolean> {
    return useTokenStore.getState().isAuthenticated();
  }
  
  getAccessToken(): string | null {
    return useTokenStore.getState().getAccessToken();
  }
  
  getIdToken(): string | null {
    return useTokenStore.getState().getIdToken();
  }
  
  getRefreshToken(): string | null {
    return useTokenStore.getState().getRefreshToken();
  }
  
  // Common methods
  init(config: BridgeConfig): void {
    this.config = config;
    this._startTokenExpiryCheck();
  }
  
  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      return false;
    }
    
    try {
      this.isRefreshing = true;
      
      // Get refresh token from store
      const refreshToken = useTokenStore.getState().getRefreshToken();
      
      if (!refreshToken) {
        return false;
      }
      
      // Refresh using direct call to auth endpoint to avoid circular dependency
      if (!this.config) {
        throw new Error('TokenService not initialized - call init() first');
      }
      const authBaseUrl = this.config.authBaseUrl || 'https://api.thebridge.dev/auth';
      const url = `${authBaseUrl}/token`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.config.appId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token
      } as TokenSet;
      if (!tokens) {
        return false;
      }
      
      // Store the new tokens
      this.setTokens(tokens);
      this.lastRenewalTime = new Date();
      
      return true;
    } catch (error) {
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }
  
  getTokenExpiryTime(token: string): number | null {
    try {
      const decoded = jwtDecode(token);
      return (decoded as any).exp * 1000;
    } catch {
      return null;
    }
  }
  
  formatTimeUntilExpiry(timeUntilExpiry: number): string {
    const minutes = Math.floor(timeUntilExpiry / 60000);
    const seconds = Math.floor((timeUntilExpiry % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  
  private getNextCheckInterval(timeUntilExpiry: number): number {
    // Check 5 minutes before expiry, or half the time until expiry if it's less than 10 minutes
    return Math.min(timeUntilExpiry - this.REFRESH_THRESHOLD, timeUntilExpiry / 2);
  }
  
  startTokenExpiryCheck() {
    this._startTokenExpiryCheck();
  }
  
  stopTokenExpiryCheck() {
    this._stopTokenExpiryCheck();
  }
  
  private _startTokenExpiryCheck() {
    this._stopTokenExpiryCheck();

    const token = this.getAccessToken();
    
    if (!token) {
      return;
    }

    const expiryTime = this.getTokenExpiryTime(token);
    
    if (!expiryTime) {
      return;
    }

    const timeUntilExpiry = expiryTime - Date.now();
    
    if (timeUntilExpiry <= 0) {
      return;
    }

    const nextCheckInterval = this.getNextCheckInterval(timeUntilExpiry);
    
    this.refreshCheckInterval = setTimeout(async () => {
      const success = await this.refreshToken();
      
      if (success) {
        this._startTokenExpiryCheck(); // Restart the check with the new token
      } else {
        this.clearTokens();
      }
    }, nextCheckInterval);
  }
  
  private _stopTokenExpiryCheck() {
    if (this.refreshCheckInterval) {
      clearTimeout(this.refreshCheckInterval);
      this.refreshCheckInterval = null;
    }
  }
  
  /**
   * Check if an access token is available
   */
  hasAccessToken(): boolean {
    return !!this.getAccessToken();
  }
  
  /**
   * Check if the access token is expired
   */
  async isAccessTokenExpired(): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) return true;
    
    try {
      const decoded = jwtDecode(token);
      const expiryTime = (decoded as any).exp * 1000;
      return Date.now() >= expiryTime;
    } catch {
      return true;
    }
  }

  // Convenience methods
  hasValidAccessToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    
    try {
      const decoded = jwtDecode(token);
      const expiryTime = (decoded as any).exp * 1000;
      return Date.now() < expiryTime;
    } catch {
      return false;
    }
  }
}

