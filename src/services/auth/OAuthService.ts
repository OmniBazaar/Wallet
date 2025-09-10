/**
 * OAuth Provider Service
 * 
 * Handles OAuth2 authentication flow for Google, Twitter, and GitHub.
 * Manages user sessions in YugabyteDB and generates MPC key shards.
 */

// Note: In production, these would be imported from the Validator module
// For now, using local interfaces to avoid import errors

/** Email provider interface for sending emails */
interface IEmailProvider {
  sendEmail(options: { to: string; subject: string; html: string }): Promise<void>;
}

/** SMS provider interface for sending SMS messages */
interface ISMSProvider {
  sendSMS(to: string, message: string): Promise<void>;
}

/** User registry database interface */
interface IUserRegistryDatabase {
  getUserByOAuth(provider: string, oauthId: string): Promise<{ id: string; email?: string } | null>;
  updateUser(userId: string, updates: Record<string, unknown>): Promise<void>;
  createUser(userData: Record<string, unknown>): Promise<string>;
  getUser(userId: string): Promise<{ email?: string } | null>;
  createSession(sessionData: Record<string, unknown>): Promise<void>;
  getSession(sessionId: string): Promise<{ refreshToken: string; provider: string } | null>;
  deleteSession(sessionId: string): Promise<void>;
}

/** Secure storage service interface */
interface ISecureStorageService {
  storeEncrypted(key: string, value: string): Promise<void>;
  storeEncryptedWithKey(key: string, value: string, encryptionKey: string): Promise<void>;
}

/** Mock email provider implementation */
class MockEmailProvider implements IEmailProvider {
  sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    // Remove console.log per linting rules
    // In production, this would send actual email
    void options; // Acknowledge parameter
    return Promise.resolve();
  }
}

/** Mock SMS provider implementation */
class MockSMSProvider implements ISMSProvider {
  sendSMS(to: string, message: string): Promise<void> {
    // Remove console.log per linting rules
    // In production, this would send actual SMS
    void to; // Acknowledge parameter
    void message; // Acknowledge parameter
    return Promise.resolve();
  }
}

/** Mock user registry database implementation */
class MockUserRegistryDatabase implements IUserRegistryDatabase {
  private users = new Map<string, Record<string, unknown>>();
  private sessions = new Map<string, Record<string, unknown>>();

  getUserByOAuth(_provider: string, _oauthId: string): Promise<{ id: string; email?: string } | null> {
    // Mock implementation - in production would query actual database
    return Promise.resolve(null);
  }

  updateUser(userId: string, updates: Record<string, unknown>): Promise<void> {
    const user = this.users.get(userId);
    if (user != null) {
      Object.assign(user, updates);
    }
    return Promise.resolve();
  }

  createUser(userData: Record<string, unknown>): Promise<string> {
    const userId = `user_${Date.now()}`;
    this.users.set(userId, userData);
    return Promise.resolve(userId);
  }

  getUser(userId: string): Promise<{ email?: string } | null> {
    const user = this.users.get(userId);
    return Promise.resolve(user != null ? { email: user.email as string } : null);
  }

  createSession(sessionData: Record<string, unknown>): Promise<void> {
    const sessionId = sessionData.tokenId as string;
    this.sessions.set(sessionId, sessionData);
    return Promise.resolve();
  }

  getSession(sessionId: string): Promise<{ refreshToken: string; provider: string } | null> {
    const session = this.sessions.get(sessionId);
    return Promise.resolve(session != null ? { 
      refreshToken: session.refreshToken as string, 
      provider: session.provider as string 
    } : null);
  }

  deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    return Promise.resolve();
  }
}

/** Mock secure storage service implementation */
class MockSecureStorageService implements ISecureStorageService {
  private storage = new Map<string, string>();

  storeEncrypted(key: string, value: string): Promise<void> {
    // Mock encryption - in production would use proper encryption
    this.storage.set(key, `encrypted_${value}`);
    return Promise.resolve();
  }

  storeEncryptedWithKey(key: string, value: string, encryptionKey: string): Promise<void> {
    // Mock encryption with key - in production would use proper encryption
    this.storage.set(key, `encrypted_${encryptionKey}_${value}`);
    return Promise.resolve();
  }
}
import { createHmac, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';

/**
 * OAuth provider types supported by the system
 */
export enum OAuthProvider {
  /** Google OAuth 2.0 */
  GOOGLE = 'google',
  /** Twitter OAuth 2.0 */
  TWITTER = 'twitter',
  /** GitHub OAuth 2.0 */
  GITHUB = 'github'
}

/**
 * OAuth configuration for each provider
 */
interface OAuthConfig {
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** OAuth authorization URL */
  authorizationUrl: string;
  /** OAuth token URL */
  tokenUrl: string;
  /** OAuth user info URL */
  userInfoUrl: string;
  /** OAuth scopes */
  scopes: string[];
}

/**
 * User information returned from OAuth providers
 */
export interface OAuthUserInfo {
  /** Provider-specific user ID */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** User's profile picture URL */
  picture?: string;
  /** OAuth provider */
  provider: OAuthProvider;
}

/**
 * MPC key shard information
 */
export interface MPCKeyShards {
  /** Device shard (stored locally) */
  deviceShard: string;
  /** Server shard (stored in database) */
  serverShard: string;
  /** Recovery shard (given to user) */
  recoveryShard: string;
  /** Public key derived from shards */
  publicKey: string;
}

/**
 * User session information
 */
export interface UserSession {
  /** Unique session ID */
  sessionId: string;
  /** User ID in our system */
  userId: string;
  /** OAuth provider used */
  provider: OAuthProvider;
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** Session expiration time */
  expiresAt: Date;
  /** Device fingerprint */
  deviceFingerprint: string;
}

/**
 * OAuth service for handling authentication flows
 */
export class OAuthService {
  private userRegistry: IUserRegistryDatabase;
  private secureStorage: ISecureStorageService;
  private emailProvider: IEmailProvider;
  private smsProvider: ISMSProvider;
  private jwtSecret: string;
  private configs: Map<OAuthProvider, OAuthConfig>;

  /**
   * Initialize OAuth service with mock providers
   * In production, these would be actual service instances
   */
  constructor() {
    this.userRegistry = new MockUserRegistryDatabase();
    this.secureStorage = new MockSecureStorageService();
    this.emailProvider = new MockEmailProvider();
    this.smsProvider = new MockSMSProvider();
    this.jwtSecret = process.env.JWT_SECRET ?? this.generateSecureSecret();
    this.configs = this.initializeConfigs();
  }

  /**
   * Initialize OAuth configurations for each provider
   * @returns Map of OAuth provider configurations
   */
  private initializeConfigs(): Map<OAuthProvider, OAuthConfig> {
    const configs = new Map<OAuthProvider, OAuthConfig>();

    configs.set(OAuthProvider.GOOGLE, {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/auth/google/callback',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: ['openid', 'profile', 'email']
    });

    configs.set(OAuthProvider.TWITTER, {
      clientId: process.env.TWITTER_CLIENT_ID ?? '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET ?? '',
      redirectUri: process.env.TWITTER_REDIRECT_URI ?? 'http://localhost:3000/auth/twitter/callback',
      authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      userInfoUrl: 'https://api.twitter.com/2/users/me',
      scopes: ['users.read', 'tweet.read']
    });

    configs.set(OAuthProvider.GITHUB, {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      redirectUri: process.env.GITHUB_REDIRECT_URI ?? 'http://localhost:3000/auth/github/callback',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: ['user:email', 'read:user']
    });

    return configs;
  }

  /**
   * Generate a secure secret for JWT if not provided
   * @returns Randomly generated JWT secret
   */
  private generateSecureSecret(): string {
    return randomBytes(64).toString('hex');
  }

  /**
   * Generate OAuth authorization URL
   * @param provider - OAuth provider
   * @param state - CSRF protection state
   * @returns Authorization URL
   */
  public getAuthorizationUrl(provider: OAuthProvider, state: string): string {
    const config = this.configs.get(provider);
    if (config == null) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state
    });

    // Twitter uses different parameter names
    if (provider === OAuthProvider.TWITTER) {
      params.set('code_challenge_method', 'S256');
      params.set('code_challenge', this.generateCodeChallenge());
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param provider - OAuth provider
   * @param code - Authorization code
   * @param codeVerifier - PKCE code verifier (for Twitter)
   * @returns Access token
   */
  public async exchangeCodeForToken(
    provider: OAuthProvider, 
    code: string, 
    codeVerifier?: string
  ): Promise<string> {
    const config = this.configs.get(provider);
    if (config == null) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    };

    if (provider === OAuthProvider.TWITTER && codeVerifier !== undefined && codeVerifier !== '') {
      params.code_verifier = codeVerifier;
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(params).toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json() as unknown as { access_token: string };
    return data.access_token;
  }

  /**
   * Get user information from OAuth provider
   * @param provider - OAuth provider
   * @param accessToken - Provider access token
   * @returns User information
   */
  public async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
    const config = this.configs.get(provider);
    if (config == null) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const response = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json() as unknown;
    
    // Normalize user info across providers
    let userInfo: OAuthUserInfo;
    
    switch (provider) {
      case OAuthProvider.GOOGLE: {
        const googleData = data as { id: string; email: string; name: string; picture: string };
        userInfo = {
          id: googleData.id,
          email: googleData.email,
          name: googleData.name,
          picture: googleData.picture,
          provider
        };
      }
        break;
      
      case OAuthProvider.TWITTER: {
        const twitterData = data as { data: { id: string; email?: string; username: string; name: string; profile_image_url: string } };
        userInfo = {
          id: twitterData.data.id,
          email: twitterData.data.email ?? `${twitterData.data.username}@twitter.local`,
          name: twitterData.data.name,
          picture: twitterData.data.profile_image_url,
          provider
        };
      }
        break;
      
      case OAuthProvider.GITHUB: {
        const githubData = data as { id: number; email?: string; login: string; name?: string; avatar_url: string };
        userInfo = {
          id: githubData.id.toString(),
          email: githubData.email ?? `${githubData.login}@github.local`,
          name: githubData.name ?? githubData.login,
          picture: githubData.avatar_url,
          provider
        };
      }
        break;
      
      default:
        throw new Error(`Unsupported OAuth provider: ${provider as string}`);
    }

    return userInfo;
  }

  /**
   * Create or update user in database
   * @param userInfo - OAuth user information
   * @returns User ID in our system
   */
  public async createOrUpdateUser(userInfo: OAuthUserInfo): Promise<string> {
    // Check if user exists
    const existingUser = await this.userRegistry.getUserByOAuth(
      userInfo.provider,
      userInfo.id
    );

    if (existingUser != null) {
      // Update user information
      await this.userRegistry.updateUser(existingUser.id, {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        lastLogin: new Date()
      });
      return existingUser.id;
    }

    // Create new user
    const userId = await this.userRegistry.createUser({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      oauthProvider: userInfo.provider,
      oauthId: userInfo.id,
      createdAt: new Date(),
      lastLogin: new Date()
    });

    // Send welcome email
    await this.emailProvider.sendEmail({
      to: userInfo.email,
      subject: 'Welcome to OmniBazaar',
      html: `
        <h1>Welcome to OmniBazaar, ${userInfo.name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can now access all features of our decentralized marketplace.</p>
      `
    });

    return userId;
  }

  /**
   * Generate MPC key shards using Shamir's Secret Sharing
   * @param userId - User ID
   * @returns MPC key shards
   */
  public async generateMPCKeyShards(userId: string): Promise<MPCKeyShards> {
    // Generate a random private key
    const privateKey = randomBytes(32);
    
    // Split into 3 shards using 2-of-3 threshold
    // This is a simplified implementation - in production, use proper Shamir's Secret Sharing
    const shares = this.splitSecret(privateKey, 3, 2);
    
    // Generate public key from private key
    const publicKey = this.derivePublicKey(privateKey);
    
    const shards: MPCKeyShards = {
      deviceShard: shares[0].toString('hex'),
      serverShard: shares[1].toString('hex'),
      recoveryShard: shares[2].toString('hex'),
      publicKey: publicKey.toString('hex')
    };

    // Store server shard in database (encrypted)
    await this.secureStorage.storeEncrypted(
      `mpc_shard_${userId}`,
      shards.serverShard
    );

    // Store recovery shard encrypted with user's recovery code
    const recoveryCode = this.generateRecoveryCode();
    await this.secureStorage.storeEncryptedWithKey(
      `mpc_recovery_${userId}`,
      shards.recoveryShard,
      recoveryCode
    );

    // Send recovery code to user via email
    const user = await this.userRegistry.getUser(userId);
    if (user?.email !== undefined && user.email !== '') {
      await this.emailProvider.sendEmail({
        to: user.email,
        subject: 'Your OmniBazaar Recovery Code',
        html: `
          <h2>Important: Save Your Recovery Code</h2>
          <p>Your recovery code is: <strong>${recoveryCode}</strong></p>
          <p>Store this code in a safe place. You'll need it to recover your account if you lose access to your device.</p>
          <p>Never share this code with anyone.</p>
        `
      });
    }

    return shards;
  }

  /**
   * Create user session with JWT tokens
   * @param userId - User ID
   * @param provider - OAuth provider used
   * @param deviceFingerprint - Device fingerprint for security
   * @returns User session
   */
  public async createSession(
    userId: string, 
    provider: OAuthProvider,
    deviceFingerprint: string
  ): Promise<UserSession> {
    const sessionId = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    
    // Create access token (24 hours)
    const accessToken = jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        provider,
        iat: now,
        exp: now + (24 * 60 * 60) // 24 hours
      },
      this.jwtSecret
    );

    // Create refresh token (7 days)
    const refreshToken = jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        typ: 'refresh',
        iat: now,
        exp: now + (7 * 24 * 60 * 60) // 7 days
      },
      this.jwtSecret
    );

    const session: UserSession = {
      sessionId,
      userId,
      provider,
      accessToken,
      refreshToken,
      expiresAt: new Date((now + (24 * 60 * 60)) * 1000),
      deviceFingerprint
    };

    // Store session in database
    await this.userRegistry.createSession({
      tokenId: sessionId,
      userId,
      refreshToken,
      deviceFingerprint,
      expiresAt: session.expiresAt,
      createdAt: new Date()
    });

    return session;
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - JWT refresh token
   * @returns New access token
   */
  public async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as {
        typ: string;
        sid: string;
        sub: string;
      };
      
      if (decoded.typ !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if session exists and is valid
      const session = await this.userRegistry.getSession(decoded.sid);
      if (session == null || session.refreshToken !== refreshToken) {
        throw new Error('Invalid session');
      }

      // Generate new access token
      const now = Math.floor(Date.now() / 1000);
      const accessToken = jwt.sign(
        {
          sub: decoded.sub,
          sid: decoded.sid,
          provider: session.provider,
          iat: now,
          exp: now + (24 * 60 * 60) // 24 hours
        },
        this.jwtSecret
      );

      return accessToken;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Revoke user session
   * @param sessionId - Session ID to revoke
   */
  public async revokeSession(sessionId: string): Promise<void> {
    await this.userRegistry.deleteSession(sessionId);
  }

  /**
   * Generate HMAC-SHA256 signature for API authentication
   * @param data - Data to sign
   * @param secret - Shared secret
   * @returns HMAC signature
   */
  public generateHMACSignature(data: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC-SHA256 signature
   * @param data - Data that was signed
   * @param signature - Signature to verify
   * @param secret - Shared secret
   * @returns Whether signature is valid
   */
  public verifyHMACSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMACSignature(data, secret);
    return signature === expectedSignature;
  }

  /**
   * Generate PKCE code challenge for OAuth 2.0
   * @returns Base64url encoded code challenge
   */
  private generateCodeChallenge(): string {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHmac('sha256', verifier)
      .digest('base64url');
    return challenge;
  }

  /**
   * Simple secret splitting (NOT production-ready Shamir's Secret Sharing)
   * In production, use a proper threshold cryptography library
   * @param secret The secret to split
   * @param totalShares Total number of shares to create
   * @param _threshold Minimum shares needed to reconstruct secret (unused in this simplified version)
   * @returns Array of secret shares as buffers
   */
  private splitSecret(secret: Buffer, totalShares: number, _threshold: number): Buffer[] {
    // This is a simplified implementation for demonstration
    // In production, use proper Shamir's Secret Sharing
    const shares: Buffer[] = [];
    
    for (let i = 0; i < totalShares - 1; i++) {
      shares.push(randomBytes(secret.length));
    }
    
    // Last share is XOR of all others with the secret
    const lastShare = Buffer.from(secret);
    for (const share of shares) {
      for (let j = 0; j < lastShare.length; j++) {
        lastShare[j] ^= share[j];
      }
    }
    shares.push(lastShare);
    
    return shares;
  }

  /**
   * Derive public key from private key (simplified)
   * In production, use proper elliptic curve cryptography
   * @param privateKey The private key to derive from
   * @returns Derived public key as buffer
   */
  private derivePublicKey(privateKey: Buffer): Buffer {
    // This is a simplified implementation
    // In production, use secp256k1 or similar
    const hash = createHmac('sha256', 'public_key_derivation')
      .update(privateKey)
      .digest();
    return hash;
  }

  /**
   * Generate a secure recovery code
   * @returns Formatted recovery code string
   */
  private generateRecoveryCode(): string {
    const code = randomBytes(16).toString('hex');
    // Format as XXXX-XXXX-XXXX-XXXX
    return code.match(/.{4}/g)?.join('-') ?? code;
  }
}