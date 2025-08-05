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
import { HDNode } from '@ethers/hdnode';
import * as crypto from 'crypto';
import { ContractManager, defaultConfig } from '../contracts/ContractConfig';
import { ENSService } from '../ens/ENSService';

export interface UserCredentials {
  username: string;
  password: string;
}

export interface AccountKeys {
  mnemonic: string;
  privateKey: string;
  publicKey: string;
  address: string;
  omniAddress: string; // username.omnicoin format
}

export interface MultiChainKeys {
  ethereum: AccountKeys;
  omnicoin: AccountKeys;
  bitcoin?: AccountKeys;
  solana?: AccountKeys;
}

export interface UserSession {
  username: string;
  isLoggedIn: boolean;
  accounts: MultiChainKeys;
  sessionToken: string;
  lastActivity: number;
}

export class KeyringManager {
  private static instance: KeyringManager;
  private currentSession: UserSession | null = null;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_PASSWORD_LENGTH = 12;
  private readonly SALT_ROUNDS = 100000; // PBKDF2 iterations
  
  // Contract manager
  private contractManager: ContractManager;
  private ensService: ENSService;

  private constructor() {
    // Initialize contract manager
    this.contractManager = ContractManager.initialize(defaultConfig);
    this.ensService = ENSService.getInstance();
  }

  public static getInstance(): KeyringManager {
    if (!KeyringManager.instance) {
      KeyringManager.instance = new KeyringManager();
    }
    return KeyringManager.instance;
  }

  /**
   * Register a new user with username/password
   * Creates deterministic seed phrase from credentials (legacy-compatible)
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
    
    // Store encrypted account data (implementation depends on storage strategy)
    await this.storeUserData(credentials, accounts);
    
    // Register username on blockchain
    await this.registerUsernameOnChain(credentials.username, accounts.omnicoin.address);
    
    this.currentSession = session;
    return session;
  }

  /**
   * Login existing user with username/password
   * Regenerates same seed phrase from credentials
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
    const mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));
    
    return mnemonic;
  }

  /**
   * Create multi-chain accounts from seed phrase
   */
  private async createMultiChainAccounts(seedPhrase: string, username: string): Promise<MultiChainKeys> {
    // Validate mnemonic
    if (!bip39.validateMnemonic(seedPhrase)) {
      throw new Error('Invalid seed phrase generated');
    }

    // Create HD wallet from mnemonic
    const hdNode = HDNode.fromMnemonic(seedPhrase);
    
    // Generate accounts for different chains
    const accounts: MultiChainKeys = {
      ethereum: await this.createEthereumAccount(hdNode, username),
      omnicoin: await this.createOmniCoinAccount(hdNode, username),
    };

    return accounts;
  }

  /**
   * Create Ethereum-compatible account
   */
  private async createEthereumAccount(hdNode: HDNode, username: string): Promise<AccountKeys> {
    // Standard Ethereum derivation path: m/44'/60'/0'/0/0
    const ethPath = "m/44'/60'/0'/0/0";
    const ethNode = hdNode.derivePath(ethPath);
    
    const privateKey = ethNode.privateKey;
    const wallet = new ethers.Wallet(privateKey);
    
    return {
      mnemonic: hdNode.mnemonic,
      privateKey: privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
      omniAddress: `${username}.omnicoin` // Future ENS-style implementation
    };
  }

  /**
   * Create OmniCoin account
   */
  private async createOmniCoinAccount(hdNode: HDNode, username: string): Promise<AccountKeys> {
    // Custom OmniCoin derivation path: m/44'/9999'/0'/0/0 (9999 = custom coin type)
    const omniPath = "m/44'/9999'/0'/0/0";
    const omniNode = hdNode.derivePath(omniPath);
    
    const privateKey = omniNode.privateKey;
    // Note: OmniCoin address generation will need custom implementation
    const address = this.generateOmniCoinAddress(omniNode.publicKey);
    
    return {
      mnemonic: hdNode.mnemonic,
      privateKey: privateKey,
      publicKey: omniNode.publicKey,
      address: address,
      omniAddress: `${username}.omnicoin`
    };
  }

  /**
   * Generate OmniCoin address from public key
   * TODO: Implement based on OmniCoin address format
   */
  private generateOmniCoinAddress(publicKey: string): string {
    // Placeholder - implement based on OmniCoin specifications
    const hash = crypto.createHash('sha256').update(publicKey).digest();
    return 'XOM' + hash.slice(0, 17).toString('hex'); // Placeholder format
  }

  /**
   * Create user session
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
   */
  private validateCredentials(credentials: UserCredentials): void {
    if (!credentials.username || credentials.username.trim().length === 0) {
      throw new Error('Username is required');
    }

    if (!credentials.password || credentials.password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters`);
    }

    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(credentials.username)) {
      throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
    }

    if (credentials.username.length < 3 || credentials.username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }
  }

  /**
   * Check if username is unique by querying the registry contract
   */
  private async isUsernameUnique(username: string): Promise<boolean> {
    try {
      // Query registry contract to check if username is available
      const registryContract = this.contractManager.getRegistryContract();
      const isAvailable = await registryContract.isAvailable(username);
      return isAvailable;
    } catch (error) {
      console.warn('Error checking username uniqueness:', error);
      // If contract call fails, assume username is taken for safety
      return false;
    }
  }

  /**
   * Verify account exists by checking if it has a registered name
   */
  private async verifyAccountExists(address: string): Promise<boolean> {
    try {
      // Query registry contract to check if address has a registered name
      const registryContract = this.contractManager.getRegistryContract();
      const primaryName = await registryContract.reverseResolve(address);
      return primaryName !== '';
    } catch (error) {
      console.warn('Error verifying account exists:', error);
      // If contract call fails, allow login attempt
      return true;
    }
  }

  /**
   * Register username on blockchain (called after successful account creation)
   */
  private async registerUsernameOnChain(username: string, address: string): Promise<void> {
    try {
      // This would typically be handled by the OmniBazaar backend
      // since we don't want users to pay gas fees directly
      // For now, we'll just log the registration request
      console.warn(`Registration request for ${username} -> ${address}`);
      
      // In production, this would:
      // 1. Submit registration request to OmniBazaar backend
      // 2. Backend would fund the transaction and register the name
      // 3. User gets their username.omnicoin address without paying gas
      
      // TODO: Implement backend API call for name registration
      // await this.submitRegistrationRequest(username, address);
    } catch (error) {
      console.warn('Error registering username on chain:', error);
      // Don't throw error - registration can be retried later
    }
  }

  /**
   * Store encrypted user data
   * TODO: Implement secure storage strategy
   */
  private async storeUserData(credentials: UserCredentials, _accounts: MultiChainKeys): Promise<void> {
    // TODO: Implement secure storage (encrypted local storage, browser extension storage, etc.)
    console.warn(`Storing user data for: ${credentials.username}`);
  }

  /**
   * Get current session
   */
  public getCurrentSession(): UserSession | null {
    if (this.currentSession && this.isSessionValid()) {
      return this.currentSession;
    }
    return null;
  }

  /**
   * Check if current session is valid
   */
  private isSessionValid(): boolean {
    if (!this.currentSession) return false;
    
    const now = Date.now();
    const timeSinceLastActivity = now - this.currentSession.lastActivity;
    
    return timeSinceLastActivity < this.SESSION_TIMEOUT;
  }

  /**
   * Update session activity
   */
  public updateSessionActivity(): void {
    if (this.currentSession) {
      this.currentSession.lastActivity = Date.now();
    }
  }

  /**
   * Logout user
   */
  public logout(): void {
    this.currentSession = null;
  }

  /**
   * Resolve username.omnicoin to address using COTI registry
   */
  public async resolveUsername(username: string): Promise<string | null> {
    try {
      const registryContract = this.contractManager.getRegistryContract();
      const address = await registryContract.resolve(username);
      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      console.warn('Error resolving username:', error);
      return null;
    }
  }

  /**
   * Resolve username.omnicoin to address using Ethereum stateless resolver
   */
  public async resolveUsernameViaEthereum(username: string): Promise<string | null> {
    try {
      const resolverContract = this.contractManager.getResolverContract();
      const address = await resolverContract.resolve(username);
      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      console.warn('Error resolving username via Ethereum:', error);
      return null;
    }
  }

  /**
   * Get primary username for an address (reverse resolution)
   */
  public async reverseResolve(address: string): Promise<string | null> {
    try {
      const registryContract = this.contractManager.getRegistryContract();
      const username = await registryContract.reverseResolve(address);
      return username !== '' ? username : null;
    } catch (error) {
      console.warn('Error reverse resolving address:', error);
      return null;
    }
  }

  /**
   * Check if a username is available for registration
   */
  public async isUsernameAvailable(username: string): Promise<boolean> {
    return this.isUsernameUnique(username);
  }

  /**
   * Resolve any address or ENS name to a valid address
   * Supports .eth, .omnicoin, and regular addresses
   */
  public async resolveAddress(addressOrName: string): Promise<string | null> {
    try {
      // If it's already a valid address, return it
      if (ethers.isAddress(addressOrName)) {
        return addressOrName;
      }
      
      // Use ENS service to resolve
      return await this.ensService.resolveAddress(addressOrName);
    } catch (error) {
      console.warn('Error resolving address:', error);
      return null;
    }
  }

  /**
   * Resolve address for specific chain (for multi-chain transactions)
   */
  public async resolveAddressForChain(addressOrName: string, chainType: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism'): Promise<string | null> {
    try {
      // If it's already a valid address, return it
      if (ethers.isAddress(addressOrName)) {
        return addressOrName;
      }
      
      // Map chain types to coin types
      const coinTypes = {
        ethereum: 60,
        polygon: 966,
        arbitrum: 60,  // Uses ETH format
        optimism: 60   // Uses ETH format
      };
      
      return await this.ensService.resolveAddressForCoin(addressOrName, coinTypes[chainType]);
    } catch (error) {
      console.warn('Error resolving address for chain:', error);
      return null;
    }
  }

  /**
   * Sign transaction with current user's key
   * TODO: Implement transaction signing
   */
  public async signTransaction(transaction: { to: string; value: string; data?: string }, chainType: 'ethereum' | 'omnicoin'): Promise<string> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('User not logged in');
    }

    const account = session.accounts[chainType];
    if (!account) {
      throw new Error(`No account found for chain: ${chainType}`);
    }

    // TODO: Implement transaction signing based on chain type
    console.warn(`Signing transaction for ${chainType}:`, transaction);
    return 'signed_transaction_hash';
  }
}