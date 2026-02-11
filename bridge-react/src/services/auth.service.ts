import { BridgeConfig } from '../types/config';
import { TokenService, TokenSet } from './token.service';

export class AuthService {
  private static instance: AuthService;
  private tokenService: TokenService;
  private config: BridgeConfig | null = null;
  private initialized: boolean = false;
  
  private constructor() {
    this.tokenService = TokenService.getInstance();
  }
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  /**
   * Initialize the service with the required configuration
   */
  init(config: BridgeConfig): void {
    this.config = config;
    this.initialized = true;
  }
  
  /**
   * Creates the bridge login URL
   * @param options Optional redirect URI
   * @returns The complete login URL
   */
  createLoginUrl(options: { redirectUri?: string } = {}): string {
    if (!this.initialized || !this.config) {
      throw new Error('AuthService has not been properly initialized.');
    }
    
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectUri = options.redirectUri || 
      this.config.callbackUrl || 
      `${origin}/auth/oauth-callback`;
    
    const authBaseUrl = this.config.authBaseUrl;
    return `${authBaseUrl}/url/login/${this.config.appId}?cv_env=bridge&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
  
  // Client-side methods
  async login(options: { redirectUri?: string } = {}): Promise<void> {
    if (!this.initialized || !this.config) {
      throw new Error('AuthService has not been properly initialized.');
    }
    
    const loginUrl = this.createLoginUrl(options);
    
    // Always use window.location for OAuth redirect (external URL)
    if (typeof window !== 'undefined') {
      window.location.href = loginUrl;
    }
  }
  
  async handleCallback(code: string): Promise<void> {
    if (!this.initialized || !this.config) {
      throw new Error('AuthService has not been properly initialized.');
    }
    
    if (!code) {
      throw new Error('No authorization code provided');
    }
    
    const tokens = await this.exchangeCode(code);
    this.tokenService.setTokens(tokens);
  }
  
  logout(): void {
    this.tokenService.clearTokens();
  }
  
  async isAuthenticated(): Promise<boolean> {
    if (!this.initialized || !this.config) {
      throw new Error('AuthService has not been properly initialized.');
    }
    
    return await this.tokenService.isAuthenticated();
  }
  
  // Exchange code for tokens
  private async exchangeCode(code: string): Promise<TokenSet> {
    if (!this.initialized || !this.config) {
      throw new Error('AuthService has not been properly initialized.');
    }
    
    const authBaseUrl = this.config.authBaseUrl;
    const url = `${authBaseUrl}/token/code/${this.config.appId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to exchange code for tokens: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token
    };
  }
  
  // Refresh token method
  async refreshToken(refreshToken: string): Promise<TokenSet | null> {
    if (!this.initialized || !this.config) {
      throw new Error('AuthService has not been properly initialized.');
    }
    
    if (!refreshToken) {
      if (this.config.debug) {
        console.log('AuthService - No refresh token provided');
      }
      return null;
    }
    
    try {
      const authBaseUrl = this.config.authBaseUrl || 'https://api.thebridge.dev/auth';
      const url = `${authBaseUrl}/token`;
      
      const startTime = Date.now();
      
      if (this.config.debug) {
        console.log("🔄 AuthService - Refreshing token:", url);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.appId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
      });
      
      if (!response.ok) {
        if (this.config.debug) {
          console.error('AuthService - Failed to refresh token:', await response.text());
        }
        return null;
      }
      
      if (this.config.debug) {
        const endTime = Date.now();
        const refreshTime = endTime - startTime;
        console.log(`⏱️ AuthService - Token refreshing token, took ${refreshTime}ms`);        
      }
      
      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token
      };
    } catch (error) {
      if (this.config.debug) {
        console.error('AuthService - Error refreshing token:', error);
      }
      return null;
    }
  }
}

