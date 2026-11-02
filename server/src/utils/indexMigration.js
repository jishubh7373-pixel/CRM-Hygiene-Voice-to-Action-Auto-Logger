const logger = require('./logger');

/**
 * Safely migrates Meeting model indexes in MongoDB.
 * Checks for legacy sparse compound indexes on (organizationId, externalProvider, externalMeetingId/externalCallId)
 * and replaces them with partialFilterExpression indexes so manual audio uploads with null external IDs do not collide.
 */
const migrateMeetingIndexes = async (MeetingModel) => {
  try {
    const collection = MeetingModel.collection;
    if (!collection.conn || !collection.conn.db) {
      return;
    }
    const collections = await collection.conn.db.listCollections({ name: collection.collectionName }).toArray();
    if (collections.length === 0) {
      // Collection not created in DB yet, create initial indexes via syncIndexes
      await MeetingModel.syncIndexes();
      return;
    }
    const indexes = await collection.indexes();

    const legacyIndexNames = [
      'organizationId_1_externalProvider_1_externalMeetingId_1',
      'organizationId_1_externalProvider_1_externalCallId_1',
    ];

    for (const legacyName of legacyIndexNames) {
      const existing = indexes.find((idx) => idx.name === legacyName);
      if (existing) {
        // If the existing index is sparse or lacks the partialFilterExpression, safely drop it
        const isSparse = Boolean(existing.sparse);
        const hasPartialFilter = Boolean(existing.partialFilterExpression);

        if (isSparse || !hasPartialFilter) {
          logger.info(`Detected legacy index [${legacyName}] with sparse=${isSparse}. Safely dropping for partialFilterExpression migration.`);
          await collection.dropIndex(legacyName);
          logger.info(`Successfully dropped legacy index [${legacyName}].`);
        }
      }
    }

    // Synchronize Mongoose model indexes to build the new partialFilterExpression indexes
    await MeetingModel.syncIndexes();
    logger.info('Meeting model indexes successfully verified and synchronized.');
  } catch (error) {
    logger.error('Error during meeting index migration:', { error: error.message });
    // Do not throw to avoid crashing server on non-critical index check errors
  }
};

module.exports = { migrateMeetingIndexes };
