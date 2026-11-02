const AutomationAction = require('../../models/AutomationAction');
const ApprovalHistory = require('../../models/ApprovalHistory');
const { canTransition, canUserApprove } = require('./automation.policy');
const actionValidator = require('./action-validator.service');
const auditService = require('../../services/auditService');
const { emitToOrganization } = require('../../socket/socketServer');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

class ApprovalService {
  /**
   * List actions with filtering, search, and pagination
   */
  async listActions({
    organizationId,
    approvalStatus,
    executionStatus,
    provider,
    riskLevel,
    confidence,
    dealId,
    meetingId,
    search,
    page = 1,
    limit = 20,
  }) {
    if (!organizationId) {
      throw new AppError('Organization ID is required', 400, 'ORG_ID_REQUIRED');
    }

    const query = { organizationId };

    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (executionStatus) query.executionStatus = executionStatus;
    if (provider) query.provider = provider;
    if (riskLevel) query.riskLevel = riskLevel;
    if (confidence) query.confidence = confidence;
    if (dealId) query.dealId = dealId;
    if (meetingId) query.meetingId = meetingId;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { targetRecordName: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [actions, total] = await Promise.all([
      AutomationAction.find(query)
        .populate('meetingId', 'title meetingDate source')
        .populate('dealId', 'name stage amount')
        .populate('approvedBy', 'name email role')
        .populate('rejectedBy', 'name email role')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AutomationAction.countDocuments(query),
    ]);

    // Compute status counts for summary header badges
    const [pendingCount, approvedCount, completedCount, failedCount] = await Promise.all([
      AutomationAction.countDocuments({ organizationId, approvalStatus: 'pending_approval' }),
      AutomationAction.countDocuments({ organizationId, approvalStatus: 'approved', executionStatus: { $ne: 'completed' } }),
      AutomationAction.countDocuments({ organizationId, executionStatus: 'completed' }),
      AutomationAction.countDocuments({ organizationId, executionStatus: 'failed' }),
    ]);

    return {
      actions,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        completed: completedCount,
        failed: failedCount,
        total,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get single action with details
   */
  async getActionById({ organizationId, actionId }) {
    const action = await AutomationAction.findOne({ _id: actionId, organizationId })
      .populate('meetingId', 'title meetingDate source duration clientName')
      .populate('dealId', 'name stage amount hygieneScore')
      .populate('approvedBy', 'name email role')
      .populate('rejectedBy', 'name email role')
      .populate('editedBy', 'name email role')
      .lean();

    if (!action) {
      throw new AppError('Automation action not found or unauthorized', 404, 'ACTION_NOT_FOUND');
    }

    return action;
  }

  /**
   * Approve an action for execution
   */
  async approveAction({ organizationId, actionId, userId, userRole, comments = '' }) {
    if (!canUserApprove(userRole)) {
      throw new AppError('Only administrators and sales managers can approve external actions', 403, 'FORBIDDEN_APPROVAL_ROLE');
    }

    const action = await AutomationAction.findOne({ _id: actionId, organizationId });
    if (!action) {
      throw new AppError('Action record not found or access denied', 404, 'ACTION_NOT_FOUND');
    }

    if (!canTransition(action.approvalStatus, 'approved')) {
      throw new AppError(
        `Cannot approve action with current status "${action.approvalStatus}"`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const previousStatus = action.approvalStatus;
    action.approvalStatus = 'approved';
    action.approvedBy = userId;
    action.approvedAt = new Date();
    action.rejectedBy = null;
    action.rejectedAt = null;
    action.rejectionReason = '';
    await action.save();

    // Record lifecycle in ApprovalHistory
    await ApprovalHistory.create({
      organizationId,
      actionId: action._id,
      userId,
      operation: 'approved',
      previousStatus,
      newStatus: 'approved',
      comments: comments || 'Approved by user.',
      payloadSnapshot: action.proposedPayload,
    });

    // Record immutable audit log
    try {
      await auditService.log({
        organizationId,
        userId,
        action: 'ACTION_APPROVED',
        entityType: 'AutomationAction',
        entityId: action._id,
        metadata: {
          actionType: action.actionType,
          provider: action.provider,
          title: action.title,
          riskLevel: action.riskLevel,
        },
      });
    } catch (auditErr) {
      logger.warn(`Audit log failed for approval: ${auditErr.message}`);
    }

    emitToOrganization(organizationId, 'automation:action-approved', {
      actionId: action._id.toString(),
      approvedBy: userId.toString(),
      title: action.title,
    });

    logger.info(`[Approval Service] Action ${actionId} approved by user ${userId} (org: ${organizationId})`);
    return action;
  }

  /**
   * Reject an action proposal
   */
  async rejectAction({ organizationId, actionId, userId, userRole, reason = '' }) {
    if (!canUserApprove(userRole)) {
      throw new AppError('Only administrators and sales managers can reject actions', 403, 'FORBIDDEN_ROLE');
    }

    const action = await AutomationAction.findOne({ _id: actionId, organizationId });
    if (!action) {
      throw new AppError('Action not found', 404, 'ACTION_NOT_FOUND');
    }

    if (!canTransition(action.approvalStatus, 'rejected')) {
      throw new AppError(`Cannot transition status from ${action.approvalStatus} to rejected`, 400, 'INVALID_TRANSITION');
    }

    const previousStatus = action.approvalStatus;
    action.approvalStatus = 'rejected';
    action.rejectedBy = userId;
    action.rejectedAt = new Date();
    action.rejectionReason = reason || 'Rejected by human reviewer';
    await action.save();

    await ApprovalHistory.create({
      organizationId,
      actionId: action._id,
      userId,
      operation: 'rejected',
      previousStatus,
      newStatus: 'rejected',
      comments: reason || 'Rejected by human reviewer',
      payloadSnapshot: action.proposedPayload,
    });

    emitToOrganization(organizationId, 'automation:action-rejected', {
      actionId: action._id.toString(),
      rejectedBy: userId.toString(),
      reason: action.rejectionReason,
    });

    return action;
  }

  /**
   * Edit proposed action payload
   * CRITICAL SECURITY RULE: Material edits to an already approved action reset approval status to pending_approval!
   */
  async editAction({ organizationId, actionId, userId, updates = {}, comments = '' }) {
    const action = await AutomationAction.findOne({ _id: actionId, organizationId });
    if (!action) {
      throw new AppError('Action not found', 404, 'ACTION_NOT_FOUND');
    }

    if (['completed', 'executing'].includes(action.executionStatus)) {
      throw new AppError('Cannot edit an action that is currently executing or already completed', 400, 'ACTION_IMMUTABLE');
    }

    // Prepare updated payload
    const newPayload = { ...action.proposedPayload, ...(updates.proposedPayload || updates) };

    // Validate payload against schema rules
    actionValidator.validatePayload(action.actionType, newPayload);

    const previousStatus = action.approvalStatus;
    let newStatus = action.approvalStatus;

    // Invalidate approval upon edit
    if (action.approvalStatus === 'approved') {
      newStatus = 'pending_approval';
      action.approvedBy = null;
      action.approvedAt = null;
      logger.info(`[Approval Service] Action ${actionId} was previously approved. Modification invalidated approval; resetting to pending_approval.`);
    }

    action.proposedPayload = newPayload;
    if (updates.title) action.title = updates.title;
    if (updates.description !== undefined) action.description = updates.description;
    action.approvalStatus = newStatus;
    action.editedBy = userId;
    action.editedAt = new Date();
    action.version = (action.version || 1) + 1;
    await action.save();

    await ApprovalHistory.create({
      organizationId,
      actionId: action._id,
      userId,
      operation: 'edited',
      previousStatus,
      newStatus,
      comments: comments || 'Action payload edited by user.',
      payloadSnapshot: newPayload,
    });

    emitToOrganization(organizationId, 'automation:action-needs-review', {
      actionId: action._id.toString(),
      version: action.version,
      status: newStatus,
    });

    return action;
  }

  /**
   * Retrieve immutable lifecycle timeline
   */
  async getActionHistory({ organizationId, actionId }) {
    const history = await ApprovalHistory.find({ organizationId, actionId })
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .lean();

    return history;
  }

  /**
   * Cancel an action
   */
  async cancelAction({ organizationId, actionId, userId, reason = '' }) {
    const action = await AutomationAction.findOne({ _id: actionId, organizationId });
    if (!action) {
      throw new AppError('Action not found', 404, 'ACTION_NOT_FOUND');
    }

    if (action.executionStatus === 'completed') {
      throw new AppError('Cannot cancel completed external action', 400, 'ACTION_ALREADY_COMPLETED');
    }

    const previousStatus = action.approvalStatus;
    action.approvalStatus = 'cancelled';
    await action.save();

    await ApprovalHistory.create({
      organizationId,
      actionId: action._id,
      userId,
      operation: 'cancelled',
      previousStatus,
      newStatus: 'cancelled',
      comments: reason || 'Cancelled by user',
    });

    return action;
  }
}

module.exports = new ApprovalService();
