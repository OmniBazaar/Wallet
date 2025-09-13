import { OAuthService, OAuthProvider } from '../../../src/services/auth/OAuthService';
import crypto from 'crypto';

// Define local test interfaces matching what OAuthService expects
interface EmailProvider {
  init: () => Promise<void>;
  sendEmail: (options: { to: string; subject: string; html: string }) => Promise<{ success: boolean; messageId?: string }>;
}

interface SMSProvider {
  init: () => Promise<void>;
  sendSMS: (to: string, message: string) => Promise<{ success: boolean; messageId?: string }>;
}

interface UserRegistryDatabase {
  init: () => Promise<void>;
  createUser: (userData: any) => Promise<any>;
  getUserByEmail: (email: string) => Promise<any>;
  getUserByOAuthId: (providerId: string, providerUserId: string) => Promise<any>;
  createSession: (sessionData: any) => Promise<any>;
  linkOAuthAccount: (userId: string, providerId: string, providerUserId: string, profile: any) => Promise<void>;
  updateUser: (userId: string, updates: any) => Promise<void>;
  storeOAuthState: (state: string, data: any) => Promise<void>;
  getOAuthState: (state: string) => Promise<any>;
  deleteOAuthState: (state: string) => Promise<void>;
  storeKeyShare: (data: any) => Promise<any>;
  getSession: (token: string) => Promise<any>;
  getSessionByRefreshToken: (refreshToken: string) => Promise<any>;
}

// Mock crypto for consistent testing
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHmac: jest.fn(),
  randomUUID: jest.fn()
}));

describe('OAuthService', () => {
  let oauthService: OAuthService;
  let mockEmailProvider: EmailProvider;
  let mockSMSProvider: SMSProvider;
  let mockUserRegistry: UserRegistryDatabase;
  let mockSecureStorage: any;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockEmailProvider = {
      init: jest.fn().mockResolvedValue(undefined),
      sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'email-123' })
    };

    mockSMSProvider = {
      init: jest.fn().mockResolvedValue(undefined),
      sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'sms-123' })
    };

    mockSecureStorage = {
      storeEncrypted: jest.fn().mockResolvedValue(undefined),
      storeEncryptedWithKey: jest.fn().mockResolvedValue(undefined)
    };

    mockUserRegistry = {
      init: jest.fn().mockResolvedValue(undefined),
      createUser: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        createdAt: new Date()
      }),
      getUserByEmail: jest.fn().mockResolvedValue(null),
      getUserByOAuthId: jest.fn().mockResolvedValue(null),
      createSession: jest.fn().mockResolvedValue({
        id: 'test-session-id',
        userId: 'test-user-id',
        token: 'test-token'
      }),
      linkOAuthAccount: jest.fn().mockResolvedValue(undefined),
      updateUser: jest.fn().mockResolvedValue(undefined),
      storeOAuthState: jest.fn().mockResolvedValue(undefined),
      getOAuthState: jest.fn().mockResolvedValue(null),
      deleteOAuthState: jest.fn().mockResolvedValue(undefined),
      storeKeyShare: jest.fn().mockResolvedValue({ id: 'shard-id' }),
      getSession: jest.fn().mockResolvedValue(null),
      getSessionByRefreshToken: jest.fn().mockResolvedValue(null)
    };

    // Setup crypto mocks
    (crypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('random-bytes-test'));
    (crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid');
    (crypto.createHmac as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('test-hmac')
    });

    // Create service instance with dependencies
    oauthService = new OAuthService({
      userRegistry: mockUserRegistry,
      secureStorage: mockSecureStorage,
      emailProvider: mockEmailProvider,
      smsProvider: mockSMSProvider
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const service = new OAuthService({
        userRegistry: mockUserRegistry,
        secureStorage: mockSecureStorage,
        emailProvider: mockEmailProvider,
        smsProvider: mockSMSProvider
      });
      expect(service).toBeDefined();
    });

    it('should use default providers when none provided', async () => {
      const service = new OAuthService();
      expect(service).toBeDefined();
    });
  });

  describe('OAuth flow', () => {
    describe('initiateOAuth', () => {
      it('should generate authorization URL for Google', () => {
        const state = 'test-state-123';
        const authUrl = oauthService.getAuthorizationUrl(OAuthProvider.GOOGLE, state);

        expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
        expect(authUrl).toContain('response_type=code');
        expect(authUrl).toContain('client_id=');
        expect(authUrl).toContain('redirect_uri=');
        expect(authUrl).toContain(`state=${state}`);
      });

      it('should generate authorization URL for GitHub', () => {
        const state = 'test-state-123';
        const authUrl = oauthService.getAuthorizationUrl(OAuthProvider.GITHUB, state);

        expect(authUrl).toContain('https://github.com/login/oauth/authorize');
        expect(authUrl).toContain(`state=${state}`);
      });

      it('should generate authorization URL for Twitter', () => {
        const state = 'test-state-123';
        const authUrl = oauthService.getAuthorizationUrl(OAuthProvider.TWITTER, state);

        expect(authUrl).toContain('https://twitter.com/i/oauth2/authorize');
        expect(authUrl).toContain(`state=${state}`);
      });

      it('should throw error for unsupported provider', () => {
        expect(() => {
          oauthService.getAuthorizationUrl('facebook' as any, 'test-state');
        }).toThrow('Unsupported OAuth provider: facebook');
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
        global.fetch = jest.fn()
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
        (mockUserRegistry.getUserByOAuthId as jest.Mock).mockResolvedValue({
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
        global.fetch = jest.fn().mockResolvedValueOnce({
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
      (mockUserRegistry.storeKeyShare as jest.Mock).mockResolvedValue({ id: 'shard-id' });

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
      (mockUserRegistry.getSession as jest.Mock).mockResolvedValue({
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
      (mockUserRegistry.getSession as jest.Mock).mockResolvedValue({
        id: 'session-id',
        userId: 'user-123',
        token,
        expiresAt: Date.now() - 1000
      });

      const result = await oauthService.verifySession(token);
      expect(result.valid).toBe(false);
    });

    it('should refresh session token', async () => {
      (mockUserRegistry.getSessionByRefreshToken as jest.Mock).mockResolvedValue({
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
      (mockUserRegistry.createUser as jest.Mock).mockRejectedValue(new Error('DB Error'));

      global.fetch = jest.fn()
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
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

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