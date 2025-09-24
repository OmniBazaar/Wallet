/**
 * React hook for staking operations
 *
 * Provides easy access to staking functionality from React components
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { StakingService, StakeInfo, StakingStats, StakingTier } from '../services/StakingService';
import { BrowserProvider } from 'ethers';

/** Return type for useStaking hook */
export interface UseStakingReturn {
  // State
  /** Current stake information */
  stakeInfo: StakeInfo | null;
  /** Overall staking statistics */
  stakingStats: StakingStats | null;
  /** Pending rewards amount */
  pendingRewards: string;
  /** Available staking tiers */
  tiers: StakingTier[];
  /** Whether operations are loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // Actions
  /** Stake tokens */
  stake: (amount: string, durationDays: number, usePrivacy?: boolean) => Promise<boolean>;
  /** Unstake tokens */
  unstake: (amount: string) => Promise<boolean>;
  /** Claim staking rewards */
  claimRewards: () => Promise<{
    /** Whether claim was successful */
    success: boolean;
    /** Amount claimed */
    amount?: string;
  }>;
  /** Compound rewards back into stake */
  compound: () => Promise<boolean>;
  /** Emergency withdraw all staked tokens */
  emergencyWithdraw: () => Promise<boolean>;

  // Helpers
  /** Calculate APY for given amount and duration */
  calculateAPY: (amount: string, durationDays: number) => number;
  /** Refresh all staking data */
  refresh: () => Promise<void>;
}

/**
 * useStaking Hook
 *
 * @example
 * ```typescript
 * const {
 *   stakeInfo,
 *   pendingRewards,
 *   stake,
 *   claimRewards
 * } = useStaking();
 *
 * // Stake 1000 XOM for 30 days
 * await stake('1000', 30);
 *
 * // Claim rewards
 * const result = await claimRewards();
 * console.log(`Claimed ${result.amount} XOM`);
 * ```
 * @returns Staking hook interface with state and actions
 */
export const useStaking = (): UseStakingReturn => {
  const { address, provider } = useWallet();
  const [stakingService] = useState(() => StakingService.getInstance());

  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [pendingRewards, setPendingRewards] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch stake info
  const fetchStakeInfo = useCallback(async (): Promise<void> => {
    if (address === null) return;

    try {
      setIsLoading(true);
      setError(null);

      const info = await stakingService.getStakeInfo(address);
      setStakeInfo(info);

      if (info?.isActive === true) {
        const rewards = await stakingService.getPendingRewards(address);
        setPendingRewards(rewards);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch stake info:', err);
      const error = err instanceof Error ? err.message : 'Failed to fetch stake info';
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [address, stakingService]);

  // Fetch staking statistics
  const fetchStakingStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await stakingService.getStakingStats(address ?? undefined);
      setStakingStats(stats);
    } catch (err: unknown) {
      // Silently handle stats error - non-critical
    }
  }, [address, stakingService]);

  // Refresh all data
  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchStakeInfo(),
      fetchStakingStats()
    ]);
  }, [fetchStakeInfo, fetchStakingStats]);

  // Initial load
  useEffect(() => {
    if (address !== null) {
      void refresh();
    }
  }, [address, refresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (address === null) return;

    const interval = setInterval(() => { void refresh(); }, 30000);
    return () => clearInterval(interval);
  }, [address, refresh]);

  // Stake tokens
  const stake = useCallback(async (
    amount: string,
    durationDays: number,
    usePrivacy: boolean = false
  ): Promise<boolean> => {
    if (provider === null) {
      setError('No wallet connected');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (provider === null) throw new Error('Provider not available');

      // Create ethers provider from EIP-1193 provider and get signer
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const result = await stakingService.stake(amount, durationDays, usePrivacy, signer);

      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error ?? 'Staking failed');
        return false;
      }
    } catch (err: unknown) {
      console.error('Staking error:', err);
      const message = err instanceof Error ? err.message : 'Staking failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider, stakingService, refresh]);

  // Unstake tokens
  const unstake = useCallback(async (_amount: string): Promise<boolean> => {
    if (provider === null) {
      setError('No wallet connected');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (provider === null) throw new Error('Provider not available');

      // Create ethers provider from EIP-1193 provider and get signer
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const result = await stakingService.unstake(_amount, signer);

      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error ?? 'Unstaking failed');
        return false;
      }
    } catch (err: unknown) {
      console.error('Unstaking error:', err);
      const message = err instanceof Error ? err.message : 'Unstaking failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider, stakingService, refresh]);

  // Claim rewards
  const claimRewards = useCallback(async (): Promise<{ success: boolean; amount?: string }> => {
    if (provider === null) {
      setError('No wallet connected');
      return { success: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      if (provider === null) throw new Error('Provider not available');

      // Create ethers provider from EIP-1193 provider and get signer
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const result = await stakingService.claimRewards(signer);

      if (result.success) {
        await refresh();
        return {
          success: true,
          ...(result.amount !== undefined && { amount: result.amount })
        };
      } else {
        setError(result.error ?? 'Claim failed');
        return { success: false };
      }
    } catch (err: unknown) {
      console.error('Claim rewards error:', err);
      const message = err instanceof Error ? err.message : 'Claim failed';
      setError(message);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [provider, stakingService, refresh]);

  // Compound rewards
  const compound = useCallback(async (): Promise<boolean> => {
    if (provider === null) {
      setError('No wallet connected');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (provider === null) throw new Error('Provider not available');

      // Create ethers provider from EIP-1193 provider and get signer
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const result = await stakingService.compound(signer);

      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error ?? 'Compound failed');
        return false;
      }
    } catch (err: unknown) {
      console.error('Compound error:', err);
      const message = err instanceof Error ? err.message : 'Compound failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider, stakingService, refresh]);

  // Emergency withdraw
  const emergencyWithdraw = useCallback(async (): Promise<boolean> => {
    if (provider === null) {
      setError('No wallet connected');
      return false;
    }

    if (typeof window !== 'undefined' && window.confirm !== undefined && !window.confirm('Emergency withdraw will forfeit all pending rewards. Continue?')) {
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (provider === null) throw new Error('Provider not available');

      // Create ethers provider from EIP-1193 provider and get signer
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const result = await stakingService.emergencyWithdraw(signer);

      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error ?? 'Emergency withdraw failed');
        return false;
      }
    } catch (err: unknown) {
      console.error('Emergency withdraw error:', err);
      const message = err instanceof Error ? err.message : 'Emergency withdraw failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider, stakingService, refresh]);

  // Calculate APY
  const calculateAPY = useCallback((amount: string, durationDays: number): number => {
    return stakingService.calculateAPY(amount, durationDays);
  }, [stakingService]);

  return {
    // State
    stakeInfo,
    stakingStats,
    pendingRewards,
    tiers: stakingService.getTiers(),
    isLoading,
    error,

    // Actions
    stake,
    unstake,
    claimRewards,
    compound,
    emergencyWithdraw,

    // Helpers
    calculateAPY,
    refresh
  };
};
