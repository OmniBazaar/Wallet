/**
 * LiquidityService Tests
 * 
 * Comprehensive test suite for LiquidityService including add/remove liquidity,
 * position management, impermanent loss calculations, and pool analytics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiquidityService } from '../../src/services/LiquidityService';
import { WalletService } from '../../src/services/WalletService';
import { OmniProvider } from '../../src/core/providers/OmniProvider';
import { ethers } from 'ethers';
import { LiquidityPoolManager } from '../../../../Validator/src/services/dex/amm/LiquidityPoolManager';
import { AMMIntegration } from '../../../../Validator/src/services/dex/amm/AMMIntegration';

// Mock the Validator module imports
vi.mock('../../../../Validator/src/services/dex/amm/LiquidityPoolManager');
vi.mock('../../../../Validator/src/services/dex/amm/AMMIntegration');

describe('LiquidityService', () => {
  let liquidityService: LiquidityService;
  let mockWalletService: WalletService;
  let mockProvider: OmniProvider;
  let mockPoolManager: any;
  let mockAMMIntegration: any;

  beforeEach(async () => {
    // Create mock wallet service
    mockWalletService = {
      isServiceInitialized: vi.fn().mockReturnValue(true),
      init: vi.fn().mockResolvedValue(undefined),
      getChainId: vi.fn().mockResolvedValue(1),
      getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      getWallet: vi.fn().mockReturnValue({
        getTokenBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
        approveToken: vi.fn().mockResolvedValue(true)
      })
    } as unknown as WalletService;

    // Create mock pool manager
    mockPoolManager = {
      init: vi.fn().mockResolvedValue(undefined),
      addLiquidityV3: vi.fn().mockResolvedValue({
        transactionHash: '0x' + '1'.repeat(64),
        tokenId: BigInt(123),
        amount0: BigInt('1000000000000000000'),
        amount1: BigInt('2000000000000000000')
      }),
      removeLiquidityV3: vi.fn().mockResolvedValue({
        transactionHash: '0x' + '2'.repeat(64),
        amount0: BigInt('900000000000000000'),
        amount1: BigInt('1800000000000000000')
      }),
      getPositionInfo: vi.fn().mockResolvedValue({
        pool: '0xPoolAddress',
        token0: '0xTokenA',
        token1: '0xTokenB',
        tickLower: -887220,
        tickUpper: 887220,
        liquidity: BigInt('1000000000000000000'),
        amount0: BigInt('1000000000000000000'),
        amount1: BigInt('2000000000000000000'),
        tokensOwed0: BigInt('10000000000000000'), // 0.01 token
        tokensOwed1: BigInt('20000000000000000')  // 0.02 token
      }),
      collectFees: vi.fn().mockResolvedValue({
        transactionHash: '0x' + '3'.repeat(64),
        amount0: BigInt('10000000000000000'),
        amount1: BigInt('20000000000000000')
      }),
      getUserPositions: vi.fn().mockResolvedValue([
        { tokenId: BigInt(123) },
        { tokenId: BigInt(456) }
      ])
    };

    // Create mock AMM integration
    mockAMMIntegration = {
      init: vi.fn().mockResolvedValue(undefined),
      addLiquidity: vi.fn().mockResolvedValue({
        transactionHash: '0x' + '4'.repeat(64),
        amountA: BigInt('1000000000000000000'),
        amountB: BigInt('2000000000000000000')
      }),
      removeLiquidity: vi.fn().mockResolvedValue({
        transactionHash: '0x' + '5'.repeat(64),
        amountA: BigInt('900000000000000000'),
        amountB: BigInt('1800000000000000000')
      }),
      getPoolInfo: vi.fn().mockResolvedValue({
        token0: '0xTokenA',
        token1: '0xTokenB',
        reserve0: BigInt('10000000000000000000000'), // 10000 tokens
        reserve1: BigInt('20000000000000000000000'), // 20000 tokens
        totalSupply: BigInt('14142135623730950488'), // sqrt(10000 * 20000)
        tick: 0
      }),
      getPoolHistoricalData: vi.fn().mockResolvedValue({
        volume24h: 1000000,
        volume7d: 7000000
      })
    };

    vi.mocked(LiquidityPoolManager).mockImplementation(() => mockPoolManager);
    vi.mocked(AMMIntegration).mockImplementation(() => mockAMMIntegration);

    // Create LiquidityService with mock wallet service
    liquidityService = new LiquidityService(mockWalletService);
    await liquidityService.init();
  });

  afterEach(async () => {
    await liquidityService.cleanup();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with wallet service', async () => {
      const service = new LiquidityService(mockWalletService);
      await expect(service.init()).resolves.not.toThrow();
      await service.cleanup();
    });

    it('should initialize successfully with provider', async () => {
      mockProvider = {
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1n }),
        getSigner: vi.fn().mockResolvedValue({
          getAddress: vi.fn().mockResolvedValue('0x9876543210987654321098765432109876543210')
        })
      } as unknown as OmniProvider;

      const service = new LiquidityService(mockProvider);
      await expect(service.init()).resolves.not.toThrow();
      await service.cleanup();
    });

    it('should handle multiple initialization calls', async () => {
      const service = new LiquidityService(mockWalletService);
      await service.init();
      await service.init(); // Should not throw
      await service.cleanup();
    });
  });

  describe('addLiquidity', () => {
    it('should add liquidity to V3 pool successfully', async () => {
      const params = {
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0Desired: BigInt('1000000000000000000'),
        amount1Desired: BigInt('2000000000000000000'),
        amount0Min: BigInt('950000000000000000'),
        amount1Min: BigInt('1900000000000000000'),
        priceLower: 0.5,
        priceUpper: 2.0,
        feeTier: 3000,
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x1+$/);
      expect(result.positionId).toBe('123');
      expect(result.amount0).toBe(BigInt('1000000000000000000'));
      expect(result.amount1).toBe(BigInt('2000000000000000000'));
      expect(mockPoolManager.addLiquidityV3).toHaveBeenCalledWith(
        expect.objectContaining({
          token0: params.token0,
          token1: params.token1,
          fee: params.feeTier,
          amount0Desired: params.amount0Desired,
          amount1Desired: params.amount1Desired
        })
      );
    });

    it('should add liquidity to V2 pool successfully', async () => {
      const params = {
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0Desired: BigInt('1000000000000000000'),
        amount1Desired: BigInt('2000000000000000000'),
        amount0Min: BigInt('950000000000000000'),
        amount1Min: BigInt('1900000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x4+$/);
      expect(result.amount0).toBe(BigInt('1000000000000000000'));
      expect(result.amount1).toBe(BigInt('2000000000000000000'));
      expect(mockAMMIntegration.addLiquidity).toHaveBeenCalledWith(
        params.token0,
        params.token1,
        params.amount0Desired,
        params.amount1Desired,
        params.amount0Min,
        params.amount1Min,
        params.recipient,
        expect.any(Number)
      );
    });

    it('should fail when adding zero liquidity', async () => {
      const params = {
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0Desired: BigInt(0),
        amount1Desired: BigInt(0),
        amount0Min: BigInt(0),
        amount1Min: BigInt(0),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot add zero liquidity');
    });

    it('should handle initialization errors', async () => {
      const uninitializedService = new LiquidityService(mockWalletService);
      
      const params = {
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0Desired: BigInt('1000000000000000000'),
        amount1Desired: BigInt('2000000000000000000'),
        amount0Min: BigInt('950000000000000000'),
        amount1Min: BigInt('1900000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await uninitializedService.addLiquidity(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });
  });

  describe('removeLiquidity', () => {
    it('should remove liquidity from V3 position successfully', async () => {
      const params = {
        positionId: '123',
        liquidityPercentage: 50,
        amount0Min: BigInt('450000000000000000'),
        amount1Min: BigInt('900000000000000000')
      };

      const result = await liquidityService.removeLiquidity(params);

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x2+$/);
      expect(result.amount0).toBe(BigInt('900000000000000000'));
      expect(result.amount1).toBe(BigInt('1800000000000000000'));
      expect(mockPoolManager.removeLiquidityV3).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: BigInt(123),
          liquidity: BigInt('500000000000000000'), // 50% of 1e18
          amount0Min: params.amount0Min,
          amount1Min: params.amount1Min
        })
      );
    });

    it('should remove liquidity from V2 position successfully', async () => {
      // Mock V2 position (no ticks)
      mockPoolManager.getPositionInfo.mockResolvedValueOnce(null);
      
      const params = {
        positionId: '0xLPTokenAddress',
        liquidityPercentage: 25,
        amount0Min: BigInt('225000000000000000'),
        amount1Min: BigInt('450000000000000000')
      };

      const result = await liquidityService.removeLiquidity(params);

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x5+$/);
      expect(result.amount0).toBe(BigInt('900000000000000000'));
      expect(result.amount1).toBe(BigInt('1800000000000000000'));
    });

    it('should fail with invalid percentage', async () => {
      const params = {
        positionId: '123',
        liquidityPercentage: 150, // Invalid
        amount0Min: BigInt('450000000000000000'),
        amount1Min: BigInt('900000000000000000')
      };

      const result = await liquidityService.removeLiquidity(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('between 0 and 100');
    });

    it('should fail when position not found', async () => {
      mockPoolManager.getPositionInfo.mockResolvedValueOnce(null);
      mockAMMIntegration.getPoolInfo.mockResolvedValueOnce(null);
      
      const params = {
        positionId: '999',
        liquidityPercentage: 50,
        amount0Min: BigInt('450000000000000000'),
        amount1Min: BigInt('900000000000000000')
      };

      const result = await liquidityService.removeLiquidity(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position not found');
    });
  });

  describe('getPosition', () => {
    it('should get V3 position details', async () => {
      const position = await liquidityService.getPosition('123');

      expect(position).toBeDefined();
      expect(position?.positionId).toBe('123');
      expect(position?.token0).toBe('0xTokenA');
      expect(position?.token1).toBe('0xTokenB');
      expect(position?.tickLower).toBe(-887220);
      expect(position?.tickUpper).toBe(887220);
      expect(position?.fees0).toBe(BigInt('10000000000000000'));
      expect(position?.fees1).toBe(BigInt('20000000000000000'));
    });

    it('should get V2 position details', async () => {
      // Mock V3 position not found
      mockPoolManager.getPositionInfo.mockRejectedValueOnce(new Error('Not found'));
      
      const position = await liquidityService.getPosition('0xLPTokenAddress');

      expect(position).toBeDefined();
      expect(position?.positionId).toBe('0xLPTokenAddress');
      expect(position?.token0).toBe('0xTokenA');
      expect(position?.token1).toBe('0xTokenB');
      expect(position?.liquidity).toBe(BigInt(0)); // Mocked as 0
    });

    it('should return null for non-existent position', async () => {
      mockPoolManager.getPositionInfo.mockResolvedValueOnce(null);
      mockAMMIntegration.getPoolInfo.mockResolvedValueOnce(null);

      const position = await liquidityService.getPosition('999');

      expect(position).toBeNull();
    });
  });

  describe('calculateImpermanentLoss', () => {
    it('should calculate impermanent loss correctly', async () => {
      const initialPrices = {
        price0: 1,
        price1: 2000
      };

      const ilData = await liquidityService.calculateImpermanentLoss('123', initialPrices);

      expect(ilData).toBeDefined();
      expect(ilData.currentIL).toBeGreaterThanOrEqual(0);
      expect(ilData.initialAmount0).toBe(BigInt('1000000000000000000'));
      expect(ilData.initialAmount1).toBe(BigInt('2000000000000000000'));
      expect(ilData.feesEarned).toBeGreaterThan(0);
      expect(ilData.currentValue).toBeDefined();
      expect(ilData.holdValue).toBeDefined();
      expect(ilData.netGainLoss).toBeDefined();
    });

    it('should handle position not found', async () => {
      mockPoolManager.getPositionInfo.mockResolvedValueOnce(null);
      mockAMMIntegration.getPoolInfo.mockResolvedValueOnce(null);

      await expect(
        liquidityService.calculateImpermanentLoss('999', { price0: 1, price1: 2000 })
      ).rejects.toThrow('Position not found');
    });
  });

  describe('harvestRewards', () => {
    it('should harvest rewards from V3 positions', async () => {
      const result = await liquidityService.harvestRewards(['123', '456']);

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x3+$/);
      expect(result.amount0).toBe(BigInt('10000000000000000'));
      expect(result.amount1).toBe(BigInt('20000000000000000'));
      expect(mockPoolManager.collectFees).toHaveBeenCalledTimes(2);
    });

    it('should skip positions with no fees', async () => {
      // Mock position with no fees
      mockPoolManager.getPositionInfo.mockResolvedValueOnce({
        ...mockPoolManager.getPositionInfo.mock.results[0].value,
        tokensOwed0: BigInt(0),
        tokensOwed1: BigInt(0)
      });

      const result = await liquidityService.harvestRewards(['123']);

      expect(result.success).toBe(true);
      expect(result.amount0).toBe(BigInt(0));
      expect(result.amount1).toBe(BigInt(0));
      expect(mockPoolManager.collectFees).not.toHaveBeenCalled();
    });

    it('should return success with zero amounts for empty array', async () => {
      const result = await liquidityService.harvestRewards([]);

      expect(result.success).toBe(true);
      expect(result.amount0).toBe(BigInt(0));
      expect(result.amount1).toBe(BigInt(0));
    });
  });

  describe('getPoolAnalytics', () => {
    it('should get pool analytics with correct calculations', async () => {
      const analytics = await liquidityService.getPoolAnalytics('0xPoolAddress');

      expect(analytics).toBeDefined();
      expect(analytics.poolAddress).toBe('0xPoolAddress');
      expect(analytics.price0).toBe(2); // reserve1/reserve0 = 20000/10000
      expect(analytics.price1).toBe(0.5); // reserve0/reserve1
      expect(analytics.volume24hUSD).toBe(1000000);
      expect(analytics.volume7dUSD).toBe(7000000);
      expect(analytics.fees24hUSD).toBe(3000); // 0.3% of volume
      expect(analytics.apy).toBeGreaterThan(0);
      expect(analytics.tvlUSD).toBeGreaterThan(0);
    });

    it('should handle pool not found', async () => {
      mockAMMIntegration.getPoolInfo.mockResolvedValueOnce(null);

      await expect(
        liquidityService.getPoolAnalytics('0xInvalidPool')
      ).rejects.toThrow('Pool not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      mockWalletService.getChainId.mockRejectedValueOnce(new Error('Network error'));

      const params = {
        token0: '0xTokenA',
        token1: '0xTokenB',
        amount0Desired: BigInt('1000000000000000000'),
        amount1Desired: BigInt('2000000000000000000'),
        amount0Min: BigInt('950000000000000000'),
        amount1Min: BigInt('1900000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await liquidityService.addLiquidity(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle uninitialized service errors', async () => {
      const uninitializedService = new LiquidityService(mockWalletService);

      await expect(
        uninitializedService.getPosition('123')
      ).rejects.toThrow('not initialized');

      await expect(
        uninitializedService.calculateImpermanentLoss('123', { price0: 1, price1: 2000 })
      ).rejects.toThrow('not initialized');

      const harvestResult = await uninitializedService.harvestRewards(['123']);
      expect(harvestResult.success).toBe(false);
      expect(harvestResult.error).toContain('not initialized');

      await expect(
        uninitializedService.getPoolAnalytics('0xPool')
      ).rejects.toThrow('not initialized');
    });

    it('should handle cleanup gracefully', async () => {
      await expect(liquidityService.cleanup()).resolves.not.toThrow();
      
      // Should be able to cleanup multiple times
      await expect(liquidityService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getUserPositions', () => {
    it('should get all user positions', async () => {
      const positions = await liquidityService.getUserPositions();

      expect(positions).toHaveLength(2);
      expect(mockPoolManager.getUserPositions).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890'
      );
    });

    it('should get positions for specific address', async () => {
      const address = '0x9876543210987654321098765432109876543210';
      await liquidityService.getUserPositions(address);

      expect(mockPoolManager.getUserPositions).toHaveBeenCalledWith(address);
    });

    it('should handle errors gracefully', async () => {
      mockPoolManager.getUserPositions.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        liquidityService.getUserPositions()
      ).rejects.toThrow('Network error');
    });
  });
});