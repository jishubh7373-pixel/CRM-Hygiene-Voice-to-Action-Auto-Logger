const request = require('supertest');
const app = require('../src/app');
const AutomationAction = require('../src/models/AutomationAction');
const AutomationExecution = require('../src/models/AutomationExecution');
const Deal = require('../src/models/Deal');
const Meeting = require('../src/models/Meeting');
const integrationsService = require('../src/modules/integrations/integrations.service');
const jiraIssuesService = require('../src/modules/integrations/jira/jira.issues.service');
require('./setup');

describe('Phase 4: Safe Execution Engine & Provider Write Operations', () => {
  let adminToken;
  let organizationId;
  let userId;
  let testDeal;
  let testMeeting;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Execution Test Org',
      domain: 'execution-test.com',
      adminName: 'Dave Admin',
      email: 'admin@execution-test.com',
      password: 'Password123!',
    });

    adminToken = regRes.body.data.tokens.accessToken;
    organizationId = regRes.body.data.organization._id || regRes.body.data.organization.id;
    userId = regRes.body.data.user._id || regRes.body.data.user.id;

    // Connect mock HubSpot integration
    await integrationsService.saveEncryptedCredentials({
      organizationId,
      provider: 'hubspot',
      credentials: {
        tokens: {
          accessToken: 'hs_mock_access_token_123',
          refreshToken: 'hs_mock_refresh_token_123',
          obtainedAt: Date.now(),
          expiresIn: 3600,
        },
        portalId: '998877',
      },
      externalAccountId: '998877',
      externalAccountName: 'HubSpot Test Portal',
    });

    // Connect mock Jira integration
    await integrationsService.saveEncryptedCredentials({
      organizationId,
      provider: 'jira',
      credentials: {
        tokens: {
          accessToken: 'jira_mock_access_token_123',
          refreshToken: 'jira_mock_refresh_token_123',
          obtainedAt: Date.now(),
          expiresIn: 3600,
        },
        cloudId: 'jira-cloud-uuid-456',
        siteName: 'Jira Test Cloud',
      },
      externalAccountId: 'jira-cloud-uuid-456',
      externalAccountName: 'Jira Test Cloud',
    });

    // Create deal
    testDeal = await Deal.create({
      organizationId,
      ownerId: userId,
      name: 'OmniChannel Expansion Deal',
      accountName: 'Omni Corp',
      amount: 100000,
      stage: 'qualification',
      closeDate: new Date('2026-12-31'),
      crmDealId: 'hs_deal_5544',
      crmSource: 'hubspot',
    });

    // Create meeting
    testMeeting = await Meeting.create({
      organizationId,
      dealId: testDeal._id,
      title: 'OmniChannel Demo & Pricing',
      clientName: 'David Procurement',
      meetingDate: new Date(),
    });
  });

  describe('Mandatory Approval Enforcement', () => {
    it('MUST REJECT execution of unapproved or pending proposals (400 ACTION_NOT_APPROVED)', async () => {
      // Create pending action
      const pendingAction = await AutomationAction.create({
        organizationId,
        meetingId: testMeeting._id,
        dealId: testDeal._id,
        provider: 'hubspot',
        actionType: 'hubspot_update_deal',
        targetRecordId: 'hs_deal_5544',
        title: 'Advance stage to Proposal',
        proposedPayload: { dealId: 'hs_deal_5544', stage: 'proposal' },
        approvalStatus: 'pending_approval', // NOT APPROVED!
        executionStatus: 'not_started',
      });

      const res = await request(app)
        .post(`/api/v1/automation/actions/${pendingAction._id}/execute`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ACTION_NOT_APPROVED');

      // Verify execution status remained untouched
      const dbAction = await AutomationAction.findById(pendingAction._id);
      expect(dbAction.executionStatus).toBe('not_started');
    });

    it('MUST REJECT execution of rejected proposals', async () => {
      const rejectedAction = await AutomationAction.create({
        organizationId,
        meetingId: testMeeting._id,
        dealId: testDeal._id,
        provider: 'jira',
        actionType: 'jira_create_issue',
        targetRecordId: 'CRM',
        title: 'Rejected Task',
        proposedPayload: { projectKey: 'CRM', summary: 'Will not execute' },
        approvalStatus: 'rejected',
        executionStatus: 'not_started',
      });

      const res = await request(app)
        .post(`/api/v1/automation/actions/${rejectedAction._id}/execute`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ACTION_NOT_APPROVED');
    });
  });

  describe('HubSpot Execution Service', () => {
    it('should execute approved deal update, verify provider response, and update local deal state', async () => {
      const approvedAction = await AutomationAction.create({
        organizationId,
        meetingId: testMeeting._id,
        dealId: testDeal._id,
        provider: 'hubspot',
        actionType: 'hubspot_update_deal',
        targetRecordId: 'hs_deal_5544',
        title: 'Advance stage to Proposal & Update Amount to $125k',
        proposedPayload: {
          dealId: 'hs_deal_5544',
          stage: 'proposal',
          amount: 125000,
        },
        originalPayload: {
          dealId: 'hs_deal_5544',
          stage: 'qualification',
          amount: 100000,
        },
        approvalStatus: 'approved',
        executionStatus: 'not_started',
        approvedBy: userId,
        approvedAt: new Date(),
      });

      // Mock native global.fetch for HubSpot PATCH
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'hs_deal_5544',
          properties: { dealstage: 'proposal', amount: '125000' },
        }),
      });

      try {
        const res = await request(app)
          .post(`/api/v1/automation/actions/${approvedAction._id}/execute`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.action.executionStatus).toBe('completed');
        expect(res.body.data.action.externalRecordId).toBe('hs_deal_5544');

        // Verify local deal was updated
        const updatedDeal = await Deal.findById(testDeal._id);
        expect(updatedDeal.stage).toBe('proposal');
        expect(updatedDeal.amount).toBe(125000);

        // Verify execution log recorded
        const execLog = await AutomationExecution.findOne({ actionId: approvedAction._id });
        expect(execLog).toBeDefined();
        expect(execLog.executionStatus).toBe('completed');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should detect stale data and abort execution if target deal changed externally', async () => {
      // Modify target deal amount externally to cause stale conflict
      await Deal.findByIdAndUpdate(testDeal._id, { amount: 200000 });

      const staleAction = await AutomationAction.create({
        organizationId,
        meetingId: testMeeting._id,
        dealId: testDeal._id,
        provider: 'hubspot',
        actionType: 'hubspot_update_deal',
        targetRecordId: 'hs_deal_5544',
        title: 'Advance stage to Proposal',
        proposedPayload: { dealId: 'hs_deal_5544', amount: 125000 },
        originalPayload: { dealId: 'hs_deal_5544', amount: 100000 }, // Discrepancy with 200000!
        approvalStatus: 'approved',
        executionStatus: 'not_started',
      });

      const res = await request(app)
        .post(`/api/v1/automation/actions/${staleAction._id}/execute`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409); // Conflict
      expect(res.body.error.code).toBe('STALE_DATA_CONFLICT');
    });
  });

  describe('Jira Execution Service', () => {
    it('should execute approved Jira task proposal and format description in ADF', async () => {
      const approvedJiraAction = await AutomationAction.create({
        organizationId,
        meetingId: testMeeting._id,
        dealId: testDeal._id,
        provider: 'jira',
        actionType: 'jira_create_issue',
        targetRecordId: 'CRM',
        title: 'Prepare Custom Pricing Proposal',
        proposedPayload: {
          projectKey: 'CRM',
          summary: 'Prepare Custom Pricing Proposal',
          description: 'Client requested multi-year tiered discounts.',
          priority: 'High',
        },
        approvalStatus: 'approved',
        executionStatus: 'not_started',
      });

      // Spy on jiraIssuesService.createIssue
      jest.spyOn(jiraIssuesService, 'createIssue').mockResolvedValueOnce({
        issueId: '10088',
        issueKey: 'CRM-99',
        issueUrl: 'https://acme.atlassian.net/browse/CRM-99',
      });

      const res = await request(app)
        .post(`/api/v1/automation/actions/${approvedJiraAction._id}/execute`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.action.externalRecordId).toBe('10088');
      expect(res.body.data.action.executionStatus).toBe('completed');
    });
  });

  describe('Idempotency & Duplicate Execution Protection', () => {
    it('re-executing a completed action should return existing external record without re-calling provider', async () => {
      const completedAction = await AutomationAction.create({
        organizationId,
        meetingId: testMeeting._id,
        dealId: testDeal._id,
        provider: 'hubspot',
        actionType: 'hubspot_update_deal',
        targetRecordId: 'hs_deal_5544',
        title: 'Already Executed Action',
        proposedPayload: { dealId: 'hs_deal_5544' },
        approvalStatus: 'approved',
        executionStatus: 'completed', // ALREADY COMPLETED!
        externalRecordId: 'hs_deal_5544',
        externalRecordUrl: 'https://app.hubspot.com/deal/hs_deal_5544',
      });

      const res = await request(app)
        .post(`/api/v1/automation/actions/${completedAction._id}/execute`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyExecuted).toBe(true);
      expect(res.body.data.externalRecordId).toBe('hs_deal_5544');
    });
  });
});
