const fs = require('fs');
const path = require('path');
const StorageProvider = require('./storage.interface');
const config = require('../../config');
const logger = require('../../utils/logger');
const AppError = require('../../utils/appError');

class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.basePath = config.storage.localPath;
    this.ensureDirectory(this.basePath);
  }

  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  getSafePath(storageKey) {
    // Prevent path traversal attacks
    const normalizedKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.resolve(this.basePath, normalizedKey);

    if (!fullPath.startsWith(path.resolve(this.basePath))) {
      throw new AppError('Invalid storage key: directory traversal detected', 400, 'SECURITY_ERROR');
    }

    return fullPath;
  }

  async saveFile({ buffer, originalName, mimeType, organizationId, meetingId }) {
    const orgFolder = path.resolve(this.basePath, String(organizationId));
    this.ensureDirectory(orgFolder);

    const ext = path.extname(originalName) || '.mp3';
    const filename = `${meetingId}_${Date.now()}${ext}`;
    const storageKey = path.join(String(organizationId), filename).replace(/\\/g, '/');
    const fullPath = path.resolve(orgFolder, filename);

    await fs.promises.writeFile(fullPath, buffer);

    logger.info(`Audio file stored locally at: ${storageKey} (${buffer.length} bytes)`);

    return {
      key: storageKey,
      sizeBytes: buffer.length,
      localPath: fullPath,
      provider: 'local',
    };
  }

  async getFileStream(storageKey) {
    const fullPath = this.getSafePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new AppError('Requested audio file does not exist on storage.', 404, 'FILE_NOT_FOUND');
    }
    return fs.createReadStream(fullPath);
  }

  async getFileBuffer(storageKey) {
    const fullPath = this.getSafePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new AppError('Requested audio file does not exist on storage.', 404, 'FILE_NOT_FOUND');
    }
    return fs.promises.readFile(fullPath);
  }

  async deleteFile(storageKey) {
    try {
      const fullPath = this.getSafePath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      logger.warn(`Failed to delete stored file ${storageKey}: ${err.message}`);
      return false;
    }
  }
}

module.exports = LocalStorageProvider;
