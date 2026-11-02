const authService = require('../services/authService');
const ApiResponse = require('../utils/apiResponse');

const register = async (req, res, next) => {
  try {
    const { orgName, domain, adminName, email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || '';

    const result = await authService.registerOrganization({
      orgName,
      domain,
      adminName,
      email,
      password,
      ipAddress,
      userAgent,
    });

    return ApiResponse.created(res, result, 'Organization and administrator account registered successfully.');
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || '';

    const result = await authService.login({
      email,
      password,
      ipAddress,
      userAgent,
    });

    return ApiResponse.success(res, result, 'Authentication successful.');
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh({ refreshToken });
    return ApiResponse.success(res, result, 'Token refreshed successfully.');
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user._id, req.organizationId);
    return ApiResponse.success(res, null, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    return ApiResponse.success(
      res,
      {
        user: req.user.toJSON(),
        organization: req.user.organizationId,
      },
      'User profile fetched.'
    );
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const clientOrigin = req.get('origin');
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.forgotPassword({
      email,
      clientOrigin,
      ipAddress,
    });

    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.resetPassword({
      token,
      newPassword,
      ipAddress,
    });

    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};
