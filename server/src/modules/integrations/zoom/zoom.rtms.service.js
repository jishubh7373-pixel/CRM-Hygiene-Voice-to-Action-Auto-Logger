const unifiedMeetingIngestion = require('../../../services/unifiedMeetingIngestion.service');
const logger = require('../../../utils/logger');
const AppError = require('../../../utils/appError');

class ZoomRtmsService {
  constructor() {
    // Map of active RTMS streaming sessions: meetingId -> sessionState
    this.activeSessions = new Map();
  }

  /**
   * Initialize a Real-Time Media Stream session for a Zoom meeting
   */
  startSession({ organizationId, meetingId, hostId = null, topic = 'Live Zoom Call' }) {
    if (!organizationId || !meetingId) {
      throw new AppError('Organization ID and Zoom Meeting ID are required for RTMS session', 400, 'PARAM_REQUIRED');
    }

    const sessionKey = `${organizationId}_${meetingId}`;
    if (this.activeSessions.has(sessionKey)) {
      logger.info(`[Zoom RTMS] Resuming existing RTMS session for meeting ${meetingId}`);
      return this.activeSessions.get(sessionKey);
    }

    const session = {
      organizationId,
      meetingId: String(meetingId),
      topic,
      hostId,
      status: 'active',
      startedAt: new Date(),
      transcriptSegments: [],
      audioChunksCount: 0,
    };

    this.activeSessions.set(sessionKey, session);
    logger.info(`[Zoom RTMS] Started live RTMS stream session for meeting ${meetingId} (org: ${organizationId})`);
    return session;
  }

  /**
   * Handle incoming live transcript or speaker caption event from RTMS
   */
  handleLiveTranscriptChunk({ organizationId, meetingId, speaker, text, timestampMs = 0 }) {
    const sessionKey = `${organizationId}_${meetingId}`;
    let session = this.activeSessions.get(sessionKey);
    if (!session) {
      session = this.startSession({ organizationId, meetingId });
    }

    const startTime = (timestampMs || Date.now() - session.startedAt.getTime()) / 1000;
    const endTime = startTime + 3.0; // Approximate window

    session.transcriptSegments.push({
      speaker: speaker || 'Participant',
      text: text || '',
      startTime,
      endTime,
      confidence: 0.9,
    });
  }

  /**
   * Conclude RTMS session and dispatch to Unified Meeting Ingestion
   */
  async finalizeSession({ organizationId, meetingId, topic = null, clientName = null }) {
    const sessionKey = `${organizationId}_${meetingId}`;
    const session = this.activeSessions.get(sessionKey);

    const now = new Date();
    const durationSeconds = session ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000) : 0;
    const segments = session ? session.transcriptSegments : [];

    logger.info(`[Zoom RTMS] Finalizing RTMS session for meeting ${meetingId}. Total segments collected: ${segments.length}`);

    const result = await unifiedMeetingIngestion.ingestMeeting({
      organizationId,
      source: 'zoom',
      externalProvider: 'zoom',
      externalMeetingId: String(meetingId),
      title: topic || session?.topic || `Zoom RTMS Meeting #${meetingId}`,
      meetingDate: session?.startedAt || now,
      duration: durationSeconds,
      durationMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
      clientName: clientName || 'Zoom Participant',
      sourceMetadata: {
        ingestionType: 'RTMS_LIVE_STREAM',
        capturedSegmentsCount: segments.length,
      },
      transcriptSegments: segments,
    });

    this.activeSessions.delete(sessionKey);
    return result;
  }

  /**
   * Get current RTMS service status
   */
  getStatus() {
    return {
      activeSessionsCount: this.activeSessions.size,
      sessions: Array.from(this.activeSessions.values()).map((s) => ({
        meetingId: s.meetingId,
        organizationId: s.organizationId,
        topic: s.topic,
        startedAt: s.startedAt,
        status: s.status,
        segmentsCount: s.transcriptSegments.length,
      })),
    };
  }
}

module.exports = new ZoomRtmsService();
