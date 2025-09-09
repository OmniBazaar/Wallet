/**
 * SwapService Tests
 * 
 * Comprehensive test suite for SwapService including multi-hop swaps,
 * route finding, price impact calculation, and permit signing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwapService } from '../../src/services/SwapService';
import { OmniProvider } from '../../src/core/providers/OmniProvider';
import { ethers } from 'ethers';
import { DEXService } from '../../../../Validator/src/services/DEXService';
import { DecentralizedOrderBook } from '../../../../Validator/src/services/dex/DecentralizedOrderBook';
import { SwapCalculator } from '../../../../Validator/src/services/dex/amm/SwapCalculator';
import { HybridRouter } from '../../../../Validator/src/services/dex/amm/HybridRouter';

// Mock the Validator module imports
vi.mock('../../../../Validator/src/services/DEXService');
vi.mock('../../../../Validator/src/services/dex/DecentralizedOrderBook');
vi.mock('../../../../Validator/src/services/dex/amm/SwapCalculator');
vi.mock('../../../../Validator/src/services/dex/amm/HybridRouter');

describe('SwapService', () => {
  let swapService: SwapService;
  let mockProvider: OmniProvider;
  let mockSigner: ethers.Signer;

  beforeEach(async () => {
    // Create mock provider
    mockProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1n }),
      getSigner: vi.fn().mockResolvedValue(mockSigner),
    } as unknown as OmniProvider;

    // Create mock signer
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      _signTypedData: vi.fn().mockResolvedValue('0x' + '0'.repeat(130)),
    } as unknown as ethers.Signer;

    // Create SwapService with mock provider
    swapService = new SwapService(mockProvider);
    await swapService.init();
  });

  afterEach(async () => {
    await swapService.cleanup();
    vi.clearAllMocks();
  });

  describe('executeMultiHopSwap', () => {
    it('should execute a multi-hop swap successfully', async () => {
      // Mock HybridRouter
      const mockHybridRouter = {
        init: vi.fn().mockResolvedValue(undefined),
        findOptimalRoute: vi.fn().mockResolvedValue({
          path: ['0xTokenA', '0xTokenB', '0xTokenC'],
          outputAmount: BigInt('1000000000000000000'), // 1 token
          estimatedGas: BigInt('200000'),
          protocol: 'UniswapV2'
        })
      };
      vi.mocked(HybridRouter).mockImplementation(() => mockHybridRouter as any);

      const params = {
        tokenPath: ['0xTokenA', '0xTokenB', '0xTokenC'],
        amountIn: BigInt('500000000000000000'), // 0.5 tokens
        amountOutMin: BigInt('900000000000000000'), // 0.9 tokens min
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippage: 100 // 1%
      };

      const result = await swapService.executeMultiHopSwap(params);

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.amountOut).toBe(BigInt('1000000000000000000'));
      expect(result.gasUsed).toBe(BigInt('200000'));
      expect(mockHybridRouter.init).toHaveBeenCalled();
      expect(mockHybridRouter.findOptimalRoute).toHaveBeenCalledWith(
        '0xTokenA',
        '0xTokenC',
        BigInt('500000000000000000'),
        ['0xTokenA', '0xTokenB', '0xTokenC']
      );
    });

    it('should fail if token path is too short', async () => {
      const params = {
        tokenPath: ['0xTokenA'], // Only one token
        amountIn: BigInt('500000000000000000'),
        amountOutMin: BigInt('900000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await swapService.executeMultiHopSwap(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token path must contain at least 2 tokens');
    });

    it('should fail if no route found with sufficient output', async () => {
      // Mock HybridRouter returning insufficient output
      const mockHybridRouter = {
        init: vi.fn().mockResolvedValue(undefined),
        findOptimalRoute: vi.fn().mockResolvedValue({
          path: ['0xTokenA', '0xTokenB'],
          outputAmount: BigInt('800000000000000000'), // 0.8 tokens (less than min)
          estimatedGas: BigInt('150000'),
          protocol: 'UniswapV2'
        })
      };
      vi.mocked(HybridRouter).mockImplementation(() => mockHybridRouter as any);

      const params = {
        tokenPath: ['0xTokenA', '0xTokenB'],
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('900000000000000000'), // 0.9 tokens min
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await swapService.executeMultiHopSwap(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No route found with sufficient output');
    });
  });

  describe('findBestRoute', () => {
    it('should find the best route through order book and AMM', async () => {
      // Mock services
      const mockDEXService = {
        init: vi.fn().mockResolvedValue(undefined)
      };
      const mockOrderBook = {
        init: vi.fn().mockResolvedValue(undefined),
        getOrdersForPair: vi.fn().mockResolvedValue([])
      };
      const mockHybridRouter = {
        init: vi.fn().mockResolvedValue(undefined),
        findOptimalRoute: vi.fn().mockResolvedValue({
          path: ['0xTokenA', '0xTokenB'],
          outputAmount: BigInt('2000000000000000000'), // 2 tokens
          estimatedGas: BigInt('150000'),
          protocol: 'UniswapV3'
        })
      };

      vi.mocked(DEXService).mockImplementation(() => mockDEXService as any);
      vi.mocked(DecentralizedOrderBook).mockImplementation(() => mockOrderBook as any);
      vi.mocked(HybridRouter).mockImplementation(() => mockHybridRouter as any);

      // Mock SwapCalculator for price impact
      const mockSwapCalculator = {
        init: vi.fn().mockResolvedValue(undefined),
        calculateSwap: vi.fn().mockResolvedValue({
          outputAmount: BigInt('1000000000000000000'),
          priceImpact: 0.5
        })
      };
      vi.mocked(SwapCalculator).mockImplementation(() => mockSwapCalculator as any);

      const tokenIn = '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce'; // OMNI
      const tokenOut = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC
      const amountIn = BigInt('1000000000000000000'); // 1 OMNI

      const route = await swapService.findBestRoute(tokenIn, tokenOut, amountIn, 3);

      expect(route).toBeDefined();
      expect(route.tokenIn.symbol).toBe('OMNI');
      expect(route.tokenOut.symbol).toBe('USDC');
      expect(route.path).toEqual(['0xTokenA', '0xTokenB']);
      expect(route.amountOut).toBe(BigInt('2000000000000000000'));
      expect(route.priceImpact).toBeGreaterThanOrEqual(0);
      expect(route.priceImpact).toBeLessThanOrEqual(100);
      expect(route.gasEstimate).toBe(BigInt('150000'));
      expect(route.exchange).toBe('UniswapV3');
    });

    it('should throw error if no route found', async () => {
      // Mock services returning no route
      const mockDEXService = { init: vi.fn() };
      const mockOrderBook = { 
        init: vi.fn(),
        getOrdersForPair: vi.fn().mockResolvedValue([])
      };
      const mockHybridRouter = {
        init: vi.fn(),
        findOptimalRoute: vi.fn().mockResolvedValue(null)
      };

      vi.mocked(DEXService).mockImplementation(() => mockDEXService as any);
      vi.mocked(DecentralizedOrderBook).mockImplementation(() => mockOrderBook as any);
      vi.mocked(HybridRouter).mockImplementation(() => mockHybridRouter as any);

      const tokenIn = '0xTokenA';
      const tokenOut = '0xTokenB';
      const amountIn = BigInt('1000000000000000000');

      await expect(
        swapService.findBestRoute(tokenIn, tokenOut, amountIn)
      ).rejects.toThrow('No route found');
    });

    it('should throw error for unsupported tokens', async () => {
      // Mock services
      const mockDEXService = { init: vi.fn() };
      const mockOrderBook = { 
        init: vi.fn(),
        getOrdersForPair: vi.fn().mockResolvedValue([])
      };
      const mockHybridRouter = {
        init: vi.fn(),
        findOptimalRoute: vi.fn().mockResolvedValue({
          path: ['0xUnsupported1', '0xUnsupported2'],
          outputAmount: BigInt('1000000000000000000'),
          estimatedGas: BigInt('150000'),
          protocol: 'UniswapV2'
        })
      };

      vi.mocked(DEXService).mockImplementation(() => mockDEXService as any);
      vi.mocked(DecentralizedOrderBook).mockImplementation(() => mockOrderBook as any);
      vi.mocked(HybridRouter).mockImplementation(() => mockHybridRouter as any);

      const tokenIn = '0xUnsupported1';
      const tokenOut = '0xUnsupported2';
      const amountIn = BigInt('1000000000000000000');

      await expect(
        swapService.findBestRoute(tokenIn, tokenOut, amountIn)
      ).rejects.toThrow('Token not supported');
    });
  });

  describe('calculatePriceImpact', () => {
    it('should calculate price impact correctly', async () => {
      // Mock SwapCalculator
      const mockSwapCalculator = {
        init: vi.fn().mockResolvedValue(undefined),
        calculateSwap: vi.fn()
          .mockResolvedValueOnce({
            outputAmount: BigInt('100000000'), // Spot price: 100 USDC per 1 OMNI
            priceImpact: 0
          })
      };
      vi.mocked(SwapCalculator).mockImplementation(() => mockSwapCalculator as any);

      const tokenIn = '0xTokenA';
      const tokenOut = '0xTokenB';
      const amountIn = BigInt('10000000000000000000'); // 10 tokens
      const expectedAmountOut = BigInt('950000000'); // 950 USDC (5% less than spot)

      const priceImpact = await swapService.calculatePriceImpact(
        tokenIn,
        tokenOut,
        amountIn,
        expectedAmountOut
      );

      expect(priceImpact).toBeGreaterThan(0);
      expect(priceImpact).toBeLessThanOrEqual(100);
      expect(mockSwapCalculator.calculateSwap).toHaveBeenCalled();
    });

    it('should return 0 if spot price cannot be determined', async () => {
      // Mock SwapCalculator returning zero
      const mockSwapCalculator = {
        init: vi.fn().mockResolvedValue(undefined),
        calculateSwap: vi.fn().mockResolvedValue({
          outputAmount: BigInt('0'),
          priceImpact: 0
        })
      };
      vi.mocked(SwapCalculator).mockImplementation(() => mockSwapCalculator as any);

      const priceImpact = await swapService.calculatePriceImpact(
        '0xTokenA',
        '0xTokenB',
        BigInt('1000000000000000000'),
        BigInt('950000000')
      );

      expect(priceImpact).toBe(0);
    });

    it('should handle calculation errors gracefully', async () => {
      // Mock SwapCalculator throwing error
      const mockSwapCalculator = {
        init: vi.fn().mockResolvedValue(undefined),
        calculateSwap: vi.fn().mockRejectedValue(new Error('Network error'))
      };
      vi.mocked(SwapCalculator).mockImplementation(() => mockSwapCalculator as any);

      const priceImpact = await swapService.calculatePriceImpact(
        '0xTokenA',
        '0xTokenB',
        BigInt('1000000000000000000'),
        BigInt('950000000')
      );

      expect(priceImpact).toBe(0); // Returns 0 on error
    });
  });

  describe('signPermit', () => {
    it('should generate EIP-2612 permit signature', async () => {
      const tokenAddress = '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce';
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
      const amount = BigInt('1000000000000000000');
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const permit = await swapService.signPermit(
        tokenAddress,
        spender,
        amount,
        deadline
      );

      expect(permit).toBeDefined();
      expect(permit.v).toBeDefined();
      expect(permit.r).toBeDefined();
      expect(permit.s).toBeDefined();
      expect(permit.deadline).toBe(deadline);
      expect(permit.nonce).toBeDefined();
      expect(mockSigner._signTypedData).toHaveBeenCalled();
    });

    it('should use default deadline if not provided', async () => {
      const tokenAddress = '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce';
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
      const amount = BigInt('1000000000000000000');

      const permit = await swapService.signPermit(tokenAddress, spender, amount);

      expect(permit.deadline).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(permit.deadline).toBeLessThanOrEqual(
        Math.floor(Date.now() / 1000) + 1200 // Default 20 minutes
      );
    });

    it('should use provided nonce', async () => {
      const tokenAddress = '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce';
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
      const amount = BigInt('1000000000000000000');
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = 42;

      const permit = await swapService.signPermit(
        tokenAddress,
        spender,
        amount,
        deadline,
        nonce
      );

      expect(permit.nonce).toBe(nonce);
    });

    it('should throw error if no signer available', async () => {
      // Create service with no provider/wallet
      const serviceNoSigner = new SwapService({} as OmniProvider);
      await serviceNoSigner.init();

      await expect(
        serviceNoSigner.signPermit(
          '0xTokenA',
          '0xSpender',
          BigInt('1000000000000000000')
        )
      ).rejects.toThrow('No signer available');

      await serviceNoSigner.cleanup();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle uninitialized service', async () => {
      const uninitializedService = new SwapService(mockProvider);

      await expect(
        uninitializedService.executeMultiHopSwap({
          tokenPath: ['0xA', '0xB'],
          amountIn: BigInt('1000'),
          amountOutMin: BigInt('900'),
          recipient: '0x123'
        })
      ).rejects.toThrow('Swap service not initialized');

      await expect(
        uninitializedService.findBestRoute('0xA', '0xB', BigInt('1000'))
      ).rejects.toThrow('Swap service not initialized');

      await expect(
        uninitializedService.calculatePriceImpact('0xA', '0xB', BigInt('1000'), BigInt('900'))
      ).rejects.toThrow('Swap service not initialized');

      await expect(
        uninitializedService.signPermit('0xA', '0xB', BigInt('1000'))
      ).rejects.toThrow('Swap service not initialized');
    });

    it('should handle provider errors gracefully', async () => {
      // Mock provider throwing error
      mockProvider.getNetwork = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await swapService.executeMultiHopSwap({
        tokenPath: ['0xA', '0xB'],
        amountIn: BigInt('1000'),
        amountOutMin: BigInt('900'),
        recipient: '0x123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});