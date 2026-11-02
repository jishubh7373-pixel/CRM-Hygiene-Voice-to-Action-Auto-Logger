const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/appError');
const { getDbStatus } = require('./config/db');
const { getRedisStatus } = require('./config/redis');

const app = express();

// Request ID Tracing Middleware
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Response Compression
app.use(compression());

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Production-hardened CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? origin.replace(/\/+$/, '') : '';
      if (!origin || normalizedOrigin === config.clientUrl || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else if (config.env === 'production') {
        callback(new AppError('CORS origin blocked by policy.', 403, 'CORS_REJECTED'));
      } else {
        callback(null, true); // Dev fallback
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

// Body Parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL Operator Injection Sanitizer
const sanitizeOperators = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitizeOperators(obj[key]);
    }
  }
};

app.use((req, res, next) => {
  if (req.body) sanitizeOperators(req.body);
  if (req.query) sanitizeOperators(req.query);
  if (req.params) sanitizeOperators(req.params);
  next();
});

// Request Logging
if (config.env !== 'test') {
  morgan.token('req-id', (req) => req.id || '-');
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms reqId=:req-id'));
}

// Rate Limiting on Authentication endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 login/register requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// Top-Level Liveness & Readiness Probes (for load balancers & orchestrators)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DealFlow AI',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (req, res) => {
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

// API Versioning
app.use('/api/v1', routes);

// Root path friendly response
app.get('/', (req, res) => {
  res.json({
    service: 'DealFlow AI API Gateway',
    version: '1.0.0',
    documentation: '/docs/API.md',
    healthCheck: '/api/v1/health',
    readinessCheck: '/ready',
  });
});

// 404 Route Handler
app.use('*', (req, res, next) => {
  next(new AppError(`The requested route '${req.originalUrl}' does not exist on this server.`, 404, 'ROUTE_NOT_FOUND'));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
