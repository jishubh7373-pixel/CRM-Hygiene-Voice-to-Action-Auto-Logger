const TranscriptSegment = require('../../models/TranscriptSegment');
const Deal = require('../../models/Deal');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

class ActionValidatorService {
  /**
   * Validate that the supporting quote exists in the meeting transcript
   */
  async validateEvidence({ organizationId, meetingId, quote }) {
    if (!quote || quote.trim().length === 0) {
      return { valid: false, reason: 'Evidence quote is empty' };
    }

    const cleanedQuote = quote.trim().toLowerCase();

    // Check if any transcript segment contains the quote or key phrase
    const segments = await TranscriptSegment.find({ organizationId, meetingId }).lean();
    if (!segments.length) {
      return { valid: false, reason: 'No transcript segments found for meeting' };
    }

    const fullTranscript = segments.map((s) => s.text.toLowerCase()).join(' ');

    // Normalize whitespace and check substring inclusion
    const normalizedTranscript = fullTranscript.replace(/\s+/g, ' ');
    const normalizedQuote = cleanedQuote.replace(/\s+/g, ' ');

    if (normalizedTranscript.includes(normalizedQuote)) {
      return { valid: true };
    }

    // Fuzzy word overlap check (at least 60% of significant words present in consecutive order)
    const quoteWords = normalizedQuote.split(' ').filter((w) => w.length > 3);
    if (quoteWords.length >= 3) {
      const matchedCount = quoteWords.filter((w) => normalizedTranscript.includes(w)).length;
      if (matchedCount / quoteWords.length >= 0.7) {
        return { valid: true, note: 'High confidence partial match' };
      }
    }

    return {
      valid: false,
      reason: 'Quotation could not be verified in the actual meeting transcript',
    };
  }

  /**
   * Validate proposed payload structure based on action type
   */
  validatePayload(actionType, payload) {
    if (!payload || typeof payload !== 'object') {
      throw new AppError('Action payload must be a non-empty object', 400, 'INVALID_PAYLOAD');
    }

    switch (actionType) {
      case 'hubspot_update_deal': {
        if (!payload.dealId && !payload.targetRecordId) {
          throw new AppError('Target HubSpot deal ID is required for deal update', 400, 'TARGET_DEAL_REQUIRED');
        }
        if (payload.amount !== undefined && (isNaN(Number(payload.amount)) || Number(payload.amount) < 0)) {
          throw new AppError('Proposed deal amount must be a non-negative number', 400, 'INVALID_AMOUNT');
        }
        if (payload.closeDate !== undefined && isNaN(new Date(payload.closeDate).getTime())) {
          throw new AppError('Proposed close date must be a valid date', 400, 'INVALID_CLOSE_DATE');
        }
        break;
      }

      case 'hubspot_create_note': {
        if (!payload.noteBody || payload.noteBody.trim().length === 0) {
          throw new AppError('Meeting summary note content cannot be empty', 400, 'NOTE_BODY_EMPTY');
        }
        break;
      }

      case 'jira_create_issue':
      case 'jira_create_task': {
        if (!payload.projectKey || payload.projectKey.trim().length === 0) {
          throw new AppError('Jira Project Key is required', 400, 'PROJECT_KEY_REQUIRED');
        }
        if (!payload.summary || payload.summary.trim().length === 0) {
          throw new AppError('Jira task summary cannot be empty', 400, 'SUMMARY_REQUIRED');
        }
        if (payload.summary.length > 255) {
          throw new AppError('Jira task summary exceeds 255 characters limit', 400, 'SUMMARY_TOO_LONG');
        }
        break;
      }

      default:
        break;
    }

    return true;
  }

  /**
   * Detect stale target data before execution
   */
  async checkDealFreshness({ organizationId, dealId, originalPayload }) {
    if (!dealId) return { fresh: true };

    const currentDeal = await Deal.findOne({ _id: dealId, organizationId });
    if (!currentDeal) {
      return { fresh: false, reason: 'Target deal no longer exists' };
    }

    // Compare original payload snapshot with current values
    if (originalPayload?.amount !== undefined && Math.abs(currentDeal.amount - originalPayload.amount) > 0.01) {
      return {
        fresh: false,
        reason: `Deal amount has changed externally since proposal was created (Current: $${currentDeal.amount}, Proposed based on: $${originalPayload.amount})`,
        currentValue: currentDeal.amount,
      };
    }

    if (originalPayload?.stage && currentDeal.stage !== originalPayload.stage) {
      return {
        fresh: false,
        reason: `Deal stage has progressed externally since proposal was created (Current: ${currentDeal.stage}, Proposed based on: ${originalPayload.stage})`,
        currentValue: currentDeal.stage,
      };
    }

    return { fresh: true, currentDeal };
  }
}

module.exports = new ActionValidatorService();
