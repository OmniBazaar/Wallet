/**
 * DEX Integration Tests for Wallet
 * Tests wallet integration with decentralized exchange functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { DEXService } from '../../src/services/DEXService';
import { SwapService } from '../../src/services/SwapService';
import { LiquidityService } from '../../src/services/LiquidityService';
import { OrderBookService } from '../../src/services/OrderBookService';
import { mockWallet, MOCK_TOKENS } from '../setup';
import { ethers } from 'ethers';

describe('DEX Wallet Integration', () => {
  let walletService: WalletService;
  let dexService: DEXService;
  let swapService: SwapService;
  let liquidityService: LiquidityService;
  let orderBookService: OrderBookService;

  beforeAll(async () => {
    walletService = new WalletService();
    dexService = new DEXService(walletService);
    swapService = new SwapService(walletService);
    liquidityService = new LiquidityService(walletService);
    orderBookService = new OrderBookService(walletService);
    
    await walletService.init();
    await dexService.init();
    await swapService.init();
    await liquidityService.init();
    await orderBookService.init();
  });

  afterAll(async () => {
    await dexService.cleanup();
    await swapService.cleanup();
    await liquidityService.cleanup();
    await orderBookService.cleanup();
    await walletService.cleanup();
  });

  beforeEach(async () => {
    await dexService.clearCache();
    await orderBookService.clearOrders();
  });

  describe('Token Swapping', () => {
    it('should get swap quote', async () => {
      const quote = await swapService.getQuote({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('100', 6), // 100 USDC
        slippage: 0.5 // 0.5%
      });

      expect(quote).toBeDefined();
      expect(quote.amountOut).toBeDefined();
      expect(quote.priceImpact).toBeDefined();
      expect(quote.route).toBeDefined();
      expect(quote.estimatedGas).toBeDefined();
    });

    it('should execute token swap', async () => {
      const swapParams = {
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('100', 6),
        minAmountOut: ethers.parseEther('90'), // Min 90 XOM
        recipient: mockWallet.address,
        deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      };

      const swap = await swapService.executeSwap(swapParams);
      
      expect(swap.transactionHash).toBeDefined();
      expect(swap.status).toBe('pending');
      expect(swap.amountIn).toBe(swapParams.amountIn.toString());
      expect(swap.tokenIn).toBe(swapParams.tokenIn);
      expect(swap.tokenOut).toBe(swapParams.tokenOut);
    });

    it('should handle multi-hop swaps', async () => {
      const multiHopSwap = await swapService.executeMultiHopSwap({
        path: [
          MOCK_TOKENS.ethereum.USDC.address,
          MOCK_TOKENS.ethereum.USDT.address,
          'XOM'
        ],
        amountIn: ethers.parseUnits('100', 6),
        minAmountOut: ethers.parseEther('85'),
        recipient: mockWallet.address
      });

      expect(multiHopSwap.hops).toBe(2);
      expect(multiHopSwap.path).toHaveLength(3);
      expect(multiHopSwap.transactionHash).toBeDefined();
    });

    it('should find best swap route', async () => {
      const routes = await swapService.findBestRoute({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('1000', 6)
      });

      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);
      
      const bestRoute = routes[0];
      expect(bestRoute.path).toBeDefined();
      expect(bestRoute.expectedOutput).toBeDefined();
      expect(bestRoute.priceImpact).toBeDefined();
      expect(bestRoute.pools).toBeDefined();
    });

    it('should calculate price impact', async () => {
      const impact = await swapService.calculatePriceImpact({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('10000', 6) // Large swap
      });

      expect(impact).toBeDefined();
      expect(impact.percentage).toBeGreaterThanOrEqual(0);
      expect(impact.severity).toBeDefined();
      expect(['low', 'medium', 'high', 'severe']).toContain(impact.severity);
    });

    it('should handle swap with permit', async () => {
      const permit = await walletService.signPermit({
        token: MOCK_TOKENS.ethereum.USDC.address,
        spender: dexService.getRouterAddress(),
        value: ethers.parseUnits('100', 6),
        deadline: Math.floor(Date.now() / 1000) + 3600
      });

      const swap = await swapService.swapWithPermit({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('100', 6),
        permit
      });

      expect(swap.success).toBe(true);
      expect(swap.gasUsed).toBeDefined();
      // Permit saves gas by avoiding separate approval tx
    });
  });

  describe('Liquidity Provision', () => {
    it('should add liquidity to pool', async () => {
      const liquidity = await liquidityService.addLiquidity({
        tokenA: MOCK_TOKENS.ethereum.USDC.address,
        tokenB: 'XOM',
        amountA: ethers.parseUnits('1000', 6),
        amountB: ethers.parseEther('1000'),
        minAmountA: ethers.parseUnits('990', 6),
        minAmountB: ethers.parseEther('990'),
        recipient: mockWallet.address
      });

      expect(liquidity.lpTokens).toBeDefined();
      expect(liquidity.share).toBeDefined();
      expect(liquidity.transactionHash).toBeDefined();
    });

    it('should remove liquidity from pool', async () => {
      const removal = await liquidityService.removeLiquidity({
        tokenA: MOCK_TOKENS.ethereum.USDC.address,
        tokenB: 'XOM',
        lpTokenAmount: ethers.parseEther('100'),
        minAmountA: ethers.parseUnits('950', 6),
        minAmountB: ethers.parseEther('950'),
        recipient: mockWallet.address
      });

      expect(removal.amountA).toBeDefined();
      expect(removal.amountB).toBeDefined();
      expect(removal.transactionHash).toBeDefined();
    });

    it('should get liquidity position', async () => {
      const position = await liquidityService.getPosition(
        mockWallet.address,
        MOCK_TOKENS.ethereum.USDC.address,
        'XOM'
      );

      expect(position).toBeDefined();
      expect(position.lpTokens).toBeDefined();
      expect(position.share).toBeDefined();
      expect(position.valueUSD).toBeDefined();
      expect(position.fees24h).toBeDefined();
      expect(position.apy).toBeDefined();
    });

    it('should calculate impermanent loss', async () => {
      const il = await liquidityService.calculateImpermanentLoss({
        tokenA: MOCK_TOKENS.ethereum.USDC.address,
        tokenB: 'XOM',
        initialPriceRatio: 1,
        currentPriceRatio: 1.5
      });

      expect(il).toBeDefined();
      expect(il.percentage).toBeGreaterThanOrEqual(0);
      expect(il.valueInUSD).toBeDefined();
      expect(il.explanation).toBeDefined();
    });

    it('should harvest liquidity rewards', async () => {
      const rewards = await liquidityService.harvestRewards(
        mockWallet.address,
        MOCK_TOKENS.ethereum.USDC.address,
        'XOM'
      );

      expect(rewards).toBeDefined();
      expect(rewards.amount).toBeDefined();
      expect(rewards.token).toBeDefined();
      expect(rewards.transactionHash).toBeDefined();
    });

    it('should get pool analytics', async () => {
      const analytics = await liquidityService.getPoolAnalytics(
        MOCK_TOKENS.ethereum.USDC.address,
        'XOM'
      );

      expect(analytics).toBeDefined();
      expect(analytics.tvl).toBeDefined();
      expect(analytics.volume24h).toBeDefined();
      expect(analytics.fees24h).toBeDefined();
      expect(analytics.apy).toBeDefined();
      expect(analytics.utilization).toBeDefined();
    });
  });

  describe('Limit Orders', () => {
    it('should place limit order', async () => {
      const order = await orderBookService.placeLimitOrder({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('100', 6),
        limitPrice: 1.1, // 1.1 XOM per USDC
        expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        maker: mockWallet.address
      });

      expect(order.orderId).toBeDefined();
      expect(order.status).toBe('open');
      expect(order.maker).toBe(mockWallet.address);
      expect(order.limitPrice).toBe(1.1);
    });

    it('should cancel limit order', async () => {
      const order = await orderBookService.placeLimitOrder({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('100', 6),
        limitPrice: 1.1,
        maker: mockWallet.address
      });

      const cancelled = await orderBookService.cancelOrder(
        order.orderId,
        mockWallet.address
      );

      expect(cancelled.success).toBe(true);
      expect(cancelled.refundAmount).toBeDefined();
      
      const orderStatus = await orderBookService.getOrder(order.orderId);
      expect(orderStatus.status).toBe('cancelled');
    });

    it('should get user orders', async () => {
      const orders = await orderBookService.getUserOrders(mockWallet.address);
      
      expect(Array.isArray(orders)).toBe(true);
      orders.forEach(order => {
        expect(order).toHaveProperty('orderId');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('tokenIn');
        expect(order).toHaveProperty('tokenOut');
        expect(order).toHaveProperty('amountIn');
        expect(order).toHaveProperty('limitPrice');
      });
    });

    it('should fill limit order', async () => {
      const orderId = 'order-123';
      
      const fill = await orderBookService.fillOrder({
        orderId,
        taker: mockWallet.address,
        amountToFill: ethers.parseUnits('50', 6) // Partial fill
      });

      expect(fill.success).toBe(true);
      expect(fill.amountFilled).toBeDefined();
      expect(fill.amountReceived).toBeDefined();
      expect(fill.transactionHash).toBeDefined();
    });

    it('should get order book depth', async () => {
      const depth = await orderBookService.getOrderBookDepth(
        MOCK_TOKENS.ethereum.USDC.address,
        'XOM'
      );

      expect(depth).toBeDefined();
      expect(depth.bids).toBeDefined();
      expect(depth.asks).toBeDefined();
      expect(depth.spread).toBeDefined();
      expect(depth.midPrice).toBeDefined();
      
      depth.bids.forEach(bid => {
        expect(bid).toHaveProperty('price');
        expect(bid).toHaveProperty('amount');
        expect(bid).toHaveProperty('total');
      });
    });

    it('should match orders automatically', async () => {
      // Place buy order
      const buyOrder = await orderBookService.placeLimitOrder({
        tokenIn: 'XOM',
        tokenOut: MOCK_TOKENS.ethereum.USDC.address,
        amountIn: ethers.parseEther('100'),
        limitPrice: 0.9, // Buy USDC at 0.9 per XOM
        maker: mockWallet.address
      });

      // Place matching sell order
      const sellOrder = await orderBookService.placeLimitOrder({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('90', 6),
        limitPrice: 1.11, // Sell USDC at 1.11 XOM per USDC (inverse matches)
        maker: '0xseller...'
      });

      // Check if orders were matched
      const buyStatus = await orderBookService.getOrder(buyOrder.orderId);
      const sellStatus = await orderBookService.getOrder(sellOrder.orderId);
      
      expect(buyStatus.status).toBe('filled');
      expect(sellStatus.status).toBe('filled');
    });
  });

  describe('DEX Aggregation', () => {
    it('should aggregate liquidity from multiple DEXs', async () => {
      const aggregated = await dexService.aggregateLiquidity({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amount: ethers.parseUnits('1000', 6),
        dexes: ['uniswap', 'sushiswap', 'omnidex']
      });

      expect(aggregated).toBeDefined();
      expect(aggregated.bestPrice).toBeDefined();
      expect(aggregated.bestDex).toBeDefined();
      expect(aggregated.splitRoute).toBeDefined();
      
      if (aggregated.splitRoute) {
        expect(aggregated.splits).toBeDefined();
        aggregated.splits.forEach(split => {
          expect(split).toHaveProperty('dex');
          expect(split).toHaveProperty('percentage');
          expect(split).toHaveProperty('expectedOutput');
        });
      }
    });

    it('should find arbitrage opportunities', async () => {
      const opportunities = await dexService.findArbitrage({
        pairs: [
          { tokenA: MOCK_TOKENS.ethereum.USDC.address, tokenB: 'XOM' },
          { tokenA: 'XOM', tokenB: MOCK_TOKENS.ethereum.USDT.address },
          { tokenA: MOCK_TOKENS.ethereum.USDT.address, tokenB: MOCK_TOKENS.ethereum.USDC.address }
        ],
        minProfit: ethers.parseUnits('10', 6) // Min $10 profit
      });

      expect(Array.isArray(opportunities)).toBe(true);
      opportunities.forEach(opp => {
        expect(opp).toHaveProperty('path');
        expect(opp).toHaveProperty('profit');
        expect(opp).toHaveProperty('profitPercentage');
        expect(opp).toHaveProperty('gasEstimate');
        expect(opp).toHaveProperty('netProfit');
      });
    });

    it('should execute cross-DEX swap', async () => {
      const crossDexSwap = await dexService.executeCrossDexSwap({
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: 'XOM',
        amountIn: ethers.parseUnits('1000', 6),
        splits: [
          { dex: 'uniswap', percentage: 60 },
          { dex: 'sushiswap', percentage: 40 }
        ],
        recipient: mockWallet.address
      });

      expect(crossDexSwap.success).toBe(true);
      expect(crossDexSwap.transactions).toHaveLength(2);
      expect(crossDexSwap.totalOutput).toBeDefined();
      expect(crossDexSwap.averagePrice).toBeDefined();
    });
  });

  describe('Staking and Farming', () => {
    it('should stake LP tokens', async () => {
      const stake = await dexService.stakeLPTokens({
        poolAddress: '0xpool...',
        amount: ethers.parseEther('100'),
        duration: 30, // 30 days
        address: mockWallet.address
      });

      expect(stake.success).toBe(true);
      expect(stake.stakeId).toBeDefined();
      expect(stake.apy).toBeDefined();
      expect(stake.unlockDate).toBeDefined();
    });

    it('should get farming positions', async () => {
      const positions = await dexService.getFarmingPositions(mockWallet.address);
      
      expect(Array.isArray(positions)).toBe(true);
      positions.forEach(position => {
        expect(position).toHaveProperty('farm');
        expect(position).toHaveProperty('stakedAmount');
        expect(position).toHaveProperty('pendingRewards');
        expect(position).toHaveProperty('apy');
        expect(position).toHaveProperty('valueUSD');
      });
    });

    it('should claim farming rewards', async () => {
      const rewards = await dexService.claimFarmingRewards(
        'farm-123',
        mockWallet.address
      );

      expect(rewards.success).toBe(true);
      expect(rewards.rewardTokens).toBeDefined();
      expect(Array.isArray(rewards.amounts)).toBe(true);
      expect(rewards.transactionHash).toBeDefined();
    });

    it('should calculate farming APY', async () => {
      const apy = await dexService.calculateFarmingAPY({
        farm: 'XOM-USDC-FARM',
        stakedAmount: ethers.parseEther('1000'),
        duration: 365
      });

      expect(apy).toBeDefined();
      expect(apy.base).toBeGreaterThanOrEqual(0);
      expect(apy.bonus).toBeGreaterThanOrEqual(0);
      expect(apy.total).toBe(apy.base + apy.bonus);
      expect(apy.dailyRewards).toBeDefined();
    });
  });

  describe('Flash Loans', () => {
    it('should execute flash loan', async () => {
      const flashLoan = await dexService.executeFlashLoan({
        token: MOCK_TOKENS.ethereum.USDC.address,
        amount: ethers.parseUnits('10000', 6),
        callbackContract: '0xcallback...',
        callbackData: '0x...'
      });

      expect(flashLoan.success).toBeDefined();
      if (flashLoan.success) {
        expect(flashLoan.fee).toBeDefined();
        expect(flashLoan.transactionHash).toBeDefined();
      }
    });

    it('should calculate flash loan fee', async () => {
      const fee = await dexService.getFlashLoanFee(
        MOCK_TOKENS.ethereum.USDC.address,
        ethers.parseUnits('10000', 6)
      );

      expect(fee).toBeDefined();
      expect(fee.amount).toBeDefined();
      expect(fee.percentage).toBeDefined();
      expect(fee.total).toBe(
        ethers.parseUnits('10000', 6) + fee.amount
      );
    });
  });

  describe('Analytics and History', () => {
    it('should get swap history', async () => {
      const history = await dexService.getSwapHistory(mockWallet.address);
      
      expect(Array.isArray(history)).toBe(true);
      history.forEach(swap => {
        expect(swap).toHaveProperty('timestamp');
        expect(swap).toHaveProperty('tokenIn');
        expect(swap).toHaveProperty('tokenOut');
        expect(swap).toHaveProperty('amountIn');
        expect(swap).toHaveProperty('amountOut');
        expect(swap).toHaveProperty('transactionHash');
      });
    });

    it('should calculate PnL', async () => {
      const pnl = await dexService.calculatePnL(mockWallet.address, {
        period: '30d',
        includeFees: true,
        includeImpermanentLoss: true
      });

      expect(pnl).toBeDefined();
      expect(pnl.realized).toBeDefined();
      expect(pnl.unrealized).toBeDefined();
      expect(pnl.total).toBe(pnl.realized + pnl.unrealized);
      expect(pnl.percentage).toBeDefined();
      expect(pnl.breakdown).toBeDefined();
    });

    it('should get gas estimates', async () => {
      const estimates = await dexService.getGasEstimates({
        swap: { tokenIn: MOCK_TOKENS.ethereum.USDC.address, tokenOut: 'XOM' },
        addLiquidity: true,
        removeLiquidity: true,
        stake: true
      });

      expect(estimates).toBeDefined();
      expect(estimates.swap).toBeDefined();
      expect(estimates.addLiquidity).toBeDefined();
      expect(estimates.removeLiquidity).toBeDefined();
      expect(estimates.stake).toBeDefined();
      
      Object.values(estimates).forEach(estimate => {
        if (estimate) {
          expect(estimate.gasLimit).toBeDefined();
          expect(estimate.gasPrice).toBeDefined();
          expect(estimate.totalCost).toBeDefined();
        }
      });
    });

    it('should export trading data', async () => {
      const exported = await dexService.exportTradingData(
        mockWallet.address,
        'csv'
      );

      expect(exported).toBeDefined();
      expect(exported.format).toBe('csv');
      expect(exported.data).toBeDefined();
      expect(exported.filename).toContain('.csv');
    });
  });
});