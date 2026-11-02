const mongoose = require('mongoose');

const dealMappingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    internalDealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      required: [true, 'Internal Deal ID is mandatory'],
      index: true,
    },
    provider: {
      type: String,
      enum: ['hubspot', 'salesforce'],
      required: [true, 'Integration provider is required'],
    },
    externalDealId: {
      type: String,
      required: [true, 'External Deal ID is required'],
      trim: true,
      index: true,
    },
    externalRecordUrl: {
      type: String,
      default: '',
      trim: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'error'],
      default: 'synced',
    },
    syncDirection: {
      type: String,
      enum: ['bidirectional', 'inbound_only', 'outbound_only'],
      default: 'inbound_only',
    },
    fieldMappingVersion: {
      type: Number,
      default: 1,
    },
    rawProperties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate mappings of the same external deal within an organization
dealMappingSchema.index({ organizationId: 1, provider: 1, externalDealId: 1 }, { unique: true });
dealMappingSchema.index({ organizationId: 1, internalDealId: 1 });

module.exports = mongoose.model('DealMapping', dealMappingSchema);
