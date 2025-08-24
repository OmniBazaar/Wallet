/**
 * React hook for staking operations
 * 
 * Provides easy access to staking functionality from React components
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { StakingService, StakeInfo, StakingStats, StakingTier } from '../services/StakingService';

/**
 *
 */
export interface UseStakingReturn {
  // State
  /**
   *
   */
  stakeInfo: StakeInfo | null;
  /**
   *
   */
  stakingStats: StakingStats | null;
  /**
   *
   */
  pendingRewards: string;
  /**
   *
   */
  tiers: StakingTier[];
  /**
   *
   */
  isLoading: boolean;
  /**
   *
   */
  error: string | null;
  
  // Actions
  /**
   *
   */
  stake: (amount: string, durationDays: number, usePrivacy?: boolean) => Promise<boolean>;
  /**
   *
   */
  unstake: (amount: string) => Promise<boolean>;
  /**
   *
   */
  claimRewards: () => Promise<{ /**
                                 *
                                 */
  success: boolean; /**
                     *
                     */
  amount?: string }>;
  /**
   *
   */
  compound: () => Promise<boolean>;
  /**
   *
   */
  emergencyWithdraw: () => Promise<boolean>;
  
  // Helpers
  /**
   *
   */
  calculateAPY: (amount: string, durationDays: number) => number;
  /**
   *
   */
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
 */
export const useStaking = (): UseStakingReturn => {
  const { address, signer, provider } = useWallet();
  const [stakingService] = useState(() => StakingService.getInstance());
  
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [pendingRewards, setPendingRewards] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch stake info
  const fetchStakeInfo = useCallback(async () => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const info = await stakingService.getStakeInfo(address);
      setStakeInfo(info);
      
      if (info?.isActive) {
        const rewards = await stakingService.getPendingRewards(address);
        setPendingRewards(rewards);
      }
    } catch (err) {
      console.error('Failed to fetch stake info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stake info');
    } finally {
      setIsLoading(false);
    }
  }, [address, stakingService]);
  
  // Fetch staking statistics
  const fetchStakingStats = useCallback(async () => {
    try {
      const stats = await stakingService.getStakingStats(address);
      setStakingStats(stats);
    } catch (err) {
      console.error('Failed to fetch staking stats:', err);
    }
  }, [address, stakingService]);
  
  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchStakeInfo(),
      fetchStakingStats()
    ]);
  }, [fetchStakeInfo, fetchStakingStats]);
  
  // Initial load
  useEffect(() => {
    if (address) {
      refresh();
    }
  }, [address, refresh]);
  
  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!address) return;
    
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [address, refresh]);
  
  // Stake tokens
  const stake = useCallback(async (
    amount: string,
    durationDays: number,
    usePrivacy: boolean = false
  ): Promise<boolean> => {
    if (!signer) {
      setError('No wallet connected');
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await stakingService.stake(amount, durationDays, usePrivacy, signer);
      
      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error || 'Staking failed');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Staking failed';
      setError(message);
      console.error('Staking error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [signer, stakingService, refresh]);
  
  // Unstake tokens
  const unstake = useCallback(async (amount: string): Promise<boolean> => {
    if (!signer) {
      setError('No wallet connected');
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await stakingService.unstake(amount, signer);
      
      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error || 'Unstaking failed');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unstaking failed';
      setError(message);
      console.error('Unstaking error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [signer, stakingService, refresh]);
  
  // Claim rewards
  const claimRewards = useCallback(async (): Promise<{ success: boolean; amount?: string }> => {
    if (!signer) {
      setError('No wallet connected');
      return { success: false };
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await stakingService.claimRewards(signer);
      
      if (result.success) {
        await refresh();
        return { success: true, amount: result.amount };
      } else {
        setError(result.error || 'Claim failed');
        return { success: false };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Claim failed';
      setError(message);
      console.error('Claim error:', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [signer, stakingService, refresh]);
  
  // Compound rewards
  const compound = useCallback(async (): Promise<boolean> => {
    if (!signer) {
      setError('No wallet connected');
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await stakingService.compound(signer);
      
      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error || 'Compound failed');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compound failed';
      setError(message);
      console.error('Compound error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [signer, stakingService, refresh]);
  
  // Emergency withdraw
  const emergencyWithdraw = useCallback(async (): Promise<boolean> => {
    if (!signer) {
      setError('No wallet connected');
      return false;
    }
    
    if (!window.confirm('Emergency withdraw will forfeit all pending rewards. Continue?')) {
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await stakingService.emergencyWithdraw(signer);
      
      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.error || 'Emergency withdraw failed');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Emergency withdraw failed';
      setError(message);
      console.error('Emergency withdraw error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [signer, stakingService, refresh]);
  
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