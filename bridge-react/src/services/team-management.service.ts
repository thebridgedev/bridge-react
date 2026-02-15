import { logger } from '../utils/logger';
import { BridgeConfig } from '../types/config';
import { TokenService } from './token.service';

/**
 * Service for managing team-related functionality
 */
export class TeamManagementService {
  private static instance: TeamManagementService;
  private config: BridgeConfig | null = null;
  private tokenService: TokenService | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of the TeamManagementService
   */
  public static getInstance(): TeamManagementService {
    if (!TeamManagementService.instance) {
      TeamManagementService.instance = new TeamManagementService();
    }
    return TeamManagementService.instance;
  }

  /**
   * Initialize the service with the required dependencies
   */
  public init(config: BridgeConfig, tokenService: TokenService): void {
    this.config = config;
    this.tokenService = tokenService;
  }

  /**
   * Check if a token is available for team management
   */
  public hasToken(): boolean {
    if (!this.tokenService) {
      return false;
    }

    return this.tokenService.hasAccessToken();
  }

  /**
   * Launch the team management UI in a new window
   */
  public async launchTeamManagement(): Promise<void> {
    const url = await this.getTeamManagementUrl();
    window.open(url, '_blank');
  }

  /**
   * Get a handover code from the auth service
   * @private
   */
  private async getHandoverCode(): Promise<string> {
    if (!this.config || !this.tokenService) {
      throw new Error('TeamManagementService not initialized');
    }

    const accessToken = this.tokenService.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const authBaseUrl = this.config.authBaseUrl || 'https://api.thebridge.dev/auth';
    const appId = this.config.appId;

    if (!appId) {
      throw new Error('appId is required');
    }

    const redirectUri =
      this.config.callbackUrl ||
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/oauth-callback` : '');

    const response = await fetch(`${authBaseUrl}/handover/code/${appId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        ...(redirectUri && { redirectUri }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to get handover code: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to get handover code: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.code) {
      logger.error('No handover code in response:', data);
      throw new Error('Failed to get handover code: No code in response');
    }

    return data.code;
  }

  /**
   * Get the team management URL (if you want to embed it in an iframe)
   */
  public async getTeamManagementUrl(): Promise<string> {
    if (!this.config || !this.tokenService) {
      throw new Error('TeamManagementService not initialized');
    }

    // Check if token is available
    if (!this.hasToken()) {
      logger.error('No access token available for team management');
      throw new Error('User must be authenticated to access team management');
    }

    try {
      logger.debug('Config structure:', JSON.stringify(this.config, null, 2));

      // Get handover code from bridge
      const code = await this.getHandoverCode();

      // Create the team management URL with the handover code
      const baseUrl = this.config.teamManagementUrl;
      const url = `${baseUrl}?code=${code}`;

      logger.debug('Team management URL created successfully', url);
      return url;
    } catch (error) {
      logger.error('Failed to get team management URL:', error);
      throw new Error('Failed to initialize team management: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get the subscription/plan selection URL
   * 
   * This URL redirects the user to the plan selection page where they can
   * choose or change their subscription plan.
   * 
   * @returns Promise<string> The subscription URL
   * @throws Error if not authenticated or if the request fails
   * 
   * @example
   * ```typescript
   * const service = TeamManagementService.getInstance();
   * const url = await service.getSubscriptionUrl();
   * window.location.href = url; // Redirect to subscription page
   * ```
   */
  public async getSubscriptionUrl(): Promise<string> {
    if (!this.config || !this.tokenService) {
      throw new Error('TeamManagementService not initialized');
    }

    // Check if token is available
    if (!this.hasToken()) {
      logger.error('No access token available for subscription');
      throw new Error('User must be authenticated to access subscription');
    }

    try {
      // Get handover code from bridge
      const code = await this.getHandoverCode();

      // Create the subscription URL with the handover code (cloud-views subscription portal)
      const cloudViewsUrl = this.config.cloudViewsUrl || 'https://api.thebridge.dev/cloud-views';
      const baseUrl = `${cloudViewsUrl}/subscription-portal/selectPlan`;
      const url = `${baseUrl}?code=${code}`;

      logger.debug('Subscription URL created successfully', url);
      return url;
    } catch (error) {
      logger.error('Failed to get subscription URL:', error);
      throw new Error('Failed to initialize subscription: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

