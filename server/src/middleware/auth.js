const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/appError');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return next(new AppError('Authentication required. Missing token.', 401, 'UNAUTHORIZED'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Access token expired. Please refresh session.', 401, 'TOKEN_EXPIRED'));
      }
      return next(new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN'));
    }

    const user = await User.findById(decoded.userId).populate('organizationId', 'name domain plan isActive settings');

    if (!user) {
      return next(new AppError('Account associated with this token no longer exists.', 401, 'USER_NOT_FOUND'));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED'));
    }

    if (!user.organizationId || !user.organizationId.isActive) {
      return next(new AppError('Your organization account is inactive.', 403, 'ORGANIZATION_INACTIVE'));
    }

    req.user = user;
    req.organizationId = user.organizationId._id;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
};
