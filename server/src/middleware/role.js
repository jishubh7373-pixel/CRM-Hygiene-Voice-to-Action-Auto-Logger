const AppError = require('../utils/appError');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts endpoint execution to specified user roles.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Role '${req.user.role}' lacks permissions for this resource. Required: [${allowedRoles.join(', ')}]`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

module.exports = {
  authorize,
};
