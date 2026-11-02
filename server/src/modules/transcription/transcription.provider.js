/**
 * Base Transcription Provider Interface
 */
class TranscriptionProvider {
  /**
   * Transcribe an audio file buffer
   * @param {Object} params
   * @param {Buffer} params.audioBuffer
   * @param {string} params.filename
   * @param {string} params.mimeType
   * @returns {Promise<{ rawText: string, segments: Array<{ segmentIndex: number, startTime: number, endTime: number, speaker: string, text: string, confidence: number }>, metadata: Object }>}
   */
  async transcribe(params) {
    throw new Error('transcribe method must be implemented by provider');
  }
}

module.exports = TranscriptionProvider;
