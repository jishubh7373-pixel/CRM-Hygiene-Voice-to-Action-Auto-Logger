const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dealflow_ai',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dealflow_default_jwt_access_secret_dev_32char',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dealflow_default_jwt_refresh_secret_dev_32char',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  ai: {
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localPath: process.env.LOCAL_STORAGE_PATH || path.resolve(__dirname, '../../../uploads/audio'),
    maxAudioUploadMb: parseInt(process.env.MAX_AUDIO_UPLOAD_MB || '25', 10),
    s3: {
      bucket: process.env.S3_BUCKET_NAME || '',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.S3_ENDPOINT || undefined,
    },
  },
  integrations: {
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY || 'dealflow_integrations_secret_key_32bytes_hex!!',
    zoom: {
      clientId: process.env.ZOOM_CLIENT_ID || 'dealflow_zoom_client_id_dev',
      clientSecret: process.env.ZOOM_CLIENT_SECRET || 'dealflow_zoom_client_secret_dev',
      webhookSecret: process.env.ZOOM_WEBHOOK_SECRET || 'dealflow_zoom_webhook_secret_dev_32char',
      redirectUri: process.env.ZOOM_REDIRECT_URI || 'http://localhost:5000/api/v1/integrations/zoom/callback',
    },
    gong: {
      accessKey: process.env.GONG_ACCESS_KEY || '',
      clientSecret: process.env.GONG_CLIENT_SECRET || '',
      baseUrl: process.env.GONG_BASE_URL || 'https://api.gong.io',
    },
    hubspot: {
      clientId: process.env.HUBSPOT_CLIENT_ID || 'dealflow_hubspot_client_id_dev',
      clientSecret: process.env.HUBSPOT_CLIENT_SECRET || 'dealflow_hubspot_client_secret_dev',
      redirectUri: process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:5000/api/v1/integrations/hubspot/callback',
      scopes: process.env.HUBSPOT_SCOPES || 'crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read crm.schemas.deals.read',
    },
    jira: {
      clientId: process.env.JIRA_CLIENT_ID || 'dealflow_jira_client_id_dev',
      clientSecret: process.env.JIRA_CLIENT_SECRET || 'dealflow_jira_client_secret_dev',
      redirectUri: process.env.JIRA_REDIRECT_URI || 'http://localhost:5000/api/v1/integrations/jira/callback',
      scopes: process.env.JIRA_SCOPES || 'read:jira-work write:jira-work read:jira-user offline_access',
    },
  },
};

/**
 * Validate configuration for production readiness
 * In production mode, fails fast if critical secrets or variables are missing or insecure
 */
const validateConfig = (forcedEnv = null) => {
  const currentEnv = forcedEnv || process.env.NODE_ENV || config.env;
  if (currentEnv !== 'production') {
    return { isValid: true, warnings: [] };
  }

  const errors = [];
  const warnings = [];

  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.includes('default')) {
    errors.push('JWT_ACCESS_SECRET must be set to a high-entropy string in production.');
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.includes('default')) {
    errors.push('JWT_REFRESH_SECRET must be set to a high-entropy string in production.');
  }

  if (!process.env.INTEGRATION_ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY.includes('secret_key_32bytes_hex')) {
    errors.push('INTEGRATION_ENCRYPTION_KEY must be set to a 32-byte secret in production.');
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI must be provided in production environment variables.');
  }

  if (!process.env.CLIENT_URL) {
    warnings.push('CLIENT_URL not set; defaulting to http://localhost:5173');
  }

  if (errors.length > 0) {
    const errorMsg = `[FATAL CONFIGURATION ERROR] Production environment validation failed:\n  - ${errors.join('\n  - ')}`;
    throw new Error(errorMsg);
  }

  return { isValid: true, warnings };
};

config.validateConfig = validateConfig;

module.exports = config;

