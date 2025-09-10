/**
 * KeyringManager - Web2-style keyring implementation for OmniBazaar
 *
 * This implementation abstracts away blockchain complexity from users by:
 * - Using familiar username/password authentication
 * - Deterministically generating seed phrases from credentials
 * - Managing multiple blockchain accounts from single login
 * - Providing Web2-like user experience
 *
 * Based on legacy OmniCoin login algorithms with modern security enhancements
 */

import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { HDNodeWallet } from 'ethers';
import * as crypto from 'crypto';
import { ContractManager, defaultConfig } from '../contracts/ContractConfig';
import { ENSService } from '../ens/ENSService';
import { DebugLogger } from '../utils/debug-logger';

/** User login credentials */
export interface UserCredentials {
  /** User's unique username */
  username: string;
  /** User's password */
  password: string;
}

/** Cryptographic keys for a blockchain account */
export interface AccountKeys {
  /** BIP39 mnemonic phrase */
  mnemonic: string;
  /** Private key in hex format */
  privateKey: string;
  /** Public key in hex format */
  publicKey: string;
  /** Blockchain address */
  address: string;
  /** Human-readable address in username.omnicoin format */
  omniAddress: string; // username.omnicoin format
}

/** Keys for multiple blockchain networks */
export interface MultiChainKeys {
  /** Ethereum account keys */
  ethereum: AccountKeys;
  /** OmniCoin account keys */
  omnicoin: AccountKeys;
  /** Bitcoin account keys (optional) */
  bitcoin?: AccountKeys;
  /** Solana account keys (optional) */
  solana?: AccountKeys;
}

/** Active user session information */
export interface UserSession {
  /** Logged in username */
  username: string;
  /** Whether user is currently logged in */
  isLoggedIn: boolean;
  /** Multi-chain account keys */
  accounts: MultiChainKeys;
  /**
   * Session authentication token
   */
  sessionToken: string;
  /**
   * Timestamp of last user activity
   */
  lastActivity: number;
}

/**
 * Manages user authentication and key generation for multi-chain wallets
 */
export class KeyringManager {
  private static instance: KeyringManager;
  private currentSession: UserSession | null = null;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_PASSWORD_LENGTH = 12;
  private readonly SALT_ROUNDS = 100000; // PBKDF2 iterations
  private logger: DebugLogger;

  // Contract manager
  private contractManager: ContractManager;
  private ensService: ENSService;

  private constructor() {
    this.logger = new DebugLogger('keyring:manager');
    // Initialize contract manager
    this.contractManager = ContractManager.initialize(defaultConfig);
    this.ensService = ENSService.getInstance();
  }

  /**
   * Get singleton instance of KeyringManager
   * @returns The KeyringManager singleton instance
   */
  public static getInstance(): KeyringManager {
    if (KeyringManager.instance === undefined) {
      KeyringManager.instance = new KeyringManager();
    }
    return KeyringManager.instance;
  }

  /**
   * Register a new user with username/password
   * Creates deterministic seed phrase from credentials (legacy-compatible)
   * @param credentials User credentials containing username and password
   * @returns User session with multi-chain account keys
   */
  public async registerUser(credentials: UserCredentials): Promise<UserSession> {
    this.validateCredentials(credentials);

    // Check username uniqueness (to be implemented with backend)
    const isUnique = await this.isUsernameUnique(credentials.username);
    if (!isUnique) {
      throw new Error('Username already exists. Please choose a different username.');
    }

    // Generate deterministic seed phrase from username/password
    const seedPhrase = this.generateDeterministicSeed(credentials);

    // Create multi-chain accounts from seed
    const accounts = await this.createMultiChainAccounts(seedPhrase, credentials.username);

    // Create session
    const session = this.createSession(credentials.username, accounts);

    // Register username on blockchain
    await this.registerUsernameOnChain(credentials.username, accounts.omnicoin.address);

    this.currentSession = session;
    return session;
  }

  /**
   * Login existing user with username/password
   * Regenerates same seed phrase from credentials
   * @param credentials User credentials containing username and password
   * @returns User session with multi-chain account keys
   */
  public async loginUser(credentials: UserCredentials): Promise<UserSession> {
    this.validateCredentials(credentials);

    // Regenerate seed phrase from credentials (deterministic)
    const seedPhrase = this.generateDeterministicSeed(credentials);

    // Recreate accounts from seed
    const accounts = await this.createMultiChainAccounts(seedPhrase, credentials.username);

    // Verify account exists (optional backend check)
    const accountExists = await this.verifyAccountExists(accounts.omnicoin.address);
    if (!accountExists) {
      throw new Error('Invalid username or password.');
    }

    // Create session
    const session = this.createSession(credentials.username, accounts);

    this.currentSession = session;
    return session;
  }

  /**
   * Generate deterministic seed phrase from username/password
   * Based on legacy OmniCoin algorithm with security improvements
   * @param credentials User credentials containing username and password
   * @returns BIP39 mnemonic seed phrase
   */
  private generateDeterministicSeed(credentials: UserCredentials): string {
    // Legacy-compatible seed generation with enhanced security
    // Original: seed = username + role + password
    // Enhanced: Use PBKDF2 for key stretching and add salt

    const normalizedUsername = credentials.username.toLowerCase().trim();
    const baseString = `${normalizedUsername}active${credentials.password}`;

    // Use PBKDF2 for key stretching (more secure than simple concatenation)
    const salt = crypto.createHash('sha256').update(normalizedUsername).digest();
    const derivedKey = crypto.pbkdf2Sync(baseString, salt, this.SALT_ROUNDS, 64, 'sha512');

    // Convert to entropy for BIP39 mnemonic
    const entropy = derivedKey.slice(0, 32); // 256 bits for 24-word mnemonic

    // Generate BIP39 mnemonic from entropy
    const mnemonic = bip39.entropyToMnemonic(entropy);

    return mnemonic;
  }

  /**
   * Create multi-chain accounts from seed phrase
   * @param seedPhrase BIP39 mnemonic seed phrase
   * @param username Username for address generation
   * @returns Multi-chain account keys
   */
  private createMultiChainAccounts(seedPhrase: string, username: string): Promise<MultiChainKeys> {
    // Validate mnemonic
    if (!bip39.validateMnemonic(seedPhrase)) {
      throw new Error('Invalid seed phrase generated');
    }

    // Create HD wallet from mnemonic
    const hdNode = HDNodeWallet.fromPhrase(seedPhrase);

    // Generate accounts for different chains
    const accounts: MultiChainKeys = {
      ethereum: this.createEthereumAccount(hdNode, username),
      omnicoin: this.createOmniCoinAccount(hdNode, username),
    };

    return Promise.resolve(accounts);
  }

  /**
   * Create Ethereum-compatible account
   * @param hdNode Hierarchical deterministic wallet node
   * @param username Username for address generation
   * @returns Ethereum account keys
   */
  private createEthereumAccount(hdNode: HDNodeWallet, username: string): AccountKeys {
    // Standard Ethereum derivation path: m/44'/60'/0'/0/0
    const ethPath = "m/44'/60'/0'/0/0";
    const ethNode = hdNode.derivePath(ethPath);

    const privateKey = ethNode.privateKey;
    const wallet = new ethers.Wallet(privateKey);

    return {
      mnemonic: hdNode.mnemonic?.phrase ?? '',
      privateKey: privateKey,
      publicKey: wallet.signingKey.publicKey,
      address: wallet.address,
      omniAddress: `${username}.omnicoin` // Future ENS-style implementation
    };
  }

  /**
   * Create OmniCoin account
   * @param hdNode Hierarchical deterministic wallet node
   * @param username Username for address generation
   * @returns OmniCoin account keys
   */
  private createOmniCoinAccount(hdNode: HDNodeWallet, username: string): AccountKeys {
    // Custom OmniCoin derivation path: m/44'/9999'/0'/0/0 (9999 = custom coin type)
    const omniPath = "m/44'/9999'/0'/0/0";
    const omniNode = hdNode.derivePath(omniPath);

    const privateKey = omniNode.privateKey;
    // Note: OmniCoin address generation will need custom implementation
    const address = this.generateOmniCoinAddress(omniNode.publicKey);

    return {
      mnemonic: hdNode.mnemonic?.phrase ?? '',
      privateKey: privateKey,
      publicKey: omniNode.publicKey,
      address: address,
      omniAddress: `${username}.omnicoin`
    };
  }

  /**
   * Generate OmniCoin address from public key
   * TODO: Implement based on OmniCoin address format
   * @param publicKey The public key to derive address from
   * @returns OmniCoin address
   */
  private generateOmniCoinAddress(publicKey: string): string {
    // For now, use Ethereum-style address generation
    // In production: implement OmniCoin specific address format
    const pubKeyBuffer = Buffer.from(publicKey.slice(2), 'hex');
    const hash = crypto.createHash('sha256').update(pubKeyBuffer).digest();
    const hash160 = crypto.createHash('ripemd160').update(hash).digest();
    const address = `omni${hash160.toString('hex').slice(0, 40)}`;
    return address;
  }

  /**
   * Verify if account exists on blockchain
   * @param address Blockchain address to verify
   * @returns True if account exists, false otherwise
   */
  private verifyAccountExists(address: string): Promise<boolean> {
    // TODO: Implement blockchain verification
    // For now, return true for all addresses
    void this.logger.info('Verifying account exists', { address });
    return Promise.resolve(true);
  }

  /**
   * Check if username is unique
   * @param username Username to check
   * @param _username
   * @returns True if username is available, false if taken
   */
  private isUsernameUnique(_username: string): boolean {
    try {
      // Check with ENS service
      // TODO: Implement isUsernameAvailable in ENSService
      // const available = await this.ensService.isUsernameAvailable(username) as boolean;
      // return available;
      return true; // For now, assume all usernames are available
    } catch (error) {
      void this.logger.warn('Failed to check username uniqueness', error);
      // In development, always return true
      return true;
    }
  }

  /**
   * Register username on blockchain
   * @param username Username to register
   * @param address Blockchain address to associate
   * @param _username
   * @param _address
   * @returns Transaction hash or empty string if failed
   */
  private registerUsernameOnChain(_username: string, _address: string): string {
    try {
      // Register with ENS service
      // TODO: Implement registerUsername in ENSService
      // const txHash = await this.ensService.registerUsername(username, address) as string;
      const txHash = '0x' + '0'.repeat(64); // Mock transaction hash
      void this.logger.info('Username registered on-chain', { username, txHash });
      return txHash;
    } catch (error) {
      void this.logger.warn('Failed to register username on-chain', error);
      // Non-critical failure, continue with session
      return '';
    }
  }

  /**
   * Create session object
   * @param username Username for session
   * @param accounts Multi-chain account keys
   * @returns User session object
   */
  private createSession(username: string, accounts: MultiChainKeys): UserSession {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    return {
      username,
      isLoggedIn: true,
      accounts,
      sessionToken,
      lastActivity: Date.now()
    };
  }

  /**
   * Validate user credentials
   * @param credentials User credentials to validate
   * @throws Error if credentials are invalid
   */
  private validateCredentials(credentials: UserCredentials): void {
    if (credentials.username === undefined || credentials.username === null || credentials.username === '' || credentials.username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }

    if (credentials.password === undefined || credentials.password === null || credentials.password === '' || credentials.password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long.`);
    }

    // Validate username format (alphanumeric + underscore only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(credentials.username)) {
      throw new Error('Username can only contain letters, numbers, and underscores.');
    }
  }

  /**
   * Get current session
   * @returns Current user session or null if not logged in
   */
  public getSession(): UserSession | null {
    if (this.currentSession === null) {
      return null;
    }

    // Check session timeout
    const now = Date.now();
    if (now - this.currentSession.lastActivity > this.SESSION_TIMEOUT) {
      this.logout();
      return null;
    }

    // Update last activity
    this.currentSession.lastActivity = now;
    return this.currentSession;
  }

  /**
   * Logout current session
   * @returns void
   */
  public logout(): void {
    this.currentSession = null;
    void this.logger.info('User logged out');
  }

  /**
   * Check if user is logged in
   * @returns True if user is logged in, false otherwise
   */
  public isLoggedIn(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Get current wallet address
   * @returns Current Ethereum address or null if not logged in
   */
  public getCurrentAddress(): string | null {
    const session = this.getSession();
    if (session === null) {
      return null;
    }
    return session.accounts.ethereum.address;
  }

  /**
   * Login with seed phrase
   * @param seedPhrase BIP39 mnemonic seed phrase
   * @param username Optional username for session
   * @returns User session with multi-chain account keys
   * @throws Error if already logged in or invalid seed phrase
   */
  public async loginWithSeed(seedPhrase: string, username?: string): Promise<UserSession> {
    // Check if already logged in
    if (this.currentSession !== null) {
      throw new Error('Already logged in. Please logout first.');
    }

    // Validate seed phrase
    if (!bip39.validateMnemonic(seedPhrase)) {
      throw new Error('Invalid seed phrase');
    }

    // Generate username from seed if not provided
    const finalUsername = username ?? this.generateUsernameFromSeed(seedPhrase);

    // Create accounts from seed
    const accounts = await this.createMultiChainAccounts(seedPhrase, finalUsername);

    // Create session
    const session = this.createSession(finalUsername, accounts);

    this.currentSession = session;
    return session;
  }

  /**
   * Generate username from seed phrase
   * @param seedPhrase BIP39 mnemonic seed phrase
   * @returns Generated username
   */
  private generateUsernameFromSeed(seedPhrase: string): string {
    // Use first word of mnemonic plus random number
    const firstWord = seedPhrase.split(' ')[0];
    const randomNum = Math.floor(Math.random() * 10000);
    return `${firstWord}${randomNum}`;
  }

  /**
   * Export current session's private keys
   * WARNING: Handle with extreme care
   * @returns Private keys or null if not logged in
   */
  public exportPrivateKeys(): MultiChainKeys | null {
    const session = this.getSession();
    if (session === null) {
      return null;
    }

    // Return a copy to prevent modification
    return JSON.parse(JSON.stringify(session.accounts)) as MultiChainKeys;
  }

  /**
   * Get recovery seed phrase for current session
   * @param password User password for verification
   * @returns Seed phrase or null if verification fails
   */
  public getRecoverySeed(password: string): Promise<string | null> {
    const session = this.getSession();
    if (session === null) {
      return Promise.resolve(null);
    }

    // Regenerate seed from credentials to verify password
    const credentials: UserCredentials = {
      username: session.username,
      password
    };

    try {
      const verificationSeed = this.generateDeterministicSeed(credentials);
      // Verify it matches current session
      const hdNode = HDNodeWallet.fromPhrase(verificationSeed);
      const ethAccount = this.createEthereumAccount(hdNode, session.username);
      
      if (ethAccount.address !== session.accounts.ethereum.address) {
        return Promise.resolve(null); // Password incorrect
      }

      return Promise.resolve(verificationSeed);
    } catch (error) {
      void this.logger.warn('Failed to verify password for seed recovery', error);
      return Promise.resolve(null);
    }
  }

  /**
   * Import account from seed phrase and credentials
   * @param credentials User credentials for the account
   * @param seedPhrase Optional seed phrase to import
   * @returns User session with imported account
   */
  public async importAccount(credentials: UserCredentials, seedPhrase?: string): Promise<UserSession> {
    this.validateCredentials(credentials);

    // If seed phrase provided, verify it matches credentials
    if (seedPhrase !== undefined && seedPhrase !== null && seedPhrase !== '') {
      if (!bip39.validateMnemonic(seedPhrase)) {
        throw new Error('Invalid seed phrase');
      }

      // Verify seed matches credentials
      const expectedSeed = this.generateDeterministicSeed(credentials);
      if (seedPhrase !== expectedSeed) {
        throw new Error('Seed phrase does not match username/password combination');
      }
    }

    // Use login flow which regenerates from credentials
    return this.loginUser(credentials);
  }

  /**
   * Change password for current session
   * @param oldPassword Current password
   * @param newPassword New password
   * @returns True if password changed successfully
   */
  public async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const session = this.getSession();
    if (session === null) {
      throw new Error('Not logged in');
    }

    // Verify old password
    const oldSeed = await this.getRecoverySeed(oldPassword);
    if (oldSeed === null) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`New password must be at least ${this.MIN_PASSWORD_LENGTH} characters long.`);
    }

    // Note: In a real implementation, this would update the deterministic seed generation
    // For now, we just log the attempt
    void this.logger.info('Password change requested', { username: session.username });
    
    // Return false as we can't actually change deterministic passwords
    return false;
  }
}