/**
 * SwapService Test Suite
 * 
 * Tests token swapping functionality with ethers v6 compatibility validation.
 * Validates DEX integration, route optimization, and slippage protection.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ethers } from 'ethers';
import { SwapService, type SwapRoute, type SwapOptions } from '../../../src/services/SwapService';
import { 
  mockWallet, 
  createMockProvider, 
  createMockContract, 
  SWAP_TEST_DATA, 
  MOCK_TOKENS,
  TEST_ADDRESSES,
  cleanupTest 
} from '../../setup';

describe('SwapService', () => {
  let service: SwapService;
  let mockProvider: any;
  let mockRouterContract: any;
  let mockTokenContract: any;
  let mockQuoterContract: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
    
    // Mock Uniswap V3 Router contract
    mockRouterContract = createMockContract('0xE592427A0AEce92De3Edee1F18E0157C05861564', {
      'exactInputSingle': jest.fn().mockResolvedValue({
        hash: '0xswaptx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'exactInput': jest.fn().mockResolvedValue({
        hash: '0xmultihopswap',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      })
    });

    // Mock Quoter contract
    mockQuoterContract = createMockContract('0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', {
      'quoteExactInputSingle': {
        staticCall: jest.fn().mockResolvedValue(ethers.parseEther('80'))
      },
      'quoteExactInput': {
        staticCall: jest.fn().mockResolvedValue(ethers.parseEther('78'))
      }
    });

    // Mock ERC20 token contract
    mockTokenContract = createMockContract(MOCK_TOKENS.ethereum.USDC.address, {
      'allowance': jest.fn().mockResolvedValue(0n),
      'approve': jest.fn().mockResolvedValue({
        hash: '0xapproval',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'balanceOf': jest.fn().mockResolvedValue(ethers.parseUnits('1000', 6))
    });

    service = new SwapService(mockProvider, {
      dexes: {
        uniswap: {
          router: mockRouterContract.address,
          quoter: mockQuoterContract.address,
          factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
        },
        sushiswap: {
          router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
          quoter: '0x64FC387C40c837a6cCC7FF8c353235Dafb2e9C07',
          factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
        }
      },
      defaultSlippage: 0.5
    });
  });

  afterAll(() => {
    cleanupTest();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with DEX configurations', () => {
      expect(service).toBeDefined();
      expect(service.getSupportedDEXes()).toContain('uniswap');
      expect(service.getSupportedDEXes()).toContain('sushiswap');
    });

    it('should validate router addresses', () => {
      expect(() => {
        new SwapService(mockProvider, {
          dexes: {
            invalid: {
              router: 'invalid-address',
              quoter: '0x123',
              factory: '0x456'
            }
          }
        });
      }).toThrow('Invalid router address');
    });

    it('should set default slippage tolerance', () => {
      expect(service.getDefaultSlippage()).toBe(0.5);
    });
  });

  describe('Route Finding and Quoting', () => {
    it('should find direct swap route', async () => {
      const routes = await service.findRoutes({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xXOMTokenAddress',
        amount: '100',
        dex: 'uniswap'
      });

      expect(routes).toHaveLength(1);
      const route = routes[0];
      expect(route.fromToken).toBe(MOCK_TOKENS.ethereum.USDC.address);
      expect(route.toToken).toBe('0xXOMTokenAddress');
      expect(route.dex).toBe('uniswap');
      expect(route.path).toHaveLength(2);
    });

    it('should find multi-hop routes', async () => {
      const routes = await service.findRoutes({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xRareToken',
        amount: '100',
        maxHops: 3
      });

      expect(routes.some(route => route.path.length > 2)).toBe(true);
    });

    it('should get quote with ethers v6 parseEther', async () => {
      const quote = await service.getQuote({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xXOMTokenAddress',
        amountIn: ethers.parseUnits('100', 6).toString(),
        dex: 'uniswap'
      });

      expect(quote).toBeDefined();
      expect(quote.outputAmount).toBeDefined();
      expect(quote.estimatedSlippage).toBeDefined();
      expect(mockQuoterContract['quoteExactInputSingle'].staticCall).toHaveBeenCalled();
    });

    it('should handle quote errors gracefully', async () => {
      mockQuoterContract['quoteExactInputSingle'].staticCall.mockRejectedValueOnce(
        new Error('Insufficient liquidity')
      );

      await expect(service.getQuote({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xIlliquidToken',
        amountIn: ethers.parseUnits('1000000', 6).toString(),
        dex: 'uniswap'
      })).rejects.toThrow('Insufficient liquidity');
    });

    it('should compare routes across multiple DEXes', async () => {
      const comparison = await service.compareRoutes({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xXOMTokenAddress',
        amount: '100'
      });

      expect(comparison).toBeDefined();
      expect(comparison.bestRoute).toBeDefined();
      expect(comparison.routes).toBeInstanceOf(Array);
      expect(comparison.savings).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Token Approval with MaxUint256', () => {
    it('should check token allowance before swap', async () => {
      await service.checkAndApprove({
        tokenAddress: MOCK_TOKENS.ethereum.USDC.address,
        spender: mockRouterContract.address,
        amount: ethers.parseUnits('100', 6),
        owner: TEST_ADDRESSES.ethereum
      });

      expect(mockTokenContract['allowance']).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum,
        mockRouterContract.address
      );
    });

    it('should approve with MaxUint256 for gas optimization', async () => {
      mockTokenContract['allowance'].mockResolvedValueOnce(0n);

      const signer = await mockProvider.getSigner();
      const tokenWithSigner = mockTokenContract.connect(signer);

      await service.approveToken({
        tokenAddress: MOCK_TOKENS.ethereum.USDC.address,
        spender: mockRouterContract.address,
        signer
      });

      expect(tokenWithSigner['approve']).toHaveBeenCalledWith(
        mockRouterContract.address,
        ethers.MaxUint256
      );
    });

    it('should validate MaxUint256 usage', () => {
      const maxValue = ethers.MaxUint256;
      
      expect(typeof maxValue).toBe('bigint');
      expect(maxValue > 0n).toBe(true);
      expect(maxValue.toString().length).toBeGreaterThan(70);
    });

    it('should handle approval failures', async () => {
      mockTokenContract['approve'].mockRejectedValueOnce(new Error('Approval failed'));

      const signer = await mockProvider.getSigner();

      await expect(service.approveToken({
        tokenAddress: MOCK_TOKENS.ethereum.USDC.address,
        spender: mockRouterContract.address,
        signer
      })).rejects.toThrow('Approval failed');
    });
  });

  describe('Swap Execution with Contract Bracket Notation', () => {
    it('should execute single-hop swap', async () => {
      const signer = await mockProvider.getSigner();
      const routerWithSigner = mockRouterContract.connect(signer);

      const result = await service.executeSwap({
        route: SWAP_TEST_DATA.routes[0],
        signer,
        options: { maxSlippage: 0.5 }
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(routerWithSigner['exactInputSingle']).toHaveBeenCalled();
    });

    it('should execute multi-hop swap', async () => {
      const multiHopRoute: SwapRoute = {
        ...SWAP_TEST_DATA.routes[0],
        path: [MOCK_TOKENS.ethereum.USDC.address, MOCK_TOKENS.ethereum.USDT.address, '0xXOMTokenAddress']
      };

      const signer = await mockProvider.getSigner();
      const routerWithSigner = mockRouterContract.connect(signer);

      const result = await service.executeSwap({
        route: multiHopRoute,
        signer
      });

      expect(result.success).toBe(true);
      expect(routerWithSigner['exactInput']).toHaveBeenCalled();
    });

    it('should calculate slippage protection with native bigint', async () => {
      const inputAmount = ethers.parseUnits('100', 6);
      const outputAmount = ethers.parseEther('80');
      const slippageTolerance = 0.5; // 0.5%

      const minAmountOut = (outputAmount * BigInt(1000 - slippageTolerance * 10)) / 1000n;
      
      expect(typeof minAmountOut).toBe('bigint');
      expect(minAmountOut < outputAmount).toBe(true);
    });

    it('should handle swap failures', async () => {
      mockRouterContract['exactInputSingle'].mockRejectedValueOnce(new Error('Swap failed'));

      const signer = await mockProvider.getSigner();

      await expect(service.executeSwap({
        route: SWAP_TEST_DATA.routes[0],
        signer
      })).rejects.toThrow('Swap failed');
    });

    it('should validate deadline parameter', async () => {
      const futureDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // Past

      const signer = await mockProvider.getSigner();

      // Valid deadline should work
      const result = await service.executeSwap({
        route: SWAP_TEST_DATA.routes[0],
        signer,
        options: { deadline: futureDeadline }
      });
      expect(result.success).toBe(true);

      // Past deadline should fail
      await expect(service.executeSwap({
        route: SWAP_TEST_DATA.routes[0],
        signer,
        options: { deadline: pastDeadline }
      })).rejects.toThrow('Deadline has passed');
    });
  });

  describe('Price Impact and Slippage Calculation', () => {
    it('should calculate price impact for large trades', async () => {
      const impact = await service.calculatePriceImpact({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xXOMTokenAddress',
        amountIn: ethers.parseUnits('10000', 6).toString() // Large trade
      });

      expect(impact).toBeDefined();
      expect(impact.percentage).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'severe']).toContain(impact.severity);
    });

    it('should warn about high slippage trades', async () => {
      const highSlippageRoute = {
        ...SWAP_TEST_DATA.routes[0],
        estimatedSlippage: 5.0 // 5% slippage
      };

      const warning = service.validateSlippage(highSlippageRoute, { maxSlippage: 3.0 });
      
      expect(warning.hasWarning).toBe(true);
      expect(warning.severity).toBe('high');
    });

    it('should calculate optimal slippage tolerance', () => {
      const optimal = service.calculateOptimalSlippage({
        volatility: 2.5,
        liquidityDepth: ethers.parseEther('1000000'),
        tradeSize: ethers.parseUnits('10000', 6)
      });

      expect(optimal).toBeGreaterThan(0);
      expect(optimal).toBeLessThan(10);
    });
  });

  describe('Gas Estimation and Optimization', () => {
    it('should estimate gas for swap transactions', async () => {
      mockRouterContract.estimateGas = {
        exactInputSingle: jest.fn().mockResolvedValue(150000n)
      };

      const gasEstimate = await service.estimateSwapGas({
        route: SWAP_TEST_DATA.routes[0],
        fromAddress: TEST_ADDRESSES.ethereum
      });

      expect(gasEstimate).toBe(150000n);
      expect(typeof gasEstimate).toBe('bigint');
    });

    it('should optimize gas with dynamic fee calculation', async () => {
      mockProvider.getFeeData.mockResolvedValueOnce({
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('3', 'gwei'),
        gasPrice: ethers.parseUnits('48', 'gwei')
      });

      const feeData = await service.getOptimizedFeeData();

      expect(feeData.maxFeePerGas).toBeDefined();
      expect(feeData.maxPriorityFeePerGas).toBeDefined();
      expect(typeof feeData.maxFeePerGas).toBe('bigint');
    });

    it('should calculate total transaction cost', async () => {
      const cost = await service.calculateTransactionCost({
        gasLimit: 150000n,
        gasPrice: ethers.parseUnits('30', 'gwei'),
        ethPrice: 2500 // USD
      });

      expect(cost.gasCostETH).toBeDefined();
      expect(cost.gasCostUSD).toBeDefined();
      expect(cost.gasCostUSD).toBeGreaterThan(0);
    });
  });

  describe('Advanced Routing and Aggregation', () => {
    it('should find best route across multiple DEXes', async () => {
      const bestRoute = await service.findBestRoute({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xXOMTokenAddress',
        amount: '1000',
        includeGasCost: true
      });

      expect(bestRoute).toBeDefined();
      expect(bestRoute.expectedOutput).toBeDefined();
      expect(bestRoute.totalCost).toBeDefined();
      expect(bestRoute.dex).toBeDefined();
    });

    it('should split large orders across multiple DEXes', async () => {
      const splitOrder = await service.optimizeOrderSplit({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: '0xXOMTokenAddress',
        totalAmount: ethers.parseUnits('50000', 6),
        maxPriceImpact: 2.0
      });

      expect(splitOrder.splits).toBeInstanceOf(Array);
      expect(splitOrder.splits.length).toBeGreaterThan(1);
      expect(splitOrder.totalPriceImpact).toBeLessThan(2.0);
    });

    it('should handle cross-chain routing', async () => {
      const crossChainRoute = await service.findCrossChainRoute({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        fromChain: 'ethereum',
        toToken: '0xPolygonUSDC',
        toChain: 'polygon',
        amount: '1000'
      });

      expect(crossChainRoute).toBeDefined();
      expect(crossChainRoute.bridge).toBeDefined();
      expect(crossChainRoute.bridgeFee).toBeDefined();
      expect(crossChainRoute.estimatedTime).toBeDefined();
    });
  });

  describe('MEV Protection and Security', () => {
    it('should detect potential MEV attacks', async () => {
      const mevAnalysis = await service.analyzeMEVRisk({
        route: SWAP_TEST_DATA.routes[0],
        txPool: ['0xfront-run-tx'],
        blockNumber: 18500000
      });

      expect(mevAnalysis.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(mevAnalysis.riskLevel);
      expect(mevAnalysis.recommendations).toBeInstanceOf(Array);
    });

    it('should suggest MEV protection strategies', () => {
      const protection = service.getMEVProtectionOptions({
        tradeSize: ethers.parseUnits('10000', 6),
        volatility: 3.5
      });

      expect(protection.flashbotsRelay).toBeDefined();
      expect(protection.privateMempools).toBeInstanceOf(Array);
      expect(protection.commitRevealScheme).toBeDefined();
    });

    it('should validate transaction parameters for security', () => {
      const validation = service.validateTransactionSecurity({
        to: mockRouterContract.address,
        value: ethers.parseEther('0'),
        data: '0x123456789abcdef',
        gasLimit: 200000n
      });

      expect(validation.isSecure).toBeDefined();
      expect(validation.warnings).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network congestion', async () => {
      mockProvider.getFeeData.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(service.getOptimizedFeeData()).rejects.toThrow('Network timeout');
    });

    it('should recover from failed transactions', async () => {
      const recovery = await service.recoverFailedSwap({
        transactionHash: '0xfailedtx',
        originalRoute: SWAP_TEST_DATA.routes[0],
        reason: 'insufficient_gas'
      });

      expect(recovery.canRecover).toBeDefined();
      if (recovery.canRecover) {
        expect(recovery.newRoute).toBeDefined();
        expect(recovery.adjustedParameters).toBeDefined();
      }
    });

    it('should handle contract upgrade scenarios', async () => {
      mockProvider.getCode.mockResolvedValueOnce('0x');

      await expect(service.validateRouterContract(mockRouterContract.address))
        .rejects.toThrow('Router contract not deployed');
    });
  });

  describe('Real-world Integration Tests', () => {
    it('should handle mainnet fork testing', async () => {
      // Skip if not in mainnet fork environment
      if (process.env.FORK_URL) {
        const realProvider = new ethers.JsonRpcProvider(process.env.FORK_URL);
        const forkService = new SwapService(realProvider, {
          dexes: {
            uniswap: {
              router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
              quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
              factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
            }
          }
        });

        const quote = await forkService.getQuote({
          fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Real USDC
          toToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Real WETH
          amountIn: ethers.parseUnits('1000', 6).toString(),
          dex: 'uniswap'
        });

        expect(quote.outputAmount).toBeDefined();
      }
    });

    it('should integrate with price oracles', async () => {
      const priceData = await service.getPriceFromOracle({
        token: MOCK_TOKENS.ethereum.USDC.address,
        quoteCurrency: 'USD'
      });

      expect(priceData.price).toBeDefined();
      expect(priceData.timestamp).toBeDefined();
      expect(priceData.confidence).toBeGreaterThan(90);
    });

    it('should handle real slippage scenarios', async () => {
      const simulatedSlippage = await service.simulateSlippage({
        route: SWAP_TEST_DATA.routes[0],
        marketConditions: {
          volatility: 'high',
          liquidity: 'medium',
          gasPrice: 'high'
        }
      });

      expect(simulatedSlippage.expectedSlippage).toBeDefined();
      expect(simulatedSlippage.worstCaseSlippage).toBeDefined();
      expect(simulatedSlippage.confidenceInterval).toBeDefined();
    });
  });
});