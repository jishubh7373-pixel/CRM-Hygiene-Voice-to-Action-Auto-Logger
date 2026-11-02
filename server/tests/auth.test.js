const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Authentication and RBAC Endpoints', () => {
  const registerPayload = {
    orgName: 'Alpha Ventures',
    domain: 'alphaventures.com',
    adminName: 'Alice Alpha',
    email: 'alice@alphaventures.com',
    password: 'Password123!',
  };

  it('POST /api/v1/auth/register should create organization and admin user', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.organization.name).toBe('Alpha Ventures');
    expect(res.body.data.user.email).toBe('alice@alphaventures.com');
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('POST /api/v1/auth/register should reject duplicate domain', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app).post('/api/v1/auth/register').send({
      ...registerPayload,
      email: 'other@alphaventures.com',
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOMAIN_EXISTS');
  });

  it('POST /api/v1/auth/login should authenticate valid user', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@alphaventures.com',
      password: 'Password123!',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.user.email).toBe('alice@alphaventures.com');
  });

  it('POST /api/v1/auth/login should reject invalid password', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@alphaventures.com',
      password: 'WrongPassword!',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/refresh-token should issue a new access token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const { refreshToken } = regRes.body.data.tokens;

    const res = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');
  });

  it('GET /api/v1/auth/me should return authenticated user profile', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const { accessToken } = regRes.body.data.tokens;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe('alice@alphaventures.com');
    expect(res.body.data.organization.domain).toBe('alphaventures.com');
  });

  it('GET /api/v1/auth/me should reject unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });
});
