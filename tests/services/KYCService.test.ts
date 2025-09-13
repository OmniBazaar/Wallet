/**
 * KYCService Test Suite
 * 
 * Tests tiered identity verification operations including email/phone verification,
 * document verification, Sumsub integration, webhooks, and transaction limits.
 * This is a Phase 5 component for regulatory compliance functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { 
  KYCService, 
  KYCTier, 
  VerificationStatus, 
  DocumentType 
} from '../../src/services/KYCService';

// Mock dependencies
jest.mock('ethers');
jest.mock('crypto');

// Mock fetch globally
global.fetch = jest.fn();

// Mock process.env
process.env = {
  SUMSUB_APP_TOKEN: 'test_app_token',
  SUMSUB_SECRET_KEY: 'test_secret',
  SUMSUB_WEBHOOK_SECRET: 'test_webhook_secret'
};

describe('KYCService', () => {
  let kycService: KYCService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockProvider = {} as any;
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Mock crypto
    const mockCrypto = crypto as jest.Mocked<typeof crypto>;
    mockCrypto.createHmac = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock_signature')
    } as any);
    
    kycService = new KYCService(mockProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Mock access token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'mock_access_token',
          expiresIn: 3600
        })
      } as Response);

      await expect(kycService.initialize()).resolves.not.toThrow();
    });

    it('should use environment variables for configuration', () => {
      const service = new KYCService(mockProvider);
      expect((service as any).config.appToken).toBe('test_app_token');
      expect((service as any).config.secretKey).toBe('test_secret');
      expect((service as any).config.webhookSecret).toBe('test_webhook_secret');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        appToken: 'custom_app_token',
        validatorEndpoint: 'https://custom.validator.com'
      };
      
      const service = new KYCService(mockProvider, customConfig);
      expect((service as any).config.appToken).toBe('custom_app_token');
      expect((service as any).config.validatorEndpoint).toBe('https://custom.validator.com');
    });

    it('should handle initialization errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(kycService.initialize()).rejects.toThrow('Failed to get access token');
    });
  });

  describe('User KYC Status', () => {
    beforeEach(async () => {
      // Initialize with access token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    it('should get user KYC status successfully', async () => {
      const mockStatus = {
        currentTier: KYCTier.TIER_2,
        status: VerificationStatus.APPROVED,
        applicantId: 'app_123',
        tierStatus: {
          tier1: {
            email: 'test@example.com',
            emailVerified: true,
            phone: '+1234567890',
            phoneVerified: true,
            verifiedAt: Date.now() - 86400000
          },
          tier2: {
            documentType: DocumentType.PASSPORT,
            documentNumber: 'P123456',
            documentVerified: true,
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            nationality: 'US',
            verifiedAt: Date.now() - 3600000
          },
          tier3: {
            addressVerified: false
          },
          tier4: {
            companyVerified: false,
            authorizedSignatory: false
          }
        },
        expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      } as Response);

      const status = await kycService.getUserKYCStatus(testAddress);

      expect(status.address).toBe(testAddress);
      expect(status.currentTier).toBe(KYCTier.TIER_2);
      expect(status.status).toBe(VerificationStatus.APPROVED);
      expect(status.applicantId).toBe('app_123');
      expect(status.tierStatus.tier1.emailVerified).toBe(true);
      expect(status.tierStatus.tier2.documentVerified).toBe(true);
      expect(status.limits.daily).toBe('1000'); // Tier 2 limits
    });

    it('should return default status for new users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'User not found'
      } as Response);

      const status = await kycService.getUserKYCStatus(testAddress);

      expect(status.address).toBe(testAddress);
      expect(status.currentTier).toBe(KYCTier.TIER_0);
      expect(status.status).toBe(VerificationStatus.NOT_STARTED);
      expect(status.limits.daily).toBe('10'); // Tier 0 limits
    });

    it('should cache user status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      // First call
      const status1 = await kycService.getUserKYCStatus(testAddress);
      
      // Second call within cache period
      const status2 = await kycService.getUserKYCStatus(testAddress);
      
      // Should only fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(status1).toBe(status2);
    });

    it('should refresh cache after expiry', async () => {
      // Reset mock to ensure clean state
      mockFetch.mockClear();

      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      await kycService.getUserKYCStatus(testAddress);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Simulate cache expiry
      jest.advanceTimersByTime(61000); // 61 seconds

      // Second call should fetch again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_2 })
      } as Response);

      const status = await kycService.getUserKYCStatus(testAddress);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(status.currentTier).toBe(KYCTier.TIER_2);
    });
  });

  describe('Verification Process', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    describe('Tier 1 Verification', () => {
      it('should start tier 1 verification with email and phone', async () => {
        // Mock status check
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ currentTier: KYCTier.TIER_0 })
        } as Response);

        // Mock verification start
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response);

        const result = await kycService.startVerification(
          testAddress,
          KYCTier.TIER_1,
          {
            email: 'test@example.com',
            phone: '+1234567890'
          }
        );

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/verify/tier1'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('test@example.com')
          })
        );
      });

      it('should require email and phone for tier 1', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ currentTier: KYCTier.TIER_0 })
        } as Response);

        const result = await kycService.startVerification(
          testAddress,
          KYCTier.TIER_1,
          { email: 'test@example.com' } // Missing phone
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Email and phone required for Tier 1');
      });

      it('should verify tier 1 codes', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response);

        const result = await kycService.verifyTier1Codes(
          testAddress,
          '123456',
          '654321'
        );

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/verify/tier1/confirm'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('123456')
          })
        );
      });

      it('should handle invalid verification codes', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: async () => 'Invalid codes'
        } as Response);

        const result = await kycService.verifyTier1Codes(
          testAddress,
          'wrong',
          'wrong'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid verification codes');
      });
    });

    describe('Tier 2+ Verification', () => {
      it('should start Sumsub verification for tier 2', async () => {
        // Mock status check
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ currentTier: KYCTier.TIER_1 })
        } as Response);

        // Mock applicant check
        mockFetch.mockResolvedValueOnce({
          ok: false // No existing applicant
        } as Response);

        // Mock applicant creation
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'app_123' })
        } as Response);

        // Mock access token generation
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'verification_token' })
        } as Response);

        // Mock validator update
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response);

        const result = await kycService.startVerification(
          testAddress,
          KYCTier.TIER_2,
          {
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            country: 'US'
          }
        );

        expect(result.success).toBe(true);
        expect(result.verificationUrl).toContain('test.sumsub.com');
        expect(result.verificationUrl).toContain('verification_token');
      });

      it('should use existing applicant if available', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ currentTier: KYCTier.TIER_1 })
        } as Response);

        // Mock existing applicant
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ applicantId: 'existing_app_123' })
        } as Response);

        // Mock access token generation
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'verification_token' })
        } as Response);

        // Mock validator update
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response);

        const result = await kycService.startVerification(
          testAddress,
          KYCTier.TIER_2
        );

        expect(result.success).toBe(true);
        // Should not create new applicant
        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.stringContaining('/resources/applicants'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should prevent verification if already at target tier', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ currentTier: KYCTier.TIER_3 })
        } as Response);

        const result = await kycService.startVerification(
          testAddress,
          KYCTier.TIER_2 // Already above this
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Already verified at this tier or higher');
      });
    });
  });

  describe('Webhook Handling', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    it('should handle applicant reviewed webhook', async () => {
      const event = {
        type: 'applicantReviewed' as const,
        applicantId: 'app_123',
        reviewResult: {
          reviewAnswer: 'GREEN' as const,
          rejectLabels: []
        }
      };

      // Mock address lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: testAddress })
      } as Response);

      // Mock validator update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await kycService.handleWebhook(event, 'mock_signature');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/webhook/update'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('APPROVED')
        })
      );
    });

    it('should handle applicant rejected', async () => {
      const event = {
        type: 'applicantReviewed' as const,
        applicantId: 'app_123',
        reviewResult: {
          reviewAnswer: 'RED' as const,
          rejectLabels: ['DOCUMENT_EXPIRED'],
          reviewRejectType: 'FINAL'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: testAddress })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await kycService.handleWebhook(event, 'mock_signature');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/webhook/update'),
        expect.objectContaining({
          body: expect.stringContaining('REJECTED')
        })
      );
    });

    it('should handle applicant pending webhook', async () => {
      const event = {
        type: 'applicantPending' as const,
        applicantId: 'app_123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: testAddress })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await kycService.handleWebhook(event, 'mock_signature');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/webhook/update'),
        expect.objectContaining({
          body: expect.stringContaining('PENDING')
        })
      );
    });

    it('should verify webhook signature', async () => {
      const event = {
        type: 'applicantReviewed' as const,
        applicantId: 'app_123'
      };

      // Mock signature verification to fail
      const mockCrypto = crypto as jest.Mocked<typeof crypto>;
      mockCrypto.createHmac = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('wrong_signature')
      } as any);

      await expect(
        kycService.handleWebhook(event, 'expected_signature')
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should clear cache after webhook update', async () => {
      // Cache user status first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      await kycService.getUserKYCStatus(testAddress);

      // Handle webhook
      const event = {
        type: 'applicantReviewed' as const,
        applicantId: 'app_123',
        reviewResult: { reviewAnswer: 'GREEN' as const }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ address: testAddress })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await kycService.handleWebhook(event, 'mock_signature');

      // Next status fetch should hit API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_2 })
      } as Response);

      await kycService.getUserKYCStatus(testAddress);

      // Should have fetched fresh data
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/status/${testAddress}`)
      );
    });
  });

  describe('Transaction Limits', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    it('should check transaction allowed for tier 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_0 })
      } as Response);

      const result = await kycService.checkTransactionAllowed(
        testAddress,
        '5', // Amount
        '0', // Daily total
        '0'  // Monthly total
      );

      expect(result.allowed).toBe(true);
    });

    it('should reject transaction exceeding per-transaction limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_0 })
      } as Response);

      const result = await kycService.checkTransactionAllowed(
        testAddress,
        '10', // Exceeds tier 0 limit of 5
        '0',
        '0'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Transaction exceeds limit of 5 XOM');
    });

    it('should reject transaction exceeding daily limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      const result = await kycService.checkTransactionAllowed(
        testAddress,
        '50',  // Amount
        '60',  // Already used 60 today (total would be 110, exceeds 100 limit)
        '100'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Would exceed daily limit of 100 XOM');
    });

    it('should reject transaction exceeding monthly limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      const result = await kycService.checkTransactionAllowed(
        testAddress,
        '50',   // Amount
        '0',    // Daily ok
        '980'   // Monthly would exceed 1000
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Would exceed monthly limit of 1000 XOM');
    });

    it('should allow high value transactions for tier 4', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_4 })
      } as Response);

      const result = await kycService.checkTransactionAllowed(
        testAddress,
        '100000',  // Large amount
        '500000',  // Large daily
        '5000000'  // Large monthly
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('Tier Information', () => {
    it('should get tier 0 information', () => {
      const info = kycService.getTierInfo(KYCTier.TIER_0);

      expect(info.name).toBe('Unverified');
      expect(info.requirements).toHaveLength(0);
      expect(info.benefits).toContain('View marketplace');
      expect(info.limits.daily).toBe('10');
    });

    it('should get tier 1 information', () => {
      const info = kycService.getTierInfo(KYCTier.TIER_1);

      expect(info.name).toBe('Basic');
      expect(info.requirements).toContain('Valid email');
      expect(info.requirements).toContain('Phone number');
      expect(info.benefits).toContain('Basic trading');
      expect(info.limits.daily).toBe('100');
    });

    it('should get tier 2 information', () => {
      const info = kycService.getTierInfo(KYCTier.TIER_2);

      expect(info.name).toBe('Verified');
      expect(info.requirements).toContain('Government-issued ID');
      expect(info.benefits).toContain('Access to DEX');
      expect(info.limits.daily).toBe('1000');
    });

    it('should get tier 3 information', () => {
      const info = kycService.getTierInfo(KYCTier.TIER_3);

      expect(info.name).toBe('Enhanced');
      expect(info.requirements).toContain('Proof of address');
      expect(info.benefits).toContain('OTC trading');
      expect(info.limits.daily).toBe('10000');
    });

    it('should get tier 4 information', () => {
      const info = kycService.getTierInfo(KYCTier.TIER_4);

      expect(info.name).toBe('Institutional');
      expect(info.requirements).toContain('Company registration');
      expect(info.benefits).toContain('API access');
      expect(info.limits.daily).toBe('1000000');
    });
  });

  describe('Access Token Management', () => {
    it('should refresh access token when expired', async () => {
      // Initial token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'initial_token', expiresIn: 1 }) // Expires in 1 second
      } as Response);

      await kycService.initialize();

      // Wait for expiry
      jest.advanceTimersByTime(2000);

      // Mock status check to trigger token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'refreshed_token', expiresIn: 3600 })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      // Mock applicant check
      mockFetch.mockResolvedValueOnce({
        ok: false
      } as Response);

      // This should trigger token refresh
      await kycService.startVerification(testAddress, KYCTier.TIER_2);

      // Should have called auth endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/resources/auth/access-token'),
        expect.any(Object)
      );
    });

    it('should generate correct signature for API calls', async () => {
      const mockCrypto = crypto as jest.Mocked<typeof crypto>;
      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('calculated_signature')
      };
      mockCrypto.createHmac = jest.fn().mockReturnValue(mockHmac as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'token', expiresIn: 3600 })
      } as Response);

      await kycService.initialize();

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', 'test_secret');
      expect(mockHmac.update).toHaveBeenCalled();
      expect(mockHmac.digest).toHaveBeenCalledWith('hex');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    it('should handle network errors in status fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const status = await kycService.getUserKYCStatus(testAddress);

      // Should return default status
      expect(status.currentTier).toBe(KYCTier.TIER_0);
      expect(status.status).toBe(VerificationStatus.NOT_STARTED);
    });

    it('should handle verification start errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_0 })
      } as Response);

      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const result = await kycService.startVerification(
        testAddress,
        KYCTier.TIER_1,
        { email: 'test@example.com', phone: '+1234567890' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });

    it('should handle missing applicant in webhook', async () => {
      const event = {
        type: 'applicantReviewed' as const,
        applicantId: 'unknown_app'
      };

      // Address lookup fails
      mockFetch.mockResolvedValueOnce({
        ok: false
      } as Response);

      // Should not throw
      await expect(
        kycService.handleWebhook(event, 'mock_signature')
      ).resolves.not.toThrow();
    });

    it('should handle invalid verification tier', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_0 })
      } as Response);

      const result = await kycService.startVerification(
        testAddress,
        99 as KYCTier // Invalid tier
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification tier');
    });
  });

  describe('Sumsub Level Names', () => {
    it('should map tiers to correct Sumsub levels', () => {
      const service = kycService as any;
      
      expect(service.getLevelName(KYCTier.TIER_0)).toBe('basic-kyc');
      expect(service.getLevelName(KYCTier.TIER_1)).toBe('basic-kyc');
      expect(service.getLevelName(KYCTier.TIER_2)).toBe('identity-verification');
      expect(service.getLevelName(KYCTier.TIER_3)).toBe('enhanced-kyc');
      expect(service.getLevelName(KYCTier.TIER_4)).toBe('institutional-kyc');
    });
  });

  describe('Company Verification', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    it('should create company applicant for tier 4', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_3 })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: false // No existing applicant
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'company_app_123' })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'verification_token' })
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await kycService.startVerification(
        testAddress,
        KYCTier.TIER_4,
        { companyName: 'Test Corp' }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/resources/applicants'),
        expect.objectContaining({
          body: expect.stringContaining('company')
        })
      );
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock_token', expiresIn: 3600 })
      } as Response);
      
      await kycService.initialize();
    });

    it('should clear cache after successful verification', async () => {
      // Cache status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_0 })
      } as Response);

      await kycService.getUserKYCStatus(testAddress);

      // Verify tier 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      await kycService.verifyTier1Codes(testAddress, '123', '456');

      // Next status should fetch fresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentTier: KYCTier.TIER_1 })
      } as Response);

      const status = await kycService.getUserKYCStatus(testAddress);

      expect(status.currentTier).toBe(KYCTier.TIER_1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});