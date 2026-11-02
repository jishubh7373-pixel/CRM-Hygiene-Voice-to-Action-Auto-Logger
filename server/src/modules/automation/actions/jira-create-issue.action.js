const jiraIssuesService = require('../../integrations/jira/jira.issues.service');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

/**
 * Execute Jira Task / Issue creation in Atlassian Document Format (ADF)
 */
const executeJiraCreateIssue = async ({ organizationId, action }) => {
  const { proposedPayload } = action;

  const projectKey = proposedPayload.projectKey || action.targetRecordId;
  const summary = proposedPayload.summary || action.title;
  const description = proposedPayload.description || '';
  const issueTypeId = proposedPayload.issueTypeId || '10001';

  if (!projectKey || !summary) {
    throw new AppError('Jira Project Key and Summary are required', 400, 'PARAM_REQUIRED');
  }

  logger.info(`[Jira Action] Creating issue in project ${projectKey}: "${summary}"`);

  const result = await jiraIssuesService.createIssue({
    organizationId,
    projectKey,
    summary,
    description,
    issueTypeId,
    labels: ['dealflow-ai', 'voice-to-action'],
  });

  return {
    externalRecordId: result.issueId,
    externalRecordKey: result.issueKey,
    externalRecordUrl: result.issueUrl,
    responseMetadata: result,
  };
};

module.exports = executeJiraCreateIssue;
