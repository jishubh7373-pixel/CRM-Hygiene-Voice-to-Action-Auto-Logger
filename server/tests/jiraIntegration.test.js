const jiraOAuth = require('../src/modules/integrations/jira/jira.oauth');
const jiraIssuesService = require('../src/modules/integrations/jira/jira.issues.service');
const jiraService = require('../src/modules/integrations/jira/jira.service');
const integrationsService = require('../src/modules/integrations/integrations.service');
require('./setup');

describe('Jira Cloud Integration & Atlassian Document Format (ADF)', () => {
  const organizationId = '60c72b2f9b1d8b2bad000001';
  const userId = '60c72b2f9b1d8b2bad000002';

  describe('Atlassian 3LO OAuth URL Generation', () => {
    it('should generate valid Atlassian 3LO URL containing audience and signed state', () => {
      const authUrl = jiraOAuth.getAuthorizationUrl({
        organizationId,
        userId,
      });

      expect(authUrl).toContain('https://auth.atlassian.com/authorize');
      expect(authUrl).toContain('audience=api.atlassian.com');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain('state=');
      expect(authUrl).toContain('prompt=consent');
    });
  });

  describe('Atlassian Document Format (ADF) Generator', () => {
    it('should format multiline text into valid ADF v1 JSON structure', () => {
      const text = 'Send contract to Acme Corp.\nFollow up with legal on indemnification clauses.';
      const adf = jiraIssuesService.formatADF(text);

      expect(adf.type).toBe('doc');
      expect(adf.version).toBe(1);
      expect(Array.isArray(adf.content)).toBe(true);
      expect(adf.content.length).toBe(2);

      // Paragraph 1
      expect(adf.content[0].type).toBe('paragraph');
      expect(adf.content[0].content[0].text).toBe('Send contract to Acme Corp.');

      // Paragraph 2
      expect(adf.content[1].type).toBe('paragraph');
      expect(adf.content[1].content[0].text).toBe('Follow up with legal on indemnification clauses.');
    });

    it('should safely handle empty or null text without failing ADF compliance', () => {
      const adf = jiraIssuesService.formatADF('');
      expect(adf.type).toBe('doc');
      expect(adf.version).toBe(1);
      expect(adf.content.length).toBeGreaterThan(0);
    });
  });

  describe('Jira Cloud Issue Creation', () => {
    beforeEach(async () => {
      // Connect mock credentials
      await integrationsService.saveEncryptedCredentials({
        organizationId,
        provider: 'jira',
        credentials: {
          tokens: {
            accessToken: 'jira_mock_access_token',
            refreshToken: 'jira_mock_refresh_token',
            obtainedAt: Date.now(),
            expiresIn: 3600,
          },
          cloudId: 'mock-cloud-uuid-1234',
          siteName: 'Acme Jira Cloud',
        },
        externalAccountId: 'mock-cloud-uuid-1234',
        externalAccountName: 'Acme Jira Cloud',
      });
    });

    it('should format issue payload with ADF and create issue via REST API v3', async () => {
      const mockFetchResponse = {
        id: '10045',
        key: 'CRM-42',
        self: 'https://api.atlassian.com/ex/jira/mock-cloud-uuid-1234/rest/api/3/issue/10045',
      };

      // Mock native global fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockFetchResponse,
      });

      try {
        const issue = await jiraIssuesService.createIssue({
          organizationId,
          projectKey: 'CRM',
          summary: 'Review pricing with VP Sales',
          description: 'Client requested 15% annual discount.',
          issueTypeId: '10001',
        });

        expect(issue).toHaveProperty('issueId', '10045');
        expect(issue).toHaveProperty('issueKey', 'CRM-42');
        expect(global.fetch).toHaveBeenCalled();

        // Inspect fetch call arguments
        const [callUrl, callOptions] = global.fetch.mock.calls[0];
        expect(callUrl).toContain('https://api.atlassian.com/ex/jira/mock-cloud-uuid-1234/rest/api/3/issue');
        expect(callOptions.headers.Authorization).toBe('Bearer jira_mock_access_token');

        const sentBody = JSON.parse(callOptions.body);
        expect(sentBody.fields.project.key).toBe('CRM');
        expect(sentBody.fields.summary).toBe('Review pricing with VP Sales');
        expect(sentBody.fields.description.type).toBe('doc');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw an informative error if Jira API returns rejection', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"errorMessages":["Project CRM does not exist"]}',
      });

      try {
        await expect(
          jiraIssuesService.createIssue({
            organizationId,
            projectKey: 'INVALID_PROJECT',
            summary: 'Should fail',
          })
        ).rejects.toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
