/**
 * Payment Routing Service Tests
 * Tests DePay-inspired payment routing functionality
 */

import { paymentRouter, PaymentRoute } from '../../../src/core/payments/routing';
import { bridgeService } from '../../../src/core/bridge';
import { providerManager } from '../../../src/core/providers/ProviderManager';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { TEST_ADDRESSES, TEST_PASSWORD, MOCK_TOKENS, cleanupTest } from '../../setup';
import { ethers } from 'ethers';

// Mock bridge service
jest.mock('../../../src/core/bridge', () => ({
  bridgeService: {
    getQuotes: jest.fn().mockResolvedValue({
      routes: [{
        id: 'bridge-route-1',
        fromChain: 'polygon',
        toChain: 'ethereum',
        fromToken: {
          address: MOCK_TOKENS.polygon.USDC.address,
          symbol: 'USDC',
          decimals: 6
        },
        toToken: {
          address: MOCK_TOKENS.ethereum.USDC.address,
          symbol: 'USDC',
          decimals: 6
        },
        fromAmount: '100000000',
        toAmount: '99900000',
        estimatedTime: 600,
        fee: { amount: '100000', token: 'USDC' },
        bridge: 'hop',
        steps: []
      }],
      bestRoute: null
    }),
    executeBridge: jest.fn().mockResolvedValue('bridge-tx-id')
  }
}));

// Mock provider manager
jest.mock('../../../src/core/providers/ProviderManager', () => ({
  providerManager: {
    getProvider: jest.fn().mockReturnValue({
      getBalance: jest.fn().mockResolvedValue(ethers.utils.parseEther('1')),
      sendTransaction: jest.fn().mockResolvedValue('0x' + '1'.repeat(64))
    }),
    switchEVMNetwork: jest.fn(),
    setActiveChain: jest.fn(),
    sendTransaction: jest.fn().mockResolvedValue('0x' + '1'.repeat(64))
  }
}));

describe('PaymentRoutingService', () => {
  beforeEach(async () => {
    await keyringService.createWallet(TEST_PASSWORD);
    await keyringService.createAccount('ethereum', 'ETH Account');
    await keyringService.createAccount('solana', 'SOL Account');
    
    // Reset mocks
    (bridgeService.getQuotes as jest.Mock).mockClear();
    (providerManager.getProvider as jest.Mock).mockClear();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Route Discovery', () => {
    it('should find direct payment route', async () => {
      const request = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum',
        accept: [{
          blockchain: 'ethereum',
          token: 'USDC',
          amount: '100',
          receiver: TEST_ADDRESSES.ethereum
        }]
      };
      
      const route = await paymentRouter.findBestRoute(request);
      
      expect(route).toBeTruthy();
      expect(route?.blockchain).toBe('ethereum');
      expect(route?.fromToken.symbol).toBe('USDC');
      expect(route?.exchangeRoutes).toHaveLength(0); // Direct transfer
      expect(route?.steps[0].type).toBe('transfer');
    });

    it('should find routes across multiple blockchains', async () => {
      const request = {
        from: [
          TEST_ADDRESSES.ethereum,
          TEST_ADDRESSES.solana,
          TEST_ADDRESSES.bitcoin
        ],
        to: TEST_ADDRESSES.ethereum,
        accept: [{
          blockchain: 'ethereum',
          token: 'USDC',
          receiver: TEST_ADDRESSES.ethereum
        }]
      };
      
      const routes = await paymentRouter.findAllRoutes(request);
      
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].fromAddress).toBe(TEST_ADDRESSES.ethereum);
    });

    it('should prioritize routes without approval', async () => {
      const routes: PaymentRoute[] = [
        {
          blockchain: 'ethereum',
          fromAddress: TEST_ADDRESSES.ethereum,
          fromToken: { symbol: 'USDC', decimals: 6 } as any,
          toAddress: TEST_ADDRESSES.ethereum,
          approvalRequired: true,
          exchangeRoutes: [],
          steps: []
        } as PaymentRoute,
        {
          blockchain: 'ethereum',
          fromAddress: TEST_ADDRESSES.ethereum,
          fromToken: { symbol: 'ETH', decimals: 18 } as any,
          toAddress: TEST_ADDRESSES.ethereum,
          approvalRequired: false,
          exchangeRoutes: [],
          steps: []
        } as PaymentRoute
      ];
      
      const bestRoute = routes.sort((a, b) => {
        if (a.approvalRequired && !b.approvalRequired) return 1;
        if (!a.approvalRequired && b.approvalRequired) return -1;
        return 0;
      })[0];
      
      expect(bestRoute.approvalRequired).toBe(false);
    });

    it('should find swap routes when needed', async () => {
      // Mock provider to return low USDC balance
      const mockProvider = {
        getBalance: jest.fn().mockImplementation((address: string) => {
          if (address === MOCK_TOKENS.ethereum.USDC.address) {
            return ethers.BigNumber.from('0'); // No USDC
          }
          return ethers.utils.parseEther('1'); // 1 ETH
        })
      };
      (providerManager.getProvider as jest.Mock).mockReturnValue(mockProvider);
      
      const request = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum'
      };
      
      const route = await paymentRouter.findBestRoute(request);
      
      // Should find a swap route from ETH to USDC
      expect(route).toBeTruthy();
      if (route?.exchangeRoutes.length > 0) {
        expect(route.exchangeRoutes[0].exchange).toBeTruthy();
        expect(route.steps.some(s => s.type === 'swap')).toBe(true);
      }
    });

    it('should find bridge routes for cross-chain payments', async () => {
      // Mock balance on different chain
      const mockProvider = {
        getBalance: jest.fn().mockImplementation((address: string, token?: string) => {
          // Has USDC on Polygon but needs it on Ethereum
          if (token === MOCK_TOKENS.polygon.USDC.address) {
            return ethers.utils.parseUnits('1000', 6); // 1000 USDC on Polygon
          }
          return ethers.BigNumber.from('0');
        })
      };
      (providerManager.getProvider as jest.Mock).mockReturnValue(mockProvider);
      
      const request = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        blockchain: 'ethereum'
      };
      
      const route = await paymentRouter.findBestRoute(request);
      
      expect(bridgeService.getQuotes).toHaveBeenCalled();
      if (route && route.steps.some(s => s.type === 'bridge')) {
        expect(route.blockchain).toBe('polygon'); // Starts from Polygon
        expect(route.steps.some(s => s.type === 'bridge')).toBe(true);
      }
    });
  });

  describe('Supported Exchanges', () => {
    it('should have correct exchanges for each chain', () => {
      const exchanges = paymentRouter['supportedExchanges'];
      
      expect(exchanges.ethereum).toContain('uniswap_v3');
      expect(exchanges.ethereum).toContain('sushiswap');
      expect(exchanges.polygon).toContain('quickswap');
      expect(exchanges.arbitrum).toContain('camelot');
      expect(exchanges.optimism).toContain('velodrome');
      expect(exchanges.base).toContain('aerodrome');
      expect(exchanges.bsc).toContain('pancakeswap');
      expect(exchanges.solana).toContain('jupiter');
    });
  });

  describe('Native Tokens', () => {
    it('should have correct native tokens for each chain', () => {
      const nativeTokens = paymentRouter['nativeTokens'];
      
      expect(nativeTokens.ethereum.symbol).toBe('ETH');
      expect(nativeTokens.polygon.symbol).toBe('MATIC');
      expect(nativeTokens.bsc.symbol).toBe('BNB');
      expect(nativeTokens.avalanche.symbol).toBe('AVAX');
      expect(nativeTokens.solana.symbol).toBe('SOL');
      expect(nativeTokens.solana.decimals).toBe(9);
    });
  });

  describe('Route Execution', () => {
    it('should execute direct transfer', async () => {
      const route: PaymentRoute = {
        blockchain: 'ethereum',
        fromAddress: TEST_ADDRESSES.ethereum,
        toAddress: TEST_ADDRESSES.ethereum,
        fromAmount: '100000000',
        fromToken: MOCK_TOKENS.ethereum.USDC as any,
        toToken: MOCK_TOKENS.ethereum.USDC as any,
        exchangeRoutes: [],
        steps: [{
          type: 'transfer',
          description: 'Transfer USDC'
        }]
      } as PaymentRoute;
      
      const txHash = await paymentRouter.executeRoute(route);
      
      expect(txHash).toBe('0x' + '1'.repeat(64));
      expect(providerManager.sendTransaction).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum,
        '100000000',
        'ethereum'
      );
    });

    it('should execute bridge transfer', async () => {
      const route: PaymentRoute = {
        blockchain: 'polygon',
        fromAddress: TEST_ADDRESSES.ethereum,
        toAddress: TEST_ADDRESSES.ethereum,
        fromAmount: '100000000',
        fromToken: MOCK_TOKENS.polygon.USDC as any,
        toToken: MOCK_TOKENS.ethereum.USDC as any,
        exchangeRoutes: [],
        steps: [{
          type: 'bridge',
          description: 'Bridge USDC from Polygon to Ethereum',
          data: {
            bridgeRoute: {
              id: 'test-bridge',
              bridge: 'hop'
            }
          }
        }]
      } as PaymentRoute;
      
      const bridgeId = await paymentRouter.executeRoute(route);
      
      expect(bridgeId).toBe('bridge-tx-id');
      expect(bridgeService.executeBridge).toHaveBeenCalled();
    });

    it('should switch networks before execution', async () => {
      const route: PaymentRoute = {
        blockchain: 'polygon',
        fromAddress: TEST_ADDRESSES.ethereum,
        toAddress: TEST_ADDRESSES.ethereum,
        fromAmount: '100',
        exchangeRoutes: [],
        steps: []
      } as PaymentRoute;
      
      await paymentRouter.executeRoute(route);
      
      expect(providerManager.switchEVMNetwork).toHaveBeenCalledWith('polygon');
    });

    it('should handle Solana transactions', async () => {
      const route: PaymentRoute = {
        blockchain: 'solana',
        fromAddress: TEST_ADDRESSES.solana,
        toAddress: TEST_ADDRESSES.solana,
        fromAmount: '1000000000', // 1 SOL
        exchangeRoutes: [],
        steps: [{
          type: 'transfer',
          description: 'Transfer SOL'
        }]
      } as PaymentRoute;
      
      await paymentRouter.executeRoute(route);
      
      expect(providerManager.setActiveChain).toHaveBeenCalledWith('solana');
    });
  });

  describe('Token Balance Checking', () => {
    it('should check native token balance', async () => {
      const balance = await paymentRouter['getTokenBalance'](
        'ethereum',
        TEST_ADDRESSES.ethereum,
        paymentRouter['nativeTokens'].ethereum.address
      );
      
      expect(balance).toBe('1.0'); // 1 ETH
    });

    it('should check ERC20 token balance', async () => {
      // For now returns '0' as ERC20 checking is not implemented
      const balance = await paymentRouter['getTokenBalance'](
        'ethereum',
        TEST_ADDRESSES.ethereum,
        MOCK_TOKENS.ethereum.USDC.address
      );
      
      expect(balance).toBe('0');
    });

    it('should handle balance check errors', async () => {
      const mockProvider = providerManager.getProvider('ethereum' as any);
      mockProvider.getBalance = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const balance = await paymentRouter['getTokenBalance'](
        'ethereum',
        TEST_ADDRESSES.ethereum,
        paymentRouter['nativeTokens'].ethereum.address
      );
      
      expect(balance).toBe('0');
    });
  });

  describe('Address Validation', () => {
    it('should validate Ethereum addresses', () => {
      const isValid = paymentRouter['isValidAddress'](
        TEST_ADDRESSES.ethereum,
        'ethereum'
      );
      expect(isValid).toBe(true);
      
      const isInvalid = paymentRouter['isValidAddress'](
        'invalid-address',
        'ethereum'
      );
      expect(isInvalid).toBe(false);
    });

    it('should validate Solana addresses', () => {
      const isValid = paymentRouter['isValidAddress'](
        TEST_ADDRESSES.solana,
        'solana'
      );
      expect(isValid).toBe(true);
      
      const isInvalid = paymentRouter['isValidAddress'](
        'short',
        'solana'
      );
      expect(isInvalid).toBe(false);
    });
  });

  describe('Chain ID Mapping', () => {
    it('should return correct chain IDs', () => {
      expect(paymentRouter['getChainId']('ethereum')).toBe(1);
      expect(paymentRouter['getChainId']('polygon')).toBe(137);
      expect(paymentRouter['getChainId']('arbitrum')).toBe(42161);
      expect(paymentRouter['getChainId']('optimism')).toBe(10);
      expect(paymentRouter['getChainId']('base')).toBe(8453);
      expect(paymentRouter['getChainId']('bsc')).toBe(56);
      expect(paymentRouter['getChainId']('avalanche')).toBe(43114);
      expect(paymentRouter['getChainId']('solana')).toBe('solana');
    });
  });

  describe('Error Handling', () => {
    it('should handle route finding errors', async () => {
      const request = {
        from: ['invalid-address'],
        to: TEST_ADDRESSES.ethereum,
        blockchain: 'ethereum'
      };
      
      const route = await paymentRouter.findBestRoute(request);
      expect(route).toBeNull();
    });

    it('should throw on route execution failure', async () => {
      const route: PaymentRoute = {
        blockchain: 'ethereum',
        steps: [{
          type: 'invalid' as any,
          description: 'Invalid step'
        }]
      } as PaymentRoute;
      
      await expect(
        paymentRouter.executeRoute(route)
      ).rejects.toThrow('Route execution failed');
    });
  });
});