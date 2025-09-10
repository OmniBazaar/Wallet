/**
 * Price Feed Service
 * Provides aggregated price data from multiple oracle sources with caching
 */

import { PriceOracleService } from './mocks/PriceOracleService';
import { OracleAggregator } from './mocks/OracleAggregator';

/**
 * Price data structure
 */
export interface PriceData {
  /** Token symbol */
  symbol: string;
  /** Price in USD */
  priceUSD: number;
  /** Price change percentage (24h) */
  change24h: number;
  /** Timestamp of price data */
  timestamp: number;
  /** Source of price data */
  source: string;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Multi-token price query parameters
 */
export interface MultiPriceQuery {
  /** Array of token symbols to query */
  tokens: string[];
  /** Chain ID or name */
  chain?: string;
  /** Include metadata */
  includeMetadata?: boolean;
}

/**
 * Historical price query parameters
 */
export interface HistoricalPriceQuery {
  /** Token symbol */
  token: string;
  /** Start timestamp */
  from: number;
  /** End timestamp */
  to: number;
  /** Time interval (e.g., '1h', '1d') */
  interval?: string;
  /** Chain ID or name */
  chain?: string;
}

/**
 * Price pair data
 */
export interface PricePair {
  /** Base token */
  base: string;
  /** Quote token */
  quote: string;
  /** Exchange rate */
  rate: number;
  /** Liquidity in USD */
  liquidityUSD: number;
  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Price feed service for aggregating token prices from multiple oracles
 * @example
 * ```typescript
 * const priceFeed = new PriceFeedService();
 * await priceFeed.init();
 * const price = await priceFeed.getPrice('ETH');
 * console.log(`ETH price: $${price.priceUSD}`);
 * ```
 */
export class PriceFeedService {
  /** Price oracle service from Validator module */
  private priceOracle?: PriceOracleService;
  
  /** Oracle aggregator for multiple sources */
  private oracleAggregator?: OracleAggregator;
  
  
  /** Price cache with TTL */
  private priceCache: Map<string, { data: PriceData; expires: number }> = new Map();
  
  /** Cache TTL in milliseconds (30 seconds) */
  private readonly CACHE_TTL = 30 * 1000;
  
  /** Initialization status */
  private isInitialized = false;
  
  /**
   * Initialize the price feed service
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When initialization fails
   */
  init(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    try {
      // Initialize oracle services using constructor pattern  
      this.priceOracle = new PriceOracleService();
      this.oracleAggregator = new OracleAggregator();
      
      // Services are ready to use (no init needed for mock implementations)
      
      this.isInitialized = true;
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Promise.reject(new Error(`Failed to initialize price feed service: ${errorMessage}`));
    }
  }
  
  /**
   * Get current price for a single token
   * @param symbol - Token symbol (e.g., 'ETH', 'XOM', 'pXOM')
   * @param chain - Optional chain ID or name
   * @returns Promise resolving to price data
   * @throws {Error} When price fetch fails
   */
  async getPrice(symbol: string, chain?: string): Promise<PriceData> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    // Check cache first
    const cacheKey = `${symbol}-${chain ?? 'default'}`;
    const cached = this.priceCache.get(cacheKey);
    if (cached !== undefined && cached.expires > Date.now()) {
      return cached.data;
    }
    
    try {
      // Special handling for XOM and pXOM
      if (symbol === 'XOM' || symbol === 'pXOM') {
        return await this.getOmniPrice(symbol);
      }
      
      // Get price from aggregated sources
      const aggregatedPrice = await this.getAggregatedPrice(symbol, chain);
      
      // Cache the result
      this.priceCache.set(cacheKey, {
        data: aggregatedPrice,
        expires: Date.now() + this.CACHE_TTL
      });
      
      return aggregatedPrice;
    } catch (error) {
      // Try fallback sources
      return await this.getFallbackPrice(symbol, chain);
    }
  }
  
  /**
   * Get prices for multiple tokens
   * @param query - Multi-price query parameters
   * @returns Promise resolving to array of price data
   */
  async getMultiplePrices(query: MultiPriceQuery): Promise<PriceData[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    // Fetch prices in parallel
    const pricePromises = query.tokens.map(token => 
      this.getPrice(token, query.chain).catch(error => {
        console.error(`Failed to get price for ${token}:`, error);
        return {
          symbol: token,
          priceUSD: 0,
          change24h: 0,
          timestamp: Date.now(),
          source: 'error',
          confidence: 0
        } as PriceData;
      })
    );
    
    return Promise.all(pricePromises);
  }
  
  /**
   * Get historical price data
   * @param query - Historical price query parameters
   * @returns Promise resolving to array of historical prices
   */
  async getHistoricalPrices(query: HistoricalPriceQuery): Promise<Array<{
    timestamp: number;
    price: number;
    volume?: number;
  }>> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    if (this.oracleAggregator === undefined) {
      throw new Error('Oracle aggregator not initialized');
    }
    
    try {
      // Get historical data from oracle aggregator
      const historicalData = await this.oracleAggregator.getHistoricalPrices({
        token: query.token,
        from: query.from,
        to: query.to,
        interval: query.interval ?? '1h',
        ...(query.chain !== undefined && { chain: query.chain })
      });
      
      return historicalData.map(point => ({
        timestamp: point.timestamp,
        price: point.price,
        ...(point.volume !== undefined && { volume: point.volume })
      }));
    } catch (error) {
      // Failed to get historical prices
      return [];
    }
  }
  
  /**
   * Get price for token pair
   * @param base - Base token symbol
   * @param quote - Quote token symbol
   * @param chain - Optional chain ID or name
   * @returns Promise resolving to price pair data
   */
  async getPricePair(base: string, quote: string, chain?: string): Promise<PricePair> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    // Get prices for both tokens
    const [basePrice, quotePrice] = await Promise.all([
      this.getPrice(base, chain),
      this.getPrice(quote, chain)
    ]);
    
    // Calculate exchange rate
    const rate = quotePrice.priceUSD > 0 ? basePrice.priceUSD / quotePrice.priceUSD : 0;
    
    // Get liquidity data if available
    let liquidityUSD = 0;
    if (this.oracleAggregator !== undefined) {
      try {
        // Mock pool liquidity for development
        liquidityUSD = 1000000; // $1M mock liquidity
      } catch {
        // Liquidity data not available
      }
    }
    
    return {
      base,
      quote,
      rate,
      liquidityUSD,
      lastUpdate: Date.now()
    };
  }
  
  /**
   * Subscribe to price updates
   * @param symbols - Array of token symbols to monitor
   * @param callback - Callback function for price updates
   * @returns Unsubscribe function
   */
  subscribeToPriceUpdates(
    symbols: string[],
    callback: (prices: Map<string, PriceData>) => void
  ): () => void {
    // Poll for price updates
    const updatePrices = async (): Promise<void> => {
      const prices = new Map<string, PriceData>();
      
      for (const symbol of symbols) {
        try {
          const price = await this.getPrice(symbol);
          prices.set(symbol, price);
        } catch (error) {
          // Failed to update price for symbol
        }
      }
      
      callback(prices);
    };
    
    // Initial update
    void updatePrices();
    
    // Set up polling interval (every 30 seconds)
    const interval = setInterval(() => {
      void updatePrices();
    }, 30000);
    
    // Return unsubscribe function
    return () => clearInterval(interval);
  }
  
  /**
   * Get aggregated price from multiple oracles
   * @param symbol - Token symbol
   * @param _chain - Optional chain ID or name
   * @returns Promise resolving to price data
   * @private
   */
  private getAggregatedPrice(symbol: string, _chain?: string): Promise<PriceData> {
    if (this.oracleAggregator === undefined) {
      throw new Error('Oracle aggregator not initialized');
    }
    
    // Mock aggregated price for development
    const aggregatedData = {
      price: 100.0 + Math.random() * 20,
      change24h: (Math.random() - 0.5) * 10,
      timestamp: Date.now(),
      sources: ['mock-oracle']
    };
    
    return Promise.resolve({
      symbol,
      priceUSD: aggregatedData.price,
      change24h: aggregatedData.change24h !== 0 ? aggregatedData.change24h : 0,
      timestamp: aggregatedData.timestamp,
      source: aggregatedData.sources.join(','),
      confidence: 0.95
    });
  }
  
  /**
   * Get price specifically for XOM or pXOM
   * @param symbol - 'XOM' or 'pXOM'
   * @returns Promise resolving to price data for OmniCoin
   * @private
   */
  private getOmniPrice(symbol: string): Promise<PriceData> {
    // Use the general price oracle for XOM/pXOM
    if (this.priceOracle !== undefined) {
      // Mock price for development
      const price = symbol === 'XOM' ? 1.0 : 0.95;
      return Promise.resolve({
        symbol,
        priceUSD: price,
        change24h: 0,
        timestamp: Date.now(),
        source: 'price-oracle',
        confidence: 0.9
      });
    }
    
    return Promise.reject(new Error('Price oracle not initialized'));
  }
  
  /**
   * Get price from fallback sources
   * @param symbol - Token symbol
   * @param _chain - Optional chain ID or name
   * @returns Promise resolving to price data from fallback source
   * @private
   */
  private getFallbackPrice(symbol: string, _chain?: string): Promise<PriceData> {
    // Try primary price oracle
    if (this.priceOracle !== undefined) {
      try {
        // Mock fallback price for development
        const price = 50.0 + Math.random() * 100;
        return Promise.resolve({
          symbol,
          priceUSD: price,
          change24h: 0,
          timestamp: Date.now(),
          source: 'fallback',
          confidence: 0.8
        });
      } catch (error) {
        // Fallback price oracle failed
      }
    }
    
    // If all sources fail, throw error
    return Promise.reject(new Error(`Failed to get price for ${symbol}`));
  }
  
  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }
  
  /**
   * Generate mock historical prices for development
   * @param _token - Token symbol (unused in mock)
   * @param from - Start timestamp
   * @param to - End timestamp
   * @returns Array of historical price points
   */
  private generateMockHistoricalPrices(_token: string, from: number, to: number): Array<{ timestamp: number; price: number; volume: number }> {
    const data = [];
    const timespan = to - from;
    const points = Math.min(100, Math.max(10, timespan / (60 * 60 * 1000))); // 1 point per hour
    const basePrice = 100;
    
    for (let i = 0; i < points; i++) {
      const timestamp = from + (i * timespan / points);
      const variation = (Math.random() - 0.5) * 0.1; // 10% variation
      const price = basePrice * (1 + variation);
      
      data.push({
        timestamp,
        price,
        volume: Math.random() * 1000000
      });
    }
    
    return data;
  }

  /**
   * Cleanup service and release resources
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void> {
    try {
      this.clearCache();
      this.isInitialized = false;
      this.priceOracle = undefined as unknown as PriceOracleService;
      this.oracleAggregator = undefined as unknown as OracleAggregator;
    } catch (error) {
      // Fail silently on cleanup
    }
    return Promise.resolve();
  }
}

// Export singleton instance
export const priceFeedService = new PriceFeedService();