const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'apikey',
  'authorization',
  'secretaccesskey',
  'encryptionkey',
  'webhooksecret',
]);

const redactObject = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 5) return obj;
  if (Array.isArray(obj)) return obj.map((item) => redactObject(item, depth + 1));

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      clean[key] = redactObject(value, depth + 1);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

/**
 * Structured Production Application Logger
 */
const logger = {
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const cleanMeta = redactObject(meta);
    console.log(`[INFO] [${timestamp}] ${message}`, Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : '');
  },
  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const cleanMeta = redactObject(meta);
    console.warn(`[WARN] [${timestamp}] ${message}`, Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : '');
  },
  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const cleanMeta = redactObject(meta);
    console.error(`[ERROR] [${timestamp}] ${message}`, Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : '');
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      const cleanMeta = redactObject(meta);
      console.debug(`[DEBUG] [${timestamp}] ${message}`, Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : '');
    }
  },
  redact: redactObject,
};

module.exports = logger;

