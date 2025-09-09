/**
 * MPC Key Manager
 * 
 * Implements Multi-Party Computation (MPC) key management using Shamir's Secret Sharing.
 * Splits private keys into 3 shards with 2-of-3 threshold for recovery.
 */

// Mock implementations for external services that would be provided by Validator module
class SecureStorageService {
  encrypt(data: string): Promise<string> {
    // Mock implementation - would use actual encryption in production
    return Promise.resolve(Buffer.from(data).toString('base64'));
  }

  decrypt(encryptedData: string): Promise<string> {
    // Mock implementation - would use actual decryption in production
    return Promise.resolve(Buffer.from(encryptedData, 'base64').toString());
  }
}

interface RecoveryData {
  type: string;
  encryptedData: string;
  metadata: {
    shardIndex: number;
    checksum: string;
  };
}

class RecoveryService {
  private recoveryData = new Map<string, RecoveryData>();

  generateRecoveryCode(): Promise<string> {
    // Mock implementation - would generate actual recovery code in production
    return Promise.resolve('mock-recovery-code-' + Math.random().toString(36).slice(2));
  }

  validateRecoveryCode(code: string): Promise<boolean> {
    // Mock implementation - would validate actual recovery code in production
    return Promise.resolve(code.startsWith('mock-recovery-code-'));
  }

  storeRecoveryData(userId: string, data: RecoveryData): Promise<void> {
    // Mock implementation - would store in secure storage in production
    this.recoveryData.set(`${userId}_${data.type}`, data);
    return Promise.resolve();
  }

  getRecoveryData(userId: string, type: string): Promise<RecoveryData | null> {
    // Mock implementation - would retrieve from secure storage in production
    const data = this.recoveryData.get(`${userId}_${type}`);
    return Promise.resolve(data ?? null);
  }
}

interface QueryResult {
  rows: Array<{ encrypted_shard: string }>;
}

class Database {
  private storage = new Map<string, unknown>();

  save(key: string, value: unknown): Promise<void> {
    // Mock implementation - would use actual database in production
    this.storage.set(key, value);
    return Promise.resolve();
  }

  load(key: string): Promise<unknown> {
    // Mock implementation - would use actual database in production
    return Promise.resolve(this.storage.get(key));
  }

  query(_query: string, _params: unknown[]): Promise<QueryResult> {
    // Mock implementation - would execute actual SQL query in production
    // For mock purposes, return empty result
    return Promise.resolve({ rows: [] });
  }
}
import { randomBytes, createCipheriv, createDecipheriv, createHash, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import * as secp256k1 from 'secp256k1';
import BN from 'bn.js';

const pbkdf2Async = promisify(pbkdf2);

/**
 * Key shard types
 */
export enum ShardType {
  /** Device shard stored locally */
  DEVICE = 'device',
  /** Server shard stored in database */
  SERVER = 'server',
  /** Recovery shard for user backup */
  RECOVERY = 'recovery'
}

/**
 * MPC key shard information
 */
export interface KeyShard {
  /** Shard type */
  type: ShardType;
  /** Shard index (1-based) */
  index: number;
  /** Shard data (hex encoded) */
  data: string;
  /** Checksum for integrity verification */
  checksum: string;
}

/**
 * Key generation result
 */
export interface KeyGenerationResult {
  /** Public key (hex encoded) */
  publicKey: string;
  /** Ethereum address */
  address: string;
  /** Device shard */
  deviceShard: KeyShard;
  /** Server shard */
  serverShard: KeyShard;
  /** Recovery shard */
  recoveryShard: KeyShard;
}

/**
 * Key recovery request
 */
export interface KeyRecoveryRequest {
  /** User ID */
  userId: string;
  /** First shard */
  shard1: KeyShard;
  /** Second shard */
  shard2: KeyShard;
  /** Recovery passphrase (if using recovery shard) */
  recoveryPassphrase?: string;
}

/**
 * Recovered key information
 */
export interface RecoveredKey {
  /** Private key (hex encoded) */
  privateKey: string;
  /** Public key (hex encoded) */
  publicKey: string;
  /** Ethereum address */
  address: string;
}

/**
 * Shamir's Secret Sharing parameters
 */
interface ShamirParams {
  /** Prime field for calculations */
  prime: BN;
  /** Total number of shares */
  totalShares: number;
  /** Threshold for recovery */
  threshold: number;
}

/**
 * MPC Key Manager for secure key generation and recovery
 */
export class MPCKeyManager {
  private secureStorage: SecureStorageService;
  private recoveryService: RecoveryService;
  private db: Database;
  private shamirParams: ShamirParams;

  /**
   * Creates a new MPC Key Manager instance
   * Initializes secure storage, recovery service, database, and Shamir parameters
   */
  constructor() {
    this.secureStorage = new SecureStorageService();
    this.recoveryService = new RecoveryService();
    this.db = new Database();
    
    // Initialize Shamir parameters with a 256-bit prime
    this.shamirParams = {
      prime: new BN('fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', 16), // secp256k1 field prime
      totalShares: 3,
      threshold: 2
    };
  }

  /**
   * Generate a new MPC key with shards
   * @param userId - User ID
   * @returns Key generation result with shards
   */
  public async generateKey(userId: string): Promise<KeyGenerationResult> {
    // Generate a random private key
    let privateKey: Uint8Array;
    do {
      privateKey = randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privateKey));

    // Generate public key
    const publicKey = secp256k1.publicKeyCreate(privateKey, false);
    const publicKeyHex = Buffer.from(publicKey).toString('hex');
    
    // Generate Ethereum address
    const address = this.generateAddress(publicKey);

    // Split private key into shards using Shamir's Secret Sharing
    const shards = this.splitSecret(privateKey);

    // Create key shards with checksums
    const deviceShard: KeyShard = {
      type: ShardType.DEVICE,
      index: 1,
      data: shards[0].toString('hex'),
      checksum: this.generateChecksum(shards[0])
    };

    const serverShard: KeyShard = {
      type: ShardType.SERVER,
      index: 2,
      data: shards[1].toString('hex'),
      checksum: this.generateChecksum(shards[1])
    };

    const recoveryShard: KeyShard = {
      type: ShardType.RECOVERY,
      index: 3,
      data: shards[2].toString('hex'),
      checksum: this.generateChecksum(shards[2])
    };

    // Store server shard encrypted in database
    await this.storeServerShard(userId, serverShard);

    // Generate recovery passphrase for recovery shard
    const recoveryPassphrase = this.generateRecoveryPassphrase();
    
    // Store recovery shard encrypted with passphrase
    await this.storeRecoveryShard(userId, recoveryShard, recoveryPassphrase);

    // Clear private key from memory
    privateKey.fill(0);

    return {
      publicKey: publicKeyHex,
      address,
      deviceShard,
      serverShard,
      recoveryShard
    };
  }

  /**
   * Recover private key from shards
   * @param request - Key recovery request
   * @returns Recovered key information
   */
  public async recoverKey(request: KeyRecoveryRequest): Promise<RecoveredKey> {
    // Verify shard checksums
    this.verifyShardChecksum(request.shard1);
    this.verifyShardChecksum(request.shard2);

    // If using recovery shard, decrypt it first
    let shard1Data = Buffer.from(request.shard1.data, 'hex');
    let shard2Data = Buffer.from(request.shard2.data, 'hex');

    if (request.shard1.type === ShardType.RECOVERY && request.recoveryPassphrase !== null && request.recoveryPassphrase !== undefined && request.recoveryPassphrase !== '') {
      shard1Data = await this.decryptRecoveryShard(
        request.userId,
        request.shard1,
        request.recoveryPassphrase
      );
    }

    if (request.shard2.type === ShardType.RECOVERY && request.recoveryPassphrase !== null && request.recoveryPassphrase !== undefined && request.recoveryPassphrase !== '') {
      shard2Data = await this.decryptRecoveryShard(
        request.userId,
        request.shard2,
        request.recoveryPassphrase
      );
    }

    // If using server shard, retrieve and decrypt it
    if (request.shard1.type === ShardType.SERVER) {
      shard1Data = await this.retrieveServerShard(request.userId);
    }

    if (request.shard2.type === ShardType.SERVER) {
      shard2Data = await this.retrieveServerShard(request.userId);
    }

    // Reconstruct secret from shards
    const shares = [
      { index: request.shard1.index, value: shard1Data },
      { index: request.shard2.index, value: shard2Data }
    ];

    const privateKey = this.reconstructSecret(shares);

    // Verify the reconstructed private key
    if (!secp256k1.privateKeyVerify(privateKey)) {
      throw new Error('Invalid private key reconstructed');
    }

    // Generate public key and address
    const publicKey = secp256k1.publicKeyCreate(privateKey, false);
    const publicKeyHex = Buffer.from(publicKey).toString('hex');
    const address = this.generateAddress(publicKey);

    // Clear sensitive data
    shard1Data.fill(0);
    shard2Data.fill(0);

    return {
      privateKey: privateKey.toString('hex'),
      publicKey: publicKeyHex,
      address
    };
  }

  /**
   * Rotate key shards (generate new shards for existing key)
   * @param userId - User ID
   * @param existingShards - Two existing shards to recover the key
   * @param existingShards.shard1 - First shard for recovery
   * @param existingShards.shard2 - Second shard for recovery
   * @param existingShards.recoveryPassphrase - Recovery passphrase for recovery shards
   * @returns New key shards
   */
  public async rotateShards(
    userId: string,
    existingShards: { shard1: KeyShard; shard2: KeyShard; recoveryPassphrase?: string }
  ): Promise<KeyGenerationResult> {
    // First recover the existing key
    const recovered = await this.recoverKey({
      userId,
      shard1: existingShards.shard1,
      shard2: existingShards.shard2,
      recoveryPassphrase: existingShards.recoveryPassphrase
    });

    // Convert private key back to buffer
    const privateKey = Buffer.from(recovered.privateKey, 'hex');

    // Generate new shards
    const shards = this.splitSecret(privateKey);

    // Create new key shards
    const deviceShard: KeyShard = {
      type: ShardType.DEVICE,
      index: 1,
      data: shards[0].toString('hex'),
      checksum: this.generateChecksum(shards[0])
    };

    const serverShard: KeyShard = {
      type: ShardType.SERVER,
      index: 2,
      data: shards[1].toString('hex'),
      checksum: this.generateChecksum(shards[1])
    };

    const recoveryShard: KeyShard = {
      type: ShardType.RECOVERY,
      index: 3,
      data: shards[2].toString('hex'),
      checksum: this.generateChecksum(shards[2])
    };

    // Update stored shards
    await this.storeServerShard(userId, serverShard);
    
    const newRecoveryPassphrase = this.generateRecoveryPassphrase();
    await this.storeRecoveryShard(userId, recoveryShard, newRecoveryPassphrase);

    // Clear sensitive data
    privateKey.fill(0);

    return {
      publicKey: recovered.publicKey,
      address: recovered.address,
      deviceShard,
      serverShard,
      recoveryShard
    };
  }

  /**
   * Split secret using Shamir's Secret Sharing
   * @param secret - Secret to split
   * @returns Array of shares
   */
  private splitSecret(secret: Buffer): Buffer[] {
    const secretBN = new BN(secret);
    const shares: Buffer[] = [];

    // Generate random coefficients for polynomial
    const coefficients = [secretBN];
    for (let i = 1; i < this.shamirParams.threshold; i++) {
      const coef = new BN(randomBytes(32));
      coefficients.push(coef.mod(this.shamirParams.prime));
    }

    // Generate shares
    for (let x = 1; x <= this.shamirParams.totalShares; x++) {
      let y = new BN(0);
      for (let i = 0; i < coefficients.length; i++) {
        const term = coefficients[i].mul(new BN(x).pow(new BN(i)));
        y = y.add(term).mod(this.shamirParams.prime);
      }
      
      // Encode share as x||y
      const shareBuf = Buffer.concat([
        Buffer.from([x]),
        y.toArrayLike(Buffer, 'be', 32)
      ]);
      shares.push(shareBuf);
    }

    return shares;
  }

  /**
   * Reconstruct secret from shares using Lagrange interpolation
   * @param shares - Array of shares with indices
   * @returns Reconstructed secret
   */
  private reconstructSecret(shares: { index: number; value: Buffer }[]): Buffer {
    if (shares.length < this.shamirParams.threshold) {
      throw new Error(`Need at least ${this.shamirParams.threshold} shares`);
    }

    const prime = this.shamirParams.prime;
    let secret = new BN(0);

    for (let i = 0; i < shares.length; i++) {
      const xi = new BN(shares[i].index);
      const yi = new BN(shares[i].value.slice(1)); // Skip index byte

      let numerator = new BN(1);
      let denominator = new BN(1);

      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          const xj = new BN(shares[j].index);
          numerator = numerator.mul(xj.neg()).mod(prime);
          denominator = denominator.mul(xi.sub(xj)).mod(prime);
        }
      }

      // Calculate Lagrange basis polynomial
      const basis = numerator.mul(denominator.invm(prime)).mod(prime);
      const term = yi.mul(basis).mod(prime);
      secret = secret.add(term).mod(prime);
    }

    return secret.toArrayLike(Buffer, 'be', 32);
  }

  /**
   * Generate Ethereum address from public key
   * @param publicKey - Public key
   * @returns Ethereum address
   */
  private generateAddress(publicKey: Uint8Array): string {
    // Remove the first byte (0x04) from uncompressed public key
    const publicKeyWithoutPrefix = publicKey.slice(1);
    
    // Keccak256 hash of public key
    const hash = createHash('sha256').update(publicKeyWithoutPrefix).digest();
    
    // Take last 20 bytes
    const address = '0x' + hash.slice(-20).toString('hex');
    
    return address;
  }

  /**
   * Generate checksum for shard integrity
   * @param shard - Shard data
   * @returns Checksum
   */
  private generateChecksum(shard: Buffer): string {
    return createHash('sha256')
      .update(shard)
      .update(process.env.SHARD_CHECKSUM_SALT ?? 'omnibazaar_mpc')
      .digest('hex')
      .slice(0, 8);
  }

  /**
   * Verify shard checksum
   * @param shard - Shard to verify
   */
  private verifyShardChecksum(shard: KeyShard): void {
    const data = Buffer.from(shard.data, 'hex');
    const expectedChecksum = this.generateChecksum(data);
    
    if (shard.checksum !== expectedChecksum) {
      throw new Error('Invalid shard checksum');
    }
  }

  /**
   * Store server shard encrypted in database
   * @param userId - User ID
   * @param shard - Server shard
   */
  private async storeServerShard(userId: string, shard: KeyShard): Promise<void> {
    // Encrypt shard data
    const encryptionKey = await this.deriveServerShardKey(userId);
    const encrypted = await this.encryptData(shard.data, encryptionKey);

    // Store in database
    const query = `
      INSERT INTO key_shards (user_id, shard_type, encrypted_shard, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, shard_type) DO UPDATE
      SET encrypted_shard = $3, created_at = $4
    `;

    await this.db.query(query, [
      userId,
      ShardType.SERVER,
      encrypted,
      new Date()
    ]);

    // Clear sensitive data
    encryptionKey.fill(0);
  }

  /**
   * Retrieve and decrypt server shard
   * @param userId - User ID
   * @returns Decrypted shard data
   */
  private async retrieveServerShard(userId: string): Promise<Buffer> {
    const query = `
      SELECT encrypted_shard FROM key_shards
      WHERE user_id = $1 AND shard_type = $2
    `;

    const result = await this.db.query(query, [userId, ShardType.SERVER]);
    
    if (result.rows[0] === null || result.rows[0] === undefined) {
      throw new Error('Server shard not found');
    }

    // Decrypt shard
    const encryptionKey = await this.deriveServerShardKey(userId);
    const decrypted = await this.decryptData(
      result.rows[0].encrypted_shard,
      encryptionKey
    );

    // Clear sensitive data
    encryptionKey.fill(0);

    return Buffer.from(decrypted, 'hex');
  }

  /**
   * Store recovery shard encrypted with passphrase
   * @param userId - User ID
   * @param shard - Recovery shard
   * @param passphrase - Recovery passphrase
   */
  private async storeRecoveryShard(
    userId: string,
    shard: KeyShard,
    passphrase: string
  ): Promise<void> {
    // Derive key from passphrase
    const encryptionKey = await this.deriveKeyFromPassphrase(passphrase, userId);
    const encrypted = await this.encryptData(shard.data, encryptionKey);

    // Store recovery information
    await this.recoveryService.storeRecoveryData(userId, {
      type: 'mpc_recovery_shard',
      encryptedData: encrypted,
      metadata: {
        shardIndex: shard.index,
        checksum: shard.checksum
      }
    });

    // Clear sensitive data
    encryptionKey.fill(0);
  }

  /**
   * Decrypt recovery shard with passphrase
   * @param userId - User ID
   * @param shard - Recovery shard
   * @param passphrase - Recovery passphrase
   * @returns Decrypted shard data
   */
  private async decryptRecoveryShard(
    userId: string,
    shard: KeyShard,
    passphrase: string
  ): Promise<Buffer> {
    // Get encrypted recovery data
    const recoveryData = await this.recoveryService.getRecoveryData(
      userId,
      'mpc_recovery_shard'
    );

    if (recoveryData === null || recoveryData === undefined) {
      throw new Error('Recovery shard not found');
    }

    // Derive key from passphrase
    const encryptionKey = await this.deriveKeyFromPassphrase(passphrase, userId);
    const decrypted = await this.decryptData(
      recoveryData.encryptedData,
      encryptionKey
    );

    // Clear sensitive data
    encryptionKey.fill(0);

    return Buffer.from(decrypted, 'hex');
  }

  /**
   * Generate recovery passphrase
   * @returns Recovery passphrase
   */
  private generateRecoveryPassphrase(): string {
    // Generate 24-word mnemonic-style passphrase
    const words: string[] = [];
    for (let i = 0; i < 24; i++) {
      const index = randomBytes(2).readUInt16BE(0) % 2048;
      words.push(this.getWordFromIndex(index));
    }
    return words.join(' ');
  }

  /**
   * Get BIP39 word from index (simplified - use proper wordlist in production)
   * @param index - Word index
   * @returns Word
   */
  private getWordFromIndex(index: number): string {
    // This is a simplified implementation
    // In production, use the actual BIP39 wordlist
    const adjectives = ['quick', 'brown', 'lazy', 'happy', 'sad', 'bright', 'dark', 'cold'];
    const nouns = ['fox', 'dog', 'cat', 'bird', 'tree', 'cloud', 'star', 'moon'];
    
    return adjectives[index % adjectives.length] + nouns[index % nouns.length];
  }

  /**
   * Derive encryption key for server shard
   * @param userId - User ID
   * @returns Encryption key
   */
  private async deriveServerShardKey(userId: string): Promise<Buffer> {
    const masterKey = process.env.MPC_MASTER_KEY ?? 'default_master_key';
    const salt = `server_shard_${userId}`;
    
    return await pbkdf2Async(masterKey, salt, 100000, 32, 'sha256');
  }

  /**
   * Derive key from passphrase
   * @param passphrase - Passphrase
   * @param salt - Salt value
   * @returns Derived key
   */
  private async deriveKeyFromPassphrase(
    passphrase: string,
    salt: string
  ): Promise<Buffer> {
    return await pbkdf2Async(passphrase, salt, 100000, 32, 'sha256');
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data - Data to encrypt
   * @param key - Encryption key
   * @returns Encrypted data with IV and auth tag
   */
  private encryptData(data: string, key: Buffer): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    return Promise.resolve(combined.toString('base64'));
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encryptedData - Base64 encoded encrypted data
   * @param key - Decryption key
   * @returns Decrypted data
   */
  private decryptData(encryptedData: string, key: Buffer): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64');
    
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return Promise.resolve(decrypted.toString('utf8'));
  }

  /**
   * Sign a message with a reconstructed private key
   * @param userId - User ID
   * @param message - Message to sign
   * @param shards - Two shards for key recovery
   * @param shards.shard1 - First shard for recovery
   * @param shards.shard2 - Second shard for recovery
   * @param shards.recoveryPassphrase - Recovery passphrase for recovery shards
   * @returns Signature
   */
  public async signWithMPC(
    userId: string,
    message: Buffer,
    shards: { shard1: KeyShard; shard2: KeyShard; recoveryPassphrase?: string }
  ): Promise<{ signature: string; recoveryId: number }> {
    // Recover the private key
    const recovered = await this.recoverKey({
      userId,
      shard1: shards.shard1,
      shard2: shards.shard2,
      recoveryPassphrase: shards.recoveryPassphrase
    });

    // Convert private key to buffer
    const privateKey = Buffer.from(recovered.privateKey, 'hex');

    // Sign the message
    const signature = secp256k1.ecdsaSign(message, privateKey);

    // Clear private key
    privateKey.fill(0);

    return {
      signature: Buffer.from(signature.signature).toString('hex'),
      recoveryId: signature.recid
    };
  }
}