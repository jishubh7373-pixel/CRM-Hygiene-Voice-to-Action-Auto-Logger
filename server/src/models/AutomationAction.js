const mongoose = require('mongoose');

const automationActionSchema = new mongoose.Schema(
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
      required: [true, 'Meeting reference is required'],
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
      index: true,
    },
    provider: {
      type: String,
      enum: ['hubspot', 'jira', 'salesforce', 'slack'],
      required: [true, 'Integration provider is required'],
      index: true,
    },
    actionType: {
      type: String,
      enum: [
        'hubspot_update_deal',
        'hubspot_create_note',
        'hubspot_create_task',
        'jira_create_issue',
        'jira_create_task',
      ],
      required: [true, 'Action type is required'],
      index: true,
    },
    targetRecordId: {
      type: String,
      default: '',
      trim: true,
    },
    targetRecordName: {
      type: String,
      default: '',
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Action title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    proposedPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Proposed payload is required'],
    },
    originalPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    evidence: {
      quote: { type: String, default: '', trim: true },
      speaker: { type: String, default: 'Speaker', trim: true },
      startTime: { type: Number, default: 0 },
      endTime: { type: Number, default: 0 },
      transcriptSegmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TranscriptSegment',
        default: null,
      },
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    approvalStatus: {
      type: String,
      enum: ['proposed', 'pending_approval', 'approved', 'rejected', 'cancelled', 'needs_review'],
      default: 'pending_approval',
      index: true,
    },
    executionStatus: {
      type: String,
      enum: ['not_started', 'queued', 'executing', 'completed', 'failed'],
      default: 'not_started',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    executedAt: {
      type: Date,
      default: null,
    },
    externalRecordId: {
      type: String,
      default: '',
      trim: true,
    },
    externalRecordUrl: {
      type: String,
      default: '',
      trim: true,
    },
    executionError: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high performance filtering and tenant isolation
automationActionSchema.index({ organizationId: 1, approvalStatus: 1, createdAt: -1 });
automationActionSchema.index({ organizationId: 1, provider: 1 });
automationActionSchema.index({ organizationId: 1, meetingId: 1 });
automationActionSchema.index({ organizationId: 1, dealId: 1 });

module.exports = mongoose.model('AutomationAction', automationActionSchema);
