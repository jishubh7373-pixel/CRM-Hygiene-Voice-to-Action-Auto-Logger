/**
 * Storage Provider Interface
 * Base class contract for Local, S3, or R2 storage providers.
 */
class StorageProvider {
  /**
   * Store file and return metadata
   * @param {Object} params
   * @param {Buffer} params.buffer
   * @param {string} params.originalName
   * @param {string} params.mimeType
   * @param {string} params.organizationId
   * @param {string} params.meetingId
   * @returns {Promise<{ key: string, sizeBytes: number, localPath?: string }>}
   */
  async saveFile(params) {
    throw new Error('saveFile method not implemented');
  }

  /**
   * Retrieve file as readable stream
   * @param {string} storageKey
   * @returns {Promise<ReadableStream>}
   */
  async getFileStream(storageKey) {
    throw new Error('getFileStream method not implemented');
  }

  /**
   * Retrieve file as Buffer (for OpenAI API upload)
   * @param {string} storageKey
   * @returns {Promise<Buffer>}
   */
  async getFileBuffer(storageKey) {
    throw new Error('getFileBuffer method not implemented');
  }

  /**
   * Delete stored file
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageKey) {
    throw new Error('deleteFile method not implemented');
  }
}

module.exports = StorageProvider;
