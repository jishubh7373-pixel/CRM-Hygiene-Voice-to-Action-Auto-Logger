const OpenAI = require('openai');
const AiProvider = require('./ai.provider');
const { SYSTEM_PROMPT, buildAnalysisUserPrompt } = require('./prompts/meeting-analysis.prompt');
const config = require('../../config');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class OpenAiProvider extends AiProvider {
  constructor(customClient = null) {
    super();
    this.apiKey = config.ai.openAiApiKey;
    this.model = config.ai.analysisModel || 'gpt-4o-mini';
    this.client =
      customClient ||
      (this.apiKey
        ? new OpenAI({
            apiKey: this.apiKey,
            timeout: 90000, // 90s timeout
          })
        : null);
  }

  async analyzeMeeting({ meetingTitle, clientName, rawTranscript, segments }) {
    if (!this.client) {
      if (!this.apiKey) {
        throw new AppError(
          'OpenAI API key is not configured in backend environment variables (OPENAI_API_KEY).',
          500,
          'CONFIG_ERROR'
        );
      }
      this.client = new OpenAI({ apiKey: this.apiKey, timeout: 90000 });
    }

    try {
      const userPrompt = buildAnalysisUserPrompt({
        meetingTitle,
        clientName,
        rawTranscript,
        segments,
      });

      logger.info(`Invoking OpenAI Analysis API (${this.model})...`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Minimal hallucination
      });

      const choice = response.choices?.[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new AppError('OpenAI returned an empty response content.', 502, 'AI_EMPTY_RESPONSE');
      }

      let parsed;
      try {
        parsed = JSON.parse(choice.message.content);
      } catch (jsonErr) {
        throw new AppError(`Failed to parse AI JSON response: ${jsonErr.message}`, 502, 'AI_JSON_PARSE_ERROR');
      }

      return {
        analysis: parsed,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
          model: this.model,
        },
      };
    } catch (err) {
      logger.error('OpenAI Analysis request failed:', { error: err.message });
      throw new AppError(`AI Intelligence analysis failed: ${err.message}`, 502, 'AI_ANALYSIS_FAILED');
    }
  }
}

module.exports = OpenAiProvider;
