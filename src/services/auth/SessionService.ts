/**
 * Session Management Service
 * 
 * Manages user sessions with JWT tokens, distributed cache, device fingerprinting,
 * and secure session storage in YugabyteDB.
 */

import { CacheService } from '../../../../../Validator/src/services/CacheService';
import { SecureStorageService } from '../../../../../Validator/src/services/SecureStorageService';
import { Database } from '../../../../../Validator/src/database/Database';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

/**
 * Session token types
 */
export enum TokenType {
  /** Access token for API requests */
  ACCESS = 'access',
  /** Refresh token for obtaining new access tokens */
  REFRESH = 'refresh'
}

/**
 * JWT token payload
 */
export interface TokenPayload {
  /** Subject (user ID) */
  sub: string;
  /** Session ID */
  sid: string;
  /** Token type */
  typ: TokenType;
  /** Device fingerprint hash */
  dfp?: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * User session data
 */
export interface Session {
  /** Unique session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Device fingerprint */
  deviceFingerprint: string;
  /** User agent string */
  userAgent: string;
  /** IP address */
  ipAddress: string;
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
  /** Access token expiration */
  accessTokenExpiresAt: Date;
  /** Refresh token expiration */
  refreshTokenExpiresAt: Date;
  /** Whether session is active */
  isActive: boolean;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session creation options
 */
export interface SessionOptions {
  /** User ID */
  userId: string;
  /** Device fingerprint */
  deviceFingerprint: string;
  /** User agent */
  userAgent: string;
  /** IP address */
  ipAddress: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Token generation result
 */
export interface TokenPair {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** Access token expiration timestamp */
  accessTokenExpiresAt: number;
  /** Refresh token expiration timestamp */
  refreshTokenExpiresAt: number;
}

/**
 * Session validation result
 */
export interface SessionValidation {
  /** Whether session is valid */
  valid: boolean;
  /** Session data if valid */
  session?: Session;
  /** User ID if valid */
  userId?: string;
  /** Error message if invalid */
  error?: string;
}

/**
 * Device fingerprint components
 */
export interface DeviceFingerprintData {
  /** User agent string */
  userAgent: string;
  /** Screen resolution */
  screenResolution?: string;
  /** Timezone offset */
  timezoneOffset?: number;
  /** Language preferences */
  languages?: string[];
  /** Platform information */
  platform?: string;
  /** Canvas fingerprint */
  canvasFingerprint?: string;
  /** WebGL vendor/renderer */
  webglInfo?: string;
  /** Audio context fingerprint */
  audioFingerprint?: string;
}

/**
 * Session management configuration
 */
interface SessionConfig {
  /** Access token lifetime in seconds (default: 24 hours) */
  accessTokenLifetime: number;
  /** Refresh token lifetime in seconds (default: 7 days) */
  refreshTokenLifetime: number;
  /** Maximum sessions per user (default: 5) */
  maxSessionsPerUser: number;
  /** Session idle timeout in seconds (default: 1 hour) */
  idleTimeout: number;
  /** JWT signing secret */
  jwtSecret: string;
}

/**
 * Service for managing user sessions
 */
export class SessionService {
  private cache: CacheService;
  private secureStorage: SecureStorageService;
  private db: Database;
  private config: SessionConfig;

  constructor(config?: Partial<SessionConfig>) {
    this.cache = new CacheService();
    this.secureStorage = new SecureStorageService();
    this.db = new Database();
    
    this.config = {
      accessTokenLifetime: config?.accessTokenLifetime ?? 24 * 60 * 60, // 24 hours
      refreshTokenLifetime: config?.refreshTokenLifetime ?? 7 * 24 * 60 * 60, // 7 days
      maxSessionsPerUser: config?.maxSessionsPerUser ?? 5,
      idleTimeout: config?.idleTimeout ?? 60 * 60, // 1 hour
      jwtSecret: config?.jwtSecret || process.env.JWT_SECRET || this.generateSecret()
    };
  }

  /**
   * Create a new user session
   * @param options - Session creation options
   * @returns Token pair and session ID
   */
  public async createSession(options: SessionOptions): Promise<TokenPair & { sessionId: string }> {
    // Check session limit
    await this.enforceSessionLimit(options.userId);
    
    // Generate session ID
    const sessionId = this.generateSessionId();
    
    // Generate device fingerprint hash
    const fingerprintHash = this.hashDeviceFingerprint(options.deviceFingerprint);
    
    // Generate tokens
    const tokens = this.generateTokenPair(options.userId, sessionId, fingerprintHash);
    
    // Create session object
    const session: Session = {
      id: sessionId,
      userId: options.userId,
      deviceFingerprint: fingerprintHash,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      accessTokenExpiresAt: new Date(tokens.accessTokenExpiresAt * 1000),
      refreshTokenExpiresAt: new Date(tokens.refreshTokenExpiresAt * 1000),
      isActive: true,
      metadata: options.metadata
    };
    
    // Store session in database
    await this.storeSession(session);
    
    // Cache session for quick access
    await this.cacheSession(session);
    
    return {
      ...tokens,
      sessionId
    };
  }

  /**
   * Validate access token and return session info
   * @param token - JWT access token
   * @param deviceFingerprint - Current device fingerprint
   * @returns Session validation result
   */
  public async validateAccessToken(
    token: string,
    deviceFingerprint?: string
  ): Promise<SessionValidation> {
    try {
      // Verify JWT
      const payload = jwt.verify(token, this.config.jwtSecret) as TokenPayload;
      
      // Check token type
      if (payload.typ !== TokenType.ACCESS) {
        return {
          valid: false,
          error: 'Invalid token type'
        };
      }
      
      // Get session from cache first
      let session = await this.getCachedSession(payload.sid);
      
      // If not in cache, get from database
      if (!session) {
        session = await this.getSession(payload.sid);
        if (session) {
          await this.cacheSession(session);
        }
      }
      
      if (!session) {
        return {
          valid: false,
          error: 'Session not found'
        };
      }
      
      // Check if session is active
      if (!session.isActive) {
        return {
          valid: false,
          error: 'Session is inactive'
        };
      }
      
      // Verify device fingerprint if provided
      if (deviceFingerprint && payload.dfp) {
        const currentFingerprintHash = this.hashDeviceFingerprint(deviceFingerprint);
        if (currentFingerprintHash !== payload.dfp) {
          // Log potential security issue
          await this.logSecurityEvent(session.userId, 'device_fingerprint_mismatch', {
            sessionId: session.id,
            expectedFingerprint: payload.dfp,
            actualFingerprint: currentFingerprintHash
          });
          
          return {
            valid: false,
            error: 'Device fingerprint mismatch'
          };
        }
      }
      
      // Check idle timeout
      const idleTime = Date.now() - session.lastActivityAt.getTime();
      if (idleTime > this.config.idleTimeout * 1000) {
        await this.invalidateSession(session.id);
        return {
          valid: false,
          error: 'Session expired due to inactivity'
        };
      }
      
      // Update last activity
      await this.updateLastActivity(session.id);
      
      return {
        valid: true,
        session,
        userId: payload.sub
      };
      
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Access token expired'
        };
      }
      
      return {
        valid: false,
        error: 'Invalid access token'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - JWT refresh token
   * @param deviceFingerprint - Current device fingerprint
   * @returns New token pair or null
   */
  public async refreshTokens(
    refreshToken: string,
    deviceFingerprint?: string
  ): Promise<TokenPair | null> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.config.jwtSecret) as TokenPayload;
      
      // Check token type
      if (payload.typ !== TokenType.REFRESH) {
        return null;
      }
      
      // Get session
      const session = await this.getSession(payload.sid);
      if (!session || !session.isActive) {
        return null;
      }
      
      // Verify device fingerprint if provided
      if (deviceFingerprint && payload.dfp) {
        const currentFingerprintHash = this.hashDeviceFingerprint(deviceFingerprint);
        if (currentFingerprintHash !== payload.dfp) {
          await this.logSecurityEvent(session.userId, 'refresh_fingerprint_mismatch', {
            sessionId: session.id
          });
          return null;
        }
      }
      
      // Generate new token pair
      const tokens = this.generateTokenPair(
        session.userId, 
        session.id, 
        session.deviceFingerprint
      );
      
      // Update session expiration
      await this.updateSessionExpiration(
        session.id,
        new Date(tokens.accessTokenExpiresAt * 1000),
        new Date(tokens.refreshTokenExpiresAt * 1000)
      );
      
      return tokens;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Invalidate a session
   * @param sessionId - Session ID to invalidate
   */
  public async invalidateSession(sessionId: string): Promise<void> {
    // Update database
    const query = `
      UPDATE user_sessions 
      SET is_active = false, updated_at = $1
      WHERE id = $2
    `;
    
    await this.db.query(query, [new Date(), sessionId]);
    
    // Remove from cache
    await this.cache.delete(`session:${sessionId}`);
  }

  /**
   * Invalidate all sessions for a user
   * @param userId - User ID
   */
  public async invalidateAllUserSessions(userId: string): Promise<void> {
    // Get all active sessions
    const sessions = await this.getUserSessions(userId);
    
    // Invalidate each session
    for (const session of sessions) {
      await this.invalidateSession(session.id);
    }
  }

  /**
   * Get all active sessions for a user
   * @param userId - User ID
   * @returns List of active sessions
   */
  public async getUserSessions(userId: string): Promise<Session[]> {
    const query = `
      SELECT * FROM user_sessions 
      WHERE user_id = $1 AND is_active = true
      ORDER BY last_activity_at DESC
    `;
    
    const result = await this.db.query(query, [userId]);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      deviceFingerprint: row.device_fingerprint,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      accessTokenExpiresAt: row.access_token_expires_at,
      refreshTokenExpiresAt: row.refresh_token_expires_at,
      isActive: row.is_active,
      metadata: row.metadata
    }));
  }

  /**
   * Generate device fingerprint from components
   * @param data - Device fingerprint data
   * @returns Device fingerprint string
   */
  public generateDeviceFingerprint(data: DeviceFingerprintData): string {
    // Combine all components
    const components = [
      data.userAgent,
      data.screenResolution || '',
      data.timezoneOffset?.toString() || '',
      (data.languages || []).join(','),
      data.platform || '',
      data.canvasFingerprint || '',
      data.webglInfo || '',
      data.audioFingerprint || ''
    ];
    
    // Create hash
    return createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Generate JWT token pair
   * @param userId - User ID
   * @param sessionId - Session ID
   * @param fingerprintHash - Device fingerprint hash
   * @returns Token pair
   */
  private generateTokenPair(
    userId: string, 
    sessionId: string, 
    fingerprintHash: string
  ): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    
    // Generate access token
    const accessTokenPayload: TokenPayload = {
      sub: userId,
      sid: sessionId,
      typ: TokenType.ACCESS,
      dfp: fingerprintHash,
      iat: now,
      exp: now + this.config.accessTokenLifetime
    };
    
    const accessToken = jwt.sign(accessTokenPayload, this.config.jwtSecret);
    
    // Generate refresh token
    const refreshTokenPayload: TokenPayload = {
      sub: userId,
      sid: sessionId,
      typ: TokenType.REFRESH,
      dfp: fingerprintHash,
      iat: now,
      exp: now + this.config.refreshTokenLifetime
    };
    
    const refreshToken = jwt.sign(refreshTokenPayload, this.config.jwtSecret);
    
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessTokenPayload.exp,
      refreshTokenExpiresAt: refreshTokenPayload.exp
    };
  }

  /**
   * Generate unique session ID
   * @returns Session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate JWT secret if not provided
   * @returns JWT secret
   */
  private generateSecret(): string {
    return randomBytes(64).toString('hex');
  }

  /**
   * Hash device fingerprint
   * @param fingerprint - Device fingerprint
   * @returns Hashed fingerprint
   */
  private hashDeviceFingerprint(fingerprint: string): string {
    return createHash('sha256')
      .update(fingerprint + (process.env.FINGERPRINT_SALT || 'default_salt'))
      .digest('hex');
  }

  /**
   * Store session in database
   * @param session - Session to store
   */
  private async storeSession(session: Session): Promise<void> {
    const query = `
      INSERT INTO user_sessions (
        id, user_id, device_fingerprint, user_agent, ip_address,
        created_at, last_activity_at, access_token_expires_at,
        refresh_token_expires_at, is_active, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    
    await this.db.query(query, [
      session.id,
      session.userId,
      session.deviceFingerprint,
      session.userAgent,
      session.ipAddress,
      session.createdAt,
      session.lastActivityAt,
      session.accessTokenExpiresAt,
      session.refreshTokenExpiresAt,
      session.isActive,
      JSON.stringify(session.metadata || {})
    ]);
  }

  /**
   * Get session from database
   * @param sessionId - Session ID
   * @returns Session or null
   */
  private async getSession(sessionId: string): Promise<Session | null> {
    const query = `
      SELECT * FROM user_sessions 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [sessionId]);
    
    if (!result.rows[0]) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      userId: row.user_id,
      deviceFingerprint: row.device_fingerprint,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      accessTokenExpiresAt: row.access_token_expires_at,
      refreshTokenExpiresAt: row.refresh_token_expires_at,
      isActive: row.is_active,
      metadata: row.metadata
    };
  }

  /**
   * Cache session for quick access
   * @param session - Session to cache
   */
  private async cacheSession(session: Session): Promise<void> {
    const ttl = Math.floor(
      (session.accessTokenExpiresAt.getTime() - Date.now()) / 1000
    );
    
    if (ttl > 0) {
      await this.cache.set(
        `session:${session.id}`,
        JSON.stringify(session),
        ttl
      );
    }
  }

  /**
   * Get session from cache
   * @param sessionId - Session ID
   * @returns Session or null
   */
  private async getCachedSession(sessionId: string): Promise<Session | null> {
    const cached = await this.cache.get(`session:${sessionId}`);
    
    if (!cached) {
      return null;
    }
    
    const session = JSON.parse(cached) as Session;
    
    // Convert date strings back to Date objects
    session.createdAt = new Date(session.createdAt);
    session.lastActivityAt = new Date(session.lastActivityAt);
    session.accessTokenExpiresAt = new Date(session.accessTokenExpiresAt);
    session.refreshTokenExpiresAt = new Date(session.refreshTokenExpiresAt);
    
    return session;
  }

  /**
   * Update last activity timestamp
   * @param sessionId - Session ID
   */
  private async updateLastActivity(sessionId: string): Promise<void> {
    const now = new Date();
    
    // Update database
    const query = `
      UPDATE user_sessions 
      SET last_activity_at = $1
      WHERE id = $2
    `;
    
    await this.db.query(query, [now, sessionId]);
    
    // Update cache
    const session = await this.getCachedSession(sessionId);
    if (session) {
      session.lastActivityAt = now;
      await this.cacheSession(session);
    }
  }

  /**
   * Update session token expiration
   * @param sessionId - Session ID
   * @param accessTokenExpiresAt - New access token expiration
   * @param refreshTokenExpiresAt - New refresh token expiration
   */
  private async updateSessionExpiration(
    sessionId: string,
    accessTokenExpiresAt: Date,
    refreshTokenExpiresAt: Date
  ): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET access_token_expires_at = $1,
          refresh_token_expires_at = $2,
          last_activity_at = $3
      WHERE id = $4
    `;
    
    await this.db.query(query, [
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      new Date(),
      sessionId
    ]);
  }

  /**
   * Enforce maximum sessions per user
   * @param userId - User ID
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    if (sessions.length >= this.config.maxSessionsPerUser) {
      // Invalidate oldest sessions
      const sessionsToInvalidate = sessions
        .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
        .slice(0, sessions.length - this.config.maxSessionsPerUser + 1);
      
      for (const session of sessionsToInvalidate) {
        await this.invalidateSession(session.id);
      }
    }
  }

  /**
   * Log security event
   * @param userId - User ID
   * @param eventType - Type of security event
   * @param details - Event details
   */
  private async logSecurityEvent(
    userId: string,
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const query = `
      INSERT INTO security_events (
        user_id, event_type, details, created_at
      ) VALUES ($1, $2, $3, $4)
    `;
    
    await this.db.query(query, [
      userId,
      eventType,
      JSON.stringify(details),
      new Date()
    ]);
  }

  /**
   * Clean up expired sessions (should be called periodically)
   */
  public async cleanupExpiredSessions(): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET is_active = false
      WHERE is_active = true 
        AND refresh_token_expires_at < $1
    `;
    
    await this.db.query(query, [new Date()]);
  }
}