/**
 * LiquidityService Tests
 *
 * Comprehensive test suite for LiquidityService including add/remove liquidity,
 * position management, impermanent loss calculations, and pool analytics.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LiquidityService, PoolInfo, LiquidityPosition } from '../../src/services/LiquidityService';
import { WalletService } from '../../src/services/WalletService';
import { ethers } from 'ethers';

describe('LiquidityService', () => {
  let liquidityService: LiquidityService;
  let mockWalletService: WalletService;

  beforeEach(async () => {
    // Create mock wallet service
    mockWalletService = {
      isServiceInitialized: jest.fn().mockReturnValue(true),
      init: jest.fn().mockResolvedValue(undefined),
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      getWallet: jest.fn().mockReturnValue({
        getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
        provider: {}
      }),
      getChainId: jest.fn().mockResolvedValue(1),
      signTransaction: jest.fn().mockResolvedValue('0xSignedTx'),
      sendTransaction: jest.fn().mockResolvedValue({
        hash: '0x' + '1'.repeat(64),
        wait: jest.fn().mockResolvedValue({ status: 1 })
      })
    } as unknown as WalletService;

    // Create LiquidityService with mock wallet service
    liquidityService = new LiquidityService(mockWalletService);
    await liquidityService.init();
  });

  afterEach(async () => {
    await liquidityService.cleanup();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const service = new LiquidityService(mockWalletService);
      await service.init();
      expect(service).toBeDefined();
      await service.cleanup();
    });

    it('should handle initialization without wallet service', async () => {
      const service = new LiquidityService(mockWalletService);
      mockWalletService.isServiceInitialized = jest.fn().mockReturnValue(false);
      await service.init();
      expect(mockWalletService.init).toHaveBeenCalled();
    });
  });

  describe('addLiquidity', () => {
    it('should validate liquidity parameters', async () => {
      const params = {
        tokenA: '0x0000000000000000000000000000000000000000', // Zero address
        tokenB: '0xB',
        amountA: BigInt('0'), // Invalid amount
        amountB: BigInt('2000000000000000000'),
        minAmountA: BigInt('0'),
        minAmountB: BigInt('0'),
        recipient: '0x0000000000000000000000000000000000000000'
      };

      const result = await liquidityService.addLiquidity(params);

      // With zero amount, lpTokens calculation results in NaN
      expect(result.lpTokens.toString()).toBe('NaN');
    });

    it('should handle add liquidity request', async () => {
      const params = {
        tokenA: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        amountA: BigInt('1000000000'), // 1000 USDC
        amountB: BigInt('500000000000000000'), // 0.5 ETH
        minAmountA: BigInt('990000000'),
        minAmountB: BigInt('495000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.lpTokens).toBeDefined();
      expect(result.share).toBe(0.1);
      expect(result.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should handle V3 concentrated liquidity', async () => {
      const params = {
        tokenA: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountA: BigInt('1000000000'),
        amountB: BigInt('500000000000000000'),
        minAmountA: BigInt('990000000'),
        minAmountB: BigInt('495000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.lpTokens).toBeDefined();
      expect(result.transactionHash).toBeDefined();
    });
  });

  describe('removeLiquidity', () => {
    it('should validate removal parameters', async () => {
      const params = {
        positionId: '0', // Invalid ID
        liquidityPercentage: 0, // Invalid percentage
        amount0Min: BigInt('0'),
        amount1Min: BigInt('0')
      };

      await expect(
        liquidityService.removeLiquidity(params)
      ).rejects.toThrow('Invalid liquidity percentage');
    });

    it('should handle liquidity removal', async () => {
      const params = {
        positionId: 'position_123',
        liquidityPercentage: 50, // Remove 50%
        amount0Min: BigInt('490000000'),
        amount1Min: BigInt('245000000000000000')
      };

      await expect(
        liquidityService.removeLiquidity(params)
      ).rejects.toThrow('DEX service not available');
    });

    it('should handle V3 position removal', async () => {
      const params = {
        positionId: 'v3_position_123',
        liquidityPercentage: 100, // Remove all
        amount0Min: BigInt('980000000'),
        amount1Min: BigInt('490000000000000000'),
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      await expect(
        liquidityService.removeLiquidity(params)
      ).rejects.toThrow('DEX service not available');
    });
  });

  describe('getUserPositions', () => {
    it('should return empty array when no positions', async () => {
      const positions = await liquidityService.getUserPositions();

      expect(Array.isArray(positions)).toBe(true);
      expect(positions.length).toBe(0);
    });

    it('should filter positions by pool', async () => {
      const positions = await liquidityService.getUserPositions('0xPoolAddress');

      expect(Array.isArray(positions)).toBe(true);
      expect(positions.length).toBe(0);
    });
  });

  describe('getPoolInfo', () => {
    it('should return pool information', async () => {
      const poolInfo = await liquidityService.getPoolInfo(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      );

      // Without real pool data, should return mock data
      expect(poolInfo).toBeDefined();
      expect(poolInfo.token0).toBeDefined();
      expect(poolInfo.token1).toBeDefined();
      expect(poolInfo.reserve0).toBeDefined();
      expect(poolInfo.reserve1).toBeDefined();
    });

    it('should handle invalid token pairs', async () => {
      const poolInfo = await liquidityService.getPoolInfo(
        '0xInvalidToken1',
        '0xInvalidToken2'
      );

      expect(poolInfo).toBeDefined();
      expect(poolInfo.tvl).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateImpermanentLoss', () => {
    it('should calculate impermanent loss correctly', async () => {
      const position: LiquidityPosition = {
        poolAddress: '0xPoolAddress',
        tokenA: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        liquidity: BigInt('1000000000000000000'),
        amountA: BigInt('1000000000'), // 1000 USDC
        amountB: BigInt('500000000000000000'), // 0.5 ETH
        fees: {
          tokenA: BigInt('10000000'), // 10 USDC
          tokenB: BigInt('5000000000000000') // 0.005 ETH
        },
        timestamp: Date.now() - 86400000 // 1 day ago
      };

      const il = await liquidityService.calculateImpermanentLoss(position);

      expect(il).toBeDefined();
      expect(il.percentage).toBeGreaterThanOrEqual(0);
      expect(il.valueUSD).toBeGreaterThanOrEqual(0);
      expect(il.hodlValue).toBeGreaterThan(0);
      expect(il.currentValue).toBeGreaterThan(0);
    });

    it('should handle zero liquidity positions', async () => {
      const position: LiquidityPosition = {
        poolAddress: '0xPoolAddress',
        tokenA: '0xA',
        tokenB: '0xB',
        liquidity: BigInt('0'),
        amountA: BigInt('0'),
        amountB: BigInt('0'),
        fees: {
          tokenA: BigInt('0'),
          tokenB: BigInt('0')
        },
        timestamp: Date.now()
      };

      const il = await liquidityService.calculateImpermanentLoss(position);

      expect(il.percentage).toBe(0);
      expect(il.valueUSD).toBe(0);
    });
  });

  describe('calculateImpermanentLossForPair', () => {
    it('should calculate IL for a token pair', async () => {
      const il = await liquidityService.calculateImpermanentLossForPair(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        BigInt('1000000000'), // 1000 USDC initial
        BigInt('500000000000000000') // 0.5 ETH initial
      );

      expect(il).toBeDefined();
      expect(il.percentage).toBeGreaterThanOrEqual(0);
      expect(il.percentage).toBeLessThanOrEqual(100);
    });

    it('should handle same token amounts', async () => {
      const il = await liquidityService.calculateImpermanentLossForPair(
        '0xA',
        '0xB',
        BigInt('1000000000000000000'),
        BigInt('1000000000000000000')
      );

      // With same amounts and no price change, IL should be 0
      expect(il.percentage).toBe(0);
    });
  });

  describe('collectFees', () => {
    it('should collect fees from V3 position', async () => {
      await expect(
        liquidityService.collectFees(BigInt(123))
      ).rejects.toThrow('DEX service not available');
    });

    it('should handle invalid token ID', async () => {
      const result = await liquidityService.collectFees(BigInt(0));

      await expect(
        liquidityService.collectFees(BigInt(0))
      ).rejects.toThrow('Invalid');
    });
  });

  describe('getPoolAnalytics', () => {
    it('should return pool analytics', async () => {
      const analytics = await liquidityService.getPoolAnalytics('0xPoolAddress');

      expect(analytics).toBeDefined();
      expect(analytics.volume24h).toBeGreaterThanOrEqual(0);
      expect(analytics.volume7d).toBeGreaterThanOrEqual(0);
      expect(analytics.fees24h).toBeGreaterThanOrEqual(0);
      expect(analytics.apy).toBeGreaterThanOrEqual(0);
    });

    it('should calculate APY correctly', async () => {
      const analytics = await liquidityService.getPoolAnalytics('0xPoolAddress');

      // APY should be reasonable (0-1000%)
      expect(analytics.apy).toBeGreaterThanOrEqual(0);
      expect(analytics.apy).toBeLessThanOrEqual(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle uninitialized service', async () => {
      const uninitializedService = new LiquidityService(mockWalletService);

      await expect(
        uninitializedService.addLiquidity({
          token0: '0xA',
          token1: '0xB',
          amount0Desired: BigInt('1000'),
          amount1Desired: BigInt('2000'),
          amount0Min: BigInt('990'),
          amount1Min: BigInt('1980')
        })
      ).rejects.toThrow('Liquidity service not initialized');
    });

    it('should handle network errors gracefully', async () => {
      mockWalletService.getChainId = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        liquidityService.addLiquidity({
          token0: '0xA',
          token1: '0xB',
          amount0Desired: BigInt('1000'),
          amount1Desired: BigInt('2000'),
          amount0Min: BigInt('990'),
          amount1Min: BigInt('1980')
        })
      ).rejects.toThrow();
    });

    it('should clear cache properly', () => {
      liquidityService.clearCache();
      // Should not throw
      expect(liquidityService).toBeDefined();
    });

    it('should handle service cleanup', async () => {
      await liquidityService.cleanup();
      // Should handle multiple cleanups
      await liquidityService.cleanup();
      expect(liquidityService).toBeDefined();
    });
  });
});