const mongoose = require('mongoose');

const evidenceSubSchema = new mongoose.Schema(
  {
    segmentId: { type: String, default: null },
    startTime: { type: Number, default: null },
    endTime: { type: Number, default: null },
    quote: { type: String, default: '' },
    confidence: { type: Number, default: null },
  },
  { _id: false }
);

const actionItemSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
      index: true,
    },
    title: {
      type: String,
      trim: true,
    },
    task: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    assignedTo: {
      type: String,
      default: null,
      trim: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    responsibleParty: {
      type: String,
      enum: ['customer', 'internal', 'unknown'],
      default: 'internal',
    },
    contextQuote: {
      type: String,
      default: '',
    },
    evidence: evidenceSubSchema,
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'dismissed'],
      default: 'pending',
      index: true,
    },
    crmSyncStatus: {
      type: String,
      enum: ['not_synced', 'synced', 'failed'],
      default: 'not_synced',
    },
    crmTaskId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

actionItemSchema.pre('save', function (next) {
  if (this.title && !this.task) {
    this.task = this.title;
  } else if (this.task && !this.title) {
    this.title = this.task;
  }
  if (!this.title && !this.task) {
    this.title = 'Untitled Action Item';
    this.task = 'Untitled Action Item';
  }
  if (this.evidence && this.evidence.quote && !this.contextQuote) {
    this.contextQuote = this.evidence.quote;
  }
  next();
});

actionItemSchema.index({ organizationId: 1, status: 1, dueDate: 1 });
actionItemSchema.index({ organizationId: 1, meetingId: 1 });

module.exports = mongoose.model('ActionItem', actionItemSchema);
