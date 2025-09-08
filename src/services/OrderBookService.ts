/**
 * OrderBookService - Order Book Management Service
 * 
 * Provides order book functionality for decentralized trading,
 * including order management, matching, and market data.
 */

import { WalletService } from './WalletService';
import { ethers } from 'ethers';

/** Order side enumeration */
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

/** Order type enumeration */
export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
  STOP_LOSS = 'stop_loss',
  TAKE_PROFIT = 'take_profit'
}

/** Order status enumeration */
export enum OrderStatus {
  PENDING = 'pending',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  REJECTED = 'rejected'
}

/** Trading pair information */
export interface TradingPair {
  /** Base token address */
  baseToken: string;
  /** Quote token address */
  quoteToken: string;
  /** Trading pair symbol */
  symbol: string;
  /** Base token symbol */
  baseSymbol: string;
  /** Quote token symbol */
  quoteSymbol: string;
  /** Minimum order size */
  minOrderSize: bigint;
  /** Maximum order size */
  maxOrderSize: bigint;
  /** Price tick size */
  tickSize: bigint;
  /** Whether pair is active */
  isActive: boolean;
  /** Maker fee (in basis points) */
  makerFee: number;
  /** Taker fee (in basis points) */
  takerFee: number;
}

/** Order information */
export interface Order {
  /** Unique order ID */
  id: string;
  /** Trading pair */
  pair: TradingPair;
  /** Order side */
  side: OrderSide;
  /** Order type */
  type: OrderType;
  /** Order price (for limit orders) */
  price: bigint;
  /** Order quantity */
  quantity: bigint;
  /** Filled quantity */
  filledQuantity: bigint;
  /** Remaining quantity */
  remainingQuantity: bigint;
  /** Order status */
  status: OrderStatus;
  /** Order creator address */
  trader: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Stop price (for stop orders) */
  stopPrice?: bigint;
  /** Transaction hash */
  txHash?: string;
  /** Average fill price */
  avgFillPrice?: bigint;
  /** Total fees paid */
  totalFees?: bigint;
}

/** Order book level */
export interface OrderBookLevel {
  /** Price level */
  price: bigint;
  /** Total quantity at this level */
  quantity: bigint;
  /** Number of orders at this level */
  orderCount: number;
  /** Orders at this level */
  orders: Order[];
}

/** Order book data */
export interface OrderBook {
  /** Trading pair */
  pair: TradingPair;
  /** Buy orders (bids) */
  bids: OrderBookLevel[];
  /** Sell orders (asks) */
  asks: OrderBookLevel[];
  /** Last update timestamp */
  timestamp: number;
  /** Sequence number for ordering */
  sequence: number;
}

/** Market statistics */
export interface MarketStats {
  /** Trading pair */
  pair: TradingPair;
  /** Last traded price */
  lastPrice: bigint;
  /** 24h price change */
  priceChange24h: bigint;
  /** 24h percentage change */
  percentChange24h: number;
  /** 24h high price */
  high24h: bigint;
  /** 24h low price */
  low24h: bigint;
  /** 24h volume */
  volume24h: bigint;
  /** Best bid price */
  bestBid: bigint;
  /** Best ask price */
  bestAsk: bigint;
  /** Bid-ask spread */
  spread: bigint;
}

/** Order placement parameters */
export interface PlaceOrderParams {
  /** Trading pair symbol */
  symbol: string;
  /** Order side */
  side: OrderSide;
  /** Order type */
  type: OrderType;
  /** Order quantity */
  quantity: bigint;
  /** Order price (for limit orders) */
  price?: bigint;
  /** Stop price (for stop orders) */
  stopPrice?: bigint;
  /** Expiration timestamp */
  expiresAt?: number;
}

/** Trade execution information */
export interface Trade {
  /** Trade ID */
  id: string;
  /** Trading pair */
  pair: TradingPair;
  /** Maker order ID */
  makerOrderId: string;
  /** Taker order ID */
  takerOrderId: string;
  /** Trade price */
  price: bigint;
  /** Trade quantity */
  quantity: bigint;
  /** Maker address */
  maker: string;
  /** Taker address */
  taker: string;
  /** Trade timestamp */
  timestamp: number;
  /** Maker fee */
  makerFee: bigint;
  /** Taker fee */
  takerFee: bigint;
  /** Transaction hash */
  txHash: string;
}

/**
 * Order book management service
 */
export class OrderBookService {
  private walletService: WalletService;
  private isInitialized = false;
  private orderBooks: Map<string, OrderBook> = new Map();
  private activeOrders: Map<string, Order> = new Map();
  private trades: Map<string, Trade[]> = new Map();
  private supportedPairs: Map<string, TradingPair> = new Map();
  private sequenceNumber = 0;

  /**
   * Creates a new OrderBookService instance
   * @param walletService - Wallet service instance
   */
  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Initialize the order book service
   * @throws {Error} When initialization fails
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Ensure wallet service is initialized
      if (!this.walletService.isServiceInitialized()) {
        await this.walletService.init();
      }

      // Initialize supported trading pairs
      await this.loadSupportedPairs();

      // Initialize order books for all pairs
      for (const pair of this.supportedPairs.values()) {
        this.orderBooks.set(pair.symbol, {
          pair,
          bids: [],
          asks: [],
          timestamp: Date.now(),
          sequence: this.sequenceNumber++
        });
      }

      // Load active orders
      await this.loadActiveOrders();

      this.isInitialized = true;
      // console.log('OrderBookService initialized with', this.supportedPairs.size, 'trading pairs');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize order book service: ${errorMessage}`);
    }
  }

  /**
   * Get supported trading pairs
   * @returns Array of trading pairs
   */
  getSupportedPairs(): TradingPair[] {
    return Array.from(this.supportedPairs.values());
  }

  /**
   * Get trading pair by symbol
   * @param symbol - Trading pair symbol
   * @returns Trading pair or null if not found
   */
  getPair(symbol: string): TradingPair | null {
    return this.supportedPairs.get(symbol) || null;
  }

  /**
   * Get order book for a trading pair
   * @param symbol - Trading pair symbol
   * @param depth - Number of levels to return (default: 20)
   * @returns Order book data
   */
  getOrderBook(symbol: string, depth: number = 20): OrderBook | null {
    const orderBook = this.orderBooks.get(symbol);
    if (!orderBook) {
      return null;
    }

    return {
      ...orderBook,
      bids: orderBook.bids.slice(0, depth),
      asks: orderBook.asks.slice(0, depth)
    };
  }

  /**
   * Place a new order
   * @param params - Order placement parameters
   * @returns Created order
   * @throws {Error} When order placement fails
   */
  async placeOrder(params: PlaceOrderParams): Promise<Order> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    const pair = this.supportedPairs.get(params.symbol);
    if (!pair) {
      throw new Error(`Unsupported trading pair: ${params.symbol}`);
    }

    if (params.quantity < pair.minOrderSize) {
      throw new Error('Order size below minimum');
    }

    if (params.quantity > pair.maxOrderSize) {
      throw new Error('Order size above maximum');
    }

    try {
      const address = await this.walletService.getAddress();
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const order: Order = {
        id: orderId,
        pair,
        side: params.side,
        type: params.type,
        price: params.price || 0n,
        quantity: params.quantity,
        filledQuantity: 0n,
        remainingQuantity: params.quantity,
        status: OrderStatus.PENDING,
        trader: address,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: params.expiresAt,
        stopPrice: params.stopPrice
      };

      // Add to active orders
      this.activeOrders.set(orderId, order);

      // Add to order book if it's a limit order
      if (params.type === OrderType.LIMIT) {
        this.addOrderToBook(order);
      }

      // Try to match the order
      await this.matchOrder(order);

      // console.log(`Order placed: ${orderId} - ${params.side} ${params.quantity} ${params.symbol} @ ${params.price || 'market'}`);
      return order;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to place order: ${errorMessage}`);
    }
  }

  /**
   * Cancel an existing order
   * @param orderId - Order ID to cancel
   * @returns Success status
   * @throws {Error} When cancellation fails
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const address = await this.walletService.getAddress();
    if (order.trader !== address) {
      throw new Error('Not authorized to cancel this order');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIALLY_FILLED) {
      throw new Error('Order cannot be canceled');
    }

    try {
      // Update order status
      order.status = OrderStatus.CANCELED;
      order.updatedAt = Date.now();
      this.activeOrders.set(orderId, order);

      // Remove from order book
      this.removeOrderFromBook(order);

      // console.log(`Order canceled: ${orderId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to cancel order: ${errorMessage}`);
    }
  }

  /**
   * Get active orders for current address
   * @param symbol - Trading pair symbol (optional)
   * @returns Array of active orders
   */
  async getActiveOrders(symbol?: string): Promise<Order[]> {
    const address = await this.walletService.getAddress();
    return Array.from(this.activeOrders.values()).filter(order => {
      const isMyOrder = order.trader === address;
      const isActive = order.status === OrderStatus.PENDING || order.status === OrderStatus.PARTIALLY_FILLED;
      const matchesSymbol = !symbol || order.pair.symbol === symbol;
      return isMyOrder && isActive && matchesSymbol;
    });
  }

  /**
   * Get order history for current address
   * @param symbol - Trading pair symbol (optional)
   * @param limit - Maximum number of orders to return
   * @returns Array of historical orders
   */
  async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
    const address = await this.walletService.getAddress();
    return Array.from(this.activeOrders.values())
      .filter(order => {
        const isMyOrder = order.trader === address;
        const matchesSymbol = !symbol || order.pair.symbol === symbol;
        return isMyOrder && matchesSymbol;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get trade history for a trading pair
   * @param symbol - Trading pair symbol
   * @param limit - Maximum number of trades to return
   * @returns Array of recent trades
   */
  getTradeHistory(symbol: string, limit: number = 100): Trade[] {
    const trades = this.trades.get(symbol) || [];
    return trades.slice(0, limit);
  }

  /**
   * Get market statistics for a trading pair
   * @param symbol - Trading pair symbol
   * @returns Market statistics
   */
  getMarketStats(symbol: string): MarketStats | null {
    const pair = this.supportedPairs.get(symbol);
    const orderBook = this.orderBooks.get(symbol);
    
    if (!pair || !orderBook) {
      return null;
    }

    // Mock market stats - in production would calculate from actual data
    const lastPrice = ethers.parseEther('100');
    const bestBid = orderBook.bids.length > 0 ? orderBook.bids[0].price : 0n;
    const bestAsk = orderBook.asks.length > 0 ? orderBook.asks[0].price : 0n;

    return {
      pair,
      lastPrice,
      priceChange24h: ethers.parseEther('5'),
      percentChange24h: 5.0,
      high24h: ethers.parseEther('105'),
      low24h: ethers.parseEther('95'),
      volume24h: ethers.parseEther('10000'),
      bestBid,
      bestAsk,
      spread: bestAsk > bestBid ? bestAsk - bestBid : 0n
    };
  }

  /**
   * Add order to order book
   * @param order
   * @private
   */
  private addOrderToBook(order: Order): void {
    const orderBook = this.orderBooks.get(order.pair.symbol);
    if (!orderBook) {
      return;
    }

    const levels = order.side === OrderSide.BUY ? orderBook.bids : orderBook.asks;
    
    // Find or create price level
    let level = levels.find(l => l.price === order.price);
    if (!level) {
      level = {
        price: order.price,
        quantity: 0n,
        orderCount: 0,
        orders: []
      };
      levels.push(level);
      
      // Sort levels (bids descending, asks ascending)
      if (order.side === OrderSide.BUY) {
        levels.sort((a, b) => b.price > a.price ? 1 : -1);
      } else {
        levels.sort((a, b) => a.price > b.price ? 1 : -1);
      }
    }

    // Add order to level
    level.orders.push(order);
    level.quantity += order.remainingQuantity;
    level.orderCount += 1;

    orderBook.timestamp = Date.now();
    orderBook.sequence = this.sequenceNumber++;
  }

  /**
   * Remove order from order book
   * @param order
   * @private
   */
  private removeOrderFromBook(order: Order): void {
    const orderBook = this.orderBooks.get(order.pair.symbol);
    if (!orderBook) {
      return;
    }

    const levels = order.side === OrderSide.BUY ? orderBook.bids : orderBook.asks;
    const level = levels.find(l => l.price === order.price);
    
    if (level) {
      const orderIndex = level.orders.findIndex(o => o.id === order.id);
      if (orderIndex >= 0) {
        level.orders.splice(orderIndex, 1);
        level.quantity -= order.remainingQuantity;
        level.orderCount -= 1;

        // Remove empty level
        if (level.orderCount === 0) {
          const levelIndex = levels.findIndex(l => l.price === order.price);
          if (levelIndex >= 0) {
            levels.splice(levelIndex, 1);
          }
        }
      }
    }

    orderBook.timestamp = Date.now();
    orderBook.sequence = this.sequenceNumber++;
  }

  /**
   * Match order against existing orders
   * @param order
   * @private
   */
  private async matchOrder(order: Order): Promise<void> {
    // Mock order matching - in production would implement proper matching engine
    // console.log(`Matching order: ${order.id}`);
    
    // For now, just update order status
    if (order.type === OrderType.MARKET) {
      order.status = OrderStatus.FILLED;
      order.filledQuantity = order.quantity;
      order.remainingQuantity = 0n;
      order.updatedAt = Date.now();
      this.activeOrders.set(order.id, order);
    }
  }

  /**
   * Load supported trading pairs
   * @private
   */
  private async loadSupportedPairs(): Promise<void> {
    // Mock trading pairs - in production would load from configuration or chain
    const mockPair: TradingPair = {
      baseToken: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
      quoteToken: '0x4Fcc7d9Ca9d22E21FCF25CF9a2E48D3A0c1a5A3E',
      symbol: 'OMNI/USDC',
      baseSymbol: 'OMNI',
      quoteSymbol: 'USDC',
      minOrderSize: ethers.parseEther('0.01'),
      maxOrderSize: ethers.parseEther('1000000'),
      tickSize: ethers.parseUnits('0.01', 6),
      isActive: true,
      makerFee: 10, // 0.1%
      takerFee: 20  // 0.2%
    };

    this.supportedPairs.set(mockPair.symbol, mockPair);
  }

  /**
   * Load active orders from storage
   * @private
   */
  private async loadActiveOrders(): Promise<void> {
    // Mock - in production would load from storage or blockchain
    this.activeOrders.clear();
  }

  /**
   * Clear all orders from order books
   */
  async clearOrders(): Promise<void> {
    for (const orderBook of this.orderBooks.values()) {
      orderBook.bids = [];
      orderBook.asks = [];
      orderBook.timestamp = Date.now();
      orderBook.sequence = this.sequenceNumber++;
    }
    this.activeOrders.clear();
    // console.log('OrderBookService orders cleared');
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      this.orderBooks.clear();
      this.activeOrders.clear();
      this.trades.clear();
      this.supportedPairs.clear();
      this.isInitialized = false;
      // console.log('OrderBookService cleanup completed');
    } catch (error) {
      console.error('Error during OrderBookService cleanup:', error);
    }
  }
}