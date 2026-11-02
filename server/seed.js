const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');
const User = require('./src/models/User');
const Deal = require('./src/models/Deal');
const Meeting = require('./src/models/Meeting');
const TranscriptSegment = require('./src/models/TranscriptSegment');
const MeetingInsight = require('./src/models/MeetingInsight');
const ActionItem = require('./src/models/ActionItem');
const Integration = require('./src/models/Integration');
const AuditLog = require('./src/models/AuditLog');
const config = require('./src/config');
const logger = require('./src/utils/logger');

const populateDatabase = async () => {
  // Clear existing collections
  await Promise.all([
    Organization.deleteMany({}),
    User.deleteMany({}),
    Deal.deleteMany({}),
    Meeting.deleteMany({}),
    TranscriptSegment.deleteMany({}),
    MeetingInsight.deleteMany({}),
    ActionItem.deleteMany({}),
    Integration.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  logger.info('Cleared existing collections.');

  // 1. Seed Organization 1 (Acme Cloud Technologies)
  const acmeOrg = await Organization.create({
    name: 'Acme Cloud Technologies',
    domain: 'acmecloud.com',
    plan: 'enterprise',
    settings: {
      crmType: 'salesforce',
      autoLogEnabled: true,
      hygieneSensitivity: 'standard',
      dataRetentionDays: 90,
    },
  });

  // 2. Seed Acme Users
  const adminUser = await User.create({
    organizationId: acmeOrg._id,
    name: 'Alex Rivera',
    email: 'admin@acmecloud.com',
    password: 'Password123!',
    role: 'admin',
    title: 'VP of Revenue Operations',
  });

  const repUser = await User.create({
    organizationId: acmeOrg._id,
    name: 'Sarah Chen',
    email: 'sarah.rep@acmecloud.com',
    password: 'Password123!',
    role: 'rep',
    title: 'Senior Account Executive',
  });

  // 3. Seed Organization 2 (Global Retail Corp) for tenant isolation verification
  const retailOrg = await Organization.create({
    name: 'Global Retail Corp',
    domain: 'globalretail.com',
    plan: 'professional',
  });

  const retailAdmin = await User.create({
    organizationId: retailOrg._id,
    name: 'Marcus Vance',
    email: 'admin@globalretail.com',
    password: 'Password123!',
    role: 'admin',
    title: 'Head of Sales',
  });

  // 4. Seed Integrations for Acme Org
  const providers = ['salesforce', 'hubspot', 'slack', 'zoom', 'google_meet'];
  await Promise.all(
    providers.map((provider) =>
      Integration.create({
        organizationId: acmeOrg._id,
        provider,
        status: 'disconnected',
        credentialsConfigured: false,
        config: {
          instanceUrl: '',
          clientId: '',
          hasSecret: false,
        },
      })
    )
  );

  // 5. Seed Deals for Acme
  const deal1 = await Deal.create({
    organizationId: acmeOrg._id,
    ownerId: repUser._id,
    name: 'Enterprise Cloud Migration 2026',
    accountName: 'Starlight Financial',
    amount: 145000,
    stage: 'proposal',
    probability: 75,
    closeDate: new Date(Date.now() + 15 * 86400000),
    hygieneScore: 92,
    hygieneStatus: 'healthy',
    riskReasons: [],
    crmSource: 'salesforce',
  });

  const deal2 = await Deal.create({
    organizationId: acmeOrg._id,
    ownerId: repUser._id,
    name: 'Global SOC2 Security Suite',
    accountName: 'CyberShield Logistics',
    amount: 88000,
    stage: 'negotiation',
    probability: 80,
    closeDate: new Date(Date.now() - 3 * 86400000),
    hygieneScore: 45,
    hygieneStatus: 'at_risk',
    riskReasons: ['Target close date has passed without update', 'Decision maker objection regarding pricing unanswered'],
    crmSource: 'salesforce',
  });

  const deal3 = await Deal.create({
    organizationId: acmeOrg._id,
    ownerId: repUser._id,
    name: 'Multi-Tenant Data Warehouse License',
    accountName: 'OmniHealth Networks',
    amount: 210000,
    stage: 'demo',
    probability: 50,
    closeDate: new Date(Date.now() + 35 * 86400000),
    hygieneScore: 88,
    hygieneStatus: 'healthy',
    riskReasons: [],
    crmSource: 'internal',
  });

  // Seed Retail Org Deal
  await Deal.create({
    organizationId: retailOrg._id,
    ownerId: retailAdmin._id,
    name: 'Retail POS Modernization',
    accountName: 'Nordic Markets',
    amount: 320000,
    stage: 'proposal',
    probability: 70,
    closeDate: new Date(Date.now() + 20 * 86400000),
    hygieneScore: 95,
    hygieneStatus: 'healthy',
  });

  // 6. Seed Meetings for Acme with Phase 2 Audio Storage & Intelligence
  const meeting1 = await Meeting.create({
    organizationId: acmeOrg._id,
    uploadedBy: repUser._id,
    hostId: repUser._id,
    dealId: deal1._id,
    title: 'Technical Architecture Review & Security Q&A',
    description: 'Executive technical evaluation with CTO and security compliance team',
    clientName: 'Starlight Financial',
    clientEmail: 'cto@starlightfinancial.com',
    source: 'audio_upload',
    platform: 'audio_upload',
    meetingDate: new Date(Date.now() - 2 * 86400000),
    scheduledStartTime: new Date(Date.now() - 2 * 86400000),
    duration: 2700,
    durationMinutes: 45,
    processingStatus: 'completed',
    transcriptionStatus: 'completed',
    analysisStatus: 'completed',
    status: 'completed',
    audioStorage: {
      provider: 'local',
      key: 'seed/sample_meeting_1.mp3',
      originalName: 'starlight_arch_review.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 14200000,
      durationSeconds: 2700,
    },
    rawTranscript:
      '[00:01] Sarah: Hi team, thanks for joining the architecture sync.\n[00:05] CTO: We reviewed your compliance whitepaper. We need the final redlines by Friday.\n[00:15] Sarah: Absolutely, I will have legal prioritize that for you.',
    sourceMetadata: {
      isSeed: true,
      isDemo: true,
      demoNote: 'Reference architecture seed meeting for demonstration and testing.',
    },
    crmSyncStatus: 'synced',
    crmSyncedAt: new Date(),
  });

  // 7. Seed Transcript Segments for Meeting 1
  await TranscriptSegment.create([
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      segmentIndex: 0,
      startTime: 0,
      endTime: 12,
      speaker: 'Sarah Chen (Rep)',
      text: 'Good morning everyone. Today we will walk through the multi-tenant architecture and security controls.',
      confidence: 0.98,
    },
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      segmentIndex: 1,
      startTime: 12,
      endTime: 28,
      speaker: 'David (CTO)',
      text: 'Thanks Sarah. Our chief compliance concern is EU data residency and ensuring our encryption keys are tenant-managed.',
      confidence: 0.96,
    },
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      segmentIndex: 2,
      startTime: 28,
      endTime: 45,
      speaker: 'Sarah Chen (Rep)',
      text: 'We support AWS KMS customer-managed keys natively, with strict VPC peering latency under twelve milliseconds.',
      confidence: 0.97,
    },
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      segmentIndex: 3,
      startTime: 45,
      endTime: 62,
      speaker: 'David (CTO)',
      text: 'That directly solves our architectural requirement. We have a budget of one hundred fifty thousand approved for this initiative.',
      confidence: 0.95,
    },
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      segmentIndex: 4,
      startTime: 62,
      endTime: 80,
      speaker: 'David (CTO)',
      text: 'Please send over the redlined MSA agreement by Friday so procurement can begin vendor onboarding.',
      confidence: 0.99,
    },
  ]);

  // 8. Seed MeetingInsight for Meeting 1
  await MeetingInsight.create({
    organizationId: acmeOrg._id,
    meetingId: meeting1._id,
    summary: {
      executiveSummary:
        'Starlight Financial evaluated the multi-tenant security architecture and customer-managed KMS encryption. CTO David verified all compliance prerequisites and confirmed a budget of $150,000.',
      purpose: 'Technical architecture validation and security signoff',
      currentSituation: 'Evaluating SaaS providers for Q4 enterprise cloud migration',
      discussionPoints: [
        'EU data residency compliance',
        'Customer-managed AWS KMS keys',
        'VPC peering latency under 12ms',
        'Commercial budget approval',
      ],
      customerExpectations: ['Delivery of redlined MSA contract by Friday', 'Vendor onboarding initiation'],
      importantDecisions: ['CTO approved technical architecture', 'Agreed to initiate procurement review'],
      unresolvedQuestions: ['Detailed migration cutover window during December freeze'],
      nextSteps: ['Deliver redlined MSA to CTO by Friday', 'Schedule legal onboarding kickoff'],
    },
    decisionCriteria: [
      {
        criterion: 'EU data residency and dedicated tenant KMS keys',
        category: 'security',
        importance: 'high',
        evidence: {
          startTime: 12,
          endTime: 28,
          quote: 'Our chief compliance concern is EU data residency and ensuring our encryption keys are tenant-managed.',
          confidence: 0.96,
        },
      },
      {
        criterion: 'VPC peering latency under 12ms',
        category: 'technical',
        importance: 'high',
        evidence: {
          startTime: 28,
          endTime: 45,
          quote: 'VPC peering latency under twelve milliseconds.',
          confidence: 0.97,
        },
      },
      {
        criterion: 'Maximum annual contract ceiling of $150,000',
        category: 'budget',
        importance: 'high',
        evidence: {
          startTime: 45,
          endTime: 62,
          quote: 'We have a budget of one hundred fifty thousand approved for this initiative.',
          confidence: 0.95,
        },
      },
    ],
    buyingSignals: [
      {
        signal: 'CTO confirmed executive budget approval of $150k',
        category: 'pricing',
        evidence: {
          startTime: 45,
          endTime: 62,
          quote: 'We have a budget of one hundred fifty thousand approved for this initiative.',
          confidence: 0.95,
        },
      },
      {
        signal: 'Client requested contract redlines and procurement vendor onboarding',
        category: 'procurement',
        evidence: {
          startTime: 62,
          endTime: 80,
          quote: 'Please send over the redlined MSA agreement by Friday so procurement can begin vendor onboarding.',
          confidence: 0.99,
        },
      },
    ],
    objections: [
      {
        objection: 'Migration schedule conflicts with December change freeze',
        category: 'timeline',
        status: 'addressed',
        evidence: {
          startTime: 12,
          endTime: 28,
          quote: 'Concern is EU data residency and cutover window.',
          confidence: 0.88,
        },
      },
    ],
    risks: [
      {
        risk: 'Vendor onboarding legal review could extend beyond Q4 close date',
        severity: 'medium',
        evidence: {
          startTime: 62,
          endTime: 80,
          quote: 'procurement can begin vendor onboarding.',
          confidence: 0.9,
        },
      },
    ],
    competitors: [
      {
        name: 'Datadog & Snowflake',
        products: ['Snowflake Warehouse'],
        comparisonCriteria: 'Encryption key ownership and multi-region failover',
        advantages: ['Existing vendor contract in place'],
        disadvantages: ['Significantly higher compute egress cost'],
        customerPreference: 'Prefers DealFlow AI dedicated VPC deployment',
        evidence: {
          startTime: 28,
          endTime: 45,
          quote: 'We support AWS KMS customer-managed keys natively',
          confidence: 0.92,
        },
      },
    ],
    dealHealth: {
      totalScore: 92,
      dimensionScores: {
        requirementsClarity: 15,
        budgetClarity: 15,
        timelineClarity: 15,
        decisionMakerIdentified: 15,
        buyingSignals: 20,
        objectionResolution: 10,
        nextStepClarity: 10,
      },
      explanation:
        'Optimal deal velocity. Technical criteria, verified budget ($150k), decision-maker engagement, and explicit MSA redline request are all verified.',
      calculationVersion: '1.0.0',
      calculatedAt: new Date(),
    },
    modelMetadata: {
      transcriptionModel: 'whisper-1',
      analysisModel: 'gpt-4o-mini',
      promptTokens: 1420,
      completionTokens: 680,
      totalTokens: 2100,
    },
    reviewMetadata: {
      reviewStatus: 'verified',
      reviewedAt: new Date(),
    },
  });

  // 9. Seed Action Items for Acme
  await ActionItem.create([
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      dealId: deal1._id,
      assigneeId: repUser._id,
      assignedTo: 'Sarah Chen',
      responsibleParty: 'internal',
      title: 'Deliver revised redlined MSA contract with EU data residency clause to CTO',
      task: 'Deliver revised redlined MSA contract with EU data residency clause to CTO',
      description: 'Coordinate with legal to finalize KMS key appendix and email to David by Friday.',
      contextQuote: 'David (CTO): Please send over the redlined MSA agreement by Friday so procurement can begin vendor onboarding.',
      evidence: {
        startTime: 62,
        endTime: 80,
        quote: 'Please send over the redlined MSA agreement by Friday so procurement can begin vendor onboarding.',
        confidence: 0.99,
      },
      dueDate: new Date(Date.now() + 2 * 86400000),
      priority: 'urgent',
      status: 'pending',
      crmSyncStatus: 'synced',
      crmTaskId: 'SF-TASK-9921',
    },
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      dealId: deal1._id,
      assigneeId: adminUser._id,
      assignedTo: 'Alex Rivera',
      responsibleParty: 'internal',
      title: 'Approve $145k enterprise proposal pricing schedule',
      task: 'Approve $145k enterprise proposal pricing schedule',
      description: 'Sign off on custom tier 1 support and VPC deployment pricing.',
      contextQuote: 'David (CTO): We have a budget of one hundred fifty thousand approved for this initiative.',
      evidence: {
        startTime: 45,
        endTime: 62,
        quote: 'We have a budget of one hundred fifty thousand approved for this initiative.',
        confidence: 0.95,
      },
      dueDate: new Date(Date.now() + 1 * 86400000),
      priority: 'high',
      status: 'in_progress',
      crmSyncStatus: 'not_synced',
    },
    {
      organizationId: acmeOrg._id,
      meetingId: meeting1._id,
      dealId: deal1._id,
      assigneeId: repUser._id,
      assignedTo: 'David (CTO)',
      responsibleParty: 'customer',
      title: 'Provide security architecture questionnaire and vendor portal link',
      task: 'Provide security architecture questionnaire and vendor portal link',
      description: 'Client security team will forward procurement assessment.',
      contextQuote: 'David (CTO): Please send over the redlined MSA agreement by Friday so procurement can begin vendor onboarding.',
      evidence: {
        startTime: 62,
        endTime: 80,
        quote: 'procurement can begin vendor onboarding.',
        confidence: 0.9,
      },
      dueDate: new Date(Date.now() + 4 * 86400000),
      priority: 'medium',
      status: 'pending',
      crmSyncStatus: 'not_synced',
    },
  ]);

  // 10. Seed Audit Log
  await AuditLog.create({
    organizationId: acmeOrg._id,
    userId: adminUser._id,
    userEmail: adminUser.email,
    action: 'ORGANIZATION_INITIALIZED_PHASE2',
    entityType: 'Organization',
    entityId: acmeOrg._id.toString(),
    details: { seedDate: new Date().toISOString() },
  });

  logger.info('✅ Phase 2 Seeding completed successfully!');
  return { acmeOrg, adminUser, repUser, retailOrg, retailAdmin };
};

const runStandaloneSeed = async () => {
  try {
    logger.info('Connecting to MongoDB for seeding...');
    await mongoose.connect(config.mongo.uri);
    logger.info('MongoDB connected.');
    await populateDatabase();
    await mongoose.disconnect();
    logger.info('Seeding disconnect successful.');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding error:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

if (require.main === module) {
  runStandaloneSeed();
}

module.exports = {
  populateDatabase,
};
