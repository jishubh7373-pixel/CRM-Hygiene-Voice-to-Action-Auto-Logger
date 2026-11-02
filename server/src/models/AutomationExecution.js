const mongoose = require('mongoose');

const automationExecutionSchema = new mongoose.Schema(
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
      required: [true, 'Action ID is required'],
      index: true,
    },
    provider: {
      type: String,
      required: true,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    executionStatus: {
      type: String,
      enum: ['in_progress', 'completed', 'failed'],
      default: 'in_progress',
      index: true,
    },
    requestReference: {
      type: String,
      default: '',
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
    responseMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errorCode: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

automationExecutionSchema.index({ organizationId: 1, actionId: 1, createdAt: -1 });

module.exports = mongoose.model('AutomationExecution', automationExecutionSchema);
