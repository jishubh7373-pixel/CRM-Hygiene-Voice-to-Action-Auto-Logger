const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const Meeting = require('../src/models/Meeting');
require('./setup');

describe('Audio Upload Workflow & Secure Media Streaming', () => {
  let orgAToken;
  let orgBToken;
  let orgAMeetingId;

  // Tiny valid MP3 buffer header (ID3 + frame header)
  const sampleMp3Buffer = Buffer.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  beforeEach(async () => {
    // 1. Register Tenant A
    const resA = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Audio Tenant Alpha',
      domain: 'audioalpha.com',
      adminName: 'Alpha Admin',
      email: 'admin@audioalpha.com',
      password: 'Password123!',
    });
    orgAToken = resA.body.data.tokens.accessToken;

    // 2. Register Tenant B
    const resB = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Audio Tenant Beta',
      domain: 'audiobeta.com',
      adminName: 'Beta Admin',
      email: 'admin@audiobeta.com',
      password: 'Password123!',
    });
    orgBToken = resB.body.data.tokens.accessToken;
  });

  it('should reject unauthenticated audio upload requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/meetings/upload')
      .attach('audio', sampleMp3Buffer, 'call.mp3')
      .field('title', 'Sales Call');

    expect(res.statusCode).toBe(401);
  });

  it('should reject upload without an audio file with 400', async () => {
    const res = await request(app)
      .post('/api/v1/meetings/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .field('title', 'Sales Call Without Audio');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject upload with unsupported file extension with 400', async () => {
    const fakeExe = Buffer.from('MZ-fake-binary');
    const res = await request(app)
      .post('/api/v1/meetings/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('audio', fakeExe, 'virus.exe')
      .field('title', 'Malicious File');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should successfully upload valid audio file and return meeting record', async () => {
    const res = await request(app)
      .post('/api/v1/meetings/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('audio', sampleMp3Buffer, 'discovery_call.mp3')
      .field('title', 'Discovery Call Alpha')
      .field('clientName', 'Acme Corp')
      .field('clientEmail', 'buyer@acme.com');

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.meeting).toBeDefined();

    const meeting = res.body.data.meeting;
    expect(meeting.title).toBe('Discovery Call Alpha');
    expect(meeting.clientName).toBe('Acme Corp');
    expect(meeting.source).toBe('audio_upload');
    expect(meeting.audioStorage.stored).toBe(true);
    expect(meeting.audioStorage.originalFileName).toBe('discovery_call.mp3');
    expect(meeting.audioStorage.storageProvider).toBe('local');

    orgAMeetingId = meeting._id;
  });

  it('should stream audio with Authorization header for authorized tenant', async () => {
    // First upload audio
    const uploadRes = await request(app)
      .post('/api/v1/meetings/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('audio', sampleMp3Buffer, 'stream_test.mp3')
      .field('title', 'Stream Test Call')
      .field('clientName', 'Stream Client');

    const meetingId = uploadRes.body.data.meeting._id;

    // Stream audio
    const streamRes = await request(app)
      .get(`/api/v1/meetings/${meetingId}/audio`)
      .set('Authorization', `Bearer ${orgAToken}`);

    expect([200, 206]).toContain(streamRes.statusCode);
    expect(streamRes.headers['content-type']).toMatch(/audio/);
  });

  it('should stream audio using query parameter token for HTML5 audio elements', async () => {
    const uploadRes = await request(app)
      .post('/api/v1/meetings/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('audio', sampleMp3Buffer, 'token_query_test.mp3')
      .field('title', 'Token Query Test Call')
      .field('clientName', 'Stream Client 2');

    const meetingId = uploadRes.body.data.meeting._id;

    const streamRes = await request(app)
      .get(`/api/v1/meetings/${meetingId}/audio?token=${orgAToken}`);

    expect([200, 206]).toContain(streamRes.statusCode);
  });

  it('Tenant B should NOT be able to stream Tenant A audio file (isolation)', async () => {
    const uploadRes = await request(app)
      .post('/api/v1/meetings/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('audio', sampleMp3Buffer, 'secret_alpha.mp3')
      .field('title', 'Confidential Alpha Call')
      .field('clientName', 'Confidential');

    const meetingId = uploadRes.body.data.meeting._id;

    // Tenant B attempts to stream Tenant A's audio
    const breachRes = await request(app)
      .get(`/api/v1/meetings/${meetingId}/audio`)
      .set('Authorization', `Bearer ${orgBToken}`);

    expect(breachRes.statusCode).toBe(404);
  });
});
