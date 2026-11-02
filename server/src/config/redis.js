const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient = null;
let isRedisConnected = false;

const initRedis = () => {
  if (redisClient) return redisClient;

  const redisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times) => {
      // Don't retry indefinitely in development if no server is running
      if (times > 3 && config.env === 'development') {
        logger.warn('Redis retry limit reached for dev environment. Operating in degraded queue mode.');
        return null;
      }
      return Math.min(times * 1000, 5000);
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  };

  try {
    if (config.redis.url) {
      redisClient = new Redis(config.redis.url, redisOptions);
    } else {
      redisClient = new Redis(redisOptions);
    }

    redisClient.on('connect', () => {
      isRedisConnected = true;
      logger.info('Redis connected successfully', { host: config.redis.host, port: config.redis.port });
    });

    redisClient.on('ready', () => {
      isRedisConnected = true;
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      logger.warn('Redis connection issue: ' + err.message);
    });

    redisClient.on('close', () => {
      isRedisConnected = false;
    });

    // Attempt non-blocking connection
    redisClient.connect().catch((err) => {
      logger.warn('Initial Redis connection not established: ' + err.message + ' (Queues will run in offline mode)');
    });

    return redisClient;
  } catch (err) {
    logger.warn('Failed to initialize Redis client: ' + err.message);
    return null;
  }
};

const getRedisStatus = () => ({
  isConnected: isRedisConnected,
  status: isRedisConnected ? 'connected' : 'disconnected',
  host: config.redis.host,
  port: config.redis.port,
});

const getRedisClient = () => {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
};

module.exports = {
  initRedis,
  getRedisClient,
  getRedisStatus,
};
