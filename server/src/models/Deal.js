const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Deal owner is mandatory'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Deal opportunity name is required'],
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, 'Account/Company name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Deal amount is required'],
      min: [0, 'Amount cannot be negative'],
      default: 0,
    },
    stage: {
      type: String,
      enum: ['discovery', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
      default: 'discovery',
      index: true,
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    closeDate: {
      type: Date,
      required: [true, 'Target close date is required'],
      index: true,
    },
    hygieneScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 85,
    },
    hygieneStatus: {
      type: String,
      enum: ['healthy', 'at_risk', 'stale'],
      default: 'healthy',
      index: true,
    },
    riskReasons: [{ type: String }],
    crmDealId: {
      type: String,
      default: null,
    },
    crmSource: {
      type: String,
      enum: ['salesforce', 'hubspot', 'internal'],
      default: 'internal',
    },
    lastActivityDate: {
      type: Date,
      default: Date.now,
    },
    nextActionDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

dealSchema.index({ organizationId: 1, stage: 1 });
dealSchema.index({ organizationId: 1, hygieneStatus: 1 });

module.exports = mongoose.model('Deal', dealSchema);
