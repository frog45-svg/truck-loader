const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;  // 128 bits

function getMasterKey() {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is not defined.');
  }
  if (keyHex.length !== 64) {
    throw new Error(`ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes). Current length: ${keyHex.length}`);
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Decrypts an AES-256-GCM encrypted payload using the Master Key.
 * 
 * @param {{ encrypted: string, iv: string, authTag: string }} encryptedData - Hex-encoded data
 * @returns {string} - Decrypted plaintext string
 */
function decrypt(encryptedData) {
  if (!encryptedData?.encrypted || !encryptedData?.iv || !encryptedData?.authTag) {
    throw new Error('Invalid encrypted data structure: missing encrypted, iv, or authTag fields.');
  }

  const key = getMasterKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedData.iv, 'hex'),
    { authTagLength: AUTH_TAG_LENGTH }
  );

  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { decrypt };
