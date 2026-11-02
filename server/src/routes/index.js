const express = require('express');
const { getDbStatus } = require('../config/db');
const { getRedisStatus } = require('../config/redis');
const { getQueueStatus } = require('../queues/meetingQueue');

const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const meetingRoutes = require('./meetingRoutes');
const dealRoutes = require('./dealRoutes');
const actionItemRoutes = require('./actionItemRoutes');
const integrationRoutes = require('./integrationRoutes');
const webhookRoutes = require('./webhookRoutes');
const automationRoutes = require('../modules/automation/automation.routes');
const settingsRoutes = require('./settingsRoutes');

const router = express.Router();

/**
 * Health check endpoint
 * Reports API uptime, MongoDB readiness, and Redis / Queue status
 */
router.get('/health', async (req, res) => {
  const dbStatus = getDbStatus();
  const redisStatus = getRedisStatus();
  const queueStatus = await getQueueStatus();

  const isHealthy = dbStatus.isConnected;

  const payload = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'DealFlow AI API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components: {
      mongodb: dbStatus,
      redis: redisStatus,
      queue: queueStatus,
    },
  };

  return res.status(isHealthy ? 200 : 503).json(payload);
});

router.get('/ready', (req, res) => {
  const dbStatus = getDbStatus();
  const redisStatus = getRedisStatus();
  const isReady = dbStatus.isConnected;

  return res.status(isReady ? 200 : 503).json({
    ready: isReady,
    status: isReady ? 'ready' : 'unready',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbStatus.state || (dbStatus.isConnected ? 'connected' : 'disconnected'),
      redis: redisStatus.status,
    },
  });
});

// Mount module routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/meetings', meetingRoutes);
router.use('/deals', dealRoutes);
router.use('/actions', actionItemRoutes);
router.use('/integrations', integrationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/automation', automationRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
