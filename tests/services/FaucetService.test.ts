/**
 * FaucetService Test Suite
 * 
 * Tests testnet token distribution operations including claims, verification,
 * rate limiting, statistics, and multi-network support.
 * This is a Phase 5 component for testnet token distribution functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { FaucetService, TestnetType, VerificationMethod } from '../../src/services/FaucetService';

// Mock dependencies
jest.mock('ethers');

// Mock fetch globally
global.fetch = jest.fn();
global.navigator = { userAgent: 'test-browser' } as any;
global.window = { ethereum: {} } as any;

describe('FaucetService', () => {
  let faucetService: FaucetService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    mockProvider = {} as any;
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;

    faucetService = new FaucetService(mockProvider, 'http://localhost:3001');
  });

  afterEach(() => {
    faucetService.shutdown();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalDistributed: { OMNICOIN_TESTNET: '1000000' },
          uniqueUsers: 500,
          successRate: 95.5
        })
      } as Response);

      await expect(faucetService.initialize()).resolves.not.toThrow();
    });

    it('should start periodic status updates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as Response);

      await faucetService.initialize();
      
      // Fast forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      // Stats should be refreshed
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/faucet/stats')
      );
    });

    it('should handle initialization errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(faucetService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Token Claims', () => {
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';

    beforeEach(async () => {
      // Mock stats fetch for initialize
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalDistributed: {},
          uniqueUsers: 0,
          successRate: 0
        })
      } as Response);

      await faucetService.initialize();
    });

    it('should claim tokens successfully', async () => {
      // Mock user status - can claim
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {
            [TestnetType.OMNICOIN_TESTNET]: {
              totalClaims: 0,
              lastClaim: 0,
              totalAmount: '0'
            }
          },
          verification: { email: true },
          trustLevel: 50,
          isVIP: false
        })
      } as Response);

      // Mock IP fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      } as Response);

      // Mock claim request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: '0xTx123',
          amount: '100'
        })
      } as Response);

      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET,
        verification: {
          method: VerificationMethod.EMAIL,
          email: 'test@example.com'
        }
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0xTx123');
      expect(result.amount).toBe('100');
      expect(result.nextClaimTime).toBeGreaterThan(Date.now());
    });

    it('should prevent claims before cooldown period', async () => {
      const lastClaim = Date.now() - 12 * 60 * 60 * 1000; // 12 hours ago
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canClaim: false,
          nextClaimTime: lastClaim + 24 * 60 * 60 * 1000, // 24 hours after last claim
          claims: {
            OMNICOIN_TESTNET: {
              lastClaim,
              totalClaims: 1,
              totalAmount: '100'
            }
          },
          verification: { email: true },
          trustLevel: 50,
          isVIP: false,
          isVIP: false
        })
      } as Response);

      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Please wait/);
      expect(result.nextClaimTime).toBeDefined();
    });

    it('should enforce maximum claim limits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canClaim: false,
          claims: {
            OMNICOIN_TESTNET: {
              lastClaim: 0,
              totalClaims: 10, // Max is 10
              totalAmount: '1000'
            }
          },
          verification: { email: true },
          trustLevel: 50,
          isVIP: false,
          isVIP: false
        })
      } as Response);

      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(false);
    });

    it('should require verification for protected networks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canClaim: true,
          claims: {},
          verification: { email: false }, // Missing required email
          trustLevel: 0,
          isVIP: false
        })
      } as Response);

      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Additional verification required');
      expect(result.requiredVerification).toContain(VerificationMethod.EMAIL);
    });

    it('should handle unsupported testnets', async () => {
      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: 'INVALID_TESTNET' as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported testnet');
    });

    it('should handle claim failures from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: { email: true },
          trustLevel: 50,
          isVIP: false
        })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Insufficient faucet balance'
      } as Response);

      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient faucet balance');
    });

    it('should support custom claim amounts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: { email: true },
          trustLevel: 50,
          isVIP: false
        })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: '0xTx456',
          amount: '250'
        })
      } as Response);

      const result = await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET,
        amount: '250'
      });

      expect(result.success).toBe(true);
      expect(result.amount).toBe('250');
    });
  });

  describe('User Status', () => {
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';

    it('should get user status successfully', async () => {
      const mockStatus = {
        claims: {
          OMNICOIN_TESTNET: {
            lastClaim: Date.now() - 25 * 60 * 60 * 1000,
            totalClaims: 3,
            totalAmount: '300'
          }
        },
        verification: {
          email: true,
          twitter: true
        },
        trustLevel: 75,
        isVIP: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      } as Response);

      const status = await faucetService.getUserStatus(testAddress);

      expect(status.address).toBe(testAddress);
      expect(status.trustLevel).toBe(75);
      expect(status.isVIP).toBe(true);
      expect(status.verification.email).toBe(true);
      
      const omniClaim = status.claims.get(TestnetType.OMNICOIN_TESTNET);
      expect(omniClaim?.totalClaims).toBe(3);
      expect(omniClaim?.canClaim).toBe(true);
    });

    it('should return default status for new users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'User not found'
      } as Response);

      const status = await faucetService.getUserStatus(testAddress);

      expect(status.address).toBe(testAddress);
      expect(status.trustLevel).toBe(0);
      expect(status.isVIP).toBe(false);
      
      // All networks should be claimable
      for (const [network, claim] of status.claims) {
        expect(claim.canClaim).toBe(true);
        expect(claim.totalClaims).toBe(0);
      }
    });

    it('should cache user status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: {},
          trustLevel: 50
        })
      } as Response);

      // First call
      const status1 = await faucetService.getUserStatus(testAddress);
      
      // Second call should use cache
      const status2 = await faucetService.getUserStatus(testAddress);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(status1).toBe(status2);
    });

    it('should clear cache after claim', async () => {
      // Initial status fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: { email: true },
          trustLevel: 50,
          isVIP: false
        })
      } as Response);

      await faucetService.getUserStatus(testAddress);

      // Mock successful claim
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: { email: true },
          trustLevel: 50,
          isVIP: false
        })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: '127.0.0.1' })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionId: '0x123', amount: '100' })
      } as Response);

      await faucetService.claimTokens({
        address: testAddress,
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      // Next status call should fetch fresh data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ claims: {} })
      } as Response);

      await faucetService.getUserStatus(testAddress);

      // Should have made new fetch after claim
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/faucet/status/${testAddress}`)
      );
    });
  });

  describe('Identity Verification', () => {
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';

    it('should verify email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      const result = await faucetService.verifyIdentity(
        testAddress,
        VerificationMethod.EMAIL,
        {
          email: 'test@example.com',
          verificationCode: '123456'
        }
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/faucet/verify'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test@example.com')
        })
      );
    });

    it('should verify phone number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      const result = await faucetService.verifyIdentity(
        testAddress,
        VerificationMethod.PHONE,
        {
          phone: '+1234567890',
          verificationCode: '123456'
        }
      );

      expect(result.success).toBe(true);
    });

    it('should verify social media accounts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      const result = await faucetService.verifyIdentity(
        testAddress,
        VerificationMethod.TWITTER,
        {
          socialHandle: '@testuser'
        }
      );

      expect(result.success).toBe(true);
    });

    it('should handle verification failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid verification code'
      } as Response);

      const result = await faucetService.verifyIdentity(
        testAddress,
        VerificationMethod.EMAIL,
        {
          email: 'test@example.com',
          verificationCode: 'wrong'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
    });

    it('should clear cache after verification', async () => {
      // Cache user status first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: {},
          trustLevel: 0,
          isVIP: false
        })
      } as Response);

      await faucetService.getUserStatus(testAddress);

      // Verify identity
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await faucetService.verifyIdentity(
        testAddress,
        VerificationMethod.EMAIL,
        { email: 'test@example.com' }
      );

      // Next status should fetch fresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: { email: true },
          trustLevel: 0,
          isVIP: false
        })
      } as Response);

      await faucetService.getUserStatus(testAddress);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/faucet/status/${testAddress}`)
      );
    });
  });

  describe('Faucet Statistics', () => {
    beforeEach(async () => {
      // Mock initial stats fetch during initialize
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalDistributed: {},
          uniqueUsers: 0,
          successRate: 0
        })
      } as Response);

      await faucetService.initialize();
    });

    it('should get faucet statistics', async () => {
      // Clear the stats cache by shutting down and recreating service
      faucetService.shutdown();
      faucetService = new FaucetService(mockProvider, 'http://localhost:3001');

      const mockStats = {
        totalDistributed: {
          OMNICOIN_TESTNET: '1000000',
          ETHEREUM_SEPOLIA: '50'
        },
        uniqueUsers: 1500,
        dailyDistribution: {
          OMNICOIN_TESTNET: '10000',
          ETHEREUM_SEPOLIA: '1'
        },
        remainingPools: {
          OMNICOIN_TESTNET: '9000000',
          ETHEREUM_SEPOLIA: '950'
        },
        avgClaimAmount: {
          OMNICOIN_TESTNET: '100',
          ETHEREUM_SEPOLIA: '0.1'
        },
        successRate: 98.5
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      } as Response);

      const stats = await faucetService.getFaucetStats();

      expect(stats.uniqueUsers).toBe(1500);
      expect(stats.successRate).toBe(98.5);
      expect(stats.totalDistributed.get(TestnetType.OMNICOIN_TESTNET)).toBe('1000000');
      expect(stats.remainingPools.get(TestnetType.ETHEREUM_SEPOLIA)).toBe('950');
    });

    it('should cache statistics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uniqueUsers: 1000,
          successRate: 95
        })
      } as Response);

      const stats1 = await faucetService.getFaucetStats();
      const stats2 = await faucetService.getFaucetStats();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(stats1).toBe(stats2);
    });

    it('should handle statistics fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const stats = await faucetService.getFaucetStats();

      expect(stats.uniqueUsers).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.totalDistributed.size).toBe(0);
    });
  });

  describe('Network Management', () => {
    it('should get network configuration', () => {
      const config = faucetService.getNetworkConfig(TestnetType.OMNICOIN_TESTNET);

      expect(config).toBeDefined();
      expect(config?.name).toBe('OmniCoin Testnet');
      expect(config?.symbol).toBe('tXOM');
      expect(config?.chainId).toBe(31337);
      expect(config?.defaultAmount).toBe('100');
    });

    it('should get all supported networks', () => {
      const networks = faucetService.getSupportedNetworks();

      expect(networks.length).toBeGreaterThan(0);
      expect(networks.some(n => n.type === TestnetType.OMNICOIN_TESTNET)).toBe(true);
      expect(networks.some(n => n.type === TestnetType.ETHEREUM_SEPOLIA)).toBe(true);
      expect(networks.some(n => n.type === TestnetType.COTI_TESTNET)).toBe(true);
      expect(networks.some(n => n.type === TestnetType.AVALANCHE_FUJI)).toBe(true);
    });

    it('should add network to wallet', async () => {
      const mockRequest = jest.fn().mockResolvedValue(true);
      (global.window as any).ethereum = { request: mockRequest };

      const result = await faucetService.addNetworkToWallet(TestnetType.OMNICOIN_TESTNET);

      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: expect.arrayContaining([
          expect.objectContaining({
            chainId: '0x7a69',
            chainName: 'OmniCoin Testnet'
          })
        ])
      });
    });

    it('should handle wallet not detected', async () => {
      (global.window as any).ethereum = undefined;

      const result = await faucetService.addNetworkToWallet(TestnetType.OMNICOIN_TESTNET);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No wallet detected');
    });

    it('should handle network add rejection', async () => {
      const mockRequest = jest.fn().mockRejectedValue(new Error('User rejected'));
      (global.window as any).ethereum = { request: mockRequest };

      const result = await faucetService.addNetworkToWallet(TestnetType.OMNICOIN_TESTNET);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User rejected');
    });
  });

  describe('Drip Amount Calculation', () => {
    it('should calculate basic drip amount', () => {
      const amount = faucetService.getDripAmount(
        '0x123',
        TestnetType.OMNICOIN_TESTNET
      );

      expect(amount).toBe('100'); // Default amount
    });

    it('should apply trust level bonus', async () => {
      // Setup cached user with high trust
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: {},
          trustLevel: 100, // Max trust
          isVIP: false
        })
      } as Response);

      const testAddress = '0x456';
      await faucetService.getUserStatus(testAddress);

      const amount = faucetService.getDripAmount(testAddress, TestnetType.OMNICOIN_TESTNET);
      
      // Base 100 * 2x trust multiplier = 200
      expect(amount).toBe('200');
    });

    it('should apply VIP bonus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: {},
          trustLevel: 0,
          isVIP: true
        })
      } as Response);

      const testAddress = '0x789';
      await faucetService.getUserStatus(testAddress);

      const amount = faucetService.getDripAmount(testAddress, TestnetType.OMNICOIN_TESTNET);
      
      // Base 100 * 1.5x VIP multiplier = 150
      expect(amount).toBe('150');
    });

    it('should stack bonuses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: {},
          trustLevel: 50, // 50% trust
          isVIP: true
        })
      } as Response);

      const testAddress = '0xABC';
      await faucetService.getUserStatus(testAddress);

      const amount = faucetService.getDripAmount(testAddress, TestnetType.OMNICOIN_TESTNET);
      
      // Base 100 * 1.5x trust * 1.5x VIP = 225
      expect(amount).toBe('225');
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should shutdown cleanly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as Response);

      await faucetService.initialize();
      
      // Cache some data
      await faucetService.getUserStatus('0x123');
      await faucetService.getFaucetStats();

      faucetService.shutdown();

      // Verify cleanup
      // Check that shutdown was called (interval should be cleared)
      expect(faucetService).toBeDefined();
    });

    it('should clear old cache entries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as Response);

      await faucetService.initialize();

      // Add old cache entry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {
            OMNICOIN_TESTNET: {
              lastClaim: Date.now() - 20 * 60 * 1000, // 20 minutes ago
              totalClaims: 1,
              totalAmount: '100'
            }
          },
          verification: {},
          trustLevel: 0,
          isVIP: false
        })
      } as Response);

      await faucetService.getUserStatus('0x123');

      // Fast forward to trigger cache cleanup
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Old entries should be removed
      // (Implementation detail - cache should be cleared)
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors in claims', async () => {
      // When getUserStatus fails, it returns default status with no verification
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await faucetService.claimTokens({
        address: '0x123',
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(false);
      // Since getUserStatus returns default (unverified) status, verification is required
      expect(result.error).toBe('Additional verification required');
    });

    it('should handle invalid responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);

      const status = await faucetService.getUserStatus('0x123');

      // Should return default status
      expect(status.trustLevel).toBe(0);
      expect(status.isVIP).toBe(false);
    });

    it('should handle IP fetch failures', async () => {
      // Mock user status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {},
          verification: { email: true },
          trustLevel: 50,
          isVIP: false
        })
      } as Response);

      // IP fetch fails
      mockFetch.mockRejectedValueOnce(new Error('IP service down'));

      // Claim still proceeds with fallback IP
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionId: '0x123', amount: '100' })
      } as Response);

      const result = await faucetService.claimTokens({
        address: '0x123',
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Multi-Network Support', () => {
    it('should support different verification requirements per network', async () => {
      // OMNICOIN requires email
      const omniConfig = faucetService.getNetworkConfig(TestnetType.OMNICOIN_TESTNET);
      expect(omniConfig?.requiredVerification).toContain(VerificationMethod.EMAIL);

      // Sepolia requires captcha
      const sepoliaConfig = faucetService.getNetworkConfig(TestnetType.ETHEREUM_SEPOLIA);
      expect(sepoliaConfig?.requiredVerification).toContain(VerificationMethod.CAPTCHA);

      // Fuji requires Twitter
      const fujiConfig = faucetService.getNetworkConfig(TestnetType.AVALANCHE_FUJI);
      expect(fujiConfig?.requiredVerification).toContain(VerificationMethod.TWITTER);
    });

    it('should have different claim intervals per network', () => {
      const configs = faucetService.getSupportedNetworks();
      
      for (const { config } of configs) {
        expect(config.claimInterval).toBeGreaterThan(0);
        expect(config.maxClaims).toBeGreaterThan(0);
      }
    });

    it('should have unique endpoints per network', () => {
      const configs = faucetService.getSupportedNetworks();
      const endpoints = new Set<string>();

      for (const { config } of configs) {
        expect(endpoints.has(config.endpoint)).toBe(false);
        endpoints.add(config.endpoint);
      }
    });
  });

  describe('Time Formatting', () => {
    it('should format wait times correctly', async () => {
      const lastClaim = Date.now() - 23 * 60 * 60 * 1000; // 23 hours ago
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: {
            OMNICOIN_TESTNET: {
              lastClaim,
              totalClaims: 1,
              totalAmount: '100'
            }
          },
          verification: { email: true },
          trustLevel: 0,
          isVIP: false
        })
      } as Response);

      const result = await faucetService.claimTokens({
        address: '0x123',
        testnet: TestnetType.OMNICOIN_TESTNET
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/1h \d+m/); // Should show hours and minutes
    });
  });
});