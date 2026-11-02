const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const emailService = require('../src/services/emailService');
require('./setup');

describe('Transactional Email Service & Secure Password Reset Lifecycle', () => {
  let userEmail = 'reset.test@acmecorp.com';
  let initialPassword = 'InitialPassword123!';
  let newPassword = 'NewSecretPassword456!';
  let userId;

  beforeEach(async () => {
    // Register organization and admin
    const regRes = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Password Reset Test Org',
      domain: 'resettest.com',
      adminName: 'Reset Tester',
      email: userEmail,
      password: initialPassword,
    });

    userId = regRes.body.data.user._id;
  });

  it('should return generic success message on forgot-password request to prevent email enumeration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: userEmail });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/password reset link has been dispatched/i);

    // Verify token was generated in database
    const userInDb = await User.findById(userId).select('+passwordResetToken +passwordResetExpires');
    expect(userInDb.passwordResetToken).toBeDefined();
    expect(userInDb.passwordResetExpires).toBeDefined();
    expect(new Date(userInDb.passwordResetExpires).getTime()).toBeGreaterThan(Date.now());
  });

  it('should return the same generic success message when email does not exist (anti-enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nonexistent@nowhere.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/password reset link has been dispatched/i);
  });

  it('should successfully reset password when provided valid unhashed reset token', async () => {
    // Generate reset token directly on model
    const user = await User.findById(userId);
    const rawToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send reset request with raw token
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        newPassword,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify user can log in with new password
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userEmail,
        password: newPassword,
      });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data.tokens.accessToken).toBeDefined();

    // Verify old password no longer works
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userEmail,
        password: initialPassword,
      });

    expect(oldLoginRes.statusCode).toBe(401);
  });

  it('should reject reset request when token is invalid or expired', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'invalid_expired_token_12345',
        newPassword: 'SomeValidPassword999!',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('EmailService should report safe BLOCKED state when provider credentials are not set', async () => {
    const status = emailService.getStatus();
    expect(status).toHaveProperty('configured');
    expect(status).toHaveProperty('provider');

    const result = await emailService.sendPasswordResetEmail({
      to: 'sales@dealflow.ai',
      name: 'Sales Rep',
      resetUrl: 'http://localhost:5173/reset-password?token=mock',
    });

    // In dev without credentials, returns blocked result safely
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('EMAIL_CREDENTIALS_MISSING');
  });
});
