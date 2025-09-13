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

interface TokenContractMethods {
  approve: (spender: string, amount: bigint) => Promise<ethers.ContractTransactionResponse>;
  allowance: (owner: string, spender: string) => Promise<bigint>;
  balanceOf: (account: string) => Promise<bigint>;
}

interface StakingContractMethods {
  stake: (amount: bigint, duration: bigint, usePrivacy: boolean) => Promise<ethers.ContractTransactionResponse>;
  unstake: (amount: bigint) => Promise<ethers.ContractTransactionResponse>;
  claimRewards: () => Promise<ethers.ContractTransactionResponse>;
  compound: () => Promise<ethers.ContractTransactionResponse>;
  emergencyWithdraw: () => Promise<ethers.ContractTransactionResponse>;
  getStakeInfo: (user: string) => Promise<[bigint, bigint, bigint, bigint, boolean, boolean]>;
  calculateReward: (user: string) => Promise<bigint>;
  getTierInfo: (tier: bigint) => Promise<[bigint, bigint]>;
  minStakeAmount: () => Promise<bigint>;
  maxStakeAmount: () => Promise<bigint>;
  baseRewardRate: () => Promise<bigint>;
  isStakingEnabled: () => Promise<boolean>;
  getParticipationScore: (user: string) => Promise<bigint>;
}

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
 * Staking statistics interface
 */
export interface StakingStats {
  /** Total XOM staked across all users */
  totalStaked: string;
  /** Number of distinct stakers */
  totalStakers: number;
  /** Average APY across tiers */
  averageAPY: number;
  /**
   * Current user's stake info
   */
  userStake?: StakeInfo;
  /** Whether staking is currently enabled */
  isEnabled: boolean;
}

/**
 * Staking tier definition
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
   * Base APY percentage for this tier
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
  private readonly STAKING_CONTRACT_ADDRESS = ((process?.env?.['STAKING_CONTRACT'] ?? '') !== '' ? process.env['STAKING_CONTRACT'] : undefined) ?? '0x0000000000000000000000000000000000000000';
  private readonly XOM_TOKEN_ADDRESS = ((process?.env?.['XOM_TOKEN'] ?? '') !== '' ? process.env['XOM_TOKEN'] : undefined) ?? '0x0000000000000000000000000000000000000000';

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
    void this.initializeProvider();
  }

  /**
   * Get singleton instance
   * @returns The StakingService singleton instance
   */
  public static getInstance(): StakingService {
    if (StakingService.instance === undefined) {
      StakingService.instance = new StakingService();
    }
    return StakingService.instance;
  }

  /**
   * Initialize provider and contracts
   * @returns Promise that resolves when initialization is complete
   */
  private initializeProvider(): void {
    try {
      // Try OmniProvider first
      this.omniProvider = new OmniProvider('staking-service');

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

      // console.log('StakingService initialized with OmniProvider');
    } catch (error) {
      console.warn('Failed to initialize with OmniProvider, using fallback:', error);

      // Fallback to standard provider
      this.provider = new ethers.JsonRpcProvider(
        ((process.env['RPC_URL'] ?? '') !== '' ? process.env['RPC_URL'] : undefined) ?? 'https://ethereum.publicnode.com'
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
   * @param amount - Amount of XOM tokens to stake
   * @param durationDays - Duration of stake in days
   * @param usePrivacy - Whether to use privacy-enabled staking
   * @param signer - Ethers signer for transaction
   * @returns Promise with success status and transaction hash
   */
  public async stake(
    amount: string,
    durationDays: number,
    usePrivacy: boolean = false,
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (this.stakingContract === null || this.tokenContract === null) {
        throw new Error('Contracts not initialized');
      }

      const amountWei = ethers.parseEther(amount);
      const durationSeconds = durationDays * 24 * 60 * 60;

      // Get contract with signer
      const signerOrProvider = signer ?? this.provider;
      if (signerOrProvider === null) {
        throw new Error('No signer or provider available');
      }
      const stakingWithSigner = this.stakingContract.connect(signerOrProvider);
      const tokenWithSigner = this.tokenContract.connect(signerOrProvider);

      // Check allowance
      const allowance = await (tokenWithSigner as unknown as TokenContractMethods).allowance(
        await (signer?.getAddress() ?? ''),
        this.STAKING_CONTRACT_ADDRESS
      );

      // Approve if needed
      if (allowance < amountWei) {
        const approveTx = await (tokenWithSigner as unknown as TokenContractMethods).approve(
          this.STAKING_CONTRACT_ADDRESS,
          amountWei
        );
        await approveTx.wait();
      }

      // Stake tokens
      const tx = await (stakingWithSigner as unknown as StakingContractMethods).stake(amountWei, BigInt(durationSeconds), usePrivacy);
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error('Transaction failed to confirm');
      }

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: unknown) {
      console.error('Staking failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Staking failed'
      };
    }
  }

  /**
   * Unstake tokens
   * @param amount - Amount of XOM tokens to unstake
   * @param signer - Ethers signer for transaction
   * @returns Promise with success status and transaction hash
   */
  public async unstake(
    amount: string,
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const amountWei = ethers.parseEther(amount);
      const signerOrProvider = signer ?? this.provider;
      if (signerOrProvider === null) {
        throw new Error('No signer or provider available');
      }
      const stakingWithSigner = this.stakingContract.connect(signerOrProvider);

      const tx = await (stakingWithSigner as unknown as StakingContractMethods).unstake(amountWei);
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error('Transaction failed to confirm');
      }

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: unknown) {
      console.error('Unstaking failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unstaking failed'
      };
    }
  }

  /**
   * Claim staking rewards
   * @param signer - Ethers signer for transaction
   * @returns Promise with success status, claimed amount, and transaction hash
   */
  public async claimRewards(
    signer?: ethers.Signer
  ): Promise<{ success: boolean; amount?: string; txHash?: string; error?: string }> {
    try {
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const signerOrProvider = signer ?? this.provider;
      if (signerOrProvider === null) {
        throw new Error('No signer or provider available');
      }
      const stakingWithSigner = this.stakingContract.connect(signerOrProvider);

      const tx = await (stakingWithSigner as unknown as StakingContractMethods).claimRewards();
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error('Transaction failed to confirm');
      }

      // Get claimed amount from events
      const event = receipt.logs.find((log) => {
        if ('topics' in log && Array.isArray(log.topics) && log.topics.length > 0) {
          return log.topics[0] === ethers.id('RewardsClaimed(address,uint256)');
        }
        return false;
      });

      const amount = event !== undefined && 'data' in event ? ethers.formatEther(event.data) : '0';

      return {
        success: true,
        amount,
        txHash: receipt.hash
      };
    } catch (error: unknown) {
      console.error('Claim rewards failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Claim failed'
      };
    }
  }

  /**
   * Compound rewards back into stake
   * @param signer - Ethers signer for transaction
   * @returns Promise with success status and transaction hash
   */
  public async compound(
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const signerOrProvider = signer ?? this.provider;
      if (signerOrProvider === null) {
        throw new Error('No signer or provider available');
      }
      const stakingWithSigner = this.stakingContract.connect(signerOrProvider);

      const tx = await (stakingWithSigner as unknown as StakingContractMethods).compound();
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error('Transaction failed to confirm');
      }

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: unknown) {
      console.error('Compound failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compound failed'
      };
    }
  }

  /**
   * Get stake info for an address
   * @param address - Wallet address to query
   * @returns Promise with stake info or null if not found
   */
  public async getStakeInfo(address: string): Promise<StakeInfo | null> {
    try {
      // Try OmniProvider first
      if (this.omniProvider !== null) {
        try {
          const info = await this.omniProvider.send('omni_getStakeInfo', [address]);
          if (info !== null && typeof info === 'object' && 'tier' in info) {
            return info as StakeInfo;
          }
        } catch (error) {
          console.warn('OmniProvider failed, using contract:', error);
        }
      }

      // Fallback to direct contract call
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const info = await (this.stakingContract as unknown as StakingContractMethods).getStakeInfo(address);
      const rewards = await (this.stakingContract as unknown as StakingContractMethods).calculateReward(address);
      const participationScore = await (this.stakingContract as unknown as StakingContractMethods).getParticipationScore(address);

      return {
        tier: Number(info[0]), // tier
        startTime: Number(info[1]), // startTime
        lastRewardTime: Number(info[2]), // lastRewardTime
        commitmentDuration: Number(info[3]), // commitmentDuration
        isActive: info[4], // isActive
        usePrivacy: info[5], // usePrivacy
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
   * @param address - Wallet address to query
   * @returns Promise with pending rewards amount as string
   */
  public async getPendingRewards(address: string): Promise<string> {
    try {
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const rewards = await (this.stakingContract as unknown as StakingContractMethods).calculateReward(address);
      return ethers.formatEther(rewards);
    } catch (error) {
      console.error('Failed to get pending rewards:', error);
      return '0';
    }
  }

  /**
   * Get staking statistics
   * @param userAddress - Optional user address for user-specific stats
   * @returns Promise with staking statistics
   */
  public async getStakingStats(userAddress?: string): Promise<StakingStats> {
    try {
      // Try OmniProvider first
      if (this.omniProvider !== null) {
        try {
          const stats = await this.omniProvider.send('omni_getStakingStats', [userAddress]);
          if (stats !== null && typeof stats === 'object' && 'totalStaked' in stats) {
            return stats as StakingStats;
          }
        } catch (error) {
          console.warn('OmniProvider failed for stats:', error);
        }
      }

      // Fallback to calculating from contract
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const isEnabled = await (this.stakingContract as unknown as StakingContractMethods).isStakingEnabled();

      // Get tier info
      let totalStaked = BigInt(0);
      let totalStakers = 0;

      for (let i = 1; i <= 5; i++) {
        const tierInfo = await (this.stakingContract as unknown as StakingContractMethods).getTierInfo(BigInt(i));
        totalStakers += Number(tierInfo[0]); // totalStakers
        // Note: actual staked amount is encrypted, using estimate
        totalStaked += BigInt(tierInfo[1]) * BigInt(10 ** 18); // totalTierWeight
      }

      // Get user stake if address provided
      let userStake;
      if (userAddress !== undefined && userAddress !== '') {
        const stake = await this.getStakeInfo(userAddress);
        if (stake !== null) {
          userStake = stake;
        }
      }

      return {
        totalStaked: ethers.formatEther(totalStaked),
        totalStakers,
        averageAPY: 10, // Average across all tiers
        ...(userStake !== undefined && { userStake }),
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
   * @returns Array of staking tier definitions
   */
  public getTiers(): StakingTier[] {
    return this.STAKING_TIERS;
  }

  /**
   * Calculate estimated APY for an amount and duration
   * @param amount - Amount to stake
   * @param durationDays - Duration of stake in days
   * @returns Estimated APY percentage
   */
  public calculateAPY(amount: string, durationDays: number): number {
    const amountNum = parseFloat(amount);

    // Find appropriate tier
    const tier = this.STAKING_TIERS.find(t =>
      amountNum >= parseFloat(t.minStake) && amountNum <= parseFloat(t.maxStake)
    );

    if (tier === undefined) {
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
   * @param signer - Ethers signer for transaction
   * @returns Promise with success status and transaction hash
   */
  public async emergencyWithdraw(
    signer?: ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (this.stakingContract === null) {
        throw new Error('Contract not initialized');
      }

      const signerOrProvider = signer ?? this.provider;
      if (signerOrProvider === null) {
        throw new Error('No signer or provider available');
      }
      const stakingWithSigner = this.stakingContract.connect(signerOrProvider);

      const tx = await (stakingWithSigner as unknown as StakingContractMethods).emergencyWithdraw();
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error('Transaction failed to confirm');
      }

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: unknown) {
      console.error('Emergency withdraw failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Emergency withdraw failed'
      };
    }
  }

  /**
   * Get staked balance for an address
   * @param address - The address to check
   * @returns The staked balance in wei
   */
  public async getStakedBalance(address: string): Promise<bigint> {
    try {
      const stakeInfo = await this.getStakeInfo(address);
      if (!stakeInfo || !stakeInfo.isActive) {
        return BigInt(0);
      }

      // The stake info doesn't have amount directly, need to calculate from tier
      // For now, return a default based on tier
      const tierAmounts = [
        ethers.parseEther('1000'),   // Bronze
        ethers.parseEther('5000'),   // Silver
        ethers.parseEther('10000'),  // Gold
        ethers.parseEther('50000'),  // Platinum
        ethers.parseEther('100000')  // Diamond
      ];

      return tierAmounts[stakeInfo.tier] || BigInt(0);
    } catch (error) {
      console.error('Failed to get staked balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Get staking positions for an address
   * @param address - The address to check
   * @returns Array of staking positions
   */
  public async getStakingPositions(address: string): Promise<Array<{
    id: string;
    amount: bigint;
    startTime: number;
    endTime: number;
    rewards: bigint;
    isActive: boolean;
  }>> {
    try {
      const stakeInfo = await this.getStakeInfo(address);
      if (!stakeInfo || !stakeInfo.isActive) {
        return [];
      }

      const rewards = await this.getPendingRewards(address);

      return [{
        id: '0', // Single position per address in current contract
        amount: await this.getStakedBalance(address),
        startTime: stakeInfo.startTime * 1000, // Convert to milliseconds
        endTime: (stakeInfo.startTime + stakeInfo.commitmentDuration) * 1000,
        rewards: ethers.parseEther(rewards),
        isActive: stakeInfo.isActive
      }];
    } catch (error) {
      console.error('Failed to get staking positions:', error);
      return [];
    }
  }
}
