const config = require('../../../config');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class GongAuthService {
  /**
   * Get HTTP Basic Auth header value for Gong API v2
   */
  getAuthHeader(accessKey, clientSecret) {
    const key = accessKey || config.integrations.gong.accessKey;
    const secret = clientSecret || config.integrations.gong.clientSecret;

    if (!key || !secret) {
      throw new AppError('Gong access key and client secret are required', 400, 'GONG_CREDENTIALS_MISSING');
    }

    const token = Buffer.from(`${key}:${secret}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Validate credentials against Gong API v2
   */
  async validateCredentials(accessKey, clientSecret, baseUrl = null) {
    const apiBase = baseUrl || config.integrations.gong.baseUrl || 'https://api.gong.io';
    const authHeader = this.getAuthHeader(accessKey, clientSecret);

    const res = await fetch(`${apiBase}/v2/users?limit=1`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Gong credential validation failed (${res.status}): ${errText}`);
      throw new AppError(`Gong credentials rejected: ${res.statusText}`, res.status, 'GONG_AUTH_FAILED');
    }

    const data = await res.json();
    return {
      valid: true,
      data,
    };
  }
}

module.exports = new GongAuthService();
