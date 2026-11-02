const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
      required: [true, 'Meeting title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    clientName: {
      type: String,
      default: 'Client Meeting',
      trim: true,
    },
    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    meetingDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    scheduledStartTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      enum: ['audio_upload', 'zoom', 'gong', 'google_meet', 'teams', 'upload', 'phone'],
      default: 'audio_upload',
    },
    platform: {
      type: String,
      enum: ['audio_upload', 'zoom', 'gong', 'google_meet', 'teams', 'upload', 'phone'],
      default: 'audio_upload',
    },
    externalProvider: {
      type: String,
      enum: ['zoom', 'gong', 'hubspot', 'jira', null],
      default: null,
      index: true,
    },
    externalMeetingId: {
      type: String,
      default: null,
      index: true,
    },
    externalCallId: {
      type: String,
      default: null,
      index: true,
    },
    externalAccountId: {
      type: String,
      default: null,
    },
    importedAt: {
      type: Date,
      default: null,
    },
    sourceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ingestionStatus: {
      type: String,
      enum: ['received', 'processing', 'completed', 'failed'],
      default: 'completed',
    },
    duration: {
      type: Number,
      default: 0, // duration in seconds
    },
    durationMinutes: {
      type: Number,
      default: 30,
    },
    audioStorage: {
      stored: {
        type: Boolean,
        default: false,
      },
      provider: {
        type: String,
        enum: ['local', 's3'],
        default: 'local',
      },
      storageProvider: {
        type: String,
        enum: ['local', 's3'],
        default: 'local',
      },
      key: {
        type: String,
        default: '',
      },
      storageKey: {
        type: String,
        default: '',
      },
      originalName: {
        type: String,
        default: '',
      },
      originalFileName: {
        type: String,
        default: '',
      },
      mimeType: {
        type: String,
        default: '',
      },
      sizeBytes: {
        type: Number,
        default: 0,
      },
      fileSize: {
        type: Number,
        default: 0,
      },
      durationSeconds: {
        type: Number,
        default: 0,
      },
      localPath: {
        type: String,
        default: '',
      },
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'uploading', 'transcribing', 'analyzing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    transcriptionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'processing', 'completed', 'failed'],
      default: 'completed',
      index: true,
    },
    errorDetails: {
      stage: { type: String, default: null },
      message: { type: String, default: null },
      timestamp: { type: Date, default: null },
    },
    audioUrl: {
      type: String,
      default: '',
    },
    summary: {
      overview: { type: String, default: '' },
      sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'positive' },
      keyPoints: [{ type: String }],
      objections: [{ type: String }],
      nextSteps: [{ type: String }],
    },
    rawTranscript: {
      type: String,
      default: '',
    },
    crmSyncStatus: {
      type: String,
      enum: ['not_synced', 'pending', 'synced', 'sync_failed'],
      default: 'not_synced',
    },
    crmSyncedAt: {
      type: Date,
    },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure uploadedBy and hostId sync
meetingSchema.pre('save', function (next) {
  if (this.uploadedBy && !this.hostId) {
    this.hostId = this.uploadedBy;
  } else if (this.hostId && !this.uploadedBy) {
    this.uploadedBy = this.hostId;
  }
  if (this.meetingDate && !this.scheduledStartTime) {
    this.scheduledStartTime = this.meetingDate;
  } else if (this.scheduledStartTime && !this.meetingDate) {
    this.meetingDate = this.scheduledStartTime;
  }
  if (this.source && !this.platform) {
    this.platform = this.source;
  }
  next();
});

meetingSchema.index({ organizationId: 1, meetingDate: -1 });
meetingSchema.index({ organizationId: 1, processingStatus: 1 });
meetingSchema.index({ organizationId: 1, clientName: 'text', title: 'text' });
meetingSchema.index(
  { organizationId: 1, externalProvider: 1, externalMeetingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalMeetingId: { $type: 'string' },
    },
  }
);
meetingSchema.index(
  { organizationId: 1, externalProvider: 1, externalCallId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalCallId: { $type: 'string' },
    },
  }
);

module.exports = mongoose.model('Meeting', meetingSchema);
