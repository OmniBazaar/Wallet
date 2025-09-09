import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { PriceFeedService } from '../../src/services/oracle/PriceFeedService';
import { PriceOracleService } from '../../../../Validator/src/services/PriceOracleService';
import { OracleAggregator } from '../../../../Validator/src/services/dex/oracles/OracleAggregator';
import { OmniOracleService } from '../../../../Coin/src/services/OmniOracleService';

// Mock the Validator and Coin modules
vi.mock('../../../../Validator/src/services/PriceOracleService');
vi.mock('../../../../Validator/src/services/dex/oracles/OracleAggregator');
vi.mock('../../../../Coin/src/services/OmniOracleService');

describe('PriceFeedService', () => {
  let priceFeedService: PriceFeedService;
  let mockPriceOracle: PriceOracleService;
  let mockOracleAggregator: OracleAggregator;
  let mockOmniOracle: OmniOracleService;

  beforeEach(() => {
    // Create service instance
    priceFeedService = new PriceFeedService();

    // Setup mocks
    mockPriceOracle = new PriceOracleService();
    mockOracleAggregator = new OracleAggregator();
    mockOmniOracle = new OmniOracleService();

    // Mock initialization methods
    (mockPriceOracle.init as Mock).mockResolvedValue(undefined);
    (mockOracleAggregator.init as Mock).mockResolvedValue(undefined);
    (mockOmniOracle.init as Mock).mockResolvedValue(undefined);

    // Clear cache
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all oracle services', async () => {
      await priceFeedService.init();

      expect(mockPriceOracle.init).toHaveBeenCalled();
      expect(mockOracleAggregator.init).toHaveBeenCalled();
      expect(mockOmniOracle.init).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await priceFeedService.init();
      await priceFeedService.init();

      expect(mockPriceOracle.init).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization failure', async () => {
      (mockPriceOracle.init as Mock).mockRejectedValue(new Error('Init failed'));

      await expect(priceFeedService.init()).rejects.toThrow(
        'Failed to initialize price feed service: Init failed'
      );
    });
  });

  describe('getPrice', () => {
    beforeEach(async () => {
      await priceFeedService.init();
    });

    it('should get aggregated price for regular token', async () => {
      const mockAggregatedData = {
        price: 2000.50,
        change24h: 5.2,
        timestamp: Date.now(),
        sources: ['chainlink', 'uniswap'],
        confidence: 0.98
      };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockResolvedValue(mockAggregatedData);

      const result = await priceFeedService.getPrice('ETH');

      expect(result).toEqual({
        symbol: 'ETH',
        priceUSD: 2000.50,
        change24h: 5.2,
        timestamp: mockAggregatedData.timestamp,
        source: 'chainlink,uniswap',
        confidence: 0.98
      });

      expect(mockOracleAggregator.getAggregatedPrice).toHaveBeenCalledWith({
        token: 'ETH',
        chain: undefined,
        sources: ['chainlink', 'uniswap', 'sushiswap', 'curve']
      });
    });

    it('should get price for XOM token', async () => {
      const mockOmniPrice = {
        price: 0.85,
        change24h: -2.1,
        timestamp: Date.now()
      };

      (mockOmniOracle.getTokenPrice as Mock).mockResolvedValue(mockOmniPrice);

      const result = await priceFeedService.getPrice('XOM');

      expect(result).toEqual({
        symbol: 'XOM',
        priceUSD: 0.85,
        change24h: -2.1,
        timestamp: mockOmniPrice.timestamp,
        source: 'omni-oracle',
        confidence: 1.0
      });

      expect(mockOmniOracle.getTokenPrice).toHaveBeenCalledWith({
        token: 'XOM',
        includeMetadata: true
      });
    });

    it('should get price for pXOM token', async () => {
      const mockOmniPrice = {
        price: 0.83,
        change24h: -1.8,
        timestamp: Date.now()
      };

      (mockOmniOracle.getTokenPrice as Mock).mockResolvedValue(mockOmniPrice);

      const result = await priceFeedService.getPrice('pXOM');

      expect(result).toEqual({
        symbol: 'pXOM',
        priceUSD: 0.83,
        change24h: -1.8,
        timestamp: mockOmniPrice.timestamp,
        source: 'omni-oracle',
        confidence: 1.0
      });
    });

    it('should use cache for repeated requests', async () => {
      const mockData = {
        price: 100,
        timestamp: Date.now(),
        sources: ['test'],
        confidence: 0.95
      };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockResolvedValue(mockData);

      // First call
      await priceFeedService.getPrice('USDC');
      
      // Second call (should use cache)
      await priceFeedService.getPrice('USDC');

      expect(mockOracleAggregator.getAggregatedPrice).toHaveBeenCalledTimes(1);
    });

    it('should use fallback when aggregated price fails', async () => {
      (mockOracleAggregator.getAggregatedPrice as Mock).mockRejectedValue(new Error('Aggregator failed'));
      (mockPriceOracle.getTokenPrice as Mock).mockResolvedValue(150.25);

      const result = await priceFeedService.getPrice('BNB');

      expect(result).toEqual({
        symbol: 'BNB',
        priceUSD: 150.25,
        change24h: 0,
        timestamp: expect.any(Number),
        source: 'fallback',
        confidence: 0.8
      });
    });

    it('should fallback to price oracle for XOM when omni oracle fails', async () => {
      (mockOmniOracle.getTokenPrice as Mock).mockRejectedValue(new Error('OmniOracle failed'));
      (mockPriceOracle.getTokenPrice as Mock).mockResolvedValue(0.80);

      const result = await priceFeedService.getPrice('XOM');

      expect(result).toEqual({
        symbol: 'XOM',
        priceUSD: 0.80,
        change24h: 0,
        timestamp: expect.any(Number),
        source: 'price-oracle',
        confidence: 0.9
      });
    });

    it('should throw error when all price sources fail', async () => {
      (mockOracleAggregator.getAggregatedPrice as Mock).mockRejectedValue(new Error('Aggregator failed'));
      (mockPriceOracle.getTokenPrice as Mock).mockRejectedValue(new Error('Oracle failed'));

      await expect(priceFeedService.getPrice('UNKNOWN')).rejects.toThrow(
        'Failed to get price for UNKNOWN'
      );
    });
  });

  describe('getMultiplePrices', () => {
    beforeEach(async () => {
      await priceFeedService.init();
    });

    it('should get prices for multiple tokens', async () => {
      const mockPrices = {
        ETH: { price: 2000, timestamp: Date.now(), sources: ['test'], confidence: 0.95 },
        BTC: { price: 40000, timestamp: Date.now(), sources: ['test'], confidence: 0.95 },
        USDC: { price: 1, timestamp: Date.now(), sources: ['test'], confidence: 0.95 }
      };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockImplementation(({ token }) => 
        Promise.resolve(mockPrices[token as keyof typeof mockPrices])
      );

      const result = await priceFeedService.getMultiplePrices({
        tokens: ['ETH', 'BTC', 'USDC']
      });

      expect(result).toHaveLength(3);
      expect(result[0].symbol).toBe('ETH');
      expect(result[0].priceUSD).toBe(2000);
      expect(result[1].symbol).toBe('BTC');
      expect(result[1].priceUSD).toBe(40000);
      expect(result[2].symbol).toBe('USDC');
      expect(result[2].priceUSD).toBe(1);
    });

    it('should handle partial failures gracefully', async () => {
      (mockOracleAggregator.getAggregatedPrice as Mock).mockImplementation(({ token }) => {
        if (token === 'FAIL') {
          return Promise.reject(new Error('Price not available'));
        }
        return Promise.resolve({ price: 100, timestamp: Date.now(), sources: ['test'], confidence: 0.95 });
      });

      const result = await priceFeedService.getMultiplePrices({
        tokens: ['ETH', 'FAIL', 'USDC']
      });

      expect(result).toHaveLength(3);
      expect(result[1]).toEqual({
        symbol: 'FAIL',
        priceUSD: 0,
        change24h: 0,
        timestamp: expect.any(Number),
        source: 'error',
        confidence: 0
      });
    });
  });

  describe('getHistoricalPrices', () => {
    beforeEach(async () => {
      await priceFeedService.init();
    });

    it('should get historical price data', async () => {
      const mockHistoricalData = [
        { timestamp: 1000, price: 100, volume: 1000000 },
        { timestamp: 2000, price: 105, volume: 1100000 },
        { timestamp: 3000, price: 110, volume: 1200000 }
      ];

      (mockOracleAggregator.getHistoricalPrices as Mock).mockResolvedValue(mockHistoricalData);

      const result = await priceFeedService.getHistoricalPrices({
        token: 'ETH',
        from: 1000,
        to: 3000,
        interval: '1h'
      });

      expect(result).toEqual(mockHistoricalData);
      expect(mockOracleAggregator.getHistoricalPrices).toHaveBeenCalledWith({
        token: 'ETH',
        from: 1000,
        to: 3000,
        interval: '1h',
        chain: undefined
      });
    });

    it('should return empty array on error', async () => {
      (mockOracleAggregator.getHistoricalPrices as Mock).mockRejectedValue(new Error('Historical data failed'));

      const result = await priceFeedService.getHistoricalPrices({
        token: 'ETH',
        from: 1000,
        to: 3000
      });

      expect(result).toEqual([]);
    });
  });

  describe('getPricePair', () => {
    beforeEach(async () => {
      await priceFeedService.init();
    });

    it('should calculate price pair correctly', async () => {
      const mockPrices = {
        ETH: { price: 2000, timestamp: Date.now(), sources: ['test'], confidence: 0.95 },
        USDC: { price: 1, timestamp: Date.now(), sources: ['test'], confidence: 0.95 }
      };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockImplementation(({ token }) => 
        Promise.resolve(mockPrices[token as keyof typeof mockPrices])
      );

      (mockOracleAggregator.getPoolLiquidity as Mock).mockResolvedValue({ liquidityUSD: 5000000 });

      const result = await priceFeedService.getPricePair('ETH', 'USDC');

      expect(result).toEqual({
        base: 'ETH',
        quote: 'USDC',
        rate: 2000,
        liquidityUSD: 5000000,
        lastUpdate: expect.any(Number)
      });
    });

    it('should handle zero quote price', async () => {
      (mockOracleAggregator.getAggregatedPrice as Mock).mockImplementation(({ token }) => 
        Promise.resolve({ price: token === 'ETH' ? 2000 : 0, timestamp: Date.now(), sources: ['test'], confidence: 0.95 })
      );

      const result = await priceFeedService.getPricePair('ETH', 'INVALID');

      expect(result.rate).toBe(0);
    });

    it('should handle missing liquidity data', async () => {
      (mockOracleAggregator.getAggregatedPrice as Mock).mockResolvedValue({
        price: 100,
        timestamp: Date.now(),
        sources: ['test'],
        confidence: 0.95
      });

      (mockOracleAggregator.getPoolLiquidity as Mock).mockRejectedValue(new Error('No liquidity data'));

      const result = await priceFeedService.getPricePair('TOKEN1', 'TOKEN2');

      expect(result.liquidityUSD).toBe(0);
    });
  });

  describe('subscribeToPriceUpdates', () => {
    beforeEach(async () => {
      await priceFeedService.init();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should provide price updates via callback', async () => {
      const callback = vi.fn();
      const mockPrice = { price: 100, timestamp: Date.now(), sources: ['test'], confidence: 0.95 };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockResolvedValue(mockPrice);

      const unsubscribe = priceFeedService.subscribeToPriceUpdates(['ETH', 'BTC'], callback);

      // Wait for initial update
      await vi.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalled();
      const priceMap = callback.mock.calls[0][0];
      expect(priceMap.get('ETH')).toBeDefined();
      expect(priceMap.get('BTC')).toBeDefined();

      // Cleanup
      unsubscribe();
    });

    it('should handle update errors gracefully', async () => {
      const callback = vi.fn();
      
      (mockOracleAggregator.getAggregatedPrice as Mock).mockRejectedValue(new Error('Update failed'));

      const unsubscribe = priceFeedService.subscribeToPriceUpdates(['FAIL'], callback);

      // Wait for initial update
      await vi.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalled();
      const priceMap = callback.mock.calls[0][0];
      expect(priceMap.size).toBe(0);

      // Cleanup
      unsubscribe();
    });

    it('should stop updates when unsubscribed', async () => {
      const callback = vi.fn();
      
      const unsubscribe = priceFeedService.subscribeToPriceUpdates(['ETH'], callback);
      unsubscribe();

      // Advance time
      vi.advanceTimersByTime(60000);

      // Should only be called once (initial call)
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await priceFeedService.init();
    });

    it('should clear cache', async () => {
      const mockData = {
        price: 100,
        timestamp: Date.now(),
        sources: ['test'],
        confidence: 0.95
      };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockResolvedValue(mockData);

      // Get price (caches it)
      await priceFeedService.getPrice('ETH');
      
      // Clear cache
      priceFeedService.clearCache();
      
      // Get price again (should call aggregator again)
      await priceFeedService.getPrice('ETH');

      expect(mockOracleAggregator.getAggregatedPrice).toHaveBeenCalledTimes(2);
    });

    it('should respect cache TTL', async () => {
      vi.useFakeTimers();
      
      const mockData = {
        price: 100,
        timestamp: Date.now(),
        sources: ['test'],
        confidence: 0.95
      };

      (mockOracleAggregator.getAggregatedPrice as Mock).mockResolvedValue(mockData);

      // Get price (caches it)
      await priceFeedService.getPrice('ETH');
      
      // Advance time beyond cache TTL (30 seconds)
      vi.advanceTimersByTime(31000);
      
      // Get price again (should call aggregator again)
      await priceFeedService.getPrice('ETH');

      expect(mockOracleAggregator.getAggregatedPrice).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await priceFeedService.init();
      await priceFeedService.cleanup();

      // Should clear cache and reset state
      await expect(priceFeedService.getPrice('ETH')).resolves.toBeDefined();
      
      // Should reinitialize
      expect(mockPriceOracle.init).toHaveBeenCalledTimes(2);
    });
  });
});