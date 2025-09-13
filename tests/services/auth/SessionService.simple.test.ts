import { SessionService, SessionServiceDependencies } from '../../../src/services/auth/SessionService';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

describe('SessionService - Core Functionality', () => {
  let sessionService: SessionService;
  let mockCacheService: any;
  let mockSecureStorage: any;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create minimal mocks
    mockCacheService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined)
    };

    mockSecureStorage = {
      store: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn().mockResolvedValue(null)
    };

    mockDatabase = {
      query: jest.fn().mockResolvedValue({ rows: [] })
    };

    // Mock JWT
    jwt.sign.mockReturnValue('test-jwt-token');
    jwt.verify.mockReturnValue({ userId: 'user-123', sessionId: 'session-123', sid: 'session-123', typ: 'refresh' });

    // Create service with mocked dependencies
    sessionService = new SessionService(
      { jwtSecret: 'test-secret' },
      {
        cacheService: mockCacheService,
        secureStorage: mockSecureStorage,
        database: mockDatabase
      }
    );
  });

  describe('Basic Operations', () => {
    it('should create a new session', async () => {
      const result = await sessionService.createSession({
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        deviceInfo: { userAgent: 'Test Browser', ip: '127.0.0.1' }
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.accessToken).toBe('test-jwt-token');
      expect(result.refreshToken).toBeDefined();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should validate a valid token', async () => {
      // Override jwt.verify for this test to return access token type
      jwt.verify.mockReturnValueOnce({
        sub: 'user-123',
        sid: 'session-123',
        typ: 'access'
      });

      // Mock cache to return a valid session
      mockCacheService.get.mockResolvedValueOnce(JSON.stringify({
        id: 'session-123',
        userId: 'user-123',
        deviceFingerprint: 'test-fingerprint',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        isActive: true
      }));

      const result = await sessionService.validateAccessToken('test-jwt-token');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.session?.id).toBe('session-123');
    });

    it('should reject an invalid token', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = await sessionService.validateAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should refresh a token', async () => {
      // Mock JWT verification for refresh token
      jwt.verify.mockReturnValueOnce({
        sub: 'user-123',
        sid: 'session-123',
        typ: 'refresh'
      });

      // Mock sign to return new tokens
      jwt.sign.mockImplementation((payload, secret, options) => {
        if ((payload as any).typ === 'access') {
          return 'new-access-token';
        }
        return 'new-refresh-token';
      });

      // Mock database query to return session
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'session-123',
            user_id: 'user-123',
            device_fingerprint: 'test-fingerprint',
            user_agent: 'test-agent',
            ip_address: '127.0.0.1',
            created_at: new Date(),
            last_activity_at: new Date(),
            access_token_expires_at: new Date(Date.now() + 3600000),
            refresh_token_expires_at: new Date(Date.now() + 86400000),
            is_active: true
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // For update query

      const result = await sessionService.refreshTokens('test-refresh-token');

      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe('new-access-token');
      expect(result?.refreshToken).toBe('new-refresh-token');
    });

    it('should get user sessions', async () => {
      // Mock cache to return session data
      mockCacheService.get
        .mockResolvedValueOnce(JSON.stringify({
          id: 'session-1',
          userId: 'user-123',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }))
        .mockResolvedValueOnce(JSON.stringify({
          id: 'session-2',
          userId: 'user-123',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }));

      const sessions = await sessionService.getUserSessions('user-123');

      expect(sessions).toBeDefined();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should invalidate a session', async () => {
      // Mock database query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await sessionService.invalidateSession('session-123');

      expect(mockCacheService.delete).toHaveBeenCalledWith('session:session-123');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions'),
        [expect.any(Date), 'session-123']
      );
    });

    it('should clean up expired sessions', async () => {
      // Mock database query for cleanup
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await sessionService.cleanupExpiredSessions();

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions'),
        [expect.any(Date)]
      );
    });
  });
});