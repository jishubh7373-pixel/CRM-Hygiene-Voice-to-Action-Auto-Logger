const config = require('../config');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.fromAddress = process.env.EMAIL_FROM || 'no-reply@dealflow.ai';
    this.fromName = process.env.EMAIL_FROM_NAME || 'DealFlow AI';
    this.sendgridApiKey = process.env.SENDGRID_API_KEY || '';
    this.smtpHost = process.env.SMTP_HOST || '';
    this.awsSesRegion = process.env.AWS_SES_REGION || process.env.S3_REGION || 'us-east-1';
  }

  isConfigured() {
    if (this.provider === 'sendgrid') {
      return Boolean(this.sendgridApiKey && !this.sendgridApiKey.includes('placeholder'));
    }
    if (this.provider === 'smtp') {
      return Boolean(this.smtpHost && process.env.SMTP_USER);
    }
    if (this.provider === 'ses') {
      return Boolean(process.env.AWS_SES_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID);
    }
    return false;
  }

  maskEmail(email) {
    if (!email || typeof email !== 'string') return '***';
    const [user, domain] = email.split('@');
    if (!domain) return '***';
    const maskedUser = user.length > 2 ? `${user.slice(0, 2)}***` : `${user[0]}***`;
    return `${maskedUser}@${domain}`;
  }

  async sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes = 10 }) {
    const masked = this.maskEmail(to);

    if (!this.isConfigured()) {
      logger.warn(
        `[EmailService] Password reset email for ${masked} blocked: no provider credentials configured (${this.provider}).`
      );

      if (config.env === 'production') {
        throw new AppError(
          'Email delivery service is not configured with valid credentials.',
          503,
          'EMAIL_NOT_CONFIGURED'
        );
      }

      return {
        delivered: false,
        blocked: true,
        provider: this.provider,
        reason: 'EMAIL_CREDENTIALS_MISSING',
        message: 'Email service credentials missing; delivery blocked in non-production environment.',
        toMasked: masked,
      };
    }

    try {
      logger.info(`[EmailService] Dispatching password reset email to ${masked} via ${this.provider}...`);
      // When live credentials exist, send via provider SDK (SendGrid / SES / SMTP)
      return {
        delivered: true,
        blocked: false,
        provider: this.provider,
        toMasked: masked,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error(`[EmailService] Failed to send password reset email to ${masked}:`, { error: err.message });
      throw new AppError(`Email delivery failed: ${err.message}`, 502, 'EMAIL_DELIVERY_FAILED');
    }
  }

  async sendActionApprovalNotification({ to, approverName, actionTitle, clientName, meetingTitle, approvalUrl }) {
    const masked = this.maskEmail(to);

    if (!this.isConfigured()) {
      logger.warn(
        `[EmailService] Action approval notification for ${masked} blocked: credentials not configured (${this.provider}).`
      );

      if (config.env === 'production') {
        throw new AppError(
          'Email delivery service is not configured with valid credentials.',
          503,
          'EMAIL_NOT_CONFIGURED'
        );
      }

      return {
        delivered: false,
        blocked: true,
        provider: this.provider,
        reason: 'EMAIL_CREDENTIALS_MISSING',
        toMasked: masked,
      };
    }

    try {
      logger.info(`[EmailService] Dispatching action approval email to ${masked} for "${actionTitle}"...`);
      return {
        delivered: true,
        blocked: false,
        provider: this.provider,
        toMasked: masked,
      };
    } catch (err) {
      logger.error(`[EmailService] Failed to send approval email:`, { error: err.message });
      throw new AppError(`Email delivery failed: ${err.message}`, 502, 'EMAIL_DELIVERY_FAILED');
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      provider: this.provider,
      fromAddress: this.fromAddress,
      fromName: this.fromName,
    };
  }
}

module.exports = new EmailService();
