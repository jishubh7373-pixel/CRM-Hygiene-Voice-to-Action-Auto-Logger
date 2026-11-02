const express = require('express');
const zoomWebhook = require('../modules/integrations/zoom/zoom.webhook');
const gongImportService = require('../modules/integrations/gong/gong.import.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Zoom Webhooks (URL Validation Challenge & Event Notifications)
 * Endpoint: POST /api/v1/webhooks/zoom
 */
router.post('/zoom', async (req, res) => {
  try {
    const event = req.body?.event;

    // 1. Zoom URL Validation challenge event
    if (event === 'endpoint.url_validation') {
      const plainToken = req.body?.payload?.plainToken;
      if (!plainToken) {
        return res.status(400).json({ error: 'Missing plainToken in URL validation payload' });
      }

      const response = zoomWebhook.handleUrlValidation(plainToken);
      return res.status(200).json(response);
    }

    // 2. Zoom HMAC-SHA256 Signature verification
    const signature = req.headers['x-zm-signature'];
    const timestamp = req.headers['x-zm-request-timestamp'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = zoomWebhook.verifySignature({
      signature,
      timestamp,
      rawBody,
    });

    if (!isValid) {
      logger.warn('[Zoom Webhook] Signature verification failed or missing headers.');
      return res.status(401).json({ error: 'Unauthorized webhook signature' });
    }

    // 3. Process the event
    const orgId = req.query.orgId || req.headers['x-org-id'];
    const result = await zoomWebhook.handleEvent(req.body, orgId);

    return res.status(200).json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    logger.error(`[Zoom Webhook Error] ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Gong Webhooks (Call completed, etc.)
 * Endpoint: POST /api/v1/webhooks/gong
 */
router.post('/gong', async (req, res) => {
  try {
    const { callId, organizationId } = req.body;
    logger.info(`[Gong Webhook] Received call event for callId: ${callId}`);

    if (callId && organizationId) {
      // Trigger Gong call import
      setImmediate(async () => {
        try {
          await gongImportService.importCalls({
            organizationId,
            maxCalls: 1,
          });
        } catch (err) {
          logger.error(`[Gong Webhook Background Import Error] ${err.message}`);
        }
      });
    }

    return res.status(200).json({ status: 'acknowledged' });
  } catch (error) {
    logger.error(`[Gong Webhook Error] ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
