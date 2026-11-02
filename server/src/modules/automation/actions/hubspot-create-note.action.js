const hubspotSyncService = require('../../integrations/hubspot/hubspot.sync.service');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

/**
 * Execute HubSpot Meeting Note creation with deal association
 */
const executeHubspotCreateNote = async ({ organizationId, action }) => {
  const { proposedPayload } = action;

  const accessToken = await hubspotSyncService.getValidAccessToken(organizationId);
  const targetDealId = proposedPayload.dealId || action.targetRecordId;

  if (!proposedPayload.noteBody) {
    throw new AppError('Note content is required', 400, 'NOTE_BODY_REQUIRED');
  }

  logger.info(`[HubSpot Action] Creating meeting note associated to deal ${targetDealId}`);

  const payload = {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_note_body: proposedPayload.noteBody,
    },
  };

  if (targetDealId) {
    payload.associations = [
      {
        to: { id: targetDealId },
        types: [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 214, // Note to Deal association type ID
          },
        ],
      },
    ];
  }

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error(`HubSpot create note failed (${res.status}): ${errText}`);
    throw new AppError(`HubSpot API error: ${errText}`, res.status, 'HUBSPOT_NOTE_CREATION_FAILED');
  }

  const data = await res.json();

  return {
    externalRecordId: data.id,
    externalRecordUrl: targetDealId ? `https://app.hubspot.com/deal/${targetDealId}` : `https://app.hubspot.com/note/${data.id}`,
    responseMetadata: data,
  };
};

module.exports = executeHubspotCreateNote;
