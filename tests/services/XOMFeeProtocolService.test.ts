/**
 * Tests for XOMFeeProtocolService
 * 
 * Tests the 0.025 XOM reward system for user actions including tracking,
 * claiming, eligibility checks, and reward calculations.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { XOMFeeProtocolService, RewardType } from '../../src/services/XOMFeeProtocolService';
import { ethers } from 'ethers';

// Mock fetch globally
global.fetch = jest.fn();

// Mock ethers
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Provider: jest.fn(),
  Signer: jest.fn()
}));

describe('XOMFeeProtocolService', () => {
  let service: XOMFeeProtocolService;
  let mockProvider: ethers.Provider;
  let mockSigner: ethers.Signer;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const testAddress = '0x1234567890123456789012345678901234567890';
  const validatorEndpoint = 'http://localhost:3001/api/rewards';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProvider = {} as ethers.Provider;
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue(testAddress)
    } as any;
    
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockReset();

    service = new XOMFeeProtocolService(mockProvider, mockSigner, validatorEndpoint);
  });

  afterEach(() => {
    service.shutdown();
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize service and start periodic updates', async () => {
      await service.initialize();
      
      // Verify update interval is set
      expect(service['updateInterval']).toBeTruthy();
    });

    it('should use default validator endpoint if not provided', () => {
      const defaultService = new XOMFeeProtocolService(mockProvider);
      expect(defaultService['validatorEndpoint']).toBe('http://localhost:3001/api/rewards');
    });
  });

  describe('Action Tracking', () => {
    it('should track eligible chat message action', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const reward = await service.trackAction(testAddress, RewardType.CHAT_MESSAGE);

      expect(reward).toBeDefined();
      expect(reward?.type).toBe(RewardType.CHAT_MESSAGE);
      expect(reward?.amount).toBe('0.025');
      expect(reward?.status).toBe('pending');
      expect(reward?.address).toBe(testAddress);
    });

    it('should track listing creation with higher reward', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const reward = await service.trackAction(testAddress, RewardType.LISTING_CREATE);

      expect(reward).toBeDefined();
      expect(reward?.amount).toBe('0.1'); // 4x standard reward
    });

    it('should track action with metadata', async () => {
      let trackedMetadata: any = null;
      
      mockFetch.mockImplementation(async (url, options) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          const body = JSON.parse(options?.body as string);
          trackedMetadata = body.metadata;
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const metadata = { listingId: '12345', category: 'electronics' };
      await service.trackAction(testAddress, RewardType.LISTING_VIEW, metadata);

      expect(trackedMetadata).toEqual(metadata);
    });

    it('should not track ineligible actions', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: false }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const reward = await service.trackAction(testAddress, RewardType.CHAT_MESSAGE);

      expect(reward).toBeNull();
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/track'), expect.any(Object));
    });

    it('should handle tracking errors gracefully', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          return new Response('Server error', { status: 500 });
        }
        return new Response('Not found', { status: 404 });
      });

      const reward = await service.trackAction(testAddress, RewardType.DEX_TRADE);

      expect(reward).toBeNull();
    });

    it('should handle network errors during eligibility check', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const reward = await service.trackAction(testAddress, RewardType.REVIEW);

      expect(reward).toBeNull();
    });
  });

  describe('Rewards Summary', () => {
    it('should fetch and cache rewards summary', async () => {
      const mockSummaryData = {
        pendingAmount: '2.5',
        claimedAmount: '10.0',
        byType: {
          [RewardType.CHAT_MESSAGE]: { count: 50, total: '1.25' },
          [RewardType.LISTING_VIEW]: { count: 50, total: '1.25' }
        },
        recent: [
          {
            id: 'reward_1',
            address: testAddress,
            type: RewardType.CHAT_MESSAGE,
            amount: '0.025',
            timestamp: Date.now() - 60000,
            status: 'pending'
          }
        ],
        nextClaimTime: Date.now() + 3600000
      };

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify(mockSummaryData), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const summary = await service.getRewardsSummary(testAddress);

      expect(summary.pendingAmount).toBe('2.5');
      expect(summary.claimedAmount).toBe('10.0');
      expect(summary.byType.get(RewardType.CHAT_MESSAGE)).toEqual({ count: 50, total: '1.25' });
      expect(summary.recent).toHaveLength(1);

      // Verify caching
      mockFetch.mockClear();
      const cachedSummary = await service.getRewardsSummary(testAddress);
      expect(cachedSummary).toEqual(summary);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty summary on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const summary = await service.getRewardsSummary(testAddress);

      expect(summary.pendingAmount).toBe('0');
      expect(summary.claimedAmount).toBe('0');
      expect(summary.byType.size).toBe(0);
      expect(summary.recent).toHaveLength(0);
    });

    it('should refresh cache after tracking action', async () => {
      // First fetch to populate cache
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '1.0',
            claimedAmount: '5.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now()
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await service.getRewardsSummary(testAddress);
      mockFetch.mockClear();

      // Track action should clear cache
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '1.025', // Updated amount
            claimedAmount: '5.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now()
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await service.trackAction(testAddress, RewardType.CHAT_MESSAGE);
      const summary = await service.getRewardsSummary(testAddress);

      expect(summary.pendingAmount).toBe('1.025');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/summary/'), undefined);
    });
  });

  describe('Claiming Rewards', () => {
    it('should claim pending rewards successfully', async () => {
      const mockTxHash = '0x' + 'a'.repeat(64);
      
      mockFetch.mockImplementation(async (url, options) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '5.0',
            claimedAmount: '10.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now() - 1000 // Can claim now
          }), { status: 200 });
        }
        if (url.includes('/claim')) {
          const body = JSON.parse(options?.body as string);
          expect(body.address).toBe(testAddress);
          expect(body.amount).toBe('5.0');
          return new Response(JSON.stringify({ txHash: mockTxHash }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await service.claimRewards(testAddress);

      expect(result).toEqual({
        success: true,
        txHash: mockTxHash,
        amount: '5.0'
      });
    });

    it('should not claim if no pending rewards', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '0',
            claimedAmount: '10.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now()
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await service.claimRewards(testAddress);

      expect(result).toEqual({
        success: false,
        error: 'No pending rewards to claim'
      });
    });

    it('should respect claim cooldown', async () => {
      const nextClaimTime = Date.now() + 60000; // 1 minute from now
      
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '5.0',
            claimedAmount: '10.0',
            byType: {},
            recent: [],
            nextClaimTime
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await service.claimRewards(testAddress);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please wait');
      expect(result.error).toContain('seconds before claiming');
    });

    it('should handle claim errors', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '5.0',
            claimedAmount: '10.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now() - 1000
          }), { status: 200 });
        }
        if (url.includes('/claim')) {
          return new Response('Server error', { status: 500 });
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await service.claimRewards(testAddress);

      expect(result).toEqual({
        success: false,
        error: 'Failed to claim rewards'
      });
    });

    it('should require signer for claiming', async () => {
      const serviceNoSigner = new XOMFeeProtocolService(mockProvider, undefined, validatorEndpoint);

      const result = await serviceNoSigner.claimRewards(testAddress);

      expect(result).toEqual({
        success: false,
        error: 'No signer available'
      });
    });
  });

  describe('Reward History', () => {
    it('should fetch reward history', async () => {
      const mockHistory = [
        {
          id: 'reward_1',
          address: testAddress,
          type: RewardType.CHAT_MESSAGE,
          amount: '0.025',
          timestamp: Date.now() - 3600000,
          status: 'claimed',
          txHash: '0x' + 'b'.repeat(64)
        },
        {
          id: 'reward_2',
          address: testAddress,
          type: RewardType.LISTING_VIEW,
          amount: '0.025',
          timestamp: Date.now() - 7200000,
          status: 'claimed',
          txHash: '0x' + 'c'.repeat(64)
        }
      ];

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/history/')) {
          expect(url).toContain('limit=50');
          return new Response(JSON.stringify(mockHistory), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const history = await service.getRewardHistory(testAddress, 50);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('reward_1');
      expect(history[1].id).toBe('reward_2');
    });

    it('should handle history fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const history = await service.getRewardHistory(testAddress);

      expect(history).toEqual([]);
    });
  });

  describe('Leaderboard', () => {
    it('should fetch weekly leaderboard', async () => {
      const mockLeaderboard = [
        { address: '0x1111111111111111111111111111111111111111', totalEarned: '100.0', rank: 1 },
        { address: '0x2222222222222222222222222222222222222222', totalEarned: '85.5', rank: 2 },
        { address: testAddress, totalEarned: '72.3', rank: 3 }
      ];

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/leaderboard')) {
          expect(url).toContain('period=weekly');
          return new Response(JSON.stringify(mockLeaderboard), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const leaderboard = await service.getLeaderboard('weekly');

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[2].address).toBe(testAddress);
    });

    it('should fetch daily leaderboard', async () => {
      const mockLeaderboard = [
        { address: testAddress, totalEarned: '10.5', rank: 1 }
      ];

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/leaderboard')) {
          expect(url).toContain('period=daily');
          return new Response(JSON.stringify(mockLeaderboard), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const leaderboard = await service.getLeaderboard('daily');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].totalEarned).toBe('10.5');
    });

    it('should handle leaderboard errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const leaderboard = await service.getLeaderboard();

      expect(leaderboard).toEqual([]);
    });
  });

  describe('Reward Configuration', () => {
    it('should get reward config for specific type', () => {
      const config = service.getRewardConfig(RewardType.LISTING_CREATE);

      expect(config).toBeDefined();
      expect(config?.amount).toBe('0.1');
      expect(config?.description).toBe('Create a new listing');
      expect(config?.dailyLimit).toBe(10);
      expect(config?.cooldown).toBe(300);
    });

    it('should return undefined for invalid type', () => {
      const config = service.getRewardConfig('INVALID_TYPE' as RewardType);

      expect(config).toBeUndefined();
    });

    it('should get all reward types', () => {
      const allTypes = service.getAllRewardTypes();

      expect(allTypes).toHaveLength(10);
      expect(allTypes.some(t => t.type === RewardType.CHAT_MESSAGE)).toBe(true);
      expect(allTypes.some(t => t.type === RewardType.VALIDATOR_UPTIME)).toBe(true);
      
      const validatorReward = allTypes.find(t => t.type === RewardType.VALIDATOR_UPTIME);
      expect(validatorReward?.config.amount).toBe('1.0');
      expect(validatorReward?.config.cooldown).toBe(86400);
    });
  });

  describe('Utility Functions', () => {
    it('should format reward amount', () => {
      expect(service.formatReward('1.234567')).toBe('1.235 XOM');
      expect(service.formatReward('0.025')).toBe('0.025 XOM');
      expect(service.formatReward('100')).toBe('100.000 XOM');
    });

    it('should calculate daily earnings potential', () => {
      const dailyEarnings = service.calculateDailyEarnings();
      const parsed = parseFloat(dailyEarnings);

      expect(parsed).toBeGreaterThan(0);
      expect(dailyEarnings).toMatch(/^\d+\.\d{3}$/); // Format: XX.XXX
    });

    it('should exclude validator rewards from daily earnings', () => {
      // Create a service to test calculation
      const earnings = service.calculateDailyEarnings();
      
      // Calculate expected without validator rewards
      let expected = 0;
      const allTypes = service.getAllRewardTypes();
      for (const { type, config } of allTypes) {
        if (type !== RewardType.VALIDATOR_UPTIME) {
          expected += parseFloat(config.amount) * config.dailyLimit;
        }
      }

      expect(parseFloat(earnings)).toBe(parseFloat(expected.toFixed(3)));
    });
  });

  describe('Periodic Updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should update cached rewards periodically', async () => {
      await service.initialize();

      // Add address to cache
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '1.0',
            claimedAmount: '5.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now()
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await service.getRewardsSummary(testAddress);
      mockFetch.mockClear();

      // Fast forward 1 minute
      jest.advanceTimersByTime(60 * 1000);

      // Verify update was called
      await Promise.resolve(); // Let promises resolve
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/summary/'), undefined);
    });

    it('should handle update errors gracefully', async () => {
      await service.initialize();

      // Add address to cache
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            pendingAmount: '1.0',
            claimedAmount: '5.0',
            byType: {},
            recent: [],
            nextClaimTime: Date.now()
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await service.getRewardsSummary(testAddress);

      // Make updates fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Fast forward 1 minute
      jest.advanceTimersByTime(60 * 1000);

      // Service should continue running despite errors
      expect(service['updateInterval']).toBeTruthy();
    });
  });

  describe('Service Shutdown', () => {
    it('should clear interval and cache on shutdown', async () => {
      await service.initialize();
      
      // Add some cached data
      await service.getRewardsSummary(testAddress);
      
      expect(service['updateInterval']).toBeTruthy();
      expect(service['rewardsCache'].size).toBeGreaterThan(0);

      service.shutdown();

      expect(service['updateInterval']).toBeNull();
      expect(service['rewardsCache'].size).toBe(0);
    });

    it('should handle multiple shutdown calls', () => {
      service.shutdown();
      service.shutdown(); // Should not throw

      expect(service['updateInterval']).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed reward data', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/summary/')) {
          return new Response(JSON.stringify({
            // Missing fields
            pendingAmount: null,
            byType: 'invalid'
          }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const summary = await service.getRewardsSummary(testAddress);

      expect(summary.pendingAmount).toBe('0');
      expect(summary.byType.size).toBe(0);
    });

    it('should generate unique reward IDs', async () => {
      const rewards: string[] = [];
      
      mockFetch.mockImplementation(async (url, options) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          const body = JSON.parse(options?.body as string);
          rewards.push(body.reward.id);
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      await service.trackAction(testAddress, RewardType.CHAT_MESSAGE);
      await service.trackAction(testAddress, RewardType.LISTING_VIEW);

      expect(rewards).toHaveLength(2);
      expect(rewards[0]).not.toBe(rewards[1]);
      expect(rewards[0]).toMatch(/^reward_\d+_\w+$/);
    });

    it('should handle very long metadata', async () => {
      let trackedBody: any = null;
      
      mockFetch.mockImplementation(async (url, options) => {
        if (url.includes('/eligibility/')) {
          return new Response(JSON.stringify({ eligible: true }), { status: 200 });
        }
        if (url.includes('/track')) {
          trackedBody = JSON.parse(options?.body as string);
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const longMetadata = {
        description: 'a'.repeat(10000),
        tags: Array(1000).fill('tag'),
        nested: { deep: { very: { deep: { object: 'value' } } } }
      };

      await service.trackAction(testAddress, RewardType.REVIEW, longMetadata);

      expect(trackedBody.metadata).toEqual(longMetadata);
    });
  });
});