const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    provider: {
      type: String,
      enum: ['zoom', 'gong', 'hubspot', 'jira', 'salesforce', 'slack', 'google_meet'],
      required: [true, 'Integration provider is required'],
    },
    connectionStatus: {
      type: String,
      enum: ['disconnected', 'connected', 'error', 'pending_auth'],
      default: 'disconnected',
      index: true,
    },
    status: {
      type: String,
      enum: ['disconnected', 'connected', 'error', 'pending_auth'],
      default: 'disconnected',
    },
    externalAccountId: {
      type: String,
      default: '',
      trim: true,
    },
    externalAccountName: {
      type: String,
      default: '',
      trim: true,
    },
    encryptedCredentials: {
      ciphertext: { type: String, default: '' },
      iv: { type: String, default: '' },
      authTag: { type: String, default: '' },
    },
    grantedScopes: {
      type: [String],
      default: [],
    },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    credentialsConfigured: {
      type: Boolean,
      default: false,
    },
    authType: {
      type: String,
      enum: ['oauth2', 'api_key', 'webhook', 'basic'],
      default: 'oauth2',
    },
    config: {
      instanceUrl: { type: String, default: '' },
      clientId: { type: String, default: '' },
      hasSecret: { type: Boolean, default: false },
      webhookSecret: { type: String, default: '' },
      syncIntervalMinutes: { type: Number, default: 15 },
      autoSyncTasks: { type: Boolean, default: true },
      autoUpdateStages: { type: Boolean, default: false },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    healthStatus: {
      status: {
        type: String,
        enum: ['healthy', 'degraded', 'failing', 'unknown'],
        default: 'unknown',
      },
      lastCheckAt: { type: Date, default: null },
      latencyMs: { type: Number, default: 0 },
      message: { type: String, default: '' },
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastError: {
      message: { type: String, default: '' },
      code: { type: String, default: '' },
      timestamp: { type: Date, default: null },
    },
    lastErrorMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to synchronize connectionStatus and status, and lastError
integrationSchema.pre('save', function (next) {
  if (this.isModified('connectionStatus') && !this.isModified('status')) {
    this.status = this.connectionStatus;
  } else if (this.isModified('status') && !this.isModified('connectionStatus')) {
    this.connectionStatus = this.status;
  }

  if (this.lastError && this.lastError.message) {
    this.lastErrorMessage = this.lastError.message;
  }
  next();
});

integrationSchema.index({ organizationId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('Integration', integrationSchema);
