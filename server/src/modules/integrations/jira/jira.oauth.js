const config = require('../../../config');
const { generateOAuthState, verifyOAuthState } = require('../../../utils/crypto');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class JiraOAuthService {
  /**
   * Generate Atlassian OAuth 2.0 (3LO) authorization URL with signed state
   */
  getAuthorizationUrl({ organizationId, userId }) {
    const clientId = config.integrations.jira.clientId;
    const redirectUri = config.integrations.jira.redirectUri;
    const scopes = config.integrations.jira.scopes;

    if (!clientId) {
      throw new AppError('Jira Client ID is not configured on server', 500, 'JIRA_NOT_CONFIGURED');
    }

    const state = generateOAuthState({
      organizationId,
      userId,
      provider: 'jira',
    });

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange 3LO code for access token and refresh token
   */
  async exchangeCodeForTokens(code, state) {
    const verified = verifyOAuthState(state);
    if (!verified || verified.provider !== 'jira') {
      throw new AppError('Invalid or expired OAuth state parameter', 400, 'INVALID_OAUTH_STATE');
    }

    const clientId = config.integrations.jira.clientId;
    const clientSecret = config.integrations.jira.clientSecret;
    const redirectUri = config.integrations.jira.redirectUri;

    const res = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Jira token exchange failed (${res.status}): ${errText}`);
      throw new AppError(`Jira OAuth failed: ${res.statusText}`, res.status, 'JIRA_OAUTH_ERROR');
    }

    const data = await res.json();
    return {
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
        obtainedAt: Date.now(),
      },
      organizationId: verified.organizationId,
      userId: verified.userId,
    };
  }

  /**
   * Refresh Atlassian access token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    const clientId = config.integrations.jira.clientId;
    const clientSecret = config.integrations.jira.clientSecret;

    const res = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Jira token refresh failed (${res.status}): ${errText}`);
      throw new AppError('Failed to refresh Jira token', res.status, 'JIRA_REFRESH_ERROR');
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
      obtainedAt: Date.now(),
    };
  }
}

module.exports = new JiraOAuthService();
