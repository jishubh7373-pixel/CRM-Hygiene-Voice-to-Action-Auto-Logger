const Meeting = require('../models/Meeting');
const TranscriptSegment = require('../models/TranscriptSegment');
const aiService = require('../modules/ai/ai.service');
const { enqueueMeetingProcessing } = require('../queues/meetingQueue');
const auditService = require('./auditService');
const { emitToOrganization } = require('../socket/socketServer');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

class UnifiedMeetingIngestionService {
  /**
   * Universal Meeting Ingestion entrypoint
   * Handles de-duplication, database persistence, transcript normalization, and AI processing
   */
  async ingestMeeting({
    organizationId,
    source = 'audio_upload',
    externalProvider = null,
    externalMeetingId = null,
    externalCallId = null,
    externalAccountId = null,
    title = '',
    description = '',
    clientName = 'Client Meeting',
    clientEmail = null,
    meetingDate = new Date(),
    duration = 0,
    durationMinutes = 30,
    dealId = null,
    uploadedBy = null,
    sourceMetadata = {},
    audioReference = null,
    transcriptSegments = null,
    rawTranscript = null,
  }) {
    if (!organizationId) {
      throw new AppError('Organization ID is mandatory for meeting ingestion', 400, 'ORG_ID_REQUIRED');
    }

    const meetingTitle = title || (externalMeetingId ? `Meeting #${externalMeetingId}` : (externalCallId ? `Call #${externalCallId}` : 'Customer Meeting'));

    // 1. De-duplication check for external providers
    if (externalProvider && (externalMeetingId || externalCallId)) {
      const dedupeQuery = { organizationId, externalProvider };
      if (externalMeetingId) dedupeQuery.externalMeetingId = externalMeetingId;
      if (externalCallId) dedupeQuery.externalCallId = externalCallId;

      const existing = await Meeting.findOne(dedupeQuery);
      if (existing) {
        logger.info(`[Ingestion] Duplicate meeting detected for ${externalProvider} (ID: ${externalMeetingId || externalCallId}). Skipping redundant ingestion.`);
        return { isDuplicate: true, meeting: existing };
      }
    }

    // 2. Prepare Meeting document
    const meetingData = {
      organizationId,
      title: meetingTitle,
      description: description || '',
      clientName: clientName || 'Client Meeting',
      clientEmail: clientEmail || undefined,
      meetingDate: meetingDate || new Date(),
      scheduledStartTime: meetingDate || new Date(),
      duration: duration || (durationMinutes ? durationMinutes * 60 : 0),
      durationMinutes: durationMinutes || (duration ? Math.ceil(duration / 60) : 30),
      source,
      platform: source,
      externalProvider,
      externalMeetingId,
      externalCallId,
      externalAccountId,
      sourceMetadata,
      dealId: dealId || null,
      uploadedBy: uploadedBy || null,
      hostId: uploadedBy || null,
      importedAt: new Date(),
      processingStatus: 'pending',
      transcriptionStatus: 'pending',
      analysisStatus: 'pending',
    };

    if (audioReference) {
      meetingData.audioStorage = {
        stored: true,
        provider: audioReference.provider || 'local',
        storageProvider: audioReference.provider || 'local',
        key: audioReference.key || '',
        storageKey: audioReference.key || '',
        originalName: audioReference.originalName || 'audio.mp3',
        originalFileName: audioReference.originalName || 'audio.mp3',
        mimeType: audioReference.mimeType || 'audio/mpeg',
        sizeBytes: audioReference.sizeBytes || 0,
        fileSize: audioReference.sizeBytes || 0,
        localPath: audioReference.localPath || '',
      };
      meetingData.audioUrl = audioReference.localPath || audioReference.key || '';
    }

    const meeting = await Meeting.create(meetingData);
    logger.info(`[Ingestion] Created meeting record ${meeting._id} from source: ${source} (org: ${organizationId})`);

    // 3. Process transcripts if provided directly (e.g. Gong API, Zoom captions)
    if (Array.isArray(transcriptSegments) && transcriptSegments.length > 0) {
      const segmentsToInsert = transcriptSegments.map((seg, idx) => ({
        organizationId,
        meetingId: meeting._id,
        segmentIndex: idx,
        startTime: seg.startTime || 0,
        endTime: seg.endTime || 0,
        speaker: seg.speaker || 'Speaker',
        text: seg.text || '',
        confidence: seg.confidence || null,
      }));

      await TranscriptSegment.insertMany(segmentsToInsert);

      const generatedRaw = rawTranscript || transcriptSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n');

      await Meeting.findByIdAndUpdate(meeting._id, {
        rawTranscript: generatedRaw,
        transcriptionStatus: 'completed',
        processingStatus: 'transcription_completed',
      });

      logger.info(`[Ingestion] Stored ${segmentsToInsert.length} transcript segments for meeting ${meeting._id}. Triggering AI analysis...`);

      // Trigger AI Intelligence extraction asynchronously
      setImmediate(async () => {
        try {
          await aiService.analyzeMeetingIntelligence({
            meetingId: meeting._id.toString(),
            organizationId,
          });
          logger.info(`[Ingestion] AI Intelligence analysis completed for ingested meeting ${meeting._id}`);
        } catch (aiErr) {
          logger.error(`[Ingestion] AI Analysis failed for ingested meeting ${meeting._id}: ${aiErr.message}`);
        }
      });
    } else if (audioReference) {
      // 4. Enqueue audio processing pipeline (Whisper transcription -> AI analysis)
      await enqueueMeetingProcessing({
        meetingId: meeting._id.toString(),
        organizationId: organizationId.toString(),
        storageKey: audioReference.key,
        filename: audioReference.originalName,
        mimeType: audioReference.mimeType,
      });
    }

    // 5. Emit real-time updates and write audit log
    emitToOrganization(organizationId, 'meeting:ingested', {
      meetingId: meeting._id.toString(),
      source,
      externalProvider,
      title: meeting.title,
    });

    try {
      await auditService.log({
        organizationId,
        userId: uploadedBy,
        action: 'MEETING_INGESTED',
        entityType: 'Meeting',
        entityId: meeting._id,
        metadata: {
          source,
          externalProvider,
          externalMeetingId,
          externalCallId,
        },
      });
    } catch (auditErr) {
      logger.warn(`Audit log failed for meeting ingestion: ${auditErr.message}`);
    }

    return { isDuplicate: false, meeting };
  }
}

module.exports = new UnifiedMeetingIngestionService();
