import { SessionService, Session, SessionError, SessionServiceDependencies } from '../../../src/services/auth/SessionService';

// Create mock interfaces
interface ICacheService {
  set: jest.Mock;
  get: jest.Mock;
  delete: jest.Mock;
  scan?: jest.Mock;
  init?: jest.Mock;
}

interface ISecureStorageService {
  store: jest.Mock;
  retrieve: jest.Mock;
  init?: jest.Mock;
}

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockCacheService: ICacheService;
  let mockSecureStorage: ISecureStorageService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  const mockDeviceInfo = {
    userAgent: 'Mozilla/5.0 Test Browser',
    ip: '192.168.1.1',
    platform: 'Windows',
    deviceId: 'device-123'
  };

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockCacheService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
      scan: jest.fn().mockResolvedValue([]),
      init: jest.fn().mockResolvedValue(undefined)
    };

    mockSecureStorage = {
      store: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn().mockResolvedValue(null),
      init: jest.fn().mockResolvedValue(undefined)
    };

    // Mock JWT methods
    jwt.sign.mockReturnValue('mock-jwt-token');
    jwt.verify.mockReturnValue({ userId: 'user-123', sessionId: 'session-123' });
    jwt.decode.mockReturnValue({ userId: 'user-123' });

    // Create service instance with mocked dependencies
    sessionService = new SessionService(
      {},
      {
        cacheService: mockCacheService,
        secureStorage: mockSecureStorage
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create service with default dependencies', () => {
      const service = new SessionService();
      expect(service).toBeDefined();
    });

    it('should create service with custom dependencies', () => {
      const service = new SessionService({}, {
        cacheService: mockCacheService,
        secureStorage: mockSecureStorage
      });
      expect(service).toBeDefined();
    });
  });

  describe('session creation', () => {
    it('should create session with JWT tokens', async () => {
      const session = await sessionService.createSession({
        user: mockUser,
        deviceInfo: mockDeviceInfo
      });

      expect(session).toEqual({
        sessionId: expect.any(String),
        accessToken: 'mock-jwt-token',
        refreshToken: expect.any(String),
        accessTokenExpiresAt: expect.any(Number),
        refreshTokenExpiresAt: expect.any(Number)
      });

      // Verify JWT was signed with correct payload
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          sessionId: expect.any(String),
          deviceId: 'device-123'
        }),
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    it('should store session in cache', async () => {
      const session = await sessionService.createSession({
        user: mockUser,
        deviceInfo: mockDeviceInfo
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.objectContaining({
          userId: 'user-123',
          deviceInfo: mockDeviceInfo,
          createdAt: expect.any(Number),
          lastActivity: expect.any(Number)
        }),
        86400 // 24 hours
      );
    });

    it('should generate device fingerprint', async () => {
      const session = await sessionService.createSession({
        user: mockUser,
        deviceInfo: mockDeviceInfo
      });

      expect(mockSecureStorage.store).toHaveBeenCalledWith(
        expect.stringContaining('device-fingerprint'),
        expect.objectContaining({
          sessionId: session.sessionId,
          fingerprint: expect.any(String)
        })
      );
    });

    it('should handle missing device info', async () => {
      const session = await sessionService.createSession({
        user: mockUser,
        deviceInfo: {} as any
      });

      expect(session.sessionId).toBeTruthy();
      expect(session.accessToken).toBeTruthy();
    });
  });

  describe('token validation', () => {
    const validToken = 'Bearer mock-jwt-token';

    it('should validate valid access token', async () => {
      mockCacheService.get.mockResolvedValue({
        userId: 'user-123',
        deviceInfo: mockDeviceInfo,
        createdAt: Date.now(),
        lastActivity: Date.now()
      });

      const result = await sessionService.validateAccessToken(validToken);

      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        sessionId: 'session-123'
      });

      expect(jwt.verify).toHaveBeenCalledWith(
        'mock-jwt-token',
        expect.any(String)
      );
    });

    it('should reject invalid token format', async () => {
      const result = await sessionService.validateAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });

    it('should reject expired token', async () => {
      (jwt.verify).mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      const result = await sessionService.validateAccessToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject token with invalid session', async () => {
      mockCacheService.get.mockResolvedValue(null); // No session in cache

      const result = await sessionService.validateAccessToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should update last activity on valid token', async () => {
      const sessionData = {
        userId: 'user-123',
        deviceInfo: mockDeviceInfo,
        createdAt: Date.now() - 3600000,
        lastActivity: Date.now() - 1800000
      };

      mockCacheService.get.mockResolvedValue(sessionData);

      await sessionService.validateAccessToken(validToken);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          lastActivity: expect.any(Number)
        }),
        expect.any(Number)
      );
    });
  });

  describe('token refresh', () => {
    const mockRefreshToken = 'refresh-token-123';

    beforeEach(() => {
      (mockSecureStorage.retrieve).mockResolvedValue({
        userId: 'user-123',
        sessionId: 'session-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      mockCacheService.get.mockResolvedValue({
        userId: 'user-123',
        deviceInfo: mockDeviceInfo
      });
    });

    it('should refresh access token with valid refresh token', async () => {
      const result = await sessionService.refreshAccessToken(mockRefreshToken);

      expect(result).toEqual({
        success: true,
        accessToken: expect.stringMatching(/^Bearer mock-jwt-token$/),
        expiresAt: expect.any(Number)
      });

      expect(jwt.sign).toHaveBeenCalled();
    });

    it('should reject expired refresh token', async () => {
      (mockSecureStorage.retrieve).mockResolvedValue({
        userId: 'user-123',
        sessionId: 'session-123',
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 1000 // Expired
      });

      const result = await sessionService.refreshAccessToken(mockRefreshToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token expired');
    });

    it('should reject invalid refresh token', async () => {
      (mockSecureStorage.retrieve).mockResolvedValue(null);

      const result = await sessionService.refreshAccessToken('invalid-refresh');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });

    it('should rotate refresh token on use', async () => {
      const result = await sessionService.refreshAccessToken(mockRefreshToken);

      expect(result.success).toBe(true);
      expect(result.newRefreshToken).toBeTruthy();
      expect(result.newRefreshToken).not.toBe(mockRefreshToken);

      // Verify old token was deleted
      expect(mockSecureStorage.delete).toHaveBeenCalledWith(
        expect.stringContaining(mockRefreshToken)
      );
    });
  });

  describe('device fingerprinting', () => {
    it('should generate consistent fingerprint for same device', () => {
      const fingerprint1 = sessionService.generateDeviceFingerprint(mockDeviceInfo);
      const fingerprint2 = sessionService.generateDeviceFingerprint(mockDeviceInfo);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toBeTruthy();
    });

    it('should generate different fingerprints for different devices', () => {
      const device1 = { ...mockDeviceInfo, deviceId: 'device-1' };
      const device2 = { ...mockDeviceInfo, deviceId: 'device-2' };

      const fingerprint1 = sessionService.generateDeviceFingerprint(device1);
      const fingerprint2 = sessionService.generateDeviceFingerprint(device2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should validate matching device fingerprint', async () => {
      const sessionId = 'session-123';
      const fingerprint = sessionService.generateDeviceFingerprint(mockDeviceInfo);

      (mockSecureStorage.retrieve).mockResolvedValue({
        sessionId,
        fingerprint
      });

      const isValid = await sessionService.validateDeviceFingerprint(
        sessionId,
        mockDeviceInfo
      );

      expect(isValid).toBe(true);
    });

    it('should reject mismatched device fingerprint', async () => {
      const sessionId = 'session-123';
      
      (mockSecureStorage.retrieve).mockResolvedValue({
        sessionId,
        fingerprint: 'different-fingerprint'
      });

      const isValid = await sessionService.validateDeviceFingerprint(
        sessionId,
        mockDeviceInfo
      );

      expect(isValid).toBe(false);
    });
  });

  describe('session management', () => {
    it('should get active session by ID', async () => {
      const sessionData = {
        userId: 'user-123',
        deviceInfo: mockDeviceInfo,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      mockCacheService.get.mockResolvedValue(sessionData);

      const session = await sessionService.getSession('session-123');

      expect(session).toEqual(sessionData);
    });

    it('should get all user sessions', async () => {
      const sessions = [
        { sessionId: 'session-1', deviceInfo: { deviceId: 'device-1' } },
        { sessionId: 'session-2', deviceInfo: { deviceId: 'device-2' } }
      ];

      (mockCacheService.scan).mockResolvedValue(sessions);

      const userSessions = await sessionService.getUserSessions('user-123');

      expect(userSessions).toHaveLength(2);
      expect(mockCacheService.scan).toHaveBeenCalledWith('session:user-123:*');
    });

    it('should revoke session', async () => {
      await sessionService.revokeSession('session-123');

      expect(mockCacheService.delete).toHaveBeenCalledWith('session:session-123');
      expect(mockSecureStorage.delete).toHaveBeenCalled();
    });

    it('should revoke all user sessions', async () => {
      const sessions = [
        { sessionId: 'session-1' },
        { sessionId: 'session-2' }
      ];

      (mockCacheService.scan).mockResolvedValue(sessions);

      await sessionService.revokeAllUserSessions('user-123');

      expect(mockCacheService.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('session expiration', () => {
    it('should check if session is expired', () => {
      const activeSession = {
        createdAt: Date.now() - 3600000, // 1 hour ago
        lastActivity: Date.now() - 300000 // 5 minutes ago
      };

      const expiredSession = {
        createdAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        lastActivity: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
      };

      expect(sessionService.isSessionExpired(activeSession as any)).toBe(false);
      expect(sessionService.isSessionExpired(expiredSession as any)).toBe(true);
    });

    it('should clean up expired sessions', async () => {
      const sessions = [
        { 
          sessionId: 'expired-1',
          createdAt: Date.now() - 48 * 60 * 60 * 1000,
          lastActivity: Date.now() - 36 * 60 * 60 * 1000
        },
        {
          sessionId: 'active-1',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
      ];

      (mockCacheService.scan).mockResolvedValue(sessions);

      await sessionService.cleanupExpiredSessions();

      expect(mockCacheService.delete).toHaveBeenCalledWith('session:expired-1');
      expect(mockCacheService.delete).not.toHaveBeenCalledWith('session:active-1');
    });
  });

  describe('security features', () => {
    it('should detect concurrent session limit', async () => {
      const sessions = new Array(5).fill(null).map((_, i) => ({
        sessionId: `session-${i}`,
        deviceInfo: { deviceId: `device-${i}` }
      }));

      (mockCacheService.scan).mockResolvedValue(sessions);

      const canCreate = await sessionService.canCreateNewSession('user-123');
      expect(canCreate).toBe(false);
    });

    it('should allow new session within limit', async () => {
      const sessions = [
        { sessionId: 'session-1' },
        { sessionId: 'session-2' }
      ];

      (mockCacheService.scan).mockResolvedValue(sessions);

      const canCreate = await sessionService.canCreateNewSession('user-123');
      expect(canCreate).toBe(true);
    });

    it('should track suspicious activity', async () => {
      // Multiple failed validations from same IP
      const attempts = new Array(10).fill(null);
      
      for (const _ of attempts) {
        await sessionService.trackFailedValidation('192.168.1.100');
      }

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('failed-attempts'),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired sessions', async () => {
      await expect(sessionService.cleanupExpiredSessions()).resolves.not.toThrow();
    });
  });
});