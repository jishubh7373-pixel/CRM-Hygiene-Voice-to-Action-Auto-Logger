const integrationsService = require('../integrations.service');
const hubspotOAuth = require('./hubspot.oauth');
const hubspotDealsService = require('./hubspot.deals.service');
const Deal = require('../../../models/Deal');
const DealMapping = require('../../../models/DealMapping');
const User = require('../../../models/User');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

// Mapping HubSpot stage IDs to DealFlow AI stage enum
const mapHubSpotStage = (stageName = '') => {
  const s = stageName.toLowerCase();
  if (s.includes('won')) return 'closed_won';
  if (s.includes('lost')) return 'closed_lost';
  if (s.includes('negotiat')) return 'negotiation';
  if (s.includes('proposal') || s.includes('contract')) return 'proposal';
  if (s.includes('demo') || s.includes('presentation')) return 'demo';
  if (s.includes('qualif')) return 'qualification';
  return 'discovery';
};

class HubSpotSyncService {
  /**
   * Ensure fresh access token, auto-refreshing if expired or near expiry
   */
  async getValidAccessToken(organizationId) {
    const creds = await integrationsService.getDecryptedCredentials(organizationId, 'hubspot');
    if (!creds || !creds.tokens || !creds.tokens.accessToken) {
      throw new AppError('HubSpot is not connected or credentials missing', 400, 'HUBSPOT_NOT_CONNECTED');
    }

    const { tokens } = creds;
    const now = Date.now();
    const expiryTime = (tokens.obtainedAt || 0) + (tokens.expiresIn || 1800) * 1000;

    // If within 2 minutes of expiry, refresh token
    if (now > expiryTime - 120000 && tokens.refreshToken) {
      logger.info(`[HubSpot Sync] Access token expired or near expiry for org ${organizationId}. Refreshing token...`);
      try {
        const refreshedTokens = await hubspotOAuth.refreshAccessToken(tokens.refreshToken);
        creds.tokens = refreshedTokens;
        await integrationsService.saveEncryptedCredentials({
          organizationId,
          provider: 'hubspot',
          credentials: creds,
          externalAccountId: creds.portalId || creds.hubId || '',
          externalAccountName: creds.accountName || 'HubSpot Portal',
        });
        return refreshedTokens.accessToken;
      } catch (refreshErr) {
        logger.error(`[HubSpot Sync] Failed to refresh token: ${refreshErr.message}`);
        await integrationsService.recordError(organizationId, 'hubspot', refreshErr);
        throw refreshErr;
      }
    }

    return tokens.accessToken;
  }

  /**
   * Synchronize deals from HubSpot to DealFlow AI
   */
  async syncDeals({ organizationId, userId, mappingConfig = {} }) {
    logger.info(`[HubSpot Sync] Starting deal synchronization for org ${organizationId}...`);

    try {
      const accessToken = await this.getValidAccessToken(organizationId);

      // Find a default deal owner in the organization if needed
      let defaultOwner = userId;
      if (!defaultOwner) {
        const anyUser = await User.findOne({ organizationId });
        defaultOwner = anyUser?._id;
      }

      if (!defaultOwner) {
        throw new AppError('No organization user found to assign synced deals', 400, 'NO_USER_FOUND');
      }

      const response = await hubspotDealsService.getDeals({ accessToken, limit: 100 });
      const hsDeals = response.results || [];

      let createdCount = 0;
      let updatedCount = 0;

      for (const hsDeal of hsDeals) {
        const props = hsDeal.properties || {};
        const dealName = props.dealname || `Deal #${hsDeal.id}`;
        const amount = parseFloat(props.amount) || 0;
        const stage = mapHubSpotStage(props.dealstage || '');
        const closeDate = props.closedate ? new Date(props.closedate) : new Date(Date.now() + 30 * 86400000);

        // Check if mapping exists
        let mapping = await DealMapping.findOne({
          organizationId,
          provider: 'hubspot',
          externalDealId: hsDeal.id,
        });

        if (mapping) {
          // Update existing internal deal
          await Deal.findOneAndUpdate(
            { _id: mapping.internalDealId, organizationId },
            {
              name: dealName,
              amount,
              stage,
              closeDate,
              crmDealId: hsDeal.id,
              crmSource: 'hubspot',
              lastActivityDate: new Date(),
            }
          );

          mapping.lastSyncedAt = new Date();
          mapping.syncStatus = 'synced';
          mapping.rawProperties = props;
          await mapping.save();
          updatedCount++;
        } else {
          // Create new internal deal
          const newDeal = await Deal.create({
            organizationId,
            ownerId: defaultOwner,
            name: dealName,
            accountName: props.pipeline || 'HubSpot Account',
            amount,
            stage,
            probability: stage === 'closed_won' ? 100 : stage === 'closed_lost' ? 0 : 40,
            closeDate,
            crmDealId: hsDeal.id,
            crmSource: 'hubspot',
            hygieneScore: 85,
            hygieneStatus: 'healthy',
          });

          await DealMapping.create({
            organizationId,
            internalDealId: newDeal._id,
            provider: 'hubspot',
            externalDealId: hsDeal.id,
            externalRecordUrl: `https://app.hubspot.com/contacts/${hsDeal.portalId || 'default'}/deal/${hsDeal.id}`,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            syncDirection: 'inbound_only',
            fieldMappingVersion: 1,
            rawProperties: props,
          });

          createdCount++;
        }
      }

      await integrationsService.recordSuccess(organizationId, 'hubspot', {
        lastSyncTotal: hsDeals.length,
        createdCount,
        updatedCount,
      });

      logger.info(`[HubSpot Sync] Finished sync for org ${organizationId}: ${createdCount} created, ${updatedCount} updated.`);

      return {
        success: true,
        totalFound: hsDeals.length,
        createdCount,
        updatedCount,
      };
    } catch (err) {
      await integrationsService.recordError(organizationId, 'hubspot', err);
      throw err;
    }
  }
}

module.exports = new HubSpotSyncService();
