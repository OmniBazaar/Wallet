/**
 * OracleNodeService Test Suite
 * 
 * Tests oracle node functionality with real data feeds and validator consensus.
 * Validates price feeds, validator reputation, and oracle aggregation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ethers } from 'ethers';
import { OracleNodeService, type PriceFeed, type ValidatorInfo } from '../../../src/services/OracleNodeService';
import { 
  mockWallet, 
  createMockProvider, 
  createMockContract, 
  ORACLE_TEST_DATA,
  TEST_ADDRESSES,
  cleanupTest 
} from '../../setup';

describe('OracleNodeService', () => {
  let service: OracleNodeService;
  let mockProvider: any;
  let mockOracleContract: any;
  let mockAggregatorContract: any;
  let mockValidatorRegistry: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
    
    // Mock oracle contract with bracket notation access
    mockOracleContract = createMockContract('0xOracleContract', {
      'submitPrice': jest.fn().mockResolvedValue({
        hash: '0xsubmitpricetx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'getLatestPrice': jest.fn().mockResolvedValue([
        ORACLE_TEST_DATA.priceFeeds['XOM/USD'].price,
        ORACLE_TEST_DATA.priceFeeds['XOM/USD'].timestamp,
        95 // confidence
      ]),
      'getValidatorSubmission': jest.fn().mockResolvedValue([
        ORACLE_TEST_DATA.priceFeeds['XOM/USD'].price,
        ORACLE_TEST_DATA.priceFeeds['XOM/USD'].timestamp,
        true // isValid
      ]),
      'aggregatePrice': jest.fn().mockResolvedValue({
        hash: '0xaggregatetx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'getTotalValidators': jest.fn().mockResolvedValue(50),
      'getActiveValidators': jest.fn().mockResolvedValue(48)
    });

    // Mock price aggregator contract
    mockAggregatorContract = createMockContract('0xAggregatorContract', {
      'latestRoundData': jest.fn().mockResolvedValue([
        ethers.toBigInt(1), // roundId
        ORACLE_TEST_DATA.priceFeeds['XOM/USD'].price,
        ethers.toBigInt(ORACLE_TEST_DATA.priceFeeds['XOM/USD'].timestamp - 100),
        ethers.toBigInt(ORACLE_TEST_DATA.priceFeeds['XOM/USD'].timestamp),
        ethers.toBigInt(1) // answeredInRound
      ]),
      'decimals': jest.fn().mockResolvedValue(8),
      'description': jest.fn().mockResolvedValue('XOM / USD')
    });

    // Mock validator registry
    mockValidatorRegistry = createMockContract('0xValidatorRegistry', {
      'getValidator': jest.fn().mockResolvedValue([
        TEST_ADDRESSES.ethereum, // address
        ethers.parseEther('1000'), // stake
        95, // reputation
        true, // isActive
        Math.floor(Date.now() / 1000) // lastSubmission
      ]),
      'registerValidator': jest.fn().mockResolvedValue({
        hash: '0xregistertx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'slashValidator': jest.fn().mockResolvedValue({
        hash: '0xslashtx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'updateReputation': jest.fn().mockResolvedValue({
        hash: '0xupdatereputationtx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      })
    });

    service = new OracleNodeService(mockProvider, {
      oracleContract: mockOracleContract.address,
      aggregatorContract: mockAggregatorContract.address,
      validatorRegistry: mockValidatorRegistry.address,
      priceFeeds: ['XOM/USD', 'ETH/USD', 'BTC/USD'],
      updateInterval: 300, // 5 minutes
      consensusThreshold: 0.67, // 67%
      maxDeviation: 0.05 // 5%
    });
  });

  afterAll(() => {
    cleanupTest();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with oracle configuration', () => {
      expect(service).toBeDefined();
      expect(service.getConfiguration()).toMatchObject({
        oracleContract: mockOracleContract.address,
        priceFeeds: ['XOM/USD', 'ETH/USD', 'BTC/USD'],
        consensusThreshold: 0.67
      });
    });

    it('should validate contract addresses', () => {
      expect(() => {
        new OracleNodeService(mockProvider, {
          oracleContract: 'invalid-address'
        });
      }).toThrow('Invalid oracle contract address');
    });

    it('should support multiple price feed pairs', () => {
      const supportedPairs = service.getSupportedPricePairs();
      
      expect(supportedPairs).toContain('XOM/USD');
      expect(supportedPairs).toContain('ETH/USD');
      expect(supportedPairs).toContain('BTC/USD');
    });
  });

  describe('Price Feed Management', () => {
    it('should fetch latest price from contract', async () => {
      const price = await service.getLatestPrice('XOM/USD');

      expect(price).toMatchObject({
        pair: 'XOM/USD',
        price: ORACLE_TEST_DATA.priceFeeds['XOM/USD'].price.toString(),
        timestamp: expect.any(Number),
        confidence: 95
      });

      expect(mockOracleContract['getLatestPrice']).toHaveBeenCalledWith(
        ethers.encodeBytes32String('XOM/USD')
      );
    });

    it('should submit price data as validator', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.submitPrice({
        pair: 'XOM/USD',
        price: ethers.parseUnits('1.25', 8),
        timestamp: Math.floor(Date.now() / 1000),
        signature: '0xvalidatorsignature',
        signer
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(mockOracleContract['submitPrice']).toHaveBeenCalled();
    });

    it('should validate price data before submission', async () => {
      const validation = await service.validatePriceData({
        pair: 'XOM/USD',
        price: ethers.parseUnits('1.25', 8),
        timestamp: Math.floor(Date.now() / 1000),
        source: 'binance'
      });

      expect(validation.isValid).toBe(true);
      expect(validation.confidence).toBeGreaterThan(90);
      expect(validation.warnings).toBeInstanceOf(Array);
    });

    it('should reject stale price data', async () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      await expect(service.validatePriceData({
        pair: 'XOM/USD',
        price: ethers.parseUnits('1.25', 8),
        timestamp: staleTimestamp,
        source: 'binance'
      })).rejects.toThrow('Price data too old');
    });

    it('should detect price manipulation attempts', async () => {
      const suspiciousPrice = ethers.parseUnits('100', 8); // 100x normal price

      const validation = await service.validatePriceData({
        pair: 'XOM/USD',
        price: suspiciousPrice,
        timestamp: Math.floor(Date.now() / 1000),
        source: 'unknown'
      });

      expect(validation.isValid).toBe(false);
      expect(validation.warnings).toContain('Price deviation too high');
    });
  });

  describe('Validator Operations with Contract Integration', () => {
    it('should register as oracle validator', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.registerValidator({
        stakeAmount: ethers.parseEther('1000'),
        metadata: {
          name: 'Test Oracle Validator',
          endpoint: 'https://oracle.example.com',
          priceFeeds: ['XOM/USD', 'ETH/USD']
        },
        signer
      });

      expect(result.success).toBe(true);
      expect(result.validatorId).toBeDefined();
      expect(mockValidatorRegistry['registerValidator']).toHaveBeenCalled();
    });

    it('should get validator information using bracket notation', async () => {
      const validator = await service.getValidatorInfo(TEST_ADDRESSES.ethereum);

      expect(validator).toMatchObject({
        address: TEST_ADDRESSES.ethereum,
        stake: expect.any(String),
        reputation: 95,
        isActive: true,
        lastSubmission: expect.any(Number)
      });

      expect(mockValidatorRegistry['getValidator']).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum
      );
    });

    it('should update validator reputation based on accuracy', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.updateValidatorReputation({
        validatorAddress: TEST_ADDRESSES.ethereum,
        accuracyScore: 98.5,
        submissionCount: 1000,
        signer
      });

      expect(result.success).toBe(true);
      expect(result.newReputation).toBeGreaterThan(95);
      expect(mockValidatorRegistry['updateReputation']).toHaveBeenCalled();
    });

    it('should slash misbehaving validators', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.slashValidator({
        validatorAddress: '0xBadValidator',
        reason: 'false_price_submission',
        evidence: '0xevidence',
        slashAmount: ethers.parseEther('100'),
        signer
      });

      expect(result.success).toBe(true);
      expect(result.slashedAmount).toBe(ethers.parseEther('100').toString());
      expect(mockValidatorRegistry['slashValidator']).toHaveBeenCalled();
    });

    it('should calculate validator rewards', async () => {
      const rewards = await service.calculateValidatorRewards({
        validatorAddress: TEST_ADDRESSES.ethereum,
        submissionCount: 1000,
        accuracyScore: 98.5,
        stakingAmount: ethers.parseEther('1000'),
        rewardPool: ethers.parseEther('10000')
      });

      expect(rewards.baseReward).toBeDefined();
      expect(rewards.accuracyBonus).toBeDefined();
      expect(rewards.stakingBonus).toBeDefined();
      expect(rewards.totalReward).toBeDefined();
    });
  });

  describe('Price Aggregation and Consensus', () => {
    it('should aggregate prices from multiple validators', async () => {
      const validatorSubmissions = [
        { validator: '0xValidator1', price: ethers.parseUnits('1.24', 8), weight: 100 },
        { validator: '0xValidator2', price: ethers.parseUnits('1.25', 8), weight: 95 },
        { validator: '0xValidator3', price: ethers.parseUnits('1.26', 8), weight: 88 }
      ];

      const aggregated = await service.aggregatePrices({
        pair: 'XOM/USD',
        submissions: validatorSubmissions,
        method: 'weighted_median'
      });

      expect(aggregated.price).toBeDefined();
      expect(aggregated.confidence).toBeGreaterThan(90);
      expect(aggregated.participatingValidators).toBe(3);
    });

    it('should reach consensus on price feeds', async () => {
      const consensus = await service.checkConsensus({
        pair: 'XOM/USD',
        submissions: ORACLE_TEST_DATA.validators.map(v => ({
          validator: v.address,
          price: ORACLE_TEST_DATA.priceFeeds['XOM/USD'].price,
          timestamp: ORACLE_TEST_DATA.priceFeeds['XOM/USD'].timestamp
        }))
      });

      expect(consensus.hasConsensus).toBe(true);
      expect(consensus.consensusPrice).toBeDefined();
      expect(consensus.participationRate).toBeGreaterThan(0.67);
    });

    it('should handle consensus failures', async () => {
      const divergentSubmissions = [
        { validator: '0xValidator1', price: ethers.parseUnits('1.00', 8), weight: 100 },
        { validator: '0xValidator2', price: ethers.parseUnits('2.00', 8), weight: 95 },
        { validator: '0xValidator3', price: ethers.parseUnits('3.00', 8), weight: 88 }
      ];

      const consensus = await service.checkConsensus({
        pair: 'XOM/USD',
        submissions: divergentSubmissions
      });

      expect(consensus.hasConsensus).toBe(false);
      expect(consensus.deviation).toBeGreaterThan(0.05);
      expect(consensus.requiresInvestigation).toBe(true);
    });

    it('should filter outliers from price submissions', () => {
      const submissions = [
        ethers.parseUnits('1.24', 8),
        ethers.parseUnits('1.25', 8),
        ethers.parseUnits('1.26', 8),
        ethers.parseUnits('10.00', 8) // Outlier
      ];

      const filtered = service.filterOutliers(submissions, 2.0); // 2 standard deviations

      expect(filtered).toHaveLength(3);
      expect(filtered).not.toContain(ethers.parseUnits('10.00', 8));
    });
  });

  describe('External Data Source Integration', () => {
    it('should fetch prices from external APIs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          symbol: 'XOMUSD',
          price: '1.25',
          timestamp: Date.now()
        })
      });

      const price = await service.fetchExternalPrice({
        pair: 'XOM/USD',
        source: 'coinbase',
        apiKey: 'test-key'
      });

      expect(price.price).toBe(ethers.parseUnits('1.25', 8));
      expect(price.source).toBe('coinbase');
      expect(price.timestamp).toBeDefined();
    });

    it('should handle external API failures', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API unavailable'));

      await expect(service.fetchExternalPrice({
        pair: 'XOM/USD',
        source: 'unreliable-api'
      })).rejects.toThrow('API unavailable');
    });

    it('should aggregate multiple external sources', async () => {
      const sources = ['binance', 'coinbase', 'kraken'];
      
      const aggregated = await service.aggregateExternalPrices({
        pair: 'XOM/USD',
        sources,
        method: 'median'
      });

      expect(aggregated.price).toBeDefined();
      expect(aggregated.sources).toHaveLength(3);
      expect(aggregated.confidence).toBeGreaterThan(0);
    });

    it('should validate external data consistency', async () => {
      const externalPrices = [
        { source: 'binance', price: ethers.parseUnits('1.24', 8) },
        { source: 'coinbase', price: ethers.parseUnits('1.25', 8) },
        { source: 'kraken', price: ethers.parseUnits('1.26', 8) }
      ];

      const validation = service.validateExternalDataConsistency(externalPrices);

      expect(validation.isConsistent).toBe(true);
      expect(validation.maxDeviation).toBeLessThan(0.02);
      expect(validation.medianPrice).toBeDefined();
    });
  });

  describe('Oracle Network Health and Monitoring', () => {
    it('should monitor oracle network health', async () => {
      const health = await service.getNetworkHealth();

      expect(health).toMatchObject({
        totalValidators: expect.any(Number),
        activeValidators: expect.any(Number),
        lastUpdate: expect.any(Number),
        averageReputation: expect.any(Number),
        consensusRate: expect.any(Number)
      });

      expect(mockOracleContract['getTotalValidators']).toHaveBeenCalled();
      expect(mockOracleContract['getActiveValidators']).toHaveBeenCalled();
    });

    it('should detect network degradation', async () => {
      mockOracleContract['getActiveValidators'].mockResolvedValueOnce(20); // Low participation

      const health = await service.getNetworkHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.warnings).toContain('Low validator participation');
    });

    it('should generate oracle performance reports', async () => {
      const report = await service.generatePerformanceReport({
        validatorAddress: TEST_ADDRESSES.ethereum,
        period: 7 * 24 * 60 * 60 // 7 days
      });

      expect(report).toMatchObject({
        validator: TEST_ADDRESSES.ethereum,
        submissions: expect.any(Number),
        accuracy: expect.any(Number),
        uptime: expect.any(Number),
        rewards: expect.any(String),
        ranking: expect.any(Number)
      });
    });

    it('should alert on anomalous behavior', async () => {
      const alerts = await service.detectAnomalies({
        priceDeviation: 0.1, // 10%
        submissionGaps: 3600, // 1 hour
        consensusFailures: 5
      });

      expect(alerts).toBeInstanceOf(Array);
      alerts.forEach(alert => {
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('description');
        expect(alert).toHaveProperty('timestamp');
      });
    });
  });

  describe('Price History and Analytics', () => {
    it('should store price history on-chain', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.storePriceHistory({
        pair: 'XOM/USD',
        prices: [
          { price: ethers.parseUnits('1.24', 8), timestamp: Date.now() - 3600 },
          { price: ethers.parseUnits('1.25', 8), timestamp: Date.now() - 1800 },
          { price: ethers.parseUnits('1.26', 8), timestamp: Date.now() }
        ],
        signer
      });

      expect(result.success).toBe(true);
      expect(result.storedEntries).toBe(3);
    });

    it('should calculate price volatility', async () => {
      const volatility = await service.calculateVolatility({
        pair: 'XOM/USD',
        period: 24 * 60 * 60, // 24 hours
        windowSize: 3600 // 1 hour windows
      });

      expect(volatility.annualizedVolatility).toBeGreaterThan(0);
      expect(volatility.averageDeviation).toBeDefined();
      expect(volatility.maxDrawdown).toBeDefined();
    });

    it('should get historical price data', async () => {
      const history = await service.getPriceHistory({
        pair: 'XOM/USD',
        fromTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        toTimestamp: Date.now(),
        interval: 3600 // 1 hour
      });

      expect(history).toBeInstanceOf(Array);
      history.forEach(entry => {
        expect(entry).toHaveProperty('price');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('confidence');
      });
    });

    it('should calculate technical indicators', () => {
      const prices = [
        ethers.parseUnits('1.20', 8),
        ethers.parseUnits('1.22', 8),
        ethers.parseUnits('1.24', 8),
        ethers.parseUnits('1.26', 8),
        ethers.parseUnits('1.25', 8)
      ];

      const indicators = service.calculateTechnicalIndicators({
        prices,
        indicators: ['sma', 'rsi', 'bollinger_bands']
      });

      expect(indicators.sma).toBeDefined();
      expect(indicators.rsi).toBeDefined();
      expect(indicators.bollinger_bands).toMatchObject({
        upper: expect.any(BigInt),
        middle: expect.any(BigInt),
        lower: expect.any(BigInt)
      });
    });
  });

  describe('Gas Optimization and Batch Operations', () => {
    it('should estimate gas for price submissions', async () => {
      mockOracleContract.estimateGas = {
        submitPrice: jest.fn().mockResolvedValue(85000n)
      };

      const gasEstimate = await service.estimateSubmissionGas({
        pair: 'XOM/USD',
        price: ethers.parseUnits('1.25', 8),
        fromAddress: TEST_ADDRESSES.ethereum
      });

      expect(gasEstimate).toBe(85000n);
      expect(typeof gasEstimate).toBe('bigint');
    });

    it('should batch multiple price submissions', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.batchSubmitPrices({
        submissions: [
          { pair: 'XOM/USD', price: ethers.parseUnits('1.25', 8) },
          { pair: 'ETH/USD', price: ethers.parseUnits('2500', 8) },
          { pair: 'BTC/USD', price: ethers.parseUnits('45000', 8) }
        ],
        signer
      });

      expect(result.success).toBe(true);
      expect(result.submittedCount).toBe(3);
      expect(result.gasUsed).toBeDefined();
    });

    it('should optimize gas with dynamic pricing', async () => {
      const optimization = await service.getGasOptimization({
        urgency: 'normal',
        maxGasPrice: ethers.parseUnits('50', 'gwei')
      });

      expect(optimization.maxFeePerGas).toBeDefined();
      expect(optimization.maxPriorityFeePerGas).toBeDefined();
      expect(optimization.estimatedConfirmationTime).toBeDefined();
    });
  });

  describe('Security and Attack Prevention', () => {
    it('should detect flash loan price manipulation', async () => {
      const detection = await service.detectFlashLoanAttack({
        pair: 'XOM/USD',
        priceChange: 0.3, // 30% change
        timeWindow: 60, // 1 minute
        blockNumber: 18500000
      });

      expect(detection.isFlashLoanAttack).toBeDefined();
      expect(detection.confidence).toBeDefined();
      expect(detection.evidence).toBeInstanceOf(Array);
    });

    it('should validate oracle signatures', async () => {
      const validation = await service.validateOracleSignature({
        message: ethers.solidityPackedKeccak256(
          ['string', 'uint256', 'uint256'],
          ['XOM/USD', ethers.parseUnits('1.25', 8), Date.now()]
        ),
        signature: '0xvalidatorsignature',
        validatorAddress: TEST_ADDRESSES.ethereum
      });

      expect(validation.isValid).toBeDefined();
      expect(validation.recoveredAddress).toBe(TEST_ADDRESSES.ethereum);
    });

    it('should implement circuit breakers', async () => {
      const circuitBreaker = await service.checkCircuitBreaker({
        pair: 'XOM/USD',
        priceChange: 0.5, // 50% change
        threshold: 0.2 // 20% threshold
      });

      expect(circuitBreaker.shouldTrigger).toBe(true);
      expect(circuitBreaker.action).toBe('pause_updates');
      expect(circuitBreaker.cooldownPeriod).toBeDefined();
    });

    it('should rate limit validator submissions', async () => {
      const rateLimitCheck = service.checkRateLimit({
        validatorAddress: TEST_ADDRESSES.ethereum,
        submissionCount: 10,
        timeWindow: 3600, // 1 hour
        maxSubmissions: 5
      });

      expect(rateLimitCheck.isLimited).toBe(true);
      expect(rateLimitCheck.cooldownRemaining).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle contract call failures', async () => {
      mockOracleContract['getLatestPrice'].mockRejectedValueOnce(new Error('Contract reverted'));

      await expect(service.getLatestPrice('XOM/USD')).rejects.toThrow('Contract reverted');
    });

    it('should fallback to backup oracles', async () => {
      service.addBackupOracle({
        address: '0xBackupOracle',
        priority: 2,
        priceFeeds: ['XOM/USD']
      });

      mockOracleContract['getLatestPrice'].mockRejectedValueOnce(new Error('Primary oracle down'));

      const price = await service.getLatestPriceWithFallback('XOM/USD');
      expect(price.source).toBe('backup');
    });

    it('should handle network partitions', async () => {
      const partition = await service.detectNetworkPartition({
        expectedValidators: 50,
        activeValidators: 25,
        consensusThreshold: 0.67
      });

      expect(partition.isPartitioned).toBe(true);
      expect(partition.recommendation).toBe('wait_for_recovery');
    });

    it('should recover from data corruption', async () => {
      const recovery = await service.recoverFromCorruption({
        corruptedData: '0xcorruptedprice',
        validationMethod: 'checksum',
        backupSources: ['chainlink', 'band_protocol']
      });

      expect(recovery.wasRecovered).toBeDefined();
      expect(recovery.recoveredPrice).toBeDefined();
      expect(recovery.confidenceLevel).toBeDefined();
    });
  });

  describe('TypeScript Strict Mode and Ethers v6 Compatibility', () => {
    it('should handle parseUnits correctly', () => {
      const price = ethers.parseUnits('1.25', 8);
      
      expect(typeof price).toBe('bigint');
      expect(price).toBe(125000000n);
    });

    it('should use contract bracket notation for method calls', async () => {
      const result = await mockOracleContract['getLatestPrice'](
        ethers.encodeBytes32String('XOM/USD')
      );
      
      expect(mockOracleContract['getLatestPrice']).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle undefined values properly', async () => {
      mockOracleContract['getLatestPrice'].mockResolvedValueOnce([null, 0, 0]);

      const price = await service.getLatestPrice('INVALID/USD');
      expect(price).toBeNull();
    });

    it('should validate input parameters strictly', async () => {
      await expect(service.submitPrice({
        pair: '',
        price: 0n,
        timestamp: 0,
        signature: '',
        signer: null as any
      })).rejects.toThrow();
    });

    it('should use native bigint operations', () => {
      const price1 = ethers.parseUnits('1.25', 8);
      const price2 = ethers.parseUnits('1.30', 8);
      
      const average = (price1 + price2) / 2n;
      
      expect(typeof average).toBe('bigint');
      expect(average).toBe(127500000n);
    });
  });
});