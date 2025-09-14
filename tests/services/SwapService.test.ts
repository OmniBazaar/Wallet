/**
 * SwapService Tests
 *
 * Comprehensive test suite for SwapService including multi-hop swaps,
 * route finding, price impact calculation, and permit signing.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SwapService } from '../../src/services/SwapService';
import { OmniProvider } from '../../src/core/providers/OmniProvider';
import { ethers } from 'ethers';

describe('SwapService', () => {
  let swapService: SwapService;
  let mockProvider: OmniProvider;
  let mockSigner: ethers.Signer;

  beforeEach(async () => {
    // Create mock signer
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      signTypedData: jest.fn().mockResolvedValue('0x' + '0'.repeat(130)),
    } as unknown as ethers.Signer;

    // Create mock provider
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }),
      getSigner: jest.fn().mockResolvedValue(mockSigner),
    } as unknown as OmniProvider;

    // Create SwapService with mock provider
    swapService = new SwapService(mockProvider);
    await swapService.init();
  });

  afterEach(async () => {
    await swapService.cleanup();
    jest.clearAllMocks();
  });

  describe('executeMultiHopSwap', () => {
    it('should execute a multi-hop swap successfully', async () => {
      const params = {
        tokenPath: ['0xTokenA', '0xTokenB', '0xTokenC'],
        amountIn: BigInt('1000000000000000000'), // 1 token
        amountOutMin: BigInt('900000000000000000'), // 0.9 tokens min (10% slippage)
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippage: 1000 // 10%
      };

      const result = await swapService.executeMultiHopSwap(params);

      // With two hops and 0.3% fee per hop, output should be ~0.994 tokens
      // which is more than the 0.9 minimum
      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(result.amountOut).toBeDefined();
      expect(result.hops).toBe(2); // Two hops for 3 tokens
      if (result.hopDetails) {
        expect(result.hopDetails.length).toBe(2); // Two hop details
      }
    });

    it('should fail if token path is too short', async () => {
      const params = {
        tokenPath: ['0xTokenA'], // Only one token
        amountIn: BigInt('500000000000000000'),
        amountOutMin: BigInt('900000000000000000'),
        recipient: '0x1234567890123456789012345678901234567890'
      };

      // This should throw an error
      await expect(
        swapService.executeMultiHopSwap(params)
      ).rejects.toThrow('Token path must contain at least 2 tokens');
    });

    it('should fail if no route found with sufficient output', async () => {
      const params = {
        tokenPath: ['0xTokenA', '0xTokenB'],
        amountIn: BigInt('1000000000000000000'), // 1 token
        amountOutMin: BigInt('999000000000000000'), // 0.999 tokens min (0.1% slippage - too tight)
        recipient: '0x1234567890123456789012345678901234567890'
      };

      const result = await swapService.executeMultiHopSwap(params);

      expect(result.success).toBe(false);
      // With 0.3% fee, output will be 0.997, which is less than 0.999 min
      expect(result.error).toContain('Insufficient output amount after slippage');
    });
  });

  describe('findBestRoute', () => {
    it('should find the best route through order book and AMM', async () => {
      const tokenIn = '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce'; // OMNI
      const tokenOut = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC
      const amountIn = BigInt('1000000000000000000'); // 1 OMNI

      const route = await swapService.findBestRoute(tokenIn, tokenOut, amountIn, 3);

      expect(route).toBeDefined();
      expect(route.tokenIn.symbol).toBe('OMNI');
      expect(route.tokenOut.symbol).toBe('USDC');
      expect(route.path).toEqual([tokenIn, tokenOut]);
      expect(route.amountOut).toBeDefined();
      expect(route.priceImpact).toBeGreaterThanOrEqual(0);
      expect(route.priceImpact).toBeLessThanOrEqual(100);
      expect(route.gasEstimate).toBeDefined();
      expect(route.exchange).toBeDefined();
    });

    it('should throw error if no route found', async () => {
      const tokenIn = '0xInvalidTokenA';
      const tokenOut = '0xInvalidTokenB';
      const amountIn = BigInt('1000000000000000000');

      await expect(
        swapService.findBestRoute(tokenIn, tokenOut, amountIn)
      ).rejects.toThrow('Token not supported');
    });

    it('should throw error for unsupported tokens', async () => {
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

      expect(priceImpact).toBeGreaterThanOrEqual(0);
      expect(priceImpact).toBeLessThanOrEqual(100);
    });

    it('should return 0 if spot price cannot be determined', async () => {
      // Use the new object-based API
      const priceImpact = await swapService.calculatePriceImpact({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('0') // Zero input should result in 0 impact
      });

      // With the new API, it returns an object
      if (typeof priceImpact === 'object') {
        expect(priceImpact.percentage).toBe(0);
      } else {
        expect(priceImpact).toBe(0);
      }
    });

    it('should handle calculation errors gracefully', async () => {
      // The service should handle calculation errors gracefully
      const priceImpact = await swapService.calculatePriceImpact(
        '0xTokenA',
        '0xTokenB',
        BigInt('1000000000000000000'),
        BigInt('950000000')
      );

      // Should return a valid number between 0-100
      expect(priceImpact).toBeGreaterThanOrEqual(0);
      expect(priceImpact).toBeLessThanOrEqual(100);
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
      expect(mockSigner.signTypedData).toHaveBeenCalled();
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
      mockProvider.getNetwork = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await swapService.executeMultiHopSwap({
        tokenPath: ['0xA', '0xB'],
        amountIn: BigInt('1000'),
        amountOutMin: BigInt('900'),
        recipient: '0x123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});