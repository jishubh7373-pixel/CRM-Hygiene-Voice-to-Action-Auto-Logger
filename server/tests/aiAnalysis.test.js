const request = require('supertest');
const app = require('../src/app');
const Meeting = require('../src/models/Meeting');
const TranscriptSegment = require('../src/models/TranscriptSegment');
const MeetingInsight = require('../src/models/MeetingInsight');
const ActionItem = require('../src/models/ActionItem');
const aiService = require('../src/modules/ai/ai.service');
const AiProvider = require('../src/modules/ai/ai.provider');
const dealHealthService = require('../src/modules/intelligence/dealHealth.service');
require('./setup');

// Mock AI Provider that returns structured, validated meeting intelligence JSON
class MockAIProvider extends AiProvider {
  constructor(customIntelligence = null) {
    super();
    this.customIntelligence = customIntelligence;
  }

  async analyzeMeeting(params) {
    if (this.customIntelligence) {
      return { analysis: this.customIntelligence, usage: { model: 'gpt-4o-mini', totalTokens: 420 } };
    }

    return {
      analysis: {
        summary: {
          executiveSummary: 'Customer confirmed strong interest in replacing their manual hygiene workflow.',
          purpose: 'Architecture review and procurement requirements discussion.',
          currentSituation: 'Team is struggling with reps not logging Salesforce updates after calls.',
          discussionPoints: ['Automated transcription accuracy', 'CRM sync latency', 'SOC2 compliance requirements'],
          customerExpectations: ['Zero rep data entry', 'Direct Salesforce integration'],
          importantDecisions: ['Agreed to move forward to a 14-day technical pilot'],
          unresolvedQuestions: ['Legal approval for EU cloud hosting'],
          nextSteps: ['Vendor to provide security whitepaper and DPA before Friday'],
        },
        decisionCriteria: [
          {
            criterion: 'SOC2 Type II compliance report',
            category: 'security',
            importance: 'high',
            evidence: {
              quote: 'SOC2 compliance requirements',
              startTime: 5.0,
              endTime: 10.0,
              confidence: 0.95,
            },
          },
        ],
        buyingSignals: [
          {
            signal: 'Explicit agreement to initiate pilot',
            category: 'explicit_commitment',
            evidence: {
              quote: 'Agreed to move forward to a 14-day technical pilot',
              startTime: 12.0,
              endTime: 15.0,
              confidence: 0.9,
            },
          },
        ],
        objections: [
          {
            objection: 'Concerns regarding European data sovereignty',
            category: 'compliance',
            status: 'unresolved',
            evidence: {
              quote: 'Legal approval for EU cloud hosting',
              startTime: 18.0,
              endTime: 22.0,
              confidence: 0.88,
            },
          },
        ],
        risks: [
          {
            risk: 'Delayed procurement review if compliance docs are late',
            severity: 'medium',
            evidence: {
              quote: 'Vendor to provide security whitepaper and DPA before Friday',
              startTime: 25.0,
              endTime: 28.0,
              confidence: 0.85,
            },
          },
        ],
        competitors: [
          {
            name: 'Gong',
            comparisonCriteria: 'Cost and complex UX',
            advantages: ['Established enterprise presence'],
            disadvantages: ['Too expensive and bloated for their needs'],
            customerPreference: 'Looking for a lean CRM auto-logger',
            evidence: {
              quote: 'Customer confirmed strong interest in replacing their manual hygiene workflow',
              startTime: 0.0,
              endTime: 5.0,
              confidence: 0.85,
            },
          },
        ],
        actionItems: [
          {
            title: 'Provide security whitepaper and DPA',
            description: 'Deliver compliance documentation to security team',
            responsibleParty: 'internal',
            assignedTo: 'Sales Engineer',
            dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
            priority: 'high',
            evidence: {
              quote: 'Vendor to provide security whitepaper and DPA before Friday',
              startTime: 25.0,
              endTime: 28.0,
              confidence: 0.95,
            },
          },
          {
            title: 'Schedule technical integration kickoff',
            description: 'Confirm client engineering team attendance',
            responsibleParty: 'customer',
            assignedTo: 'Client Lead',
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            priority: 'medium',
            evidence: {
              quote: 'Agreed to move forward to a 14-day technical pilot',
              startTime: 12.0,
              endTime: 15.0,
              confidence: 0.9,
            },
          },
        ],
      },
      usage: {
        model: 'gpt-4o-mini',
        promptTokens: 300,
        completionTokens: 200,
        totalTokens: 500,
      },
    };
  }
}

describe('AI Meeting Intelligence Engine & Deal Health Scoring', () => {
  let orgId;
  let userId;
  let authToken;
  let meeting;
  let rawTranscriptText;

  beforeEach(async () => {
    // Register user & org
    const regRes = await request(app).post('/api/v1/auth/register').send({
      orgName: 'AI Intelligence Org',
      domain: 'ai-intel.com',
      adminName: 'AI Admin',
      email: 'admin@ai-intel.com',
      password: 'Password123!',
    });
    authToken = regRes.body.data.tokens.accessToken;
    userId = regRes.body.data.user._id || regRes.body.data.user.id;
    orgId = regRes.body.data.organization._id || regRes.body.data.organization.id;

    rawTranscriptText =
      'Good morning. Customer confirmed strong interest in replacing their manual hygiene workflow. ' +
      'We discussed automated transcription accuracy, CRM sync latency, and SOC2 compliance requirements. ' +
      'Agreed to move forward to a 14-day technical pilot. ' +
      'One blocker is Legal approval for EU cloud hosting. ' +
      'Vendor to provide security whitepaper and DPA before Friday.';

    meeting = await Meeting.create({
      organizationId: orgId,
      hostId: userId,
      uploadedBy: userId,
      title: 'Enterprise Architecture & Procurement',
      clientName: 'NexaCorp',
      platform: 'upload',
      source: 'audio_upload',
      rawTranscript: rawTranscriptText,
      processingStatus: 'processing',
      transcriptionStatus: 'completed',
      analysisStatus: 'pending',
    });

    // Create segments
    await TranscriptSegment.create([
      {
        meetingId: meeting._id,
        organizationId: orgId,
        segmentIndex: 0,
        startTime: 0.0,
        endTime: 10.0,
        speaker: 'Speaker',
        text: 'Customer confirmed strong interest in replacing their manual hygiene workflow. SOC2 compliance requirements.',
        confidence: 0.95,
      },
      {
        meetingId: meeting._id,
        organizationId: orgId,
        segmentIndex: 1,
        startTime: 10.1,
        endTime: 30.0,
        speaker: 'Speaker',
        text: 'Agreed to move forward to a 14-day technical pilot. Legal approval for EU cloud hosting. Vendor to provide security whitepaper and DPA before Friday.',
        confidence: 0.94,
      },
    ]);
  });

  it('should run AI analysis pipeline, compute deal health, and persist structured insights', async () => {
    const mockProvider = new MockAIProvider();
    aiService.setProvider(mockProvider);

    const { insight, dealHealth } = await aiService.analyzeMeetingIntelligence({
      meetingId: meeting._id,
      organizationId: orgId,
    });

    expect(insight).toBeDefined();
    expect(insight.summary.purpose).toContain('procurement');
    expect(insight.decisionCriteria.length).toBe(1);
    expect(insight.decisionCriteria[0].category).toBe('security');
    expect(insight.buyingSignals.length).toBe(1);
    expect(insight.objections.length).toBe(1);
    expect(insight.risks.length).toBe(1);
    expect(insight.competitors.length).toBe(1);
    expect(insight.actionItems.length).toBe(2);

    // Verify Deal Health Score
    expect(dealHealth).toBeDefined();
    expect(dealHealth.totalScore).toBeGreaterThan(0);
    expect(dealHealth.rating).toBeDefined();
    expect(dealHealth.explanation).toBeDefined();

    // Verify Meeting record updated
    const updatedMeeting = await Meeting.findById(meeting._id);
    expect(updatedMeeting.analysisStatus).toBe('completed');
    expect(updatedMeeting.processingStatus).toBe('completed');

    // Verify ActionItems persisted in database with responsibleParty
    const dbActionItems = await ActionItem.find({ meetingId: meeting._id });
    expect(dbActionItems.length).toBe(2);
    const customerAction = dbActionItems.find((a) => a.responsibleParty === 'customer');
    const internalAction = dbActionItems.find((a) => a.responsibleParty === 'internal');
    expect(customerAction).toBeDefined();
    expect(internalAction).toBeDefined();
    expect(customerAction.evidence.quote).toBeDefined();
  });

  it('should compute explainable 7-dimension deal health score correctly', () => {
    const mockAnalysis = {
      decisionCriteria: [
        { category: 'security', importance: 'high' },
        { category: 'budget', importance: 'medium' },
      ],
      buyingSignals: [
        { category: 'pricing' },
        { category: 'stakeholder' },
      ],
      objections: [
        { objection: 'Data residency', status: 'unresolved' },
      ],
      actionItems: [
        { title: 'Follow up', assignedTo: 'Rep', responsibleParty: 'customer' },
      ],
      summary: {
        nextSteps: ['Security review'],
      },
    };

    const health = dealHealthService.calculateDealHealth(mockAnalysis);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.dimensions.requirementsClarity).toBeDefined();
    expect(health.dimensions.budgetClarity).toBeDefined();
    expect(health.dimensions.buyingSignals).toBeDefined();
    expect(health.dimensions.objectionResolution).toBeDefined();
    expect(health.dimensions.nextStepClarity).toBeDefined();
    expect(health.explanation).toBeDefined();
  });

  it('should allow sales rep to update and certify executive summary via PATCH /insights', async () => {
    // Generate initial insight
    const mockProvider = new MockAIProvider();
    aiService.setProvider(mockProvider);
    await aiService.analyzeMeetingIntelligence({
      meetingId: meeting._id,
      organizationId: orgId,
    });

    // Human review update
    const patchRes = await request(app)
      .patch(`/api/v1/meetings/${meeting._id}/insights`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        summary: {
          purpose: 'Updated Purpose: Negotiate final enterprise agreement terms',
          currentSituation: 'Client validated pipeline ROI during trial',
          discussionPoints: ['Pricing tiers', 'SLA commitments'],
          importantDecisions: ['Agreed on Tier 2 annual commitment'],
          nextSteps: ['Send final DocuSign'],
        },
      });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.success).toBe(true);

    const updatedInsights = patchRes.body.data;
    expect(updatedInsights.summary.purpose).toBe('Updated Purpose: Negotiate final enterprise agreement terms');
    expect(updatedInsights.reviewMetadata.isReviewed).toBe(true);
    expect(updatedInsights.reviewMetadata.reviewedBy).toBe(userId);
    expect(updatedInsights.reviewMetadata.reviewedAt).toBeDefined();
  });
});
