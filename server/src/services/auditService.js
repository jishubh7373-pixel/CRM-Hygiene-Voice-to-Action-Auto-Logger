const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const recordAudit = async ({
  organizationId,
  userId = null,
  userEmail = 'system',
  action,
  entityType,
  entityId = null,
  details = {},
  ipAddress = '',
  userAgent = '',
}) => {
  try {
    if (!organizationId) {
      logger.warn('Skipping audit log: organizationId is missing');
      return null;
    }

    const log = await AuditLog.create({
      organizationId,
      userId,
      userEmail,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      userAgent,
    });

    return log;
  } catch (error) {
    logger.error('Failed to write audit log', { error: error.message, action });
    return null;
  }
};

module.exports = {
  recordAudit,
  log: recordAudit,
};
