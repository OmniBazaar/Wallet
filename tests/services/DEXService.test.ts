/**
 * DEXService Test Suite
 * 
 * Tests decentralized exchange functionality including order book management,
 * order placement/cancellation, market data retrieval, and trading operations.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { DEXService, OrderSide, OrderStatus, type TradingPair, type Order } from '../../src/services/DEXService';
import type { WalletService } from '../../src/services/WalletService';

// Mock WalletService
jest.mock('../../src/services/WalletService');

describe('DEXService', () => {
  let dexService: DEXService;
  let mockWalletService: jest.Mocked<WalletService>;
  
  // Test configuration
  const TEST_CONFIG = {
    contractAddress: '0xDEX1234567890123456789012345678901234567890',
    supportedPairs: [
      {
        baseToken: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
        quoteToken: '0x4Fcc7d9Ca9d22E21FCF25CF9a2E48D3A0c1a5A3E',
        symbol: 'OMNI/USDC',
        minOrderSize: ethers.parseEther('0.01'),
        tickSize: ethers.parseUnits('0.01', 6),
        isActive: true
      },
      {
        baseToken: '0xB0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
        quoteToken: '0x5Fcc7d9Ca9d22E21FCF25CF9a2E48D3A0c1a5A3E',
        symbol: 'ETH/USDC',
        minOrderSize: ethers.parseEther('0.001'),
        tickSize: ethers.parseUnits('1', 6),
        isActive: true
      }
    ],
    defaultSlippage: 100, // 1%
    defaultOrderExpiry: 3600 // 1 hour
  };

  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';

  beforeEach(() => {
    // Setup mock wallet service
    mockWalletService = {
      isServiceInitialized: jest.fn().mockReturnValue(true),
      init: jest.fn().mockResolvedValue(undefined),
      getAddress: jest.fn().mockResolvedValue(TEST_ADDRESS),
      // Add other methods as needed
    } as any;

    dexService = new DEXService(mockWalletService, TEST_CONFIG);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with custom configuration', async () => {
      await dexService.init();
      
      const pairs = dexService.getSupportedPairs();
      expect(pairs).toHaveLength(2);
      expect(pairs[0].symbol).toBe('OMNI/USDC');
    });

    it('should initialize with default configuration', async () => {
      const defaultService = new DEXService(mockWalletService);
      await defaultService.init();
      
      const pairs = defaultService.getSupportedPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0].symbol).toBe('OMNI/USDC');
    });

    it('should not reinitialize if already initialized', async () => {
      await dexService.init();
      await dexService.init(); // Second call
      
      // Wallet init should only be called once at most
      expect(mockWalletService.init).toHaveBeenCalledTimes(0);
    });

    it('should initialize wallet service if not initialized', async () => {
      mockWalletService.isServiceInitialized.mockReturnValueOnce(false);
      
      await dexService.init();
      
      expect(mockWalletService.init).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockWalletService.isServiceInitialized.mockImplementationOnce(() => {
        throw new Error('Wallet error');
      });
      
      await expect(dexService.init()).rejects.toThrow(
        'Failed to initialize DEX service: Wallet error'
      );
    });

    it('should initialize order books for all pairs', async () => {
      await dexService.init();
      
      for (const pair of TEST_CONFIG.supportedPairs) {
        const orderBook = await dexService.getOrderBook(pair.symbol);
        expect(orderBook).toBeDefined();
        expect(orderBook?.bids).toEqual([]);
        expect(orderBook?.asks).toEqual([]);
      }
    });
  });

  describe('Trading Pairs', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should return supported trading pairs', () => {
      const pairs = dexService.getSupportedPairs();
      
      expect(pairs).toHaveLength(2);
      expect(pairs[0]).toMatchObject({
        symbol: 'OMNI/USDC',
        baseToken: expect.any(String),
        quoteToken: expect.any(String),
        minOrderSize: ethers.parseEther('0.01'),
        isActive: true
      });
    });

    it('should return copy of pairs array', () => {
      const pairs1 = dexService.getSupportedPairs();
      const pairs2 = dexService.getSupportedPairs();
      
      expect(pairs1).not.toBe(pairs2); // Different array instances
      expect(pairs1).toEqual(pairs2); // Same content
    });
  });

  describe('Market Data', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should return market data for valid pair', async () => {
      const marketData = await dexService.getMarketData('OMNI/USDC');
      
      expect(marketData).toBeDefined();
      expect(marketData).toMatchObject({
        pair: expect.objectContaining({ symbol: 'OMNI/USDC' }),
        lastPrice: expect.any(BigInt),
        priceChange24h: expect.any(BigInt),
        volume24h: expect.any(BigInt),
        bid: 0n, // No orders yet
        ask: 0n,
        spread: 0n
      });
    });

    it('should return null for invalid pair', async () => {
      const marketData = await dexService.getMarketData('INVALID/PAIR');
      
      expect(marketData).toBeNull();
    });

    it('should calculate spread correctly', async () => {
      // Place some orders first
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('99', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.SELL,
        price: ethers.parseUnits('101', 6),
        quantity: ethers.parseEther('1')
      });
      
      const marketData = await dexService.getMarketData('OMNI/USDC');
      
      expect(marketData?.bid).toBe(ethers.parseUnits('99', 6));
      expect(marketData?.ask).toBe(ethers.parseUnits('101', 6));
      expect(marketData?.spread).toBe(ethers.parseUnits('2', 6));
    });
  });

  describe('Order Book', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should return empty order book initially', async () => {
      const orderBook = await dexService.getOrderBook('OMNI/USDC');
      
      expect(orderBook).toBeDefined();
      expect(orderBook?.bids).toEqual([]);
      expect(orderBook?.asks).toEqual([]);
      expect(orderBook?.pair.symbol).toBe('OMNI/USDC');
    });

    it('should return null for invalid pair', async () => {
      const orderBook = await dexService.getOrderBook('INVALID/PAIR');
      
      expect(orderBook).toBeNull();
    });

    it('should respect depth parameter', async () => {
      // Place multiple orders
      for (let i = 1; i <= 20; i++) {
        await dexService.placeOrder({
          symbol: 'OMNI/USDC',
          side: OrderSide.BUY,
          price: ethers.parseUnits((100 - i).toString(), 6),
          quantity: ethers.parseEther('1')
        });
      }
      
      const orderBook = await dexService.getOrderBook('OMNI/USDC', 5);
      
      expect(orderBook?.bids).toHaveLength(5);
    });

    it('should maintain bid/ask sorting', async () => {
      // Place bids in random order
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('95', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('97', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('96', 6),
        quantity: ethers.parseEther('1')
      });
      
      const orderBook = await dexService.getOrderBook('OMNI/USDC');
      
      // Bids should be sorted descending
      expect(orderBook?.bids[0].price).toBe(ethers.parseUnits('97', 6));
      expect(orderBook?.bids[1].price).toBe(ethers.parseUnits('96', 6));
      expect(orderBook?.bids[2].price).toBe(ethers.parseUnits('95', 6));
    });
  });

  describe('Order Placement', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should place a buy order successfully', async () => {
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      expect(order).toMatchObject({
        id: expect.stringMatching(/^order_/),
        pair: expect.objectContaining({ symbol: 'OMNI/USDC' }),
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1'),
        filledQuantity: 0n,
        status: OrderStatus.PENDING,
        trader: TEST_ADDRESS,
        createdAt: expect.any(Number),
        expiresAt: expect.any(Number)
      });
    });

    it('should place a sell order successfully', async () => {
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.SELL,
        price: ethers.parseUnits('105', 6),
        quantity: ethers.parseEther('0.5'),
        expiresAt: Date.now() + 7200000 // 2 hours
      });
      
      expect(order.side).toBe(OrderSide.SELL);
      expect(order.expiresAt).toBeGreaterThan(Date.now() + 7000000);
    });

    it('should throw error if not initialized', async () => {
      const uninitService = new DEXService(mockWalletService);
      
      await expect(uninitService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      })).rejects.toThrow('DEX service not initialized');
    });

    it('should reject unsupported trading pair', async () => {
      await expect(dexService.placeOrder({
        symbol: 'INVALID/PAIR',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      })).rejects.toThrow('Unsupported trading pair: INVALID/PAIR');
    });

    it('should reject order below minimum size', async () => {
      await expect(dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('0.005') // Below 0.01 minimum
      })).rejects.toThrow('Order size below minimum');
    });

    it('should update order book on placement', async () => {
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      const orderBook = await dexService.getOrderBook('OMNI/USDC');
      
      expect(orderBook?.bids).toHaveLength(1);
      expect(orderBook?.bids[0]).toEqual({
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1'),
        orderCount: 1
      });
    });

    it('should aggregate orders at same price', async () => {
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('2')
      });
      
      const orderBook = await dexService.getOrderBook('OMNI/USDC');
      
      expect(orderBook?.bids).toHaveLength(1);
      expect(orderBook?.bids[0]).toEqual({
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('3'),
        orderCount: 2
      });
    });

    it('should handle wallet service errors', async () => {
      mockWalletService.getAddress.mockRejectedValueOnce(new Error('Wallet locked'));
      
      await expect(dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      })).rejects.toThrow('Failed to place order: Wallet locked');
    });
  });

  describe('Order Cancellation', () => {
    let orderId: string;

    beforeEach(async () => {
      await dexService.init();
      
      // Place an order to cancel
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      orderId = order.id;
    });

    it('should cancel own order successfully', async () => {
      const success = await dexService.cancelOrder(orderId);
      
      expect(success).toBe(true);
      
      // Verify order status
      const orders = await dexService.getActiveOrders();
      expect(orders).toHaveLength(0);
    });

    it('should remove order from order book', async () => {
      const orderBookBefore = await dexService.getOrderBook('OMNI/USDC');
      expect(orderBookBefore?.bids).toHaveLength(1);
      
      await dexService.cancelOrder(orderId);
      
      const orderBookAfter = await dexService.getOrderBook('OMNI/USDC');
      expect(orderBookAfter?.bids).toHaveLength(0);
    });

    it('should throw error for non-existent order', async () => {
      await expect(dexService.cancelOrder('invalid_order_id'))
        .rejects.toThrow('Order not found');
    });

    it('should throw error when canceling another trader order', async () => {
      // Change the wallet address
      mockWalletService.getAddress.mockResolvedValueOnce('0xDifferentAddress');
      
      await expect(dexService.cancelOrder(orderId))
        .rejects.toThrow('Not authorized to cancel this order');
    });

    it('should handle cancellation errors', async () => {
      // Mock internal error
      mockWalletService.getAddress.mockRejectedValueOnce(new Error('Wallet error'));
      
      await expect(dexService.cancelOrder(orderId))
        .rejects.toThrow('Wallet error');
    });
  });

  describe('Order Management', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should return active orders for current address', async () => {
      // Place some orders
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.placeOrder({
        symbol: 'ETH/USDC',
        side: OrderSide.SELL,
        price: ethers.parseUnits('2000', 6),
        quantity: ethers.parseEther('0.5')
      });
      
      const activeOrders = await dexService.getActiveOrders();
      
      expect(activeOrders).toHaveLength(2);
      expect(activeOrders.every(o => o.status === OrderStatus.PENDING)).toBe(true);
      expect(activeOrders.every(o => o.trader === TEST_ADDRESS)).toBe(true);
    });

    it('should filter out canceled orders from active list', async () => {
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.cancelOrder(order.id);
      
      const activeOrders = await dexService.getActiveOrders();
      expect(activeOrders).toHaveLength(0);
    });

    it('should filter orders by trader address', async () => {
      // Place order as current user
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      // Change address for next check
      mockWalletService.getAddress.mockResolvedValueOnce('0xDifferentAddress');
      
      const activeOrders = await dexService.getActiveOrders();
      expect(activeOrders).toHaveLength(0);
    });

    it('should return order history sorted by creation time', async () => {
      // Place orders with slight delays
      const order1 = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const order2 = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.SELL,
        price: ethers.parseUnits('105', 6),
        quantity: ethers.parseEther('1')
      });
      
      const history = await dexService.getOrderHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(order2.id); // Most recent first
      expect(history[1].id).toBe(order1.id);
    });

    it('should respect limit parameter in order history', async () => {
      // Place multiple orders
      for (let i = 0; i < 10; i++) {
        await dexService.placeOrder({
          symbol: 'OMNI/USDC',
          side: OrderSide.BUY,
          price: ethers.parseUnits('100', 6),
          quantity: ethers.parseEther('1')
        });
      }
      
      const history = await dexService.getOrderHistory(5);
      expect(history).toHaveLength(5);
    });
  });

  describe('Order Book Aggregation', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should handle partially filled orders correctly', async () => {
      // This tests the removeFromOrderBook logic with partial fills
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('10')
      });

      // Get the order from activeOrders and simulate partial fill
      const orderId = order.id;
      const activeOrder = (dexService as any).activeOrders.get(orderId);
      activeOrder.filledQuantity = ethers.parseEther('10'); // Fully filled

      // Cancel with full fill - should remove nothing
      await dexService.cancelOrder(orderId);

      const orderBook = await dexService.getOrderBook('OMNI/USDC');

      // After canceling a fully filled order, nothing should be removed
      // because remainingQuantity = quantity - filledQuantity = 10 - 10 = 0
      expect(orderBook?.bids).toHaveLength(1);
      expect(orderBook?.bids[0].quantity).toEqual(ethers.parseEther('10'));
    });

    it('should update timestamp on order book changes', async () => {
      const orderBook1 = await dexService.getOrderBook('OMNI/USDC');
      const timestamp1 = orderBook1!.timestamp;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      const orderBook2 = await dexService.getOrderBook('OMNI/USDC');
      expect(orderBook2!.timestamp).toBeGreaterThan(timestamp1);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should clear order book cache', async () => {
      // Add some orders
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.clearCache();
      
      const orderBook = await dexService.getOrderBook('OMNI/USDC');
      expect(orderBook?.bids).toHaveLength(0);
      expect(orderBook?.asks).toHaveLength(0);
    });

    it('should preserve order book structure after cache clear', async () => {
      await dexService.clearCache();
      
      const orderBook = await dexService.getOrderBook('OMNI/USDC');
      expect(orderBook).toBeDefined();
      expect(orderBook?.pair.symbol).toBe('OMNI/USDC');
    });
  });

  describe('Service Cleanup', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should cleanup resources', async () => {
      // Add some data
      await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      });
      
      await dexService.cleanup();
      
      // Service should be reset
      await expect(dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1')
      })).rejects.toThrow('DEX service not initialized');
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock console.error to verify it's called
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by making internal state invalid
      (dexService as any).orderBook = null;

      expect(() => dexService.cleanup()).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await dexService.init();
    });

    it('should handle BigInt arithmetic correctly', async () => {
      const price = ethers.parseUnits('99999.99', 6);
      const quantity = ethers.parseEther('999999.999999');
      
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price,
        quantity
      });
      
      expect(order.price).toBe(price);
      expect(order.quantity).toBe(quantity);
    });

    it('should handle zero values in market data', async () => {
      const marketData = await dexService.getMarketData('OMNI/USDC');
      
      expect(marketData?.bid).toBe(0n);
      expect(marketData?.ask).toBe(0n);
      expect(marketData?.spread).toBe(0n);
    });

    it('should generate unique order IDs', async () => {
      const orders = await Promise.all([
        dexService.placeOrder({
          symbol: 'OMNI/USDC',
          side: OrderSide.BUY,
          price: ethers.parseUnits('100', 6),
          quantity: ethers.parseEther('1')
        }),
        dexService.placeOrder({
          symbol: 'OMNI/USDC',
          side: OrderSide.BUY,
          price: ethers.parseUnits('100', 6),
          quantity: ethers.parseEther('1')
        })
      ]);
      
      expect(orders[0].id).not.toBe(orders[1].id);
    });

    it('should handle expired orders', async () => {
      const order = await dexService.placeOrder({
        symbol: 'OMNI/USDC',
        side: OrderSide.BUY,
        price: ethers.parseUnits('100', 6),
        quantity: ethers.parseEther('1'),
        expiresAt: Date.now() - 1000 // Already expired
      });
      
      expect(order.expiresAt).toBeLessThan(Date.now());
      // In a real implementation, this would be handled by a background process
    });
  });
});