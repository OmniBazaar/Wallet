/**
 * OmniOracle Service
 * Local implementation of oracle service for XOM/pXOM price data
 */

/**
 * Token price data from OmniOracle
 */
export interface OmniTokenPrice {
  /** Token symbol */
  token: string;
  /** Price in USD */
  price: number;
  /** 24h change percentage */
  change24h?: number;
  /** Timestamp */
  timestamp: number;
  /** Volume 24h */
  volume24h?: number;
  /** Market cap */
  marketCap?: number;
  /** Metadata flag */
  metadata?: boolean;
}

/**
 * Query parameters for token price
 */
export interface TokenPriceQuery {
  /** Token symbol */
  token: string;
  /** Include additional metadata */
  includeMetadata?: boolean;
}

/**
 * OmniOracle service for XOM and pXOM price data
 */
export class OmniOracleService {
  /** Base prices for tokens */
  private readonly basePrices = new Map<string, number>([
    ['XOM', 0.10],  // Base XOM price
    ['pXOM', 0.10], // pXOM maintains 1:1 peg with XOM
    ['AVAX', 35.00],
    ['ETH', 2500.00],
    ['USDT', 1.00],
    ['USDC', 1.00],
    ['DAI', 1.00]
  ]);

  /** Initialization flag */
  private initialized = false;

  /**
   * Initialize the oracle service
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    // Simulate initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    this.initialized = true;
  }

  /**
   * Get token price with optional metadata
   * @param query - Token price query parameters
   * @returns Token price data
   */
  async getTokenPrice(query: TokenPriceQuery): Promise<OmniTokenPrice> {
    if (!this.initialized) {
      await this.init();
    }

    const basePrice = this.basePrices.get(query.token) || 0;
    
    // Simulate price fluctuation (±5%)
    const fluctuation = (Math.random() - 0.5) * 0.1;
    const price = basePrice * (1 + fluctuation);
    
    // Calculate 24h change
    const change24h = (Math.random() - 0.5) * 10; // ±5%
    
    const result: OmniTokenPrice = {
      token: query.token,
      price,
      change24h,
      timestamp: Date.now()
    };
    
    if (query.includeMetadata) {
      result.volume24h = price * Math.random() * 1000000; // Random volume
      result.marketCap = price * 1000000000; // 1B supply assumed
      result.metadata = true;
    }
    
    return result;
  }

  /**
   * Get multiple token prices
   * @param tokens - Array of token symbols
   * @returns Array of token prices
   */
  async getMultipleTokenPrices(tokens: string[]): Promise<OmniTokenPrice[]> {
    const promises = tokens.map(token => 
      this.getTokenPrice({ token, includeMetadata: false })
    );
    return Promise.all(promises);
  }

  /**
   * Get price for token pair
   * @param baseToken - Base token symbol
   * @param quoteToken - Quote token symbol
   * @returns Exchange rate
   */
  async getTokenPairPrice(baseToken: string, quoteToken: string): Promise<number> {
    const [base, quote] = await this.getMultipleTokenPrices([baseToken, quoteToken]);
    return base.price / quote.price;
  }

  /**
   * Validate token is supported
   * @param token - Token symbol
   * @returns True if token is supported
   */
  isTokenSupported(token: string): boolean {
    return this.basePrices.has(token);
  }
}