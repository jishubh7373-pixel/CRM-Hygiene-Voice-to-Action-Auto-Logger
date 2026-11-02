const mongoose = require('mongoose');

const automationSettingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory'],
      unique: true,
      index: true,
    },
    proposalGenerationEnabled: {
      type: Boolean,
      default: true,
    },
    hubspotProposalsEnabled: {
      type: Boolean,
      default: true,
    },
    jiraProposalsEnabled: {
      type: Boolean,
      default: true,
    },
    defaultJiraProjectKey: {
      type: String,
      default: 'CRM',
      trim: true,
    },
    defaultJiraIssueTypeId: {
      type: String,
      default: '10001',
      trim: true,
    },
    defaultJiraPriority: {
      type: String,
      default: 'Medium',
      trim: true,
    },
    defaultJiraAssigneeId: {
      type: String,
      default: '',
      trim: true,
    },
    maxActionsPerMeeting: {
      type: Number,
      default: 10,
      min: 1,
      max: 50,
    },
    actionExpirationDays: {
      type: Number,
      default: 14,
      min: 1,
      max: 90,
    },
    notificationPreferences: {
      inApp: { type: Boolean, default: true },
      emailAlerts: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AutomationSetting', automationSettingSchema);
