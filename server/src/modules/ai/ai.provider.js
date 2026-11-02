/**
 * Base AI Analysis Provider Interface
 */
class AiProvider {
  /**
   * Analyze meeting transcript and return raw parsed object
   * @param {Object} params
   * @param {string} params.meetingTitle
   * @param {string} params.clientName
   * @param {string} params.rawTranscript
   * @param {Array} params.segments
   * @returns {Promise<{ analysis: Object, usage: Object }>}
   */
  async analyzeMeeting(params) {
    throw new Error('analyzeMeeting method must be implemented by provider');
  }
}

module.exports = AiProvider;
