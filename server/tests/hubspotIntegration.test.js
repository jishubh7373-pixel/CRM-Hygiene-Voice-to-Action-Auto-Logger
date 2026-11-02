const request = require('supertest');
const app = require('../src/app');
const hubspotOAuth = require('../src/modules/integrations/hubspot/hubspot.oauth');
const hubspotDealsService = require('../src/modules/integrations/hubspot/hubspot.deals.service');
const hubspotSyncService = require('../src/modules/integrations/hubspot/hubspot.sync.service');
const integrationsService = require('../src/modules/integrations/integrations.service');
const Deal = require('../src/models/Deal');
const DealMapping = require('../src/models/DealMapping');
require('./setup');

describe('HubSpot CRM Integration Pipeline', () => {
  let authToken;
  let organizationId;
  let userId;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      orgName: 'HubSpot Test Org',
      domain: 'hubspot-test.com',
      adminName: 'HubSpot Admin',
      email: 'admin@hubspot-test.com',
      password: 'Password123!',
    });

    authToken = regRes.body.data.tokens.accessToken;
    organizationId = regRes.body.data.organization._id || regRes.body.data.organization.id;
    userId = regRes.body.data.user._id || regRes.body.data.user.id;
  });

  describe('HubSpot OAuth Authorization Flow', () => {
    it('should generate a valid HubSpot authorization URL with cryptographically signed state', () => {
      const authUrl = hubspotOAuth.getAuthorizationUrl({
        organizationId,
        userId,
      });

      expect(authUrl).toContain('https://app.hubspot.com/oauth/authorize');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain('state=');
      expect(authUrl).toContain('scope=');
    });

    it('should reject callback with invalid or tampered state', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/hubspot/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'valid_mock_code',
          state: 'tampered_state_string',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('HubSpot Deal Synchronization & Mapping', () => {
    beforeEach(async () => {
      // Connect mock credentials for the org
      await integrationsService.saveEncryptedCredentials({
        organizationId,
        provider: 'hubspot',
        credentials: {
          tokens: {
            accessToken: 'hs_access_token_mock',
            refreshToken: 'hs_refresh_token_mock',
            obtainedAt: Date.now(),
            expiresIn: 3600,
          },
          portalId: '12345678',
          accountName: 'Acme HubSpot Portal',
        },
        externalAccountId: '12345678',
        externalAccountName: 'Acme HubSpot Portal',
      });
    });

    it('should import external deals, map fields correctly, and create DealMapping records', async () => {
      // Mock HubSpot deals response
      jest.spyOn(hubspotDealsService, 'getDeals').mockResolvedValueOnce({
        results: [
          {
            id: 'hs_deal_9001',
            properties: {
              dealname: 'Acme Cloud Migration Deal',
              amount: '120000',
              dealstage: 'contractsent',
              pipeline: 'enterprise_pipeline',
              closedate: '2026-12-15T00:00:00.000Z',
            },
          },
          {
            id: 'hs_deal_9002',
            properties: {
              dealname: 'Globex Security Expansion',
              amount: '85000',
              dealstage: 'closedwon',
              pipeline: 'default',
              closedate: '2026-11-30T00:00:00.000Z',
            },
          },
        ],
      });

      const syncResult = await hubspotSyncService.syncDeals({
        organizationId,
        userId,
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.createdCount).toBe(2);
      expect(syncResult.updatedCount).toBe(0);

      // Verify internal Deal records were created
      const deals = await Deal.find({ organizationId });
      expect(deals.length).toBe(2);

      const migrationDeal = deals.find((d) => d.name === 'Acme Cloud Migration Deal');
      expect(migrationDeal).toBeDefined();
      expect(migrationDeal.amount).toBe(120000);
      expect(migrationDeal.stage).toBe('proposal'); // contractsent maps to proposal
      expect(migrationDeal.crmDealId).toBe('hs_deal_9001');

      const globexDeal = deals.find((d) => d.name === 'Globex Security Expansion');
      expect(globexDeal).toBeDefined();
      expect(globexDeal.stage).toBe('closed_won'); // closedwon maps to closed_won

      // Verify DealMapping records
      const mappings = await DealMapping.find({ organizationId, provider: 'hubspot' });
      expect(mappings.length).toBe(2);
      expect(mappings[0].syncStatus).toBe('synced');
    });

    it('should update existing deals and prevent duplicate Deal or DealMapping creation on second sync', async () => {
      // First sync
      jest.spyOn(hubspotDealsService, 'getDeals').mockResolvedValue({
        results: [
          {
            id: 'hs_deal_9001',
            properties: {
              dealname: 'Acme Cloud Migration Deal',
              amount: '120000',
              dealstage: 'contractsent',
              pipeline: 'enterprise_pipeline',
            },
          },
        ],
      });

      await hubspotSyncService.syncDeals({ organizationId, userId });

      // Second sync with updated amount and stage
      jest.spyOn(hubspotDealsService, 'getDeals').mockResolvedValue({
        results: [
          {
            id: 'hs_deal_9001',
            properties: {
              dealname: 'Acme Cloud Migration Deal - Revised',
              amount: '150000',
              dealstage: 'closedwon',
              pipeline: 'enterprise_pipeline',
            },
          },
        ],
      });

      const secondSyncResult = await hubspotSyncService.syncDeals({ organizationId, userId });

      expect(secondSyncResult.createdCount).toBe(0);
      expect(secondSyncResult.updatedCount).toBe(1);

      // Exactly 1 internal deal must exist, with updated values
      const deals = await Deal.find({ organizationId });
      expect(deals.length).toBe(1);
      expect(deals[0].name).toBe('Acme Cloud Migration Deal - Revised');
      expect(deals[0].amount).toBe(150000);
      expect(deals[0].stage).toBe('closed_won');

      // Exactly 1 mapping must exist
      const mappings = await DealMapping.find({ organizationId });
      expect(mappings.length).toBe(1);
    });
  });
});
