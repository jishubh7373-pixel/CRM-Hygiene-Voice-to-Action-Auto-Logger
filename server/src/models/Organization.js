const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    domain: {
      type: String,
      required: [true, 'Corporate domain is required'],
      lowercase: true,
      trim: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      default: 'professional',
    },
    settings: {
      crmType: {
        type: String,
        enum: ['salesforce', 'hubspot', 'none'],
        default: 'none',
      },
      autoLogEnabled: {
        type: Boolean,
        default: true,
      },
      hygieneSensitivity: {
        type: String,
        enum: ['standard', 'strict'],
        default: 'standard',
      },
      dataRetentionDays: {
        type: Number,
        default: 90,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Organization', organizationSchema);
