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
    ['USD', 1.0],
    ['DAI', 1.0]
  ]);

  /**
   * Initialize the mock price oracle service
   * @returns Promise that resolves when initialization is complete
   */
  init(): Promise<void> {
    // Mock initialization
    return Promise.resolve();
  }

  /**
   * Get token price from mock data
   * @param symbol - Token symbol to get price for
   * @param _chain - Chain identifier (unused in mock)
   * @returns Promise resolving to token price in USD
   */
  getTokenPrice(symbol: string, _chain?: string): Promise<number> {
    const basePrice = this.prices.get(symbol);
    if (basePrice === undefined) {
      return Promise.resolve(0);
    }
    // Add slight variation
    return Promise.resolve(basePrice * (0.95 + Math.random() * 0.1));
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

  /**
   * Start the price oracle service
   * @returns Promise that resolves when service is started
   */
  async start(): Promise<void> {
    // Mock start - nothing to do
    return Promise.resolve();
  }

  /**
   * Get price for a trading pair
   * @param base - Base token symbol
   * @param quote - Quote token symbol
   * @returns Promise resolving to price
   */
  async getPrice(base: string, quote: string): Promise<number> {
    const basePrice = await this.getTokenPrice(base);
    const quotePrice = await this.getTokenPrice(quote);

    if (quotePrice === 0) {
      return 0;
    }

    return basePrice / quotePrice;
  }

  /**
   * Get historical prices for a pair
   * @param options - Historical price query options
   * @param options.pair - Trading pair (e.g., 'ETH/USD')
   * @param options.from - Start timestamp
   * @param options.to - End timestamp
   * @param options.interval - Time interval
   * @returns Promise resolving to historical price points
   */
  async getHistoricalPrices(options: {
    pair: string;
    from: number;
    to: number;
    interval: string;
  }): Promise<Array<{ timestamp: number; price: number; volume: number }>> {
    const [base, quote] = options.pair.split('/');
    const basePrice = await this.getPrice(base ?? 'ETH', quote ?? 'USD');
    const points = [];
    const intervalMs = this.parseInterval(options.interval);

    for (let t = options.from; t <= options.to; t += intervalMs) {
      points.push({
        timestamp: t,
        price: basePrice * (0.9 + Math.random() * 0.2),
        volume: Math.random() * 1000000
      });
    }

    return points;
  }

  /**
   * Parse interval string to milliseconds
   * @param interval - Interval string
   * @returns Interval in milliseconds
   */
  private parseInterval(interval: string): number {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[interval] ?? 60 * 60 * 1000;
  }

  /**
   * Get random number
   * @param params - Random number parameters
   * @param params.min - Minimum value
   * @param params.max - Maximum value
   * @param params.seed - Random seed
   * @returns Promise resolving to verifiable random result
   */
  getRandomNumber(params?: {
    min?: number;
    max?: number;
    seed?: string;
  }): Promise<{
    value: number;
    proof: string;
    blockNumber: number;
  }> {
    const min = params?.min ?? 0;
    const max = params?.max ?? 100;
    const value = Math.floor(Math.random() * (max - min + 1)) + min;

    return Promise.resolve({
      value,
      proof: '0x' + Math.random().toString(16).substring(2),
      blockNumber: Math.floor(Date.now() / 1000)
    });
  }
}