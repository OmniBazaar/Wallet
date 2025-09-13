import {
  OTPService,
  ISMSProvider,
  IEmailProvider,
  ISecureStorageService
} from '../../../src/services/auth/OTPService';

describe('OTPService', () => {
  let otpService: OTPService;
  let mockSMSProvider: ISMSProvider;
  let mockEmailProvider: IEmailProvider;
  let mockSecureStorage: ISecureStorageService;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockSMSProvider = {
      sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'sms-123' })
    };

    mockEmailProvider = {
      sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'email-123' })
    };

    mockSecureStorage = {
      store: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined)
    };

    // Create service instance with mocked dependencies
    otpService = new OTPService(
      {},
      {
        smsProvider: mockSMSProvider,
        emailProvider: mockEmailProvider,
        secureStorage: mockSecureStorage
      }
    );
    await otpService.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const service = new OTPService();
      await expect(service.init()).resolves.not.toThrow();
    });

    it('should initialize with injected dependencies', async () => {
      const customStorage: ISecureStorageService = {
        store: jest.fn(),
        retrieve: jest.fn(),
        delete: jest.fn()
      };

      const service = new OTPService({}, { secureStorage: customStorage });
      await service.init();

      // Generate OTP to verify custom storage is used
      await service.generateOTP({ userId: 'test', purpose: 'test' });
      expect(customStorage.store).toHaveBeenCalled();
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
        expect.stringContaining(code)
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
      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      // Mock storage to return the generated OTP
      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValue(
        JSON.stringify({
          code,
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );
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
        message: expect.stringContaining('verification code')
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
        html: expect.stringContaining('verification code')
      });
    });

    it('should throw error if OTP not found', async () => {
      // Override the mock for this specific test to return null for unknown user
      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValueOnce(null);

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
      (mockSMSProvider.sendSMS as jest.Mock).mockResolvedValue({ success: false });

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
    let generatedCode: string;

    beforeEach(async () => {
      const result = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      generatedCode = result.code;

      // Mock storage retrieval to return the generated OTP data
      (mockSecureStorage.retrieve as Mock).mockResolvedValue(
        JSON.stringify({
          code: generatedCode,
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );
    });

    it('should verify correct OTP code', async () => {
      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(true);
      expect(result.message).toBe('OTP verified successfully');
    });

    it('should reject incorrect OTP code', async () => {
      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

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

      (mockSecureStorage.retrieve as Mock).mockResolvedValue(JSON.stringify(otpData));

      // First failed attempt
      await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: 'wrong'
      });

      // Verify that store was called to update attempts
      expect(mockSecureStorage.store).toHaveBeenCalledWith(
        'otp:user-123:login',
        expect.stringContaining('"attempts":1')
      );
    });

    it('should block after max attempts', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 3,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Maximum attempts exceeded');
    });

    it('should reject expired OTP', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() - 1000, // Expired
          createdAt: Date.now() - 301000
        })
      );

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('OTP has expired');
    });

    it('should delete OTP after successful verification', async () => {
      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

      await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(mockSecureStorage.delete).toHaveBeenCalledWith(
        'otp:user-123:login'
      );
    });

    it('should handle missing OTP data', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue(null);

      const result = await otpService.verifyOTP({
        userId: 'user-123',
        purpose: 'login',
        code: '123456'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('No OTP found for user');
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Mock rate limit data showing we're under the limit
      (mockSecureStorage.retrieve as Mock)
        .mockResolvedValueOnce(JSON.stringify({
          count: 3,
          windowStart: Date.now() - 30000 // 30 seconds ago
        }))
        .mockResolvedValueOnce(null); // No OTP exists

      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      expect(code).toMatch(/^\d{6}$/);
    });

    it('should handle rate limit window expiry', async () => {
      // Mock expired rate limit window
      (mockSecureStorage.retrieve as Mock)
        .mockResolvedValueOnce(JSON.stringify({
          count: 5,
          windowStart: Date.now() - 3700000 // Over 1 hour ago
        }))
        .mockResolvedValueOnce(null); // No OTP exists

      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe('OTP resend', () => {
    it('should allow resending OTP', async () => {
      const { code } = await otpService.generateOTP({ userId: 'user-123', purpose: 'login' });

      (mockSecureStorage.retrieve as Mock).mockResolvedValue(
        JSON.stringify({
          code,
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

      await otpService.resendOTP({
        userId: 'user-123',
        purpose: 'login',
        method: 'sms',
        recipient: '+1234567890'
      });

      expect(mockSMSProvider.sendSMS).toHaveBeenCalled();
    });

    it('should generate new OTP if previous expired', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() - 1000, // Expired
          createdAt: Date.now() - 301000
        })
      );

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
      await expect(otpService.cleanupExpiredOTPs()).resolves.not.toThrow();
    });

    it('should cleanup resources on service cleanup', async () => {
      await otpService.cleanup();

      // Should be able to reinitialize
      await expect(otpService.init()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error when sending SMS without provider', async () => {
      const service = new OTPService({}, { secureStorage: mockSecureStorage });
      await service.init();
      await service.generateOTP({ userId: 'user-123', purpose: 'login' });

      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

      await expect(
        service.sendOTP({
          userId: 'user-123',
          purpose: 'login',
          method: 'sms',
          recipient: '+1234567890'
        })
      ).rejects.toThrow('SMS provider not configured');
    });

    it('should throw error when sending email without provider', async () => {
      const service = new OTPService({}, { secureStorage: mockSecureStorage });
      await service.init();
      await service.generateOTP({ userId: 'user-123', purpose: 'login' });

      (mockSecureStorage.retrieve as jest.Mock).mockResolvedValue(
        JSON.stringify({
          code: '123456',
          attempts: 0,
          expiresAt: Date.now() + 300000,
          createdAt: Date.now()
        })
      );

      await expect(
        service.sendOTP({
          userId: 'user-123',
          purpose: 'login',
          method: 'email',
          recipient: 'user@example.com'
        })
      ).rejects.toThrow('Email provider not configured');
    });
  });
});