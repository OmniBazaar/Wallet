/**
 * Legacy Migration Service
 * 
 * Handles migration of legacy OmniCoin v1 users to the new OmniCoin system.
 * Validates legacy credentials and facilitates balance transfers.
 * 
 * Process:
 * 1. User enters legacy username/password
 * 2. Service validates credentials using v1 algorithm
 * 3. Upon validation, gets signature from validator
 * 4. Claims tokens from LegacyMigration contract
 * 
 * @module services/LegacyMigrationService
 */

import { ethers } from 'ethers';
import * as bcrypt from 'bcryptjs';
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
  /** Error message if invalid */
  error?: string;
}

/**
 * Claim result
 */
export interface ClaimResult {
  /** Success status */
  success: boolean;
  /** Transaction hash if successful */
  txHash?: string;
  /** Amount claimed */
  amount?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Legacy Migration Service
 */
export class LegacyMigrationService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private omniCoreContract?: ethers.Contract;
  private validatorEndpoint: string;
  private legacyUsers: Map<string, LegacyUserData>;
  private passwordCache: Map<string, string>; // For demo purposes only
  
  // OmniCore ABI for legacy functions
  private readonly OMNICORE_LEGACY_ABI = [
    'function claimLegacyBalance(string username, address claimAddress, bytes32 nonce, bytes signature)',
    'function getLegacyStatus(string username) view returns (bool reserved, uint256 balance, bool claimed, address claimAddress)',
    'function isUsernameAvailable(string username) view returns (bool)',
    'function totalLegacySupply() view returns (uint256)',
    'function totalLegacyClaimed() view returns (uint256)'
  ];
  
  // Decimal conversion factor (10^12 for 6->18 decimals)
  private readonly DECIMAL_CONVERSION = BigInt(10 ** 12);
  
  /**
   * Create a LegacyMigrationService for validating and claiming v1 balances.
   * @param provider Ethers provider used for contract reads
   * @param signer Optional signer for sending claim txs
   * @param omniCoreAddress Optional OmniCore contract address
   * @param validatorEndpoint Optional validator REST endpoint
   */
  constructor(
    provider: ethers.Provider,
    signer?: ethers.Signer,
    omniCoreAddress?: string,
    validatorEndpoint?: string
  ) {
    this.provider = provider;
    this.signer = signer;
    this.validatorEndpoint = validatorEndpoint || 'http://localhost:3001/api/migration';
    this.legacyUsers = new Map();
    this.passwordCache = new Map();
    
    if (omniCoreAddress && signer) {
      this.omniCoreContract = new ethers.Contract(
        omniCoreAddress,
        this.OMNICORE_LEGACY_ABI,
        signer
      );
    }
  }
  
  /**
   * Initialize the service and load legacy user data
   */
  async initialize(): Promise<void> {
    // Load legacy user data from CSV
    await this.loadLegacyUsers();
    
    console.log(`Legacy Migration Service initialized with ${this.legacyUsers.size} users`);
  }
  
  /**
   * Load legacy users from CSV file
   */
  private async loadLegacyUsers(): Promise<void> {
    try {
      // In production, this would load from the CSV file
      // For now, we'll fetch from the validator
      const response = await fetch(`${this.validatorEndpoint}/legacy-users`);
      if (!response.ok) {
        console.error('Failed to load legacy users');
        return;
      }
      
      const users: LegacyUserData[] = await response.json();
      
      for (const user of users) {
        this.legacyUsers.set(user.username.toLowerCase(), user);
      }
    } catch (error) {
      console.error('Error loading legacy users:', error);
    }
  }
  
  /** Return true if a username exists in the legacy list. */
  async isLegacyUser(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    return this.legacyUsers.has(normalizedUsername);
  }
  
  /** Check if a username is available (not reserved) in OmniCore. */
  async isUsernameAvailable(username: string): Promise<boolean> {
    if (!this.omniCoreContract) {
      throw new Error('OmniCore contract not initialized');
    }
    
    try {
      return await this.omniCoreContract.isUsernameAvailable(username);
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }
  
  /** Get migration status for a username from OmniCore. */
  async getMigrationStatus(username: string): Promise<MigrationStatus | null> {
    if (!this.omniCoreContract) {
      throw new Error('OmniCore contract not initialized');
    }
    
    try {
      const status = await this.omniCoreContract.getLegacyStatus(username);
      
      if (!status.reserved) {
        // Check if it's in our legacy list
        const legacyData = this.legacyUsers.get(username.toLowerCase());
        if (legacyData) {
          return {
            username: legacyData.username,
            isLegacyUser: true,
            isClaimed: false,
            legacyBalance: legacyData.balance,
            newBalance: (BigInt(legacyData.balance) * this.DECIMAL_CONVERSION).toString()
          };
        }
        return null;
      }
      
      return {
        username: username,
        isLegacyUser: true,
        isClaimed: status.claimed,
        legacyBalance: (BigInt(status.balance) / this.DECIMAL_CONVERSION).toString(), // Convert back to 6 decimals for display
        newBalance: status.balance.toString(),
        claimAddress: status.claimAddress !== ethers.ZeroAddress ? status.claimAddress : undefined,
        claimTimestamp: status.claimed ? Date.now() / 1000 : undefined // Would need event logs for actual timestamp
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return null;
    }
  }
  
  /**
   * Validate legacy credentials against the validator service.
   * In v1, passwords were hashed with a specific algorithm; validation is
   * delegated to the validator endpoint for correctness and audit logging.
   * @param username Legacy username
   * @param password Legacy password
   */
  async validateLegacyCredentials(
    username: string,
    password: string
  ): Promise<ValidationResult> {
    const normalizedUsername = username.toLowerCase();
    
    // Check if user exists
    const legacyUser = this.legacyUsers.get(normalizedUsername);
    if (!legacyUser) {
      return {
        isValid: false,
        error: 'Username not found in legacy records'
      };
    }
    
    try {
      // Call validator service to check password
      // In v1, the password validation used a specific algorithm
      const response = await fetch(`${this.validatorEndpoint}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: legacyUser.username,
          password,
          accountId: legacyUser.accountId
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        return {
          isValid: false,
          error: error || 'Invalid credentials'
        };
      }
      
      const result = await response.json();
      
      if (result.isValid) {
        // Cache for demo/testing (remove in production)
        this.passwordCache.set(normalizedUsername, password);
        
        return {
          isValid: true,
          username: legacyUser.username,
          balance: legacyUser.balance
        };
      }
      
      return {
        isValid: false,
        error: 'Invalid password'
      };
      
    } catch (error) {
      console.error('Error validating credentials:', error);
      return {
        isValid: false,
        error: 'Validation service unavailable'
      };
    }
  }
  
  /**
   * Claim legacy balance after validation
   * @param username
   * @param password
   * @param claimAddress
   */
  async claimLegacyBalance(
    username: string,
    password: string,
    claimAddress?: string
  ): Promise<ClaimResult> {
    if (!this.omniCoreContract || !this.signer) {
      return {
        success: false,
        error: 'OmniCore contract not initialized'
      };
    }
    
    // Validate credentials first
    const validation = await this.validateLegacyCredentials(username, password);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || 'Invalid credentials'
      };
    }
    
    // Check if already claimed
    const status = await this.getMigrationStatus(username);
    if (status?.isClaimed) {
      return {
        success: false,
        error: 'Balance already claimed'
      };
    }
    
    try {
      // Use signer's address if no claim address specified
      const recipientAddress = claimAddress || await this.signer.getAddress();
      
      // Get signature from validator
      const nonce = ethers.randomBytes(32);
      const signatureResponse = await fetch(`${this.validatorEndpoint}/sign-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: validation.username,
          claimAddress: recipientAddress,
          nonce: ethers.hexlify(nonce),
          password // Validator needs to re-verify
        })
      });
      
      if (!signatureResponse.ok) {
        const error = await signatureResponse.text();
        return {
          success: false,
          error: error || 'Failed to get claim signature'
        };
      }
      
      const { signature } = await signatureResponse.json();
      
      // Submit claim to contract
      const tx = await this.omniCoreContract.claimLegacyBalance(
        validation.username!,
        recipientAddress,
        nonce,
        signature
      );
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Calculate claimed amount
      const legacyBalance = BigInt(validation.balance || '0');
      const newBalance = legacyBalance * this.DECIMAL_CONVERSION;
      
      return {
        success: true,
        txHash: receipt.hash,
        amount: ethers.formatEther(newBalance)
      };
      
    } catch (error: any) {
      console.error('Error claiming balance:', error);
      
      // Parse contract errors
      if (error.reason) {
        return {
          success: false,
          error: error.reason
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to claim balance'
      };
    }
  }
  
  /**
   * Get overall migration statistics
   */
  async getMigrationStats(): Promise<{
    totalUsers: number;
    totalLegacySupply: string;
    totalClaimed: string;
    totalUnclaimed: string;
    claimRate: number;
  }> {
    if (!this.omniCoreContract) {
      return {
        totalUsers: this.legacyUsers.size,
        totalLegacySupply: '0',
        totalClaimed: '0',
        totalUnclaimed: '0',
        claimRate: 0
      };
    }
    
    try {
      const totalSupply = await this.omniCoreContract.totalLegacySupply();
      const totalClaimed = await this.omniCoreContract.totalLegacyClaimed();
      const totalUnclaimed = totalSupply - totalClaimed;
      const claimRate = totalSupply > 0 ? (Number(totalClaimed) * 100) / Number(totalSupply) : 0;
      
      return {
        totalUsers: this.legacyUsers.size,
        totalLegacySupply: ethers.formatEther(totalSupply),
        totalClaimed: ethers.formatEther(totalClaimed),
        totalUnclaimed: ethers.formatEther(totalUnclaimed),
        claimRate: claimRate
      };
    } catch (error) {
      console.error('Error getting migration stats:', error);
      return {
        totalUsers: this.legacyUsers.size,
        totalLegacySupply: '0',
        totalClaimed: '0',
        totalUnclaimed: '0',
        claimRate: 0
      };
    }
  }
  
  /**
   * Search legacy users (for admin/support)
   * @param query
   */
  async searchLegacyUsers(query: string): Promise<LegacyUserData[]> {
    const results: LegacyUserData[] = [];
    const searchTerm = query.toLowerCase();
    
    for (const [username, userData] of this.legacyUsers) {
      if (username.includes(searchTerm) || userData.accountId.includes(searchTerm)) {
        results.push(userData);
        
        if (results.length >= 20) break; // Limit results
      }
    }
    
    return results;
  }
  
  /**
   * Get top balance holders (for statistics)
   * @param limit
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
   * Estimate gas for claim transaction
   * @param username
   */
  async estimateClaimGas(username: string): Promise<string> {
    if (!this.omniCoreContract || !this.signer) {
      throw new Error('OmniCore contract not initialized');
    }
    
    try {
      // Create dummy data for estimation
      const claimAddress = await this.signer.getAddress();
      const nonce = ethers.randomBytes(32);
      const dummySignature = '0x' + '00'.repeat(65);
      
      const gasEstimate = await this.omniCoreContract.estimateGas.claimLegacyBalance(
        username,
        claimAddress,
        nonce,
        dummySignature
      );
      
      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating gas:', error);
      return '200000'; // Default estimate
    }
  }
  
  /**
   * Simulate password hashing as done in v1
   * Note: This is a simplified version. The actual v1 used a specific algorithm.
   * @param password
   * @param username
   */
  private hashPasswordV1(password: string, username: string): string {
    // V1 used a combination of username as salt and multiple rounds
    // This is a simplified simulation
    const salt = crypto.createHash('sha256').update(username.toLowerCase()).digest('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
    return hash.toString('hex');
  }
  
  /**
   * Export unclaimed users for reporting
   */
  async exportUnclaimedUsers(): Promise<Array<{
    username: string;
    balance: string;
    balanceUSD?: number;
  }>> {
    if (!this.omniCoreContract) {
      return [];
    }
    
    const unclaimed: Array<{
      username: string;
      balance: string;
      balanceUSD?: number;
    }> = [];
    
    for (const [username, userData] of this.legacyUsers) {
      const status = await this.getMigrationStatus(username);
      
      if (status && !status.isClaimed) {
        unclaimed.push({
          username: userData.username,
          balance: userData.balanceDecimal,
          // Could add USD value if we have price feed
        });
      }
    }
    
    return unclaimed;
  }
}

export default LegacyMigrationService;
