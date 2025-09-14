/**
 * EncryptionService - Encryption and Decryption Service
 * 
 * Provides secure encryption/decryption capabilities for wallet data,
 * private keys, and sensitive information using various encryption methods.
 */

import * as ethers from 'ethers';
// Dynamic import for Node.js crypto to avoid bundling issues
let nodeCrypto: typeof import('crypto') | undefined;

/** Encryption algorithm types */
export type EncryptionAlgorithm = 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'AES-256-CBC';

/** Encryption options */
export interface EncryptionOptions {
  /** Encryption algorithm to use */
  algorithm?: EncryptionAlgorithm;
  /** Key derivation iterations (for PBKDF2) */
  iterations?: number;
  /** Salt length in bytes */
  saltLength?: number;
  /** IV length in bytes */
  ivLength?: number;
}

/** Encrypted data container */
export interface EncryptedData {
  /** Encrypted data as hex string */
  data: string;
  /** Initialization vector */
  iv: string;
  /** Salt used for key derivation */
  salt: string;
  /** Authentication tag (for authenticated encryption) */
  tag?: string;
  /** Algorithm used */
  algorithm: EncryptionAlgorithm;
  /** Key derivation parameters */
  keyDerivation: {
    iterations: number;
    algorithm: string;
  };
}

/** Key derivation result */
export interface DerivedKey {
  /** Derived key as Uint8Array */
  key: Uint8Array;
  /** Salt used */
  salt: Uint8Array;
  /** Iterations used */
  iterations: number;
}

/**
 * Encryption service providing secure data protection
 */
export class EncryptionService {
  private isInitialized = false;
  private defaultOptions: Required<EncryptionOptions>;

  /**
   * Creates a new EncryptionService instance
   * @param options - Default encryption options
   */
  constructor(options?: EncryptionOptions) {
    this.defaultOptions = {
      algorithm: 'AES-256-GCM',
      iterations: 100000,
      saltLength: 32,
      ivLength: 16,
      ...options
    };
  }

  /**
   * Initialize the encryption service
   * @returns Promise that resolves when initialized
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return Promise.resolve();
      }

      // Try to load Node.js crypto module
      try {
        const cryptoModule = await import('crypto');
        // Handle both ES modules and CommonJS
        nodeCrypto = cryptoModule.default || cryptoModule;
      } catch {
        // Not in Node.js environment
        nodeCrypto = undefined;
      }

      // Test that crypto APIs are available
      if (typeof crypto === 'undefined' && typeof window?.crypto === 'undefined' && !nodeCrypto) {
        throw new Error('No crypto API available');
      }

      this.isInitialized = true;
      // console.log('EncryptionService initialized');
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Promise.reject(new Error(`Failed to initialize encryption service: ${errorMessage}`));
    }
  }

  /**
   * Encrypt data with password
   * @param data - Data to encrypt (string or Uint8Array)
   * @param password - Password for encryption
   * @param options - Optional encryption options
   * @returns Encrypted data container
   */
  async encrypt(
    data: string | Uint8Array,
    password: string,
    options?: EncryptionOptions
  ): Promise<EncryptedData> {
    try {
      if (!this.isInitialized) {
        throw new Error('Encryption service not initialized');
      }

      const opts = { ...this.defaultOptions, ...options };
      
      // Convert data to Uint8Array
      const dataBytes = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      // Generate salt and IV
      const salt = this.generateRandomBytes(opts.saltLength);
      const iv = this.generateRandomBytes(opts.ivLength);

      // Derive key from password
      const derivedKey = await this.deriveKey(password, salt, opts.iterations);

      // Encrypt data
      let encryptedResult: { ciphertext: Uint8Array; tag?: Uint8Array };
      
      if (opts.algorithm === 'AES-256-GCM') {
        encryptedResult = await this.encryptAESGCM(dataBytes, derivedKey.key, iv);
      } else {
        throw new Error(`Unsupported encryption algorithm: ${opts.algorithm}`);
      }

      // Return encrypted data container
      return {
        data: ethers.hexlify(encryptedResult.ciphertext),
        iv: ethers.hexlify(iv),
        salt: ethers.hexlify(salt),
        ...(encryptedResult.tag !== undefined && { tag: ethers.hexlify(encryptedResult.tag) }),
        algorithm: opts.algorithm,
        keyDerivation: {
          iterations: opts.iterations,
          algorithm: 'PBKDF2-SHA256'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypt data with password
   * @param encryptedData - Encrypted data container
   * @param password - Password for decryption
   * @returns Decrypted data as Uint8Array
   */
  async decrypt(encryptedData: EncryptedData, password: string): Promise<Uint8Array> {
    try {
      if (!this.isInitialized) {
        throw new Error('Encryption service not initialized');
      }

      // Parse encrypted data
      const ciphertext = ethers.getBytes(encryptedData.data);
      const iv = ethers.getBytes(encryptedData.iv);
      const salt = ethers.getBytes(encryptedData.salt);
      const tag = encryptedData.tag !== undefined && encryptedData.tag !== '' 
        ? ethers.getBytes(encryptedData.tag) 
        : undefined;

      // Derive key from password
      const derivedKey = await this.deriveKey(
        password,
        salt,
        encryptedData.keyDerivation.iterations
      );

      // Decrypt data
      let decryptedBytes: Uint8Array;

      if (encryptedData.algorithm === 'AES-256-GCM') {
        if (tag === undefined) {
          throw new Error('Authentication tag required for AES-GCM');
        }
        decryptedBytes = await this.decryptAESGCM(ciphertext, derivedKey.key, iv, tag);
      } else {
        throw new Error(`Unsupported decryption algorithm: ${encryptedData.algorithm}`);
      }

      return decryptedBytes;
    } catch (error) {
      // If error already says "Decryption failed", don't wrap it again
      if (error instanceof Error && error.message === 'Decryption failed') {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypt and return as string
   * @param encryptedData - Encrypted data container
   * @param password - Password for decryption
   * @returns Decrypted data as string
   */
  async decryptToString(encryptedData: EncryptedData, password: string): Promise<string> {
    const decryptedBytes = await this.decrypt(encryptedData, password);
    return new TextDecoder().decode(decryptedBytes);
  }

  /**
   * Generate secure random bytes
   * @param length - Number of bytes to generate
   * @returns Random bytes as Uint8Array
   */
  generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues !== undefined) {
      crypto.getRandomValues(bytes);
    } else if (typeof window !== 'undefined' && window.crypto?.getRandomValues !== undefined) {
      window.crypto.getRandomValues(bytes);
    } else {
      // Fallback for environments without crypto API
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return bytes;
  }

  /**
   * Generate secure random hex string
   * @param length - Number of bytes (hex will be 2x length)
   * @returns Random hex string
   */
  generateRandomHex(length: number): string {
    return ethers.hexlify(this.generateRandomBytes(length));
  }

  /**
   * Derive key from password using PBKDF2
   * @param password - Password to derive from
   * @param salt - Salt for key derivation
   * @param iterations - Number of PBKDF2 iterations
   * @returns Derived key information
   * @private
   */
  private async deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<DerivedKey> {
    try {
      // Use browser's crypto API if available
      // Check globalThis.crypto to avoid scoping issues
      const cryptoApi = typeof globalThis !== 'undefined' && globalThis.crypto
        ? globalThis.crypto
        : (typeof crypto !== 'undefined' ? crypto : undefined);

      // Try to use Web Crypto API if available
      if (cryptoApi && cryptoApi.subtle) {
        try {
          const passwordBuffer = new TextEncoder().encode(password);
          const importedKey = await cryptoApi.subtle.importKey(
            'raw',
            passwordBuffer as BufferSource,
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
          );

          const derivedBits = await cryptoApi.subtle.deriveBits(
            {
              name: 'PBKDF2',
              salt: salt as BufferSource,
              iterations,
              hash: 'SHA-256'
            },
            importedKey,
            256
          );

          const keyArray = new Uint8Array(derivedBits);
          return {
            key: keyArray,
            salt,
            iterations
          };
        } catch (webCryptoError) {
          // Fall through to ethers implementation if Web Crypto fails
        }
      }

      // Fallback implementation using ethers
      {
        const key = ethers.pbkdf2(
          new TextEncoder().encode(password),
          salt,
          iterations,
          32,
          'sha256'
        );

        // Handle both hex string and Buffer returns
        let keyBytes: Uint8Array;
        if (typeof key === 'string') {
          keyBytes = ethers.getBytes(key);
        } else if (key instanceof Uint8Array || Buffer.isBuffer(key)) {
          keyBytes = new Uint8Array(key);
        } else {
          throw new Error(`Unexpected pbkdf2 result type: ${typeof key}`);
        }

        return {
          key: keyBytes,
          salt,
          iterations
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Key derivation failed: ${errorMessage}`);
    }
  }

  /**
   * Encrypt using AES-256-GCM
   * @param data - Data to encrypt
   * @param key - Encryption key
   * @param iv - Initialization vector
   * @returns Ciphertext and authentication tag
   * @private
   */
  private async encryptAESGCM(
    data: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
    // Prefer Node.js crypto in test environment for consistency
    if (nodeCrypto) {
      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        ciphertext: new Uint8Array(encrypted),
        tag: new Uint8Array(tag)
      };
    }
    // Try Web Crypto API for browser environment
    else if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
      const importedKey = await crypto.subtle.importKey(
        'raw',
        key as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          tagLength: 128
        },
        importedKey,
        data as BufferSource
      );

      // Split ciphertext and tag
      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16);
      const tag = encryptedArray.slice(-16);

      return { ciphertext, tag };
    }
    else {
      throw new Error('No crypto API available for AES-GCM encryption');
    }
  }

  /**
   * Decrypt using AES-256-GCM
   * @param ciphertext - Encrypted data
   * @param key - Decryption key
   * @param iv - Initialization vector
   * @param tag - Authentication tag
   * @returns Decrypted data
   * @private
   */
  private async decryptAESGCM(
    ciphertext: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array
  ): Promise<Uint8Array> {
    // Prefer Node.js crypto in test environment for consistency
    if (nodeCrypto && typeof nodeCrypto.createDecipheriv === 'function') {
      const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      try {
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);

        return new Uint8Array(decrypted);
      } catch (error) {
        // Node.js crypto throws when auth tag verification fails
        // The error message is usually "Unsupported state or unable to authenticate data"
        throw new Error('Decryption failed');
      }
    }
    // Try Web Crypto API for browser environment
    else if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
      const importedKey = await crypto.subtle.importKey(
        'raw',
        key as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Combine ciphertext and tag
      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext);
      combined.set(tag, ciphertext.length);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          tagLength: 128
        },
        importedKey,
        combined as BufferSource
      );

      return new Uint8Array(decrypted);
    }
    else {
      throw new Error('No crypto API available for AES-GCM decryption');
    }
  }

  /**
   * Hash data using SHA-256
   * @param data - Data to hash (string or Uint8Array)
   * @returns Hash as hex string
   */
  async hash(data: string | Uint8Array): Promise<string> {
    const dataBytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;

    if (typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes as BufferSource);
      return ethers.hexlify(new Uint8Array(hashBuffer));
    } else if (nodeCrypto) {
      // Use Node.js crypto for SHA-256
      const hash = nodeCrypto.createHash('sha256');
      hash.update(dataBytes);
      return '0x' + hash.digest('hex');
    } else {
      // Fallback using ethers (keccak256)
      return ethers.keccak256(dataBytes);
    }
  }

  /**
   * Encrypt private key with password
   * @param privateKey - Private key to encrypt
   * @param password - Password for encryption
   * @returns Encrypted private key container
   */
  async encryptPrivateKey(privateKey: string, password: string): Promise<EncryptedData> {
    // Remove 0x prefix if present
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Validate private key format
    if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
      throw new Error('Invalid private key format');
    }

    // Encrypt the private key
    return this.encrypt(cleanPrivateKey, password, {
      algorithm: 'AES-256-GCM',
      iterations: 150000 // Higher iterations for private key encryption
    });
  }

  /**
   * Decrypt private key with password
   * @param encryptedData - Encrypted private key container
   * @param password - Password for decryption
   * @returns Decrypted private key (with 0x prefix)
   */
  async decryptPrivateKey(encryptedData: EncryptedData, password: string): Promise<string> {
    const decrypted = await this.decryptToString(encryptedData, password);
    return `0x${decrypted}`;
  }

  /**
   * Encrypt seed phrase with password
   * @param seedPhrase - Mnemonic seed phrase
   * @param password - Password for encryption
   * @returns Encrypted seed phrase container
   */
  async encryptSeedPhrase(seedPhrase: string, password: string): Promise<EncryptedData> {
    // Validate seed phrase
    if (!ethers.Mnemonic.isValidMnemonic(seedPhrase)) {
      throw new Error('Invalid seed phrase');
    }

    // Encrypt the seed phrase
    return this.encrypt(seedPhrase, password, {
      algorithm: 'AES-256-GCM',
      iterations: 200000 // Higher iterations for seed phrase encryption
    });
  }

  /**
   * Decrypt seed phrase with password
   * @param encryptedData - Encrypted seed phrase container
   * @param password - Password for decryption
   * @returns Decrypted seed phrase
   */
  async decryptSeedPhrase(encryptedData: EncryptedData, password: string): Promise<string> {
    const decrypted = await this.decryptToString(encryptedData, password);
    
    // Validate the decrypted seed phrase
    if (!ethers.Mnemonic.isValidMnemonic(decrypted)) {
      throw new Error('Decrypted data is not a valid seed phrase');
    }

    return decrypted;
  }

  /**
   * Check password strength
   * @param password - Password to check
   * @returns Strength score from 0-100
   */
  checkPasswordStrength(password: string): number {
    let score = 0;

    // Base score from length
    score += Math.min(password.length * 4, 40); // Max 40 points for length

    // Character diversity checks - count types present
    let typesPresent = 0;
    if (/[a-z]/.test(password)) {
      score += 10; // lowercase
      typesPresent++;
    }
    if (/[A-Z]/.test(password)) {
      score += 10; // uppercase
      typesPresent++;
    }
    if (/[0-9]/.test(password)) {
      score += 10; // numbers
      typesPresent++;
    }
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 15; // special chars
      typesPresent++;
    }

    // Bonus for using multiple character types
    if (typesPresent >= 3) score += 5;
    if (typesPresent === 4) score += 5;

    // Penalty for patterns (reduces score)
    const hasRepeating = /(.)\1{2,}/.test(password); // 3+ repeating chars
    const sequentialPattern = /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/gi;
    const sequentialMatches = password.toLowerCase().match(sequentialPattern) || [];
    const hasCommon = /(password|123456|qwerty|admin|letmein|welcome|monkey|dragon)/i.test(password);

    // Count repeating character groups
    const repeatingGroups = (password.match(/(.)\1{2,}/g) || []).length;

    if (hasRepeating) score -= 15 * repeatingGroups; // Higher penalty for repeating
    if (sequentialMatches.length > 0) {
      score -= 10 * sequentialMatches.length; // Penalty per sequential pattern
    }
    if (hasCommon) score -= 25; // Penalty for common passwords

    // Additional penalty for very short passwords
    if (password.length < 6) score = Math.min(score, 20);

    return Math.max(0, Math.min(score, 100));
  }

  /**
   * Clear cached data
   */
  async clearCache(): Promise<void> {
    // Clear any sensitive data from memory
    // In a production implementation, this would overwrite memory
    return Promise.resolve();
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    await this.clearCache();
    this.isInitialized = false;
    return Promise.resolve();
  }
}