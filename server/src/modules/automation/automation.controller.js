const automationService = require('./automation.service');
const ApiResponse = require('../../utils/apiResponse');
const AppError = require('../../utils/appError');

const listActions = async (req, res, next) => {
  try {
    const {
      approvalStatus,
      executionStatus,
      provider,
      riskLevel,
      confidence,
      dealId,
      meetingId,
      search,
      page,
      limit,
    } = req.query;

    const result = await automationService.listActions({
      organizationId: req.organizationId,
      approvalStatus,
      executionStatus,
      provider,
      riskLevel,
      confidence,
      dealId,
      meetingId,
      search,
      page,
      limit,
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

const getActionById = async (req, res, next) => {
  try {
    const action = await automationService.getActionById({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
    });
    return ApiResponse.success(res, action);
  } catch (error) {
    next(error);
  }
};

const generateActions = async (req, res, next) => {
  try {
    const { meetingId } = req.body;
    if (!meetingId) {
      throw new AppError('Meeting ID is required to generate action proposals', 400, 'PARAM_REQUIRED');
    }

    const result = await automationService.generateActionsForMeeting({
      meetingId,
      organizationId: req.organizationId,
      userId: req.user._id,
    });

    return ApiResponse.created(res, result, `Generated ${result.generatedCount} action proposals.`);
  } catch (error) {
    next(error);
  }
};

const approveAction = async (req, res, next) => {
  try {
    const { comments } = req.body;
    const action = await automationService.approveAction({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
      userId: req.user._id,
      userRole: req.user.role,
      comments,
    });

    return ApiResponse.success(res, action, 'Action approved successfully. Ready for execution.');
  } catch (error) {
    next(error);
  }
};

const rejectAction = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const action = await automationService.rejectAction({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
      userId: req.user._id,
      userRole: req.user.role,
      reason,
    });

    return ApiResponse.success(res, action, 'Action proposal has been rejected.');
  } catch (error) {
    next(error);
  }
};

const editAction = async (req, res, next) => {
  try {
    const { proposedPayload, title, description, comments } = req.body;
    const action = await automationService.editAction({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
      userId: req.user._id,
      userRole: req.user.role,
      updates: { proposedPayload, title, description },
      comments,
    });

    return ApiResponse.success(res, action, 'Action proposal updated successfully.');
  } catch (error) {
    next(error);
  }
};

const cancelAction = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const action = await automationService.cancelAction({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
      userId: req.user._id,
      reason,
    });

    return ApiResponse.success(res, action, 'Action proposal cancelled.');
  } catch (error) {
    next(error);
  }
};

const executeAction = async (req, res, next) => {
  try {
    const result = await automationService.executeAction({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
      userId: req.user._id,
      userRole: req.user.role,
    });

    return ApiResponse.success(res, result, 'Action executed successfully against external provider.');
  } catch (error) {
    next(error);
  }
};

const retryAction = async (req, res, next) => {
  try {
    const result = await automationService.retryAction({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
      userId: req.user._id,
      userRole: req.user.role,
    });

    return ApiResponse.success(res, result, 'Action retried and completed successfully.');
  } catch (error) {
    next(error);
  }
};

const getActionHistory = async (req, res, next) => {
  try {
    const history = await automationService.getActionHistory({
      organizationId: req.organizationId,
      actionId: req.params.actionId,
    });
    return ApiResponse.success(res, history);
  } catch (error) {
    next(error);
  }
};

const listExecutions = async (req, res, next) => {
  try {
    const { actionId, page, limit } = req.query;
    const result = await automationService.listExecutions({
      organizationId: req.organizationId,
      actionId,
      page,
      limit,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const settings = await automationService.getSettings(req.organizationId);
    return ApiResponse.success(res, settings);
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const updated = await automationService.updateSettings(req.organizationId, req.body, req.user._id);
    return ApiResponse.success(res, updated, 'Automation settings updated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listActions,
  getActionById,
  generateActions,
  approveAction,
  rejectAction,
  editAction,
  cancelAction,
  executeAction,
  retryAction,
  getActionHistory,
  listExecutions,
  getSettings,
  updateSettings,
};
