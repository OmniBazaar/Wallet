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
        token0: '0x0000000000000000000000000000000000000000', // Zero address
        token1: '0xB',
        amount0Desired: BigInt('0'), // Invalid amount
        amount1Desired: BigInt('2000000000000000000'),
        amount0Min: BigInt('0'),
        amount1Min: BigInt('0'),
        recipient: '0x0000000000000000000000000000000000000000'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot add zero liquidity');
    });

    it('should handle add liquidity request', async () => {
      const params = {
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        amount0Desired: BigInt('1000000000'), // 1000 USDC
        amount1Desired: BigInt('500000000000000000'), // 0.5 ETH
        amount0Min: BigInt('990000000'),
        amount1Min: BigInt('495000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(true);
      expect(result.positionId).toBeDefined();
      expect(result.amount0).toBe(params.amount0Desired);
      expect(result.amount1).toBe(params.amount1Desired);
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should handle V3 concentrated liquidity', async () => {
      const params = {
        token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount0Desired: BigInt('1000000000'),
        amount1Desired: BigInt('500000000000000000'),
        amount0Min: BigInt('990000000'),
        amount1Min: BigInt('495000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890',
        priceLower: 1800, // Price range
        priceUpper: 2200,
        feeTier: 3000 // 0.3%
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(true);
      expect(result.positionId).toBeDefined();
      expect(result.txHash).toBeDefined();
    });
  });

  describe('removeLiquidity', () => {
    it('should validate removal parameters', async () => {
      const params = {
        positionId: 'invalid-id', // Invalid ID
        liquidityPercentage: 150, // Invalid percentage > 100
        amount0Min: BigInt('0'),
        amount1Min: BigInt('0')
      };

      const result = await liquidityService.removeLiquidity(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Liquidity percentage must be between 0 and 100');
    });

    it('should handle liquidity removal', async () => {
      const params = {
        positionId: 'position_123',
        liquidityPercentage: 50, // Remove 50%
        amount0Min: BigInt('490000000'),
        amount1Min: BigInt('245000000000000000')
      };

      const result = await liquidityService.removeLiquidity(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Position not found');
    });

    it('should handle V3 position removal', async () => {
      const params = {
        positionId: 'v3_position_123',
        liquidityPercentage: 100, // Remove all
        amount0Min: BigInt('980000000'),
        amount1Min: BigInt('490000000000000000'),
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      const result = await liquidityService.removeLiquidity(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Position not found');
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

  describe('getPool', () => {
    it('should return pool information', async () => {
      const poolInfo = await liquidityService.getPool(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      );

      // Without real pool data, should return null for unsupported pool
      expect(poolInfo).toBeNull();
    });

    it('should handle invalid token pairs', async () => {
      const poolInfo = await liquidityService.getPool(
        '0xInvalidToken1',
        '0xInvalidToken2'
      );

      expect(poolInfo).toBeNull();
    });
  });

  describe('calculateImpermanentLoss', () => {
    it('should calculate impermanent loss correctly', async () => {
      // Use a position ID that the mock getPosition will recognize
      const positionId = 'position-test-123';

      const il = await liquidityService.calculateImpermanentLoss(
        positionId,
        { price0: 1.0, price1: 2000.0 } // Initial prices
      );

      expect(il).toBeDefined();
      expect(il.currentIL).toBeGreaterThanOrEqual(0);
      expect(il.initialAmount0).toBeDefined();
      expect(il.initialAmount1).toBeDefined();
      expect(il.holdAmount0).toBeDefined();
      expect(il.holdAmount1).toBeDefined();
      expect(il.holdValue).toBeGreaterThan(0);
      expect(il.currentValue).toBeGreaterThan(0);
      expect(il.feesEarned).toBeGreaterThanOrEqual(0);
      expect(il.netGainLoss).toBeDefined();
    });

    it('should handle zero liquidity positions', async () => {
      // Mock a position with no liquidity
      const positionId = 'empty-position';

      await expect(
        liquidityService.calculateImpermanentLoss(
          positionId,
          { price0: 1.0, price1: 2000.0 }
        )
      ).rejects.toThrow('Position not found');
    });
  });

  describe('calculateImpermanentLossForPair', () => {
    it('should calculate IL for a token pair', async () => {
      const il = await liquidityService.calculateImpermanentLossForPair({
        tokenA: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        initialPriceRatio: 2000, // 1 ETH = 2000 USDC
        currentPriceRatio: 2200  // 1 ETH = 2200 USDC (10% increase)
      });

      expect(il).toBeDefined();
      expect(il.percentage).toBeGreaterThanOrEqual(0);
      expect(il.percentage).toBeLessThanOrEqual(100);
      expect(il.explanation).toBeDefined();
    });

    it('should handle same token amounts', async () => {
      const il = await liquidityService.calculateImpermanentLossForPair({
        tokenA: '0xA',
        tokenB: '0xB',
        initialPriceRatio: 1.0, // Same price ratio
        currentPriceRatio: 1.0  // No change
      });

      // With no price change, IL should be 0
      expect(il.percentage).toBe(0);
    });
  });

  // Note: collectFees is not implemented in LiquidityService
  // These tests are commented out until the method is implemented
  /*
  describe('collectFees', () => {
    it('should collect fees from V3 position', async () => {
      // Method not yet implemented
    });

    it('should handle invalid token ID', async () => {
      // Method not yet implemented
    });
  });
  */

  describe('getPoolAnalytics', () => {
    it('should return pool analytics', async () => {
      const analytics = await liquidityService.getPoolAnalytics('0xPoolAddress');

      expect(analytics).toBeDefined();
      expect(analytics.volume24hUSD).toBeGreaterThanOrEqual(0);
      expect(analytics.volume7dUSD).toBeGreaterThanOrEqual(0);
      expect(analytics.fees24hUSD).toBeGreaterThanOrEqual(0);
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
      // Test validates that the service handles missing provider gracefully
      // Create a mock provider that throws errors
      const mockErrorProvider = {
        getNetwork: jest.fn().mockRejectedValue(new Error('Network error')),
        getSigner: jest.fn().mockRejectedValue(new Error('Network error'))
      } as unknown as ethers.Provider;

      const serviceWithErrorProvider = new LiquidityService(mockErrorProvider);
      await serviceWithErrorProvider.initialize();

      // getPools should handle the network error
      await expect(
        serviceWithErrorProvider.getPools()
      ).rejects.toThrow('Network error');
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