/**
 * DEXService - Decentralized Exchange Service
 * 
 * Provides integration with decentralized exchange functionality,
 * order book management, and trading operations.
 */

import { WalletService } from './WalletService';
import { ethers } from 'ethers';

/** Order side enumeration */
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

/** Order status enumeration */
export enum OrderStatus {
  PENDING = 'pending',
  FILLED = 'filled',
  CANCELED = 'canceled',
  EXPIRED = 'expired'
}

/** Trading pair information */
export interface TradingPair {
  /** Base token address */
  baseToken: string;
  /** Quote token address */
  quoteToken: string;
  /** Trading pair symbol (e.g., ETH/USDC) */
  symbol: string;
  /** Minimum order size */
  minOrderSize: bigint;
  /** Tick size for price increments */
  tickSize: bigint;
  /** Whether pair is active */
  isActive: boolean;
}

/** Order information */
export interface Order {
  /** Unique order ID */
  id: string;
  /** Trading pair */
  pair: TradingPair;
  /** Order side (buy/sell) */
  side: OrderSide;
  /** Order price */
  price: bigint;
  /** Order quantity */
  quantity: bigint;
  /** Filled quantity */
  filledQuantity: bigint;
  /** Order status */
  status: OrderStatus;
  /** Order creator address */
  trader: string;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Transaction hash */
  txHash?: string;
}

/** Market data */
export interface MarketData {
  /** Trading pair */
  pair: TradingPair;
  /** Last traded price */
  lastPrice: bigint;
  /** 24h price change */
  priceChange24h: bigint;
  /** 24h volume */
  volume24h: bigint;
  /** Best bid price */
  bid: bigint;
  /** Best ask price */
  ask: bigint;
  /** Bid-ask spread */
  spread: bigint;
}

/** Order book entry */
export interface OrderBookEntry {
  /** Price level */
  price: bigint;
  /** Total quantity at this price */
  quantity: bigint;
  /** Number of orders at this price */
  orderCount: number;
}

/** Order book data */
export interface OrderBook {
  /** Trading pair */
  pair: TradingPair;
  /** Buy orders (bids) */
  bids: OrderBookEntry[];
  /** Sell orders (asks) */
  asks: OrderBookEntry[];
  /** Last update timestamp */
  timestamp: number;
}

/** DEX configuration */
export interface DEXConfig {
  /** DEX contract address */
  contractAddress: string;
  /** Supported trading pairs */
  supportedPairs: TradingPair[];
  /** Default slippage tolerance (in basis points) */
  defaultSlippage: number;
  /** Order expiry time (in seconds) */
  defaultOrderExpiry: number;
}

/**
 * Main DEX service providing trading functionality
 */
export class DEXService {
  private walletService: WalletService;
  private config: DEXConfig;
  private isInitialized = false;
  private orderBook: Map<string, OrderBook> = new Map();
  private activeOrders: Map<string, Order> = new Map();

  /**
   * Creates a new DEXService instance
   * @param walletService - Wallet service instance
   * @param config - DEX configuration (optional)
   */
  constructor(walletService: WalletService, config?: DEXConfig) {
    this.walletService = walletService;
    this.config = config || {
      contractAddress: '0x1234567890123456789012345678901234567890',
      supportedPairs: [
        {
          baseToken: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
          quoteToken: '0x4Fcc7d9Ca9d22E21FCF25CF9a2E48D3A0c1a5A3E',
          symbol: 'OMNI/USDC',
          minOrderSize: ethers.parseEther('0.01'),
          tickSize: ethers.parseUnits('0.01', 6),
          isActive: true
        }
      ],
      defaultSlippage: 50, // 0.5%
      defaultOrderExpiry: 86400 // 24 hours
    };
  }

  /**
   * Initialize the DEX service
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

      // Initialize order books for all supported pairs
      for (const pair of this.config.supportedPairs) {
        const orderBook: OrderBook = {
          pair,
          bids: [],
          asks: [],
          timestamp: Date.now()
        };
        this.orderBook.set(pair.symbol, orderBook);
      }

      this.isInitialized = true;
      // // console.log('DEXService initialized with', this.config.supportedPairs.length, 'trading pairs');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize DEX service: ${errorMessage}`);
    }
  }

  /**
   * Get supported trading pairs
   * @returns Array of trading pairs
   */
  getSupportedPairs(): TradingPair[] {
    return [...this.config.supportedPairs];
  }

  /**
   * Get market data for a trading pair
   * @param symbol - Trading pair symbol
   * @returns Market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    const pair = this.config.supportedPairs.find(p => p.symbol === symbol);
    if (!pair) {
      return null;
    }

    const orderBook = this.orderBook.get(symbol);
    if (!orderBook) {
      return null;
    }

    // Calculate market data from order book
    const lastPrice = ethers.parseEther('100'); // Mock price
    const bid = orderBook.bids.length > 0 ? orderBook.bids[0].price : 0n;
    const ask = orderBook.asks.length > 0 ? orderBook.asks[0].price : 0n;

    return {
      pair,
      lastPrice,
      priceChange24h: ethers.parseEther('5'), // Mock 24h change
      volume24h: ethers.parseEther('1000'), // Mock volume
      bid,
      ask,
      spread: ask > bid ? ask - bid : 0n
    };
  }

  /**
   * Get order book for a trading pair
   * @param symbol - Trading pair symbol
   * @param depth - Number of levels to return
   * @returns Order book data
   */
  async getOrderBook(symbol: string, depth: number = 10): Promise<OrderBook | null> {
    const orderBook = this.orderBook.get(symbol);
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
   * @param params - Order parameters
   * @param params.symbol
   * @param params.side
   * @param params.price
   * @param params.quantity
   * @param params.expiresAt
   * @returns Created order
   * @throws {Error} When order placement fails
   */
  async placeOrder(params: {
    symbol: string;
    side: OrderSide;
    price: bigint;
    quantity: bigint;
    expiresAt?: number;
  }): Promise<Order> {
    if (!this.isInitialized) {
      throw new Error('DEX service not initialized');
    }

    const pair = this.config.supportedPairs.find(p => p.symbol === params.symbol);
    if (!pair) {
      throw new Error(`Unsupported trading pair: ${params.symbol}`);
    }

    if (params.quantity < pair.minOrderSize) {
      throw new Error('Order size below minimum');
    }

    try {
      const address = await this.walletService.getAddress();
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const order: Order = {
        id: orderId,
        pair,
        side: params.side,
        price: params.price,
        quantity: params.quantity,
        filledQuantity: 0n,
        status: OrderStatus.PENDING,
        trader: address,
        createdAt: Date.now(),
        expiresAt: params.expiresAt || (Date.now() + this.config.defaultOrderExpiry * 1000)
      };

      // Add to active orders
      this.activeOrders.set(orderId, order);

      // Add to order book
      this.addToOrderBook(order);

      // // console.log(`Order placed: ${orderId} - ${params.side} ${params.quantity} ${params.symbol} @ ${params.price}`);
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

    try {
      // Update order status
      order.status = OrderStatus.CANCELED;
      this.activeOrders.set(orderId, order);

      // Remove from order book
      this.removeFromOrderBook(order);

      // // console.log(`Order canceled: ${orderId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to cancel order: ${errorMessage}`);
    }
  }

  /**
   * Get active orders for current address
   * @returns Array of active orders
   */
  async getActiveOrders(): Promise<Order[]> {
    const address = await this.walletService.getAddress();
    return Array.from(this.activeOrders.values()).filter(
      order => order.trader === address && order.status === OrderStatus.PENDING
    );
  }

  /**
   * Get order history for current address
   * @param limit - Maximum number of orders to return
   * @returns Array of historical orders
   */
  async getOrderHistory(limit: number = 50): Promise<Order[]> {
    const address = await this.walletService.getAddress();
    return Array.from(this.activeOrders.values())
      .filter(order => order.trader === address)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Add order to order book
   * @param order
   * @private
   */
  private addToOrderBook(order: Order): void {
    const orderBook = this.orderBook.get(order.pair.symbol);
    if (!orderBook) {
      return;
    }

    const entry: OrderBookEntry = {
      price: order.price,
      quantity: order.quantity,
      orderCount: 1
    };

    if (order.side === OrderSide.BUY) {
      // Add to bids (sorted by price descending)
      const existingIndex = orderBook.bids.findIndex(bid => bid.price === order.price);
      if (existingIndex >= 0) {
        orderBook.bids[existingIndex].quantity += order.quantity;
        orderBook.bids[existingIndex].orderCount += 1;
      } else {
        orderBook.bids.push(entry);
        orderBook.bids.sort((a, b) => b.price > a.price ? 1 : -1);
      }
    } else {
      // Add to asks (sorted by price ascending)
      const existingIndex = orderBook.asks.findIndex(ask => ask.price === order.price);
      if (existingIndex >= 0) {
        orderBook.asks[existingIndex].quantity += order.quantity;
        orderBook.asks[existingIndex].orderCount += 1;
      } else {
        orderBook.asks.push(entry);
        orderBook.asks.sort((a, b) => a.price > b.price ? 1 : -1);
      }
    }

    orderBook.timestamp = Date.now();
  }

  /**
   * Remove order from order book
   * @param order
   * @private
   */
  private removeFromOrderBook(order: Order): void {
    const orderBook = this.orderBook.get(order.pair.symbol);
    if (!orderBook) {
      return;
    }

    const remainingQuantity = order.quantity - order.filledQuantity;

    if (order.side === OrderSide.BUY) {
      const bidIndex = orderBook.bids.findIndex(bid => bid.price === order.price);
      if (bidIndex >= 0) {
        orderBook.bids[bidIndex].quantity -= remainingQuantity;
        orderBook.bids[bidIndex].orderCount -= 1;
        if (orderBook.bids[bidIndex].quantity <= 0) {
          orderBook.bids.splice(bidIndex, 1);
        }
      }
    } else {
      const askIndex = orderBook.asks.findIndex(ask => ask.price === order.price);
      if (askIndex >= 0) {
        orderBook.asks[askIndex].quantity -= remainingQuantity;
        orderBook.asks[askIndex].orderCount -= 1;
        if (orderBook.asks[askIndex].quantity <= 0) {
          orderBook.asks.splice(askIndex, 1);
        }
      }
    }

    orderBook.timestamp = Date.now();
  }

  /**
   * Clear cache and reset data
   */
  async clearCache(): Promise<void> {
    // Clear order books but keep structure
    for (const [symbol, orderBook] of this.orderBook.entries()) {
      orderBook.bids = [];
      orderBook.asks = [];
      orderBook.timestamp = Date.now();
    }
    // // console.log('DEXService cache cleared');
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      this.orderBook.clear();
      this.activeOrders.clear();
      this.isInitialized = false;
      // // console.log('DEXService cleanup completed');
    } catch (error) {
      console.error('Error during DEX service cleanup:', error);
    }
  }
}