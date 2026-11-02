const mongoose = require('mongoose');

const approvalHistorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    actionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutomationAction',
      required: [true, 'Automation action reference is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Acting user reference is required'],
      index: true,
    },
    operation: {
      type: String,
      enum: ['created', 'approved', 'rejected', 'edited', 'cancelled', 'reset', 'needs_review', 'executed'],
      required: true,
    },
    previousStatus: {
      type: String,
      default: '',
    },
    newStatus: {
      type: String,
      default: '',
    },
    comments: {
      type: String,
      default: '',
      trim: true,
    },
    payloadSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

approvalHistorySchema.index({ organizationId: 1, actionId: 1, timestamp: -1 });

module.exports = mongoose.model('ApprovalHistory', approvalHistorySchema);
