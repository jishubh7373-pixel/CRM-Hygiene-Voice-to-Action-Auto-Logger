const request = require('supertest');
const app = require('../src/app');
const Meeting = require('../src/models/Meeting');
require('./setup');

describe('S3 Direct Presigned Upload & Large Audio Ingestion Flow', () => {
  let tenantAToken;
  let tenantAOrgId;
  let tenantBToken;
  let tenantBOrgId;

  beforeEach(async () => {
    // 1. Tenant Alpha
    const resA = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Direct Cloud Org Alpha',
      domain: 'cloudalpha.com',
      adminName: 'Alpha Admin',
      email: 'admin@cloudalpha.com',
      password: 'Password123!',
    });
    tenantAToken = resA.body.data.tokens.accessToken;
    tenantAOrgId = resA.body.data.user.organizationId;

    // 2. Tenant Beta
    const resB = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Direct Cloud Org Beta',
      domain: 'cloudbeta.com',
      adminName: 'Beta Admin',
      email: 'admin@cloudbeta.com',
      password: 'Password123!',
    });
    tenantBToken = resB.body.data.tokens.accessToken;
    tenantBOrgId = resB.body.data.user.organizationId;
  });

  it('should reject unauthenticated request to /upload-url with 401', async () => {
    const res = await request(app).post('/api/v1/meetings/upload-url').send({
      fileName: 'large_call.mp3',
      mimeType: 'audio/mpeg',
      fileSize: 45000000,
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject unsupported file extension or MIME type with 400', async () => {
    const res = await request(app)
      .post('/api/v1/meetings/upload-url')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        fileName: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        fileSize: 1024,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should generate secure storageKey prefixed with tenant organizationId', async () => {
    const res = await request(app)
      .post('/api/v1/meetings/upload-url')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        fileName: 'quarterly_business_review.mp3',
        mimeType: 'audio/mpeg',
        fileSize: 32000000,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('storageKey');
    expect(res.body.data).toHaveProperty('uploadMode');
    expect(res.body.data.storageKey).toMatch(new RegExp(`^audio/${tenantAOrgId}/`));
  });

  it('should confirm direct upload and create meeting record in MongoDB', async () => {
    // Step 1: Request upload URL
    const urlRes = await request(app)
      .post('/api/v1/meetings/upload-url')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        fileName: 'client_demo.mp3',
        mimeType: 'audio/mpeg',
        fileSize: 15000000,
      });

    const { storageKey } = urlRes.body.data;

    // Step 2: Confirm upload completion
    const confirmRes = await request(app)
      .post('/api/v1/meetings/confirm-upload')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        title: 'Executive Architecture Briefing',
        clientName: 'Starlight Financial',
        clientEmail: 'cto@starlight.com',
        storageKey,
        originalName: 'client_demo.mp3',
        mimeType: 'audio/mpeg',
        fileSize: 15000000,
      });

    expect(confirmRes.statusCode).toBe(201);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.meetingId).toBeDefined();

    // Verify in MongoDB
    const meeting = await Meeting.findById(confirmRes.body.data.meetingId);
    expect(meeting).not.toBeNull();
    expect(meeting.title).toBe('Executive Architecture Briefing');
    expect(meeting.audioStorage.stored).toBe(true);
    expect(meeting.audioStorage.key).toBe(storageKey);
  });

  it('should prevent Tenant B from confirming an upload with Tenant A storage key (tenant boundary)', async () => {
    const forgedStorageKey = `audio/${tenantAOrgId}/stolen_audio_file.mp3`;

    const breachRes = await request(app)
      .post('/api/v1/meetings/confirm-upload')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({
        title: 'Unauthorized Interception Attempt',
        storageKey: forgedStorageKey,
        fileSize: 1024,
      });

    expect(breachRes.statusCode).toBe(403);
    expect(breachRes.body.error.code).toBe('FORBIDDEN_KEY');
  });
});
