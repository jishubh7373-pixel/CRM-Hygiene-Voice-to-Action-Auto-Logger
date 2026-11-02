const Integration = require('../../models/Integration');
const { encryptObject, decryptObject } = require('../../utils/crypto');
const auditService = require('../../services/auditService');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

const SUPPORTED_PROVIDERS = ['zoom', 'gong', 'hubspot', 'jira'];

class IntegrationsService {
  /**
   * List all integrations for an organization with connection status and safe metadata
   * Never exposes encrypted credentials or plain-text secrets
   */
  async listIntegrations(organizationId) {
    if (!organizationId) {
      throw new AppError('Organization ID is required', 400, 'ORG_ID_REQUIRED');
    }

    const existing = await Integration.find({ organizationId }).lean();
    const existingMap = new Map(existing.map((item) => [item.provider, item]));

    return SUPPORTED_PROVIDERS.map((provider) => {
      const item = existingMap.get(provider);
      if (!item) {
        return {
          provider,
          connectionStatus: 'disconnected',
          status: 'disconnected',
          credentialsConfigured: false,
          externalAccountId: null,
          externalAccountName: null,
          connectedAt: null,
          lastSyncAt: null,
          lastError: null,
          healthStatus: { status: 'unknown', message: 'Not configured' },
          metadata: {},
        };
      }

      return {
        _id: item._id,
        provider: item.provider,
        connectionStatus: item.connectionStatus || item.status || 'disconnected',
        status: item.connectionStatus || item.status || 'disconnected',
        credentialsConfigured: !!(item.encryptedCredentials?.ciphertext),
        externalAccountId: item.externalAccountId || null,
        externalAccountName: item.externalAccountName || null,
        grantedScopes: item.grantedScopes || [],
        connectedAt: item.connectedAt,
        lastSyncAt: item.lastSyncAt,
        lastError: item.lastError || (item.lastErrorMessage ? { message: item.lastErrorMessage } : null),
        healthStatus: item.healthStatus || { status: 'unknown' },
        metadata: item.metadata || {},
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  /**
   * Get safe details of a single integration
   */
  async getIntegration(organizationId, provider) {
    const item = await Integration.findOne({ organizationId, provider }).lean();
    if (!item) {
      return {
        provider,
        connectionStatus: 'disconnected',
        status: 'disconnected',
        credentialsConfigured: false,
        metadata: {},
      };
    }

    return {
      _id: item._id,
      provider: item.provider,
      connectionStatus: item.connectionStatus || item.status || 'disconnected',
      status: item.connectionStatus || item.status || 'disconnected',
      credentialsConfigured: !!(item.encryptedCredentials?.ciphertext),
      externalAccountId: item.externalAccountId || null,
      externalAccountName: item.externalAccountName || null,
      grantedScopes: item.grantedScopes || [],
      connectedAt: item.connectedAt,
      lastSyncAt: item.lastSyncAt,
      lastError: item.lastError || null,
      healthStatus: item.healthStatus || { status: 'unknown' },
      metadata: item.metadata || {},
    };
  }

  /**
   * Internal secure credential decryption
   * NEVER call this from an API endpoint directly returning to client
   */
  async getDecryptedCredentials(organizationId, provider) {
    const item = await Integration.findOne({ organizationId, provider });
    if (!item || !item.encryptedCredentials || !item.encryptedCredentials.ciphertext) {
      return null;
    }

    return decryptObject(item.encryptedCredentials);
  }

  /**
   * Store credentials encrypted with AES-256-GCM
   */
  async saveEncryptedCredentials({
    organizationId,
    provider,
    credentials,
    externalAccountId = '',
    externalAccountName = '',
    grantedScopes = [],
    connectedBy = null,
    metadata = {},
  }) {
    if (!organizationId || !provider) {
      throw new AppError('Organization ID and provider are required', 400, 'PARAM_REQUIRED');
    }

    const encrypted = encryptObject(credentials);

    const updated = await Integration.findOneAndUpdate(
      { organizationId, provider },
      {
        connectionStatus: 'connected',
        status: 'connected',
        credentialsConfigured: true,
        encryptedCredentials: encrypted,
        externalAccountId,
        externalAccountName,
        grantedScopes,
        connectedBy,
        connectedAt: new Date(),
        lastError: null,
        lastErrorMessage: '',
        healthStatus: {
          status: 'healthy',
          lastCheckAt: new Date(),
          message: 'Connected successfully',
        },
        metadata,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`[Integration] Credentials saved securely for provider ${provider} (org: ${organizationId})`);

    try {
      await auditService.log({
        organizationId,
        userId: connectedBy,
        action: 'INTEGRATION_CONNECTED',
        entityType: 'Integration',
        entityId: updated._id,
        metadata: { provider, externalAccountId, externalAccountName },
      });
    } catch (auditErr) {
      logger.warn(`Audit log failed for integration connection: ${auditErr.message}`);
    }

    return updated;
  }

  /**
   * Disconnect an integration and wipe encrypted credentials
   */
  async disconnect(organizationId, provider, userId = null) {
    const updated = await Integration.findOneAndUpdate(
      { organizationId, provider },
      {
        connectionStatus: 'disconnected',
        status: 'disconnected',
        credentialsConfigured: false,
        encryptedCredentials: { ciphertext: '', iv: '', authTag: '' },
        externalAccountId: '',
        externalAccountName: '',
        grantedScopes: [],
        lastError: null,
        lastErrorMessage: '',
        healthStatus: {
          status: 'unknown',
          lastCheckAt: new Date(),
          message: 'Integration disconnected by user',
        },
      },
      { new: true }
    );

    logger.info(`[Integration] Disconnected provider ${provider} (org: ${organizationId})`);

    try {
      await auditService.log({
        organizationId,
        userId,
        action: 'INTEGRATION_DISCONNECTED',
        entityType: 'Integration',
        entityId: updated?._id,
        metadata: { provider },
      });
    } catch (auditErr) {
      logger.warn(`Audit log failed for integration disconnection: ${auditErr.message}`);
    }

    return updated;
  }

  /**
   * Update configuration or metadata
   */
  async updateConfig(organizationId, provider, metadata = {}) {
    const integration = await Integration.findOne({ organizationId, provider });
    if (!integration) {
      throw new AppError(`Integration for ${provider} not found`, 404, 'INTEGRATION_NOT_FOUND');
    }

    integration.metadata = { ...(integration.metadata || {}), ...metadata };
    await integration.save();
    return integration;
  }

  /**
   * Record integration error
   */
  async recordError(organizationId, provider, error) {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status || 'UNKNOWN_ERROR';

    await Integration.findOneAndUpdate(
      { organizationId, provider },
      {
        connectionStatus: 'error',
        status: 'error',
        lastError: {
          message: errorMessage,
          code: String(errorCode),
          timestamp: new Date(),
        },
        lastErrorMessage: errorMessage,
        healthStatus: {
          status: 'failing',
          lastCheckAt: new Date(),
          message: errorMessage,
        },
      }
    );

    logger.warn(`[Integration Error] Provider ${provider} error recorded: ${errorMessage} (org: ${organizationId})`);
  }

  /**
   * Record successful sync
   */
  async recordSuccess(organizationId, provider, meta = {}) {
    await Integration.findOneAndUpdate(
      { organizationId, provider },
      {
        connectionStatus: 'connected',
        status: 'connected',
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorMessage: '',
        healthStatus: {
          status: 'healthy',
          lastCheckAt: new Date(),
          message: 'Operation succeeded',
        },
        ...(Object.keys(meta).length ? { metadata: meta } : {}),
      }
    );
  }
}

module.exports = new IntegrationsService();
