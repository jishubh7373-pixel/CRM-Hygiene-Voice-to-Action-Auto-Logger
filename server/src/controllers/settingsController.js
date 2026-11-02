const Organization = require('../models/Organization');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { recordAudit } = require('../services/auditService');

const getOrgSettings = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId);
    return ApiResponse.success(res, org);
  } catch (error) {
    next(error);
  }
};

const updateOrgSettings = async (req, res, next) => {
  try {
    const { name, settings } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (settings) updateData.settings = settings;

    const org = await Organization.findByIdAndUpdate(
      req.organizationId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    await recordAudit({
      organizationId: req.organizationId,
      userId: req.user._id,
      userEmail: req.user.email,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entityType: 'Organization',
      entityId: req.organizationId.toString(),
      details: updateData,
    });

    return ApiResponse.success(res, org, 'Organization settings updated successfully.');
  } catch (error) {
    next(error);
  }
};

const listTeam = async (req, res, next) => {
  try {
    const users = await User.find({ organizationId: req.organizationId }).sort({ role: 1, name: 1 }).lean();
    return ApiResponse.success(res, users);
  } catch (error) {
    next(error);
  }
};

const inviteMember = async (req, res, next) => {
  try {
    const { name, email, role, title, temporaryPassword } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('A user with this email already exists.', 409, 'USER_EXISTS');
    }

    const newUser = await User.create({
      organizationId: req.organizationId,
      name,
      email: email.toLowerCase(),
      password: temporaryPassword || 'Welcome123!Secure',
      role: role || 'rep',
      title: title || 'Sales Representative',
    });

    await recordAudit({
      organizationId: req.organizationId,
      userId: req.user._id,
      userEmail: req.user.email,
      action: 'TEAM_MEMBER_INVITED',
      entityType: 'User',
      entityId: newUser._id.toString(),
      details: { email: newUser.email, role: newUser.role },
    });

    return ApiResponse.created(res, newUser.toJSON(), 'Team member invited successfully.');
  } catch (error) {
    next(error);
  }
};

const listAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({ organizationId: req.organizationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role')
        .lean(),
      AuditLog.countDocuments({ organizationId: req.organizationId }),
    ]);

    return ApiResponse.success(res, {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const aiUsageService = require('../modules/ai/ai-usage.service');
const dataRetentionService = require('../modules/privacy/data-retention.service');

const getAiUsage = async (req, res, next) => {
  try {
    const usage = await aiUsageService.getOrganizationAiUsage(req.organizationId);
    return ApiResponse.success(res, usage);
  } catch (error) {
    next(error);
  }
};

const getDataRetention = async (req, res, next) => {
  try {
    const settings = await dataRetentionService.getRetentionSettings(req.organizationId);
    return ApiResponse.success(res, settings);
  } catch (error) {
    next(error);
  }
};

const updateDataRetention = async (req, res, next) => {
  try {
    const updated = await dataRetentionService.updateRetentionSettings({
      organizationId: req.organizationId,
      settings: req.body,
      updatedBy: req.user,
    });
    return ApiResponse.success(res, updated, 'Data retention policy updated successfully.');
  } catch (error) {
    next(error);
  }
};

const exportData = async (req, res, next) => {
  try {
    const dataArchive = await dataRetentionService.exportOrganizationData({
      organizationId: req.organizationId,
      requestedBy: req.user,
    });
    return ApiResponse.success(res, dataArchive, 'Organization data export generated.');
  } catch (error) {
    next(error);
  }
};

const purgeAudio = async (req, res, next) => {
  try {
    const result = await dataRetentionService.purgeExpiredAudio({
      organizationId: req.organizationId,
      performedBy: req.user,
    });
    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrgSettings,
  updateOrgSettings,
  listTeam,
  inviteMember,
  listAuditLogs,
  getAiUsage,
  getDataRetention,
  updateDataRetention,
  exportData,
  purgeAudio,
};

