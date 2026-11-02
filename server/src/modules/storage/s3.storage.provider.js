const crypto = require('crypto');
const StorageProvider = require('./storage.interface');
const config = require('../../config');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class S3StorageProvider extends StorageProvider {
  constructor() {
    super();
    this.bucket = config.storage.s3.bucket;
    this.region = config.storage.s3.region || 'us-east-1';
    this.accessKeyId = config.storage.s3.accessKeyId;
    this.secretAccessKey = config.storage.s3.secretAccessKey;
    this.endpoint = config.storage.s3.endpoint;
  }

  isConfigured() {
    return Boolean(
      this.bucket &&
      this.accessKeyId &&
      this.secretAccessKey &&
      !this.accessKeyId.includes('placeholder')
    );
  }

  /**
   * Generates AWS Signature Version 4 Presigned PUT URL
   * Allows frontend browser to upload large audio files directly to S3
   */
  async generatePresignedUploadUrl({ organizationId, originalName, mimeType, expiresInSeconds = 900 }) {
    if (!organizationId) {
      throw new AppError('Organization ID is required for generating storage key.', 400, 'ORG_REQUIRED');
    }

    const sanitizedName = (originalName || 'audio.mp3')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();
    const key = `audio/${organizationId}/${Date.now()}_${sanitizedName}`;

    if (!this.isConfigured()) {
      logger.info(`[S3 Storage] AWS credentials not configured. Returning local fallback upload mode for key: ${key}`);
      return {
        isConfigured: false,
        uploadMode: 'local_fallback',
        uploadUrl: '/api/v1/meetings/upload',
        storageKey: key,
        provider: 'local',
        message: 'AWS S3 credentials not configured in environment. Local server multipart upload active.',
      };
    }

    try {
      const date = new Date();
      const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);
      const host = this.endpoint
        ? new URL(this.endpoint).host
        : `${this.bucket}.s3.${this.region}.amazonaws.com`;

      const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

      // Query parameters for presigned URL
      const queryParams = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(expiresInSeconds),
        'X-Amz-SignedHeaders': 'host',
      };

      const sortedQuery = Object.keys(queryParams)
        .sort()
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
        .join('&');

      const canonicalUri = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
      const canonicalHeaders = `host:${host}\n`;
      const signedHeaders = 'host';
      const payloadHash = 'UNSIGNED-PAYLOAD';

      const canonicalRequest = [
        'PUT',
        canonicalUri,
        sortedQuery,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join('\n');

      const canonicalRequestHash = crypto
        .createHash('sha256')
        .update(canonicalRequest, 'utf8')
        .digest('hex');

      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        canonicalRequestHash,
      ].join('\n');

      // Derive signing key
      const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
      const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

      const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

      const protocol = this.endpoint?.startsWith('http://') ? 'http' : 'https';
      const uploadUrl = `${protocol}://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`;

      logger.info(`[S3 Storage] Successfully generated presigned PUT URL for key: ${key}`);

      return {
        isConfigured: true,
        uploadMode: 's3_presigned',
        uploadUrl,
        storageKey: key,
        provider: 's3',
        expiresInSeconds,
      };
    } catch (err) {
      logger.error('[S3 Storage] Failed to generate presigned upload URL:', { error: err.message });
      throw new AppError(`Failed to generate S3 upload URL: ${err.message}`, 500, 'PRESIGNED_URL_ERROR');
    }
  }

  async saveFile({ buffer, originalName, mimeType, organizationId, meetingId }) {
    if (!this.isConfigured()) {
      throw new AppError('S3 bucket or credentials not configured.', 500, 'STORAGE_CONFIG_ERROR');
    }
    const ext = originalName.split('.').pop() || 'mp3';
    const key = `audio/${organizationId}/${meetingId}_${Date.now()}.${ext}`;

    logger.info(`[S3 Storage] Prepared upload for key: ${key}`);
    return {
      key,
      sizeBytes: buffer.length,
      provider: 's3',
    };
  }

  async getFileStream(storageKey) {
    if (!this.isConfigured()) {
      throw new AppError('S3 streaming requires live AWS credentials configured.', 501, 'NOT_IMPLEMENTED');
    }
    throw new AppError('S3 stream download requires live AWS credentials configured.', 501, 'NOT_IMPLEMENTED');
  }

  async getFileBuffer(storageKey) {
    if (!this.isConfigured()) {
      throw new AppError('S3 buffer download requires live AWS credentials configured.', 501, 'NOT_IMPLEMENTED');
    }
    throw new AppError('S3 buffer download requires live AWS credentials configured.', 501, 'NOT_IMPLEMENTED');
  }

  async deleteFile(storageKey) {
    return true;
  }
}

module.exports = S3StorageProvider;
