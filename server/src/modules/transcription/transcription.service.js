const OpenAiTranscriptionProvider = require('./openai.transcription.provider');
const { validateTranscriptionResult } = require('./transcription.validator');
const TranscriptSegment = require('../../models/TranscriptSegment');
const Meeting = require('../../models/Meeting');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class TranscriptionService {
  constructor(customProvider = null) {
    this.provider = customProvider || new OpenAiTranscriptionProvider();
  }

  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Process and store transcript for a meeting
   */
  async processMeetingAudio({ meetingId, organizationId, audioBuffer, filename, mimeType }) {
    logger.info(`Starting transcription for meeting ${meetingId} (org: ${organizationId})...`);

    // 1. Update meeting status
    await Meeting.findOneAndUpdate(
      { _id: meetingId, organizationId },
      {
        transcriptionStatus: 'processing',
        processingStatus: 'transcribing',
      }
    );

    // 2. Call provider
    const result = await this.provider.transcribe({
      audioBuffer,
      filename,
      mimeType,
    });

    // 3. Validate result
    validateTranscriptionResult(result);

    // 4. Clear any previous segments for idempotency / reprocessing
    await TranscriptSegment.deleteMany({ meetingId, organizationId });

    // 5. Bulk insert segments into MongoDB
    const segmentDocs = result.segments.map((seg, idx) => ({
      organizationId,
      meetingId,
      segmentIndex: seg.segmentIndex !== undefined ? seg.segmentIndex : idx,
      startTime: seg.startTime,
      endTime: seg.endTime,
      speaker: seg.speaker || 'Speaker',
      text: seg.text,
      confidence: seg.confidence,
    }));

    await TranscriptSegment.insertMany(segmentDocs);

    // 6. Update Meeting record
    const durationSec = result.metadata?.duration || (result.segments.length > 0 ? result.segments[result.segments.length - 1].endTime : 0);
    const durationMin = Math.max(1, Math.round(durationSec / 60));

    await Meeting.findOneAndUpdate(
      { _id: meetingId, organizationId },
      {
        rawTranscript: result.rawText,
        duration: durationSec,
        durationMinutes: durationMin,
        transcriptionStatus: 'completed',
      }
    );

    logger.info(`Saved ${segmentDocs.length} transcript segments for meeting ${meetingId}`);

    return {
      rawText: result.rawText,
      segments: segmentDocs,
      metadata: result.metadata,
    };
  }

  /**
   * Retrieve transcript segments for a meeting
   */
  async getMeetingTranscript(meetingId, organizationId) {
    return TranscriptSegment.find({ meetingId, organizationId }).sort({ segmentIndex: 1 }).lean();
  }
}

module.exports = new TranscriptionService();
