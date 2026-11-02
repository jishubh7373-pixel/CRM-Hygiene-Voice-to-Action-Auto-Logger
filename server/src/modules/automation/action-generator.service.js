const AutomationAction = require('../../models/AutomationAction');
const ApprovalHistory = require('../../models/ApprovalHistory');
const AutomationSetting = require('../../models/AutomationSetting');
const Meeting = require('../../models/Meeting');
const MeetingInsight = require('../../models/MeetingInsight');
const ActionItem = require('../../models/ActionItem');
const Deal = require('../../models/Deal');
const DealMapping = require('../../models/DealMapping');
const actionValidator = require('./action-validator.service');
const { emitToOrganization } = require('../../socket/socketServer');
const logger = require('../../utils/logger');

class ActionGeneratorService {
  /**
   * Get or create automation settings for an organization
   */
  async getSettings(organizationId) {
    let settings = await AutomationSetting.findOne({ organizationId });
    if (!settings) {
      settings = await AutomationSetting.create({ organizationId });
    }
    return settings;
  }

  /**
   * Core AI Action Proposal Generator
   * Analyzes meeting insights, transcripts, and commitments to propose CRM and Jira actions
   */
  async generateActionsForMeeting({ meetingId, organizationId, userId = null }) {
    logger.info(`[Action Generator] Generating action proposals for meeting ${meetingId} (org: ${organizationId})...`);

    const settings = await this.getSettings(organizationId);
    if (!settings.proposalGenerationEnabled) {
      logger.info(`[Action Generator] Proposal generation disabled in settings for org ${organizationId}. Skipping.`);
      return { generatedCount: 0, actions: [] };
    }

    const meeting = await Meeting.findOne({ _id: meetingId, organizationId }).populate('dealId');
    if (!meeting) {
      logger.warn(`[Action Generator] Meeting ${meetingId} not found.`);
      return { generatedCount: 0, actions: [] };
    }

    const insight = await MeetingInsight.findOne({ meetingId, organizationId });
    const actionItems = await ActionItem.find({ meetingId, organizationId });

    const proposedActions = [];
    const targetDeal = meeting.dealId;
    let externalDealMapping = null;

    if (targetDeal) {
      externalDealMapping = await DealMapping.findOne({
        organizationId,
        internalDealId: targetDeal._id,
        provider: 'hubspot',
      });
    }

    // =========================================================================
    // 1. HubSpot Proposals: Deal Updates & Meeting Summary Note
    // =========================================================================
    if (settings.hubspotProposalsEnabled && targetDeal) {
      const externalHubSpotId = externalDealMapping?.externalDealId || targetDeal.crmDealId || targetDeal._id.toString();

      // A. Deal Stage & Close Date Proposal (High Risk)
      if (insight?.buyingSignals?.length > 0 || insight?.decisionCriteria?.length > 0) {
        // Find best supporting evidence quote
        const signalWithEvidence =
          insight.buyingSignals?.find((s) => s.evidence?.quote) ||
          insight.decisionCriteria?.find((c) => c.evidence?.quote);

        if (signalWithEvidence && signalWithEvidence.evidence?.quote) {
          const evidenceQuote = signalWithEvidence.evidence.quote;

          // Check if stage progression is indicated
          let proposedStage = targetDeal.stage;
          if (targetDeal.stage === 'discovery') proposedStage = 'qualification';
          else if (targetDeal.stage === 'qualification') proposedStage = 'demo';
          else if (targetDeal.stage === 'demo') proposedStage = 'proposal';
          else if (targetDeal.stage === 'proposal') proposedStage = 'negotiation';

          // Propose stage update if not already closed
          if (proposedStage !== targetDeal.stage && !['closed_won', 'closed_lost'].includes(targetDeal.stage)) {
            proposedActions.push({
              organizationId,
              meetingId: meeting._id,
              dealId: targetDeal._id,
              provider: 'hubspot',
              actionType: 'hubspot_update_deal',
              targetRecordId: externalHubSpotId,
              targetRecordName: targetDeal.name,
              title: `Update Deal Stage to ${proposedStage.toUpperCase()} for "${targetDeal.name}"`,
              description: `Meeting discussions indicated strong buying momentum. Proposing stage advance from ${targetDeal.stage} to ${proposedStage}.`,
              proposedPayload: {
                dealId: externalHubSpotId,
                stage: proposedStage,
                pipeline: 'default',
              },
              originalPayload: {
                dealId: externalHubSpotId,
                stage: targetDeal.stage,
              },
              evidence: {
                quote: evidenceQuote,
                speaker: signalWithEvidence.evidence.speaker || 'Customer',
                startTime: signalWithEvidence.evidence.startTime || 0,
                endTime: signalWithEvidence.evidence.endTime || 0,
              },
              confidence: 'high',
              riskLevel: 'high',
              reason: `Customer indicated positive buying alignment during the call: "${evidenceQuote}".`,
              approvalStatus: 'pending_approval',
              executionStatus: 'not_started',
              createdBy: userId,
            });
          }
        }
      }

      // B. HubSpot Meeting Summary Engagement Note (Low Risk)
      if (insight?.summary?.executiveSummary) {
        proposedActions.push({
          organizationId,
          meetingId: meeting._id,
          dealId: targetDeal._id,
          provider: 'hubspot',
          actionType: 'hubspot_create_note',
          targetRecordId: externalHubSpotId,
          targetRecordName: targetDeal.name,
          title: `Log Executive Call Note on HubSpot Deal "${targetDeal.name}"`,
          description: 'Auto-log sanitized meeting summary, customer requirements, and objections directly into HubSpot CRM activity feed.',
          proposedPayload: {
            dealId: externalHubSpotId,
            noteBody: `DealFlow AI Meeting Summary (${new Date(meeting.meetingDate).toLocaleDateString()}):\n\n${insight.summary.executiveSummary}\n\nKey Requirements:\n${(insight.customerRequirements || []).map((r) => `• ${r.requirement}`).join('\n')}`,
          },
          originalPayload: {},
          evidence: {
            quote: insight.summary.executiveSummary.slice(0, 150),
            speaker: 'Executive Summary',
          },
          confidence: 'high',
          riskLevel: 'low',
          reason: 'Maintaining CRM hygiene by logging structured meeting insights.',
          approvalStatus: 'pending_approval',
          executionStatus: 'not_started',
          createdBy: userId,
        });
      }
    }

    // =========================================================================
    // 2. Jira Proposals: Create Tasks for Action Items (Medium Risk)
    // =========================================================================
    if (settings.jiraProposalsEnabled && actionItems.length > 0) {
      const projectKey = settings.defaultJiraProjectKey || 'CRM';
      const issueTypeId = settings.defaultJiraIssueTypeId || '10001';

      actionItems.slice(0, settings.maxActionsPerMeeting).forEach((item) => {
        const priority = item.priority === 'high' ? 'High' : item.priority === 'low' ? 'Low' : 'Medium';
        const evidenceQuote = item.evidence?.quote || item.description || item.title;

        proposedActions.push({
          organizationId,
          meetingId: meeting._id,
          dealId: targetDeal?._id || null,
          provider: 'jira',
          actionType: 'jira_create_issue',
          targetRecordId: projectKey,
          targetRecordName: `Jira Project ${projectKey}`,
          title: `Create Jira Task: "${item.title}"`,
          description: `Commitment identified in meeting. Proposed Jira task in project ${projectKey}.`,
          proposedPayload: {
            projectKey,
            issueTypeId,
            summary: item.title,
            description: `${item.description || item.title}\n\nSource: Meeting "${meeting.title}"\nPriority: ${priority}\nOwner: ${item.assigneeName || 'Unassigned'}`,
            priority,
            dueDate: item.dueDate ? item.dueDate.toISOString().split('T')[0] : undefined,
          },
          originalPayload: {},
          evidence: {
            quote: evidenceQuote,
            speaker: item.evidence?.speaker || 'Participant',
            startTime: item.evidence?.startTime || 0,
            endTime: item.evidence?.endTime || 0,
          },
          confidence: item.confidence ? (item.confidence > 0.8 ? 'high' : 'medium') : 'medium',
          riskLevel: 'medium',
          reason: `Action item assigned to ${item.assigneeName || 'team'} extracted from meeting transcript.`,
          approvalStatus: 'pending_approval',
          executionStatus: 'not_started',
          createdBy: userId,
        });
      });
    }

    // =========================================================================
    // 3. Persist Proposed Actions & Create ApprovalHistory Entries
    // =========================================================================
    const savedActions = [];
    for (const actionData of proposedActions) {
      // Validate payload before saving
      actionValidator.validatePayload(actionData.actionType, actionData.proposedPayload);

      const savedAction = await AutomationAction.create(actionData);
      savedActions.push(savedAction);

      await ApprovalHistory.create({
        organizationId,
        actionId: savedAction._id,
        userId: userId || meeting.uploadedBy || meeting.hostId || savedAction._id,
        operation: 'created',
        previousStatus: 'none',
        newStatus: 'pending_approval',
        comments: 'AI proposed action from meeting intelligence analysis.',
        payloadSnapshot: savedAction.proposedPayload,
      });
    }

    logger.info(`[Action Generator] Generated and persisted ${savedActions.length} action proposals for meeting ${meetingId}.`);

    // Emit real-time notification
    if (savedActions.length > 0) {
      emitToOrganization(organizationId, 'automation:approval-required', {
        meetingId: meeting._id.toString(),
        count: savedActions.length,
        actions: savedActions.map((a) => ({
          id: a._id.toString(),
          title: a.title,
          provider: a.provider,
          riskLevel: a.riskLevel,
        })),
      });
    }

    return {
      generatedCount: savedActions.length,
      actions: savedActions,
    };
  }
}

module.exports = new ActionGeneratorService();
