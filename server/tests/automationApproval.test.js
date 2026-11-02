const request = require('supertest');
const app = require('../src/app');
const AutomationAction = require('../src/models/AutomationAction');
const ApprovalHistory = require('../src/models/ApprovalHistory');
const Meeting = require('../src/models/Meeting');
const MeetingInsight = require('../src/models/MeetingInsight');
const ActionItem = require('../src/models/ActionItem');
const Deal = require('../src/models/Deal');
const TranscriptSegment = require('../src/models/TranscriptSegment');
const actionGenerator = require('../src/modules/automation/action-generator.service');
require('./setup');

describe('Phase 4: Action Proposal Generation & Human Approval Lifecycle', () => {
  let adminTokenOrgA;
  let repTokenOrgA;
  let adminTokenOrgB;
  let orgAId;
  let orgBId;
  let meetingOrgA;
  let dealOrgA;

  beforeEach(async () => {
    // 1. Create Org A Admin
    const regResA = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Approval Test Org A',
      domain: 'approval-a.com',
      adminName: 'Alice Admin',
      email: 'admin@approval-a.com',
      password: 'Password123!',
    });
    adminTokenOrgA = regResA.body.data.tokens.accessToken;
    orgAId = regResA.body.data.organization._id || regResA.body.data.organization.id;

    // 2. Invite & Login Rep in Org A
    await request(app)
      .post('/api/v1/settings/team/invite')
      .set('Authorization', `Bearer ${adminTokenOrgA}`)
      .send({
        name: 'Bob Rep',
        email: 'bob.rep@approval-a.com',
        role: 'rep',
        temporaryPassword: 'Password123!',
      });

    // Login as Rep with default password set in seed/tests
    // Or register another user directly
    const loginRepRes = await request(app).post('/api/v1/auth/login').send({
      email: 'bob.rep@approval-a.com',
      password: 'Password123!',
    });
    repTokenOrgA = loginRepRes.body.data.tokens.accessToken;

    // 3. Create Org B Admin
    const regResB = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Approval Test Org B',
      domain: 'approval-b.com',
      adminName: 'Carol Admin',
      email: 'admin@approval-b.com',
      password: 'Password123!',
    });
    adminTokenOrgB = regResB.body.data.tokens.accessToken;
    orgBId = regResB.body.data.organization._id || regResB.body.data.organization.id;

    // 4. Create Deal in Org A
    dealOrgA = await Deal.create({
      organizationId: orgAId,
      ownerId: regResA.body.data.user._id || regResA.body.data.user.id,
      name: 'Global FinTech Platform Deal',
      accountName: 'Global FinTech Corp',
      amount: 150000,
      stage: 'demo',
      closeDate: new Date('2026-12-31'),
      crmDealId: 'hs_deal_9988',
      crmSource: 'hubspot',
    });

    // 5. Create Meeting in Org A
    meetingOrgA = await Meeting.create({
      organizationId: orgAId,
      dealId: dealOrgA._id,
      title: 'Global FinTech Contract Review',
      clientName: 'Sarah Procurement',
      meetingDate: new Date(),
      source: 'zoom',
    });

    // 6. Transcript Segment with verbatim evidence
    await TranscriptSegment.create({
      organizationId: orgAId,
      meetingId: meetingOrgA._id,
      segmentIndex: 0,
      speaker: 'Sarah Procurement',
      text: 'We are ready to move to contract negotiation if you can deliver by year end.',
      startTime: 120,
      endTime: 126,
    });

    // 7. Meeting Insights
    await MeetingInsight.create({
      organizationId: orgAId,
      meetingId: meetingOrgA._id,
      summary: {
        executiveSummary: 'Customer approved technical requirements and requested immediate contract drafting for final sign-off.',
      },
      buyingSignals: [
        {
          signal: 'Explicit contract negotiation request',
          intensity: 'high',
          evidence: {
            quote: 'We are ready to move to contract negotiation if you can deliver by year end.',
            speaker: 'Sarah Procurement',
            startTime: 120,
            endTime: 126,
          },
        },
      ],
      customerRequirements: [{ requirement: 'Contract negotiation by year end' }],
    });

    // 8. Action Items
    await ActionItem.create({
      organizationId: orgAId,
      meetingId: meetingOrgA._id,
      title: 'Draft master service agreement and send for legal review',
      description: 'Prepare contract clauses reflecting annual discount terms.',
      priority: 'high',
      assigneeName: 'Legal Team',
      evidence: {
        quote: 'We are ready to move to contract negotiation if you can deliver by year end.',
      },
    });
  });

  describe('Action Proposal Generation', () => {
    it('should analyze meeting intelligence and generate HubSpot deal update and Jira task proposals', async () => {
      const result = await actionGenerator.generateActionsForMeeting({
        meetingId: meetingOrgA._id,
        organizationId: orgAId,
      });

      expect(result.generatedCount).toBeGreaterThanOrEqual(2);

      const actions = await AutomationAction.find({ organizationId: orgAId, meetingId: meetingOrgA._id });
      expect(actions.length).toBeGreaterThanOrEqual(2);

      // Verify HubSpot stage update proposal
      const hubspotAction = actions.find((a) => a.actionType === 'hubspot_update_deal');
      expect(hubspotAction).toBeDefined();
      expect(hubspotAction.riskLevel).toBe('high');
      expect(hubspotAction.approvalStatus).toBe('pending_approval');
      expect(hubspotAction.evidence.quote).toContain('contract negotiation');

      // Verify Jira task proposal
      const jiraAction = actions.find((a) => a.actionType === 'jira_create_issue');
      expect(jiraAction).toBeDefined();
      expect(jiraAction.riskLevel).toBe('medium');
      expect(jiraAction.proposedPayload.projectKey).toBe('CRM');
      expect(jiraAction.approvalStatus).toBe('pending_approval');
    });
  });

  describe('Approval Permissions & Role Enforcement', () => {
    let pendingActionId;

    beforeEach(async () => {
      const generated = await actionGenerator.generateActionsForMeeting({
        meetingId: meetingOrgA._id,
        organizationId: orgAId,
      });
      pendingActionId = generated.actions[0]._id;
    });

    it('Sales Rep should be REJECTED from approving proposals (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/automation/actions/${pendingActionId}/approve`)
        .set('Authorization', `Bearer ${repTokenOrgA}`)
        .send({ comments: 'Rep attempting to approve' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      const action = await AutomationAction.findById(pendingActionId);
      expect(action.approvalStatus).toBe('pending_approval'); // Unchanged
    });

    it('Admin should be AUTHORIZED to approve proposals', async () => {
      const res = await request(app)
        .post(`/api/v1/automation/actions/${pendingActionId}/approve`)
        .set('Authorization', `Bearer ${adminTokenOrgA}`)
        .send({ comments: 'Verified evidence and authorized' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvalStatus).toBe('approved');

      // Verify ApprovalHistory recorded
      const history = await ApprovalHistory.find({ actionId: pendingActionId, operation: 'approved' });
      expect(history.length).toBe(1);
    });

    it('Admin from Org B should NOT see or approve Org A proposals (Tenant Isolation)', async () => {
      const res = await request(app)
        .post(`/api/v1/automation/actions/${pendingActionId}/approve`)
        .set('Authorization', `Bearer ${adminTokenOrgB}`)
        .send({ comments: 'Cross-tenant attempt' });

      expect(res.status).toBe(404); // Scoped away by organizationId
    });
  });

  describe('Material Modification & Approval Invalidation', () => {
    it('editing an already approved action must invalidate approval and reset status to pending_approval', async () => {
      const generated = await actionGenerator.generateActionsForMeeting({
        meetingId: meetingOrgA._id,
        organizationId: orgAId,
      });
      const actionId = generated.actions[0]._id;

      // 1. Approve
      await request(app)
        .post(`/api/v1/automation/actions/${actionId}/approve`)
        .set('Authorization', `Bearer ${adminTokenOrgA}`);

      const approvedDoc = await AutomationAction.findById(actionId);
      expect(approvedDoc.approvalStatus).toBe('approved');

      // 2. Edit proposed payload
      const editRes = await request(app)
        .patch(`/api/v1/automation/actions/${actionId}`)
        .set('Authorization', `Bearer ${adminTokenOrgA}`)
        .send({
          title: 'Revised Contract Update Title',
          proposedPayload: { ...approvedDoc.proposedPayload, amount: 180000 },
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.approvalStatus).toBe('pending_approval');
      expect(editRes.body.data.approvedBy).toBeNull(); // Reset!

      // Verify ApprovalHistory contains 'edited' operation
      const history = await ApprovalHistory.find({ actionId, operation: 'edited' });
      expect(history.length).toBe(1);
    });
  });

  describe('Rejection Flow', () => {
    it('should transition proposal to rejected status with reason', async () => {
      const generated = await actionGenerator.generateActionsForMeeting({
        meetingId: meetingOrgA._id,
        organizationId: orgAId,
      });
      const actionId = generated.actions[0]._id;

      const res = await request(app)
        .post(`/api/v1/automation/actions/${actionId}/reject`)
        .set('Authorization', `Bearer ${adminTokenOrgA}`)
        .send({ reason: 'Commercial terms postponed by CFO' });

      expect(res.status).toBe(200);
      expect(res.body.data.approvalStatus).toBe('rejected');
      expect(res.body.data.rejectionReason).toBe('Commercial terms postponed by CFO');
    });
  });
});
