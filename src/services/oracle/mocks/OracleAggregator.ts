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
   * Start the oracle aggregator service
   * @returns Promise that resolves when service is started
   */
  async start(): Promise<void> {
    // Mock start - nothing to do
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
  // Removed duplicate - see overloaded implementation below

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
      'USDC': 1.0,
      'USD': 1.0
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

  /**
   * Get aggregated price for a trading pair
   * @param base - Base token symbol
   * @param quote - Quote token symbol
   * @returns Promise resolving to aggregated price data
   */
  async getAggregatedPrice(base: string, quote?: string): Promise<AggregatedPriceData>;
  /**
   * Get aggregated price with parameters
   * @param params - Price query parameters
   * @param params.token - Token symbol
   * @param params.chain - Chain identifier
   * @param params.sources - Array of source names
   * @returns Promise resolving to aggregated price data
   */
  async getAggregatedPrice(params: {
    token: string;
    chain?: string;
    sources?: string[];
  }): Promise<AggregatedPriceData>;
  /**
   * Get aggregated price implementation
   * @param baseOrParams - Base token or parameters object
   * @param quote - Quote token symbol (optional)
   * @returns Promise resolving to aggregated price data
   */
  getAggregatedPrice(
    baseOrParams: string | { token: string; chain?: string; sources?: string[] },
    quote?: string
  ): Promise<AggregatedPriceData> {
    let token: string;
    let sources: string[] | undefined;

    if (typeof baseOrParams === 'string') {
      // Called with base/quote pair
      const basePrice = this.getMockPrice(baseOrParams);
      const quotePrice = quote !== undefined && quote !== '' ? this.getMockPrice(quote) : 1;
      const price = quotePrice !== 0 ? basePrice / quotePrice : 0;

      return Promise.resolve({
        price,
        change24h: (Math.random() - 0.5) * 10,
        timestamp: Date.now(),
        sources: ['mock'],
        confidence: 0.95
      });
    } else {
      // Called with params object (original implementation)
      token = baseOrParams.token;
      sources = baseOrParams.sources;
      const basePrice = this.getMockPrice(token);

      return Promise.resolve({
        price: basePrice,
        change24h: (Math.random() - 0.5) * 10,
        timestamp: Date.now(),
        sources: sources ?? ['mock'],
        confidence: 0.95
      });
    }
  }

  /**
   * Get cross-chain price for assets
   * @param params - Cross-chain price query parameters
   * @param params.token - Token symbol
   * @param params.fromChain - Source chain identifier
   * @param params.toChain - Target chain identifier
   * @returns Promise resolving to price data
   */
  getCrossChainPrice(params: {
    token: string;
    fromChain: string;
    toChain: string;
  }): Promise<number> {
    // Mock cross-chain price - just return the token price with slight variation
    const basePrice = this.getMockPrice(params.token);
    return Promise.resolve(basePrice * (0.98 + Math.random() * 0.04)); // 2% variation for cross-chain
  }

  /**
   * Validate cross-chain state
   * @param params - Cross-chain validation parameters
   * @param params.sourceChain - Source chain identifier
   * @param params.targetChain - Target chain identifier
   * @param params.stateRoot - State root hash
   * @returns Promise resolving to validation result
   */
  validateCrossChainState(params: {
    sourceChain: string;
    targetChain: string;
    stateRoot: string;
  }): Promise<{
    isValid: boolean;
    timestamp: number;
    signatures: number;
  }> {
    // Mock validation - always return valid
    return Promise.resolve({
      isValid: true,
      isConsistent: true,
      timestamp: Date.now(),
      signatures: 3, // Mock 3 validator signatures
      states: params.sourceChain !== '' && params.targetChain !== '' ? {
        [params.sourceChain]: { stateRoot: params.stateRoot, blockNumber: 1000 },
        [params.targetChain]: { stateRoot: params.stateRoot, blockNumber: 1000 }
      } : {}
    });
  }

  /**
   * Get consensus data from multiple oracles
   * @param _query - Oracle query (unused in mock)
   * @returns Promise resolving to consensus data
   */
  getConsensus(_query: unknown): Promise<{
    result: unknown;
    confidence: number;
    sources: number;
  }> {
    // Mock consensus
    return Promise.resolve({
      result: { value: Math.random() * 100 },
      confidence: 0.95,
      sources: 3
    });
  }

  /**
   * Submit a dispute about oracle data
   * @param _params - Dispute parameters (unused in mock)
   * @param _params.oracleId - Oracle identifier
   * @param _params.reason - Reason for dispute
   * @param _params.evidence - Supporting evidence (optional)
   * @returns Promise resolving to dispute result
   */
  submitDispute(_params: {
    oracleId: string;
    reason: string;
    evidence?: string;
  }): Promise<{
    disputeId: string;
    status: string;
    estimatedResolutionTime?: number;
  }> {
    // Mock dispute submission
    return Promise.resolve({
      disputeId: 'dispute_' + Math.random().toString(36).substr(2, 9),
      status: 'pending',
      estimatedResolutionTime: Date.now() + 3600000 // 1 hour from now
    });
  }

  /**
   * Verify oracle signature
   * @param _params - Signature verification parameters (unused in mock)
   * @param _params.oracleId - Oracle identifier
   * @param _params.data - Data to verify
   * @param _params.signature - Signature to verify
   * @returns Promise resolving to verification result
   */
  verifyOracleSignature(_params: {
    oracleId: string;
    data: string;
    signature: string;
  }): Promise<boolean> {
    // Mock signature verification - always return true
    return Promise.resolve(true);
  }

  /**
   * Get verifiable random number
   * @param min - Minimum value
   * @param max - Maximum value
   * @param _seed - Optional seed (unused in mock)
   * @returns Promise resolving to random number result
   */
  getVerifiableRandom(
    min?: number,
    max?: number,
    _seed?: string
  ): Promise<{
    value: number;
    proof: string;
    blockNumber: number;
  }> {
    const minVal = min ?? 0;
    const maxVal = max ?? 100;
    const value = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;

    return Promise.resolve({
      value,
      proof: '0x' + Math.random().toString(16).substring(2),
      blockNumber: Math.floor(Date.now() / 1000)
    });
  }

  /**
   * Get external data from oracles
   * @param type - Data type
   * @param _params - Query parameters (unused in mock)
   * @returns Promise resolving to external data
   */
  getExternalData(type: string, _params?: unknown): Promise<unknown> {
    if (type === 'weather') {
      return Promise.resolve({
        temperature: 20 + Math.random() * 15,
        precipitation: Math.random() * 100,
        windSpeed: Math.random() * 50
      });
    } else if (type === 'sports') {
      return Promise.resolve([
        {
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          homeScore: Math.floor(Math.random() * 5),
          awayScore: Math.floor(Math.random() * 5),
          status: 'final'
        }
      ]);
    }
    return Promise.resolve(null);
  }
}