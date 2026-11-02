const AutomationSetting = require('../../models/AutomationSetting');
const actionGenerator = require('./action-generator.service');
const approvalService = require('./approval.service');
const executionService = require('./execution.service');
const auditService = require('../../services/auditService');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

class AutomationService {
  /**
   * Get organization automation settings
   */
  async getSettings(organizationId) {
    let settings = await AutomationSetting.findOne({ organizationId }).lean();
    if (!settings) {
      settings = await AutomationSetting.create({ organizationId });
    }
    return settings;
  }

  /**
   * Update organization automation settings
   */
  async updateSettings(organizationId, updates, userId = null) {
    const allowedFields = [
      'proposalGenerationEnabled',
      'hubspotProposalsEnabled',
      'jiraProposalsEnabled',
      'defaultJiraProjectKey',
      'defaultJiraIssueTypeId',
      'defaultJiraPriority',
      'defaultJiraAssigneeId',
      'maxActionsPerMeeting',
      'actionExpirationDays',
      'notificationPreferences',
    ];

    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    const updated = await AutomationSetting.findOneAndUpdate(
      { organizationId },
      { $set: safeUpdates },
      { new: true, upsert: true, runValidators: true }
    );

    try {
      await auditService.log({
        organizationId,
        userId,
        action: 'AUTOMATION_SETTINGS_UPDATED',
        entityType: 'AutomationSetting',
        entityId: updated._id,
        metadata: safeUpdates,
      });
    } catch (auditErr) {
      logger.warn(`Audit log failed for settings update: ${auditErr.message}`);
    }

    return updated;
  }

  // Delegated generator methods
  async generateActionsForMeeting(params) {
    return actionGenerator.generateActionsForMeeting(params);
  }

  // Delegated approval methods
  async listActions(params) {
    return approvalService.listActions(params);
  }

  async getActionById(params) {
    return approvalService.getActionById(params);
  }

  async approveAction(params) {
    return approvalService.approveAction(params);
  }

  async rejectAction(params) {
    return approvalService.rejectAction(params);
  }

  async editAction(params) {
    return approvalService.editAction(params);
  }

  async cancelAction(params) {
    return approvalService.cancelAction(params);
  }

  async getActionHistory(params) {
    return approvalService.getActionHistory(params);
  }

  // Delegated execution methods
  async executeAction(params) {
    return executionService.executeAction(params);
  }

  async retryAction(params) {
    return executionService.retryAction(params);
  }

  async listExecutions(params) {
    return executionService.listExecutions(params);
  }
}

module.exports = new AutomationService();
