const mongoose = require('mongoose');
const Meeting = require('../src/models/Meeting');
const { migrateMeetingIndexes } = require('../src/utils/indexMigration');
require('./setup');

describe('Meeting Model Partial Unique Indexes & Regression Tests (P0 Bug Fix)', () => {
  const org1Id = new mongoose.Types.ObjectId();
  const org2Id = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    // Ensure indexes are synchronized with partialFilterExpression
    await migrateMeetingIndexes(Meeting);
  });

  it('1. First manual upload with null external identifiers succeeds', async () => {
    const meeting1 = await Meeting.create({
      title: 'First Manual Upload Call',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'audio_upload',
      platform: 'audio_upload',
      externalProvider: null,
      externalMeetingId: null,
      externalCallId: null,
    });

    expect(meeting1._id).toBeDefined();
    expect(meeting1.externalMeetingId).toBeNull();
  });

  it('2. Second manual upload within the same organization succeeds without E11000 duplicate key error', async () => {
    const meeting1 = await Meeting.create({
      title: 'Manual Upload Call 1',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'audio_upload',
      platform: 'audio_upload',
      externalProvider: null,
      externalMeetingId: null,
      externalCallId: null,
    });

    const meeting2 = await Meeting.create({
      title: 'Manual Upload Call 2',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'audio_upload',
      platform: 'audio_upload',
      externalProvider: null,
      externalMeetingId: null,
      externalCallId: null,
    });

    expect(meeting1._id).toBeDefined();
    expect(meeting2._id).toBeDefined();
    expect(meeting1._id.toString()).not.toBe(meeting2._id.toString());
  });

  it('3. Multiple (5+) manual uploads within one organization all succeed', async () => {
    const meetings = [];
    for (let i = 1; i <= 5; i++) {
      const m = await Meeting.create({
        title: `Batch Manual Call ${i}`,
        organizationId: org1Id,
        uploadedBy: userId,
        source: 'audio_upload',
        platform: 'audio_upload',
        externalProvider: null,
        externalMeetingId: null,
        externalCallId: null,
      });
      meetings.push(m);
    }

    expect(meetings.length).toBe(5);
    const count = await Meeting.countDocuments({ organizationId: org1Id });
    expect(count).toBe(5);
  });

  it('4. Different organizations can create manual uploads independently', async () => {
    const org1Meeting = await Meeting.create({
      title: 'Org 1 Call',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'audio_upload',
      externalProvider: null,
      externalMeetingId: null,
    });

    const org2Meeting = await Meeting.create({
      title: 'Org 2 Call',
      organizationId: org2Id,
      uploadedBy: userId,
      source: 'audio_upload',
      externalProvider: null,
      externalMeetingId: null,
    });

    expect(org1Meeting._id).toBeDefined();
    expect(org2Meeting._id).toBeDefined();
  });

  it('5. Duplicate externalMeetingId for the same organization/provider is rejected with duplicate key error', async () => {
    await Meeting.create({
      title: 'Zoom Sync Call 1',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'zoom',
      platform: 'zoom',
      externalProvider: 'zoom',
      externalMeetingId: 'zoom-mtg-998877',
    });

    let err;
    try {
      await Meeting.create({
        title: 'Zoom Sync Call 2 (Duplicate ID)',
        organizationId: org1Id,
        uploadedBy: userId,
        source: 'zoom',
        platform: 'zoom',
        externalProvider: 'zoom',
        externalMeetingId: 'zoom-mtg-998877',
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it('6. Duplicate externalCallId for the same organization/provider is rejected with duplicate key error', async () => {
    await Meeting.create({
      title: 'Gong Call 1',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'gong',
      platform: 'gong',
      externalProvider: 'gong',
      externalCallId: 'gong-call-12345',
    });

    let err;
    try {
      await Meeting.create({
        title: 'Gong Call 2 (Duplicate Call ID)',
        organizationId: org1Id,
        uploadedBy: userId,
        source: 'gong',
        platform: 'gong',
        externalProvider: 'gong',
        externalCallId: 'gong-call-12345',
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it('7. Different external IDs within the same organization and provider are accepted', async () => {
    const zoom1 = await Meeting.create({
      title: 'Zoom Call 1',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'zoom',
      externalProvider: 'zoom',
      externalMeetingId: 'zoom-mtg-001',
    });

    const zoom2 = await Meeting.create({
      title: 'Zoom Call 2',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'zoom',
      externalProvider: 'zoom',
      externalMeetingId: 'zoom-mtg-002',
    });

    expect(zoom1._id).toBeDefined();
    expect(zoom2._id).toBeDefined();
  });

  it('8. Existing meeting records remain accessible and intact', async () => {
    const created = await Meeting.create({
      title: 'Long-standing Architecture Review',
      organizationId: org1Id,
      uploadedBy: userId,
      source: 'audio_upload',
      clientName: 'Enterprise Client',
    });

    const found = await Meeting.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.title).toBe('Long-standing Architecture Review');
    expect(found.clientName).toBe('Enterprise Client');
  });
});
