/**
 * DealFlow AI — Data Privacy & Retention Policy Service
 * Manages configurable retention limits, data export (GDPR takeout), and secure deletion workflows
 */
const Meeting = require('../../models/Meeting');
const TranscriptSegment = require('../../models/TranscriptSegment');
const MeetingInsight = require('../../models/MeetingInsight');
const ActionItem = require('../../models/ActionItem');
const Deal = require('../../models/Deal');
const AuditLog = require('../../models/AuditLog');
const storageService = require('../storage/storage.service');
const { recordAudit } = require('../../services/auditService');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

// Default tenant data retention policy
const DEFAULT_RETENTION = {
  audioRetentionDays: 90, // 0 = indefinite
  transcriptRetentionDays: 365,
  insightsRetentionDays: 730,
  autoPurgeEnabled: false,
};

const retentionStore = new Map();

/**
 * Get tenant retention settings
 */
const getRetentionSettings = async (organizationId) => {
  return retentionStore.get(organizationId.toString()) || { ...DEFAULT_RETENTION, organizationId };
};

/**
 * Update tenant retention settings
 */
const updateRetentionSettings = async ({ organizationId, settings, updatedBy }) => {
  const current = await getRetentionSettings(organizationId);
  const updated = {
    ...current,
    audioRetentionDays: settings.audioRetentionDays !== undefined ? settings.audioRetentionDays : current.audioRetentionDays,
    transcriptRetentionDays: settings.transcriptRetentionDays !== undefined ? settings.transcriptRetentionDays : current.transcriptRetentionDays,
    insightsRetentionDays: settings.insightsRetentionDays !== undefined ? settings.insightsRetentionDays : current.insightsRetentionDays,
    autoPurgeEnabled: settings.autoPurgeEnabled !== undefined ? Boolean(settings.autoPurgeEnabled) : current.autoPurgeEnabled,
    updatedAt: new Date(),
  };

  retentionStore.set(organizationId.toString(), updated);

  await recordAudit({
    organizationId,
    userId: updatedBy._id,
    userEmail: updatedBy.email,
    action: 'DATA_RETENTION_POLICY_UPDATED',
    entityType: 'Organization',
    entityId: organizationId.toString(),
    details: updated,
  });

  return updated;
};

/**
 * Compile complete tenant data archive for GDPR / Compliance Data Takeout
 */
const exportOrganizationData = async ({ organizationId, requestedBy }) => {
  logger.info(`[Privacy] Generating full data export for organization ${organizationId} requested by ${requestedBy.email}`);

  const [meetings, insights, deals, actions, logs] = await Promise.all([
    Meeting.find({ organizationId }).select('-__v').lean(),
    MeetingInsight.find({ organizationId }).select('-__v').lean(),
    Deal.find({ organizationId }).select('-__v').lean(),
    ActionItem.find({ organizationId }).select('-__v').lean(),
    AuditLog.find({ organizationId }).select('-__v').sort({ createdAt: -1 }).limit(1000).lean(),
  ]);

  await recordAudit({
    organizationId,
    userId: requestedBy._id,
    userEmail: requestedBy.email,
    action: 'DATA_TAKEOUT_EXPORTED',
    entityType: 'Organization',
    entityId: organizationId.toString(),
    details: {
      meetingCount: meetings.length,
      dealCount: deals.length,
      actionCount: actions.length,
    },
  });

  return {
    exportMetadata: {
      organizationId,
      exportedAt: new Date().toISOString(),
      requestedBy: requestedBy.email,
      platform: 'DealFlow AI',
      version: '1.0.0',
    },
    data: {
      meetings,
      insights,
      deals,
      actions,
      auditLogs: logs,
    },
  };
};

/**
 * Execute retention purge for audio recordings exceeding the retention threshold
 */
const purgeExpiredAudio = async ({ organizationId, performedBy }) => {
  const policy = await getRetentionSettings(organizationId);

  if (!policy.audioRetentionDays || policy.audioRetentionDays <= 0) {
    return { purgedCount: 0, message: 'Audio retention is set to indefinite; no files purged.' };
  }

  const cutoffDate = new Date(Date.now() - (policy.audioRetentionDays * 24 * 60 * 60 * 1000));
  const expiredMeetings = await Meeting.find({
    organizationId,
    createdAt: { $lt: cutoffDate },
    'audioStorage.key': { $exists: true, $ne: null },
  });

  let purgedCount = 0;
  for (const meeting of expiredMeetings) {
    if (meeting.audioStorage?.key) {
      try {
        await storageService.deleteAudio(meeting.audioStorage.key);
        meeting.audioStorage.key = null;
        meeting.audioStorage.purgedAt = new Date();
        await meeting.save();
        purgedCount++;
      } catch (err) {
        logger.warn(`Could not purge audio for meeting ${meeting._id}: ${err.message}`);
      }
    }
  }

  if (purgedCount > 0) {
    await recordAudit({
      organizationId,
      userId: performedBy._id,
      userEmail: performedBy.email,
      action: 'EXPIRED_AUDIO_PURGED',
      entityType: 'Organization',
      entityId: organizationId.toString(),
      details: { purgedCount, cutoffDate },
    });
  }

  return {
    purgedCount,
    cutoffDate,
    message: `Successfully purged ${purgedCount} expired audio files older than ${policy.audioRetentionDays} days.`,
  };
};

module.exports = {
  DEFAULT_RETENTION,
  getRetentionSettings,
  updateRetentionSettings,
  exportOrganizationData,
  purgeExpiredAudio,
};
