/**
 * Mock Price Feed Service for Testing
 * Provides mock price data without external dependencies
 */

import type { PriceData, HistoricalPriceOptions } from './PriceFeedService';

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
  async getPrice(symbol: string): Promise<PriceData> {
    const price = this.mockPrices.get(symbol.toUpperCase()) || 0;
    return {
      symbol: symbol.toUpperCase(),
      priceUSD: price,
      change24h: 0,
      timestamp: Date.now(),
      source: 'mock'
    };
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
  async getHistoricalPrices(options: HistoricalPriceOptions): Promise<PriceData[]> {
    // Return mock historical data
    const currentPrice = this.mockPrices.get(options.symbol.toUpperCase()) || 0;
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

    return data;
  }

  /**
   * Subscribe to price updates
   * @param symbols - Symbols to subscribe to
   * @param callback - Callback for price updates
   * @returns Unsubscribe function
   */
  subscribeToPriceUpdates(
    symbols: string[],
    callback: (prices: PriceData[]) => void
  ): () => void {
    // Mock implementation - no real subscription
    return () => {
      // Unsubscribe
    };
  }

  /**
   * Force refresh prices
   * @param symbols - Symbols to refresh
   */
  async refreshPrices(symbols: string[]): Promise<void> {
    // Mock implementation - no action needed
  }
}

// Export singleton instance for testing
export const mockPriceFeedService = new MockPriceFeedService();