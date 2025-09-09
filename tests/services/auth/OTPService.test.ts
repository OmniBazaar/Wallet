import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { OTPService } from '../../../src/services/auth/OTPService';
import { SMSProvider } from '../../../../../Validator/src/services/providers/SMSProvider';
import { EmailProvider } from '../../../../../Validator/src/services/providers/EmailProvider';
import { SecureStorageService } from '../../../../../Validator/src/services/SecureStorageService';

// Mock the Validator module dependencies
vi.mock('../../../../../Validator/src/services/providers/SMSProvider');
vi.mock('../../../../../Validator/src/services/providers/EmailProvider');
vi.mock('../../../../../Validator/src/services/SecureStorageService');

describe('OTPService', () => {
  let otpService: OTPService;
  let mockSMSProvider: SMSProvider;
  let mockEmailProvider: EmailProvider;
  let mockSecureStorage: SecureStorageService;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockSMSProvider = new SMSProvider();
    mockEmailProvider = new EmailProvider();
    mockSecureStorage = new SecureStorageService();

    // Setup mock implementations
    (mockSMSProvider.init as Mock).mockResolvedValue(undefined);
    (mockEmailProvider.init as Mock).mockResolvedValue(undefined);
    (mockSecureStorage.init as Mock).mockResolvedValue(undefined);

    (mockSMSProvider.sendSMS as Mock).mockResolvedValue({ success: true, messageId: 'sms-123' });
    (mockEmailProvider.sendEmail as Mock).mockResolvedValue({ success: true, messageId: 'email-123' });
    
    (mockSecureStorage.store as Mock).mockResolvedValue(undefined);
    (mockSecureStorage.retrieve as Mock).mockResolvedValue(null);
    (mockSecureStorage.delete as Mock).mockResolvedValue(undefined);

    // Create service instance
    otpService = new OTPService();
    await otpService.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all providers', async () => {
      const service = new OTPService();
      await expect(service.init()).resolves.not.toThrow();

      expect(mockSMSProvider.init).toHaveBeenCalled();
      expect(mockEmailProvider.init).toHaveBeenCalled();
      expect(mockSecureStorage.init).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      const service = new OTPService();
      (mockSMSProvider.init as Mock).mockRejectedValue(new Error('SMS init failed'));

      await expect(service.init()).rejects.toThrow('Failed to initialize OTP service');
    });
  });

  describe('OTP generation', () => {
    it('should generate 6-digit OTP code', async () => {
      const { code, expiresAt } = await otpService.generateOTP({
        userId: 'user-123',
        purpose: 'login'
      });

      expect(code).toMatch(/^\d{6}$/);
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000); // 5 minutes
    });

    it('should store OTP in secure storage', async () => {
      const { code } = await otpService.generateOTP({
        userId: 'user-123',
        purpose: 'login'
      });

      expect(mockSecureStorage.store).toHaveBeenCalledWith(
        expect.stringContaining('otp:user-123:login'),
        expect.objectContaining({
          code,
          attempts: 0,
          expiresAt: expect.any(Number),
          createdAt: expect.any(Number)
        }),
        { ttl: 300 } // 5 minutes
      );
    });

    it('should generate different codes for same user', async () => {
      const otp1 = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      const otp2 = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });

      expect(otp1.code).not.toBe(otp2.code);
    });
  });

  describe('OTP sending', () => {
    beforeEach(async () => {
      await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
    });

    it('should send OTP via SMS', async () => {
      await otpService.sendOTP({
        userId: 'user-123',
        purpose: 'login',
        method: 'sms',
        recipient: '+1234567890'
      });

      expect(mockSMSProvider.sendSMS).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('verification code')
      });
    });

    it('should send OTP via email', async () => {
      await otpService.sendOTP({
        userId: 'user-123',
        purpose: 'login',
        method: 'email',
        recipient: 'user@example.com'
      });

      expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Your OmniBazaar Verification Code',
        html: expect.stringContaining('verification code'),
        text: expect.stringContaining('verification code')
      });
    });

    it('should throw error if OTP not found', async () => {
      await expect(
        otpService.sendOTP({
          userId: 'unknown-user',
          purpose: 'login',
          method: 'sms',
          recipient: '+1234567890'
        })
      ).rejects.toThrow('No OTP found for user');
    });

    it('should handle SMS send failure', async () => {
      (mockSMSProvider.sendSMS as Mock).mockResolvedValue({ success: false, error: 'SMS failed' });

      await expect(
        otpService.sendOTP({
          userId: 'user-123',
          purpose: 'login',
          method: 'sms',
          recipient: '+1234567890'
        })
      ).rejects.toThrow('Failed to send OTP via sms');
    });
  });

  describe('OTP verification', () => {
    beforeEach(async () => {
      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      
      // Mock storage retrieval
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code,
        attempts: 0,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      });
    });

    it('should verify correct OTP code', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code: '123456',
        attempts: 0,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      });

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(true);
      expect(result.message).toBe('OTP verified successfully');
    });

    it('should reject incorrect OTP code', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code: '123456',
        attempts: 0,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      });

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '654321'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid OTP code');
    });

    it('should track failed attempts', async () => {
      const otpData = {
        code: '123456',
        attempts: 0,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      };

      (mockSecureStorage.retrieve as Mock).mockResolvedValue(otpData);

      // First failed attempt
      await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: 'wrong'
      });

      expect(mockSecureStorage.store).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ attempts: 1 }),
        expect.any(Object)
      );
    });

    it('should block after max attempts', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code: '123456',
        attempts: 3,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      });

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Maximum attempts exceeded');
    });

    it('should reject expired OTP', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code: '123456',
        attempts: 0,
        expiresAt: Date.now() - 1000, // Expired
        createdAt: Date.now() - 301000
      });

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('OTP has expired');
    });

    it('should delete OTP after successful verification', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code: '123456',
        attempts: 0,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      });

      await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(mockSecureStorage.delete).toHaveBeenCalledWith(
        expect.stringContaining('otp:user-123:login')
      );
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit for OTP generation', async () => {
      // Generate first OTP
      await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });

      // Mock rate limit check
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        count: 5,
        windowStart: Date.now() - 30000 // 30 seconds ago
      });

      await expect(
        otpService.generateOTP({ userId: 'user-123', purpose: 'login' })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should reset rate limit after window expires', async () => {
      // Mock expired rate limit window
      (mockSecureStorage.retrieve as Mock)
        .mockResolvedValueOnce({
          count: 5,
          windowStart: Date.now() - 3700000 // Over 1 hour ago
        })
        .mockResolvedValueOnce(null); // No OTP exists

      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe('OTP resend', () => {
    it('should allow resending OTP', async () => {
      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });

      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code,
        attempts: 0,
        expiresAt: Date.now() + 300000,
        createdAt: Date.now()
      });

      await otpService.resendOTP({
        userId: 'user-123',
        purpose: 'login',
        method: 'sms',
        recipient: '+1234567890'
      });

      expect(mockSMSProvider.sendSMS).toHaveBeenCalled();
    });

    it('should generate new OTP if previous expired', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        code: '123456',
        attempts: 0,
        expiresAt: Date.now() - 1000, // Expired
        createdAt: Date.now() - 301000
      });

      const result = await otpService.resendOTP({
        userId: 'user-123',
        purpose: 'login',
        method: 'sms',
        recipient: '+1234567890'
      });

      expect(result.newCode).toBe(true);
      expect(mockSecureStorage.store).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired OTPs', async () => {
      await otpService.cleanupExpiredOTPs();

      expect(mockSecureStorage.deletePattern).toHaveBeenCalledWith('otp:*:*', {
        olderThan: expect.any(Number)
      });
    });

    it('should cleanup resources on service cleanup', async () => {
      await otpService.cleanup();
      
      // Should be able to reinitialize
      await expect(otpService.init()).resolves.not.toThrow();
    });
  });
});