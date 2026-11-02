const request = require('supertest');
const app = require('../src/app');
require('./setup');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const aiUsageService = require('../src/modules/ai/ai-usage.service');
const dataRetentionService = require('../src/modules/privacy/data-retention.service');
const Deal = require('../src/models/Deal');

describe('Phase 5: Production Readiness, Security & Performance Audit', () => {
  let adminToken;
  let organizationId;
  let adminUser;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Production Audit Org',
      domain: 'prodaudit.com',
      adminName: 'Alice Auditor',
      email: 'alice.auditor@prodaudit.com',
      password: 'Password123!',
    });

    adminToken = regRes.body.data.tokens.accessToken;
    organizationId = regRes.body.data.organization._id || regRes.body.data.organization.id;
    adminUser = regRes.body.data.user;
  });

  describe('1. Observability & Telemetry Probes', () => {
    it('GET /health should return 200 with service uptime and zero secret leaks', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeDefined();
      expect(res.body).not.toHaveProperty('databaseUri');
      expect(res.body).not.toHaveProperty('jwtSecret');
    });

    it('GET /ready should verify database readiness for orchestrator traffic', async () => {
      const res = await request(app).get('/ready');

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.checks.database).toBe('connected');
    });

    it('should generate or propagate X-Request-Id correlation headers', async () => {
      // 1. Auto-generated
      const resAuto = await request(app).get('/health');
      expect(resAuto.headers['x-request-id']).toBeDefined();

      // 2. Propagated from client
      const customId = 'req-trace-test-uuid-999';
      const resCustom = await request(app).get('/health').set('X-Request-Id', customId);
      expect(resCustom.headers['x-request-id']).toBe(customId);
    });
  });

  describe('2. Application Security & Injection Hardening', () => {
    it('should include Helmet security headers', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('should sanitize NoSQL operator injection keys from request payloads', async () => {
      // Attempt sending malicious Mongo operator keys
      const maliciousPayload = {
        name: 'Injected Deal',
        accountName: 'Acme Corp',
        closeDate: '2026-12-31',
        amount: 25000,
        $where: 'sleep(5000)',
        'amount.$gt': 0,
      };

      const res = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousPayload);

      expect(res.status).toBe(201);
      // The sanitized deal should not contain operator keys
      expect(res.body.data).not.toHaveProperty('$where');
      expect(res.body.data).not.toHaveProperty('amount.$gt');
      expect(res.body.data.amount).toBe(25000);
    });

    it('logger should redact sensitive credential fields from output', () => {
      const sensitiveMeta = {
        email: 'user@dealflow.ai',
        password: 'SuperSecretPassword!',
        token: 'eyJhbGciOiJIUzI1NiIsIn...',
        clientSecret: 'secret_12345',
        apiKey: 'sk-123456789',
        nested: {
          refreshToken: 'refresh_998877',
          publicField: 'safeValue',
        },
      };

      const redacted = logger.redact(sensitiveMeta);

      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.clientSecret).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.nested.refreshToken).toBe('[REDACTED]');
      expect(redacted.nested.publicField).toBe('safeValue');
      expect(redacted.email).toBe('user@dealflow.ai');
    });
  });

  describe('3. Production Configuration Validation', () => {
    it('should fail fast in production mode if required secrets are missing or default', () => {
      const origEnv = process.env.NODE_ENV;
      const origAccess = process.env.JWT_ACCESS_SECRET;
      const origMongo = process.env.MONGODB_URI;

      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_ACCESS_SECRET = 'dealflow_default_jwt_access_secret_dev_32char';
        delete process.env.MONGODB_URI;

        expect(() => {
          config.validateConfig('production');
        }).toThrow(/Production environment validation failed/);
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.JWT_ACCESS_SECRET = origAccess;
        process.env.MONGODB_URI = origMongo;
      }
    });
  });

  describe('4. AI Cost Tracking & Usage Analytics', () => {
    it('should calculate accurate cost estimation for token and audio consumption', () => {
      const cost = aiUsageService.calculateMeetingAiCost({
        analysisModel: 'gpt-4o-mini',
        promptTokens: 2000,
        completionTokens: 500,
        durationSeconds: 300, // 5 minutes
      });

      // 2000 * 0.00000015 = 0.0003
      // 500 * 0.0000006 = 0.0003
      // 300 * 0.0001 = 0.03
      expect(cost.totalCostUsd).toBeCloseTo(0.0306, 4);
    });

    it('GET /api/v1/settings/usage should return organization token and cost metrics', async () => {
      const res = await request(app)
        .get('/api/v1/settings/usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.quotas).toBeDefined();
      expect(res.body.data.models.analysis).toBe('gpt-4o-mini');
    });
  });

  describe('5. Data Privacy & Retention Governance', () => {
    it('should get and update organization data retention policy', async () => {
      // 1. Get current retention policy
      const getRes = await request(app)
        .get('/api/v1/settings/data-retention')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.audioRetentionDays).toBe(90);

      // 2. Update retention policy
      const patchRes = await request(app)
        .patch('/api/v1/settings/data-retention')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ audioRetentionDays: 60, autoPurgeEnabled: true });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.audioRetentionDays).toBe(60);
      expect(patchRes.body.data.autoPurgeEnabled).toBe(true);
    });

    it('POST /api/v1/settings/data-export should compile complete tenant archive for GDPR takeout', async () => {
      // Create a test deal to verify in export
      await Deal.create({
        organizationId,
        ownerId: adminUser._id || adminUser.id,
        name: 'Export Test Deal',
        accountName: 'Export Account',
        closeDate: new Date(),
        amount: 80000,
        stage: 'proposal',
      });

      const res = await request(app)
        .post('/api/v1/settings/data-export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.exportMetadata.organizationId).toBe(organizationId.toString());
      expect(res.body.data.data.deals.length).toBeGreaterThan(0);
      expect(res.body.data.data.auditLogs).toBeDefined();
    });

    it('POST /api/v1/settings/purge-audio should execute retention check without errors', async () => {
      const res = await request(app)
        .post('/api/v1/settings/purge-audio')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.purgedCount).toBeDefined();
    });
  });
});
