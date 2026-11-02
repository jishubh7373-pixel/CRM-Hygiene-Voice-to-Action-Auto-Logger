const request = require('supertest');
const app = require('../src/app');
const { encrypt, decrypt, encryptObject, decryptObject, generateOAuthState, verifyOAuthState } = require('../src/utils/crypto');
const integrationsService = require('../src/modules/integrations/integrations.service');
const Integration = require('../src/models/Integration');
require('./setup');

describe('Phase 3 Integration Security & Tenant Isolation Framework', () => {
  let orgAToken;
  let orgBToken;
  let orgAId;
  let orgBId;

  beforeEach(async () => {
    // 1. Create Organization A
    const resA = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Integration Alpha Org',
      domain: 'integration-alpha.com',
      adminName: 'Alpha Admin',
      email: 'admin@integration-alpha.com',
      password: 'Password123!',
    });
    orgAToken = resA.body.data.tokens.accessToken;
    orgAId = resA.body.data.organization._id || resA.body.data.organization.id;

    // 2. Create Organization B
    const resB = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Integration Beta Org',
      domain: 'integration-beta.com',
      adminName: 'Beta Admin',
      email: 'admin@integration-beta.com',
      password: 'Password123!',
    });
    orgBToken = resB.body.data.tokens.accessToken;
    orgBId = resB.body.data.organization._id || resB.body.data.organization.id;
  });

  describe('AES-256-GCM Authenticated Encryption & Decryption', () => {
    it('should successfully encrypt and decrypt plaintext strings', () => {
      const plaintext = 'super-secret-oauth-refresh-token-12345';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.ciphertext).not.toEqual(plaintext);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('should successfully encrypt and decrypt complex JSON objects', () => {
      const creds = {
        accessToken: 'access-xyz-987',
        refreshToken: 'refresh-abc-123',
        portalId: '54321',
        scopes: ['crm.objects.deals.read', 'crm.objects.deals.write'],
      };

      const encrypted = encryptObject(creds);
      const decrypted = decryptObject(encrypted);

      expect(decrypted).toEqual(creds);
    });

    it('should reject tampered ciphertext or modified authTag', () => {
      const encrypted = encrypt('sensitive-data');
      // Tamper ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -2) + 'ff',
      };

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('Signed OAuth State Verification', () => {
    it('should generate and verify valid OAuth state', () => {
      const state = generateOAuthState({
        organizationId: orgAId,
        userId: '60c72b2f9b1d8b2bad000001',
        provider: 'hubspot',
      });

      expect(typeof state).toBe('string');
      const verified = verifyOAuthState(state);

      expect(verified).toBeTruthy();
      expect(verified.organizationId).toBe(orgAId.toString());
      expect(verified.provider).toBe('hubspot');
    });

    it('should reject invalid or tampered state strings', () => {
      expect(verifyOAuthState('invalid-state-payload')).toBeNull();
      expect(verifyOAuthState('eyJhbGciOiJIUzI1NiJ9.tampered')).toBeNull();
    });
  });

  describe('Tenant Data Isolation for Integrations', () => {
    it('should configure credentials under Org A and verify Org B cannot access them', async () => {
      // Configure Zoom under Org A
      const configRes = await request(app)
        .post('/api/v1/integrations/zoom/configure')
        .set('Authorization', `Bearer ${orgAToken}`)
        .send({
          webhookSecret: 'zoom_secret_alpha_token',
          clientId: 'zoom_client_alpha',
          clientSecret: 'zoom_secret_alpha',
          accountId: 'zoom_account_alpha',
        });

      expect(configRes.status).toBe(200);
      expect(configRes.body.success).toBe(true);

      // Org A lists integrations: Zoom is connected
      const listA = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(listA.status).toBe(200);
      const zoomA = listA.body.data.find((i) => i.provider === 'zoom');
      expect(zoomA.status).toBe('connected');
      expect(zoomA.credentialsConfigured).toBe(true);
      // Secrets must never be exposed
      expect(zoomA.encryptedCredentials).toBeUndefined();
      expect(zoomA.clientSecret).toBeUndefined();

      // Org B lists integrations: Zoom is strictly disconnected
      const listB = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(listB.status).toBe(200);
      const zoomB = listB.body.data.find((i) => i.provider === 'zoom');
      expect(zoomB.status).toBe('disconnected');
      expect(zoomB.credentialsConfigured).toBe(false);
    });

    it('should disconnect integration cleanly and wipe encrypted credentials', async () => {
      // Connect under Org A
      await request(app)
        .post('/api/v1/integrations/zoom/configure')
        .set('Authorization', `Bearer ${orgAToken}`)
        .send({
          webhookSecret: 'secret_to_disconnect',
        });

      // Disconnect
      const disRes = await request(app)
        .post('/api/v1/integrations/zoom/disconnect')
        .set('Authorization', `Bearer ${orgAToken}`);

      expect(disRes.status).toBe(200);

      // Verify DB record has wiped ciphertext
      const dbDoc = await Integration.findOne({ organizationId: orgAId, provider: 'zoom' });
      expect(dbDoc.connectionStatus).toBe('disconnected');
      expect(dbDoc.encryptedCredentials.ciphertext).toBe('');
    });
  });
});
