/**
 * OTP Verification Service
 * 
 * Handles generation, sending, and verification of one-time passwords for
 * email and SMS authentication with rate limiting and security features.
 */

// Note: In production, these would be imported from the Validator module
// For now, using local interfaces to avoid import errors

/**
 * Logger instance for consistent logging across OTP service
 */
interface Logger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const logger: Logger = {
  warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => console.error(message, ...args)
};

/** SMS provider interface */
interface ISMSProvider {
  sendSMS(options: { to: string; message: string }): Promise<{ success: boolean }>;
}

/** Email provider interface */
interface IEmailProvider {
  sendEmail(options: { to: string; subject: string; html: string }): Promise<{ success: boolean }>;
}

/** Secure storage service interface */
interface ISecureStorageService {
  store(key: string, value: string): Promise<void>;
  retrieve(key: string): Promise<string | null>;
}

/** Database query result interface */
interface QueryResult {
  rows: Record<string, unknown>[];
}

/** Database interface */
interface IDatabase {
  query(sql: string, params: unknown[]): Promise<QueryResult>;
}

/** Mock SMS provider */
class MockSMSProvider implements ISMSProvider {
  sendSMS(options: { to: string; message: string }): Promise<{ success: boolean }> {
    logger.warn('Mock SMS:', { to: options.to, message: options.message });
    return Promise.resolve({ success: true });
  }
}

/** Mock email provider */
class MockEmailProvider implements IEmailProvider {
  sendEmail(options: { to: string; subject: string; html: string }): Promise<{ success: boolean }> {
    logger.warn('Mock Email:', { to: options.to, subject: options.subject });
    return Promise.resolve({ success: true });
  }
}

/** Mock secure storage service */
class MockSecureStorageService implements ISecureStorageService {
  private storage = new Map<string, string>();

  store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  retrieve(key: string): Promise<string | null> {
    return Promise.resolve(this.storage.get(key) ?? null);
  }
}

/** Mock database implementation */
class MockDatabase implements IDatabase {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();

  query(sql: string, params: unknown[]): Promise<QueryResult> {
    // Mock database queries - in production would use actual database
    logger.warn('Mock DB Query:', { sql, params });
    return Promise.resolve({ rows: [] });
  }
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
 * Rate limit data for OTP requests
 */
interface RateLimitData {
  /** Identifier being rate limited */
  identifier: string;
  /** Number of requests in current window */
  requests: number;
  /** Window start time */
  windowStart: Date;
  /** Time when identifier is locked out */
  lockedUntil?: Date;
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
 * Service for handling OTP generation and verification
 */
export class OTPService {
  private smsProvider: ISMSProvider;
  private emailProvider: IEmailProvider;
  private secureStorage: ISecureStorageService;
  private db: IDatabase;
  private config: OTPConfig;

  /**
   * Initialize OTP service with configuration
   * @param config Optional OTP configuration overrides
   */
  constructor(config?: Partial<OTPConfig>) {
    this.smsProvider = new MockSMSProvider();
    this.emailProvider = new MockEmailProvider();
    this.secureStorage = new MockSecureStorageService();
    this.db = new MockDatabase();
    
    this.config = {
      codeLength: config?.codeLength ?? 6,
      expirationMinutes: config?.expirationMinutes ?? 5,
      maxAttempts: config?.maxAttempts ?? 3,
      maxRequestsPerHour: config?.maxRequestsPerHour ?? 5,
      lockoutMinutes: config?.lockoutMinutes ?? 30
    };
  }

  /**
   * Generate and send OTP code
   * @param request - OTP request details
   * @returns OTP response with session ID
   */
  public async sendOTP(request: OTPRequest): Promise<OTPResponse> {
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
      
      if (!session) {
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
        await this.lockoutIdentifier(session.identifier);
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
          await this.lockoutIdentifier(session.identifier);
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
      .update(otp + process.env.OTP_SALT || 'default_salt')
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
   * Check rate limiting for identifier
   * @param identifier User identifier to check rate limits for
   * @returns Object indicating if request is allowed and retry time if not
   */
  private async checkRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const query = `
      SELECT * FROM otp_rate_limits 
      WHERE identifier = $1
    `;
    
    const result = await this.db.query(query, [identifier]);
    
    if (result.rows[0] === undefined) {
      return { allowed: true };
    }
    
    const rateLimit = result.rows[0] as unknown as RateLimitData;
    
    // Check if locked out
    if (rateLimit.lockedUntil && new Date() < rateLimit.lockedUntil) {
      const retryAfter = Math.ceil((rateLimit.lockedUntil.getTime() - Date.now()) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Check rate limit window (1 hour)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (rateLimit.windowStart < hourAgo) {
      // Reset window
      return { allowed: true };
    }
    
    // Check request count
    if (rateLimit.requests >= this.config.maxRequestsPerHour) {
      const retryAfter = Math.ceil((rateLimit.windowStart.getTime() + 60 * 60 * 1000 - Date.now()) / 1000);
      return { allowed: false, retryAfter };
    }
    
    return { allowed: true };
  }

  /**
   * Update rate limit for identifier
   * @param identifier User identifier to update rate limits for
   */
  private async updateRateLimit(identifier: string): Promise<void> {
    const query = `
      INSERT INTO otp_rate_limits (identifier, requests, window_start)
      VALUES ($1, 1, $2)
      ON CONFLICT (identifier) DO UPDATE SET
        requests = CASE 
          WHEN otp_rate_limits.window_start < $3 THEN 1
          ELSE otp_rate_limits.requests + 1
        END,
        window_start = CASE
          WHEN otp_rate_limits.window_start < $3 THEN $2
          ELSE otp_rate_limits.window_start
        END
    `;
    
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    await this.db.query(query, [identifier, now, hourAgo]);
  }

  /**
   * Lock out identifier after max attempts
   * @param identifier User identifier to lock out
   */
  private async lockoutIdentifier(identifier: string): Promise<void> {
    const lockedUntil = new Date(Date.now() + this.config.lockoutMinutes * 60 * 1000);
    
    const query = `
      UPDATE otp_rate_limits 
      SET locked_until = $1
      WHERE identifier = $2
    `;
    
    await this.db.query(query, [lockedUntil, identifier]);
  }

  /**
   * Store OTP session in database
   * @param session OTP session data to store
   */
  private async storeOTPSession(session: OTPSession): Promise<void> {
    const query = `
      INSERT INTO otp_sessions (
        session_id, identifier, otp_hash, purpose, attempts,
        created_at, expires_at, verified, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await this.db.query(query, [
      session.sessionId,
      session.identifier,
      session.otpHash,
      session.purpose,
      session.attempts,
      session.createdAt,
      session.expiresAt,
      session.verified,
      session.ipAddress
    ]);
  }

  /**
   * Get OTP session from database
   * @param sessionId Session ID to retrieve
   * @returns OTP session data or null if not found
   */
  private async getOTPSession(sessionId: string): Promise<OTPSession | null> {
    const query = `
      SELECT * FROM otp_sessions 
      WHERE session_id = $1
    `;
    
    const result = await this.db.query(query, [sessionId]);
    
    if (result.rows[0] === undefined) {
      return null;
    }
    
    return result.rows[0] as unknown as OTPSession;
  }

  /**
   * Delete OTP session
   * @param sessionId Session ID to delete
   */
  private async deleteOTPSession(sessionId: string): Promise<void> {
    const query = `
      DELETE FROM otp_sessions 
      WHERE session_id = $1
    `;
    
    await this.db.query(query, [sessionId]);
  }

  /**
   * Mark OTP as verified
   * @param sessionId Session ID to mark as verified
   */
  private async markOTPAsVerified(sessionId: string): Promise<void> {
    const query = `
      UPDATE otp_sessions 
      SET verified = true
      WHERE session_id = $1
    `;
    
    await this.db.query(query, [sessionId]);
  }

  /**
   * Increment OTP verification attempts
   * @param sessionId Session ID to update
   * @param attempts New attempt count
   */
  private async incrementOTPAttempts(sessionId: string, attempts: number): Promise<void> {
    const query = `
      UPDATE otp_sessions 
      SET attempts = $1
      WHERE session_id = $2
    `;
    
    await this.db.query(query, [attempts, sessionId]);
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
  public async cleanupExpiredSessions(): Promise<void> {
    const query = `
      DELETE FROM otp_sessions 
      WHERE expires_at < $1
    `;
    
    await this.db.query(query, [new Date()]);
  }
}