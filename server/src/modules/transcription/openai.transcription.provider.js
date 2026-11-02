const OpenAI = require('openai');
const TranscriptionProvider = require('./transcription.provider');
const config = require('../../config');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class OpenAiTranscriptionProvider extends TranscriptionProvider {
  constructor(customClient = null) {
    super();
    this.apiKey = config.ai.openAiApiKey;
    this.model = config.ai.transcriptionModel || 'whisper-1';
    this.client =
      customClient ||
      (this.apiKey
        ? new OpenAI({
            apiKey: this.apiKey,
            timeout: 60000, // 60s timeout
          })
        : null);
  }

  async transcribe({ audioBuffer, filename = 'audio.mp3', mimeType = 'audio/mpeg' }) {
    if (!this.client) {
      if (!this.apiKey) {
        throw new AppError(
          'OpenAI API key is not configured in backend environment variables (OPENAI_API_KEY).',
          500,
          'CONFIG_ERROR'
        );
      }
      this.client = new OpenAI({ apiKey: this.apiKey, timeout: 60000 });
    }

    try {
      logger.info(`Sending audio to OpenAI Transcription API (${this.model}, ${audioBuffer.length} bytes)...`);

      // Create a File object from the buffer for OpenAI SDK
      const file = await OpenAI.toFile(audioBuffer, filename, { type: mimeType });

      const response = await this.client.audio.transcriptions.create({
        file,
        model: this.model,
        response_format: 'verbose_json',
        temperature: 0.0,
      });

      const rawText = response.text || '';
      let segments = [];

      if (Array.isArray(response.segments) && response.segments.length > 0) {
        segments = response.segments.map((seg, idx) => ({
          segmentIndex: idx,
          startTime: Math.round((seg.start || 0) * 100) / 100,
          endTime: Math.round((seg.end || 0) * 100) / 100,
          speaker: 'Speaker', // OpenAI Whisper does not native diarize; strictly mark as Speaker without fabricating
          text: (seg.text || '').trim(),
          confidence: seg.avg_logprob ? Math.round(Math.exp(seg.avg_logprob) * 100) / 100 : null,
        }));
      } else if (rawText) {
        // Fallback segment if API did not split segments
        segments = [
          {
            segmentIndex: 0,
            startTime: 0,
            endTime: Math.round(response.duration || 30),
            speaker: 'Speaker',
            text: rawText.trim(),
            confidence: 0.95,
          },
        ];
      }

      logger.info(
        `OpenAI transcription successful. Extracted ${segments.length} segments, duration: ${response.duration || 'N/A'}s`
      );

      return {
        rawText,
        segments,
        metadata: {
          provider: 'openai',
          model: this.model,
          language: response.language || 'en',
          duration: response.duration || 0,
        },
      };
    } catch (err) {
      logger.error('OpenAI Transcription failed:', { error: err.message });
      throw new AppError(`Transcription provider error: ${err.message}`, 502, 'TRANSCRIPTION_FAILED');
    }
  }
}

module.exports = OpenAiTranscriptionProvider;
