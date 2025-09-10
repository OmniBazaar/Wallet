/**
 * Mock Oracle Aggregator
 * Local implementation to avoid cross-module dependencies during testing
 */

/**
 * Aggregated price data structure
 */
export interface AggregatedPriceData {
  /** Price in USD */
  price: number;
  /** 24-hour price change percentage */
  change24h?: number;
  /** Timestamp of price data */
  timestamp: number;
  /** Array of source names */
  sources: string[];
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Pool liquidity data structure
 */
export interface PoolLiquidityData {
  /** First token symbol */
  tokenA: string;
  /** Second token symbol */
  tokenB: string;
  /** Liquidity in USD */
  liquidityUSD?: number;
  /** Chain identifier */
  chain?: string;
}

/**
 * Historical price data point
 */
export interface HistoricalPricePoint {
  /** Timestamp of price point */
  timestamp: number;
  /** Price value */
  price: number;
  /** Trading volume */
  volume?: number;
}

/**
 * Mock Oracle Aggregator implementation
 */
export class OracleAggregator {
  /**
   * Initialize the oracle aggregator
   * @returns Promise that resolves when initialization is complete
   */
  init(): Promise<void> {
    // Mock initialization
    return Promise.resolve();
  }

  /**
   * Get aggregated price from multiple sources
   * @param params - Price query parameters
   * @param params.token - Token symbol
   * @param params.chain - Chain identifier
   * @param params.sources - Array of source names
   * @returns Promise resolving to aggregated price data
   */
  getAggregatedPrice(params: {
    /** Token symbol */
    token: string;
    /** Chain identifier */
    chain?: string;
    /** Array of source names */
    sources?: string[];
  }): Promise<AggregatedPriceData> {
    // Mock aggregated price
    const basePrice = this.getMockPrice(params.token);
    return Promise.resolve({
      price: basePrice,
      change24h: (Math.random() - 0.5) * 10,
      timestamp: Date.now(),
      sources: params.sources ?? ['mock'],
      confidence: 0.95
    });
  }

  /**
   * Get historical price data
   * @param params - Historical price query parameters
   * @param params.token - Token symbol
   * @param params.from - Start timestamp
   * @param params.to - End timestamp
   * @param params.interval - Time interval
   * @param params.chain - Chain identifier
   * @returns Promise resolving to historical price points
   */
  getHistoricalPrices(params: {
    /** Token symbol */
    token: string;
    /** Start timestamp */
    from: number;
    /** End timestamp */
    to: number;
    /** Time interval */
    interval?: string;
    /** Chain identifier */
    chain?: string;
  }): Promise<HistoricalPricePoint[]> {
    const points: HistoricalPricePoint[] = [];
    const basePrice = this.getMockPrice(params.token);
    const intervalMs = this.parseInterval(params.interval ?? '1h');
    
    for (let t = params.from; t <= params.to; t += intervalMs) {
      points.push({
        timestamp: t,
        price: basePrice * (0.9 + Math.random() * 0.2),
        volume: Math.random() * 1000000
      });
    }
    
    return Promise.resolve(points);
  }

  /**
   * Get pool liquidity data
   * @param params - Pool liquidity query parameters
   * @returns Promise resolving to liquidity data
   */
  getPoolLiquidity(params: PoolLiquidityData): Promise<PoolLiquidityData> {
    return Promise.resolve({
      ...params,
      liquidityUSD: Math.random() * 10000000 // Random liquidity up to $10M
    });
  }

  /**
   * Get mock price for a token
   * @param token - Token symbol
   * @returns Mock price value
   */
  private getMockPrice(token: string): number {
    const prices: Record<string, number> = {
      'ETH': 2500,
      'BTC': 45000,
      'AVAX': 35,
      'XOM': 0.10,
      'pXOM': 0.10,
      'USDT': 1.0,
      'USDC': 1.0
    };
    return prices[token] ?? 1.0;
  }

  /**
   * Parse interval string to milliseconds
   * @param interval - Interval string (e.g., '1h', '1d')
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
}