/**
 * Validator/Oracle Integration Tests
 * Tests wallet integration with validator nodes and oracle services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { ValidatorService } from '../../src/services/ValidatorService';
import { OracleService } from '../../src/services/OracleService';
import { KYCService } from '../../src/services/KYCService';
import { ReputationService } from '../../src/services/ReputationService';
import { mockWallet, createMockProvider } from '../setup';
import { ethers } from 'ethers';

describe('Validator/Oracle Integration', () => {
  let walletService: WalletService;
  let validatorService: ValidatorService;
  let oracleService: OracleService;
  let kycService: KYCService;
  let reputationService: ReputationService;
  let mockProvider: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');

    walletService = new WalletService(mockProvider);
    await walletService.init();

    // Create real service instances
    validatorService = new ValidatorService();
    oracleService = new OracleService();

    // KYCService requires a provider parameter
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    kycService = new KYCService(provider);

    reputationService = new ReputationService();

    // Initialize services
    await validatorService.init();
    await oracleService.connect();
    await kycService.initialize(); // KYCService uses initialize() instead of init()
    await reputationService.init();
  });

  afterAll(async () => {
    await validatorService.cleanup();
    await oracleService.disconnect();
    // KYCService doesn't have a cleanup method
    await reputationService.cleanup();
    await walletService.cleanup();
  });

  beforeEach(async () => {
    await validatorService.clearCache();
  });

  describe('Validator Node Operations', () => {
    it('should register as validator', async () => {
      const registration = await validatorService.registerValidator({
        address: mockWallet.address,
        stake: '10000', // 10,000 XOM
        nodeUrl: 'https://validator.example.com',
        publicKey: 'validator_public_key'
      });

      expect(registration.success).toBe(true);
      expect(registration.validatorId).toBeDefined();
      expect(registration.status).toBe('active');
      expect(registration.stakeAmount).toBe('10000');
    });

    it('should get validator status', async () => {
      const status = await validatorService.getValidatorStatus(mockWallet.address);
      
      expect(status).toBeDefined();
      expect(status.isActive).toBeDefined();
      expect(status.uptime).toBeDefined();
      expect(status.blocksValidated).toBeDefined();
      expect(status.rewards).toBeDefined();
      expect(status.slashingHistory).toBeDefined();
    });

    it('should delegate to validator', async () => {
      const validatorAddress = '0xvalidator...';
      const delegation = await validatorService.delegate({
        validatorAddress,
        amount: '1000', // 1,000 XOM
        from: mockWallet.address
      });

      expect(delegation.success).toBe(true);
      expect(delegation.delegationId).toBeDefined();
      expect(delegation.expectedRewards).toBeDefined();
    });

    it('should get delegation info', async () => {
      const delegations = await validatorService.getDelegations(mockWallet.address);
      
      expect(Array.isArray(delegations)).toBe(true);
      delegations.forEach(delegation => {
        expect(delegation).toHaveProperty('validatorAddress');
        expect(delegation).toHaveProperty('amount');
        expect(delegation).toHaveProperty('rewards');
        expect(delegation).toHaveProperty('startTime');
      });
    });

    it('should claim validator rewards', async () => {
      const rewards = await validatorService.claimRewards(mockWallet.address);
      
      expect(rewards.success).toBe(true);
      expect(rewards.amount).toBeDefined();
      expect(rewards.transactionHash).toBeDefined();
    });

    it('should withdraw delegation', async () => {
      const withdrawal = await validatorService.withdrawDelegation({
        delegationId: 'delegation-123',
        address: mockWallet.address
      });

      expect(withdrawal.success).toBe(true);
      expect(withdrawal.principal).toBeDefined();
      expect(withdrawal.rewards).toBeDefined();
      expect(withdrawal.total).toBeDefined();
    });

    it('should get validator performance metrics', async () => {
      const metrics = await validatorService.getPerformanceMetrics(mockWallet.address);
      
      expect(metrics).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeLessThanOrEqual(100);
      expect(metrics.blockProposalRate).toBeDefined();
      expect(metrics.attestationRate).toBeDefined();
      expect(metrics.slashingEvents).toBeDefined();
    });

    it('should monitor validator health', async () => {
      const health = await validatorService.getHealthStatus(mockWallet.address);

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.lastHeartbeat).toBeDefined();
      expect(health.syncStatus).toBeDefined();
    }, 10000); // Increased timeout for validator connection
  });

  describe('Oracle Price Feeds', () => {
    it('should get XOM price', async () => {
      const price = await oracleService.getPrice('XOM', 'USD');
      
      expect(price).toBeDefined();
      expect(price.value).toBeGreaterThan(0);
      expect(price.timestamp).toBeDefined();
      expect(price.confidence).toBeDefined();
    });

    it('should get multiple price feeds', async () => {
      const pairs = [
        { base: 'XOM', quote: 'USD' },
        { base: 'ETH', quote: 'USD' },
        { base: 'BTC', quote: 'USD' }
      ];

      const prices = await oracleService.getBatchPrices(pairs);
      
      expect(prices).toBeDefined();
      expect(Object.keys(prices)).toHaveLength(3);
      
      Object.values(prices).forEach(price => {
        expect(price.value).toBeGreaterThan(0);
        expect(price.timestamp).toBeDefined();
      });
    });

    it('should subscribe to price updates', async () => {
      const callback = jest.fn();
      
      const subscription = await oracleService.subscribeToPriceUpdates(
        'XOM/USD',
        callback
      );

      expect(subscription.id).toBeDefined();
      
      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(callback).toHaveBeenCalled();
      const priceUpdate = callback.mock.calls[0][0];
      expect(priceUpdate.pair).toBe('XOM/USD');
      expect(priceUpdate.price).toBeDefined();
      
      await oracleService.unsubscribe(subscription.id);
    });

    it('should get historical prices', async () => {
      const history = await oracleService.getHistoricalPrices({
        pair: 'XOM/USD',
        from: Date.now() - 86400000 * 7, // 7 days ago
        to: Date.now(),
        interval: '1h'
      });

      expect(Array.isArray(history)).toBe(true);
      history.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('price');
        expect(point).toHaveProperty('volume');
      });
    });

    it('should aggregate prices from multiple sources', async () => {
      const aggregated = await oracleService.getAggregatedPrice('XOM/USD');
      
      expect(aggregated).toBeDefined();
      expect(aggregated.median).toBeDefined();
      expect(aggregated.mean).toBeDefined();
      expect(aggregated.sources).toBeGreaterThan(0);
      expect(aggregated.confidence).toBeGreaterThanOrEqual(0);
      expect(aggregated.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('KYC Oracle Integration', () => {
    it('should initiate KYC verification', async () => {
      // Use the actual KYCService interface
      const kycRequest = await kycService.startVerification(
        mockWallet.address,
        1, // KYCTier.TIER_1 for basic
        {
          email: 'test@example.com',
          phone: '+1234567890'
        }
      );

      expect(kycRequest.success).toBeDefined();
      if (kycRequest.success) {
        expect(kycRequest.verificationUrl).toBeDefined();
      } else {
        expect(kycRequest.error).toBeDefined();
      }
    });

    it('should check KYC status', async () => {
      const status = await kycService.getUserKYCStatus(mockWallet.address);
      
      expect(status).toBeDefined();
      expect(status.address).toBe(mockWallet.address);
      expect(status.currentTier).toBeDefined();
      expect(status.status).toBeDefined();
    });

    it('should get KYC requirements', async () => {
      const tierInfo = kycService.getTierInfo(2); // TIER_2 for intermediate

      expect(tierInfo).toBeDefined();
      expect(tierInfo.name).toBe('Verified');
      expect(tierInfo.requirements).toBeDefined();
      expect(Array.isArray(tierInfo.requirements)).toBe(true);
      expect(tierInfo.limits).toBeDefined();
    });

    it('should submit KYC documents', async () => {
      // For Tier 1, we verify email and phone codes
      const submission = await kycService.verifyTier1Codes(
        mockWallet.address,
        'test@example.com',
        '123456', // email code
        '+1234567890',
        '654321' // phone code
      );

      expect(submission).toBeDefined();
      expect(submission.success).toBeDefined();
    });

    it('should handle KYC tiers', async () => {
      const status = await kycService.getUserKYCStatus(mockWallet.address);

      expect(status.currentTier).toBeDefined();
      expect(status.currentTier).toBeGreaterThanOrEqual(0);
      expect(status.currentTier).toBeLessThanOrEqual(4);
    });

    it('should check transaction limits', async () => {
      const status = await kycService.getUserKYCStatus(mockWallet.address);
      const tierInfo = kycService.getTierInfo(status.currentTier);
      
      expect(tierInfo).toBeDefined();
      expect(tierInfo.limits).toBeDefined();
      expect(tierInfo.limits.daily).toBeDefined();
      expect(tierInfo.limits.monthly).toBeDefined();
      expect(tierInfo.limits.perTransaction).toBeDefined();
    });
  });

  describe('Reputation Oracle', () => {
    it('should get user reputation score', async () => {
      // For the existing simple ReputationService, we need to adapt the test
      const score = await reputationService.getReputationScore(mockWallet.address);

      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should clear reputation cache', async () => {
      // Get initial score to populate cache
      const score1 = await reputationService.getReputationScore(mockWallet.address);
      expect(score1).toBeDefined();

      // Clear cache
      await reputationService.clearCache();

      // Get score again - should still work
      const score2 = await reputationService.getReputationScore(mockWallet.address);
      expect(score2).toBeDefined();
    });
  });

  describe('ENS Oracle Integration', () => {
    it('should resolve ENS name', async () => {
      const address = await oracleService.resolveENS('vitalik.eth');
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should reverse resolve address to ENS', async () => {
      const ensName = await oracleService.reverseResolveENS(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      );
      
      expect(ensName).toBeDefined();
      expect(ensName).toContain('.eth');
    });

    it('should check ENS availability', async () => {
      const available = await oracleService.isENSAvailable('myuniquename12345.eth');
      
      expect(typeof available).toBe('boolean');
    });

    it('should get ENS metadata', async () => {
      const metadata = await oracleService.getENSMetadata('vitalik.eth');
      
      expect(metadata).toBeDefined();
      expect(metadata.owner).toBeDefined();
      expect(metadata.resolver).toBeDefined();
      expect(metadata.registeredAt).toBeDefined();
      expect(metadata.expiresAt).toBeDefined();
    });

    it('should register ENS name', async () => {
      const registration = await oracleService.registerENS({
        name: 'mytestname.eth',
        owner: mockWallet.address,
        duration: 1 // 1 year
      });

      expect(registration.success).toBeDefined();
      if (registration.success) {
        expect(registration.transactionHash).toBeDefined();
        expect(registration.expiresAt).toBeDefined();
      }
    });
  });

  describe('Data Feed Oracles', () => {
    it('should get weather data for insurance', async () => {
      const weather = await oracleService.getWeatherData({
        location: { lat: 40.7128, lon: -74.0060 },
        parameters: ['temperature', 'precipitation', 'windSpeed']
      });

      expect(weather).toBeDefined();
      expect(weather.temperature).toBeDefined();
      expect(weather.precipitation).toBeDefined();
      expect(weather.windSpeed).toBeDefined();
      expect(weather.timestamp).toBeDefined();
    });

    it('should get sports results', async () => {
      const results = await oracleService.getSportsResults({
        sport: 'football',
        league: 'NFL',
        date: '2024-01-01'
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach(game => {
        expect(game).toHaveProperty('homeTeam');
        expect(game).toHaveProperty('awayTeam');
        expect(game).toHaveProperty('homeScore');
        expect(game).toHaveProperty('awayScore');
        expect(game).toHaveProperty('status');
      });
    });

    it('should get random number', async () => {
      const random = await oracleService.getVerifiableRandom({
        min: 1,
        max: 100,
        seed: mockWallet.address
      });

      expect(random.value).toBeGreaterThanOrEqual(1);
      expect(random.value).toBeLessThanOrEqual(100);
      expect(random.proof).toBeDefined();
      expect(random.blockNumber).toBeDefined();
    });
  });

  describe('Oracle Consensus', () => {
    it('should aggregate multiple oracle responses', async () => {
      const query = {
        type: 'price',
        asset: 'XOM',
        quote: 'USD'
      };

      const consensus = await oracleService.getConsensus(query, {
        minResponses: 3,
        timeout: 5000
      });

      expect(consensus).toBeDefined();
      expect(consensus.value).toBeDefined();
      expect(consensus.confidence).toBeGreaterThanOrEqual(0);
      expect(consensus.confidence).toBeLessThanOrEqual(1);
      expect(consensus.responses).toBeGreaterThanOrEqual(3);
      expect(consensus.method).toBeDefined();
    });

    it('should handle oracle disputes', async () => {
      const dispute = await oracleService.submitDispute({
        queryId: 'query-123',
        reason: 'Incorrect price reported',
        evidence: {
          expectedValue: 100,
          reportedValue: 150,
          sources: ['source1', 'source2']
        }
      });

      expect(dispute.disputeId).toBeDefined();
      expect(dispute.status).toBe('pending');
      expect(dispute.resolutionTime).toBeDefined();
    });

    it('should verify oracle signatures', async () => {
      const oracleData = {
        value: 100,
        timestamp: Date.now(),
        oracleAddress: '0xoracle...',
        signature: '0xsignature...'
      };

      const isValid = await oracleService.verifyOracleSignature(oracleData);
      
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Cross-Chain Oracle', () => {
    it('should get cross-chain asset price', async () => {
      const price = await oracleService.getCrossChainPrice({
        asset: 'USDC',
        chains: ['ethereum', 'avalanche', 'polygon']
      });

      expect(price).toBeDefined();
      Object.keys(price).forEach(chain => {
        expect(price[chain]).toHaveProperty('price');
        expect(price[chain]).toHaveProperty('liquidity');
        expect(price[chain]).toHaveProperty('volume24h');
      });
    });

    it('should validate cross-chain state', async () => {
      const validation = await oracleService.validateCrossChainState({
        type: 'balance',
        address: mockWallet.address,
        chains: ['ethereum', 'avalanche']
      });

      expect(validation).toBeDefined();
      expect(validation.isConsistent).toBeDefined();
      expect(validation.states).toBeDefined();
      
      if (!validation.isConsistent) {
        expect(validation.discrepancies).toBeDefined();
      }
    });
  });
});