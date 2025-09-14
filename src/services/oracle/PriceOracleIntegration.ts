/**
 * PriceOracleIntegration - Integration service for Price Oracle
 *
 * This service provides the interface between the Wallet module and the
 * real PriceOracleService implementation from the Validator module.
 */

import { PriceOracleService as ValidatorPriceOracle } from '../../../../Validator/dist/services/PriceOracleService';
import type { PriceData } from '../../../../Validator/dist/services/PriceOracleService';
import { P2PNetwork } from '../../../../Validator/dist/p2p/P2PNetworkLibp2p';
import type { P2PConfig } from '../../../../Validator/dist/p2p/P2PNetworkLibp2p';

/**
 * Price data returned by the integration
 */
export interface WalletPriceData {
  value: number;
  timestamp: number;
  confidence: number;
  source?: string;
}

/**
 * Service for getting price data from the validator's price oracle
 */
export class PriceOracleIntegration {
  private validatorOracle: ValidatorPriceOracle;
  private static instance: PriceOracleIntegration;

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
    if (!this.instance) {
      this.instance = new PriceOracleIntegration();
    }
    return this.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.validatorOracle.start();
  }

  /**
   * Get price for a token pair
   * @param base Base token symbol
   * @param quote Quote token symbol (default: USD)
   * @returns Price data
   */
  async getPrice(base: string, quote: string = 'USD'): Promise<WalletPriceData> {
    const priceData = await this.validatorOracle.getPrice(base, quote);

    return {
      value: priceData.price,
      timestamp: priceData.timestamp,
      confidence: priceData.confidence,
      source: priceData.source
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
    const quote = pairs[0]?.quote || 'USD'; // Assume same quote for batch

    const prices = await this.validatorOracle.getPrices(symbols, quote);

    const result: Record<string, WalletPriceData> = {};
    for (const [symbol, data] of Object.entries(prices)) {
      result[`${symbol}/${quote}`] = {
        value: data.price,
        timestamp: data.timestamp,
        confidence: data.confidence,
        source: data.source
      };
    }

    return result;
  }

  /**
   * Get historical prices (mock implementation for now)
   * @param params Query parameters
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
    const currentPrice = await this.getPrice(base, quote);

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
    const price = await this.getPrice(base, quote);

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
  async subscribeToPriceUpdates(
    pair: string,
    callback: (update: { pair: string; price: WalletPriceData }) => void
  ): Promise<{ id: string }> {
    const [base, quote = 'USD'] = pair.split('/');
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate price updates every 5 seconds
    const interval = setInterval(async () => {
      try {
        const price = await this.getPrice(base, quote);
        callback({ pair, price });
      } catch (error) {
        console.error('Error in price subscription:', error);
      }
    }, 5000);

    // Store interval for cleanup
    (this as any)[subscriptionId] = interval;

    return { id: subscriptionId };
  }

  /**
   * Unsubscribe from price updates
   * @param subscriptionId Subscription ID
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const interval = (this as any)[subscriptionId];
    if (interval) {
      clearInterval(interval);
      delete (this as any)[subscriptionId];
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Clean up any subscriptions
    const subscriptionKeys = Object.keys(this).filter(k => k.startsWith('sub_'));
    for (const key of subscriptionKeys) {
      await this.unsubscribe(key);
    }

    await this.validatorOracle.stop();
  }
}