/**
 * Mock Oracle Aggregator
 * Local implementation to avoid cross-module dependencies during testing
 */

export interface AggregatedPriceData {
  price: number;
  change24h?: number;
  timestamp: number;
  sources: string[];
  confidence?: number;
}

export interface PoolLiquidityData {
  tokenA: string;
  tokenB: string;
  liquidityUSD?: number;
  chain?: string;
}

export interface HistoricalPricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

export class OracleAggregator {
  async init(): Promise<void> {
    // Mock initialization
  }

  async getAggregatedPrice(params: {
    token: string;
    chain?: string;
    sources?: string[];
  }): Promise<AggregatedPriceData> {
    // Mock aggregated price
    const basePrice = this.getMockPrice(params.token);
    return {
      price: basePrice,
      change24h: (Math.random() - 0.5) * 10,
      timestamp: Date.now(),
      sources: params.sources || ['mock'],
      confidence: 0.95
    };
  }

  async getHistoricalPrices(params: {
    token: string;
    from: number;
    to: number;
    interval?: string;
    chain?: string;
  }): Promise<HistoricalPricePoint[]> {
    const points: HistoricalPricePoint[] = [];
    const basePrice = this.getMockPrice(params.token);
    const intervalMs = this.parseInterval(params.interval || '1h');
    
    for (let t = params.from; t <= params.to; t += intervalMs) {
      points.push({
        timestamp: t,
        price: basePrice * (0.9 + Math.random() * 0.2),
        volume: Math.random() * 1000000
      });
    }
    
    return points;
  }

  async getPoolLiquidity(params: PoolLiquidityData): Promise<PoolLiquidityData> {
    return {
      ...params,
      liquidityUSD: Math.random() * 10000000 // Random liquidity up to $10M
    };
  }

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
    return prices[token] || 1.0;
  }

  private parseInterval(interval: string): number {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[interval] || 60 * 60 * 1000;
  }
}