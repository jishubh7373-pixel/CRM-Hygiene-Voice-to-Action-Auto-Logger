const ActionItem = require('../models/ActionItem');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { recordAudit } = require('../services/auditService');

const list = async (req, res, next) => {
  try {
    const { status, priority, assigneeId, meetingId, dealId } = req.query;
    const query = { organizationId: req.organizationId };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assigneeId) query.assigneeId = assigneeId;
    if (meetingId) query.meetingId = meetingId;
    if (dealId) query.dealId = dealId;

    const actionItems = await ActionItem.find(query)
      .populate('assigneeId', 'name email')
      .populate('dealId', 'name accountName stage')
      .populate('meetingId', 'title clientName scheduledStartTime')
      .sort({ dueDate: 1 })
      .lean();

    return ApiResponse.success(res, actionItems);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { title, task, description, contextQuote, dueDate, priority, dealId, meetingId, assigneeId, assignedTo, responsibleParty } = req.body;

    const actionItem = await ActionItem.create({
      organizationId: req.organizationId,
      assigneeId: assigneeId || req.user._id,
      assignedTo: assignedTo || null,
      responsibleParty: responsibleParty || 'internal',
      title: title || task,
      task: task || title,
      description: description || '',
      contextQuote: contextQuote || '',
      dueDate: dueDate || new Date(Date.now() + 3 * 86400000),
      priority: priority || 'medium',
      dealId: dealId || null,
      meetingId: meetingId || null,
    });

    await recordAudit({
      organizationId: req.organizationId,
      userId: req.user._id,
      userEmail: req.user.email,
      action: 'ACTION_ITEM_CREATED',
      entityType: 'ActionItem',
      entityId: actionItem._id.toString(),
      details: { title: actionItem.title, priority: actionItem.priority, dueDate: actionItem.dueDate },
    });

    return ApiResponse.created(res, actionItem, 'Action item created.');
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { title, task, description, assignedTo, responsibleParty, dueDate, priority, status, crmSyncStatus } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (task !== undefined) updateData.task = task;
    if (description !== undefined) updateData.description = description;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (responsibleParty !== undefined) updateData.responsibleParty = responsibleParty;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (crmSyncStatus !== undefined) updateData.crmSyncStatus = crmSyncStatus;

    const actionItem = await ActionItem.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!actionItem) {
      throw new AppError('Action item not found or unauthorized.', 404, 'NOT_FOUND');
    }

    await recordAudit({
      organizationId: req.organizationId,
      userId: req.user._id,
      userEmail: req.user.email,
      action: 'ACTION_ITEM_UPDATED',
      entityType: 'ActionItem',
      entityId: req.params.id,
      details: updateData,
    });

    return ApiResponse.success(res, actionItem, 'Action item updated.');
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const actionItem = await ActionItem.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!actionItem) {
      throw new AppError('Action item not found or unauthorized.', 404, 'NOT_FOUND');
    }

    return ApiResponse.success(res, null, 'Action item dismissed.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  update,
  remove,
};
