/**
 * Mock Price Oracle Service
 * Local implementation to avoid cross-module dependencies during testing
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

  async init(): Promise<void> {
    // Mock initialization
  }

  async getTokenPrice(symbol: string, chain?: string): Promise<number> {
    const basePrice = this.prices.get(symbol) || 0;
    // Add slight variation
    return basePrice * (0.95 + Math.random() * 0.1);
  }

  async getPrices(tokens: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const token of tokens) {
      result[token] = await this.getTokenPrice(token);
    }
    return result;
  }
}