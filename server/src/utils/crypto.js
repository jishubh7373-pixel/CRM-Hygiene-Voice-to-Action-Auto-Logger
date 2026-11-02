const crypto = require('crypto');
const config = require('../config');

// Ensure a 32-byte (256-bit) key
const getEncryptionKey = () => {
  const rawKey = config.integrations?.encryptionKey || 'dealflow_integrations_secret_key_32bytes_hex!!';
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} text
 * @returns {{ ciphertext: string, iv: string, authTag: string }}
 */
const encrypt = (text) => {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
};

/**
 * Decrypt an AES-256-GCM payload
 * @param {{ ciphertext: string, iv: string, authTag: string }} payload
 * @returns {string} Plaintext
 */
const decrypt = (payload) => {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) {
    return null;
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Encrypt arbitrary JSON object
 */
const encryptObject = (obj) => {
  if (!obj) return null;
  return encrypt(JSON.stringify(obj));
};

/**
 * Decrypt arbitrary JSON object
 */
const decryptObject = (payload) => {
  const decrypted = decrypt(payload);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
};

/**
 * Generate a signed, time-limited OAuth state string
 * State contains { organizationId, userId, provider, nonce, exp }
 */
const generateOAuthState = ({ organizationId, userId, provider }) => {
  const payload = {
    organizationId: organizationId.toString(),
    userId: userId.toString(),
    provider,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
  };
  const json = JSON.stringify(payload);
  const encrypted = encrypt(json);
  // URL-safe base64 string
  return Buffer.from(JSON.stringify(encrypted)).toString('base64url');
};

/**
 * Verify and decode an incoming OAuth state string
 */
const verifyOAuthState = (stateString) => {
  try {
    const rawJson = Buffer.from(stateString, 'base64url').toString('utf8');
    const encryptedPayload = JSON.parse(rawJson);
    const decryptedJson = decrypt(encryptedPayload);
    if (!decryptedJson) return null;

    const parsed = JSON.parse(decryptedJson);
    if (parsed.exp < Date.now()) {
      return null; // Expired
    }
    return parsed;
  } catch {
    return null;
  }
};

module.exports = {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  generateOAuthState,
  verifyOAuthState,
};
