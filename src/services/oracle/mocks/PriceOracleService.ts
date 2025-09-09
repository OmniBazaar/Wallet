/**
 * Mock Price Oracle Service
 * Local implementation to avoid cross-module dependencies during testing
 */

/**
 * Mock Price Oracle Service implementation for testing
 * Provides simulated price data without external dependencies
 */
export class PriceOracleService {
  private prices = new Map<string, number>([
    ['ETH', 2500],
    ['BTC', 45000],
    ['AVAX', 35],
    ['MATIC', 0.85],
    ['BNB', 300],
    ['XOM', 0.10],
    ['pXOM', 0.10],
    ['USDT', 1.0],
    ['USDC', 1.0],
    ['DAI', 1.0]
  ]);

  /**
   * Initialize the mock price oracle service
   */
  async init(): Promise<void> {
    // Mock initialization
  }

  /**
   * Get token price from mock data
   * @param symbol - Token symbol to get price for
   * @param _chain - Chain identifier (unused in mock)
   * @returns Promise resolving to token price in USD
   */
  async getTokenPrice(symbol: string, _chain?: string): Promise<number> {
    const basePrice = this.prices.get(symbol);
    if (basePrice === undefined) {
      return 0;
    }
    // Add slight variation
    return basePrice * (0.95 + Math.random() * 0.1);
  }

  /**
   * Get prices for multiple tokens
   * @param tokens - Array of token symbols
   * @returns Promise resolving to price map
   */
  async getPrices(tokens: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const token of tokens) {
      result[token] = await this.getTokenPrice(token);
    }
    return result;
  }
}