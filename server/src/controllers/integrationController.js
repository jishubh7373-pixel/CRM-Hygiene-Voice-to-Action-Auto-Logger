const Integration = require('../models/Integration');
const integrationsService = require('../modules/integrations/integrations.service');
const hubspotOAuth = require('../modules/integrations/hubspot/hubspot.oauth');
const hubspotDealsService = require('../modules/integrations/hubspot/hubspot.deals.service');
const hubspotSyncService = require('../modules/integrations/hubspot/hubspot.sync.service');
const jiraOAuth = require('../modules/integrations/jira/jira.oauth');
const jiraService = require('../modules/integrations/jira/jira.service');
const jiraIssuesService = require('../modules/integrations/jira/jira.issues.service');
const gongAuth = require('../modules/integrations/gong/gong.auth');
const gongImportService = require('../modules/integrations/gong/gong.import.service');
const zoomWebhook = require('../modules/integrations/zoom/zoom.webhook');
const zoomRtms = require('../modules/integrations/zoom/zoom.rtms.service');
const ApiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { recordAudit } = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * List all integrations with connection status and health metrics
 */
const list = async (req, res, next) => {
  try {
    const list = await integrationsService.listIntegrations(req.organizationId);
    return ApiResponse.success(res, list);
  } catch (error) {
    next(error);
  }
};

/**
 * Get status of a specific integration
 */
const getStatus = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const integration = await integrationsService.getIntegration(req.organizationId, provider);
    return ApiResponse.success(res, integration);
  } catch (error) {
    next(error);
  }
};

/**
 * Get OAuth authorization URL for OAuth-based integrations (HubSpot, Jira)
 */
const getAuthUrl = async (req, res, next) => {
  try {
    const { provider } = req.params;
    let authUrl = '';

    if (provider === 'hubspot') {
      authUrl = hubspotOAuth.getAuthorizationUrl({
        organizationId: req.organizationId,
        userId: req.user._id,
      });
    } else if (provider === 'jira') {
      authUrl = jiraOAuth.getAuthorizationUrl({
        organizationId: req.organizationId,
        userId: req.user._id,
      });
    } else {
      throw new AppError(`OAuth is not supported for provider ${provider}`, 400, 'OAUTH_NOT_SUPPORTED');
    }

    return ApiResponse.success(res, { authUrl });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle OAuth redirect / code exchange callback
 */
const oauthCallback = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { code, state } = req.body;

    if (!code || !state) {
      throw new AppError('Authorization code and state are required', 400, 'CODE_STATE_REQUIRED');
    }

    if (provider === 'hubspot') {
      const tokenResult = await hubspotOAuth.exchangeCodeForTokens(code, state);
      if (tokenResult.organizationId !== req.organizationId.toString()) {
        throw new AppError('Tenant mismatch in OAuth state', 403, 'TENANT_MISMATCH');
      }

      let accountInfo = {};
      try {
        accountInfo = await hubspotOAuth.getAccountInfo(tokenResult.tokens.accessToken);
      } catch (accErr) {
        logger.warn(`Could not fetch HubSpot account info: ${accErr.message}`);
      }

      const updated = await integrationsService.saveEncryptedCredentials({
        organizationId: req.organizationId,
        provider: 'hubspot',
        credentials: {
          tokens: tokenResult.tokens,
          portalId: accountInfo.hub_id || accountInfo.portalId || '',
          accountName: accountInfo.hub_domain || accountInfo.accountName || 'HubSpot Portal',
        },
        externalAccountId: String(accountInfo.hub_id || accountInfo.portalId || ''),
        externalAccountName: accountInfo.hub_domain || accountInfo.accountName || 'HubSpot Portal',
        grantedScopes: tokenResult.tokens.scope ? tokenResult.tokens.scope.split(' ') : [],
        connectedBy: req.user._id,
        metadata: {
          portalId: accountInfo.hub_id,
          user: accountInfo.user,
        },
      });

      return ApiResponse.success(res, { connected: true, provider: 'hubspot' }, 'HubSpot connected successfully');
    }

    if (provider === 'jira') {
      const tokenResult = await jiraOAuth.exchangeCodeForTokens(code, state);
      if (tokenResult.organizationId !== req.organizationId.toString()) {
        throw new AppError('Tenant mismatch in OAuth state', 403, 'TENANT_MISMATCH');
      }

      // Query accessible sites
      let sites = [];
      try {
        sites = await jiraService.getAccessibleResources(tokenResult.tokens.accessToken);
      } catch (siteErr) {
        logger.warn(`Could not fetch Jira sites: ${siteErr.message}`);
      }

      const primarySite = sites[0] || {};

      const updated = await integrationsService.saveEncryptedCredentials({
        organizationId: req.organizationId,
        provider: 'jira',
        credentials: {
          tokens: tokenResult.tokens,
          cloudId: primarySite.id || '',
          siteName: primarySite.name || 'Atlassian Cloud',
          siteUrl: primarySite.url || '',
          accessibleSites: sites,
        },
        externalAccountId: primarySite.id || '',
        externalAccountName: primarySite.name || 'Jira Cloud',
        grantedScopes: tokenResult.tokens.scope ? tokenResult.tokens.scope.split(' ') : [],
        connectedBy: req.user._id,
        metadata: {
          cloudId: primarySite.id,
          siteUrl: primarySite.url,
          availableSitesCount: sites.length,
        },
      });

      return ApiResponse.success(res, { connected: true, provider: 'jira', sites }, 'Jira connected successfully');
    }

    throw new AppError(`Unknown OAuth provider: ${provider}`, 400, 'INVALID_PROVIDER');
  } catch (error) {
    next(error);
  }
};

/**
 * Configure credentials (legacy & manual API key / secret configuration)
 */
const configure = async (req, res, next) => {
  try {
    const { provider, clientId, clientSecret, instanceUrl, apiKey, webhookSecret, accessKey } = req.body;

    if (!provider) {
      throw new AppError('Integration provider identifier is required.', 400, 'PROVIDER_REQUIRED');
    }

    const hasCreds = Boolean((clientId && clientSecret) || apiKey || (accessKey && clientSecret));
    if (!hasCreds && !webhookSecret) {
      throw new AppError('Real API credentials must be provided.', 400, 'CREDENTIALS_REQUIRED');
    }

    // Save encrypted credentials
    const credentialsToEncrypt = {
      clientId,
      clientSecret,
      apiKey,
      accessKey,
      webhookSecret,
      instanceUrl,
    };

    const updated = await integrationsService.saveEncryptedCredentials({
      organizationId: req.organizationId,
      provider,
      credentials: credentialsToEncrypt,
      externalAccountId: clientId || accessKey || '',
      externalAccountName: `${provider} Account`,
      connectedBy: req.user._id,
      metadata: {
        instanceUrl: instanceUrl || '',
        hasWebhookSecret: Boolean(webhookSecret),
      },
    });

    return ApiResponse.success(res, updated, `Integration with ${provider} configured and credentials secured.`);
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect an integration
 */
const disconnect = async (req, res, next) => {
  try {
    const provider = req.params.provider || req.body.provider;
    if (!provider) {
      throw new AppError('Provider is required to disconnect.', 400, 'PROVIDER_REQUIRED');
    }

    const updated = await integrationsService.disconnect(req.organizationId, provider, req.user._id);
    return ApiResponse.success(res, updated, `Integration with ${provider} has been disconnected.`);
  } catch (error) {
    next(error);
  }
};

/**
 * Test integration connection / live health check
 */
const testConnection = async (req, res, next) => {
  try {
    const { provider } = req.params;

    if (provider === 'gong') {
      const creds = await integrationsService.getDecryptedCredentials(req.organizationId, 'gong');
      if (!creds || !creds.accessKey || !creds.clientSecret) {
        throw new AppError('Gong credentials not configured', 400, 'NOT_CONFIGURED');
      }
      const testResult = await gongAuth.validateCredentials(creds.accessKey, creds.clientSecret, creds.baseUrl);
      await integrationsService.recordSuccess(req.organizationId, 'gong');
      return ApiResponse.success(res, { healthy: true, details: testResult });
    }

    if (provider === 'hubspot') {
      const accessToken = await hubspotSyncService.getValidAccessToken(req.organizationId);
      const pipelines = await hubspotDealsService.getPipelines(accessToken);
      await integrationsService.recordSuccess(req.organizationId, 'hubspot');
      return ApiResponse.success(res, { healthy: true, pipelinesCount: pipelines.results?.length || 0 });
    }

    if (provider === 'jira') {
      const { accessToken } = await jiraIssuesService.getValidAccessToken(req.organizationId);
      const sites = await jiraService.getAccessibleResources(accessToken);
      await integrationsService.recordSuccess(req.organizationId, 'jira');
      return ApiResponse.success(res, { healthy: true, sitesCount: sites.length });
    }

    if (provider === 'zoom') {
      const integration = await integrationsService.getIntegration(req.organizationId, 'zoom');
      const creds = await integrationsService.getDecryptedCredentials(req.organizationId, 'zoom');
      const hasWebhook = Boolean(creds?.webhookSecret || integration.metadata?.hasWebhookSecret);
      const rtmsStatus = zoomRtms.getStatus();
      return ApiResponse.success(res, { healthy: true, hasWebhook, rtms: rtmsStatus });
    }

    throw new AppError(`Testing not supported for provider ${provider}`, 400, 'INVALID_PROVIDER');
  } catch (error) {
    await integrationsService.recordError(req.organizationId, req.params.provider, error);
    next(error);
  }
};

/**
 * Gong Configuration Endpoint
 */
const configureGong = async (req, res, next) => {
  try {
    const { accessKey, clientSecret, baseUrl } = req.body;
    if (!accessKey || !clientSecret) {
      throw new AppError('Access Key and Client Secret are required for Gong', 400, 'GONG_CREDENTIALS_REQUIRED');
    }

    // Validate credentials before saving
    await gongAuth.validateCredentials(accessKey, clientSecret, baseUrl);

    const saved = await integrationsService.saveEncryptedCredentials({
      organizationId: req.organizationId,
      provider: 'gong',
      credentials: { accessKey, clientSecret, baseUrl: baseUrl || 'https://api.gong.io' },
      externalAccountId: accessKey,
      externalAccountName: 'Gong Workspace',
      connectedBy: req.user._id,
      metadata: { baseUrl: baseUrl || 'https://api.gong.io' },
    });

    return ApiResponse.success(res, { connected: true, provider: 'gong' }, 'Gong credentials verified and saved.');
  } catch (error) {
    next(error);
  }
};

/**
 * Gong Import Endpoint
 */
const importGong = async (req, res, next) => {
  try {
    const { fromDateTime, toDateTime, maxCalls } = req.body;
    const result = await gongImportService.importCalls({
      organizationId: req.organizationId,
      userId: req.user._id,
      fromDateTime,
      toDateTime,
      maxCalls: maxCalls || 50,
    });
    return ApiResponse.success(res, result, `Gong calls import finished: ${result.importedCount} new, ${result.duplicateCount} duplicates.`);
  } catch (error) {
    next(error);
  }
};

/**
 * HubSpot Deal Sync Endpoint
 */
const syncHubspot = async (req, res, next) => {
  try {
    const result = await hubspotSyncService.syncDeals({
      organizationId: req.organizationId,
      userId: req.user._id,
    });
    return ApiResponse.success(res, result, `HubSpot deal sync finished: ${result.createdCount} created, ${result.updatedCount} updated.`);
  } catch (error) {
    next(error);
  }
};

/**
 * HubSpot Deals Preview
 */
const getHubspotDeals = async (req, res, next) => {
  try {
    const accessToken = await hubspotSyncService.getValidAccessToken(req.organizationId);
    const deals = await hubspotDealsService.getDeals({ accessToken, limit: 20 });
    return ApiResponse.success(res, deals);
  } catch (error) {
    next(error);
  }
};

/**
 * HubSpot Pipelines and Stages
 */
const getHubspotPipelines = async (req, res, next) => {
  try {
    const accessToken = await hubspotSyncService.getValidAccessToken(req.organizationId);
    const pipelines = await hubspotDealsService.getPipelines(accessToken);
    return ApiResponse.success(res, pipelines);
  } catch (error) {
    next(error);
  }
};

/**
 * Jira Accessible Sites
 */
const getJiraSites = async (req, res, next) => {
  try {
    const { accessToken } = await jiraIssuesService.getValidAccessToken(req.organizationId);
    const sites = await jiraService.getAccessibleResources(accessToken);
    return ApiResponse.success(res, sites);
  } catch (error) {
    next(error);
  }
};

/**
 * Jira Projects for Site
 */
const getJiraProjects = async (req, res, next) => {
  try {
    const { cloudId } = req.query;
    const { accessToken, cloudId: storedCloudId } = await jiraIssuesService.getValidAccessToken(req.organizationId);
    const targetCloudId = cloudId || storedCloudId;
    if (!targetCloudId) {
      throw new AppError('Cloud ID is required', 400, 'CLOUD_ID_REQUIRED');
    }
    const projects = await jiraService.getProjects(accessToken, targetCloudId);
    return ApiResponse.success(res, projects);
  } catch (error) {
    next(error);
  }
};

/**
 * Jira Configuration (Default site, project, issue type)
 */
const configureJira = async (req, res, next) => {
  try {
    const { cloudId, projectKey, issueTypeId } = req.body;
    const updated = await integrationsService.updateConfig(req.organizationId, 'jira', {
      cloudId,
      projectKey,
      issueTypeId: issueTypeId || '10001',
    });
    return ApiResponse.success(res, updated, 'Jira default project configuration updated.');
  } catch (error) {
    next(error);
  }
};

/**
 * Jira Test Task Creation (ADF verification)
 */
const testJiraIssue = async (req, res, next) => {
  try {
    const { projectKey, issueTypeId } = req.body;
    const integration = await integrationsService.getIntegration(req.organizationId, 'jira');
    const targetProjectKey = projectKey || integration.metadata?.projectKey;
    const targetIssueTypeId = issueTypeId || integration.metadata?.issueTypeId || '10001';

    if (!targetProjectKey) {
      throw new AppError('A Project Key is required to create a test issue', 400, 'PROJECT_KEY_REQUIRED');
    }

    const result = await jiraIssuesService.testIssueCreation({
      organizationId: req.organizationId,
      projectKey: targetProjectKey,
      issueTypeId: targetIssueTypeId,
    });

    return ApiResponse.success(res, result, `Test issue ${result.issueKey} created successfully in Jira.`);
  } catch (error) {
    next(error);
  }
};

/**
 * Zoom Configuration Endpoint
 */
const configureZoom = async (req, res, next) => {
  try {
    const { webhookSecret, clientId, clientSecret, accountId } = req.body;

    const saved = await integrationsService.saveEncryptedCredentials({
      organizationId: req.organizationId,
      provider: 'zoom',
      credentials: { webhookSecret, clientId, clientSecret, accountId },
      externalAccountId: accountId || clientId || '',
      externalAccountName: 'Zoom Account',
      connectedBy: req.user._id,
      metadata: {
        hasWebhookSecret: Boolean(webhookSecret),
        accountId,
      },
    });

    return ApiResponse.success(res, { connected: true, provider: 'zoom' }, 'Zoom configuration and credentials saved.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  getStatus,
  getAuthUrl,
  oauthCallback,
  configure,
  disconnect,
  testConnection,
  configureGong,
  importGong,
  syncHubspot,
  getHubspotDeals,
  getHubspotPipelines,
  getJiraSites,
  getJiraProjects,
  configureJira,
  testJiraIssue,
  configureZoom,
};
