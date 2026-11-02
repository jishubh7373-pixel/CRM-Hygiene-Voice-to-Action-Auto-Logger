const path = require('path');
const LocalStorageProvider = require('./local.storage.provider');
const S3StorageProvider = require('./s3.storage.provider');
const config = require('../../config');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4'];
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'video/mp4',
];

class StorageService {
  constructor() {
    this.s3Provider = new S3StorageProvider();
    if (config.storage.provider === 's3' && config.storage.s3.bucket) {
      this.provider = this.s3Provider;
      logger.info('Storage Service initialized with S3 Provider');
    } else {
      this.provider = new LocalStorageProvider();
      logger.info(`Storage Service initialized with Local Storage Provider (${config.storage.localPath})`);
    }
  }

  /**
   * Obtain presigned upload URL or local upload URL depending on configuration
   */
  async getUploadUrl({ organizationId, originalName, mimeType, fileSize }) {
    // 1. Validate file format & size (direct cloud uploads support large files up to 500 MB)
    this.validateAudioFile({
      originalname: originalName,
      mimetype: mimeType,
      size: fileSize,
      maxAllowedMb: 500,
    });

    // 2. Delegate to S3 provider for presigned URL (or fallback)
    return this.s3Provider.generatePresignedUploadUrl({
      organizationId,
      originalName,
      mimeType,
      expiresInSeconds: 900,
    });
  }

  /**
   * Validate audio file extension, size, and magic bytes
   */
  validateAudioFile({ originalname, mimetype, size, buffer, maxAllowedMb = null }) {
    const ext = path.extname(originalname || '').toLowerCase();

    // 1. Extension check
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new AppError(
        `Unsupported audio format '${ext}'. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      );
    }

    // 2. MIME type check
    if (mimetype && !ALLOWED_MIME_TYPES.includes(mimetype.toLowerCase())) {
      throw new AppError(
        `Unsupported MIME type '${mimetype}'. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        400,
        'INVALID_MIME_TYPE'
      );
    }

    // 3. Size check
    const limitMb = maxAllowedMb || config.storage.maxAudioUploadMb || 25;
    const maxBytes = limitMb * 1024 * 1024;
    if (size > maxBytes) {
      throw new AppError(
        `File exceeds maximum upload limit of ${limitMb} MB (Received: ${(size / 1024 / 1024).toFixed(2)} MB)`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    // 4. Magic header verification if buffer available
    if (buffer && buffer.length >= 8) {
      const isRiff = buffer.toString('utf8', 0, 4) === 'RIFF';
      const isId3 = buffer.toString('utf8', 0, 3) === 'ID3';
      const isMp3Sync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
      const isFtyp = buffer.toString('utf8', 4, 8) === 'ftyp';

      if (!isRiff && !isId3 && !isMp3Sync && !isFtyp && ext !== '.wav') {
        logger.warn(`Uploaded file ${originalname} does not match standard audio signature headers.`);
      }
    }

    return true;
  }

  async storeAudio({ buffer, originalName, mimeType, organizationId, meetingId }) {
    return this.provider.saveFile({
      buffer,
      originalName,
      mimeType,
      organizationId,
      meetingId,
    });
  }

  async getAudioStream(storageKey) {
    return this.provider.getFileStream(storageKey);
  }

  async getAudioBuffer(storageKey) {
    return this.provider.getFileBuffer(storageKey);
  }

  async deleteAudio(storageKey) {
    return this.provider.deleteFile(storageKey);
  }
}

module.exports = new StorageService();
