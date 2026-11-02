/**
 * Standardized API Response Helper
 */
class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  static error(res, message = 'An error occurred', statusCode = 500, code = 'ERROR', details = null) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code,
        details,
      },
    });
  }
}

module.exports = ApiResponse;
