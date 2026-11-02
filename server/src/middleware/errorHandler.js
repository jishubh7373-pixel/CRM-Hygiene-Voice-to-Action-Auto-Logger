const logger = require('../utils/logger');
const config = require('../config');

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.code = err.code || 'INTERNAL_SERVER_ERROR';

  // Log error with context
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: config.env === 'development' ? err.stack : undefined,
    code: error.code,
    statusCode: error.statusCode,
  });

  // Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    error.message = `Invalid format for resource identifier: ${err.value}`;
    error.statusCode = 400;
    error.code = 'INVALID_ID';
  }

  // Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error.message = `A record with this ${field} already exists: '${err.keyValue[field]}'`;
    error.statusCode = 409;
    error.code = 'DUPLICATE_ENTRY';
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error.message = 'Schema validation failed';
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid authentication token signature';
    error.statusCode = 401;
    error.code = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Authentication token has expired';
    error.statusCode = 401;
    error.code = 'TOKEN_EXPIRED';
  }

  const responsePayload = {
    success: false,
    error: {
      message: error.message || 'An unexpected internal error occurred',
      code: error.code,
      details: error.details || err.details || null,
      ...(config.env === 'development' && { stack: err.stack }),
    },
  };

  res.status(error.statusCode).json(responsePayload);
};

module.exports = errorHandler;
