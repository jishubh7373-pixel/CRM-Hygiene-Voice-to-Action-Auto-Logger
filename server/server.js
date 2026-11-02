const http = require('http');
const app = require('./src/app');
const config = require('./src/config');
const { connectDB } = require('./src/config/db');
const { initRedis } = require('./src/config/redis');
const { initMeetingQueue, closeMeetingQueue } = require('./src/queues/meetingQueue');
const { initSocketServer } = require('./src/socket/socketServer');
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');

const server = http.createServer(app);

// Initialize Socket.IO
initSocketServer(server);

const startServer = async () => {
  try {
    // 0. Validate configuration in production
    config.validateConfig();

    // 1. Connect to MongoDB
    try {
      await connectDB();
      // Auto-seed if database is empty (e.g. initial cloud cluster deploy)
      try {
        const User = require('./src/models/User');
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          logger.info('Database has 0 users. Auto-seeding initial demo records...');
          const { populateDatabase } = require('./seed');
          await populateDatabase();
          logger.info('Auto-seeding completed successfully.');
        }
      } catch (seedErr) {
        logger.warn(`Auto-seed check notice: ${seedErr.message}`);
      }
    } catch (dbErr) {
      if (config.env === 'development') {
        logger.warn(`External MongoDB daemon not reached at ${config.mongo.uri}.`);
        logger.info('Initializing self-contained MongoDB dev server for current session...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const memUri = mongod.getUri();
        await connectDB(memUri);
        logger.info(`Connected to self-contained MongoDB instance at ${memUri}`);
        const { populateDatabase } = require('./seed');
        await populateDatabase();
        logger.info('Auto-seeded demo records for out-of-the-box local testing.');
      } else {
        logger.error(`MongoDB connection failure in ${config.env}: ${dbErr.message}`);
        throw dbErr;
      }
    }

    // 1.1 Run safe database index migrations
    try {
      const Meeting = require('./src/models/Meeting');
      const { migrateMeetingIndexes } = require('./src/utils/indexMigration');
      await migrateMeetingIndexes(Meeting);
    } catch (migErr) {
      logger.warn(`Index migration notice: ${migErr.message}`);
    }

    // 2. Initialize Redis (non-blocking)
    try {
      initRedis();
    } catch (redisErr) {
      logger.warn(`Redis init notice: ${redisErr.message}`);
    }

    // 3. Initialize BullMQ Queue
    try {
      initMeetingQueue();
    } catch (queueErr) {
      logger.warn(`BullMQ init notice: ${queueErr.message}`);
    }

    // 4. Start HTTP Server
    server.listen(config.port, () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 DealFlow AI Server active on http://localhost:${config.port}`);
      logger.info(`📡 API Version: /api/v1`);
      logger.info(`🩺 Health Check: http://localhost:${config.port}/health`);
      logger.info(`⚡ Readiness: http://localhost:${config.port}/ready`);
      logger.info(`⚙️  Environment: ${config.env}`);
      logger.info(`=======================================================`);
    });
  } catch (error) {
    logger.error('Fatal startup error:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// Graceful Shutdown
const handleShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down server gracefully...`);

  try {
    // 1. Stop accepting new HTTP requests
    server.close(() => {
      logger.info('HTTP server closed.');
    });

    // 2. Close BullMQ queue & worker
    await closeMeetingQueue();

    // 3. Disconnect from database
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('Mongoose disconnected.');
    }

    logger.info('Graceful shutdown completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown:', { error: err.message });
    process.exit(1);
  }

  // Force close after 10s if stuck
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));


if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, server };
