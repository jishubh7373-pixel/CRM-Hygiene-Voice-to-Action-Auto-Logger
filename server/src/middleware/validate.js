const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

/**
 * Request Validation Middleware
 * Formats express-validator error results into standardized API error responses.
 */
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return next(new AppError('Validation failed on submitted payload.', 400, 'VALIDATION_ERROR', extractedErrors));
  };
};

module.exports = {
  validate,
};
