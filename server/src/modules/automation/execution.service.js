const AutomationAction = require('../../models/AutomationAction');
const AutomationExecution = require('../../models/AutomationExecution');
const ApprovalHistory = require('../../models/ApprovalHistory');
const { canUserExecute } = require('./automation.policy');
const executeHubspotUpdateDeal = require('./actions/hubspot-update-deal.action');
const executeHubspotCreateNote = require('./actions/hubspot-create-note.action');
const executeJiraCreateIssue = require('./actions/jira-create-issue.action');
const integrationsService = require('../integrations/integrations.service');
const auditService = require('../../services/auditService');
const { emitToOrganization } = require('../../socket/socketServer');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

class ExecutionService {
  /**
   * Safe execution engine with strict approval verification and idempotency protection
   */
  async executeAction({ organizationId, actionId, userId, userRole }) {
    if (!canUserExecute(userRole)) {
      throw new AppError('Only administrators and sales managers can execute external write actions', 403, 'FORBIDDEN_EXECUTION_ROLE');
    }

    const action = await AutomationAction.findOne({ _id: actionId, organizationId });
    if (!action) {
      throw new AppError('Automation action record not found or access denied', 404, 'ACTION_NOT_FOUND');
    }

    // =========================================================================
    // MANDATORY SECURITY CHECKS: Never execute unapproved, rejected or cancelled
    // =========================================================================
    if (action.approvalStatus !== 'approved') {
      throw new AppError(
        `Action execution rejected: Action is not in 'approved' status (Current approval status: '${action.approvalStatus}'). Only approved actions can be executed.`,
        400,
        'ACTION_NOT_APPROVED'
      );
    }

    // Idempotency check: prevent duplicate writes
    if (action.executionStatus === 'completed') {
      logger.info(`[Execution Service] Action ${actionId} already completed execution. Returning existing external record.`);
      return {
        success: true,
        alreadyExecuted: true,
        externalRecordId: action.externalRecordId,
        externalRecordUrl: action.externalRecordUrl,
        action,
      };
    }

    if (action.executionStatus === 'executing') {
      logger.warn(`[Execution Service] Action ${actionId} is currently executing in another process.`);
      return {
        success: true,
        executing: true,
        action,
      };
    }

    // Check integration connection status
    const integration = await integrationsService.getIntegration(organizationId, action.provider);
    if (!integration || integration.connectionStatus !== 'connected') {
      throw new AppError(
        `Integration for '${action.provider}' is disconnected or not configured. Connect ${action.provider} first in Integrations settings.`,
        400,
        'INTEGRATION_NOT_CONNECTED'
      );
    }

    // Generate idempotency key
    action.idempotencyKey = action.idempotencyKey || `exec-${action._id}-v${action.version}-${Date.now()}`;
    action.executionStatus = 'executing';
    await action.save();

    // Create execution log entry
    const executionCount = await AutomationExecution.countDocuments({ organizationId, actionId: action._id });
    const executionRecord = await AutomationExecution.create({
      organizationId,
      actionId: action._id,
      provider: action.provider,
      attemptNumber: executionCount + 1,
      executionStatus: 'in_progress',
      requestReference: action.idempotencyKey,
      startedAt: new Date(),
    });

    emitToOrganization(organizationId, 'automation:execution-started', {
      actionId: action._id.toString(),
      provider: action.provider,
      title: action.title,
    });

    try {
      logger.info(`[Execution Service] Commencing external write for action ${action._id} (${action.actionType}) to provider ${action.provider}...`);

      let result;
      switch (action.actionType) {
        case 'hubspot_update_deal':
          result = await executeHubspotUpdateDeal({ organizationId, action });
          break;

        case 'hubspot_create_note':
          result = await executeHubspotCreateNote({ organizationId, action });
          break;

        case 'jira_create_issue':
        case 'jira_create_task':
          result = await executeJiraCreateIssue({ organizationId, action });
          break;

        default:
          throw new AppError(`Unsupported action type for execution: ${action.actionType}`, 400, 'UNSUPPORTED_ACTION_TYPE');
      }

      // =======================================================================
      // CONFIRMED PROVIDER SUCCESS
      // =======================================================================
      const externalId = String(result.externalRecordId || result.externalRecordKey || '');
      const externalUrl = result.externalRecordUrl || '';

      action.executionStatus = 'completed';
      action.externalRecordId = externalId;
      action.externalRecordUrl = externalUrl;
      action.executedAt = new Date();
      action.executionError = null;
      await action.save();

      // Update execution log
      executionRecord.executionStatus = 'completed';
      executionRecord.externalRecordId = externalId;
      executionRecord.externalRecordUrl = externalUrl;
      executionRecord.responseMetadata = result.responseMetadata || {};
      executionRecord.completedAt = new Date();
      await executionRecord.save();

      // Record in ApprovalHistory
      await ApprovalHistory.create({
        organizationId,
        actionId: action._id,
        userId,
        operation: 'executed',
        previousStatus: 'approved',
        newStatus: 'completed',
        comments: `Executed successfully against ${action.provider}. External ID: ${externalId}`,
        payloadSnapshot: action.proposedPayload,
      });

      // Write immutable AuditLog
      try {
        await auditService.log({
          organizationId,
          userId,
          action: 'ACTION_EXECUTED',
          entityType: 'AutomationAction',
          entityId: action._id,
          metadata: {
            provider: action.provider,
            actionType: action.actionType,
            externalRecordId: externalId,
            externalRecordUrl: externalUrl,
          },
        });
      } catch (auditErr) {
        logger.warn(`Audit log failed for execution: ${auditErr.message}`);
      }

      emitToOrganization(organizationId, 'automation:execution-completed', {
        actionId: action._id.toString(),
        provider: action.provider,
        externalRecordId: externalId,
        externalRecordUrl: externalUrl,
      });

      logger.info(`[Execution Service] Action ${action._id} completed successfully. External record: ${externalId}`);

      return {
        success: true,
        action,
        externalRecordId: externalId,
        externalRecordUrl: externalUrl,
      };
    } catch (execError) {
      logger.error(`[Execution Service Error] Action ${action._id} failed: ${execError.message}`);

      action.executionStatus = 'failed';
      action.executionError = {
        message: execError.message,
        code: execError.code || 'EXECUTION_FAILED',
        timestamp: new Date(),
      };
      await action.save();

      executionRecord.executionStatus = 'failed';
      executionRecord.errorMessage = execError.message;
      executionRecord.errorCode = execError.code || 'PROVIDER_ERROR';
      executionRecord.completedAt = new Date();
      await executionRecord.save();

      emitToOrganization(organizationId, 'automation:execution-failed', {
        actionId: action._id.toString(),
        error: execError.message,
      });

      throw execError;
    }
  }

  /**
   * Retry a previously failed execution
   */
  async retryAction({ organizationId, actionId, userId, userRole }) {
    const action = await AutomationAction.findOne({ _id: actionId, organizationId });
    if (!action) {
      throw new AppError('Action record not found', 404, 'ACTION_NOT_FOUND');
    }

    if (action.executionStatus !== 'failed') {
      throw new AppError('Only failed actions can be retried', 400, 'ACTION_NOT_FAILED');
    }

    action.executionStatus = 'not_started';
    action.approvalStatus = 'approved';
    await action.save();

    return this.executeAction({ organizationId, actionId, userId, userRole });
  }

  /**
   * List execution logs for an action or organization
   */
  async listExecutions({ organizationId, actionId, page = 1, limit = 20 }) {
    const query = { organizationId };
    if (actionId) query.actionId = actionId;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [executions, total] = await Promise.all([
      AutomationExecution.find(query)
        .populate('actionId', 'title actionType provider')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AutomationExecution.countDocuments(query),
    ]);

    return {
      executions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

module.exports = new ExecutionService();
