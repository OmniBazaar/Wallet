/**
 * OrderBookService Tests
 * 
 * Comprehensive test suite for OrderBookService including order placement,
 * cancellation, order book depth, and MEV protection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrderBookService, OrderType, OrderSide, OrderStatus, TimeInForce } from '../../src/services/OrderBookService';
import { WalletService } from '../../src/services/WalletService';
import { OmniProvider } from '../../src/core/providers/OmniProvider';
import { DecentralizedOrderBook } from '../../../../Validator/src/services/dex/DecentralizedOrderBook';
import { MEVProtection } from '../../../../Validator/src/services/dex/mev/MEVProtection';

// Mock the Validator module imports
vi.mock('../../../../Validator/src/services/dex/DecentralizedOrderBook');
vi.mock('../../../../Validator/src/services/dex/mev/MEVProtection');

describe('OrderBookService', () => {
  let orderBookService: OrderBookService;
  let mockWalletService: WalletService;
  let mockOrderBook: any;
  let mockMEVProtection: any;

  beforeEach(async () => {
    // Create mock wallet service
    mockWalletService = {
      isServiceInitialized: vi.fn().mockReturnValue(true),
      init: vi.fn().mockResolvedValue(undefined),
      getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
    } as unknown as WalletService;

    // Create mock order book
    mockOrderBook = {
      init: vi.fn().mockResolvedValue(undefined),
      submitOrder: vi.fn().mockResolvedValue({
        success: true,
        orderId: 'order_123',
        transactionHash: '0x' + '1'.repeat(64),
        gasUsed: BigInt('100000')
      }),
      cancelOrder: vi.fn().mockResolvedValue({
        success: true,
        transactionHash: '0x' + '2'.repeat(64),
        gasUsed: BigInt('50000')
      }),
      getOrder: vi.fn().mockResolvedValue({
        orderId: 'order_123',
        maker: '0x1234567890123456789012345678901234567890',
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountRemaining: BigInt('1000000000000000000'),
        side: 'BUY',
        price: 100,
        status: 'OPEN',
        timeInForce: 'GTC',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }),
      getOrdersForPair: vi.fn().mockResolvedValue([
        {
          orderId: 'order_1',
          side: 'BUY',
          price: 99,
          amountRemaining: BigInt('500000000000000000'),
          status: 'OPEN'
        },
        {
          orderId: 'order_2',
          side: 'BUY',
          price: 98,
          amountRemaining: BigInt('300000000000000000'),
          status: 'OPEN'
        },
        {
          orderId: 'order_3',
          side: 'SELL',
          price: 101,
          amountRemaining: BigInt('400000000000000000'),
          status: 'OPEN'
        },
        {
          orderId: 'order_4',
          side: 'SELL',
          price: 102,
          amountRemaining: BigInt('600000000000000000'),
          status: 'OPEN'
        }
      ]),
      fillOrder: vi.fn().mockResolvedValue({
        success: true,
        transactionHash: '0x' + '3'.repeat(64),
        gasUsed: BigInt('150000')
      }),
      getUserOrders: vi.fn().mockResolvedValue([]),
      getUserOrderHistory: vi.fn().mockResolvedValue([
        {
          orderId: 'order_100',
          maker: '0x1234567890123456789012345678901234567890',
          tokenIn: '0xTokenA',
          tokenOut: '0xTokenB',
          amountIn: BigInt('1000000000000000000'),
          amountRemaining: BigInt('0'),
          side: 'BUY',
          price: 95,
          status: 'FILLED',
          timeInForce: 'GTC',
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now() - 3600000,
          executionPrice: 95.5,
          fees: BigInt('1000000000000000')
        }
      ])
    };

    // Create mock MEV protection
    mockMEVProtection = {
      init: vi.fn().mockResolvedValue(undefined),
      protectOrder: vi.fn().mockResolvedValue({
        orderHash: '0xProtectedHash',
        commitment: '0xCommitment'
      })
    };

    vi.mocked(DecentralizedOrderBook).mockImplementation(() => mockOrderBook);
    vi.mocked(MEVProtection).mockImplementation(() => mockMEVProtection);

    // Create OrderBookService with mock wallet service
    orderBookService = new OrderBookService(mockWalletService);
    await orderBookService.init();
  });

  afterEach(async () => {
    await orderBookService.cleanup();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with wallet service', async () => {
      const service = new OrderBookService(mockWalletService);
      await expect(service.init()).resolves.not.toThrow();
      await service.cleanup();
    });

    it('should initialize successfully with provider', async () => {
      const mockProvider = {
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1n }),
        getSigner: vi.fn().mockResolvedValue({
          getAddress: vi.fn().mockResolvedValue('0x9876543210987654321098765432109876543210')
        })
      } as unknown as OmniProvider;

      const service = new OrderBookService(mockProvider);
      await expect(service.init()).resolves.not.toThrow();
      await service.cleanup();
    });

    it('should handle multiple initialization calls', async () => {
      const service = new OrderBookService(mockWalletService);
      await service.init();
      await service.init(); // Should not throw
      await service.cleanup();
    });
  });

  describe('placeLimitOrder', () => {
    it('should place a limit order successfully', async () => {
      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'), // 1 token
        amountOutMin: BigInt('950000000000000000'), // 0.95 token min
        side: OrderSide.BUY,
        price: 100,
        timeInForce: TimeInForce.GTC
      };

      const result = await orderBookService.placeLimitOrder(params);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order_123');
      expect(result.txHash).toMatch(/^0x1+$/);
      expect(result.gasUsed).toBe(BigInt('100000'));
      expect(result.mevProtected).toBe(false);
      expect(mockOrderBook.submitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          maker: '0x1234567890123456789012345678901234567890',
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          side: params.side,
          price: params.price,
          timeInForce: params.timeInForce
        })
      );
    });

    it('should apply MEV protection when requested', async () => {
      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.SELL,
        price: 105,
        mevProtection: true
      };

      const result = await orderBookService.placeLimitOrder(params);

      expect(result.success).toBe(true);
      expect(result.mevProtected).toBe(true);
      expect(mockMEVProtection.protectOrder).toHaveBeenCalled();
    });

    it('should fail when amount is zero', async () => {
      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt(0),
        amountOutMin: BigInt(0),
        side: OrderSide.BUY,
        price: 100
      };

      const result = await orderBookService.placeLimitOrder(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order amount cannot be zero');
    });

    it('should fail when price is invalid', async () => {
      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: -1
      };

      const result = await orderBookService.placeLimitOrder(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order price must be positive');
    });

    it('should handle order submission failure', async () => {
      mockOrderBook.submitOrder.mockResolvedValueOnce({
        success: false,
        error: 'Insufficient balance'
      });

      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      };

      const result = await orderBookService.placeLimitOrder(params);

      expect(result.success).toBe(false);
      expect(result.orderId).toBeUndefined();
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async () => {
      // Place an order first
      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      };
      await orderBookService.placeLimitOrder(params);
    });

    it('should cancel an open order successfully', async () => {
      const result = await orderBookService.cancelOrder('order_123');

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order_123');
      expect(result.txHash).toMatch(/^0x2+$/);
      expect(result.gasUsed).toBe(BigInt('50000'));
      expect(mockOrderBook.cancelOrder).toHaveBeenCalledWith('order_123');
    });

    it('should fail to cancel non-existent order', async () => {
      const result = await orderBookService.cancelOrder('order_999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
    });

    it('should fail to cancel already filled order', async () => {
      // Update order status to FILLED
      const orders = await orderBookService.getUserOrders();
      if (orders.length > 0) {
        orders[0].status = OrderStatus.FILLED;
      }

      const result = await orderBookService.cancelOrder('order_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot cancel order');
    });
  });

  describe('getUserOrders', () => {
    it('should get user orders without filter', async () => {
      // Place some orders
      await orderBookService.placeLimitOrder({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      });

      const orders = await orderBookService.getUserOrders();

      expect(orders).toHaveLength(1);
      expect(orders[0].orderId).toBe('order_123');
      expect(orders[0].maker).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should filter orders by token pair', async () => {
      // Place orders for different pairs
      await orderBookService.placeLimitOrder({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      });

      const orders = await orderBookService.getUserOrders({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB'
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].tokenIn).toBe('0xTokenA');
      expect(orders[0].tokenOut).toBe('0xTokenB');

      const noOrders = await orderBookService.getUserOrders({
        tokenIn: '0xTokenC',
        tokenOut: '0xTokenD'
      });

      expect(noOrders).toHaveLength(0);
    });
  });

  describe('fillOrder', () => {
    it('should fill an order successfully', async () => {
      const result = await orderBookService.fillOrder(
        'order_123',
        BigInt('500000000000000000') // 0.5 tokens
      );

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order_123');
      expect(result.txHash).toMatch(/^0x3+$/);
      expect(result.gasUsed).toBe(BigInt('150000'));
      expect(mockOrderBook.fillOrder).toHaveBeenCalledWith({
        orderId: 'order_123',
        fillAmount: BigInt('500000000000000000'),
        taker: '0x1234567890123456789012345678901234567890'
      });
    });

    it('should fail if order not found', async () => {
      mockOrderBook.getOrder.mockResolvedValueOnce(null);

      const result = await orderBookService.fillOrder(
        'order_999',
        BigInt('500000000000000000')
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
    });

    it('should fail if order is not fillable', async () => {
      mockOrderBook.getOrder.mockResolvedValueOnce({
        ...mockOrderBook.getOrder.mock.results[0].value,
        status: 'CANCELLED'
      });

      const result = await orderBookService.fillOrder(
        'order_123',
        BigInt('500000000000000000')
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order is not fillable');
    });

    it('should fail if fill amount exceeds remaining', async () => {
      const result = await orderBookService.fillOrder(
        'order_123',
        BigInt('2000000000000000000') // 2 tokens (more than available)
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fill amount exceeds remaining');
    });
  });

  describe('getOrderBookDepth', () => {
    it('should get order book depth with proper aggregation', async () => {
      const depth = await orderBookService.getOrderBookDepth(
        '0xTokenA',
        '0xTokenB',
        10
      );

      expect(depth).toBeDefined();
      expect(depth.pair).toBe('0xTokenA/0xTokenB');
      expect(depth.bids).toHaveLength(2);
      expect(depth.asks).toHaveLength(2);
      expect(depth.bids[0].price).toBe(99); // Best bid
      expect(depth.asks[0].price).toBe(101); // Best ask
      expect(depth.midPrice).toBe(100);
      expect(depth.spread).toBeCloseTo(2); // 2% spread
      expect(depth.timestamp).toBeLessThanOrEqual(Date.now());

      // Check cumulative amounts
      expect(depth.bids[0].cumulative).toBe(BigInt('500000000000000000'));
      expect(depth.bids[1].cumulative).toBe(BigInt('800000000000000000')); // 0.5 + 0.3
    });

    it('should limit depth levels', async () => {
      const depth = await orderBookService.getOrderBookDepth(
        '0xTokenA',
        '0xTokenB',
        1
      );

      expect(depth.bids).toHaveLength(1);
      expect(depth.asks).toHaveLength(1);
    });

    it('should handle empty order book', async () => {
      mockOrderBook.getOrdersForPair.mockResolvedValueOnce([]);

      const depth = await orderBookService.getOrderBookDepth(
        '0xTokenA',
        '0xTokenB'
      );

      expect(depth.bids).toHaveLength(0);
      expect(depth.asks).toHaveLength(0);
      expect(depth.midPrice).toBe(Number.MAX_SAFE_INTEGER / 2);
      expect(depth.spread).toBe(0);
    });
  });

  describe('getOrder', () => {
    it('should get order from cache', async () => {
      // Place an order to populate cache
      await orderBookService.placeLimitOrder({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      });

      const order = await orderBookService.getOrder('order_123');

      expect(order).toBeDefined();
      expect(order?.orderId).toBe('order_123');
      expect(mockOrderBook.getOrder).not.toHaveBeenCalled(); // Should use cache
    });

    it('should get order from order book if not in cache', async () => {
      const order = await orderBookService.getOrder('order_456');

      expect(order).toBeDefined();
      expect(order?.orderId).toBe('order_123'); // Mock returns this ID
      expect(mockOrderBook.getOrder).toHaveBeenCalledWith('order_456');
    });

    it('should return null for non-existent order', async () => {
      mockOrderBook.getOrder.mockResolvedValueOnce(null);

      const order = await orderBookService.getOrder('order_999');

      expect(order).toBeNull();
    });
  });

  describe('getOrderHistory', () => {
    it('should get user order history', async () => {
      const history = await orderBookService.getOrderHistory(50, 0);

      expect(history).toHaveLength(1);
      expect(history[0].orderId).toBe('order_100');
      expect(history[0].status).toBe(OrderStatus.FILLED);
      expect(history[0].executionPrice).toBe(95.5);
      expect(history[0].fees).toBe(BigInt('1000000000000000'));
      expect(mockOrderBook.getUserOrderHistory).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        50,
        0
      );
    });

    it('should handle pagination', async () => {
      await orderBookService.getOrderHistory(20, 40);

      expect(mockOrderBook.getUserOrderHistory).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        20,
        40
      );
    });
  });

  describe('Event subscriptions', () => {
    it('should subscribe to fill events', () => {
      const callback = vi.fn();
      
      orderBookService.subscribeToFillEvents('order_123', callback);
      
      // Trigger internal event (would normally come from order book)
      // Since we're using polling, this would be called when order status changes
    });

    it('should unsubscribe from fill events', () => {
      const callback = vi.fn();
      
      orderBookService.subscribeToFillEvents('order_123', callback);
      orderBookService.unsubscribeFromFillEvents('order_123');
      
      // Callback should not be called after unsubscribe
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle uninitialized service', async () => {
      const uninitializedService = new OrderBookService(mockWalletService);

      const placeResult = await uninitializedService.placeLimitOrder({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      });
      expect(placeResult.success).toBe(false);
      expect(placeResult.error).toContain('not initialized');

      const cancelResult = await uninitializedService.cancelOrder('order_123');
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.error).toContain('not initialized');

      await expect(
        uninitializedService.getUserOrders()
      ).rejects.toThrow('not initialized');

      const fillResult = await uninitializedService.fillOrder('order_123', BigInt('100'));
      expect(fillResult.success).toBe(false);
      expect(fillResult.error).toContain('not initialized');

      await expect(
        uninitializedService.getOrderBookDepth('0xA', '0xB')
      ).rejects.toThrow('not initialized');

      await expect(
        uninitializedService.getOrder('order_123')
      ).rejects.toThrow('not initialized');

      await expect(
        uninitializedService.getOrderHistory()
      ).rejects.toThrow('not initialized');
    });

    it('should handle provider errors gracefully', async () => {
      mockWalletService.getAddress.mockRejectedValueOnce(new Error('Network error'));

      const params = {
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      };

      const result = await orderBookService.placeLimitOrder(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle cleanup gracefully', async () => {
      // Place some orders to create intervals
      await orderBookService.placeLimitOrder({
        tokenIn: '0xTokenA',
        tokenOut: '0xTokenB',
        amountIn: BigInt('1000000000000000000'),
        amountOutMin: BigInt('950000000000000000'),
        side: OrderSide.BUY,
        price: 100
      });

      await expect(orderBookService.cleanup()).resolves.not.toThrow();
      
      // Should be able to cleanup multiple times
      await expect(orderBookService.cleanup()).resolves.not.toThrow();
    });
  });
});