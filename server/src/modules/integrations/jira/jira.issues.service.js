const integrationsService = require('../integrations.service');
const jiraOAuth = require('./jira.oauth');
const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class JiraIssuesService {
  /**
   * Format text into valid Atlassian Document Format (ADF) v1
   */
  formatADF(text) {
    if (!text) {
      return {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Created via DealFlow AI' }],
          },
        ],
      };
    }

    const paragraphs = text
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const content = paragraphs.map((paragraphText) => ({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: paragraphText,
        },
      ],
    }));

    return {
      type: 'doc',
      version: 1,
      content: content.length > 0 ? content : [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: text }],
        },
      ],
    };
  }

  /**
   * Ensure fresh access token, auto-refreshing if expired or near expiry
   */
  async getValidAccessToken(organizationId) {
    const creds = await integrationsService.getDecryptedCredentials(organizationId, 'jira');
    if (!creds || !creds.tokens || !creds.tokens.accessToken) {
      throw new AppError('Jira is not connected or credentials missing', 400, 'JIRA_NOT_CONNECTED');
    }

    const { tokens } = creds;
    const now = Date.now();
    const expiryTime = (tokens.obtainedAt || 0) + (tokens.expiresIn || 3600) * 1000;

    if (now > expiryTime - 120000 && tokens.refreshToken) {
      logger.info(`[Jira Issues] Access token expired or near expiry for org ${organizationId}. Refreshing token...`);
      try {
        const refreshedTokens = await jiraOAuth.refreshAccessToken(tokens.refreshToken);
        creds.tokens = refreshedTokens;
        await integrationsService.saveEncryptedCredentials({
          organizationId,
          provider: 'jira',
          credentials: creds,
          externalAccountId: creds.cloudId || '',
          externalAccountName: creds.siteName || 'Jira Cloud',
        });
        return { accessToken: refreshedTokens.accessToken, cloudId: creds.cloudId };
      } catch (refreshErr) {
        logger.error(`[Jira Issues] Failed to refresh token: ${refreshErr.message}`);
        await integrationsService.recordError(organizationId, 'jira', refreshErr);
        throw refreshErr;
      }
    }

    return { accessToken: tokens.accessToken, cloudId: creds.cloudId };
  }

  /**
   * Create an Issue in Jira Cloud using REST API v3 and Atlassian Document Format (ADF)
   */
  async createIssue({
    organizationId,
    cloudId: targetCloudId = null,
    projectKey,
    summary,
    description = '',
    issueTypeId = '10001', // Default Task type
    priorityId = null,
    labels = ['dealflow-ai'],
  }) {
    if (!projectKey || !summary) {
      throw new AppError('Project key and issue summary are required', 400, 'PARAM_REQUIRED');
    }

    const { accessToken, cloudId: storedCloudId } = await this.getValidAccessToken(organizationId);
    const cloudId = targetCloudId || storedCloudId;

    if (!cloudId) {
      throw new AppError('No Jira Cloud site ID configured for this organization', 400, 'JIRA_CLOUD_ID_REQUIRED');
    }

    const adfDescription = this.formatADF(description);

    const issuePayload = {
      fields: {
        project: {
          key: projectKey,
        },
        summary,
        description: adfDescription,
        issuetype: {
          id: issueTypeId,
        },
        labels: Array.isArray(labels) ? labels : ['dealflow-ai'],
      },
    };

    if (priorityId) {
      issuePayload.fields.priority = { id: priorityId };
    }

    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(issuePayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Jira issue creation failed (${res.status}): ${errText}`);
      throw new AppError(`Jira API error: ${errText}`, res.status, 'JIRA_ISSUE_CREATION_FAILED');
    }

    const data = await res.json();
    logger.info(`[Jira Issues] Created Jira issue ${data.key} (ID: ${data.id}) for org ${organizationId}`);

    return {
      issueId: data.id,
      issueKey: data.key,
      issueUrl: data.self,
    };
  }

  /**
   * Test issue creation flow for settings validation
   */
  async testIssueCreation({ organizationId, projectKey, issueTypeId }) {
    const timestamp = new Date().toISOString();
    return this.createIssue({
      organizationId,
      projectKey,
      issueTypeId: issueTypeId || '10001',
      summary: `[DealFlow AI] Verified Connection Test - ${timestamp}`,
      description: 'This is an automated test issue generated by DealFlow AI to verify write permissions and ADF format compatibility.',
      labels: ['dealflow-ai', 'integration-test'],
    });
  }
}

module.exports = new JiraIssuesService();
