/**
 * Payment Routing Type Safety Tests
 * Tests TypeScript strict mode compliance and null safety fixes
 */

import { paymentRouter, PaymentRoute, TokenInfo } from '../../../src/core/payments/routing';
import { bridgeService } from '../../../src/core/bridge';
import { providerManager } from '../../../src/core/providers/ProviderManager';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { TEST_ADDRESSES, TEST_PASSWORD, MOCK_TOKENS, cleanupTest } from '../../setup';
import { ethers, isAddress, ZeroAddress } from 'ethers';

// Mock dependencies
jest.mock('../../../src/core/bridge');
jest.mock('../../../src/core/providers/ProviderManager');
jest.mock('../../../src/core/keyring/KeyringService');

describe('Payment Routing Type Safety', () => {
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock keyring service
    (keyringService.createWallet as jest.Mock).mockResolvedValue(true);
    (keyringService.getActiveAccount as jest.Mock).mockReturnValue({
      address: TEST_ADDRESSES.ethereum,
      type: 'ethereum'
    });

    // Mock provider manager
    (providerManager.getProvider as jest.Mock).mockReturnValue({
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'), // 1 ETH
      sendTransaction: jest.fn().mockResolvedValue('0x' + '1'.repeat(64))
    });
    (providerManager.switchEVMNetwork as jest.Mock).mockResolvedValue(undefined);
    (providerManager.setActiveChain as jest.Mock).mockResolvedValue(undefined);

    // Mock bridge service
    (bridgeService.getQuotes as jest.Mock).mockResolvedValue({
      routes: [],
      bestRoute: null
    });
    (bridgeService.executeBridge as jest.Mock).mockResolvedValue('bridge-tx-id');
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Null Safety and Undefined Handling', () => {
    it('should handle null payment requests gracefully', async () => {
      const nullRequest: any = null;
      
      const route = await paymentRouter.findBestRoute(nullRequest);
      
      expect(route).toBeNull();
    });

    it('should handle undefined payment request fields', async () => {
      const incompleteRequest = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        // Missing amount, token, etc.
      };
      
      const route = await paymentRouter.findBestRoute(incompleteRequest as any);
      
      // Should not throw, may return null or a route with defaults
      expect(route).toBeDefined();
    });

    it('should handle null arrays in request safely', async () => {
      const requestWithNulls = {
        from: [TEST_ADDRESSES.ethereum, null as any, undefined as any].filter(Boolean),
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum'
      };
      
      const route = await paymentRouter.findBestRoute(requestWithNulls);
      
      expect(route).toBeDefined();
    });

    it('should validate addresses before processing', async () => {
      const invalidRequest = {
        from: ['invalid-address', '', null].filter(Boolean),
        to: 'invalid-to-address',
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum'
      };
      
      const route = await paymentRouter.findBestRoute(invalidRequest as any);
      
      expect(route).toBeNull();
    });
  });

  describe('TokenInfo Type Safety', () => {
    it('should handle missing token properties', () => {
      const incompleteToken: Partial<TokenInfo> = {
        address: MOCK_TOKENS.ethereum.USDC.address,
        symbol: 'USDC'
        // Missing name, decimals, chainId
      };
      
      // Type system should enforce complete TokenInfo
      const completeToken: TokenInfo = {
        address: incompleteToken.address ?? ZeroAddress,
        symbol: incompleteToken.symbol ?? 'UNKNOWN',
        name: incompleteToken.name ?? 'Unknown Token',
        decimals: incompleteToken.decimals ?? 18,
        chainId: incompleteToken.chainId ?? 1
      };
      
      expect(completeToken.address).toBe(MOCK_TOKENS.ethereum.USDC.address);
      expect(completeToken.symbol).toBe('USDC');
      expect(completeToken.name).toBe('Unknown Token');
      expect(completeToken.decimals).toBe(18);
      expect(completeToken.chainId).toBe(1);
    });

    it('should handle zero address safely', () => {
      const nativeToken: TokenInfo = {
        address: ZeroAddress,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        chainId: 1
      };
      
      expect(nativeToken.address).toBe('0x0000000000000000000000000000000000000000');
      expect(isAddress(nativeToken.address)).toBe(true);
    });
  });

  describe('PaymentRoute Type Safety', () => {
    it('should handle optional properties correctly', () => {
      const minimalRoute: PaymentRoute = {
        blockchain: 'ethereum',
        fromAddress: TEST_ADDRESSES.ethereum,
        fromToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        fromAmount: '1000000',
        fromDecimals: 6,
        toToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        toAmount: '1000000',
        toDecimals: 6,
        toAddress: TEST_ADDRESSES.ethereum,
        exchangeRoutes: [],
        steps: []
      };
      
      // Optional properties should be undefined, not null
      expect(minimalRoute.estimatedGas).toBeUndefined();
      expect(minimalRoute.estimatedFee).toBeUndefined();
      expect(minimalRoute.approvalRequired).toBeUndefined();
      
      // Arrays should be empty, not undefined
      expect(minimalRoute.exchangeRoutes).toEqual([]);
      expect(minimalRoute.steps).toEqual([]);
    });

    it('should handle route with all optional properties', () => {
      const fullRoute: PaymentRoute = {
        blockchain: 'ethereum',
        fromAddress: TEST_ADDRESSES.ethereum,
        fromToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        fromAmount: '1000000',
        fromDecimals: 6,
        toToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        toAmount: '990000',
        toDecimals: 6,
        toAddress: TEST_ADDRESSES.ethereum,
        exchangeRoutes: [{
          exchange: 'uniswap_v3',
          path: [MOCK_TOKENS.ethereum.USDC.address, MOCK_TOKENS.ethereum.USDT.address],
          expectedOutput: '990000',
          minimumOutput: '985000',
          priceImpact: 0.5
        }],
        estimatedGas: '150000',
        estimatedFee: '0.01',
        approvalRequired: true,
        steps: [{
          type: 'approve',
          description: 'Approve USDC spending'
        }, {
          type: 'swap',
          description: 'Swap USDC to USDT',
          data: {
            exchange: 'uniswap_v3',
            slippage: 0.5
          }
        }]
      };
      
      expect(fullRoute.estimatedGas).toBe('150000');
      expect(fullRoute.estimatedFee).toBe('0.01');
      expect(fullRoute.approvalRequired).toBe(true);
      expect(fullRoute.exchangeRoutes).toHaveLength(1);
      expect(fullRoute.steps).toHaveLength(2);
    });
  });

  describe('Array Access Safety', () => {
    it('should safely access array elements', async () => {
      const request = {
        from: [TEST_ADDRESSES.ethereum, TEST_ADDRESSES.polygon],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum'
      };
      
      const routes = await paymentRouter.findAllRoutes(request);
      
      // Safe array access - should not throw if empty
      const firstRoute = routes[0];
      const nonExistentRoute = routes[999];
      
      expect(firstRoute).toBeDefined();
      expect(nonExistentRoute).toBeUndefined();
      
      // Length check before access
      if (routes.length > 0) {
        expect(routes[0]).toBeDefined();
      }
    });

    it('should handle empty arrays safely', async () => {
      const emptyRequest = {
        from: [], // Empty array
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum'
      };
      
      const routes = await paymentRouter.findAllRoutes(emptyRequest);
      
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBe(0);
    });
  });

  describe('Ethereum V6 Type Safety', () => {
    it('should handle bigint arithmetic safely', () => {
      const amount1 = BigInt('1000000000000000000'); // 1 ETH
      const amount2 = BigInt('500000000000000000');  // 0.5 ETH
      
      // Native bigint operations
      const sum = amount1 + amount2;
      const difference = amount1 - amount2;
      const product = amount1 * 2n;
      const quotient = amount1 / 2n;
      
      expect(sum).toBe(BigInt('1500000000000000000'));
      expect(difference).toBe(BigInt('500000000000000000'));
      expect(product).toBe(BigInt('2000000000000000000'));
      expect(quotient).toBe(BigInt('500000000000000000'));
    });

    it('should handle ethers v6 address validation', () => {
      const validAddress = TEST_ADDRESSES.ethereum;
      const invalidAddress = 'invalid';
      const nullAddress = null;
      const undefinedAddress = undefined;
      
      expect(isAddress(validAddress)).toBe(true);
      expect(isAddress(invalidAddress)).toBe(false);
      expect(isAddress(nullAddress as any)).toBe(false);
      expect(isAddress(undefinedAddress as any)).toBe(false);
    });

    it('should handle ethers v6 formatUnits/parseUnits', () => {
      const weiAmount = BigInt('1000000000000000000');
      const usdcAmount = BigInt('1000000');
      
      // Format with correct decimals
      const ethFormatted = ethers.formatUnits(weiAmount, 18);
      const usdcFormatted = ethers.formatUnits(usdcAmount, 6);
      
      expect(ethFormatted).toBe('1');
      expect(usdcFormatted).toBe('1');
      
      // Parse back to bigint
      const ethParsed = ethers.parseUnits('1.0', 18);
      const usdcParsed = ethers.parseUnits('1.0', 6);
      
      expect(ethParsed).toBe(weiAmount);
      expect(usdcParsed).toBe(usdcAmount);
    });
  });

  describe('Error Handling Type Safety', () => {
    it('should handle unknown errors safely', async () => {
      // Mock provider to throw unknown error
      (providerManager.getProvider as jest.Mock).mockReturnValue({
        getBalance: jest.fn().mockRejectedValue('string error'), // Not an Error object
        sendTransaction: jest.fn().mockResolvedValue('0x123')
      });
      
      const request = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'ETH',
        blockchain: 'ethereum'
      };
      
      // Should handle non-Error objects gracefully
      const route = await paymentRouter.findBestRoute(request);
      
      // Should not throw, may return null or empty route
      expect(route).toBeDefined();
    });

    it('should handle async errors in route execution', async () => {
      const failingRoute: PaymentRoute = {
        blockchain: 'ethereum',
        fromAddress: TEST_ADDRESSES.ethereum,
        fromToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        fromAmount: '1000000',
        fromDecimals: 6,
        toToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        toAmount: '1000000',
        toDecimals: 6,
        toAddress: TEST_ADDRESSES.ethereum,
        exchangeRoutes: [],
        steps: [{
          type: 'transfer',
          description: 'Transfer will fail'
        }]
      };
      
      // Mock provider to fail
      (providerManager.sendTransaction as jest.Mock).mockRejectedValue(
        new Error('Insufficient funds')
      );
      
      await expect(paymentRouter.executeRoute(failingRoute)).rejects.toThrow();
    });
  });

  describe('Chain ID Type Safety', () => {
    it('should handle both number and string chain IDs', () => {
      const numericChainId = 1;
      const stringChainId = 'solana';
      
      const ethToken: TokenInfo = {
        address: MOCK_TOKENS.ethereum.USDC.address,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: numericChainId
      };
      
      const solToken: TokenInfo = {
        address: 'So11111111111111111111111111111111111111112', // SOL token
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        chainId: stringChainId
      };
      
      expect(typeof ethToken.chainId).toBe('number');
      expect(typeof solToken.chainId).toBe('string');
      expect(ethToken.chainId).toBe(1);
      expect(solToken.chainId).toBe('solana');
    });
  });

  describe('Conditional Spread Syntax', () => {
    it('should use conditional spread for optional properties', () => {
      const baseRoute = {
        blockchain: 'ethereum',
        fromAddress: TEST_ADDRESSES.ethereum,
        fromToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        fromAmount: '1000000',
        fromDecimals: 6,
        toToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        toAmount: '1000000',
        toDecimals: 6,
        toAddress: TEST_ADDRESSES.ethereum,
        exchangeRoutes: [],
        steps: []
      };
      
      const estimatedGas = '150000';
      const approvalRequired = true;
      
      // Use conditional spread to avoid undefined properties
      const routeWithOptionals: PaymentRoute = {
        ...baseRoute,
        ...(estimatedGas && { estimatedGas }),
        ...(approvalRequired && { approvalRequired })
      };
      
      expect(routeWithOptionals.estimatedGas).toBe('150000');
      expect(routeWithOptionals.approvalRequired).toBe(true);
      expect('estimatedFee' in routeWithOptionals).toBe(false);
    });

    it('should omit falsy optional values', () => {
      const baseRoute = {
        blockchain: 'ethereum',
        fromAddress: TEST_ADDRESSES.ethereum,
        fromToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        fromAmount: '1000000',
        fromDecimals: 6,
        toToken: MOCK_TOKENS.ethereum.USDC as TokenInfo,
        toAmount: '1000000',
        toDecimals: 6,
        toAddress: TEST_ADDRESSES.ethereum,
        exchangeRoutes: [],
        steps: []
      };
      
      const estimatedGas = '';        // Falsy
      const estimatedFee = null;      // Falsy
      const approvalRequired = false; // Falsy but valid boolean
      
      const routeWithConditionals: PaymentRoute = {
        ...baseRoute,
        ...(estimatedGas && { estimatedGas }),
        ...(estimatedFee && { estimatedFee }),
        ...(approvalRequired !== undefined && { approvalRequired })
      };
      
      expect('estimatedGas' in routeWithConditionals).toBe(false);
      expect('estimatedFee' in routeWithConditionals).toBe(false);
      expect(routeWithConditionals.approvalRequired).toBe(false);
    });
  });
});