const AppError = require('../utils/appError');

/**
 * Tenant Context Middleware
 * Enforces strict multi-tenant context isolation.
 */
const enforceTenantIsolation = (req, res, next) => {
  if (!req.user || !req.user.organizationId) {
    return next(new AppError('Tenant context missing from authenticated session.', 403, 'TENANT_CONTEXT_MISSING'));
  }

  // Ensure req.organizationId is always an ObjectId string / instance
  req.organizationId = req.user.organizationId._id || req.user.organizationId;
  next();
};

module.exports = {
  enforceTenantIsolation,
};
