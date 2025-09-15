/**
 * Mock Price Feed Service for Testing
 * Provides mock price data without external dependencies
 */

import type { PriceData } from './PriceFeedService';

/**
 * Historical price options
 */
interface HistoricalPriceOptions {
  symbol: string;
  from?: number;
  to?: number;
  interval?: string;
}

/**
 * Mock price feed service that returns static prices for testing
 */
export class MockPriceFeedService {
  private mockPrices: Map<string, number> = new Map([
    ['ETH', 2000],
    ['BTC', 40000],
    ['USDC', 1],
    ['USDT', 1],
    ['DAI', 1],
    ['XOM', 0.5],
    ['pXOM', 0.5]
  ]);

  /**
   * Get current price for a token
   * @param symbol - Token symbol
   * @returns Price data
   */
  getPrice(symbol: string): Promise<PriceData> {
    const price = this.mockPrices.get(symbol.toUpperCase()) ?? 0;
    return Promise.resolve({
      symbol: symbol.toUpperCase(),
      priceUSD: price,
      change24h: 0,
      timestamp: Date.now(),
      source: 'mock'
    });
  }

  /**
   * Get prices for multiple tokens
   * @param symbols - Array of token symbols
   * @returns Array of price data
   */
  async getPrices(symbols: string[]): Promise<PriceData[]> {
    return Promise.all(symbols.map(symbol => this.getPrice(symbol)));
  }

  /**
   * Get historical prices
   * @param options - Historical price options
   * @returns Array of historical price data
   */
  getHistoricalPrices(options: HistoricalPriceOptions): Promise<PriceData[]> {
    // Return mock historical data
    const currentPrice = this.mockPrices.get(options.symbol.toUpperCase()) ?? 0;
    const data: PriceData[] = [];

    for (let i = 0; i < 10; i++) {
      data.push({
        symbol: options.symbol.toUpperCase(),
        priceUSD: currentPrice * (1 + (Math.random() - 0.5) * 0.1),
        change24h: (Math.random() - 0.5) * 10,
        timestamp: Date.now() - i * 3600000,
        source: 'mock'
      });
    }

    return Promise.resolve(data);
  }

  /**
   * Subscribe to price updates
   * @param _symbols - Symbols to subscribe to
   * @param _callback - Callback for price updates
   * @returns Unsubscribe function
   */
  subscribeToPriceUpdates(
    _symbols: string[],
    _callback: (prices: PriceData[]) => void
  ): () => void {
    // Mock implementation - no real subscription
    return () => {
      // Unsubscribe
    };
  }

  /**
   * Force refresh prices
   * @param _symbols - Symbols to refresh
   */
  async refreshPrices(_symbols: string[]): Promise<void> {
    // Mock implementation - no action needed
  }
}

// Export singleton instance for testing
export const mockPriceFeedService = new MockPriceFeedService();