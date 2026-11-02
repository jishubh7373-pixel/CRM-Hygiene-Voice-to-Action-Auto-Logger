/**
 * DealFlow AI — Standalone Background Queue Worker
 * Runs independently from the HTTP API Gateway for horizontal scalability
 */
const { connectDB } = require('./src/config/db');
const { initRedis } = require('./src/config/redis');
const { initMeetingQueue, closeMeetingQueue, QUEUE_NAME } = require('./src/queues/meetingQueue');
const config = require('./src/config');
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');

const startWorker = async () => {
  logger.info(`Starting DealFlow AI Standalone Background Worker...`);
  logger.info(`Environment: ${config.env}`);

  // Validate production configuration
  config.validateConfig();

  // Connect to Database
  try {
    await connectDB();
    logger.info('Worker connected to MongoDB database successfully.');
  } catch (err) {
    logger.error('Worker failed to connect to database:', { error: err.message });
    process.exit(1);
  }

  // Connect to Redis
  try {
    initRedis();
    logger.info('Worker initialized Redis connection.');
  } catch (err) {
    logger.error('Worker failed to connect to Redis:', { error: err.message });
    process.exit(1);
  }

  // Initialize BullMQ Queue Worker
  try {
    initMeetingQueue();
    logger.info(`=======================================================`);
    logger.info(`👷 DealFlow AI Worker listening to [${QUEUE_NAME}]`);
    logger.info(`=======================================================`);
  } catch (err) {
    logger.error('Worker failed to start queue listener:', { error: err.message });
    process.exit(1);
  }
};

// Graceful shutdown handling
const shutdown = async (signal) => {
  logger.info(`Worker received ${signal}. Terminating jobs and shutting down gracefully...`);
  try {
    await closeMeetingQueue();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    logger.info('Worker shutdown completed.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during worker shutdown:', { error: err.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorker();
