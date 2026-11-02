const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Multi-Tenant Organization Data Isolation & RBAC', () => {
  let orgAToken;
  let orgBToken;
  let orgADealId;
  let orgAMeetingId;

  beforeEach(async () => {
    // 1. Create Organization A
    const resA = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Tenant Alpha Corp',
      domain: 'alphacorp.com',
      adminName: 'Admin Alpha',
      email: 'admin@alphacorp.com',
      password: 'Password123!',
    });
    orgAToken = resA.body.data.tokens.accessToken;

    // 2. Create Organization B
    const resB = await request(app).post('/api/v1/auth/register').send({
      orgName: 'Tenant Beta Corp',
      domain: 'betacorp.com',
      adminName: 'Admin Beta',
      email: 'admin@betacorp.com',
      password: 'Password123!',
    });
    orgBToken = resB.body.data.tokens.accessToken;

    // 3. Create Deal under Org A
    const dealRes = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: 'Confidential Enterprise Deal',
        accountName: 'Secret Client Co',
        amount: 250000,
        stage: 'proposal',
        closeDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      });
    orgADealId = dealRes.body.data._id;

    // 4. Create Meeting under Org A
    const meetingRes = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        title: 'Alpha Private Strategy Call',
        clientName: 'Secret Client Co',
        platform: 'google_meet',
        durationMinutes: 45,
      });
    orgAMeetingId = meetingRes.body.data._id;
  });

  it('Tenant B should NOT see Tenant A deals in list queries', async () => {
    // Tenant A sees their deal
    const resA = await request(app)
      .get('/api/v1/deals')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(resA.body.data.deals.length).toBe(1);
    expect(resA.body.data.deals[0].name).toBe('Confidential Enterprise Deal');

    // Tenant B must see 0 deals
    const resB = await request(app)
      .get('/api/v1/deals')
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(resB.body.data.deals.length).toBe(0);
  });

  it('Tenant B should NOT be able to view Tenant A deal by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/deals/${orgADealId}`)
      .set('Authorization', `Bearer ${orgBToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('Tenant B should NOT be able to mutate Tenant A deal', async () => {
    const res = await request(app)
      .patch(`/api/v1/deals/${orgADealId}`)
      .set('Authorization', `Bearer ${orgBToken}`)
      .send({ amount: 999999 });

    expect(res.statusCode).toBe(404);

    // Verify Deal A remains unchanged
    const verifyRes = await request(app)
      .get(`/api/v1/deals/${orgADealId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(verifyRes.body.data.deal.amount).toBe(250000);
  });

  it('Tenant B should NOT see Tenant A meetings', async () => {
    const resB = await request(app)
      .get('/api/v1/meetings')
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(resB.body.data.meetings.length).toBe(0);
  });

  it('Tenant B should NOT be able to access Tenant A meeting by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/meetings/${orgAMeetingId}`)
      .set('Authorization', `Bearer ${orgBToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('Non-admin role should be forbidden from modifying organization settings', async () => {
    // Invite a 'rep' user under Tenant A
    const inviteRes = await request(app)
      .post('/api/v1/settings/team/invite')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: 'Sales Rep Bob',
        email: 'bob@alphacorp.com',
        role: 'rep',
        temporaryPassword: 'Password123!',
      });
    expect(inviteRes.statusCode).toBe(201);

    // Login as Bob
    const loginBob = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@alphacorp.com',
      password: 'Password123!',
    });
    const bobToken = loginBob.body.data.tokens.accessToken;

    // Attempt admin action with rep token
    const patchOrg = await request(app)
      .patch('/api/v1/settings/organization')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Hacked Name' });

    expect(patchOrg.statusCode).toBe(403);
    expect(patchOrg.body.error.code).toBe('FORBIDDEN');
  });
});
