/**
 * OrderBookService - Decentralized Order Book Integration Service
 * 
 * Provides order book functionality including limit orders, order management,
 * MEV protection, and order book depth analysis.
 */

import { ethers } from 'ethers';
import { DecentralizedOrderBook } from '../../../Validator/src/services/dex/DecentralizedOrderBook';
import { MEVProtection } from '../../../Validator/src/services/dex/mev/MEVProtection';
import { WalletService } from './WalletService';
import { OmniProvider } from '../core/providers/OmniProvider';

/** Order types */
export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP_LIMIT = 'STOP_LIMIT',
  STOP_MARKET = 'STOP_MARKET'
}

/** Order side */
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

/** Order status */
export enum OrderStatus {
  PENDING = 'PENDING',
  OPEN = 'OPEN',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED'
}

/** Order time in force */
export enum TimeInForce {
  GTC = 'GTC', // Good Till Cancelled
  IOC = 'IOC', // Immediate Or Cancel
  FOK = 'FOK', // Fill Or Kill
  GTT = 'GTT'  // Good Till Time
}

/** Limit order parameters */
export interface LimitOrderParams {
  /** Token to sell */
  tokenIn: string;
  /** Token to buy */
  tokenOut: string;
  /** Amount of tokenIn to sell */
  amountIn: bigint;
  /** Minimum amount of tokenOut to receive */
  amountOutMin: bigint;
  /** Order side (BUY/SELL) */
  side: OrderSide;
  /** Limit price (tokenOut per tokenIn) */
  price: number;
  /** Time in force */
  timeInForce?: TimeInForce;
  /** Expiration timestamp (for GTT orders) */
  expiration?: number;
  /** Enable MEV protection */
  mevProtection?: boolean;
  /** Post-only order (maker only) */
  postOnly?: boolean;
  /** Reduce-only order */
  reduceOnly?: boolean;
}

/** Order information */
export interface Order {
  /** Unique order ID */
  orderId: string;
  /** Order creator address */
  maker: string;
  /** Token to sell */
  tokenIn: string;
  /** Token to buy */
  tokenOut: string;
  /** Original amount */
  amountIn: bigint;
  /** Remaining amount */
  amountRemaining: bigint;
  /** Filled amount */
  amountFilled: bigint;
  /** Minimum output amount */
  amountOutMin: bigint;
  /** Order type */
  type: OrderType;
  /** Order side */
  side: OrderSide;
  /** Limit price */
  price: number;
  /** Order status */
  status: OrderStatus;
  /** Time in force */
  timeInForce: TimeInForce;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Expiration timestamp */
  expiration?: number;
  /** Transaction hash */
  txHash?: string;
  /** Execution price (for filled orders) */
  executionPrice?: number;
  /** Total fees paid */
  fees?: bigint;
}

/** Order book depth level */
export interface DepthLevel {
  /** Price level */
  price: number;
  /** Total amount at this price */
  amount: bigint;
  /** Number of orders at this price */
  orderCount: number;
  /** Cumulative amount up to this level */
  cumulative: bigint;
}

/** Order book depth data */
export interface OrderBookDepth {
  /** Trading pair */
  pair: string;
  /** Bid levels (buy orders) */
  bids: DepthLevel[];
  /** Ask levels (sell orders) */
  asks: DepthLevel[];
  /** Mid price */
  midPrice: number;
  /** Spread percentage */
  spread: number;
  /** Last update timestamp */
  timestamp: number;
}

/** Order execution result */
export interface OrderResult {
  /** Success status */
  success: boolean;
  /** Order ID */
  orderId?: string;
  /** Transaction hash */
  txHash?: string;
  /** Error message */
  error?: string;
  /** Gas used */
  gasUsed?: bigint;
  /** MEV protection applied */
  mevProtected?: boolean;
}

/** Order fill event */
export interface OrderFillEvent {
  /** Order ID */
  orderId: string;
  /** Taker address */
  taker: string;
  /** Amount filled in this transaction */
  amountFilled: bigint;
  /** Amount of output token */
  amountOut: bigint;
  /** Execution price */
  executionPrice: number;
  /** Transaction hash */
  txHash: string;
  /** Fill timestamp */
  timestamp: number;
}

/**
 * Order book integration service
 */
export class OrderBookService {
  private walletService?: WalletService;
  private provider?: OmniProvider;
  private orderBook?: DecentralizedOrderBook;
  private mevProtection?: MEVProtection;
  private isInitialized = false;
  private userOrders: Map<string, Order> = new Map();
  private orderSubscriptions: Map<string, (event: OrderFillEvent) => void> = new Map();

  /**
   * Creates a new OrderBookService instance
   * @param providerOrWalletService - OmniProvider or WalletService instance
   */
  constructor(providerOrWalletService: OmniProvider | WalletService) {
    if ('getWallet' in providerOrWalletService) {
      this.walletService = providerOrWalletService;
    } else {
      this.provider = providerOrWalletService;
    }
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

      // Initialize wallet service if needed
      if (this.walletService && !this.walletService.isServiceInitialized()) {
        await this.walletService.init();
      }

      // Initialize order book and MEV protection
      this.orderBook = new DecentralizedOrderBook();
      this.mevProtection = new MEVProtection();
      
      await Promise.all([
        this.orderBook.init(),
        this.mevProtection.init()
      ]);

      // Load user orders
      await this.loadUserOrders();

      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize order book service: ${errorMessage}`);
    }
  }

  /**
   * Place a limit order
   * @param params - Limit order parameters
   * @returns Order result with order ID
   * @throws {Error} When order placement fails
   */
  async placeLimitOrder(params: LimitOrderParams): Promise<OrderResult> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      if (!this.orderBook) {
        throw new Error('Order book not available');
      }

      // Validate parameters
      if (params.amountIn === BigInt(0)) {
        throw new Error('Order amount cannot be zero');
      }

      if (params.price <= 0) {
        throw new Error('Order price must be positive');
      }

      // Get user address
      const userAddress = await this.getUserAddress();

      // Apply MEV protection if requested
      let orderData = {
        maker: userAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOutMin: params.amountOutMin,
        side: params.side,
        price: params.price,
        timeInForce: (params.timeInForce != null) || TimeInForce.GTC,
        expiration: params.expiration,
        postOnly: params.postOnly,
        reduceOnly: params.reduceOnly
      };

      if (params.mevProtection && this.mevProtection) {
        const protectedOrder = await this.mevProtection.protectOrder({
          ...orderData,
          type: 'limit'
        });
        orderData = { ...orderData, ...protectedOrder };
      }

      // Submit order to decentralized order book
      const result = await this.orderBook.submitOrder(orderData);

      if (result.success && result.orderId) {
        // Create order object
        const order: Order = {
          orderId: result.orderId,
          maker: userAddress,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          amountRemaining: params.amountIn,
          amountFilled: BigInt(0),
          amountOutMin: params.amountOutMin,
          type: OrderType.LIMIT,
          side: params.side,
          price: params.price,
          status: OrderStatus.OPEN,
          timeInForce: (params.timeInForce != null) || TimeInForce.GTC,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiration: params.expiration,
          txHash: result.transactionHash
        };

        // Store order
        this.userOrders.set(result.orderId, order);

        // Subscribe to order events
        this.subscribeToOrderEvents(result.orderId);
      }

      return {
        success: result.success,
        orderId: result.orderId,
        txHash: result.transactionHash,
        error: result.error,
        gasUsed: result.gasUsed,
        mevProtected: params.mevProtection
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to place limit order: ${errorMessage}`
      };
    }
  }

  /**
   * Cancel an open order
   * @param orderId - Order ID to cancel
   * @returns Cancellation result
   * @throws {Error} When cancellation fails
   */
  async cancelOrder(orderId: string): Promise<OrderResult> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      if (!this.orderBook) {
        throw new Error('Order book not available');
      }

      // Verify order exists and is cancellable
      const order = this.userOrders.get(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PARTIALLY_FILLED) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
      }

      // Cancel order in order book
      const result = await this.orderBook.cancelOrder(orderId);

      if (result.success) {
        // Update order status
        order.status = OrderStatus.CANCELLED;
        order.updatedAt = Date.now();
        this.userOrders.set(orderId, order);

        // Unsubscribe from events
        this.unsubscribeFromOrderEvents(orderId);
      }

      return {
        success: result.success,
        orderId,
        txHash: result.transactionHash,
        error: result.error,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to cancel order: ${errorMessage}`
      };
    }
  }

  /**
   * Get user's open orders
   * @param tokenPair - Optional token pair filter
   * @param tokenPair.tokenIn
   * @param tokenPair.tokenOut
   * @returns Array of user's open orders
   * @throws {Error} When query fails
   */
  async getUserOrders(tokenPair?: { tokenIn: string; tokenOut: string }): Promise<Order[]> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      const userAddress = await this.getUserAddress();
      const orders = Array.from(this.userOrders.values());

      // Filter by user
      let userOrdersList = orders.filter(order => order.maker === userAddress);

      // Filter by token pair if provided
      if (tokenPair) {
        userOrdersList = userOrdersList.filter(order =>
          (order.tokenIn === tokenPair.tokenIn && order.tokenOut === tokenPair.tokenOut) ||
          (order.tokenIn === tokenPair.tokenOut && order.tokenOut === tokenPair.tokenIn)
        );
      }

      // Sort by creation time (newest first)
      userOrdersList.sort((a, b) => b.createdAt - a.createdAt);

      return userOrdersList;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get user orders: ${errorMessage}`);
    }
  }

  /**
   * Fill an order (taker side)
   * @param orderId - Order ID to fill
   * @param fillAmount - Amount to fill (partial fills allowed)
   * @returns Fill result
   * @throws {Error} When fill fails
   */
  async fillOrder(orderId: string, fillAmount: bigint): Promise<OrderResult> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      if (!this.orderBook) {
        throw new Error('Order book not available');
      }

      // Get order details
      const order = await this.orderBook.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
        throw new Error('Order is not fillable');
      }

      // Validate fill amount
      if (fillAmount > order.amountRemaining) {
        throw new Error('Fill amount exceeds remaining order amount');
      }

      // Execute fill
      const result = await this.orderBook.fillOrder({
        orderId,
        fillAmount,
        taker: await this.getUserAddress()
      });

      return {
        success: result.success,
        orderId,
        txHash: result.transactionHash,
        error: result.error,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to fill order: ${errorMessage}`
      };
    }
  }

  /**
   * Get order book depth for a token pair
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param levels - Number of price levels to return (default: 20)
   * @returns Order book depth data
   * @throws {Error} When depth query fails
   */
  async getOrderBookDepth(
    tokenIn: string,
    tokenOut: string,
    levels: number = 20
  ): Promise<OrderBookDepth> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      if (!this.orderBook) {
        throw new Error('Order book not available');
      }

      // Get orders for the pair
      const orders = await this.orderBook.getOrdersForPair(tokenIn, tokenOut);

      // Separate buy and sell orders
      const buyOrders = orders.filter(o => o.side === 'BUY' && o.status === 'OPEN');
      const sellOrders = orders.filter(o => o.side === 'SELL' && o.status === 'OPEN');

      // Aggregate by price level
      const bids = this.aggregateOrdersByPrice(buyOrders, levels, true);
      const asks = this.aggregateOrdersByPrice(sellOrders, levels, false);

      // Calculate mid price and spread
      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || Number.MAX_SAFE_INTEGER;
      const midPrice = (bestBid + bestAsk) / 2;
      const spread = bestAsk > 0 && bestBid > 0 ? ((bestAsk - bestBid) / midPrice) * 100 : 0;

      return {
        pair: `${tokenIn}/${tokenOut}`,
        bids,
        asks,
        midPrice,
        spread,
        timestamp: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get order book depth: ${errorMessage}`);
    }
  }

  /**
   * Get order details by ID
   * @param orderId - Order ID
   * @returns Order details or null if not found
   * @throws {Error} When query fails
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      // Check local cache first
      const cachedOrder = this.userOrders.get(orderId);
      if (cachedOrder) {
        return cachedOrder;
      }

      // Query from order book
      if (this.orderBook) {
        const orderData = await this.orderBook.getOrder(orderId);
        if (orderData) {
          const order: Order = {
            orderId: orderData.orderId,
            maker: orderData.maker,
            tokenIn: orderData.tokenIn,
            tokenOut: orderData.tokenOut,
            amountIn: orderData.amountIn,
            amountRemaining: orderData.amountRemaining,
            amountFilled: orderData.amountIn - orderData.amountRemaining,
            amountOutMin: orderData.amountOutMin,
            type: OrderType.LIMIT,
            side: orderData.side as OrderSide,
            price: orderData.price,
            status: orderData.status as OrderStatus,
            timeInForce: orderData.timeInForce as TimeInForce,
            createdAt: orderData.createdAt,
            updatedAt: orderData.updatedAt,
            expiration: orderData.expiration,
            txHash: orderData.txHash,
            executionPrice: orderData.executionPrice,
            fees: orderData.fees
          };
          return order;
        }
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get order: ${errorMessage}`);
    }
  }

  /**
   * Get order history for the user
   * @param limit - Maximum number of orders to return
   * @param offset - Offset for pagination
   * @returns Array of historical orders
   * @throws {Error} When query fails
   */
  async getOrderHistory(limit: number = 50, offset: number = 0): Promise<Order[]> {
    if (!this.isInitialized) {
      throw new Error('Order book service not initialized');
    }

    try {
      if (!this.orderBook) {
        throw new Error('Order book not available');
      }

      const userAddress = await this.getUserAddress();
      const history = await this.orderBook.getUserOrderHistory(userAddress, limit, offset);

      return history.map(orderData => ({
        orderId: orderData.orderId,
        maker: orderData.maker,
        tokenIn: orderData.tokenIn,
        tokenOut: orderData.tokenOut,
        amountIn: orderData.amountIn,
        amountRemaining: orderData.amountRemaining,
        amountFilled: orderData.amountIn - orderData.amountRemaining,
        amountOutMin: orderData.amountOutMin,
        type: OrderType.LIMIT,
        side: orderData.side as OrderSide,
        price: orderData.price,
        status: orderData.status as OrderStatus,
        timeInForce: orderData.timeInForce as TimeInForce,
        createdAt: orderData.createdAt,
        updatedAt: orderData.updatedAt,
        expiration: orderData.expiration,
        txHash: orderData.txHash,
        executionPrice: orderData.executionPrice,
        fees: orderData.fees
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get order history: ${errorMessage}`);
    }
  }

  /**
   * Subscribe to order fill events
   * @param orderId - Order ID to monitor
   * @param callback - Callback function for fill events
   */
  subscribeToFillEvents(orderId: string, callback: (event: OrderFillEvent) => void): void {
    this.orderSubscriptions.set(orderId, callback);
  }

  /**
   * Unsubscribe from order fill events
   * @param orderId - Order ID to stop monitoring
   */
  unsubscribeFromFillEvents(orderId: string): void {
    this.orderSubscriptions.delete(orderId);
  }

  /**
   * Aggregate orders by price level
   * @param orders - Orders to aggregate
   * @param maxLevels - Maximum number of levels
   * @param descending - Sort order (true for bids, false for asks)
   * @returns Aggregated depth levels
   * @private
   */
  private aggregateOrdersByPrice(
    orders: any[],
    maxLevels: number,
    descending: boolean
  ): DepthLevel[] {
    const priceMap = new Map<number, { amount: bigint; count: number }>();

    // Aggregate by price
    for (const order of orders) {
      const existing = priceMap.get(order.price) || { amount: BigInt(0), count: 0 };
      priceMap.set(order.price, {
        amount: existing.amount + order.amountRemaining,
        count: existing.count + 1
      });
    }

    // Convert to array and sort
    const levels = Array.from(priceMap.entries())
      .map(([price, data]) => ({
        price,
        amount: data.amount,
        orderCount: data.count,
        cumulative: BigInt(0)
      }))
      .sort((a, b) => descending ? b.price - a.price : a.price - b.price)
      .slice(0, maxLevels);

    // Calculate cumulative amounts
    let cumulative = BigInt(0);
    for (const level of levels) {
      cumulative += level.amount;
      level.cumulative = cumulative;
    }

    return levels;
  }

  /**
   * Subscribe to order events
   * @param orderId - Order ID to monitor
   * @private
   */
  private subscribeToOrderEvents(orderId: string): void {
    if (this.orderBook) {
      // In production, would set up WebSocket subscription
      // For now, poll for updates
      const checkOrder = async () => {
        try {
          const orderData = await this.orderBook!.getOrder(orderId);
          if (orderData) {
            const order = this.userOrders.get(orderId);
            if (order && orderData.status !== order.status) {
              // Update order
              order.status = orderData.status as OrderStatus;
              order.amountRemaining = orderData.amountRemaining;
              order.amountFilled = orderData.amountIn - orderData.amountRemaining;
              order.updatedAt = Date.now();
              this.userOrders.set(orderId, order);

              // Trigger callback if subscribed
              const callback = this.orderSubscriptions.get(orderId);
              if (callback && order.amountFilled > BigInt(0)) {
                callback({
                  orderId,
                  taker: 'unknown',
                  amountFilled: order.amountFilled,
                  amountOut: BigInt(0), // Would need calculation
                  executionPrice: orderData.executionPrice || order.price,
                  txHash: orderData.txHash || '',
                  timestamp: Date.now()
                });
              }
            }
          }
        } catch (error) {
          // Ignore polling errors
        }
      };

      // Poll every 5 seconds
      const interval = setInterval(checkOrder, 5000);
      
      // Store interval for cleanup
      (this as any)[`interval_${orderId}`] = interval;
    }
  }

  /**
   * Unsubscribe from order events
   * @param orderId - Order ID to stop monitoring
   * @private
   */
  private unsubscribeFromOrderEvents(orderId: string): void {
    const interval = (this as any)[`interval_${orderId}`];
    if (interval) {
      clearInterval(interval);
      delete (this as any)[`interval_${orderId}`];
    }
  }

  /**
   * Load user orders from order book
   * @private
   */
  private async loadUserOrders(): Promise<void> {
    try {
      if (this.orderBook) {
        const userAddress = await this.getUserAddress();
        const orders = await this.orderBook.getUserOrders(userAddress);
        
        this.userOrders.clear();
        for (const orderData of orders) {
          const order: Order = {
            orderId: orderData.orderId,
            maker: orderData.maker,
            tokenIn: orderData.tokenIn,
            tokenOut: orderData.tokenOut,
            amountIn: orderData.amountIn,
            amountRemaining: orderData.amountRemaining,
            amountFilled: orderData.amountIn - orderData.amountRemaining,
            amountOutMin: orderData.amountOutMin,
            type: OrderType.LIMIT,
            side: orderData.side as OrderSide,
            price: orderData.price,
            status: orderData.status as OrderStatus,
            timeInForce: orderData.timeInForce as TimeInForce,
            createdAt: orderData.createdAt,
            updatedAt: orderData.updatedAt,
            expiration: orderData.expiration,
            txHash: orderData.txHash
          };
          this.userOrders.set(order.orderId, order);
        }
      }
    } catch (error) {
      // Ignore load errors on init
    }
  }

  /**
   * Get user address
   * @returns User address
   * @private
   */
  private async getUserAddress(): Promise<string> {
    if (this.walletService) {
      return await this.walletService.getAddress();
    } else if (this.provider) {
      const signer = await this.provider.getSigner();
      return await signer.getAddress();
    } else {
      throw new Error('No provider available');
    }
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear all intervals
      for (const orderId of this.userOrders.keys()) {
        this.unsubscribeFromOrderEvents(orderId);
      }
      
      this.userOrders.clear();
      this.orderSubscriptions.clear();
      this.isInitialized = false;
      this.orderBook = undefined;
      this.mevProtection = undefined;
    } catch (error) {
      // Fail silently on cleanup
    }
  }
}