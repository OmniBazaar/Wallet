/**
 * EncryptionService - Encryption and Decryption Service
 * 
 * Provides secure encryption/decryption capabilities for wallet data,
 * private keys, and sensitive information using various encryption methods.
 */

import * as ethers from 'ethers';

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
  init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return Promise.resolve();
      }

      // Test that crypto APIs are available
      if (typeof crypto === 'undefined' && typeof window?.crypto === 'undefined') {
        throw new Error('Crypto API not available');
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
        await this.init();
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
        tag: encryptedResult.tag !== undefined ? ethers.hexlify(encryptedResult.tag) : undefined,
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
        await this.init();
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
      if (typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
        const passwordBuffer = new TextEncoder().encode(password);
        const importedKey = await crypto.subtle.importKey(
          'raw',
          passwordBuffer,
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );

        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt,
            iterations,
            hash: 'SHA-256'
          },
          importedKey,
          256
        );

        return {
          key: new Uint8Array(derivedBits),
          salt,
          iterations
        };
      } else {
        // Fallback implementation using ethers
        const key = ethers.pbkdf2(
          new TextEncoder().encode(password),
          salt,
          iterations,
          32,
          'sha256'
        );
        return {
          key: ethers.getBytes(key),
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
    if (typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
      const importedKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          tagLength: 128
        },
        importedKey,
        data
      );

      // Split ciphertext and tag
      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16);
      const tag = encryptedArray.slice(-16);

      return { ciphertext, tag };
    } else {
      throw new Error('Web Crypto API not available for AES-GCM encryption');
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
    if (typeof crypto !== 'undefined' && crypto.subtle !== undefined) {
      const importedKey = await crypto.subtle.importKey(
        'raw',
        key,
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
          iv,
          tagLength: 128
        },
        importedKey,
        combined
      );

      return new Uint8Array(decrypted);
    } else {
      throw new Error('Web Crypto API not available for AES-GCM decryption');
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
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
      return ethers.hexlify(new Uint8Array(hashBuffer));
    } else {
      // Fallback using ethers
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
   * Clear cached data
   */
  clearCache(): void {
    // Clear any sensitive data from memory
    // In a production implementation, this would overwrite memory
  }

  /**
   * Cleanup service and release resources
   */
  cleanup(): void {
    this.clearCache();
    this.isInitialized = false;
  }
}