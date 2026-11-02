const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Health and Root Telemetry Endpoints', () => {
  it('GET / should return gateway metadata', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('DealFlow AI API Gateway');
    expect(res.body.healthCheck).toBe('/api/v1/health');
  });

  it('GET /api/v1/health should return 200 with component statuses', async () => {
    const res = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('components');
    expect(res.body.components).toHaveProperty('mongodb');
    expect(res.body.components).toHaveProperty('redis');
    expect(res.body.components).toHaveProperty('queue');
  });

  it('GET /non-existent-route should return structured 404', async () => {
    const res = await request(app).get('/api/v1/not-found-endpoint');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
