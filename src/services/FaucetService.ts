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
    this.validatorEndpoint = validatorEndpoint || 'http://localhost:3001';
  }
  
  /** Initialize background status updates and fetch initial stats. */
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
   */
  async claimTokens(request: FaucetClaimRequest): Promise<FaucetClaimResponse> {
    try {
      const config = this.networkConfigs.get(request.testnet);
      if (!config) {
        return {
          success: false,
          error: 'Unsupported testnet'
        };
      }
      
      // Check if user can claim
      const status = await this.getUserStatus(request.address);
      const networkStatus = status.claims.get(request.testnet);
      
      if (networkStatus && !networkStatus.canClaim) {
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
        amount: request.amount || config.defaultAmount,
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
      
      const result = await response.json();
      
      // Clear cache to force refresh
      this.userStatusCache.delete(request.address);
      
      return {
        success: true,
        txHash: result.transactionId,
        amount: result.amount,
        nextClaimTime: Date.now() + (config.claimInterval * 3600 * 1000),
        remainingClaims: config.maxClaims - ((networkStatus?.totalClaims || 0) + 1)
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
   */
  async getUserStatus(address: string): Promise<FaucetStatus> {
    // Check cache
    const cached = this.userStatusCache.get(address);
    if (cached) return cached;
    
    try {
      const response = await fetch(`${this.validatorEndpoint}/api/faucet/status/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user status');
      }
      
      const data = await response.json();
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
   * @param address
   * @param data
   */
  private processStatusData(address: string, data: any): FaucetStatus {
    const claims = new Map<TestnetType, any>();
    
    for (const [network, claimData] of Object.entries(data.claims || {})) {
      const config = this.networkConfigs.get(network as TestnetType);
      if (!config) continue;
      
      const data = claimData as { lastClaim?: number; totalClaims?: number; totalAmount?: string };
      const lastClaim = data.lastClaim || 0;
      const nextClaimTime = lastClaim + (config.claimInterval * 3600 * 1000);
      
      claims.set(network as TestnetType, {
        totalClaims: data.totalClaims || 0,
        lastClaim,
        totalAmount: data.totalAmount || '0',
        nextClaimTime,
        canClaim: Date.now() >= nextClaimTime && 
                  (data.totalClaims || 0) < config.maxClaims
      });
    }
    
    return {
      address,
      claims,
      verification: {
        email: data.verification?.email || false,
        phone: data.verification?.phone || false,
        twitter: data.verification?.twitter || false,
        discord: data.verification?.discord || false,
        github: data.verification?.github || false
      },
      trustLevel: data.trustLevel || 0,
      isVIP: data.isVIP || false
    };
  }
  
  /**
   * Build a default status object for new users with claimable networks.
   * @param address
   */
  private getDefaultStatus(address: string): FaucetStatus {
    const claims = new Map<TestnetType, any>();
    
    // Initialize all networks as claimable
    for (const [network, config] of this.networkConfigs) {
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
   * @param userVerification
   * @param required
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
   * Verify a user’s identity using the selected verification method.
   * @param address User address
   * @param method Verification method to use
   * @param verificationData Method-specific data (email/phone/handles/codes)
   * @param verificationData.email
   * @param verificationData.phone
   * @param verificationData.socialHandle
   * @param verificationData.verificationCode
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
   */
  async getFaucetStats(): Promise<FaucetStats> {
    if (this.statsCache) {
      return this.statsCache;
    }
    
    try {
      const response = await fetch(`${this.validatorEndpoint}/api/faucet/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch faucet stats');
      }
      
      const data = await response.json();
      
      this.statsCache = {
        totalDistributed: new Map(Object.entries(data.totalDistributed || {}).map(([k, v]) => [k as TestnetType, String(v)])),
        uniqueUsers: data.uniqueUsers || 0,
        dailyDistribution: new Map(Object.entries(data.dailyDistribution || {}).map(([k, v]) => [k as TestnetType, String(v)])),
        remainingPools: new Map(Object.entries(data.remainingPools || {}).map(([k, v]) => [k as TestnetType, String(v)])),
        avgClaimAmount: new Map(Object.entries(data.avgClaimAmount || {}).map(([k, v]) => [k as TestnetType, String(v)])),
        successRate: data.successRate || 0
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
   * @param testnet
   */
  getNetworkConfig(testnet: TestnetType): FaucetNetworkConfig | undefined {
    return this.networkConfigs.get(testnet);
  }
  
  /**
   * Get all supported networks
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
   * @param testnet
   */
  async addNetworkToWallet(testnet: TestnetType): Promise<{ success: boolean; error?: string }> {
    const config = this.networkConfigs.get(testnet);
    if (!config) {
      return {
        success: false,
        error: 'Network not supported'
      };
    }
    
    try {
      // Request to add network to wallet (MetaMask, etc.)
      if (window.ethereum) {
        await window.ethereum.request({
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
   * @param address
   * @param testnet
   */
  getDripAmount(address: string, testnet: TestnetType): string {
    const status = this.userStatusCache.get(address);
    const config = this.networkConfigs.get(testnet);
    
    if (!status || !config) {
      return config?.defaultAmount || '0';
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
   */
  private async loadFaucetStats(): Promise<void> {
    await this.getFaucetStats();
  }
  
  /**
   * Get client IP address
   */
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return '0.0.0.0';
    }
  }
  
  /**
   * Format time duration
   * @param seconds
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
    this.updateInterval = setInterval(async () => {
      // Refresh stats
      this.statsCache = null;
      await this.loadFaucetStats();
      
      // Clear old cache entries
      const now = Date.now();
      for (const [address, status] of this.userStatusCache) {
        // Remove if older than 10 minutes
        if (now - (status.claims.values().next().value?.lastClaim || 0) > 600000) {
          this.userStatusCache.delete(address);
        }
      }
    }, 5 * 60 * 1000);
  }
  
  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.userStatusCache.clear();
    this.statsCache = null;
  }
}

// Window type declaration for Ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

export default FaucetService;
