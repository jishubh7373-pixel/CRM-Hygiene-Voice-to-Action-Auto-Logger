const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const zoomWebhook = require('../src/modules/integrations/zoom/zoom.webhook');
const zoomRtms = require('../src/modules/integrations/zoom/zoom.rtms.service');
const Meeting = require('../src/models/Meeting');
const TranscriptSegment = require('../src/models/TranscriptSegment');
const config = require('../src/config');
require('./setup');

describe('Zoom Video, RTMS & Webhook Security Pipeline', () => {
  const webhookSecret = 'test_zoom_webhook_secret_key_123';
  config.integrations.zoom.webhookSecret = webhookSecret;
  const organizationId = '60c72b2f9b1d8b2bad000001';

  describe('Zoom Webhook URL Validation Challenge', () => {
    it('should generate valid encryptedToken using HMAC-SHA256 for URL validation challenge', () => {
      const plainToken = 'zoom_challenge_token_abc123';
      const result = zoomWebhook.handleUrlValidation(plainToken, webhookSecret);

      expect(result).toHaveProperty('plainToken', plainToken);
      expect(result).toHaveProperty('encryptedToken');

      // Verify HMAC-SHA256 calculation
      const expectedHash = crypto.createHmac('sha256', webhookSecret).update(plainToken).digest('hex');
      expect(result.encryptedToken).toBe(expectedHash);
    });

    it('should respond to endpoint.url_validation via POST /api/v1/webhooks/zoom', async () => {
      // Set secret in env temporarily
      process.env.ZOOM_WEBHOOK_SECRET = webhookSecret;

      const res = await request(app)
        .post('/api/v1/webhooks/zoom')
        .send({
          event: 'endpoint.url_validation',
          payload: {
            plainToken: 'token_from_zoom_challenge',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.plainToken).toBe('token_from_zoom_challenge');
      expect(res.body.encryptedToken).toBeTruthy();
    });
  });

  describe('Zoom HMAC-SHA256 Webhook Signature Verification', () => {
    it('should accept valid signature matching timestamp and raw body', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify({ event: 'meeting.ended', payload: { object: { id: 123456 } } });

      const message = `v0:${nowSeconds}:${rawBody}`;
      const hash = crypto.createHmac('sha256', webhookSecret).update(message).digest('hex');
      const validSignature = `v0=${hash}`;

      const isValid = zoomWebhook.verifySignature({
        signature: validSignature,
        timestamp: String(nowSeconds),
        rawBody,
        webhookSecret,
      });

      expect(isValid).toBe(true);
    });

    it('should reject tampered payload or forged signature', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify({ event: 'meeting.ended' });

      const isValid = zoomWebhook.verifySignature({
        signature: 'v0=forged_invalid_signature_hash',
        timestamp: String(nowSeconds),
        rawBody,
        webhookSecret,
      });

      expect(isValid).toBe(false);
    });

    it('should reject expired timestamp older than 300 seconds', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s old
      const rawBody = JSON.stringify({ event: 'meeting.ended' });

      const message = `v0:${expiredTimestamp}:${rawBody}`;
      const hash = crypto.createHmac('sha256', webhookSecret).update(message).digest('hex');

      const isValid = zoomWebhook.verifySignature({
        signature: `v0=${hash}`,
        timestamp: String(expiredTimestamp),
        rawBody,
        webhookSecret,
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Zoom Real-Time Media Streams (RTMS) Service', () => {
    it('should manage live RTMS stream session, buffer segments, and finalize into unified meeting record', async () => {
      const meetingId = '9876543210';

      // 1. Start live session
      const session = zoomRtms.startSession({
        organizationId,
        meetingId,
        topic: 'Enterprise Q4 Sales Strategy',
      });

      expect(session).toHaveProperty('status', 'active');
      expect(session.meetingId).toBe(meetingId);

      // 2. Stream live transcript chunks
      zoomRtms.handleLiveTranscriptChunk({
        organizationId,
        meetingId,
        speaker: 'John Deal Rep',
        text: 'Let us discuss our contract terms and scope.',
        timestampMs: 1000,
      });

      zoomRtms.handleLiveTranscriptChunk({
        organizationId,
        meetingId,
        speaker: 'Sarah Procurement',
        text: 'We are ready to move forward if you can match the discount.',
        timestampMs: 5000,
      });

      expect(session.transcriptSegments.length).toBe(2);

      // 3. Finalize session
      const finalResult = await zoomRtms.finalizeSession({
        organizationId,
        meetingId,
        topic: 'Enterprise Q4 Sales Strategy',
        clientName: 'Sarah Procurement',
      });

      expect(finalResult.isDuplicate).toBe(false);
      expect(finalResult.meeting).toBeDefined();
      expect(finalResult.meeting.title).toBe('Enterprise Q4 Sales Strategy');
      expect(finalResult.meeting.externalProvider).toBe('zoom');
      expect(finalResult.meeting.externalMeetingId).toBe(meetingId);

      // Verify segments persisted in database
      const savedSegments = await TranscriptSegment.find({ meetingId: finalResult.meeting._id });
      expect(savedSegments.length).toBe(2);
      expect(savedSegments[0].speaker).toBe('John Deal Rep');
      expect(savedSegments[1].speaker).toBe('Sarah Procurement');
    });
  });
});
