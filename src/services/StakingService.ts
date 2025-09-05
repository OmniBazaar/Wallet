/**
 * Staking Service for OmniCoin
 *
 * Provides interface to the OmniCoinStaking smart contract for staking XOM tokens.
 * Supports both privacy-enabled and standard staking with tier-based rewards.
 */

import { ethers } from 'ethers';
import { OmniProvider } from '../core/providers/OmniProvider';

// Staking contract ABI (essential functions only)
const STAKING_ABI = [
  // Read functions
  'function getStakeInfo(address staker) view returns (tuple(uint256 tier, uint256 startTime, uint256 lastRewardTime, uint256 commitmentDuration, bool isActive, bool usePrivacy))',
  'function calculateReward(address staker) view returns (uint256)',
  'function getTierInfo(uint256 tier) view returns (tuple(uint256 totalStakers, uint256 totalTierWeight))',
  'function minStakeAmount() view returns (uint256)',
  'function maxStakeAmount() view returns (uint256)',
  'function baseRewardRate() view returns (uint256)',
  'function isStakingEnabled() view returns (bool)',
  'function getParticipationScore(address user) view returns (uint256)',

  // Write functions
  'function stake(uint256 amount, uint256 duration, bool usePrivacy) returns (bool)',
  'function unstake(uint256 amount) returns (bool)',
  'function claimRewards() returns (uint256)',
  'function compound() returns (bool)',
  'function emergencyWithdraw() returns (bool)',

  // Events
  'event Staked(address indexed user, uint256 amount, uint256 tier, uint256 duration, bool usePrivacy)',
  'event Unstaked(address indexed user, uint256 amount)',
  'event RewardsClaimed(address indexed user, uint256 amount)',
  'event Compounded(address indexed user, uint256 amount)'
];

// XOM token ABI (for approvals)
const TOKEN_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

/** Information about a user's stake */
export interface StakeInfo {
  /** Staking tier (0-3) */
  tier: number;
  /** Unix timestamp (seconds) when stake started */
  startTime: number;
  /** Unix timestamp (seconds) of last reward accrual */
  lastRewardTime: number;
  /** Commitment duration in days */
  commitmentDuration: number;
  /** Whether stake is currently active */
  isActive: boolean;
  /** Whether privacy staking is used */
  usePrivacy: boolean;
  /** Actual staked amount (omitted for private stakes) */
  balance?: string; // Actual stake amount (if not private)
  /** Pending rewards in XOM */
  rewards?: string; // Pending rewards
  /** Current participation score affecting rewards */
  participationScore?: number;
}

/**
 *
 */
export interface StakingStats {
  /** Total XOM staked across all users */
  totalStaked: string;
  /** Number of distinct stakers */
  totalStakers: number;
  /** Average APY across tiers */
  averageAPY: number;
  /**
   *
   */
  userStake?: StakeInfo;
  /** Whether staking is currently enabled */
  isEnabled: boolean;
}

/**
 *
 */
export interface StakingTier {
  /** Tier identifier */
  id: number;
  /** Display name */
  name: string;
  /** Minimum stake for this tier */
  minStake: string;
  /** Maximum stake for this tier */
  maxStake: string;
  /**
   *
   */
  baseAPY: number;
  /** Total active stakers in this tier */
  totalStakers: number;
  /** Aggregated tier weight (used for rewards) */
  totalWeight: number;
}

/**
 * Staking Service
 *
 * @example
 * ```typescript
 * const stakingService = StakingService.getInstance();
 *
 * // Stake tokens
 * await stakingService.stake('1000', 30, false); // 1000 XOM for 30 days
 *
 * // Check rewards
 * const rewards = await stakingService.getPendingRewards(address);
 *
 * // Claim rewards
 * await stakingService.claimRewards();
 * ```
 */
export class StakingService {
  private static instance: StakingService;
  private provider: ethers.Provider | null = null;
  private omniProvider: OmniProvider | null = null;
  private stakingContract: ethers.Contract | null = null;
  private tokenContract: ethers.Contract | null = null;

  // Contract addresses (would be loaded from config)
  private readonly STAKING_CONTRACT_ADDRESS = (process?.env?.['STAKING_CONTRACT'] as string | undefined) || '0x0000000000000000000000000000000000000000';
  private readonly XOM_TOKEN_ADDRESS = (process?.env?.['XOM_TOKEN'] as string | undefined) || '0x0000000000000000000000000000000000000000';

  // Staking tiers
  private readonly STAKING_TIERS: StakingTier[] = [
    {
      id: 1,
      name: 'Bronze',
      minStake: '100',
      maxStake: '999',
      baseAPY: 5,
      totalStakers: 0,
      totalWeight: 0
    },
    {
      id: 2,
      name: 'Silver',
      minStake: '1000',
      maxStake: '9999',
      baseAPY: 7,
      totalStakers: 0,
      totalWeight: 0
    },
    {
      id: 3,
      name: 'Gold',
      minStake: '10000',
      maxStake: '99999',
      baseAPY: 10,
      totalStakers: 0,
      totalWeight: 0
    },
    {
      id: 4,
      name: 'Platinum',
      minStake: '100000',
      maxStake: '999999',
      baseAPY: 15,
      totalStakers: 0,
      totalWeight: 0
    },
    {
      id: 5,
      name: 'Diamond',
      minStake: '1000000',
      maxStake: '999999999',
      baseAPY: 20,
      totalStakers: 0,
      totalWeight: 0
    }
  ];

  private constructor() {
    this.initializeProvider();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): StakingService {
    if (!StakingService.instance) {
      StakingService.instance = new StakingService();
    }
    return StakingService.instance;
  }

  /**
   * Initialize provider and contracts
   */
  private async initializeProvider(): Promise<void> {
    try {
      // Try OmniProvider first
      this.omniProvider = new OmniProvider(1, {
        validatorUrl: (process?.env?.['VALIDATOR_URL'] as string | undefined) || 'wss://validator.omnibazaar.com',
        walletId: 'staking-service',
        authKey: process?.env?.['OMNI_AUTH_KEY'] as string | undefined
      });

      // Initialize contracts
      this.stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        STAKING_ABI,
        this.omniProvider
      );

      this.tokenContract = new ethers.Contract(
        this.XOM_TOKEN_ADDRESS,
        TOKEN_ABI,
        this.omniProvider
      );

      console.log('StakingService initialized with OmniProvider');
    } catch (error) {
      console.warn('Failed to initialize with OmniProvider, using fallback:', error);

      // Fallback to standard provider
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'https://ethereum.publicnode.com'
      );

      this.stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        STAKING_ABI,
        this.provider
      );

      this.tokenContract = new ethers.Contract(
        this.XOM_TOKEN_ADDRESS,
        TOKEN_ABI,
        this.provider
      );
    }
  }

  /**
   * Stake XOM tokens
   * @param amount
   * @param durationDays
   * @param usePrivacy
   * @param signer
   */
  public async stake(
    amount: string,
    durationDays: number,
    usePrivacy: boolean = false,
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.stakingContract || !this.tokenContract) {
        throw new Error('Contracts not initialized');
      }

      const amountWei = ethers.parseEther(amount);
      const durationSeconds = durationDays * 24 * 60 * 60;

      // Get contract with signer
      const stakingWithSigner = this.stakingContract.connect(signer || this.provider);
      const tokenWithSigner = this.tokenContract.connect(signer || this.provider);

      // Check allowance
      const allowance = await tokenWithSigner.allowance(
        await signer?.getAddress(),
        this.STAKING_CONTRACT_ADDRESS
      );

      // Approve if needed
      if (allowance < amountWei) {
        const approveTx = await tokenWithSigner.approve(
          this.STAKING_CONTRACT_ADDRESS,
          amountWei
        );
        await approveTx.wait();
      }

      // Stake tokens
      const tx = await stakingWithSigner.stake(amountWei, durationSeconds, usePrivacy);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Staking failed:', error);
      return {
        success: false,
        error: error.message || 'Staking failed'
      };
    }
  }

  /**
   * Unstake tokens
   * @param amount
   * @param signer
   */
  public async unstake(
    amount: string,
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const amountWei = ethers.parseEther(amount);
      const stakingWithSigner = this.stakingContract.connect(signer || this.provider);

      const tx = await stakingWithSigner.unstake(amountWei);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Unstaking failed:', error);
      return {
        success: false,
        error: error.message || 'Unstaking failed'
      };
    }
  }

  /**
   * Claim staking rewards
   * @param signer
   */
  public async claimRewards(
    signer?: ethers.Signer
  ): Promise<{ success: boolean; amount?: string; txHash?: string; error?: string }> {
    try {
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const stakingWithSigner = this.stakingContract.connect(signer || this.provider);

      const tx = await stakingWithSigner.claimRewards();
      const receipt = await tx.wait();

      // Get claimed amount from events
      const event = receipt.logs.find((log: any) =>
        log.topics[0] === ethers.id('RewardsClaimed(address,uint256)')
      );

      const amount = event ? ethers.formatEther(event.data) : '0';

      return {
        success: true,
        amount,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Claim rewards failed:', error);
      return {
        success: false,
        error: error.message || 'Claim failed'
      };
    }
  }

  /**
   * Compound rewards back into stake
   * @param signer
   */
  public async compound(
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const stakingWithSigner = this.stakingContract.connect(signer || this.provider);

      const tx = await stakingWithSigner.compound();
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Compound failed:', error);
      return {
        success: false,
        error: error.message || 'Compound failed'
      };
    }
  }

  /**
   * Get stake info for an address
   * @param address
   */
  public async getStakeInfo(address: string): Promise<StakeInfo | null> {
    try {
      // Try OmniProvider first
      if (this.omniProvider) {
        try {
          const info = await this.omniProvider.send('omni_getStakeInfo', [address]);
          if (info) {
            return info;
          }
        } catch (error) {
          console.warn('OmniProvider failed, using contract:', error);
        }
      }

      // Fallback to direct contract call
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const info = await this.stakingContract.getStakeInfo(address);
      const rewards = await this.stakingContract.calculateReward(address);
      const participationScore = await this.stakingContract.getParticipationScore(address);

      return {
        tier: Number(info.tier),
        startTime: Number(info.startTime),
        lastRewardTime: Number(info.lastRewardTime),
        commitmentDuration: Number(info.commitmentDuration),
        isActive: info.isActive,
        usePrivacy: info.usePrivacy,
        rewards: ethers.formatEther(rewards),
        participationScore: Number(participationScore)
      };
    } catch (error) {
      console.error('Failed to get stake info:', error);
      return null;
    }
  }

  /**
   * Get pending rewards for an address
   * @param address
   */
  public async getPendingRewards(address: string): Promise<string> {
    try {
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const rewards = await this.stakingContract.calculateReward(address);
      return ethers.formatEther(rewards);
    } catch (error) {
      console.error('Failed to get pending rewards:', error);
      return '0';
    }
  }

  /**
   * Get staking statistics
   * @param userAddress
   */
  public async getStakingStats(userAddress?: string): Promise<StakingStats> {
    try {
      // Try OmniProvider first
      if (this.omniProvider) {
        try {
          const stats = await this.omniProvider.send('omni_getStakingStats', [userAddress]);
          if (stats) {
            return stats;
          }
        } catch (error) {
          console.warn('OmniProvider failed for stats:', error);
        }
      }

      // Fallback to calculating from contract
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const isEnabled = await this.stakingContract.isStakingEnabled();

      // Get tier info
      let totalStaked = BigInt(0);
      let totalStakers = 0;

      for (let i = 1; i <= 5; i++) {
        const tierInfo = await this.stakingContract.getTierInfo(i);
        totalStakers += Number(tierInfo.totalStakers);
        // Note: actual staked amount is encrypted, using estimate
        totalStaked += BigInt(tierInfo.totalTierWeight) * BigInt(10 ** 18);
      }

      // Get user stake if address provided
      let userStake;
      if (userAddress) {
        userStake = await this.getStakeInfo(userAddress);
      }

      return {
        totalStaked: ethers.formatEther(totalStaked),
        totalStakers,
        averageAPY: 10, // Average across all tiers
        userStake: userStake || undefined,
        isEnabled
      };
    } catch (error) {
      console.error('Failed to get staking stats:', error);
      return {
        totalStaked: '0',
        totalStakers: 0,
        averageAPY: 0,
        isEnabled: false
      };
    }
  }

  /**
   * Get staking tiers
   */
  public getTiers(): StakingTier[] {
    return this.STAKING_TIERS;
  }

  /**
   * Calculate estimated APY for an amount and duration
   * @param amount
   * @param durationDays
   */
  public calculateAPY(amount: string, durationDays: number): number {
    const amountNum = parseFloat(amount);

    // Find appropriate tier
    const tier = this.STAKING_TIERS.find(t =>
      amountNum >= parseFloat(t.minStake) && amountNum <= parseFloat(t.maxStake)
    );

    if (!tier) {
      return 0;
    }

    let apy = tier.baseAPY;

    // Add duration bonuses
    if (durationDays >= 730) { // 2 years
      apy += 5;
    } else if (durationDays >= 180) { // 6 months
      apy += 2;
    } else if (durationDays >= 30) { // 1 month
      apy += 1;
    }

    return apy;
  }

  /**
   * Emergency withdraw (forfeits rewards)
   * @param signer
   */
  public async emergencyWithdraw(
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.stakingContract) {
        throw new Error('Contract not initialized');
      }

      const stakingWithSigner = this.stakingContract.connect(signer || this.provider);

      const tx = await stakingWithSigner.emergencyWithdraw();
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Emergency withdraw failed:', error);
      return {
        success: false,
        error: error.message || 'Emergency withdraw failed'
      };
    }
  }
}
