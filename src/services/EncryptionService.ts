import CryptoJS from 'crypto-js';

export class EncryptionService {
  private static readonly SECRET_KEY = 'HVA_2024_SECRET_KEY_HEALTHCARE_VOICE_AGENT';
  
  /**
   * Encrypt a string value
   */
  static encrypt(text: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.SECRET_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   */
  static decrypt(encryptedText: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error('Decryption resulted in empty string');
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure session token
   */
  static generateSessionToken(): string {
    const timestamp = Date.now().toString();
    const randomBytes = CryptoJS.lib.WordArray.random(16).toString();
    const tokenData = `${timestamp}-${randomBytes}`;
    
    return CryptoJS.SHA256(tokenData).toString();
  }

  /**
   * Hash a password (for comparison, not storage)
   */
  static hashPassword(password: string, salt?: string): string {
    const usedSalt = salt || CryptoJS.lib.WordArray.random(16).toString();
    const hash = CryptoJS.PBKDF2(password, usedSalt, {
      keySize: 256/32,
      iterations: 10000
    }).toString();
    
    return `${usedSalt}:${hash}`;
  }

  /**
   * Verify a password against its hash
   */
  static verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const computedHash = this.hashPassword(password, salt);
      
      return computedHash === hashedPassword;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random key
   */
  static generateRandomKey(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Create a secure hash of any data
   */
  static createHash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Encrypt object data
   */
  static encryptObject(obj: Record<string, any>): string {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypt object data
   */
  static decryptObject<T>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }

  /**
   * Generate HMAC signature for data integrity
   */
  static generateHMAC(data: string, key?: string): string {
    const hmacKey = key || this.SECRET_KEY;
    return CryptoJS.HmacSHA256(data, hmacKey).toString();
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, key?: string): boolean {
    const computedSignature = this.generateHMAC(data, key);
    return computedSignature === signature;
  }

  /**
   * Secure random number generation
   */
  static generateSecureRandomNumber(min: number, max: number): number {
    const range = max - min;
    const randomWord = CryptoJS.lib.WordArray.random(4);
    const randomNumber = randomWord.words[0];
    
    // Convert to positive number and scale to range
    const positiveNumber = Math.abs(randomNumber);
    return min + (positiveNumber % (range + 1));
  }

  /**
   * Generate a cryptographically secure UUID
   */
  static generateSecureUUID(): string {
    const randomBytes = CryptoJS.lib.WordArray.random(16);
    const hex = randomBytes.toString();
    
    // Format as UUID v4
    return [
      hex.substr(0, 8),
      hex.substr(8, 4),
      '4' + hex.substr(13, 3),
      ((parseInt(hex.substr(16, 1), 16) & 0x3) | 0x8).toString(16) + hex.substr(17, 3),
      hex.substr(20, 12)
    ].join('-');
  }

  /**
   * Encrypt data with expiration
   */
  static encryptWithExpiration(data: string, expirationMinutes: number = 60): string {
    const expirationTime = Date.now() + (expirationMinutes * 60 * 1000);
    const dataWithExpiration = {
      data,
      expires: expirationTime
    };
    
    return this.encryptObject(dataWithExpiration);
  }

  /**
   * Decrypt data and check expiration
   */
  static decryptWithExpiration(encryptedData: string): string | null {
    try {
      const decryptedObject = this.decryptObject<{ data: string; expires: number }>(encryptedData);
      
      if (Date.now() > decryptedObject.expires) {
        return null; // Data has expired
      }
      
      return decryptedObject.data;
    } catch (error) {
      console.error('Error decrypting expired data:', error);
      return null;
    }
  }

  /**
   * Create a fingerprint of the current browser/device
   */
  static createDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled ? '1' : '0'
    ];
    
    const fingerprint = components.join('|');
    return this.createHash(fingerprint);
  }

  /**
   * Validate data integrity with checksum
   */
  static addChecksum(data: string): string {
    const checksum = this.createHash(data);
    return `${data}|${checksum}`;
  }

  /**
   * Verify data integrity with checksum
   */
  static verifyChecksum(dataWithChecksum: string): { isValid: boolean; data: string } {
    const parts = dataWithChecksum.split('|');
    
    if (parts.length !== 2) {
      return { isValid: false, data: '' };
    }
    
    const [data, checksum] = parts;
    const computedChecksum = this.createHash(data);
    
    return {
      isValid: computedChecksum === checksum,
      data
    };
  }
}
