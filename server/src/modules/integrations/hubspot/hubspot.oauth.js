const config = require('../../../config');
const { generateOAuthState, verifyOAuthState } = require('../../../utils/crypto');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class HubSpotOAuthService {
  /**
   * Generate HubSpot OAuth 2.0 Authorization URL with cryptographically signed state
   */
  getAuthorizationUrl({ organizationId, userId }) {
    const clientId = config.integrations.hubspot.clientId;
    const redirectUri = config.integrations.hubspot.redirectUri;
    const scopes = config.integrations.hubspot.scopes;

    if (!clientId) {
      throw new AppError('HubSpot Client ID is not configured on server', 500, 'HUBSPOT_NOT_CONFIGURED');
    }

    const state = generateOAuthState({
      organizationId,
      userId,
      provider: 'hubspot',
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access & refresh tokens
   */
  async exchangeCodeForTokens(code, state) {
    const verified = verifyOAuthState(state);
    if (!verified || verified.provider !== 'hubspot') {
      throw new AppError('Invalid or expired OAuth state parameter', 400, 'INVALID_OAUTH_STATE');
    }

    const clientId = config.integrations.hubspot.clientId;
    const clientSecret = config.integrations.hubspot.clientSecret;
    const redirectUri = config.integrations.hubspot.redirectUri;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`HubSpot token exchange failed (${res.status}): ${errText}`);
      throw new AppError(`HubSpot OAuth failed: ${res.statusText}`, res.status, 'HUBSPOT_OAUTH_ERROR');
    }

    const data = await res.json();
    return {
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        obtainedAt: Date.now(),
      },
      organizationId: verified.organizationId,
      userId: verified.userId,
    };
  }

  /**
   * Refresh an expired access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    const clientId = config.integrations.hubspot.clientId;
    const clientSecret = config.integrations.hubspot.clientSecret;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`HubSpot token refresh failed (${res.status}): ${errText}`);
      throw new AppError('Failed to refresh HubSpot token', res.status, 'HUBSPOT_REFRESH_ERROR');
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      obtainedAt: Date.now(),
    };
  }

  /**
   * Retrieve HubSpot account/portal details
   */
  async getAccountInfo(accessToken) {
    const res = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`);
    if (!res.ok) {
      throw new AppError('Failed to fetch HubSpot token information', res.status, 'HUBSPOT_TOKEN_INFO_FAILED');
    }
    return res.json();
  }
}

module.exports = new HubSpotOAuthService();
