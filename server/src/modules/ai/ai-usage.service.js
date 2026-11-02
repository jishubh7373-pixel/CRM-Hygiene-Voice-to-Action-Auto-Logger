/**
 * DealFlow AI — AI Usage Analytics & Cost Estimation Service
 * Provides token tracking, model rate-based cost calculations, and tenant quotas
 */
const MeetingInsight = require('../../models/MeetingInsight');
const Meeting = require('../../models/Meeting');

// Pricing per token / minute in USD
const PRICING_RATES = {
  'gpt-4o-mini': {
    promptPerToken: 0.00000015, // $0.15 / 1M tokens
    completionPerToken: 0.0000006, // $0.60 / 1M tokens
  },
  'gpt-4o': {
    promptPerToken: 0.0000025, // $2.50 / 1M tokens
    completionPerToken: 0.00001, // $10.00 / 1M tokens
  },
  'whisper-1': {
    perMinute: 0.006, // $0.006 per minute
    perSecond: 0.0001,
  },
};

/**
 * Calculate estimated USD cost for a meeting's transcription and analysis
 */
const calculateMeetingAiCost = ({ analysisModel = 'gpt-4o-mini', promptTokens = 0, completionTokens = 0, durationSeconds = 0 }) => {
  const modelRates = PRICING_RATES[analysisModel] || PRICING_RATES['gpt-4o-mini'];
  const whisperRate = PRICING_RATES['whisper-1'];

  const analysisCost = (promptTokens * modelRates.promptPerToken) + (completionTokens * modelRates.completionPerToken);
  const transcriptionCost = (durationSeconds || 0) * whisperRate.perSecond;

  const totalCost = analysisCost + transcriptionCost;

  return {
    analysisCostUsd: Number(analysisCost.toFixed(6)),
    transcriptionCostUsd: Number(transcriptionCost.toFixed(6)),
    totalCostUsd: Number(totalCost.toFixed(6)),
  };
};

/**
 * Get aggregated AI usage metrics for an organization
 */
const getOrganizationAiUsage = async (organizationId) => {
  // 1. Query all insights with token usage
  const insights = await MeetingInsight.find({ organizationId }).select('modelMetadata createdAt').lean();

  // 2. Query all meetings with status and audio duration
  const meetings = await Meeting.find({ organizationId }).select('processingStatus analysisStatus durationSeconds audioStorage.durationSeconds createdAt').lean();

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalAudioSeconds = 0;
  let successfulAiJobs = 0;
  let failedAiJobs = 0;

  for (const insight of insights) {
    if (insight.modelMetadata) {
      totalPromptTokens += insight.modelMetadata.promptTokens || 0;
      totalCompletionTokens += insight.modelMetadata.completionTokens || 0;
    }
  }

  for (const meeting of meetings) {
    const duration = meeting.durationSeconds || meeting.audioStorage?.durationSeconds || 0;
    totalAudioSeconds += duration;

    if (meeting.analysisStatus === 'completed' || meeting.processingStatus === 'completed') {
      successfulAiJobs++;
    } else if (meeting.analysisStatus === 'failed' || meeting.processingStatus === 'failed') {
      failedAiJobs++;
    }
  }

  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const totalAudioMinutes = Number((totalAudioSeconds / 60).toFixed(1));

  const cost = calculateMeetingAiCost({
    analysisModel: 'gpt-4o-mini',
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    durationSeconds: totalAudioSeconds,
  });

  return {
    organizationId,
    metrics: {
      totalMeetings: meetings.length,
      processedMeetings: successfulAiJobs,
      failedMeetings: failedAiJobs,
      totalAudioMinutes,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      estimatedCost: cost,
    },
    quotas: {
      monthlyAudioMinutesLimit: 1000,
      monthlyTokensLimit: 5000000,
      audioMinutesUsedPercent: Math.min(100, Number(((totalAudioMinutes / 1000) * 100).toFixed(1))),
      tokensUsedPercent: Math.min(100, Number(((totalTokens / 5000000) * 100).toFixed(1))),
    },
    models: {
      transcription: 'whisper-1',
      analysis: 'gpt-4o-mini',
      promptVersion: 'v2.0',
    },
  };
};

module.exports = {
  PRICING_RATES,
  calculateMeetingAiCost,
  getOrganizationAiUsage,
};
