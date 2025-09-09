/**
 * Faucet Service for Wallet
 * 
 * Provides testnet token distribution for users to test OmniCoin features.
 * Integrates with the Validator's decentralized faucet service with anti-sybil protection.
 * 
 * Features:
 * - One-click testnet token claims
 * - Anti-sybil verification (email, social media)
 * - Rate limiting and claim tracking
 * - Multiple testnet support (OmniCoin, ETH, COTI)
 * - Progressive trust system for increased claims
 * 
 * @module services/FaucetService
 */

import { ethers } from 'ethers';

/**
 * Supported testnets
 */
export enum TestnetType {
  OMNICOIN_TESTNET = 'OMNICOIN_TESTNET',
  ETHEREUM_GOERLI = 'ETHEREUM_GOERLI',
  ETHEREUM_SEPOLIA = 'ETHEREUM_SEPOLIA',
  COTI_TESTNET = 'COTI_TESTNET',
  AVALANCHE_FUJI = 'AVALANCHE_FUJI'
}

/**
 * Verification methods
 */
export enum VerificationMethod {
  NONE = 'NONE',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  TWITTER = 'TWITTER',
  DISCORD = 'DISCORD',
  GITHUB = 'GITHUB',
  CAPTCHA = 'CAPTCHA'
}

/**
 * Faucet claim request
 */
interface FaucetClaimRequest {
  /** User's wallet address */
  address: string;
  /** Testnet to claim from */
  testnet: TestnetType;
  /** Amount to claim (optional, uses default if not specified) */
  amount?: string;
  /** Verification data */
  verification?: {
    method: VerificationMethod;
    token?: string;
    email?: string;
    phone?: string;
    socialHandle?: string;
    captchaToken?: string;
  };
}

/**
 * Faucet claim response
 */
interface FaucetClaimResponse {
  /** Success status */
  success: boolean;
  /** Transaction hash if successful */
  txHash?: string;
  /** Amount claimed */
  amount?: string;
  /** Next claim available time */
  nextClaimTime?: number;
  /** Remaining claims for this address */
  remainingClaims?: number;
  /** Error message if failed */
  error?: string;
  /** Required verification methods */
  requiredVerification?: VerificationMethod[];
}

/**
 * Faucet configuration for each testnet
 */
interface FaucetNetworkConfig {
  /** Network name */
  name: string;
  /** Faucet endpoint */
  endpoint: string;
  /** Default claim amount */
  defaultAmount: string;
  /** Token symbol */
  symbol: string;
  /** Claim interval in hours */
  claimInterval: number;
  /** Max claims per address */
  maxClaims: number;
  /** Required verification level */
  requiredVerification: VerificationMethod[];
  /** Chain ID */
  chainId: number;
  /** RPC URL */
  rpcUrl: string;
  /** Block explorer URL */
  explorerUrl: string;
}

/**
 * User's faucet status
 */
interface FaucetStatus {
  /** User address */
  address: string;
  /** Claims by network */
  claims: Map<TestnetType, {
    /** Total claims made */
    totalClaims: number;
    /** Last claim timestamp */
    lastClaim: number;
    /** Total amount claimed */
    totalAmount: string;
    /** Next claim available */
    nextClaimTime: number;
    /** Can claim now */
    canClaim: boolean;
  }>;
  /** Verification status */
  verification: {
    email: boolean;
    phone: boolean;
    twitter: boolean;
    discord: boolean;
    github: boolean;
  };
  /** Trust level (0-100) */
  trustLevel: number;
  /** Is VIP user */
  isVIP: boolean;
}

/**
 * Faucet statistics
 */
interface FaucetStats {
  /** Total distributed across all networks */
  totalDistributed: Map<TestnetType, string>;
  /** Total unique users */
  uniqueUsers: number;
  /** Daily distribution */
  dailyDistribution: Map<TestnetType, string>;
  /** Remaining in faucet pools */
  remainingPools: Map<TestnetType, string>;
  /** Average claim amount */
  avgClaimAmount: Map<TestnetType, string>;
  /** Success rate */
  successRate: number;
}

/**
 * Faucet Service
 */
export class FaucetService {
  private provider: ethers.Provider;
  private validatorEndpoint: string;
  private userStatusCache = new Map<string, FaucetStatus>();
  private statsCache: FaucetStats | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  
  // Network configurations
  private readonly networkConfigs: Map<TestnetType, FaucetNetworkConfig> = new Map([
    [TestnetType.OMNICOIN_TESTNET, {
      name: 'OmniCoin Testnet',
      endpoint: 'http://localhost:3001/api/faucet/omnicoin',
      defaultAmount: '100',
      symbol: 'tXOM',
      claimInterval: 24, // 24 hours
      maxClaims: 10,
      requiredVerification: [VerificationMethod.EMAIL],
      chainId: 31337,
      rpcUrl: 'http://localhost:8545',
      explorerUrl: 'http://localhost:3000/explorer'
    }],
    [TestnetType.ETHEREUM_SEPOLIA, {
      name: 'Ethereum Sepolia',
      endpoint: 'http://localhost:3001/api/faucet/sepolia',
      defaultAmount: '0.1',
      symbol: 'ETH',
      claimInterval: 24,
      maxClaims: 5,
      requiredVerification: [VerificationMethod.CAPTCHA],
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_KEY',
      explorerUrl: 'https://sepolia.etherscan.io'
    }],
    [TestnetType.COTI_TESTNET, {
      name: 'COTI Testnet',
      endpoint: 'http://localhost:3001/api/faucet/coti',
      defaultAmount: '1000',
      symbol: 'COTI',
      claimInterval: 24,
      maxClaims: 10,
      requiredVerification: [VerificationMethod.EMAIL],
      chainId: 65536,
      rpcUrl: 'https://testnet.coti.io/rpc',
      explorerUrl: 'https://testnet-explorer.coti.io'
    }],
    [TestnetType.AVALANCHE_FUJI, {
      name: 'Avalanche Fuji',
      endpoint: 'http://localhost:3001/api/faucet/fuji',
      defaultAmount: '1',
      symbol: 'AVAX',
      claimInterval: 24,
      maxClaims: 5,
      requiredVerification: [VerificationMethod.TWITTER],
      chainId: 43113,
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
      explorerUrl: 'https://testnet.snowtrace.io'
    }]
  ]);
  
  /**
   * Create a FaucetService using a provider and validator endpoint.
   * @param provider Ethers provider used to add networks to wallets
   * @param validatorEndpoint Base URL to the validator faucet API
   */
  constructor(provider: ethers.Provider, validatorEndpoint?: string) {
    this.provider = provider;
    this.validatorEndpoint = (validatorEndpoint !== null && validatorEndpoint !== undefined && validatorEndpoint.length > 0) ? validatorEndpoint : 'http://localhost:3001';
  }
  
  /**
   * Initialize background status updates and fetch initial stats.
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Start periodic status updates
    this.startStatusUpdates();
    
    // Load initial stats
    await this.loadFaucetStats();
    
    // console.log('Faucet Service initialized');
  }
  
  /**
   * Claim testnet tokens via the validator faucet service.
   * @param request Faucet claim request payload
   * @returns Promise resolving to claim response with transaction details
   */
  async claimTokens(request: FaucetClaimRequest): Promise<FaucetClaimResponse> {
    try {
      const config = this.networkConfigs.get(request.testnet);
      if (config === null || config === undefined) {
        return {
          success: false,
          error: 'Unsupported testnet'
        };
      }
      
      // Check if user can claim
      const status = await this.getUserStatus(request.address);
      const networkStatus = status.claims.get(request.testnet);
      
      if (networkStatus !== null && networkStatus !== undefined && !networkStatus.canClaim) {
        const waitTime = Math.ceil((networkStatus.nextClaimTime - Date.now()) / 1000);
        return {
          success: false,
          error: `Please wait ${this.formatTime(waitTime)} before next claim`,
          nextClaimTime: networkStatus.nextClaimTime
        };
      }
      
      // Check verification requirements
      const missingVerification = this.checkVerification(
        status.verification,
        config.requiredVerification
      );
      
      if (missingVerification.length > 0) {
        return {
          success: false,
          error: 'Additional verification required',
          requiredVerification: missingVerification
        };
      }
      
      // Prepare claim data
      const claimData = {
        address: request.address,
        testnet: request.testnet,
        amount: (request.amount !== null && request.amount !== undefined && request.amount.length > 0) ? request.amount : config.defaultAmount,
        verification: request.verification,
        metadata: {
          ip: await this.getClientIP(),
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      };
      
      // Submit claim to validator faucet
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(claimData)
      });
      
      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Faucet error: ${error}`
        };
      }
      
      const result = await response.json() as { transactionId: string; amount: string; };
      
      // Clear cache to force refresh
      this.userStatusCache.delete(request.address);
      
      return {
        success: true,
        txHash: result.transactionId,
        amount: result.amount,
        nextClaimTime: Date.now() + (config.claimInterval * 3600 * 1000),
        remainingClaims: config.maxClaims - ((networkStatus !== null && networkStatus !== undefined ? networkStatus.totalClaims : 0) + 1)
      };
      
    } catch (error) {
      console.error('Error claiming tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get per‑network faucet status for a user (cached with periodic refresh).
   * @param address User address
   * @returns Faucet status for the user
   */
  async getUserStatus(address: string): Promise<FaucetStatus> {
    // Check cache
    const cached = this.userStatusCache.get(address);
    if (cached !== null && cached !== undefined) return cached;
    
    try {
      const response = await fetch(`${this.validatorEndpoint}/api/faucet/status/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user status');
      }
      
      const data = await response.json() as Record<string, unknown>;
      const status = this.processStatusData(address, data);
      
      // Update cache
      this.userStatusCache.set(address, status);
      
      return status;
    } catch (error) {
      console.error('Error fetching user status:', error);
      return this.getDefaultStatus(address);
    }
  }
  
  /**
   * Normalize status data from the validator API.
   * @param address User's wallet address
   * @param data Raw data from validator API
   * @returns Processed faucet status
   */
  private processStatusData(address: string, data: Record<string, unknown>): FaucetStatus {
    const claims = new Map<TestnetType, {
      totalClaims: number;
      lastClaim: number;
      totalAmount: string;
      nextClaimTime: number;
      canClaim: boolean;
    }>();
    
    const rawClaims = data.claims as Record<string, unknown> | null | undefined;
    for (const [network, claimData] of Object.entries(rawClaims ?? {})) {
      const config = this.networkConfigs.get(network as TestnetType);
      if (config === null || config === undefined) continue;
      
      const typedClaimData = claimData as { lastClaim?: number; totalClaims?: number; totalAmount?: string };
      const lastClaim = typedClaimData.lastClaim ?? 0;
      const totalClaims = typedClaimData.totalClaims ?? 0;
      const totalAmount = typedClaimData.totalAmount ?? '0';
      const nextClaimTime = lastClaim + (config.claimInterval * 3600 * 1000);
      
      claims.set(network as TestnetType, {
        totalClaims,
        lastClaim,
        totalAmount,
        nextClaimTime,
        canClaim: Date.now() >= nextClaimTime && totalClaims < config.maxClaims
      });
    }
    
    const verificationData = data.verification as { email?: boolean; phone?: boolean; twitter?: boolean; discord?: boolean; github?: boolean } | null | undefined;
    
    return {
      address,
      claims,
      verification: {
        email: verificationData?.email ?? false,
        phone: verificationData?.phone ?? false,
        twitter: verificationData?.twitter ?? false,
        discord: verificationData?.discord ?? false,
        github: verificationData?.github ?? false
      },
      trustLevel: (typeof data.trustLevel === 'number') ? data.trustLevel : 0,
      isVIP: (typeof data.isVIP === 'boolean') ? data.isVIP : false
    };
  }
  
  /**
   * Build a default status object for new users with claimable networks.
   * @param address User's wallet address
   * @returns Default faucet status
   */
  private getDefaultStatus(address: string): FaucetStatus {
    const claims = new Map<TestnetType, {
      totalClaims: number;
      lastClaim: number;
      totalAmount: string;
      nextClaimTime: number;
      canClaim: boolean;
    }>();
    
    // Initialize all networks as claimable
    for (const [network, _config] of Array.from(this.networkConfigs.entries())) {
      claims.set(network, {
        totalClaims: 0,
        lastClaim: 0,
        totalAmount: '0',
        nextClaimTime: 0,
        canClaim: true
      });
    }
    
    return {
      address,
      claims,
      verification: {
        email: false,
        phone: false,
        twitter: false,
        discord: false,
        github: false
      },
      trustLevel: 0,
      isVIP: false
    };
  }
  
  /**
   * Compute missing verification methods for a user against required set.
   * @param userVerification User's current verification status with booleans for each method
   * @param required Required verification methods array
   * @returns Array of missing verification methods
   */
  private checkVerification(
    userVerification: FaucetStatus['verification'],
    required: VerificationMethod[]
  ): VerificationMethod[] {
    const missing: VerificationMethod[] = [];
    
    for (const method of required) {
      switch (method) {
        case VerificationMethod.EMAIL:
          if (!userVerification.email) missing.push(method);
          break;
        case VerificationMethod.PHONE:
          if (!userVerification.phone) missing.push(method);
          break;
        case VerificationMethod.TWITTER:
          if (!userVerification.twitter) missing.push(method);
          break;
        case VerificationMethod.DISCORD:
          if (!userVerification.discord) missing.push(method);
          break;
        case VerificationMethod.GITHUB:
          if (!userVerification.github) missing.push(method);
          break;
      }
    }
    
    return missing;
  }
  
  /**
   * Verify a user's identity using the selected verification method.
   * @param address User address
   * @param method Verification method to use
   * @param verificationData Method-specific data (email/phone/handles/codes)
   * @param verificationData.email - Email address for verification
   * @param verificationData.phone - Phone number for verification
   * @param verificationData.socialHandle - Social media handle for verification
   * @param verificationData.verificationCode - Verification code received
   * @returns Promise resolving to success status and optional error
   */
  async verifyIdentity(
    address: string,
    method: VerificationMethod,
    verificationData: {
      email?: string;
      phone?: string;
      socialHandle?: string;
      verificationCode?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.validatorEndpoint}/api/faucet/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          method,
          ...verificationData
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error
        };
      }
      
      // Clear cache to force refresh
      this.userStatusCache.delete(address);
      
      return { success: true };
      
    } catch (error) {
      console.error('Error verifying identity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get faucet statistics
   * @returns Promise resolving to faucet statistics
   */
  async getFaucetStats(): Promise<FaucetStats> {
    if (this.statsCache !== null && this.statsCache !== undefined) {
      return this.statsCache;
    }
    
    try {
      const response = await fetch(`${this.validatorEndpoint}/api/faucet/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch faucet stats');
      }
      
      const data = await response.json() as Record<string, unknown>;
      
      const totalDistributedObj = data.totalDistributed as Record<string, unknown> | null | undefined;
      const dailyDistributionObj = data.dailyDistribution as Record<string, unknown> | null | undefined;
      const remainingPoolsObj = data.remainingPools as Record<string, unknown> | null | undefined;
      const avgClaimAmountObj = data.avgClaimAmount as Record<string, unknown> | null | undefined;
      
      this.statsCache = {
        totalDistributed: new Map(Object.entries(totalDistributedObj ?? {}).map(([k, v]) => [k as TestnetType, String(v)])),
        uniqueUsers: (typeof data.uniqueUsers === 'number') ? data.uniqueUsers : 0,
        dailyDistribution: new Map(Object.entries(dailyDistributionObj ?? {}).map(([k, v]) => [k as TestnetType, String(v)])),
        remainingPools: new Map(Object.entries(remainingPoolsObj ?? {}).map(([k, v]) => [k as TestnetType, String(v)])),
        avgClaimAmount: new Map(Object.entries(avgClaimAmountObj ?? {}).map(([k, v]) => [k as TestnetType, String(v)])),
        successRate: (typeof data.successRate === 'number') ? data.successRate : 0
      };
      
      return this.statsCache;
      
    } catch (error) {
      console.error('Error fetching faucet stats:', error);
      return {
        totalDistributed: new Map(),
        uniqueUsers: 0,
        dailyDistribution: new Map(),
        remainingPools: new Map(),
        avgClaimAmount: new Map(),
        successRate: 0
      };
    }
  }
  
  /**
   * Get network configuration
   * @param testnet Testnet type to get config for
   * @returns Network configuration or undefined if not found
   */
  getNetworkConfig(testnet: TestnetType): FaucetNetworkConfig | undefined {
    return this.networkConfigs.get(testnet);
  }
  
  /**
   * Get all supported networks
   * @returns Array of supported network types and their configurations
   */
  getSupportedNetworks(): Array<{
    type: TestnetType;
    config: FaucetNetworkConfig;
  }> {
    return Array.from(this.networkConfigs.entries()).map(([type, config]) => ({
      type,
      config
    }));
  }
  
  /**
   * Add custom network to wallet
   * @param testnet Testnet type to add to wallet
   * @returns Promise resolving to success status and optional error
   */
  async addNetworkToWallet(testnet: TestnetType): Promise<{ success: boolean; error?: string }> {
    const config = this.networkConfigs.get(testnet);
    if (config === null || config === undefined) {
      return {
        success: false,
        error: 'Network not supported'
      };
    }
    
    try {
      // Request to add network to wallet (MetaMask, etc.)
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (ethereum !== null && ethereum !== undefined) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${config.chainId.toString(16)}`,
            chainName: config.name,
            nativeCurrency: {
              name: config.symbol,
              symbol: config.symbol,
              decimals: 18
            },
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.explorerUrl]
          }]
        });
        
        return { success: true };
      }
      
      return {
        success: false,
        error: 'No wallet detected'
      };
      
    } catch (error) {
      console.error('Error adding network:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get drip amount for user based on trust level
   * @param address User's wallet address
   * @param testnet Testnet type to get drip amount for
   * @returns Drip amount as string
   */
  getDripAmount(address: string, testnet: TestnetType): string {
    const status = this.userStatusCache.get(address);
    const config = this.networkConfigs.get(testnet);
    
    if (status === null || status === undefined || config === null || config === undefined) {
      return (config !== null && config !== undefined && config.defaultAmount.length > 0) ? config.defaultAmount : '0';
    }
    
    const baseAmount = parseFloat(config.defaultAmount);
    
    // Trust level bonus (up to 2x for high trust)
    const trustMultiplier = 1 + (status.trustLevel / 100);
    
    // VIP bonus (1.5x)
    const vipMultiplier = status.isVIP ? 1.5 : 1;
    
    const finalAmount = baseAmount * trustMultiplier * vipMultiplier;
    return finalAmount.toString();
  }
  
  /**
   * Load faucet statistics
   * @returns Promise that resolves when stats are loaded
   */
  private async loadFaucetStats(): Promise<void> {
    await this.getFaucetStats();
  }
  
  /**
   * Get client IP address
   * @returns Promise resolving to IP address string
   */
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json() as { ip: string };
      return data.ip;
    } catch {
      return '0.0.0.0';
    }
  }
  
  /**
   * Format time duration
   * @param seconds Duration in seconds
   * @returns Formatted time string
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  
  /**
   * Start periodic status updates
   */
  private startStatusUpdates(): void {
    // Update status every 5 minutes
    this.updateInterval = setInterval(() => {
      // Use void to handle async operation
      void (async () => {
        // Refresh stats
        this.statsCache = null;
        await this.loadFaucetStats();
        
        // Clear old cache entries
        const now = Date.now();
        for (const [address, status] of Array.from(this.userStatusCache.entries())) {
          // Remove if older than 10 minutes
          const firstClaim = status.claims.values().next().value;
          const lastClaim = (firstClaim !== null && firstClaim !== undefined) ? firstClaim.lastClaim : 0;
          if (now - lastClaim > 600000) {
            this.userStatusCache.delete(address);
          }
        }
      })();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.updateInterval !== null && this.updateInterval !== undefined) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.userStatusCache.clear();
    this.statsCache = null;
  }
}

export default FaucetService;
