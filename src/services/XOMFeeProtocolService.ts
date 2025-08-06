/**
 * XOM Fee Protocol Service for Wallet
 * 
 * Manages the 0.025 XOM reward system for user actions across the OmniBazaar ecosystem.
 * Tracks rewards, enables claiming, and displays accumulated earnings.
 * 
 * @module services/XOMFeeProtocolService
 */

import { ethers } from 'ethers';

/**
 * Reward types for different actions
 */
export enum RewardType {
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  LISTING_VIEW = 'LISTING_VIEW',
  LISTING_CREATE = 'LISTING_CREATE',
  TRANSACTION = 'TRANSACTION',
  REVIEW = 'REVIEW',
  DEX_TRADE = 'DEX_TRADE',
  LIQUIDITY_PROVIDE = 'LIQUIDITY_PROVIDE',
  VALIDATOR_UPTIME = 'VALIDATOR_UPTIME',
  PRIVACY_TRANSACTION = 'PRIVACY_TRANSACTION',
  REFERRAL = 'REFERRAL'
}

/**
 * Reward configuration
 */
interface RewardConfig {
  /** Reward amount in XOM */
  amount: string;
  /** Description of the action */
  description: string;
  /** Daily limit for this reward type */
  dailyLimit: number;
  /** Cooldown period in seconds */
  cooldown: number;
}

/**
 * Pending reward entry
 */
interface PendingReward {
  /** Unique reward ID */
  id: string;
  /** User address */
  address: string;
  /** Reward type */
  type: RewardType;
  /** Amount in XOM */
  amount: string;
  /** Timestamp when earned */
  timestamp: number;
  /** Transaction hash if claimed */
  txHash?: string;
  /** Claim status */
  status: 'pending' | 'claiming' | 'claimed' | 'expired';
}

/**
 * User rewards summary
 */
interface RewardsSummary {
  /** Total pending rewards */
  pendingAmount: string;
  /** Total claimed rewards */
  claimedAmount: string;
  /** Rewards by type */
  byType: Map<RewardType, {
    count: number;
    total: string;
  }>;
  /** Recent rewards */
  recent: PendingReward[];
  /** Next claim available */
  nextClaimTime: number;
}

/**
 * XOM Fee Protocol Service
 */
export class XOMFeeProtocolService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private validatorEndpoint: string;
  private rewardsCache = new Map<string, RewardsSummary>();
  private updateInterval: NodeJS.Timeout | null = null;
  
  // Standard reward: 0.025 XOM
  private readonly STANDARD_REWARD = '0.025';
  
  // Reward configurations
  private readonly rewardConfigs: Map<RewardType, RewardConfig> = new Map([
    [RewardType.CHAT_MESSAGE, {
      amount: this.STANDARD_REWARD,
      description: 'Send a chat message',
      dailyLimit: 100,
      cooldown: 60 // 1 minute
    }],
    [RewardType.LISTING_VIEW, {
      amount: this.STANDARD_REWARD,
      description: 'View a listing',
      dailyLimit: 200,
      cooldown: 30
    }],
    [RewardType.LISTING_CREATE, {
      amount: '0.1', // 4x reward for creating listings
      description: 'Create a new listing',
      dailyLimit: 10,
      cooldown: 300
    }],
    [RewardType.TRANSACTION, {
      amount: '0.05', // 2x reward for transactions
      description: 'Complete a transaction',
      dailyLimit: 50,
      cooldown: 120
    }],
    [RewardType.REVIEW, {
      amount: '0.05',
      description: 'Leave a review',
      dailyLimit: 20,
      cooldown: 300
    }],
    [RewardType.DEX_TRADE, {
      amount: this.STANDARD_REWARD,
      description: 'Execute a DEX trade',
      dailyLimit: 100,
      cooldown: 60
    }],
    [RewardType.LIQUIDITY_PROVIDE, {
      amount: '0.1',
      description: 'Provide liquidity',
      dailyLimit: 10,
      cooldown: 600
    }],
    [RewardType.VALIDATOR_UPTIME, {
      amount: '1.0', // Daily validator reward
      description: 'Validator daily uptime',
      dailyLimit: 1,
      cooldown: 86400 // 24 hours
    }],
    [RewardType.PRIVACY_TRANSACTION, {
      amount: '0.05', // Bonus for privacy adoption
      description: 'Use pXOM for transaction',
      dailyLimit: 50,
      cooldown: 120
    }],
    [RewardType.REFERRAL, {
      amount: '0.5', // Referral bonus
      description: 'Successful referral',
      dailyLimit: 5,
      cooldown: 3600
    }]
  ]);
  
  constructor(
    provider: ethers.Provider,
    signer?: ethers.Signer,
    validatorEndpoint?: string
  ) {
    this.provider = provider;
    this.signer = signer;
    this.validatorEndpoint = validatorEndpoint || 'http://localhost:3001/api/rewards';
  }
  
  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Start periodic reward updates
    this.startRewardUpdates();
    console.log('XOM Fee Protocol Service initialized');
  }
  
  /**
   * Track a rewarded action
   */
  async trackAction(
    address: string,
    type: RewardType,
    metadata?: Record<string, any>
  ): Promise<PendingReward | null> {
    try {
      // Check if action is eligible for reward
      const isEligible = await this.checkEligibility(address, type);
      if (!isEligible) {
        console.log(`User ${address} not eligible for ${type} reward`);
        return null;
      }
      
      const config = this.rewardConfigs.get(type)!;
      
      // Create pending reward
      const reward: PendingReward = {
        id: `reward_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        address,
        type,
        amount: config.amount,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      // Submit to validator
      const response = await fetch(`${this.validatorEndpoint}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reward,
          metadata
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to track reward');
      }
      
      // Clear cache to force refresh
      this.rewardsCache.delete(address);
      
      console.log(`Reward earned: ${config.amount} XOM for ${type}`);
      return reward;
      
    } catch (error) {
      console.error('Error tracking action:', error);
      return null;
    }
  }
  
  /**
   * Check if user is eligible for reward
   */
  private async checkEligibility(address: string, type: RewardType): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.validatorEndpoint}/eligibility/${address}/${type}`
      );
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.eligible;
      
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return false;
    }
  }
  
  /**
   * Get rewards summary for an address
   */
  async getRewardsSummary(address: string): Promise<RewardsSummary> {
    // Check cache first
    const cached = this.rewardsCache.get(address);
    if (cached && Date.now() - cached.nextClaimTime < 60000) {
      return cached;
    }
    
    try {
      const response = await fetch(`${this.validatorEndpoint}/summary/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch rewards summary');
      }
      
      const data = await response.json();
      const summary = this.processRewardsData(data);
      
      // Update cache
      this.rewardsCache.set(address, summary);
      
      return summary;
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return this.getEmptyRewardsSummary();
    }
  }
  
  /**
   * Process rewards data from validator
   */
  private processRewardsData(data: any): RewardsSummary {
    const byType = new Map<RewardType, { count: number; total: string }>();
    
    // Process rewards by type
    for (const [type, stats] of Object.entries(data.byType || {})) {
      byType.set(type as RewardType, stats as any);
    }
    
    return {
      pendingAmount: data.pendingAmount || '0',
      claimedAmount: data.claimedAmount || '0',
      byType,
      recent: data.recent || [],
      nextClaimTime: data.nextClaimTime || Date.now()
    };
  }
  
  /**
   * Get empty rewards summary
   */
  private getEmptyRewardsSummary(): RewardsSummary {
    return {
      pendingAmount: '0',
      claimedAmount: '0',
      byType: new Map(),
      recent: [],
      nextClaimTime: Date.now()
    };
  }
  
  /**
   * Claim pending rewards
   */
  async claimRewards(address: string): Promise<{
    success: boolean;
    txHash?: string;
    amount?: string;
    error?: string;
  }> {
    if (!this.signer) {
      return {
        success: false,
        error: 'No signer available'
      };
    }
    
    try {
      // Get pending rewards
      const summary = await this.getRewardsSummary(address);
      
      if (parseFloat(summary.pendingAmount) === 0) {
        return {
          success: false,
          error: 'No pending rewards to claim'
        };
      }
      
      if (Date.now() < summary.nextClaimTime) {
        const waitTime = Math.ceil((summary.nextClaimTime - Date.now()) / 1000);
        return {
          success: false,
          error: `Please wait ${waitTime} seconds before claiming`
        };
      }
      
      // Submit claim request
      const response = await fetch(`${this.validatorEndpoint}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          amount: summary.pendingAmount,
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to claim rewards');
      }
      
      const data = await response.json();
      
      // Clear cache
      this.rewardsCache.delete(address);
      
      return {
        success: true,
        txHash: data.txHash,
        amount: summary.pendingAmount
      };
      
    } catch (error) {
      console.error('Error claiming rewards:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get reward history
   */
  async getRewardHistory(
    address: string,
    limit = 100
  ): Promise<PendingReward[]> {
    try {
      const response = await fetch(
        `${this.validatorEndpoint}/history/${address}?limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch reward history');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching reward history:', error);
      return [];
    }
  }
  
  /**
   * Get reward leaderboard
   */
  async getLeaderboard(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<Array<{
    address: string;
    totalEarned: string;
    rank: number;
  }>> {
    try {
      const response = await fetch(
        `${this.validatorEndpoint}/leaderboard?period=${period}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }
  
  /**
   * Get reward configuration
   */
  getRewardConfig(type: RewardType): RewardConfig | undefined {
    return this.rewardConfigs.get(type);
  }
  
  /**
   * Get all reward types
   */
  getAllRewardTypes(): Array<{
    type: RewardType;
    config: RewardConfig;
  }> {
    return Array.from(this.rewardConfigs.entries()).map(([type, config]) => ({
      type,
      config
    }));
  }
  
  /**
   * Start periodic reward updates
   */
  private startRewardUpdates(): void {
    // Update rewards every minute
    this.updateInterval = setInterval(async () => {
      for (const address of this.rewardsCache.keys()) {
        try {
          await this.getRewardsSummary(address);
        } catch (error) {
          console.error(`Error updating rewards for ${address}:`, error);
        }
      }
    }, 60 * 1000);
  }
  
  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.rewardsCache.clear();
  }
  
  /**
   * Format reward amount for display
   */
  formatReward(amount: string): string {
    return `${parseFloat(amount).toFixed(3)} XOM`;
  }
  
  /**
   * Calculate estimated daily earnings
   */
  calculateDailyEarnings(): string {
    let total = 0;
    
    for (const [type, config] of this.rewardConfigs) {
      // Skip validator rewards (special case)
      if (type === RewardType.VALIDATOR_UPTIME) continue;
      
      const dailyEarnings = parseFloat(config.amount) * config.dailyLimit;
      total += dailyEarnings;
    }
    
    return total.toFixed(3);
  }
}

export default XOMFeeProtocolService;