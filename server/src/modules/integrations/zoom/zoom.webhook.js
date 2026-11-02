const crypto = require('crypto');
const config = require('../../../config');
const unifiedMeetingIngestion = require('../../../services/unifiedMeetingIngestion.service');
const Integration = require('../../../models/Integration');
const logger = require('../../../utils/logger');
const AppError = require('../../../utils/appError');

class ZoomWebhookService {
  /**
   * Verify Zoom Webhook HMAC-SHA256 signature
   * Message format: `v0:${timestamp}:${rawBody}`
   */
  verifySignature({ signature, timestamp, rawBody, webhookSecret }) {
    const secret = webhookSecret || config.integrations.zoom.webhookSecret;
    if (!secret) {
      logger.warn('[Zoom Webhook] ZOOM_WEBHOOK_SECRET is not configured. Verification failing.');
      return false;
    }

    if (!signature || !timestamp || !rawBody) {
      return false;
    }

    // Freshness check: reject requests older than 5 minutes
    const nowSeconds = Math.floor(Date.now() / 1000);
    const reqTimestamp = parseInt(timestamp, 10);
    if (Math.abs(nowSeconds - reqTimestamp) > 300) {
      logger.warn(`[Zoom Webhook] Timestamp expired. Drift: ${nowSeconds - reqTimestamp}s`);
      return false;
    }

    const message = `v0:${timestamp}:${rawBody}`;
    const hash = crypto.createHmac('sha256', secret).update(message).digest('hex');
    const expectedSignature = `v0=${hash}`;

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  /**
   * Handle Zoom URL validation challenge
   */
  handleUrlValidation(plainToken, webhookSecret) {
    const secret = webhookSecret || config.integrations.zoom.webhookSecret;
    if (!secret) {
      throw new AppError('Zoom Webhook Secret is not configured', 500, 'ZOOM_SECRET_MISSING');
    }

    const encryptedToken = crypto.createHmac('sha256', secret).update(plainToken).digest('hex');

    return {
      plainToken,
      encryptedToken,
    };
  }

  /**
   * Process Zoom Webhook Events (recording.completed, meeting.ended, etc.)
   */
  async handleEvent(eventPayload, organizationId = null) {
    const eventType = eventPayload?.event;
    const payload = eventPayload?.payload?.object;

    logger.info(`[Zoom Webhook] Processing event: ${eventType} (Meeting ID: ${payload?.id || payload?.uuid})`);

    // Resolve organizationId if not passed in query/header
    let targetOrgId = organizationId;
    if (!targetOrgId && payload?.account_id) {
      const zoomIntegration = await Integration.findOne({
        provider: 'zoom',
        externalAccountId: payload.account_id,
      });
      if (zoomIntegration) {
        targetOrgId = zoomIntegration.organizationId;
      }
    }

    if (!targetOrgId) {
      // Fallback: look for any connected Zoom integration
      const anyZoom = await Integration.findOne({ provider: 'zoom', connectionStatus: 'connected' });
      if (anyZoom) {
        targetOrgId = anyZoom.organizationId;
      }
    }

    if (!targetOrgId) {
      logger.warn(`[Zoom Webhook] Cannot associate event ${eventType} with an active organization. Ignored.`);
      return { handled: false, reason: 'ORGANIZATION_UNRESOLVED' };
    }

    if (eventType === 'recording.completed') {
      const meetingId = String(payload.id || payload.uuid);
      const meetingTopic = payload.topic || `Zoom Recording - ${meetingId}`;
      const recordingFiles = payload.recording_files || [];

      // Find audio or MP4 file
      const audioFile = recordingFiles.find((f) => f.file_type === 'M4A' || f.file_extension === 'MP3' || f.file_type === 'MP4');

      const ingestPayload = {
        organizationId: targetOrgId,
        source: 'zoom',
        externalProvider: 'zoom',
        externalMeetingId: meetingId,
        title: meetingTopic,
        meetingDate: payload.start_time ? new Date(payload.start_time) : new Date(),
        duration: payload.duration ? payload.duration * 60 : 0,
        durationMinutes: payload.duration || 30,
        clientName: payload.host_email || 'Zoom Meeting Host',
        sourceMetadata: {
          zoomMeetingId: meetingId,
          zoomUuid: payload.uuid,
          hostEmail: payload.host_email,
          recordingPlayUrl: payload.share_url,
        },
      };

      if (audioFile) {
        ingestPayload.audioReference = {
          provider: 'local',
          key: `zoom_recordings/${meetingId}_${audioFile.id}.${audioFile.file_extension?.toLowerCase() || 'm4a'}`,
          originalName: `${meetingTopic}.${audioFile.file_extension?.toLowerCase() || 'm4a'}`,
          mimeType: audioFile.file_extension === 'MP3' ? 'audio/mpeg' : 'audio/mp4',
          sizeBytes: audioFile.file_size || 0,
          downloadUrl: audioFile.download_url,
        };
      }

      const result = await unifiedMeetingIngestion.ingestMeeting(ingestPayload);
      return { handled: true, event: eventType, meetingId: result.meeting._id };
    }

    if (eventType === 'meeting.ended') {
      logger.info(`[Zoom Webhook] Meeting ended notification received: ${payload?.id}`);
      return { handled: true, event: eventType, meetingId: payload?.id };
    }

    return { handled: true, event: eventType, message: 'Event acknowledged' };
  }
}

module.exports = new ZoomWebhookService();
