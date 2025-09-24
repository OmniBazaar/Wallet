/**
 * PriceOracleIntegration - Integration service for Price Oracle
 *
 * This service provides the interface between the Wallet module and the
 * real PriceOracleService implementation from the Validator module.
 */

import { PriceOracleService as ValidatorPriceOracle } from '../../../../Validator/dist/services/PriceOracleService';
import { P2PNetwork } from '../../../../Validator/dist/p2p/P2PNetworkLibp2p';
import type { P2PConfig } from '../../../../Validator/dist/p2p/P2PNetworkLibp2p';

/**
 * Price data returned by the integration
 */
export interface WalletPriceData {
  /** Price value */
  value: number;
  /** Timestamp of the price data */
  timestamp: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Optional source identifier */
  source?: string;
}

/**
 * Service for getting price data from the validator's price oracle
 */
export class PriceOracleIntegration {
  private validatorOracle: ValidatorPriceOracle;
  private static instance: PriceOracleIntegration;
  private subscriptions: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize P2PNetwork first if not already initialized
    try {
      P2PNetwork.getInstance();
    } catch (error) {
      // P2PNetwork not initialized, create it
      const p2pConfig: P2PConfig = {
        nodeId: `wallet-${Date.now()}`,
        port: 0, // Random port - let system assign
        bootstrapNodes: [],
        maxPeers: 10,
        gossipInterval: 5000, // 5 seconds
        pingInterval: 30000, // 30 seconds
        peerTimeout: 60000, // 60 seconds
        capabilities: ['price-oracle', 'wallet']
      };
      P2PNetwork.getInstance(p2pConfig);
    }

    this.validatorOracle = ValidatorPriceOracle.getInstance();
  }

  /**
   * Get singleton instance
   * @returns PriceOracleIntegration instance
   */
  static getInstance(): PriceOracleIntegration {
    if (PriceOracleIntegration.instance === undefined) {
      PriceOracleIntegration.instance = new PriceOracleIntegration();
    }
    return PriceOracleIntegration.instance;
  }

  /**
   * Initialize the service
   */
  initialize(): void {
    void this.validatorOracle.start();
  }

  /**
   * Get price for a token pair
   * @param base Base token symbol
   * @param _quote Quote token symbol (default: USD) - currently unused as chainId is hardcoded
   * @returns Price data
   */
  async getPrice(base: string, _quote: string = 'USD'): Promise<WalletPriceData> {
    // PriceOracleService.getPrice takes chainId as second param, not quote
    // For now, default to mainnet (chainId: 1)
    const chainId = 1;
    const priceData = await this.validatorOracle.getPrice(base, chainId);

    if (priceData === null) {
      throw new Error(`Price not available for ${base}`);
    }

    return {
      value: priceData.price,
      timestamp: priceData.timestamp,
      confidence: priceData.confidence,
      source: priceData.sources?.[0]?.name ?? 'unknown'
    };
  }

  /**
   * Get prices for multiple pairs
   * @param pairs Array of base/quote pairs
   * @returns Map of pair to price data
   */
  async getBatchPrices(
    pairs: Array<{ base: string; quote: string }>
  ): Promise<Record<string, WalletPriceData>> {
    const symbols = pairs.map(p => p.base);
    const firstPair = pairs[0];
    const quote = (pairs.length > 0 && firstPair && firstPair.quote !== '') ? firstPair.quote : 'USD'; // Assume same quote for batch

    // getPrices takes chainId as second param
    const chainId = 1;
    const prices = await this.validatorOracle.getPrices(symbols, chainId);

    const result: Record<string, WalletPriceData> = {};
    for (const [symbol, data] of Object.entries(prices)) {
      if (data !== null && data !== undefined) {
        result[`${symbol}/${quote}`] = {
          value: data.price,
          timestamp: data.timestamp,
          confidence: data.confidence,
          source: data.sources?.[0]?.name ?? 'aggregated'
        };
      }
    }

    return result;
  }

  /**
   * Get historical prices (mock implementation for now)
   * @param params Query parameters
   * @param params.pair Trading pair
   * @param params.from Start timestamp
   * @param params.to End timestamp
   * @param params.interval Time interval
   * @returns Historical price data
   */
  async getHistoricalPrices(params: {
    pair: string;
    from: number;
    to: number;
    interval: string;
  }): Promise<Array<{ timestamp: number; price: number; volume: number }>> {
    // Parse pair
    const [base, quote = 'USD'] = params.pair.split('/');

    // Get current price as a starting point
    const currentPrice = await this.getPrice(base ?? 'ETH', quote);

    // Generate mock historical data based on current price
    const dataPoints: Array<{ timestamp: number; price: number; volume: number }> = [];
    const intervalMs = this.parseInterval(params.interval);

    for (let ts = params.from; ts <= params.to; ts += intervalMs) {
      // Add some random variation (±5%)
      const variation = 0.95 + Math.random() * 0.1;
      dataPoints.push({
        timestamp: ts,
        price: currentPrice.value * variation,
        volume: 1000000 * Math.random() // Mock volume
      });
    }

    return dataPoints;
  }

  /**
   * Parse interval string to milliseconds
   * @param interval Interval string (e.g., '1h', '1d')
   * @returns Milliseconds
   */
  private parseInterval(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000; // Default 1 hour
    }
  }

  /**
   * Get aggregated price from multiple sources
   * @param pair Trading pair (e.g., 'XOM/USD')
   * @returns Aggregated price data
   */
  async getAggregatedPrice(pair: string): Promise<{
    median: number;
    mean: number;
    sources: number;
    confidence: number;
  }> {
    const [base, quote = 'USD'] = pair.split('/');
    const price = await this.getPrice(base ?? 'ETH', quote);

    // For now, return single source data formatted as aggregated
    return {
      median: price.value,
      mean: price.value,
      sources: 1,
      confidence: price.confidence
    };
  }

  /**
   * Subscribe to price updates (mock implementation)
   * @param pair Trading pair
   * @param callback Callback function
   * @returns Subscription ID
   */
  subscribeToPriceUpdates(
    pair: string,
    callback: (update: { pair: string; price: WalletPriceData }) => void
  ): { id: string } {
    const [base, quote = 'USD'] = pair.split('/');
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate price updates every 5 seconds
    const interval = setInterval(() => {
      void (async () => {
        try {
          const price = await this.getPrice(base ?? 'ETH', quote);
          callback({ pair, price });
        } catch (error) {
          console.error('Error in price subscription:', error);
        }
      })();
    }, 5000);

    // Store interval for cleanup
    this.subscriptions.set(subscriptionId, interval);

    return { id: subscriptionId };
  }

  /**
   * Unsubscribe from price updates
   * @param subscriptionId Subscription ID
   */
  unsubscribe(subscriptionId: string): void {
    const interval = this.subscriptions.get(subscriptionId);
    if (interval !== undefined) {
      clearInterval(interval);
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    // Clean up any subscriptions
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const subscriptionId of subscriptionIds) {
      this.unsubscribe(subscriptionId);
    }

    void this.validatorOracle.stop();
  }
}