const crypto = require('crypto');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Integration = require('../models/Integration');
const AppError = require('../utils/appError');
const config = require('../config');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('./tokenService');
const { recordAudit } = require('./auditService');
const emailService = require('./emailService');

/**
 * Register Organization and Initial Admin User
 */
const registerOrganization = async ({ orgName, domain, adminName, email, password, ipAddress, userAgent }) => {
  const existingOrg = await Organization.findOne({ domain: domain.toLowerCase() });
  if (existingOrg) {
    throw new AppError('An organization with this domain already exists.', 409, 'DOMAIN_EXISTS');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('An account with this email address already exists.', 409, 'EMAIL_EXISTS');
  }

  // 1. Create Organization
  const organization = await Organization.create({
    name: orgName,
    domain: domain.toLowerCase(),
    plan: 'professional',
  });

  // 2. Create Initial Admin User
  const adminUser = await User.create({
    organizationId: organization._id,
    name: adminName,
    email: email.toLowerCase(),
    password,
    role: 'admin',
    title: 'Platform Administrator',
    lastLoginAt: new Date(),
  });

  // 3. Initialize Available Integrations as disconnected / needing credentials
  const defaultProviders = ['salesforce', 'hubspot', 'slack', 'zoom', 'google_meet'];
  await Promise.all(
    defaultProviders.map((provider) =>
      Integration.create({
        organizationId: organization._id,
        provider,
        status: 'disconnected',
        credentialsConfigured: false,
      })
    )
  );

  // 4. Generate Tokens
  const accessToken = generateAccessToken(adminUser);
  const refreshToken = generateRefreshToken(adminUser);

  // Store refresh token
  adminUser.refreshToken = refreshToken;
  await adminUser.save({ validateBeforeSave: false });

  // 5. Audit Log
  await recordAudit({
    organizationId: organization._id,
    userId: adminUser._id,
    userEmail: adminUser.email,
    action: 'ORGANIZATION_REGISTERED',
    entityType: 'Organization',
    entityId: organization._id.toString(),
    details: { orgName, domain },
    ipAddress,
    userAgent,
  });

  return {
    user: adminUser.toJSON(),
    organization,
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/**
 * Login User
 */
const login = async ({ email, password, ipAddress, userAgent }) => {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password +refreshToken')
    .populate('organizationId');

  if (!user) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated.', 403, 'ACCOUNT_DEACTIVATED');
  }

  if (!user.organizationId || !user.organizationId.isActive) {
    throw new AppError('Your organization subscription is currently inactive.', 403, 'ORGANIZATION_INACTIVE');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  await recordAudit({
    organizationId: user.organizationId._id,
    userId: user._id,
    userEmail: user.email,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user._id.toString(),
    ipAddress,
    userAgent,
  });

  return {
    user: user.toJSON(),
    organization: user.organizationId,
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/**
 * Refresh Access Token
 */
const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError('Refresh token is required.', 400, 'REFRESH_TOKEN_REQUIRED');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.userId).select('+refreshToken').populate('organizationId');
  if (!user) {
    throw new AppError('Account not found.', 401, 'USER_NOT_FOUND');
  }

  if (user.refreshToken !== refreshToken) {
    // Token reuse detected - revoke all tokens
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Token revocation triggered due to invalid token state. Please log in again.', 401, 'TOKEN_REUSE');
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  return {
    tokens: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  };
};

/**
 * Logout User
 */
const logout = async (userId, organizationId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });

  if (organizationId) {
    await recordAudit({
      organizationId,
      userId,
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: userId.toString(),
    });
  }

  return true;
};

/**
 * Forgot Password - Generate secure reset token and dispatch email
 */
const forgotPassword = async ({ email, clientOrigin, ipAddress }) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  // Security best practice: Always return generic success to prevent email enumeration
  if (!user) {
    return {
      message: 'If an account exists with this email address, a password reset link has been dispatched.',
    };
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const origin = clientOrigin || config.clientUrl || 'http://localhost:5173';
  const resetUrl = `${origin}/reset-password?token=${resetToken}`;

  await emailService.sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresInMinutes: 10,
  });

  await recordAudit({
    organizationId: user.organizationId,
    userId: user._id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: user._id.toString(),
    metadata: { ipAddress },
  });

  return {
    message: 'If an account exists with this email address, a password reset link has been dispatched.',
  };
};

/**
 * Reset Password - Verify token and update user password
 */
const resetPassword = async ({ token, newPassword, ipAddress }) => {
  if (!token) {
    throw new AppError('Password reset token is required.', 400, 'TOKEN_REQUIRED');
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new AppError('Password reset token is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = null; // Invalidate current session tokens
  await user.save();

  await recordAudit({
    organizationId: user.organizationId,
    userId: user._id,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: user._id.toString(),
    metadata: { ipAddress },
  });

  return {
    message: 'Password reset successfully. You may now log in with your new credentials.',
  };
};

module.exports = {
  registerOrganization,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
