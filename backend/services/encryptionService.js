// backend/services/encryptionService.js
const crypto = require('crypto');

// Load encryption key from environment variable, falling back gracefully if not found
const rawKey = process.env.ENCRYPTION_KEY || process.env.WHATSAPP_API_SECRET || 'antigravity_fallback_encryption_key_32_bytes_long';

// Derive a safe 32-byte key buffer using SHA-256 to ensure correct key length
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts a plain text string using AES-256-CBC.
 * Returns the format: iv_hex:ciphertext_hex
 * @param {string} text - Plain text string to encrypt
 * @returns {string} Encrypted string format
 */
function encrypt(text) {
  if (text === null || text === undefined) return '';
  const textStr = typeof text === 'object' ? JSON.stringify(text) : String(text);
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(textStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted string (iv_hex:ciphertext_hex) back to plain text.
 * @param {string} encryptedText - Encrypted string to decrypt
 * @returns {string} Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) {
    return '';
  }
  
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedTextPart = Buffer.from(parts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encryptedTextPart, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('[Encryption Service] Decryption failed:', err.message);
    return '';
  }
}

module.exports = {
  encrypt,
  decrypt
};
