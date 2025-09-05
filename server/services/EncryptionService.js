const crypto = require('crypto');

class EncryptionService {
  constructor() {
    // Use environment variable for encryption key in production
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'healthcare-voice-agent-default-key-change-in-production';
    this.algorithm = 'aes-256-gcm';
    
    // Ensure key is the right length (32 bytes for AES-256)
    this.key = crypto.createHash('sha256').update(this.encryptionKey).digest();
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Text to encrypt
   * @returns {string} - Encrypted data with IV and tag
   */
  encrypt(text) {
    try {
      if (!text) return text;
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Return IV + tag + encrypted data
      return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted data with IV and tag
   * @returns {string} - Decrypted text
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData) return encryptedData;
      
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipherGCM(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure random UUID
   * @returns {string} - Secure UUID
   */
  generateSecureUUID() {
    return crypto.randomUUID();
  }

  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} - Secure token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a password securely
   * @param {string} password - Plain text password
   * @param {number} saltRounds - Salt rounds for bcrypt (handled by bcrypt)
   * @returns {string} - Hashed password
   */
  async hashPassword(password, saltRounds = 12) {
    const bcrypt = require('bcryptjs');
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against its hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {boolean} - Whether password matches
   */
  async verifyPassword(password, hash) {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(password, hash);
  }

  /**
   * Create a secure hash of data for integrity checking
   * @param {string} data - Data to hash
   * @returns {string} - SHA-256 hash
   */
  createHash(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Create HMAC for data authentication
   * @param {string} data - Data to authenticate
   * @param {string} secret - Secret key for HMAC
   * @returns {string} - HMAC hash
   */
  createHMAC(data, secret = this.encryptionKey) {
    return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
  }

  /**
   * Verify HMAC
   * @param {string} data - Original data
   * @param {string} signature - HMAC signature to verify
   * @param {string} secret - Secret key for HMAC
   * @returns {boolean} - Whether HMAC is valid
   */
  verifyHMAC(data, signature, secret = this.encryptionKey) {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

module.exports = { EncryptionService };
