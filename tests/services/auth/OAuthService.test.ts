import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { OAuthService } from '../../../src/services/auth/OAuthService';
import { EmailProvider } from '../../../../../Validator/src/services/providers/EmailProvider';
import { SMSProvider } from '../../../../../Validator/src/services/providers/SMSProvider';
import { UserRegistryDatabase } from '../../../../../Validator/src/database/UserRegistryDatabase';
import crypto from 'crypto';

// Mock the Validator module dependencies
vi.mock('../../../../../Validator/src/services/providers/EmailProvider');
vi.mock('../../../../../Validator/src/services/providers/SMSProvider');
vi.mock('../../../../../Validator/src/database/UserRegistryDatabase');

// Mock crypto for consistent testing
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(),
    createHmac: vi.fn(),
    randomUUID: vi.fn()
  }
}));

describe('OAuthService', () => {
  let oauthService: OAuthService;
  let mockEmailProvider: EmailProvider;
  let mockSMSProvider: SMSProvider;
  let mockUserRegistry: UserRegistryDatabase;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockEmailProvider = new EmailProvider();
    mockSMSProvider = new SMSProvider();
    mockUserRegistry = new UserRegistryDatabase();

    // Setup UserRegistryDatabase mocks
    (mockUserRegistry.init as Mock).mockResolvedValue(undefined);
    (mockUserRegistry.createUser as Mock).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      createdAt: new Date()
    });
    (mockUserRegistry.getUserByEmail as Mock).mockResolvedValue(null);
    (mockUserRegistry.getUserByOAuthId as Mock).mockResolvedValue(null);
    (mockUserRegistry.createSession as Mock).mockResolvedValue({
      id: 'test-session-id',
      userId: 'test-user-id',
      token: 'test-token'
    });

    // Setup crypto mocks
    (crypto.randomBytes as Mock).mockReturnValue(Buffer.from('random-bytes-test'));
    (crypto.randomUUID as Mock).mockReturnValue('test-uuid');
    (crypto.createHmac as Mock).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('test-hmac')
    });

    // Create service instance
    oauthService = new OAuthService();
    await oauthService.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const service = new OAuthService();
      await expect(service.init()).resolves.not.toThrow();
      expect(mockUserRegistry.init).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await oauthService.init();
      expect(mockUserRegistry.init).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization failure', async () => {
      const service = new OAuthService();
      (mockUserRegistry.init as Mock).mockRejectedValue(new Error('DB init failed'));
      
      await expect(service.init()).rejects.toThrow('Failed to initialize OAuth service');
    });
  });

  describe('OAuth flow', () => {
    describe('initiateOAuth', () => {
      it('should generate authorization URL for Google', async () => {
        const result = await oauthService.initiateOAuth({
          provider: 'google',
          redirectUri: 'https://example.com/callback'
        });

        expect(result).toEqual({
          authUrl: expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'),
          state: expect.any(String),
          codeVerifier: expect.any(String)
        });

        expect(result.authUrl).toContain('response_type=code');
        expect(result.authUrl).toContain('client_id=');
        expect(result.authUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      });

      it('should generate authorization URL for GitHub', async () => {
        const result = await oauthService.initiateOAuth({
          provider: 'github',
          redirectUri: 'https://example.com/callback'
        });

        expect(result.authUrl).toContain('https://github.com/login/oauth/authorize');
      });

      it('should generate authorization URL for Twitter', async () => {
        const result = await oauthService.initiateOAuth({
          provider: 'twitter',
          redirectUri: 'https://example.com/callback'
        });

        expect(result.authUrl).toContain('https://twitter.com/i/oauth2/authorize');
      });

      it('should throw error for unsupported provider', async () => {
        await expect(
          oauthService.initiateOAuth({
            provider: 'facebook' as any,
            redirectUri: 'https://example.com/callback'
          })
        ).rejects.toThrow('Unsupported OAuth provider: facebook');
      });
    });

    describe('handleCallback', () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      const mockUserInfo = {
        id: 'oauth-user-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      };

      beforeEach(() => {
        // Mock fetch for token exchange
        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockTokenResponse
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockUserInfo
          });
      });

      it('should handle successful OAuth callback', async () => {
        const result = await oauthService.handleCallback({
          code: 'auth-code',
          state: 'test-state',
          provider: 'google',
          codeVerifier: 'test-verifier'
        });

        expect(result).toEqual({
          user: {
            id: expect.any(String),
            email: 'user@example.com',
            name: 'Test User',
            provider: 'google',
            oauthId: 'oauth-user-123'
          },
          session: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresAt: expect.any(Number)
          },
          mpcShards: {
            deviceShard: expect.any(String),
            serverShardId: expect.any(String),
            recoveryShard: expect.any(String)
          }
        });

        // Verify user was created
        expect(mockUserRegistry.createUser).toHaveBeenCalledWith({
          email: 'user@example.com',
          name: 'Test User',
          provider: 'google',
          oauthId: 'oauth-user-123',
          profilePicture: 'https://example.com/avatar.jpg'
        });
      });

      it('should handle existing user login', async () => {
        // Mock existing user
        (mockUserRegistry.getUserByOAuthId as Mock).mockResolvedValue({
          id: 'existing-user-id',
          email: 'user@example.com',
          name: 'Test User',
          provider: 'google',
          oauthId: 'oauth-user-123'
        });

        const result = await oauthService.handleCallback({
          code: 'auth-code',
          state: 'test-state',
          provider: 'google',
          codeVerifier: 'test-verifier'
        });

        expect(result.user.id).toBe('existing-user-id');
        expect(mockUserRegistry.createUser).not.toHaveBeenCalled();
      });

      it('should handle token exchange failure', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request'
        });

        await expect(
          oauthService.handleCallback({
            code: 'invalid-code',
            state: 'test-state',
            provider: 'google',
            codeVerifier: 'test-verifier'
          })
        ).rejects.toThrow('Token exchange failed');
      });
    });
  });

  describe('MPC key shard generation', () => {
    it('should generate three key shards', async () => {
      const { mpcShards } = await oauthService.generateMPCShards('user-id-123');

      expect(mpcShards).toHaveProperty('deviceShard');
      expect(mpcShards).toHaveProperty('serverShardId');
      expect(mpcShards).toHaveProperty('recoveryShard');

      // Verify shards are different
      expect(mpcShards.deviceShard).not.toBe(mpcShards.recoveryShard);
      expect(mpcShards.deviceShard).toBeTruthy();
      expect(mpcShards.serverShardId).toBeTruthy();
      expect(mpcShards.recoveryShard).toBeTruthy();
    });

    it('should store server shard in database', async () => {
      (mockUserRegistry.storeKeyShare as Mock).mockResolvedValue({ id: 'shard-id' });

      const { mpcShards } = await oauthService.generateMPCShards('user-id-123');

      expect(mockUserRegistry.storeKeyShare).toHaveBeenCalledWith({
        userId: 'user-id-123',
        shardType: 'server',
        encryptedShard: expect.any(String)
      });
    });
  });

  describe('session management', () => {
    it('should create session with JWT tokens', async () => {
      const session = await oauthService.createSession({
        userId: 'user-123',
        provider: 'google',
        oauthTokens: {
          access_token: 'oauth-token',
          refresh_token: 'oauth-refresh',
          expires_in: 3600
        }
      });

      expect(session).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresAt: expect.any(Number)
      });

      expect(mockUserRegistry.createSession).toHaveBeenCalled();
    });

    it('should verify valid session', async () => {
      const token = 'valid-token';
      (mockUserRegistry.getSession as Mock).mockResolvedValue({
        id: 'session-id',
        userId: 'user-123',
        token,
        expiresAt: Date.now() + 3600000
      });

      const result = await oauthService.verifySession(token);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    it('should reject expired session', async () => {
      const token = 'expired-token';
      (mockUserRegistry.getSession as Mock).mockResolvedValue({
        id: 'session-id',
        userId: 'user-123',
        token,
        expiresAt: Date.now() - 1000
      });

      const result = await oauthService.verifySession(token);
      expect(result.valid).toBe(false);
    });

    it('should refresh session token', async () => {
      (mockUserRegistry.getSessionByRefreshToken as Mock).mockResolvedValue({
        id: 'session-id',
        userId: 'user-123',
        refreshToken: 'refresh-token',
        refreshExpiresAt: Date.now() + 86400000
      });

      const newSession = await oauthService.refreshSession('refresh-token');
      expect(newSession).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresAt: expect.any(Number)
      });
    });
  });

  describe('HMAC API authentication', () => {
    it('should generate HMAC signature', () => {
      const signature = oauthService.generateHMACSignature({
        method: 'POST',
        path: '/api/users',
        body: { email: 'test@example.com' },
        timestamp: 1234567890
      });

      expect(signature).toBe('test-hmac');
      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', expect.any(String));
    });

    it('should verify valid HMAC signature', () => {
      const isValid = oauthService.verifyHMACSignature({
        method: 'POST',
        path: '/api/users',
        body: { email: 'test@example.com' },
        timestamp: Date.now(),
        signature: 'test-hmac'
      });

      expect(isValid).toBe(true);
    });

    it('should reject expired HMAC signature', () => {
      const isValid = oauthService.verifyHMACSignature({
        method: 'POST',
        path: '/api/users',
        body: { email: 'test@example.com' },
        timestamp: Date.now() - 360000, // 6 minutes ago
        signature: 'test-hmac'
      });

      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (mockUserRegistry.createUser as Mock).mockRejectedValue(new Error('DB Error'));

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '123', email: 'test@example.com' })
        });

      await expect(
        oauthService.handleCallback({
          code: 'auth-code',
          state: 'test-state',
          provider: 'google',
          codeVerifier: 'test-verifier'
        })
      ).rejects.toThrow('Failed to create user: DB Error');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        oauthService.handleCallback({
          code: 'auth-code',
          state: 'test-state',
          provider: 'google',
          codeVerifier: 'test-verifier'
        })
      ).rejects.toThrow('OAuth callback failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await oauthService.cleanup();
      
      // Should be able to reinitialize after cleanup
      await expect(oauthService.init()).resolves.not.toThrow();
    });
  });
});