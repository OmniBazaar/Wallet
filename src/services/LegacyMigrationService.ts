/**
 * Legacy Migration Service
 * 
 * Handles migration of legacy OmniCoin v1 users to the new OmniCoin system.
 * Validates legacy credentials and facilitates access to pre-minted tokens.
 * 
 * Process:
 * 1. User enters legacy username/password
 * 2. Service derives private key using v1 algorithm
 * 3. Verifies derived public key matches stored legacy public key
 * 4. Returns wallet with access to pre-minted tokens
 * 
 * @module services/LegacyMigrationService
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';

/**
 * Legacy user data structure from CSV
 */
export interface LegacyUserData {
  /** Account ID from v1 */
  accountId: string;
  /** Username */
  username: string;
  /** Balance in smallest units (6 decimals) */
  balance: string;
  /** Human-readable balance */
  balanceDecimal: string;
  /** Balance type (COMBINED, etc.) */
  balanceType: string;
  /** Public key from legacy system */
  publicKey: string;
  /** Legacy wallet address (derived from public key) */
  address: string;
}

/**
 * Migration status for a user
 */
export interface MigrationStatus {
  /** Username */
  username: string;
  /** Is this a legacy user? */
  isLegacyUser: boolean;
  /** Has balance been claimed? */
  isClaimed: boolean;
  /** Legacy balance (6 decimals) */
  legacyBalance: string;
  /** New balance (18 decimals) */
  newBalance: string;
  /** Claim address if claimed */
  claimAddress?: string;
  /** Claim timestamp if claimed */
  claimTimestamp?: number;
}

/**
 * Legacy validation result
 */
export interface ValidationResult {
  /** Is valid legacy user? */
  isValid: boolean;
  /** Username if valid */
  username?: string;
  /** Legacy balance */
  balance?: string;
  /** Derived wallet if valid */
  wallet?: ethers.Wallet;
  /** Legacy address */
  address?: string;
  /** Error message if invalid */
  error?: string;
}

/**
 * Access result for legacy balance
 */
export interface AccessResult {
  /** Success status */
  success: boolean;
  /** Wallet with access to pre-minted tokens */
  wallet?: ethers.Wallet;
  /** Legacy address */
  address?: string;
  /** Balance amount */
  amount?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Interface for legacy key derivation algorithms
 */
export interface LegacyKeyDerivationAlgorithm {
  /**
   * Derive private key from username and password using legacy v1 algorithm
   * @param username Legacy username
   * @param password Legacy password
   * @returns Private key as hex string
   */
  derivePrivateKey(username: string, password: string): string;
}

/**
 * Legacy Migration Service
 */
export class LegacyMigrationService {
  private provider: ethers.Provider;
  private legacyUsers: Map<string, LegacyUserData>;
  private keyDerivationAlgorithm: LegacyKeyDerivationAlgorithm;
  
  // Decimal conversion factor (10^12 for 6->18 decimals)
  private readonly DECIMAL_CONVERSION = BigInt(10 ** 12);
  
  /**
   * Create a LegacyMigrationService for validating v1 users.
   * @param provider Ethers provider
   * @param keyDerivationAlgorithm Implementation of v1 key derivation
   */
  constructor(
    provider: ethers.Provider,
    keyDerivationAlgorithm?: LegacyKeyDerivationAlgorithm
  ) {
    this.provider = provider;
    this.legacyUsers = new Map();
    
    // Default implementation - must be replaced with actual v1 algorithm
    this.keyDerivationAlgorithm = keyDerivationAlgorithm ?? {
      derivePrivateKey: (_username: string, _password: string): string => {
        // Placeholder - actual v1 algorithm must be implemented
        throw new Error('Legacy key derivation algorithm not implemented. Please provide the v1 algorithm.');
      }
    };
  }
  
  /**
   * Initialize the service and load legacy user data
   * @param legacyUsersData Optional array of legacy users (for testing)
   */
  initialize(legacyUsersData?: LegacyUserData[]): void {
    if (legacyUsersData !== undefined) {
      // Load from provided data (for testing)
      for (const user of legacyUsersData) {
        this.legacyUsers.set(user.username.toLowerCase(), user);
      }
    } else {
      // Load from CSV in production
      this.loadLegacyUsers();
    }
  }
  
  /**
   * Load legacy users from CSV file
   * Note: This should be updated to load from actual CSV file with public keys
   */
  private loadLegacyUsers(): void {
    try {
      // TODO: Implement CSV loading with format:
      // accountId,username,balance,balanceDecimal,balanceType,publicKey,address
      // For now, throw error to indicate implementation needed
      throw new Error('CSV loading not implemented. Use initialize() with data array.');
    } catch (error) {
      console.error('Error loading legacy users:', error);
      throw error;
    }
  }
  
  /**
   * Return true if a username exists in the legacy list.
   * @param username - Username to check
   * @returns True if username exists in legacy list
   */
  isLegacyUser(username: string): boolean {
    const normalizedUsername = username.toLowerCase();
    return this.legacyUsers.has(normalizedUsername);
  }
  
  /**
   * Get legacy user data by username
   * @param username Username to look up
   * @returns Legacy user data or null if not found
   */
  getLegacyUser(username: string): LegacyUserData | null {
    return this.legacyUsers.get(username.toLowerCase()) ?? null;
  }
  
  /**
   * Get migration status for a username.
   * @param username Username to check
   * @returns Migration status with balance information
   */
  async getMigrationStatus(username: string): Promise<MigrationStatus> {
    const legacyUser = this.legacyUsers.get(username.toLowerCase());
    
    if (legacyUser === undefined) {
      return {
        username: username,
        isLegacyUser: false,
        isClaimed: false,
        legacyBalance: '0',
        newBalance: '0'
      };
    }
    
    // Check on-chain balance at the legacy address
    try {
      const balance = await this.provider.getBalance(legacyUser.address);
      const hasBalance = balance > BigInt(0);
      
      return {
        username: legacyUser.username,
        isLegacyUser: true,
        isClaimed: hasBalance, // If tokens are at address, they've been "claimed" (minted)
        legacyBalance: legacyUser.balance,
        newBalance: (BigInt(legacyUser.balance) * this.DECIMAL_CONVERSION).toString(),
        ...(hasBalance && { claimAddress: legacyUser.address }),
        ...(hasBalance && { claimTimestamp: Math.floor(Date.now() / 1000) })
      };
    } catch (error) {
      console.error('Error checking balance:', error);
      return {
        username: legacyUser.username,
        isLegacyUser: true,
        isClaimed: false,
        legacyBalance: legacyUser.balance,
        newBalance: (BigInt(legacyUser.balance) * this.DECIMAL_CONVERSION).toString()
      };
    }
  }
  
  /**
   * Validate legacy credentials using v1 key derivation.
   * Derives private key from username/password and verifies it matches stored public key.
   * @param username Legacy username
   * @param password Legacy password
   * @returns Validation result with wallet if successful
   */
  validateLegacyCredentials(
    username: string,
    password: string
  ): ValidationResult {
    const normalizedUsername = username.toLowerCase();
    
    // Check if user exists
    const legacyUser = this.legacyUsers.get(normalizedUsername);
    if (legacyUser === undefined) {
      return {
        isValid: false,
        error: 'Username not found in legacy records'
      };
    }
    
    try {
      // Derive private key using v1 algorithm
      const privateKey = this.keyDerivationAlgorithm.derivePrivateKey(
        legacyUser.username, // Use original case
        password
      );
      
      // Create wallet from derived private key
      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Get public key and address from wallet
      const derivedPublicKey = wallet.signingKey.publicKey;
      const derivedAddress = wallet.address;
      
      // Verify derived public key matches stored public key
      // Note: Compare addresses as a proxy if public keys are in different formats
      if (derivedAddress.toLowerCase() !== legacyUser.address.toLowerCase() &&
          derivedPublicKey.toLowerCase() !== legacyUser.publicKey.toLowerCase()) {
        return {
          isValid: false,
          error: 'Invalid password - derived key does not match'
        };
      }
      
      return {
        isValid: true,
        username: legacyUser.username,
        balance: legacyUser.balance,
        wallet: wallet,
        address: legacyUser.address
      };
      
    } catch (error) {
      console.error('Error validating credentials:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to validate credentials'
      };
    }
  }
  
  /**
   * Get access to legacy balance.
   * Since tokens are pre-minted to legacy addresses, this returns the wallet
   * that can access those tokens.
   * @param username Legacy username  
   * @param password Legacy password
   * @returns Access result with wallet if successful
   */
  async accessLegacyBalance(
    username: string,
    password: string
  ): Promise<AccessResult> {
    // Validate credentials first
    const validation = this.validateLegacyCredentials(username, password);
    if (!validation.isValid || validation.wallet === undefined) {
      return {
        success: false,
        error: validation.error ?? 'Invalid credentials'
      };
    }
    
    try {
      // Check balance at the legacy address
      const balance = await this.provider.getBalance(validation.address ?? '');
      
      if (balance === BigInt(0)) {
        return {
          success: false,
          error: 'No balance found at legacy address. Tokens may not be minted yet.'
        };
      }
      
      // Return wallet with access to pre-minted tokens
      const legacyBalance = BigInt(validation.balance ?? '0');
      const newBalance = legacyBalance * this.DECIMAL_CONVERSION;
      
      return {
        success: true,
        wallet: validation.wallet,
        ...(validation.address !== undefined && { address: validation.address }),
        amount: ethers.formatEther(newBalance)
      };
      
    } catch (error) {
      console.error('Error accessing balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to access balance'
      };
    }
  }
  
  /**
   * Get overall migration statistics
   * @returns Migration statistics including total users and access rate
   */
  async getMigrationStats(): Promise<{
    totalUsers: number;
    totalLegacySupply: string;
    totalAccessed: number;
    accessRate: number;
  }> {
    let totalSupply = BigInt(0);
    let totalAccessed = 0;
    
    // Calculate stats from legacy users
    for (const [_, userData] of Array.from(this.legacyUsers)) {
      const balance = BigInt(userData.balance) * this.DECIMAL_CONVERSION;
      totalSupply += balance;
      
      // Check if user has accessed their balance (has on-chain balance)
      try {
        const onChainBalance = await this.provider.getBalance(userData.address);
        if (onChainBalance > BigInt(0)) {
          totalAccessed++;
        }
      } catch (error) {
        // Skip users we can't check
      }
    }
    
    const accessRate = this.legacyUsers.size > 0 ? 
      (totalAccessed * 100) / this.legacyUsers.size : 0;
    
    return {
      totalUsers: this.legacyUsers.size,
      totalLegacySupply: ethers.formatEther(totalSupply),
      totalAccessed: totalAccessed,
      accessRate: accessRate
    };
  }
  
  /**
   * Search legacy users (for admin/support)
   * @param query - Search term for username or account ID
   * @returns Array of matching legacy users (max 20 results)
   */
  searchLegacyUsers(query: string): LegacyUserData[] {
    const results: LegacyUserData[] = [];
    const searchTerm = query.toLowerCase();
    
    for (const [username, userData] of Array.from(this.legacyUsers)) {
      if (username.includes(searchTerm) || userData.accountId.includes(searchTerm)) {
        results.push(userData);
        
        if (results.length >= 20) break; // Limit results
      }
    }
    
    return results;
  }
  
  /**
   * Get top balance holders (for statistics)
   * @param limit - Maximum number of users to return
   * @returns Array of top balance holders
   */
  getTopBalanceHolders(limit = 10): LegacyUserData[] {
    const users = Array.from(this.legacyUsers.values());
    
    return users
      .sort((a, b) => {
        const balanceA = BigInt(a.balance);
        const balanceB = BigInt(b.balance);
        return balanceB > balanceA ? 1 : balanceB < balanceA ? -1 : 0;
      })
      .slice(0, limit);
  }
  
  /**
   * Estimate gas for a transfer from legacy wallet
   * @param fromAddress Legacy address
   * @param toAddress Destination address
   * @param amount Amount to transfer
   * @returns Gas estimate as string
   */
  async estimateTransferGas(
    fromAddress: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    try {
      // Standard ETH transfer gas estimate
      const tx = {
        from: fromAddress,
        to: toAddress,
        value: ethers.parseEther(amount)
      };
      
      const gasEstimate = await this.provider.estimateGas(tx);
      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating gas:', error);
      return '21000'; // Default ETH transfer gas
    }
  }
  
  /**
   * Set custom key derivation algorithm
   * @param algorithm Implementation of v1 key derivation
   */
  setKeyDerivationAlgorithm(algorithm: LegacyKeyDerivationAlgorithm): void {
    this.keyDerivationAlgorithm = algorithm;
  }
  
  /**
   * Example implementation of a key derivation algorithm.
   * This is NOT the actual v1 algorithm - it must be replaced.
   * @returns Example key derivation algorithm
   */
  static createExampleKeyDerivation(): LegacyKeyDerivationAlgorithm {
    return {
      derivePrivateKey: (username: string, password: string): string => {
        // Example using username as salt - NOT the actual v1 algorithm
        const salt = crypto.createHash('sha256')
          .update(username.toLowerCase())
          .digest('hex');
        
        // Example key derivation - NOT the actual v1 algorithm  
        const key = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha512');
        
        // Ensure it's a valid 32-byte private key
        return '0x' + key.toString('hex');
      }
    };
  }
  
  /**
   * Export users who haven't accessed their balance
   * @returns Array of unaccessed users with username, balance and address
   */
  async exportUnaccessedUsers(): Promise<Array<{
    username: string;
    balance: string;
    address: string;
  }>> {
    const unaccessed: Array<{
      username: string;
      balance: string;
      address: string;
    }> = [];
    
    for (const [_, userData] of Array.from(this.legacyUsers)) {
      try {
        const balance = await this.provider.getBalance(userData.address);
        
        if (balance === BigInt(0)) {
          unaccessed.push({
            username: userData.username,
            balance: userData.balanceDecimal,
            address: userData.address
          });
        }
      } catch (error) {
        // Include users we can't check
        unaccessed.push({
          username: userData.username,
          balance: userData.balanceDecimal,
          address: userData.address
        });
      }
    }
    
    return unaccessed;
  }
}

export default LegacyMigrationService;
