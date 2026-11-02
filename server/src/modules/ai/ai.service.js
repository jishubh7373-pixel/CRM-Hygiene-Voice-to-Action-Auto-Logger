const OpenAiProvider = require('./openai.provider');
const { validateAndCleanMeetingAnalysis } = require('./validators/meeting-analysis.schema');
const dealHealthService = require('../intelligence/dealHealth.service');
const Meeting = require('../../models/Meeting');
const TranscriptSegment = require('../../models/TranscriptSegment');
const MeetingInsight = require('../../models/MeetingInsight');
const ActionItem = require('../../models/ActionItem');
const Deal = require('../../models/Deal');
const { emitToOrganization } = require('../../socket/socketServer');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class AiService {
  constructor(customProvider = null) {
    this.provider = customProvider || new OpenAiProvider();
  }

  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Run full meeting intelligence extraction
   */
  async analyzeMeetingIntelligence({ meetingId, organizationId }) {
    logger.info(`Starting AI intelligence analysis for meeting ${meetingId} (org: ${organizationId})...`);

    // 1. Fetch meeting and segments
    const meeting = await Meeting.findOne({ _id: meetingId, organizationId });
    if (!meeting) {
      throw new AppError('Meeting record not found for analysis.', 404, 'MEETING_NOT_FOUND');
    }

    const segments = await TranscriptSegment.find({ meetingId, organizationId }).sort({ segmentIndex: 1 }).lean();
    const rawTranscript = meeting.rawTranscript || segments.map((s) => s.text).join(' ');

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      throw new AppError('No transcript available to analyze.', 400, 'TRANSCRIPT_EMPTY');
    }

    // 2. Mark status as analyzing
    await Meeting.findOneAndUpdate(
      { _id: meetingId, organizationId },
      {
        analysisStatus: 'processing',
        processingStatus: 'analyzing',
      }
    );

    emitToOrganization(organizationId, 'meeting:analysis-started', {
      meetingId: meeting._id.toString(),
      status: 'analyzing',
    });

    try {
      // 3. Call AI provider
      const aiResult = await this.provider.analyzeMeeting({
        meetingTitle: meeting.title,
        clientName: meeting.clientName,
        rawTranscript,
        segments,
      });

      // 4. Validate and clean AI output
      const cleanedData = validateAndCleanMeetingAnalysis(aiResult.analysis, rawTranscript);

      // 5. Calculate Explainable Deal Health Score
      const dealHealth = dealHealthService.calculateHealthScore(cleanedData);

      // 6. Save or update MeetingInsight document
      const insightDoc = await MeetingInsight.findOneAndUpdate(
        { meetingId, organizationId },
        {
          organizationId,
          meetingId,
          summary: cleanedData.summary,
          decisionCriteria: cleanedData.decisionCriteria,
          buyingSignals: cleanedData.buyingSignals,
          objections: cleanedData.objections,
          risks: cleanedData.risks,
          competitors: cleanedData.competitors,
          actionItems: cleanedData.actionItems,
          dealHealth,
          modelMetadata: {
            transcriptionModel: meeting.audioStorage?.model || 'whisper-1',
            analysisModel: aiResult.usage?.model || 'gpt-4o-mini',
            promptTokens: aiResult.usage?.promptTokens || 0,
            completionTokens: aiResult.usage?.completionTokens || 0,
            totalTokens: aiResult.usage?.totalTokens || 0,
          },
          promptVersion: 'v2.0',
          analysisVersion: 'v2.0',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 7. Synchronize extracted action items to ActionItem collection
      if (cleanedData.actionItems.length > 0) {
        // Clear previous action items from this meeting to prevent duplicate generation
        await ActionItem.deleteMany({ meetingId, organizationId });

        const actionItemDocs = cleanedData.actionItems.map((item) => ({
          organizationId,
          meetingId,
          dealId: meeting.dealId || null,
          title: item.title,
          description: item.description,
          assignedTo: item.assignedTo,
          responsibleParty: item.responsibleParty,
          dueDate: item.dueDate || new Date(Date.now() + 3 * 86400000), // Default 3 days if not stated
          priority: item.priority || 'medium',
          evidence: item.evidence,
          status: 'pending',
          crmSyncStatus: 'not_synced',
        }));

        await ActionItem.insertMany(actionItemDocs);
        logger.info(`Generated ${actionItemDocs.length} action items from meeting ${meetingId}`);

        emitToOrganization(organizationId, 'action-item:created', {
          meetingId: meeting._id.toString(),
          count: actionItemDocs.length,
        });
      }

      // 8. Update Deal Hygiene and Health if meeting is linked to a Deal
      if (meeting.dealId) {
        const deal = await Deal.findOne({ _id: meeting.dealId, organizationId });
        if (deal) {
          const newHygieneScore = Math.round((deal.hygieneScore + dealHealth.totalScore) / 2);
          const hygieneStatus = newHygieneScore >= 75 ? 'healthy' : newHygieneScore >= 50 ? 'at_risk' : 'stale';

          await Deal.findOneAndUpdate(
            { _id: meeting.dealId, organizationId },
            {
              hygieneScore: newHygieneScore,
              hygieneStatus,
              lastActivityDate: new Date(),
            }
          );

          emitToOrganization(organizationId, 'deal:health-updated', {
            dealId: meeting.dealId.toString(),
            hygieneScore: newHygieneScore,
            hygieneStatus,
          });
        }
      }

      // 9. Update Meeting Status to Completed
      const legacySummary = {
        overview: cleanedData.summary.executiveSummary || cleanedData.summary.purpose || '',
        sentiment: cleanedData.objections.length === 0 ? 'positive' : 'neutral',
        keyPoints: cleanedData.summary.discussionPoints || [],
        objections: cleanedData.objections.map((o) => o.objection) || [],
        nextSteps: cleanedData.summary.nextSteps || [],
      };

      await Meeting.findOneAndUpdate(
        { _id: meetingId, organizationId },
        {
          analysisStatus: 'completed',
          processingStatus: 'completed',
          status: 'completed',
          summary: legacySummary,
          errorDetails: null,
        }
      );

      emitToOrganization(organizationId, 'meeting:analysis-completed', {
        meetingId: meeting._id.toString(),
        totalScore: dealHealth.totalScore,
        status: 'completed',
      });

      logger.info(`AI Intelligence analysis successfully completed for meeting ${meetingId}`);

      // Phase 4: Automatically propose actions for human review in Approval Center
      setImmediate(async () => {
        try {
          const actionGenerator = require('../automation/action-generator.service');
          await actionGenerator.generateActionsForMeeting({
            meetingId: meeting._id.toString(),
            organizationId,
          });
        } catch (genErr) {
          logger.warn(`Could not auto-generate action proposals: ${genErr.message}`);
        }
      });

      return {
        insight: insightDoc,
        dealHealth,
      };
    } catch (err) {
      logger.error(`AI analysis failed for meeting ${meetingId}: ${err.message}`);

      await Meeting.findOneAndUpdate(
        { _id: meetingId, organizationId },
        {
          analysisStatus: 'failed',
          processingStatus: 'failed',
          errorDetails: {
            stage: 'ai_analysis',
            message: err.message,
            timestamp: new Date(),
          },
        }
      );

      emitToOrganization(organizationId, 'meeting:failed', {
        meetingId: meeting._id.toString(),
        stage: 'ai_analysis',
        error: err.message,
      });

      throw err;
    }
  }

  /**
   * Fetch meeting insights
   */
  async getMeetingInsights(meetingId, organizationId) {
    return MeetingInsight.findOne({ meetingId, organizationId })
      .populate('reviewMetadata.reviewedBy', 'name email')
      .lean();
  }

  /**
   * Human Review: Update / edit meeting insights
   */
  async updateMeetingInsights({ meetingId, organizationId, updateData, userId }) {
    const existing = await MeetingInsight.findOne({ meetingId, organizationId });
    if (!existing) {
      throw new AppError('Insights not found for this meeting.', 404, 'NOT_FOUND');
    }

    const { summary, decisionCriteria, buyingSignals, objections, risks, competitors, reviewStatus } = updateData;

    const updates = {};
    if (summary) updates.summary = summary;
    if (decisionCriteria) updates.decisionCriteria = decisionCriteria;
    if (buyingSignals) updates.buyingSignals = buyingSignals;
    if (objections) updates.objections = objections;
    if (risks) updates.risks = risks;
    if (competitors) updates.competitors = competitors;

    updates['reviewMetadata.reviewedBy'] = userId;
    updates['reviewMetadata.reviewedAt'] = new Date();
    updates['reviewMetadata.isReviewed'] = true;
    if (reviewStatus) updates['reviewMetadata.reviewStatus'] = reviewStatus;

    return MeetingInsight.findOneAndUpdate(
      { meetingId, organizationId },
      { $set: updates },
      { new: true, runValidators: true }
    );
  }
}

module.exports = new AiService();
