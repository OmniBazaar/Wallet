/**
 * OTP Verification Service
 * 
 * Handles generation, sending, and verification of one-time passwords for
 * email and SMS authentication with rate limiting and security features.
 */

/**
 * Logger instance for consistent logging across OTP service
 */
interface Logger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
}

const logger: Logger = {
  warn: (message: string, ...args: unknown[]) => {
    // In production, this would use a proper logging service
    if (process.env.NODE_ENV !== 'test') {
      process.stderr.write(`[WARN] ${message} ${args.join(' ')}\n`);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    // In production, this would use a proper logging service
    if (process.env.NODE_ENV !== 'test') {
      process.stderr.write(`[ERROR] ${message} ${args.join(' ')}\n`);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    // In production, this would use a proper logging service
    if (process.env.NODE_ENV !== 'test') {
      process.stdout.write(`[INFO] ${message} ${args.join(' ')}\n`);
    }
  }
};

/** SMS provider interface */
export interface ISMSProvider {
  /**
   * Send SMS message
   * @param options - SMS options
   * @param options.to - Phone number to send to
   * @param options.message - Message content
   * @returns Promise resolving to send result
   */
  sendSMS(options: { to: string; message: string }): Promise<{ success: boolean; messageId?: string }>;
}

/** Email provider interface */
export interface IEmailProvider {
  /**
   * Send email message
   * @param options - Email options
   * @param options.to - Email address to send to
   * @param options.subject - Email subject
   * @param options.html - HTML content
   * @returns Promise resolving to send result
   */
  sendEmail(options: { to: string; subject: string; html: string }): Promise<{ success: boolean; messageId?: string }>;
}

/** Secure storage service interface */
export interface ISecureStorageService {
  /**
   * Store a value securely
   * @param key - Storage key
   * @param value - Value to store
   * @returns Promise resolving when stored
   */
  store(key: string, value: string): Promise<void>;
  /**
   * Retrieve a stored value
   * @param key - Storage key
   * @returns Promise resolving to value or null if not found
   */
  retrieve(key: string): Promise<string | null>;
  /**
   * Delete a stored value
   * @param key - Storage key
   * @returns Promise resolving when deleted
   */
  delete(key: string): Promise<void>;
}

/** OTP storage data structure */
interface OTPData {
  code: string;
  attempts: number;
  expiresAt: number;
  createdAt: number;
}

/** Rate limit data structure */
interface RateLimitInfo {
  count: number;
  windowStart: number;
}
import { randomInt, createHash } from 'crypto';

/**
 * OTP delivery method
 */
export enum OTPDeliveryMethod {
  /** Send OTP via SMS */
  SMS = 'sms',
  /** Send OTP via Email */
  EMAIL = 'email'
}

/**
 * OTP verification request
 */
export interface OTPRequest {
  /** User identifier (email or phone) */
  identifier: string;
  /** Delivery method */
  method: OTPDeliveryMethod;
  /** Purpose of OTP (login, signup, recovery) */
  purpose: string;
  /** User's IP address for rate limiting */
  ipAddress?: string;
}

/**
 * OTP verification response
 */
export interface OTPResponse {
  /** Whether OTP was sent successfully */
  success: boolean;
  /** OTP session ID for verification */
  sessionId?: string;
  /** Error message if failed */
  error?: string;
  /** Remaining attempts before lockout */
  remainingAttempts?: number;
  /** Time until next OTP can be requested (seconds) */
  retryAfter?: number;
}

/**
 * OTP verification result
 */
export interface OTPVerificationResult {
  /** Whether OTP is valid */
  valid: boolean;
  /** User ID if verification successful */
  userId?: string;
  /** Error message if invalid */
  error?: string;
  /** Remaining verification attempts */
  remainingAttempts?: number;
}

/**
 * OTP session data stored in database
 */
interface OTPSession {
  /** Unique session ID */
  sessionId: string;
  /** User identifier */
  identifier: string;
  /** Hashed OTP code */
  otpHash: string;
  /** OTP purpose */
  purpose: string;
  /** Number of verification attempts */
  attempts: number;
  /** Session creation time */
  createdAt: Date;
  /** Session expiration time */
  expiresAt: Date;
  /** Whether OTP was verified */
  verified: boolean;
  /** User's IP address */
  ipAddress?: string;
}


/**
 * OTP service configuration
 */
interface OTPConfig {
  /** OTP code length (default: 6) */
  codeLength: number;
  /** OTP expiration in minutes (default: 5) */
  expirationMinutes: number;
  /** Maximum verification attempts (default: 3) */
  maxAttempts: number;
  /** Rate limit requests per hour (default: 5) */
  maxRequestsPerHour: number;
  /** Lockout duration in minutes after max attempts (default: 30) */
  lockoutMinutes: number;
}

/**
 * Service dependencies for dependency injection
 */
export interface OTPServiceDependencies {
  /** SMS provider instance */
  smsProvider?: ISMSProvider;
  /** Email provider instance */
  emailProvider?: IEmailProvider;
  /** Secure storage service instance */
  secureStorage?: ISecureStorageService;
}

/**
 * Service for handling OTP generation and verification
 */
export class OTPService {
  private smsProvider?: ISMSProvider;
  private emailProvider?: IEmailProvider;
  private secureStorage?: ISecureStorageService;
  private config: OTPConfig;
  private initialized = false;

  /**
   * Initialize OTP service with configuration
   * @param config Optional OTP configuration overrides
   * @param deps Optional service dependencies for testing
   */
  constructor(config?: Partial<OTPConfig>, deps?: OTPServiceDependencies) {
    this.config = {
      codeLength: config?.codeLength ?? 6,
      expirationMinutes: config?.expirationMinutes ?? 5,
      maxAttempts: config?.maxAttempts ?? 3,
      maxRequestsPerHour: config?.maxRequestsPerHour ?? 5,
      lockoutMinutes: config?.lockoutMinutes ?? 30
    };

    // Accept injected dependencies
    if (deps !== undefined) {
      this.smsProvider = deps.smsProvider;
      this.emailProvider = deps.emailProvider;
      this.secureStorage = deps.secureStorage;
    }
  }

  /**
   * Initialize the service and its dependencies
   * @returns Promise that resolves when initialization is complete
   */
  public init(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    try {
      // If no storage provider was injected, create a default in-memory one
      if (this.secureStorage === undefined) {
        this.secureStorage = new InMemorySecureStorage();
      }

      // If no providers were injected, log warnings
      if (this.smsProvider === undefined) {
        logger.warn('No SMS provider configured - SMS sending will be disabled');
      }
      if (this.emailProvider === undefined) {
        logger.warn('No email provider configured - Email sending will be disabled');
      }

      this.initialized = true;
      logger.info('OTP service initialized successfully');
      return Promise.resolve();
    } catch (error) {
      logger.error('Failed to initialize OTP service:', error);
      throw new Error('Failed to initialize OTP service');
    }
  }

  /**
   * Generate OTP with specific configuration
   * @param options - OTP generation options
   * @param options.userId - User identifier
   * @param options.purpose - Purpose of OTP generation
   * @returns Generated OTP data
   */
  public async generateOTP(options: { userId: string; purpose: string }): Promise<{ code: string; expiresAt: number }> {
    if (!this.initialized) {
      throw new Error('OTP service not initialized');
    }

    // Generate OTP code
    const code = this.generateOTPCode();
    const expiresAt = Date.now() + this.config.expirationMinutes * 60 * 1000;
    const otpKey = `otp:${options.userId}:${options.purpose}`;

    // Store OTP data
    const otpData: OTPData = {
      code,
      attempts: 0,
      expiresAt,
      createdAt: Date.now()
    };

    if (this.secureStorage !== undefined) {
      await this.secureStorage.store(otpKey, JSON.stringify(otpData));
    }

    return { code, expiresAt };
  }

  /**
   * Send OTP via specified method
   * @param options - Send options
   * @param options.userId - User identifier
   * @param options.purpose - Purpose of OTP
   * @param options.method - Delivery method (sms or email)
   * @param options.recipient - Phone number or email address
   */
  public async sendOTP(options: {
    userId: string;
    purpose: string;
    method: 'sms' | 'email';
    recipient: string
  }): Promise<void> {
    if (!this.initialized) {
      throw new Error('OTP service not initialized');
    }

    // Retrieve stored OTP
    const otpKey = `otp:${options.userId}:${options.purpose}`;
    const storedData = this.secureStorage !== undefined ?
      await this.secureStorage.retrieve(otpKey) : null;

    if (storedData === null) {
      throw new Error('No OTP found for user');
    }

    const otpData = JSON.parse(storedData) as OTPData;

    if (options.method === 'sms') {
      if (this.smsProvider === undefined) {
        throw new Error('SMS provider not configured');
      }
      const result = await this.smsProvider.sendSMS({
        to: options.recipient,
        message: `Your OmniBazaar verification code is: ${otpData.code}. This code expires in ${this.config.expirationMinutes} minutes.`
      });
      if (!result.success) {
        throw new Error('Failed to send OTP via sms');
      }
    } else if (options.method === 'email') {
      if (this.emailProvider === undefined) {
        throw new Error('Email provider not configured');
      }
      const html = `
        <div style="font-family: Arial, sans-serif;">
          <h2>Your OmniBazaar Verification Code</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 24px; font-weight: bold;">${otpData.code}</p>
          <p>This code expires in ${this.config.expirationMinutes} minutes.</p>
        </div>
      `;
      const result = await this.emailProvider.sendEmail({
        to: options.recipient,
        subject: 'Your OmniBazaar Verification Code',
        html
      });
      if (!result.success) {
        throw new Error('Failed to send OTP via email');
      }
    }
  }

  /**
   * Resend OTP code
   * @param options - Resend options
   * @param options.userId - User identifier
   * @param options.purpose - Purpose of OTP
   * @param options.method - Delivery method (sms or email)
   * @param options.recipient - Phone number or email address
   * @returns Resend result
   */
  public async resendOTP(options: {
    userId: string;
    purpose: string;
    method: 'sms' | 'email';
    recipient: string;
  }): Promise<{ newCode: boolean }> {
    if (!this.initialized) {
      throw new Error('OTP service not initialized');
    }

    // Check if existing OTP is still valid
    const otpKey = `otp:${options.userId}:${options.purpose}`;
    const storedData = this.secureStorage !== undefined ?
      await this.secureStorage.retrieve(otpKey) : null;

    let newCode = false;
    if (storedData !== null) {
      const otpData = JSON.parse(storedData) as OTPData;
      if (otpData.expiresAt < Date.now()) {
        // Generate new OTP if expired
        await this.generateOTP({ userId: options.userId, purpose: options.purpose });
        newCode = true;
      }
    } else {
      // Generate new OTP if none exists
      await this.generateOTP({ userId: options.userId, purpose: options.purpose });
      newCode = true;
    }

    // Send the OTP
    await this.sendOTP(options);

    return { newCode };
  }

  /**
   * Legacy sendOTP method for backward compatibility
   * @param request - OTP request details
   * @returns OTP response with session ID
   */
  public async legacySendOTP(request: OTPRequest): Promise<OTPResponse> {
    try {
      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(request.identifier);
      if (rateLimitCheck.allowed === false) {
        return {
          success: false,
          error: 'Too many OTP requests. Please try again later.',
          ...(rateLimitCheck.retryAfter !== undefined && { retryAfter: rateLimitCheck.retryAfter })
        } as OTPResponse;
      }

      // Generate OTP code
      const otpCode = this.generateOTPCode();
      const sessionId = this.generateSessionId();
      
      // Hash OTP for secure storage
      const otpHash = this.hashOTP(otpCode);
      
      // Store OTP session
      const expiresAt = new Date(Date.now() + this.config.expirationMinutes * 60 * 1000);
      await this.storeOTPSession({
        sessionId,
        identifier: request.identifier,
        otpHash,
        purpose: request.purpose,
        attempts: 0,
        createdAt: new Date(),
        expiresAt,
        verified: false,
        ...(request.ipAddress !== undefined && { ipAddress: request.ipAddress })
      } as OTPSession);

      // Send OTP based on delivery method
      const sent = await this.sendOTPCode(request, otpCode);
      
      if (!sent) {
        // Clean up session if sending failed
        await this.deleteOTPSession(sessionId);
        return {
          success: false,
          error: 'Failed to send OTP. Please check your contact information.'
        };
      }

      // Update rate limit
      await this.updateRateLimit(request.identifier);

      return {
        success: true,
        sessionId,
        remainingAttempts: this.config.maxAttempts
      };

    } catch (error) {
      logger.error('OTP generation failed:', error);
      return {
        success: false,
        error: 'Failed to generate OTP. Please try again.'
      };
    }
  }

  /**
   * Verify OTP code
   * @param sessionId - OTP session ID
   * @param code - OTP code to verify
   * @returns Verification result
   */
  public async verifyOTP(sessionId: string, code: string): Promise<OTPVerificationResult> {
    try {
      // Get OTP session
      const session = await this.getOTPSession(sessionId);
      
      if (session === null) {
        return {
          valid: false,
          error: 'Invalid or expired OTP session.'
        };
      }

      // Check if already verified
      if (session.verified) {
        return {
          valid: false,
          error: 'OTP has already been used.'
        };
      }

      // Check expiration
      if (new Date() > session.expiresAt) {
        await this.deleteOTPSession(sessionId);
        return {
          valid: false,
          error: 'OTP has expired. Please request a new one.'
        };
      }

      // Check attempts
      if (session.attempts >= this.config.maxAttempts) {
        this.lockoutIdentifier(session.identifier);
        await this.deleteOTPSession(sessionId);
        return {
          valid: false,
          error: 'Maximum verification attempts exceeded.',
          remainingAttempts: 0
        };
      }

      // Verify OTP
      const isValid = this.verifyOTPHash(code, session.otpHash);
      
      if (isValid) {
        // Mark as verified
        await this.markOTPAsVerified(sessionId);
        
        // Get or create user
        const userId = await this.getOrCreateUser(session.identifier, session.purpose);
        
        return {
          valid: true,
          userId
        };
      } else {
        // Increment attempts
        const newAttempts = session.attempts + 1;
        await this.incrementOTPAttempts(sessionId, newAttempts);
        
        const remainingAttempts = this.config.maxAttempts - newAttempts;
        
        if (remainingAttempts === 0) {
          this.lockoutIdentifier(session.identifier);
          await this.deleteOTPSession(sessionId);
        }
        
        return {
          valid: false,
          error: 'Invalid OTP code.',
          remainingAttempts
        };
      }

    } catch (error) {
      logger.error('OTP verification failed:', error);
      return {
        valid: false,
        error: 'Verification failed. Please try again.'
      };
    }
  }

  /**
   * Generate OTP code of configured length
   * @returns Randomly generated OTP code
   */
  private generateOTPCode(): string {
    const min = Math.pow(10, this.config.codeLength - 1);
    const max = Math.pow(10, this.config.codeLength) - 1;
    return randomInt(min, max).toString();
  }

  /**
   * Generate unique session ID
   * @returns Unique session identifier string
   */
  private generateSessionId(): string {
    return `otp_${Date.now()}_${randomInt(100000, 999999)}`;
  }

  /**
   * Hash OTP for secure storage
   * @param otp OTP code to hash
   * @returns SHA-256 hash of OTP with salt
   */
  private hashOTP(otp: string): string {
    return createHash('sha256')
      .update(otp + (process.env.OTP_SALT !== undefined && process.env.OTP_SALT !== '' ? process.env.OTP_SALT : 'default_salt'))
      .digest('hex');
  }

  /**
   * Verify OTP against hash
   * @param otp OTP code to verify
   * @param hash Stored hash to verify against
   * @returns True if OTP is valid, false otherwise
   */
  private verifyOTPHash(otp: string, hash: string): boolean {
    const otpHash = this.hashOTP(otp);
    return otpHash === hash;
  }

  /**
   * Send OTP code via specified method
   * @param request OTP request with delivery method
   * @param code Generated OTP code to send
   * @returns True if sending was successful, false otherwise
   */
  private async sendOTPCode(request: OTPRequest, code: string): Promise<boolean> {
    try {
      switch (request.method) {
        case OTPDeliveryMethod.SMS:
          return await this.sendSMSOTP(request.identifier, code, request.purpose);
        
        case OTPDeliveryMethod.EMAIL:
          return await this.sendEmailOTP(request.identifier, code, request.purpose);
        
        default:
          throw new Error(`Unsupported delivery method: ${request.method as string}`);
      }
    } catch (error) {
      logger.error('Failed to send OTP:', error);
      return false;
    }
  }

  /**
   * Send OTP via SMS
   * @param phone Phone number to send SMS to
   * @param code OTP code to include in SMS
   * @param purpose Purpose of the OTP for message context
   * @returns True if SMS was sent successfully, false otherwise
   */
  private async sendSMSOTP(phone: string, code: string, purpose: string): Promise<boolean> {
    if (this.smsProvider === undefined) {
      throw new Error('SMS provider not configured');
    }

    const message = `Your OmniBazaar ${purpose} code is: ${code}\n\nThis code expires in ${this.config.expirationMinutes} minutes.`;

    const result = await this.smsProvider.sendSMS({
      to: phone,
      message
    });
    
    return result.success;
  }

  /**
   * Send OTP via email
   * @param email Email address to send to
   * @param code OTP code to include in email
   * @param purpose Purpose of the OTP for email content
   * @returns True if email was sent successfully, false otherwise
   */
  private async sendEmailOTP(email: string, code: string, purpose: string): Promise<boolean> {
    if (this.emailProvider === undefined) {
      throw new Error('Email provider not configured');
    }

    const capitalizedPurpose = purpose.charAt(0).toUpperCase() + purpose.slice(1);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>OmniBazaar ${capitalizedPurpose} Verification</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p>This code will expire in ${this.config.expirationMinutes} minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message from OmniBazaar. Please do not reply to this email.
        </p>
      </div>
    `;
    
    const result = await this.emailProvider.sendEmail({
      to: email,
      subject: `OmniBazaar ${capitalizedPurpose} Code: ${code}`,
      html
    });
    
    return result.success;
  }

  /**
   * Verify OTP code
   * @param options - Verification options
   * @param options.userId - User identifier
   * @param options.purpose - Purpose of OTP
   * @param options.code - OTP code to verify
   * @returns Verification result
   */
  public async verifyOTPWithOptions(options: {
    userId: string;
    purpose: string;
    code: string;
  }): Promise<{ valid: boolean; message: string }> {
    if (!this.initialized) {
      throw new Error('OTP service not initialized');
    }

    const otpKey = `otp:${options.userId}:${options.purpose}`;
    const storedData = this.secureStorage !== undefined ?
      await this.secureStorage.retrieve(otpKey) : null;

    if (storedData === null) {
      return { valid: false, message: 'No OTP found for user' };
    }

    const otpData = JSON.parse(storedData) as OTPData;

    // Check expiration
    if (otpData.expiresAt < Date.now()) {
      if (this.secureStorage !== undefined) {
        await this.secureStorage.delete(otpKey);
      }
      return { valid: false, message: 'OTP has expired' };
    }

    // Check attempts
    if (otpData.attempts >= this.config.maxAttempts) {
      return { valid: false, message: 'Maximum attempts exceeded' };
    }

    // Verify code
    if (otpData.code !== options.code) {
      // Increment attempts
      otpData.attempts++;
      if (this.secureStorage !== undefined) {
        await this.secureStorage.store(otpKey, JSON.stringify(otpData));
      }
      return { valid: false, message: 'Invalid OTP code' };
    }

    // Success - delete OTP
    if (this.secureStorage !== undefined) {
      await this.secureStorage.delete(otpKey);
    }

    return { valid: true, message: 'OTP verified successfully' };
  }

  /**
   * Clean up expired OTPs
   */
  public cleanupExpiredOTPs(): void {
    // In a real implementation, this would iterate through stored OTPs
    // and delete expired ones. For now, this is a no-op.
    logger.info('Cleanup expired OTPs called');
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.initialized = false;
    logger.info('OTP service cleaned up');
  }

  /**
   * Check rate limiting for identifier
   * @param identifier User identifier to check rate limits for
   * @returns Object indicating if request is allowed and retry time if not
   */
  private async checkRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    if (this.secureStorage === undefined) {
      return { allowed: true };
    }

    const rateLimitKey = `rate_limit:${identifier}`;
    const storedData = await this.secureStorage.retrieve(rateLimitKey);

    if (storedData === null) {
      // No rate limit data, allow request
      await this.updateRateLimit(identifier);
      return { allowed: true };
    }

    const rateLimit = JSON.parse(storedData) as RateLimitInfo;
    const hourAgo = Date.now() - 60 * 60 * 1000;

    // Check if window has expired
    if (rateLimit.windowStart < hourAgo) {
      // Reset window
      await this.updateRateLimit(identifier);
      return { allowed: true };
    }

    // Check request count
    if (rateLimit.count >= this.config.maxRequestsPerHour) {
      const retryAfter = Math.ceil((rateLimit.windowStart + 60 * 60 * 1000 - Date.now()) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  /**
   * Update rate limit for identifier
   * @param identifier User identifier to update rate limits for
   */
  private async updateRateLimit(identifier: string): Promise<void> {
    if (this.secureStorage === undefined) {
      return;
    }

    const rateLimitKey = `rate_limit:${identifier}`;
    const storedData = await this.secureStorage.retrieve(rateLimitKey);
    const hourAgo = Date.now() - 60 * 60 * 1000;

    let rateLimit: RateLimitInfo;
    if (storedData === null) {
      rateLimit = { count: 1, windowStart: Date.now() };
    } else {
      const existing = JSON.parse(storedData) as RateLimitInfo;
      if (existing.windowStart < hourAgo) {
        // Reset window
        rateLimit = { count: 1, windowStart: Date.now() };
      } else {
        // Increment count
        rateLimit = { count: existing.count + 1, windowStart: existing.windowStart };
      }
    }

    await this.secureStorage.store(rateLimitKey, JSON.stringify(rateLimit));
  }

  /**
   * Lock out identifier after max attempts
   * @param identifier User identifier to lock out
   */
  private lockoutIdentifier(identifier: string): void {
    const lockedUntil = new Date(Date.now() + this.config.lockoutMinutes * 60 * 1000);
    logger.warn(`Locking out identifier ${identifier} until ${lockedUntil.toISOString()}`);
  }

  /**
   * Store OTP session in storage
   * @param session OTP session data to store
   */
  private async storeOTPSession(session: OTPSession): Promise<void> {
    if (this.secureStorage === undefined) {
      throw new Error('Secure storage not available');
    }

    const sessionKey = `otp_session:${session.sessionId}`;
    await this.secureStorage.store(sessionKey, JSON.stringify(session));
  }

  /**
   * Get OTP session from storage
   * @param sessionId Session ID to retrieve
   * @returns OTP session data or null if not found
   */
  private async getOTPSession(sessionId: string): Promise<OTPSession | null> {
    if (this.secureStorage === undefined) {
      return null;
    }

    const sessionKey = `otp_session:${sessionId}`;
    const storedData = await this.secureStorage.retrieve(sessionKey);

    if (storedData === null) {
      return null;
    }

    return JSON.parse(storedData) as OTPSession;
  }

  /**
   * Delete OTP session
   * @param sessionId Session ID to delete
   */
  private async deleteOTPSession(sessionId: string): Promise<void> {
    if (this.secureStorage === undefined) {
      return;
    }

    const sessionKey = `otp_session:${sessionId}`;
    await this.secureStorage.delete(sessionKey);
  }

  /**
   * Mark OTP as verified
   * @param sessionId Session ID to mark as verified
   */
  private async markOTPAsVerified(sessionId: string): Promise<void> {
    const session = await this.getOTPSession(sessionId);
    if (session !== null) {
      session.verified = true;
      await this.storeOTPSession(session);
    }
  }

  /**
   * Increment OTP verification attempts
   * @param sessionId Session ID to update
   * @param attempts New attempt count
   */
  private async incrementOTPAttempts(sessionId: string, attempts: number): Promise<void> {
    const session = await this.getOTPSession(sessionId);
    if (session !== null) {
      session.attempts = attempts;
      await this.storeOTPSession(session);
    }
  }

  /**
   * Get or create user based on identifier
   * @param identifier Email or phone number
   * @param purpose OTP purpose context
   * @returns User ID string
   */
  private getOrCreateUser(identifier: string, purpose: string): Promise<string> {
    // This would integrate with your user management system
    // For now, return a placeholder
    return Promise.resolve(`user_${identifier}_${purpose}`);
  }

  /**
   * Clean up expired OTP sessions (should be called periodically)
   */
  public cleanupExpiredSessions(): void {
    // In a real implementation with database, this would delete expired sessions
    logger.info('Cleanup expired sessions called');
  }
}

/**
 * In-memory implementation of secure storage for testing
 */
class InMemorySecureStorage implements ISecureStorageService {
  private storage = new Map<string, string>();

  store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  retrieve(key: string): Promise<string | null> {
    return Promise.resolve(this.storage.get(key) ?? null);
  }

  delete(key: string): Promise<void> {
    this.storage.delete(key);
    return Promise.resolve();
  }
}