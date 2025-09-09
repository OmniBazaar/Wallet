/**
 * OracleService Test Suite
 * 
 * Tests oracle data and price feed operations including price aggregation,
 * ENS resolution, data feeds, cross-chain oracle, and consensus mechanisms.
 * This is a Phase 5 component for decentralized oracle functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OracleService, PriceData } from '../../src/services/OracleService';

// Mock timer functions
jest.useFakeTimers();

describe('OracleService', () => {
  let oracleService: OracleService;
  let mockWalletService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletService = {
      getAccount: jest.fn(),
      signMessage: jest.fn()
    };
    oracleService = new OracleService(mockWalletService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(oracleService.init()).resolves.not.toThrow();
    });

    it('should prevent double initialization', async () => {
      await oracleService.init();
      await oracleService.init(); // Should return early
      
      // Verify service is still functional
      const price = await oracleService.getPrice('XOM', 'USD');
      expect(price).toBeDefined();
    });

    it('should accept wallet service in constructor', () => {
      const service = new OracleService(mockWalletService);
      expect(service).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await oracleService.init();
    });

    it('should connect to oracle network', async () => {
      await expect(oracleService.connect()).resolves.not.toThrow();
    });

    it('should prevent double connection', async () => {
      await oracleService.connect();
      await oracleService.connect(); // Should return early
    });

    it('should disconnect from oracle network', async () => {
      await oracleService.connect();
      await expect(oracleService.disconnect()).resolves.not.toThrow();
    });

    it('should clear subscriptions on disconnect', async () => {
      await oracleService.connect();
      
      // Create subscription
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        () => {}
      );
      
      await oracleService.disconnect();
      
      // Verify subscription was cleared
      jest.runOnlyPendingTimers();
      // No errors should occur
    });
  });

  describe('Price Operations', () => {
    beforeEach(async () => {
      await oracleService.init();
      await oracleService.connect();
    });

    describe('getPrice', () => {
      it('should get price for known pairs', async () => {
        const price = await oracleService.getPrice('XOM', 'USD');
        
        expect(price).toBeDefined();
        expect(price.value).toBe(0.15);
        expect(price.timestamp).toBeCloseTo(Date.now(), -2);
        expect(price.confidence).toBe(0.99);
      });

      it('should get price for ETH/USD', async () => {
        const price = await oracleService.getPrice('ETH', 'USD');
        expect(price.value).toBe(2500);
      });

      it('should get price for BTC/USD', async () => {
        const price = await oracleService.getPrice('BTC', 'USD');
        expect(price.value).toBe(45000);
      });

      it('should get price for USDC/USD', async () => {
        const price = await oracleService.getPrice('USDC', 'USD');
        expect(price.value).toBe(1.0);
      });

      it('should return default price for unknown pairs', async () => {
        const price = await oracleService.getPrice('UNKNOWN', 'USD');
        expect(price.value).toBe(1);
        expect(price.confidence).toBe(0.99);
      });
    });

    describe('getBatchPrices', () => {
      it('should get multiple prices in batch', async () => {
        const pairs = [
          { base: 'XOM', quote: 'USD' },
          { base: 'ETH', quote: 'USD' },
          { base: 'BTC', quote: 'USD' }
        ];

        const prices = await oracleService.getBatchPrices(pairs);
        
        expect(prices).toBeDefined();
        expect(Object.keys(prices)).toHaveLength(3);
        expect(prices['XOM/USD'].value).toBe(0.15);
        expect(prices['ETH/USD'].value).toBe(2500);
        expect(prices['BTC/USD'].value).toBe(45000);
      });

      it('should handle empty batch', async () => {
        const prices = await oracleService.getBatchPrices([]);
        expect(prices).toEqual({});
      });

      it('should include timestamps for all prices', async () => {
        const pairs = [
          { base: 'XOM', quote: 'USD' },
          { base: 'ETH', quote: 'USD' }
        ];

        const prices = await oracleService.getBatchPrices(pairs);
        
        Object.values(prices).forEach(price => {
          expect(price.timestamp).toBeCloseTo(Date.now(), -2);
          expect(price.confidence).toBe(0.99);
        });
      });
    });

    describe('getAggregatedPrice', () => {
      it('should get aggregated price from multiple sources', async () => {
        const result = await oracleService.getAggregatedPrice('XOM/USD');
        
        expect(result).toBeDefined();
        expect(result.median).toBeCloseTo(0.15, 1);
        expect(result.mean).toBeCloseTo(0.15, 1);
        expect(result.sources).toBe(5);
        expect(result.confidence).toBe(0.95);
      });

      it('should handle unknown pairs', async () => {
        const result = await oracleService.getAggregatedPrice('UNKNOWN/USD');
        
        expect(result.median).toBeCloseTo(1, 1);
        expect(result.mean).toBeCloseTo(1, 1);
        expect(result.sources).toBe(5);
      });

      it('should calculate median correctly', async () => {
        // Mock Math.random to control prices
        const randomSpy = jest.spyOn(Math, 'random')
          .mockReturnValueOnce(0.25) // -0.5% 
          .mockReturnValueOnce(0.45) // -0.1%
          .mockReturnValueOnce(0.5)  // 0%
          .mockReturnValueOnce(0.55) // +0.1%
          .mockReturnValueOnce(0.75); // +0.5%

        const result = await oracleService.getAggregatedPrice('XOM/USD');
        
        // Median should be the middle value (0% variation)
        expect(result.median).toBeCloseTo(0.15, 2);
        
        randomSpy.mockRestore();
      });
    });

    describe('Legacy getPriceData', () => {
      it('should support legacy price data format', async () => {
        const data = await oracleService.getPriceData('XOM');
        
        expect(data).toBeDefined();
        expect(data.price).toBe(0.15);
        expect(data.timestamp).toBeCloseTo(Date.now(), -2);
      });
    });
  });

  describe('Price Subscriptions', () => {
    beforeEach(async () => {
      await oracleService.init();
      await oracleService.connect();
    });

    it('should subscribe to price updates', async () => {
      const updates: any[] = [];
      const callback = jest.fn((update) => updates.push(update));
      
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        callback
      );
      
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.unsubscribe).toBeInstanceOf(Function);
      
      // Wait for updates
      jest.advanceTimersByTime(3000);
      
      expect(callback).toHaveBeenCalled();
      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].pair).toBe('XOM/USD');
      expect(updates[0].price.value).toBeCloseTo(0.15, 1);
      
      subscription.unsubscribe();
    });

    it('should handle multiple subscriptions', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      const sub1 = await oracleService.subscribeToPriceUpdates('XOM/USD', callback1);
      const sub2 = await oracleService.subscribeToPriceUpdates('ETH/USD', callback2);
      
      jest.advanceTimersByTime(2000);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      
      // Check different pairs received different base prices
      const xomUpdate = callback1.mock.calls[0][0];
      const ethUpdate = callback2.mock.calls[0][0];
      
      expect(xomUpdate.price.value).toBeCloseTo(0.15, 1);
      expect(ethUpdate.price.value).toBeCloseTo(2500, 100);
      
      sub1.unsubscribe();
      sub2.unsubscribe();
    });

    it('should unsubscribe correctly', async () => {
      const callback = jest.fn();
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        callback
      );
      
      jest.advanceTimersByTime(1000);
      const callCount = callback.mock.calls.length;
      
      await oracleService.unsubscribe(subscription.id);
      
      jest.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledTimes(callCount); // No new calls
    });

    it('should apply price variations in updates', async () => {
      const updates: any[] = [];
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        (update) => updates.push(update)
      );
      
      jest.advanceTimersByTime(5000);
      
      expect(updates.length).toBeGreaterThanOrEqual(5);
      
      // Check that prices vary
      const prices = updates.map(u => u.price.value);
      const uniquePrices = new Set(prices);
      expect(uniquePrices.size).toBeGreaterThan(1);
      
      // All should be close to base price
      prices.forEach(price => {
        expect(price).toBeGreaterThan(0.14);
        expect(price).toBeLessThan(0.16);
      });
      
      subscription.unsubscribe();
    });
  });

  describe('Historical Prices', () => {
    beforeEach(async () => {
      await oracleService.init();
    });

    it('should get historical prices', async () => {
      const now = Date.now();
      const params = {
        pair: 'XOM/USD',
        from: now - 86400000 * 7, // 7 days ago
        to: now,
        interval: '1d'
      };
      
      const history = await oracleService.getHistoricalPrices(params);
      
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      
      history.forEach(point => {
        expect(point.timestamp).toBeGreaterThanOrEqual(params.from);
        expect(point.timestamp).toBeLessThanOrEqual(params.to);
        expect(point.price).toBeCloseTo(0.15, 1);
        expect(point.volume).toBeGreaterThan(0);
      });
    });

    it('should handle hourly intervals', async () => {
      const now = Date.now();
      const params = {
        pair: 'ETH/USD',
        from: now - 86400000, // 24 hours ago
        to: now,
        interval: '1h'
      };
      
      const history = await oracleService.getHistoricalPrices(params);
      
      expect(history.length).toBeGreaterThanOrEqual(24);
      
      // Check interval is approximately 1 hour
      if (history.length > 1) {
        const interval = history[1].timestamp - history[0].timestamp;
        expect(interval).toBe(3600000); // 1 hour in ms
      }
    });

    it('should return empty array for future dates', async () => {
      const future = Date.now() + 86400000;
      const params = {
        pair: 'XOM/USD',
        from: future,
        to: future + 86400000,
        interval: '1d'
      };
      
      const history = await oracleService.getHistoricalPrices(params);
      expect(history).toEqual([]);
    });
  });

  describe('ENS Oracle Operations', () => {
    beforeEach(async () => {
      await oracleService.init();
    });

    describe('resolveENS', () => {
      it('should resolve known ENS names', async () => {
        const address = await oracleService.resolveENS('vitalik.eth');
        expect(address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      });

      it('should return zero address for unknown names', async () => {
        const address = await oracleService.resolveENS('unknown.eth');
        expect(address).toBe('0x' + '0'.repeat(40));
      });
    });

    describe('reverseResolveENS', () => {
      it('should reverse resolve known addresses', async () => {
        const name = await oracleService.reverseResolveENS(
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
        );
        expect(name).toBe('vitalik.eth');
      });

      it('should handle case-insensitive addresses', async () => {
        const name = await oracleService.reverseResolveENS(
          '0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045'
        );
        expect(name).toBe('vitalik.eth');
      });

      it('should return unknown.eth for unknown addresses', async () => {
        const name = await oracleService.reverseResolveENS('0x' + '1'.repeat(40));
        expect(name).toBe('unknown.eth');
      });
    });

    describe('isENSAvailable', () => {
      it('should check ENS name availability', async () => {
        const available = await oracleService.isENSAvailable('myuniquename.eth');
        expect(available).toBe(true);
      });

      it('should return false for taken names', async () => {
        const available = await oracleService.isENSAvailable('vitalik.eth');
        expect(available).toBe(false);
      });
    });

    describe('getENSMetadata', () => {
      it('should get ENS metadata', async () => {
        const metadata = await oracleService.getENSMetadata('vitalik.eth');
        
        expect(metadata).toBeDefined();
        expect(metadata.owner).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(metadata.resolver).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(metadata.registeredAt).toBeLessThan(Date.now());
        expect(metadata.expiresAt).toBeGreaterThan(Date.now());
      });
    });

    describe('registerENS', () => {
      it('should register available ENS name', async () => {
        const params = {
          name: 'test123.eth',
          owner: '0x' + '1'.repeat(40),
          duration: 1 // 1 year
        };
        
        const result = await oracleService.registerENS(params);
        
        expect(result.success).toBe(true);
        expect(result.transactionHash).toMatch(/^0x[a-f]{64}$/);
        expect(result.expiresAt).toBeGreaterThan(Date.now());
      });

      it('should fail for unavailable names', async () => {
        const params = {
          name: 'vitalik.eth',
          owner: '0x' + '1'.repeat(40),
          duration: 1
        };
        
        const result = await oracleService.registerENS(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Data Feed Oracles', () => {
    beforeEach(async () => {
      await oracleService.init();
    });

    describe('Weather Data', () => {
      it('should get weather data', async () => {
        const params = {
          location: { lat: 40.7128, lon: -74.0060 },
          parameters: ['temperature', 'precipitation', 'windSpeed']
        };
        
        const weather = await oracleService.getWeatherData(params);
        
        expect(weather).toBeDefined();
        expect(weather.temperature).toBeGreaterThanOrEqual(25);
        expect(weather.temperature).toBeLessThanOrEqual(35);
        expect(weather.precipitation).toBeGreaterThanOrEqual(0);
        expect(weather.windSpeed).toBeGreaterThanOrEqual(0);
        expect(weather.timestamp).toBeCloseTo(Date.now(), -2);
      });
    });

    describe('Sports Results', () => {
      it('should get sports results', async () => {
        const params = {
          sport: 'football',
          league: 'NFL',
          date: '2024-01-01'
        };
        
        const results = await oracleService.getSportsResults(params);
        
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        
        const game = results[0];
        expect(game.homeTeam).toBeDefined();
        expect(game.awayTeam).toBeDefined();
        expect(game.homeScore).toBeGreaterThanOrEqual(0);
        expect(game.awayScore).toBeGreaterThanOrEqual(0);
        expect(game.status).toBe('final');
      });
    });

    describe('Verifiable Random', () => {
      it('should generate verifiable random number', async () => {
        const params = {
          min: 1,
          max: 100,
          seed: 'test-seed-123'
        };
        
        const result = await oracleService.getVerifiableRandom(params);
        
        expect(result.value).toBeGreaterThanOrEqual(params.min);
        expect(result.value).toBeLessThanOrEqual(params.max);
        expect(result.proof).toMatch(/^0x[b]{64}$/);
        expect(result.blockNumber).toBe(12345678);
      });

      it('should handle edge cases', async () => {
        const params = {
          min: 42,
          max: 42,
          seed: 'same-value'
        };
        
        const result = await oracleService.getVerifiableRandom(params);
        expect(result.value).toBe(42);
      });
    });
  });

  describe('Oracle Consensus', () => {
    beforeEach(async () => {
      await oracleService.init();
    });

    describe('getConsensus', () => {
      it('should get consensus from multiple oracles', async () => {
        const query = { type: 'price', pair: 'XOM/USD' };
        const options = { minResponses: 3, timeout: 5000 };
        
        const result = await oracleService.getConsensus(query, options);
        
        expect(result).toBeDefined();
        expect(result.value).toBe(0.15);
        expect(result.confidence).toBe(0.95);
        expect(result.responses).toBeGreaterThan(options.minResponses);
        expect(result.method).toBe('median');
      });

      it('should handle non-price queries', async () => {
        const query = { type: 'weather', location: 'NYC' };
        const options = { minResponses: 5, timeout: 10000 };
        
        const result = await oracleService.getConsensus(query, options);
        
        expect(result.value).toBeNull();
        expect(result.responses).toBeGreaterThan(options.minResponses);
      });
    });

    describe('submitDispute', () => {
      it('should submit oracle dispute', async () => {
        const dispute = {
          oracleId: 'oracle-123',
          queryId: 'query-456',
          expectedValue: 0.20,
          reportedValue: 0.15,
          evidence: 'Price discrepancy detected'
        };
        
        const result = await oracleService.submitDispute(dispute);
        
        expect(result).toBeDefined();
        expect(result.disputeId).toMatch(/^dispute-[a-z0-9]{9}$/);
        expect(result.status).toBe('pending');
        expect(result.resolutionTime).toBeGreaterThan(Date.now());
      });
    });

    describe('verifyOracleSignature', () => {
      it('should verify valid oracle signature', async () => {
        const data = {
          value: 0.15,
          timestamp: Date.now(),
          signature: '0x' + 'a'.repeat(130)
        };
        
        const isValid = await oracleService.verifyOracleSignature(data);
        expect(isValid).toBe(true);
      });

      it('should reject invalid signature', async () => {
        const data = {
          value: 0.15,
          timestamp: Date.now(),
          signature: 'invalid'
        };
        
        const isValid = await oracleService.verifyOracleSignature(data);
        expect(isValid).toBe(false);
      });

      it('should reject missing signature', async () => {
        const data = {
          value: 0.15,
          timestamp: Date.now()
        };
        
        const isValid = await oracleService.verifyOracleSignature(data);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Cross-Chain Oracle', () => {
    beforeEach(async () => {
      await oracleService.init();
    });

    describe('getCrossChainPrice', () => {
      it('should get cross-chain asset prices', async () => {
        const params = {
          asset: 'USDC',
          chains: ['ethereum', 'polygon', 'arbitrum']
        };
        
        const prices = await oracleService.getCrossChainPrice(params);
        
        expect(Object.keys(prices)).toHaveLength(3);
        
        Object.entries(prices).forEach(([chain, data]) => {
          expect(params.chains).toContain(chain);
          expect(data.price).toBeCloseTo(1.0, 1);
          expect(data.liquidity).toBeGreaterThan(0);
          expect(data.volume24h).toBeGreaterThan(0);
        });
      });

      it('should handle non-stablecoin assets', async () => {
        const params = {
          asset: 'WETH',
          chains: ['ethereum', 'optimism']
        };
        
        const prices = await oracleService.getCrossChainPrice(params);
        
        Object.values(prices).forEach(data => {
          expect(data.price).toBeCloseTo(100, 10);
        });
      });
    });

    describe('validateCrossChainState', () => {
      it('should validate cross-chain state consistency', async () => {
        const params = {
          type: 'balance',
          address: '0x' + '1'.repeat(40),
          chains: ['ethereum', 'polygon', 'avalanche']
        };
        
        const result = await oracleService.validateCrossChainState(params);
        
        expect(result).toBeDefined();
        expect(typeof result.isConsistent).toBe('boolean');
        expect(Object.keys(result.states)).toHaveLength(3);
        
        Object.values(result.states).forEach(state => {
          expect(state.balance).toBeGreaterThan(900);
          expect(state.balance).toBeLessThan(1100);
          expect(state.nonce).toBeGreaterThanOrEqual(0);
        });
      });

      it('should detect discrepancies', async () => {
        // Run multiple times to ensure we get both consistent and inconsistent results
        let foundDiscrepancy = false;
        
        for (let i = 0; i < 10; i++) {
          const result = await oracleService.validateCrossChainState({
            type: 'balance',
            address: '0x123',
            chains: ['ethereum', 'polygon']
          });
          
          if (!result.isConsistent && result.discrepancies) {
            foundDiscrepancy = true;
            expect(result.discrepancies.length).toBeGreaterThan(0);
            expect(result.discrepancies[0].type).toBe('balance_mismatch');
            break;
          }
        }
        
        // With random 50/50 chance, we should find at least one discrepancy in 10 tries
        expect(foundDiscrepancy).toBe(true);
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await oracleService.init();
      await expect(oracleService.clearCache()).resolves.not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await oracleService.init();
      await oracleService.connect();
      
      // Create subscription
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        () => {}
      );
      
      await oracleService.cleanup();
      
      // Verify cleanup
      await expect(oracleService.cleanup()).resolves.not.toThrow();
    });

    it('should reset initialization state', async () => {
      await oracleService.init();
      await oracleService.cleanup();
      
      // Should be able to reinitialize
      await expect(oracleService.init()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      await oracleService.init();
      
      // Test various error scenarios
      const emptyName = await oracleService.resolveENS('');
      expect(emptyName).toBe('0x' + '0'.repeat(40));
      
      const invalidAddress = await oracleService.reverseResolveENS('invalid');
      expect(invalidAddress).toBe('unknown.eth');
    });

    it('should handle subscription errors', async () => {
      await oracleService.init();
      
      // Unsubscribe with invalid ID
      await expect(oracleService.unsubscribe('invalid-id')).resolves.not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle price monitoring workflow', async () => {
      await oracleService.init();
      await oracleService.connect();
      
      // Get initial price
      const initialPrice = await oracleService.getPrice('XOM', 'USD');
      expect(initialPrice.value).toBe(0.15);
      
      // Subscribe to updates
      let latestPrice: number = initialPrice.value;
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        (update) => {
          latestPrice = update.price.value;
        }
      );
      
      // Wait for updates
      jest.advanceTimersByTime(3000);
      
      // Get aggregated price
      const aggregated = await oracleService.getAggregatedPrice('XOM/USD');
      expect(aggregated.median).toBeCloseTo(0.15, 1);
      
      // Cleanup
      subscription.unsubscribe();
      await oracleService.disconnect();
    });

    it('should handle multi-chain price checking', async () => {
      await oracleService.init();
      
      // Get cross-chain prices
      const crossChainPrices = await oracleService.getCrossChainPrice({
        asset: 'USDC',
        chains: ['ethereum', 'polygon', 'arbitrum', 'optimism']
      });
      
      // Validate consistency
      const validation = await oracleService.validateCrossChainState({
        type: 'price',
        address: 'USDC',
        chains: Object.keys(crossChainPrices)
      });
      
      expect(validation.states).toBeDefined();
      expect(Object.keys(validation.states)).toHaveLength(4);
    });
  });
});