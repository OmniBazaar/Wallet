/**
 * Tests for StakingService
 * 
 * Tests the OmniCoin staking functionality including staking, unstaking,
 * rewards, tier calculations, and privacy features.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StakingService } from '../../src/services/StakingService';
import type { StakeInfo, StakingStats, StakingTier } from '../../src/services/StakingService';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn(),
  JsonRpcProvider: jest.fn(),
  parseEther: jest.fn((value) => BigInt(Math.floor(parseFloat(value) * 1e18))),
  formatEther: jest.fn((value) => (Number(value) / 1e18).toString()),
  id: jest.fn((text) => '0x' + Array(64).fill('0').join(''))
}));

// Mock OmniProvider
jest.mock('../../src/core/providers/OmniProvider', () => ({
  OmniProvider: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1 })
  }))
}));

const mockProvider = {
  send: jest.fn(),
  getNetwork: jest.fn().mockResolvedValue({ chainId: 1 })
};

const mockStakingContract = {
  connect: jest.fn().mockReturnThis(),
  stake: jest.fn(),
  unstake: jest.fn(),
  claimRewards: jest.fn(),
  compound: jest.fn(),
  emergencyWithdraw: jest.fn(),
  getStakeInfo: jest.fn(),
  calculateReward: jest.fn(),
  getTierInfo: jest.fn(),
  minStakeAmount: jest.fn(),
  maxStakeAmount: jest.fn(),
  baseRewardRate: jest.fn(),
  isStakingEnabled: jest.fn(),
  getParticipationScore: jest.fn()
};

const mockTokenContract = {
  connect: jest.fn().mockReturnThis(),
  approve: jest.fn(),
  allowance: jest.fn(),
  balanceOf: jest.fn()
};

const mockSigner = {
  getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  provider: mockProvider
};

describe('StakingService', () => {
  let service: StakingService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock contract constructor
    (ethers.Contract as jest.MockedClass<typeof ethers.Contract>).mockImplementation((address, abi) => {
      if (address.includes('0000000000000000000000000000000000000000')) {
        // Return appropriate mock based on ABI
        if (abi.some((item: string) => item.includes('stake'))) {
          return mockStakingContract as any;
        } else {
          return mockTokenContract as any;
        }
      }
      return {} as any;
    });

    // Mock JsonRpcProvider
    (ethers.JsonRpcProvider as jest.MockedClass<typeof ethers.JsonRpcProvider>).mockImplementation(() => mockProvider as any);

    service = StakingService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = StakingService.getInstance();
      const instance2 = StakingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Staking Operations', () => {
    it('should stake tokens successfully', async () => {
      const amount = '1000';
      const duration = 30; // 30 days
      const usePrivacy = false;

      mockTokenContract.allowance.mockResolvedValue(BigInt(0));
      mockTokenContract.approve.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xapprove' })
      });
      mockStakingContract.stake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xstake' })
      });

      const result = await service.stake(amount, duration, usePrivacy, mockSigner as any);

      expect(result).toEqual({
        success: true,
        txHash: '0xstake'
      });

      expect(mockTokenContract.approve).toHaveBeenCalled();
      expect(mockStakingContract.stake).toHaveBeenCalledWith(
        BigInt(1000 * 1e18),
        BigInt(30 * 24 * 60 * 60),
        false
      );
    });

    it('should stake with privacy enabled', async () => {
      const amount = '5000';
      const duration = 90;
      const usePrivacy = true;

      mockTokenContract.allowance.mockResolvedValue(BigInt(10000 * 1e18));
      mockStakingContract.stake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xprivatestake' })
      });

      const result = await service.stake(amount, duration, usePrivacy, mockSigner as any);

      expect(result.success).toBe(true);
      expect(mockTokenContract.approve).not.toHaveBeenCalled(); // Sufficient allowance
      expect(mockStakingContract.stake).toHaveBeenCalledWith(
        BigInt(5000 * 1e18),
        BigInt(90 * 24 * 60 * 60),
        true
      );
    });

    it('should handle staking errors', async () => {
      const amount = '1000';
      const duration = 30;

      mockTokenContract.allowance.mockResolvedValue(BigInt(0));
      mockTokenContract.approve.mockRejectedValue(new Error('User rejected'));

      const result = await service.stake(amount, duration, false, mockSigner as any);

      expect(result).toEqual({
        success: false,
        error: 'User rejected'
      });
    });

    it('should unstake tokens successfully', async () => {
      const amount = '500';

      mockStakingContract.unstake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xunstake' })
      });

      const result = await service.unstake(amount, mockSigner as any);

      expect(result).toEqual({
        success: true,
        txHash: '0xunstake'
      });

      expect(mockStakingContract.unstake).toHaveBeenCalledWith(BigInt(500 * 1e18));
    });

    it('should handle unstake errors', async () => {
      const amount = '500';

      mockStakingContract.unstake.mockRejectedValue(new Error('Insufficient stake'));

      const result = await service.unstake(amount, mockSigner as any);

      expect(result).toEqual({
        success: false,
        error: 'Insufficient stake'
      });
    });
  });

  describe('Rewards Management', () => {
    it('should claim rewards successfully', async () => {
      const mockReceipt = {
        hash: '0xclaim',
        logs: [{
          topics: ['0x' + Array(64).fill('0').join('')], // RewardsClaimed event
          data: '0x' + (1000 * 1e18).toString(16)
        }]
      };

      mockStakingContract.claimRewards.mockResolvedValue({
        wait: jest.fn().mockResolvedValue(mockReceipt)
      });

      const result = await service.claimRewards(mockSigner as any);

      expect(result).toEqual({
        success: true,
        amount: '1000',
        txHash: '0xclaim'
      });
    });

    it('should handle claim rewards errors', async () => {
      mockStakingContract.claimRewards.mockRejectedValue(new Error('No rewards'));

      const result = await service.claimRewards(mockSigner as any);

      expect(result).toEqual({
        success: false,
        error: 'No rewards'
      });
    });

    it('should compound rewards successfully', async () => {
      mockStakingContract.compound.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xcompound' })
      });

      const result = await service.compound(mockSigner as any);

      expect(result).toEqual({
        success: true,
        txHash: '0xcompound'
      });
    });

    it('should get pending rewards', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const rewardAmount = BigInt(5000 * 1e18);

      mockStakingContract.calculateReward.mockResolvedValue(rewardAmount);

      const rewards = await service.getPendingRewards(address);

      expect(rewards).toBe('5000');
      expect(mockStakingContract.calculateReward).toHaveBeenCalledWith(address);
    });

    it('should handle pending rewards errors', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      mockStakingContract.calculateReward.mockRejectedValue(new Error('Network error'));

      const rewards = await service.getPendingRewards(address);

      expect(rewards).toBe('0');
    });
  });

  describe('Stake Information', () => {
    it('should get stake info from OmniProvider', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const mockStakeInfo: StakeInfo = {
        tier: 2,
        startTime: 1234567890,
        lastRewardTime: 1234567900,
        commitmentDuration: 30,
        isActive: true,
        usePrivacy: false,
        balance: '1000',
        rewards: '50',
        participationScore: 85
      };

      mockProvider.send.mockResolvedValue(mockStakeInfo);

      const info = await service.getStakeInfo(address);

      expect(info).toEqual(mockStakeInfo);
      expect(mockProvider.send).toHaveBeenCalledWith('omni_getStakeInfo', [address]);
    });

    it('should get stake info from contract fallback', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      mockProvider.send.mockRejectedValue(new Error('Method not found'));
      mockStakingContract.getStakeInfo.mockResolvedValue([
        BigInt(3), // tier
        BigInt(1234567890), // startTime
        BigInt(1234567900), // lastRewardTime
        BigInt(30), // commitmentDuration
        true, // isActive
        false // usePrivacy
      ]);
      mockStakingContract.calculateReward.mockResolvedValue(BigInt(100 * 1e18));
      mockStakingContract.getParticipationScore.mockResolvedValue(BigInt(90));

      const info = await service.getStakeInfo(address);

      expect(info).toEqual({
        tier: 3,
        startTime: 1234567890,
        lastRewardTime: 1234567900,
        commitmentDuration: 30,
        isActive: true,
        usePrivacy: false,
        rewards: '100',
        participationScore: 90
      });
    });

    it('should handle stake info errors', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      mockProvider.send.mockRejectedValue(new Error('Network error'));
      mockStakingContract.getStakeInfo.mockRejectedValue(new Error('Contract error'));

      const info = await service.getStakeInfo(address);

      expect(info).toBeNull();
    });
  });

  describe('Staking Statistics', () => {
    it('should get staking stats from OmniProvider', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const mockStats: StakingStats = {
        totalStaked: '1000000',
        totalStakers: 500,
        averageAPY: 12.5,
        isEnabled: true,
        userStake: {
          tier: 2,
          startTime: 1234567890,
          lastRewardTime: 1234567900,
          commitmentDuration: 30,
          isActive: true,
          usePrivacy: false,
          balance: '1000',
          rewards: '50',
          participationScore: 85
        }
      };

      mockProvider.send.mockResolvedValue(mockStats);

      const stats = await service.getStakingStats(userAddress);

      expect(stats).toEqual(mockStats);
      expect(mockProvider.send).toHaveBeenCalledWith('omni_getStakingStats', [userAddress]);
    });

    it('should calculate staking stats from contract', async () => {
      mockProvider.send.mockRejectedValue(new Error('Method not found'));
      mockStakingContract.isStakingEnabled.mockResolvedValue(true);
      
      // Mock tier info for 5 tiers
      mockStakingContract.getTierInfo.mockImplementation((tier: bigint) => {
        const tierNum = Number(tier);
        return Promise.resolve([
          BigInt(tierNum * 100), // totalStakers
          BigInt(tierNum * 1000) // totalTierWeight
        ]);
      });

      const stats = await service.getStakingStats();

      expect(stats.isEnabled).toBe(true);
      expect(stats.totalStakers).toBe(1500); // Sum of all tier stakers
      expect(stats.averageAPY).toBe(10); // Default average
      expect(Number(stats.totalStaked)).toBeGreaterThan(0);
    });

    it('should handle stats errors', async () => {
      mockProvider.send.mockRejectedValue(new Error('Network error'));
      mockStakingContract.isStakingEnabled.mockRejectedValue(new Error('Contract error'));

      const stats = await service.getStakingStats();

      expect(stats).toEqual({
        totalStaked: '0',
        totalStakers: 0,
        averageAPY: 0,
        isEnabled: false
      });
    });
  });

  describe('Tier Management', () => {
    it('should return staking tiers', () => {
      const tiers = service.getTiers();

      expect(tiers).toHaveLength(5);
      expect(tiers[0]).toEqual({
        id: 1,
        name: 'Bronze',
        minStake: '100',
        maxStake: '999',
        baseAPY: 5,
        totalStakers: 0,
        totalWeight: 0
      });
      expect(tiers[4]).toEqual({
        id: 5,
        name: 'Diamond',
        minStake: '1000000',
        maxStake: '999999999',
        baseAPY: 20,
        totalStakers: 0,
        totalWeight: 0
      });
    });

    it('should calculate APY for Bronze tier', () => {
      const apy = service.calculateAPY('500', 30);
      expect(apy).toBe(6); // 5% base + 1% for 30 days
    });

    it('should calculate APY for Silver tier with 6 month bonus', () => {
      const apy = service.calculateAPY('5000', 180);
      expect(apy).toBe(9); // 7% base + 2% for 180 days
    });

    it('should calculate APY for Gold tier with 2 year bonus', () => {
      const apy = service.calculateAPY('50000', 730);
      expect(apy).toBe(15); // 10% base + 5% for 730 days
    });

    it('should calculate APY for Platinum tier', () => {
      const apy = service.calculateAPY('500000', 365);
      expect(apy).toBe(17); // 15% base + 2% for 365 days
    });

    it('should calculate APY for Diamond tier', () => {
      const apy = service.calculateAPY('5000000', 1000);
      expect(apy).toBe(25); // 20% base + 5% for 1000 days
    });

    it('should return 0 APY for amount below minimum', () => {
      const apy = service.calculateAPY('50', 30);
      expect(apy).toBe(0);
    });

    it('should return 0 APY for amount above maximum', () => {
      const apy = service.calculateAPY('10000000000', 30);
      expect(apy).toBe(0);
    });

    it('should calculate APY without duration bonus', () => {
      const apy = service.calculateAPY('1000', 7); // Less than 30 days
      expect(apy).toBe(7); // Silver tier base APY only
    });
  });

  describe('Emergency Operations', () => {
    it('should perform emergency withdraw successfully', async () => {
      mockStakingContract.emergencyWithdraw.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xemergency' })
      });

      const result = await service.emergencyWithdraw(mockSigner as any);

      expect(result).toEqual({
        success: true,
        txHash: '0xemergency'
      });
    });

    it('should handle emergency withdraw errors', async () => {
      mockStakingContract.emergencyWithdraw.mockRejectedValue(new Error('Not allowed'));

      const result = await service.emergencyWithdraw(mockSigner as any);

      expect(result).toEqual({
        success: false,
        error: 'Not allowed'
      });
    });
  });

  describe('Contract Initialization', () => {
    it('should handle missing contracts gracefully', async () => {
      // Create a new instance with failing contract initialization
      (ethers.Contract as jest.MockedClass<typeof ethers.Contract>).mockImplementation(() => {
        throw new Error('Contract creation failed');
      });

      const result = await service.stake('1000', 30, false, mockSigner as any);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Contract')
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small stake amounts', async () => {
      const amount = '0.001'; // Very small amount

      mockTokenContract.allowance.mockResolvedValue(BigInt(0));
      mockTokenContract.approve.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xapprove' })
      });
      mockStakingContract.stake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xsmallstake' })
      });

      const result = await service.stake(amount, 30, false, mockSigner as any);

      expect(result.success).toBe(true);
      expect(mockStakingContract.stake).toHaveBeenCalledWith(
        BigInt(0.001 * 1e18),
        BigInt(30 * 24 * 60 * 60),
        false
      );
    });

    it('should handle very large stake amounts', async () => {
      const amount = '10000000'; // 10 million

      mockTokenContract.allowance.mockResolvedValue(BigInt(0));
      mockTokenContract.approve.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xapprove' })
      });
      mockStakingContract.stake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xlargestake' })
      });

      const result = await service.stake(amount, 30, false, mockSigner as any);

      expect(result.success).toBe(true);
      expect(mockStakingContract.stake).toHaveBeenCalledWith(
        BigInt(10000000 * 1e18),
        BigInt(30 * 24 * 60 * 60),
        false
      );
    });

    it('should handle maximum duration', async () => {
      const amount = '1000';
      const duration = 3650; // 10 years

      mockTokenContract.allowance.mockResolvedValue(BigInt(10000 * 1e18));
      mockStakingContract.stake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ hash: '0xlongstake' })
      });

      const result = await service.stake(amount, duration, false, mockSigner as any);

      expect(result.success).toBe(true);
      expect(mockStakingContract.stake).toHaveBeenCalledWith(
        BigInt(1000 * 1e18),
        BigInt(3650 * 24 * 60 * 60),
        false
      );
    });

    it('should handle failed transaction confirmation', async () => {
      mockStakingContract.unstake.mockResolvedValue({
        wait: jest.fn().mockResolvedValue(null) // No receipt
      });

      const result = await service.unstake('500', mockSigner as any);

      expect(result).toEqual({
        success: false,
        error: 'Transaction failed to confirm'
      });
    });

    it('should handle missing reward event in claim', async () => {
      const mockReceipt = {
        hash: '0xclaim',
        logs: [] // No events
      };

      mockStakingContract.claimRewards.mockResolvedValue({
        wait: jest.fn().mockResolvedValue(mockReceipt)
      });

      const result = await service.claimRewards(mockSigner as any);

      expect(result).toEqual({
        success: true,
        amount: '0', // No event means 0 amount
        txHash: '0xclaim'
      });
    });
  });

  describe('Privacy Features', () => {
    it('should handle privacy staking info', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      mockProvider.send.mockRejectedValue(new Error('Method not found'));
      mockStakingContract.getStakeInfo.mockResolvedValue([
        BigInt(4), // tier (Platinum)
        BigInt(1234567890), // startTime
        BigInt(1234567900), // lastRewardTime
        BigInt(365), // commitmentDuration
        true, // isActive
        true // usePrivacy - Privacy enabled!
      ]);
      mockStakingContract.calculateReward.mockResolvedValue(BigInt(0)); // Hidden for privacy
      mockStakingContract.getParticipationScore.mockResolvedValue(BigInt(100));

      const info = await service.getStakeInfo(address);

      expect(info).toEqual({
        tier: 4,
        startTime: 1234567890,
        lastRewardTime: 1234567900,
        commitmentDuration: 365,
        isActive: true,
        usePrivacy: true, // Privacy flag set
        rewards: '0', // Hidden
        participationScore: 100
      });
    });
  });
});