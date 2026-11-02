const AppError = require('../../../utils/appError');
const logger = require('../../../utils/logger');

class JiraService {
  /**
   * Get accessible Jira Cloud resources/sites
   */
  async getAccessibleResources(accessToken) {
    if (!accessToken) {
      throw new AppError('Jira access token is required', 401, 'JIRA_UNAUTHORIZED');
    }

    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Jira accessible resources query failed (${res.status}): ${errText}`);
      throw new AppError('Failed to fetch accessible Jira sites', res.status, 'JIRA_SITES_FAILED');
    }

    return res.json();
  }

  /**
   * Search projects in a specific Jira Cloud site
   */
  async getProjects(accessToken, cloudId) {
    if (!accessToken || !cloudId) {
      throw new AppError('Access token and Cloud ID are required', 400, 'PARAM_REQUIRED');
    }

    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Jira project search failed (${res.status}): ${errText}`);
      throw new AppError('Failed to fetch Jira projects', res.status, 'JIRA_PROJECTS_FAILED');
    }

    return res.json();
  }

  /**
   * Get issue types for a site
   */
  async getIssueTypes(accessToken, cloudId) {
    if (!accessToken || !cloudId) {
      throw new AppError('Access token and Cloud ID are required', 400, 'PARAM_REQUIRED');
    }

    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issuetype`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new AppError('Failed to fetch Jira issue types', res.status, 'JIRA_ISSUETYPES_FAILED');
    }

    return res.json();
  }

  /**
   * Get priorities for a site
   */
  async getPriorities(accessToken, cloudId) {
    if (!accessToken || !cloudId) {
      throw new AppError('Access token and Cloud ID are required', 400, 'PARAM_REQUIRED');
    }

    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/priority`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new AppError('Failed to fetch Jira priorities', res.status, 'JIRA_PRIORITIES_FAILED');
    }

    return res.json();
  }
}

module.exports = new JiraService();
