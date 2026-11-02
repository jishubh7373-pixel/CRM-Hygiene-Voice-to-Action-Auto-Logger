const { Queue, Worker } = require('bullmq');
const config = require('../config');
const { getRedisClient, getRedisStatus } = require('../config/redis');
const storageService = require('../modules/storage/storage.service');
const transcriptionService = require('../modules/transcription/transcription.service');
const aiService = require('../modules/ai/ai.service');
const Meeting = require('../models/Meeting');
const { emitToOrganization } = require('../socket/socketServer');
const logger = require('../utils/logger');

const QUEUE_NAME = 'meeting-processing-queue';

let meetingQueue = null;
let meetingWorker = null;

/**
 * Core End-to-End Meeting Processor Job Runner
 */
const runMeetingProcessingPipeline = async ({ meetingId, organizationId, storageKey, filename, mimeType }) => {
  logger.info(`[Pipeline] Commencing end-to-end processing for meeting ${meetingId}...`);

  try {
    // Stage 1: Audio Retrieval & Transcription
    emitToOrganization(organizationId, 'meeting:transcription-started', {
      meetingId,
      status: 'transcribing',
    });

    let audioBuffer = null;
    if (storageKey) {
      audioBuffer = await storageService.getAudioBuffer(storageKey);
    } else {
      const meeting = await Meeting.findOne({ _id: meetingId, organizationId });
      if (meeting?.audioStorage?.key) {
        audioBuffer = await storageService.getAudioBuffer(meeting.audioStorage.key);
      }
    }

    if (audioBuffer) {
      await transcriptionService.processMeetingAudio({
        meetingId,
        organizationId,
        audioBuffer,
        filename: filename || 'audio.mp3',
        mimeType: mimeType || 'audio/mpeg',
      });
      emitToOrganization(organizationId, 'meeting:transcription-completed', {
        meetingId,
        status: 'transcription_completed',
      });
    }

    // Stage 2: AI Meeting Intelligence & Deal Health
    await aiService.analyzeMeetingIntelligence({
      meetingId,
      organizationId,
    });

    logger.info(`[Pipeline] Successfully finished all processing stages for meeting ${meetingId}`);
    return { success: true, meetingId };
  } catch (err) {
    logger.error(`[Pipeline Error] Meeting ${meetingId} processing aborted: ${err.message}`);

    await Meeting.findOneAndUpdate(
      { _id: meetingId, organizationId },
      {
        processingStatus: 'failed',
        errorDetails: {
          stage: 'pipeline_execution',
          message: err.message,
          timestamp: new Date(),
        },
      }
    );

    emitToOrganization(organizationId, 'meeting:failed', {
      meetingId,
      error: err.message,
    });

    throw err;
  }
};

const initMeetingQueue = () => {
  const redisClient = getRedisClient();
  const redisStatus = getRedisStatus();

  if (!redisClient || !redisStatus.isConnected) {
    logger.warn(`Redis disconnected. Meeting background queue initialized in direct async execution fallback.`);
    return null;
  }

  try {
    meetingQueue = new Queue(QUEUE_NAME, {
      connection: redisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    meetingQueue.on('error', (err) => {
      logger.warn(`BullMQ [${QUEUE_NAME}] error: ${err.message}`);
    });

    meetingWorker = new Worker(
      QUEUE_NAME,
      async (job) => {
        logger.info(`BullMQ Worker executing job [${job.id}]: ${job.name}`);
        const { meetingId, organizationId, storageKey, filename, mimeType } = job.data;

        return runMeetingProcessingPipeline({
          meetingId,
          organizationId,
          storageKey,
          filename,
          mimeType,
        });
      },
      { connection: redisClient }
    );

    meetingWorker.on('completed', (job) => {
      logger.info(`BullMQ Job [${job.id}] completed successfully`);
    });

    meetingWorker.on('failed', (job, err) => {
      logger.error(`BullMQ Job [${job?.id}] permanently failed: ${err.message}`);
    });

    logger.info(`BullMQ Queue [${QUEUE_NAME}] and Worker operational`);
    return meetingQueue;
  } catch (err) {
    logger.warn(`Could not initialize BullMQ Queue: ${err.message}`);
    return null;
  }
};

/**
 * Dispatch meeting job to BullMQ queue or fallback runner
 */
const addMeetingJob = async (jobName, data) => {
  const redisStatus = getRedisStatus();

  if (meetingQueue && redisStatus.isConnected) {
    try {
      const job = await meetingQueue.add(jobName, data, {
        jobId: `meeting-${data.meetingId}-${Date.now()}`,
      });
      logger.info(`Enqueued BullMQ job ${job.id} for meeting ${data.meetingId}`);
      return { id: job.id, status: 'enqueued_bullmq' };
    } catch (err) {
      logger.warn(`BullMQ dispatch failed: ${err.message}. Triggering resilient fallback execution.`);
    }
  }

  // Resilient direct asynchronous runner (zero crash in dev/test when Redis server is offline)
  setImmediate(async () => {
    try {
      await runMeetingProcessingPipeline(data);
    } catch (pipelineErr) {
      logger.warn(`Direct async runner handled error: ${pipelineErr.message}`);
    }
  });

  return { id: `local-${Date.now()}`, status: 'dispatched_async_runner' };
};

const getQueueStatus = async () => {
  const redisStatus = getRedisStatus();
  if (!meetingQueue || !redisStatus.isConnected) {
    return {
      status: 'offline_direct_fallback',
      queueName: QUEUE_NAME,
      isRedisConnected: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      meetingQueue.getWaitingCount(),
      meetingQueue.getActiveCount(),
      meetingQueue.getCompletedCount(),
      meetingQueue.getFailedCount(),
    ]);

    return {
      status: 'healthy',
      queueName: QUEUE_NAME,
      isRedisConnected: true,
      waiting,
      active,
      completed,
      failed,
    };
  } catch (err) {
    return {
      status: 'degraded',
      queueName: QUEUE_NAME,
      error: err.message,
    };
  }
};

const closeMeetingQueue = async () => {
  try {
    if (meetingWorker) {
      await meetingWorker.close();
      logger.info('BullMQ worker closed gracefully.');
    }
    if (meetingQueue) {
      await meetingQueue.close();
      logger.info('BullMQ queue closed gracefully.');
    }
  } catch (err) {
    logger.warn('Error closing BullMQ queue/worker: ' + err.message);
  }
};

module.exports = {
  initMeetingQueue,
  closeMeetingQueue,
  addMeetingJob,
  enqueueMeetingProcessing: addMeetingJob,
  getQueueStatus,
  runMeetingProcessingPipeline,
  QUEUE_NAME,
};

