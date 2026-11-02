const Meeting = require('../src/models/Meeting');
const TranscriptSegment = require('../src/models/TranscriptSegment');
const Organization = require('../src/models/Organization');
const User = require('../src/models/User');
const transcriptionService = require('../src/modules/transcription/transcription.service');
const TranscriptionProvider = require('../src/modules/transcription/transcription.provider');
require('./setup');

// Mock Transcription Provider for unit & integration testing
class MockWhisperProvider extends TranscriptionProvider {
  constructor(mockSegments = null) {
    super();
    this.mockSegments = mockSegments || [
      {
        segmentIndex: 0,
        startTime: 0.0,
        endTime: 4.5,
        text: 'Good morning, thanks for taking the time to join our architectural deep-dive.',
        speaker: 'Speaker',
        confidence: 0.98,
      },
      {
        segmentIndex: 1,
        startTime: 4.6,
        endTime: 10.2,
        text: 'We are currently reviewing our CRM hygiene solutions and evaluating DealFlow AI.',
        speaker: 'Speaker',
        confidence: 0.96,
      },
      {
        segmentIndex: 2,
        startTime: 10.5,
        endTime: 16.0,
        text: 'Our budget is approved at 150k for Q1 if SOC2 compliance criteria are met.',
        speaker: 'Speaker',
        confidence: 0.94,
      },
    ];
  }

  async transcribe({ audioBuffer, filename, mimeType }) {
    return {
      rawText: this.mockSegments.map((s) => s.text).join(' '),
      segments: this.mockSegments,
      metadata: {
        duration: 16.0,
        language: 'en',
      },
    };
  }
}

describe('Whisper Transcription Engine & Segment Persistence', () => {
  let orgId;
  let userId;
  let testMeeting;

  beforeEach(async () => {
    const org = await Organization.create({
      name: 'Transcription Test Org',
      domain: 'transcribe.org',
    });
    orgId = org._id;

    const user = await User.create({
      name: 'Transcribe User',
      email: 'user@transcribe.org',
      password: 'HashedPassword123!',
      organizationId: orgId,
      role: 'rep',
    });
    userId = user._id;

    testMeeting = await Meeting.create({
      organizationId: orgId,
      hostId: userId,
      uploadedBy: userId,
      title: 'Technical Discovery Call',
      clientName: 'Enterprise Client Co',
      platform: 'upload',
      source: 'audio_upload',
      audioStorage: {
        stored: true,
        storageProvider: 'local',
        provider: 'local',
        key: `${orgId}/mock_audio.mp3`,
        originalFileName: 'mock_audio.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 1024,
      },
      processingStatus: 'processing',
      transcriptionStatus: 'processing',
    });
  });

  it('should process audio buffer, create ordered segments, and update meeting', async () => {
    const mockProvider = new MockWhisperProvider();
    transcriptionService.setProvider(mockProvider);

    const dummyAudioBuffer = Buffer.from('mock-audio-bytes');
    const result = await transcriptionService.processMeetingAudio({
      meetingId: testMeeting._id,
      organizationId: orgId,
      audioBuffer: dummyAudioBuffer,
      filename: 'discovery.mp3',
      mimeType: 'audio/mpeg',
    });

    expect(result.segments.length).toBe(3);
    expect(result.metadata.duration).toBe(16.0);
    expect(result.rawText).toContain('Good morning');
    expect(result.rawText).toContain('SOC2 compliance');

    // Verify database segments
    const segments = await TranscriptSegment.find({
      meetingId: testMeeting._id,
      organizationId: orgId,
    }).sort({ segmentIndex: 1 });

    expect(segments.length).toBe(3);
    expect(segments[0].segmentIndex).toBe(0);
    expect(segments[0].startTime).toBe(0.0);
    expect(segments[0].endTime).toBe(4.5);
    expect(segments[0].speaker).toBe('Speaker');
    expect(segments[0].confidence).toBeGreaterThan(0.9);

    // Verify meeting status updated
    const updatedMeeting = await Meeting.findById(testMeeting._id);
    expect(updatedMeeting.transcriptionStatus).toBe('completed');
    expect(updatedMeeting.rawTranscript).toContain('Good morning');
  });

  it('should validate segment timestamps and reject inverted intervals', async () => {
    const invalidSegments = [
      {
        segmentIndex: 0,
        startTime: 10.0,
        endTime: 5.0, // Invalid: endTime < startTime
        text: 'Invalid segment interval.',
        speaker: 'Speaker',
      },
    ];

    const invalidProvider = new MockWhisperProvider(invalidSegments);
    transcriptionService.setProvider(invalidProvider);

    await expect(
      transcriptionService.processMeetingAudio({
        meetingId: testMeeting._id,
        organizationId: orgId,
        audioBuffer: Buffer.from('audio'),
        filename: 'call.mp3',
        mimeType: 'audio/mpeg',
      })
    ).rejects.toThrow();

    const meetingAfterFail = await Meeting.findById(testMeeting._id);
    expect(meetingAfterFail.transcriptionStatus).toBe('processing'); // failed at validation
  });

  it('should not fabricate speaker identities and default to Speaker if unspecified', async () => {
    const unnamedSegments = [
      {
        segmentIndex: 0,
        startTime: 0.0,
        endTime: 2.0,
        text: 'Hello there without speaker diarization.',
      },
    ];

    const provider = new MockWhisperProvider(unnamedSegments);
    transcriptionService.setProvider(provider);

    await transcriptionService.processMeetingAudio({
      meetingId: testMeeting._id,
      organizationId: orgId,
      audioBuffer: Buffer.from('audio'),
      filename: 'call.mp3',
      mimeType: 'audio/mpeg',
    });

    const segment = await TranscriptSegment.findOne({ meetingId: testMeeting._id });
    expect(segment.speaker).toBe('Speaker');
  });
});
