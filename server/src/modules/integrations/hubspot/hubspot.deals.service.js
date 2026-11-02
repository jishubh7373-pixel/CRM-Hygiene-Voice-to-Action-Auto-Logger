const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class HubSpotDealsService {
  /**
   * Fetch deals from HubSpot API v3
   */
  async getDeals({
    accessToken,
    limit = 50,
    after = undefined,
    properties = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate', 'hubspot_owner_id'],
  }) {
    if (!accessToken) {
      throw new AppError('HubSpot access token is missing', 401, 'HUBSPOT_UNAUTHORIZED');
    }

    const params = new URLSearchParams({
      limit: String(limit),
      properties: properties.join(','),
    });

    if (after) {
      params.set('after', after);
    }

    const url = `https://api.hubapi.com/crm/v3/objects/deals?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`HubSpot getDeals failed (${res.status}): ${errText}`);
      throw new AppError(`HubSpot API error: ${res.statusText}`, res.status, 'HUBSPOT_API_ERROR');
    }

    return res.json();
  }

  /**
   * Fetch deal pipelines and their stages
   */
  async getPipelines(accessToken) {
    if (!accessToken) {
      throw new AppError('HubSpot access token is missing', 401, 'HUBSPOT_UNAUTHORIZED');
    }

    const res = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`HubSpot getPipelines failed (${res.status}): ${errText}`);
      throw new AppError(`HubSpot API error: ${res.statusText}`, res.status, 'HUBSPOT_API_ERROR');
    }

    return res.json();
  }

  /**
   * Fetch all HubSpot deal properties for custom field mapping
   */
  async getProperties(accessToken) {
    if (!accessToken) {
      throw new AppError('HubSpot access token is missing', 401, 'HUBSPOT_UNAUTHORIZED');
    }

    const res = await fetch('https://api.hubapi.com/crm/v3/properties/deals', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new AppError(`HubSpot API error: ${res.statusText}`, res.status, 'HUBSPOT_API_ERROR');
    }

    return res.json();
  }
}

module.exports = new HubSpotDealsService();
