const mongoose = require('mongoose');

const evidenceSubSchema = new mongoose.Schema(
  {
    segmentId: { type: String, default: null },
    startTime: { type: Number, default: null },
    endTime: { type: Number, default: null },
    quote: { type: String, required: true },
    confidence: { type: Number, default: null },
  },
  { _id: false }
);

const meetingInsightSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting ID is mandatory'],
      unique: true,
      index: true,
    },
    summary: {
      executiveSummary: { type: String, default: '' },
      purpose: { type: String, default: '' },
      currentSituation: { type: String, default: '' },
      discussionPoints: [{ type: String }],
      customerExpectations: [{ type: String }],
      importantDecisions: [{ type: String }],
      unresolvedQuestions: [{ type: String }],
      nextSteps: [{ type: String }],
    },
    decisionCriteria: [
      {
        criterion: { type: String, required: true },
        category: {
          type: String,
          enum: ['feature', 'technical', 'budget', 'timeline', 'integration', 'security', 'implementation', 'other'],
          default: 'other',
        },
        importance: {
          type: String,
          enum: ['high', 'medium', 'low'],
          default: 'medium',
        },
        evidence: evidenceSubSchema,
      },
    ],
    buyingSignals: [
      {
        signal: { type: String, required: true },
        category: { type: String, default: 'general' },
        evidence: evidenceSubSchema,
      },
    ],
    objections: [
      {
        objection: { type: String, required: true },
        category: { type: String, default: 'general' },
        status: { type: String, enum: ['unresolved', 'addressed'], default: 'unresolved' },
        evidence: evidenceSubSchema,
      },
    ],
    risks: [
      {
        risk: { type: String, required: true },
        severity: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        evidence: evidenceSubSchema,
      },
    ],
    competitors: [
      {
        name: { type: String, required: true },
        products: [{ type: String }],
        comparisonCriteria: { type: String, default: '' },
        advantages: [{ type: String }],
        disadvantages: [{ type: String }],
        customerPreference: { type: String, default: '' },
        evidence: evidenceSubSchema,
      },
    ],
    actionItems: [
      {
        title: { type: String, required: true },
        description: { type: String, default: '' },
        assignedTo: { type: String, default: null },
        responsibleParty: { type: String, enum: ['customer', 'internal', 'unknown'], default: 'internal' },
        dueDate: { type: Date, default: null },
        priority: { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
        evidence: evidenceSubSchema,
      },
    ],
    dealHealth: {
      totalScore: { type: Number, default: 0, min: 0, max: 100 },
      score: { type: Number, default: 0, min: 0, max: 100 },
      rating: { type: String, default: 'uncalculated' },
      dimensionScores: {
        requirementsClarity: { type: Number, default: 0, max: 15 },
        budgetClarity: { type: Number, default: 0, max: 15 },
        timelineClarity: { type: Number, default: 0, max: 15 },
        decisionMakerIdentified: { type: Number, default: 0, max: 15 },
        buyingSignals: { type: Number, default: 0, max: 20 },
        objectionResolution: { type: Number, default: 0, max: 10 },
        nextStepClarity: { type: Number, default: 0, max: 10 },
      },
      dimensions: { type: mongoose.Schema.Types.Mixed, default: {} },
      explanation: { type: String, default: '' },
      calculationVersion: { type: String, default: '1.0.0' },
      calculatedAt: { type: Date, default: Date.now },
    },
    modelMetadata: {
      transcriptionModel: { type: String, default: '' },
      analysisModel: { type: String, default: '' },
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    promptVersion: { type: String, default: 'v2.0' },
    analysisVersion: { type: String, default: 'v2.0' },
    reviewMetadata: {
      isReviewed: {
        type: Boolean,
        default: false,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewStatus: {
        type: String,
        enum: ['unreviewed', 'in_review', 'verified'],
        default: 'unreviewed',
      },
    },
  },
  {
    timestamps: true,
  }
);

meetingInsightSchema.index({ organizationId: 1, meetingId: 1 });

module.exports = mongoose.model('MeetingInsight', meetingInsightSchema);
