const gongAuth = require('../src/modules/integrations/gong/gong.auth');
const gongImportService = require('../src/modules/integrations/gong/gong.import.service');
const integrationsService = require('../src/modules/integrations/integrations.service');
const Meeting = require('../src/models/Meeting');
const TranscriptSegment = require('../src/models/TranscriptSegment');
require('./setup');

describe('Gong Call Intelligence Integration', () => {
  const organizationId = '60c72b2f9b1d8b2bad000001';
  const userId = '60c72b2f9b1d8b2bad000002';

  describe('HTTP Basic Auth & Header Generation', () => {
    it('should generate valid HTTP Basic authorization header', () => {
      const header = gongAuth.getAuthHeader('gong_key_123', 'gong_sec_456');
      expect(header).toBe(`Basic ${Buffer.from('gong_key_123:gong_sec_456').toString('base64')}`);
    });

    it('should throw error when credentials are missing', () => {
      expect(() => gongAuth.getAuthHeader('', '')).toThrow();
    });
  });

  describe('Transcript Monologue Normalization', () => {
    it('should correctly normalize Gong sentences into unified TranscriptSegment structure', () => {
      const mockGongTranscript = {
        callId: 'call_gong_999',
        transcript: [
          {
            speakerId: 'user_rep_1',
            topic: 'Pricing',
            sentences: [
              { start: 1000, end: 4000, text: 'Welcome everyone to our product demo.' },
              { start: 4500, end: 7500, text: 'Today we will cover DealFlow AI workflows.' },
            ],
          },
          {
            speakerId: 'client_vp_2',
            topic: 'Security',
            sentences: [
              { start: 8000, end: 11000, text: 'Does your solution support single sign-on?' },
            ],
          },
        ],
      };

      const normalized = gongImportService.normalizeTranscript(mockGongTranscript);

      expect(normalized.length).toBe(3);
      expect(normalized[0].speaker).toBe('Speaker user_rep_1');
      expect(normalized[0].text).toBe('Welcome everyone to our product demo.');
      expect(normalized[0].startTime).toBe(1.0); // 1000ms -> 1s
      expect(normalized[0].endTime).toBe(4.0);

      expect(normalized[2].speaker).toBe('Speaker client_vp_2');
      expect(normalized[2].text).toBe('Does your solution support single sign-on?');
      expect(normalized[2].startTime).toBe(8.0);
    });

    it('should return empty array for calls with no transcript', () => {
      expect(gongImportService.normalizeTranscript(null)).toEqual([]);
      expect(gongImportService.normalizeTranscript({})).toEqual([]);
    });
  });

  describe('Gong Call Ingestion & De-duplication', () => {
    beforeEach(async () => {
      // Connect mock credentials
      await integrationsService.saveEncryptedCredentials({
        organizationId,
        provider: 'gong',
        credentials: {
          accessKey: 'gong_access_key_test',
          clientSecret: 'gong_client_secret_test',
          baseUrl: 'https://api.gong.io',
        },
        externalAccountId: 'gong_access_key_test',
        externalAccountName: 'Gong Workspace Test',
      });
    });

    it('should import calls into Meeting and TranscriptSegment models, and skip duplicates on rerun', async () => {
      // Mock fetchCalls
      jest.spyOn(gongImportService, 'fetchCalls').mockResolvedValue({
        calls: [
          {
            id: 'gong_call_101',
            metaData: {
              title: 'Acme Renewal Discussion',
              started: '2026-10-31T14:00:00.000Z',
              duration: 1800,
              direction: 'Inbound',
            },
            parties: [
              { name: 'Sarah Rep', affiliation: 'internal', email: 'sarah@dealflow.ai' },
              { name: 'John Buyer', affiliation: 'external', email: 'john@acme.com' },
            ],
          },
        ],
      });

      // Mock fetchTranscripts
      jest.spyOn(gongImportService, 'fetchTranscripts').mockResolvedValue({
        callTranscripts: [
          {
            callId: 'gong_call_101',
            transcript: [
              {
                speakerId: 'John Buyer',
                sentences: [{ start: 2000, end: 5000, text: 'We want to renew for 2 years.' }],
              },
            ],
          },
        ],
      });

      // 1. Initial import
      const firstImport = await gongImportService.importCalls({
        organizationId,
        userId,
      });

      expect(firstImport.importedCount).toBe(1);
      expect(firstImport.duplicateCount).toBe(0);

      // Verify Meeting document created
      const meeting = await Meeting.findOne({ organizationId, externalCallId: 'gong_call_101' });
      expect(meeting).toBeDefined();
      expect(meeting.title).toBe('Acme Renewal Discussion');
      expect(meeting.clientName).toBe('John Buyer');
      expect(meeting.externalProvider).toBe('gong');

      // Verify TranscriptSegment document created
      const segments = await TranscriptSegment.find({ meetingId: meeting._id });
      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe('We want to renew for 2 years.');

      // 2. Second import (same call ID) - de-duplication must catch it
      const secondImport = await gongImportService.importCalls({
        organizationId,
        userId,
      });

      expect(secondImport.importedCount).toBe(0);
      expect(secondImport.duplicateCount).toBe(1);

      // Verify meeting count did not increase
      const totalMeetings = await Meeting.countDocuments({ organizationId, externalCallId: 'gong_call_101' });
      expect(totalMeetings).toBe(1);
    });
  });
});
