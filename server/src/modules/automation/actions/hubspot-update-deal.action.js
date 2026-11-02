const hubspotSyncService = require('../../integrations/hubspot/hubspot.sync.service');
const actionValidator = require('../action-validator.service');
const Deal = require('../../../models/Deal');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

/**
 * Execute HubSpot Deal Update (Stage, Amount, Close Date)
 */
const executeHubspotUpdateDeal = async ({ organizationId, action }) => {
  const { proposedPayload, originalPayload, dealId } = action;

  // 1. Freshness check
  if (dealId) {
    const freshness = await actionValidator.checkDealFreshness({
      organizationId,
      dealId,
      originalPayload,
    });

    if (!freshness.fresh) {
      throw new AppError(
        `Execution aborted due to stale record state: ${freshness.reason}`,
        409,
        'STALE_DATA_CONFLICT'
      );
    }
  }

  // 2. Retrieve valid access token
  const accessToken = await hubspotSyncService.getValidAccessToken(organizationId);
  const targetDealId = proposedPayload.dealId || action.targetRecordId;

  if (!targetDealId) {
    throw new AppError('Target HubSpot deal ID is missing', 400, 'TARGET_ID_MISSING');
  }

  // 3. Prepare HubSpot Properties payload
  const properties = {};
  if (proposedPayload.amount !== undefined) {
    properties.amount = String(proposedPayload.amount);
  }
  if (proposedPayload.stage) {
    properties.dealstage = proposedPayload.stage;
  }
  if (proposedPayload.closeDate) {
    properties.closedate = new Date(proposedPayload.closeDate).toISOString();
  }

  logger.info(`[HubSpot Action] Updating deal ${targetDealId} with properties: ${JSON.stringify(properties)}`);

  // 4. Call HubSpot API v3 PATCH
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${targetDealId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error(`HubSpot update deal failed (${res.status}): ${errText}`);
    throw new AppError(`HubSpot API error: ${errText}`, res.status, 'HUBSPOT_API_ERROR');
  }

  const data = await res.json();

  // 5. Update local deal record to mirror verified CRM state
  if (dealId) {
    const localUpdates = { lastActivityDate: new Date() };
    if (proposedPayload.amount !== undefined) localUpdates.amount = Number(proposedPayload.amount);
    if (proposedPayload.stage) localUpdates.stage = proposedPayload.stage;
    if (proposedPayload.closeDate) localUpdates.closeDate = new Date(proposedPayload.closeDate);

    await Deal.findOneAndUpdate({ _id: dealId, organizationId }, localUpdates);
  }

  return {
    externalRecordId: data.id,
    externalRecordUrl: `https://app.hubspot.com/deal/${data.id}`,
    responseMetadata: data,
  };
};

module.exports = executeHubspotUpdateDeal;
