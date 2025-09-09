/**
 * BiometricService Tests
 * Comprehensive tests for biometric authentication functionality
 */

import { 
  BiometricService, 
  BiometricEnrollmentOptions,
  BiometricAuthOptions,
  BiometricCapability,
  BiometricCredential
} from '../../src/services/BiometricService';

// Mock WebAuthn API
const mockPublicKeyCredential = {
  isUserVerifyingPlatformAuthenticatorAvailable: jest.fn()
};

const mockNavigator = {
  credentials: {
    create: jest.fn(),
    get: jest.fn()
  }
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Setup global mocks
(global as any).window = {
  navigator: mockNavigator,
  PublicKeyCredential: mockPublicKeyCredential,
  location: { hostname: 'localhost' },
  crypto: {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }
  }
};

(global as any).localStorage = localStorageMock;
(global as any).crypto = (global as any).window.crypto;

describe('BiometricService', () => {
  let service: BiometricService;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockResolvedValue(true);
    
    service = new BiometricService();
    await service.init();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new BiometricService();
      await expect(newService.init()).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      await service.init(); // Already initialized in beforeEach
      await service.init(); // Should not throw
    });

    it('should handle initialization without WebAuthn support', async () => {
      const originalWindow = (global as any).window;
      (global as any).window = undefined;
      
      const newService = new BiometricService();
      await expect(newService.init()).resolves.not.toThrow();
      
      (global as any).window = originalWindow;
    });

    it('should load existing credentials on init', async () => {
      const mockCredentials = {
        'cred-1': {
          id: 'cred-1',
          rawIdBase64: btoa('raw-id-1'),
          publicKeyBase64: btoa('public-key-1'),
          userId: 'user-1',
          displayName: 'Test User',
          createdAt: Date.now(),
          authenticatorType: 'platform',
          isBackedUp: false
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCredentials));
      
      const newService = new BiometricService();
      await newService.init();
      
      expect(newService.getCredentials()).toHaveLength(1);
      expect(newService.hasCredentials()).toBe(true);
    });
  });

  describe('WebAuthn Support Detection', () => {
    it('should detect WebAuthn support', () => {
      expect(service.isWebAuthnSupported()).toBe(true);
    });

    it('should detect lack of WebAuthn support', () => {
      const originalNavigator = (global as any).window.navigator;
      (global as any).window.navigator = {};
      
      expect(service.isWebAuthnSupported()).toBe(false);
      
      (global as any).window.navigator = originalNavigator;
    });

    it('should handle non-browser environment', () => {
      const originalWindow = (global as any).window;
      (global as any).window = undefined;
      
      expect(service.isWebAuthnSupported()).toBe(false);
      
      (global as any).window = originalWindow;
    });
  });

  describe('Biometric Availability', () => {
    it('should check biometric availability', async () => {
      const available = await service.isBiometricAvailable();
      expect(available).toBe(true);
      expect(mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable).toHaveBeenCalled();
    });

    it('should handle availability check errors', async () => {
      mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
        .mockRejectedValueOnce(new Error('Not supported'));
      
      const available = await service.isBiometricAvailable();
      expect(available).toBe(false);
    });

    it('should provide backward compatibility with isAvailable', async () => {
      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when WebAuthn not supported', async () => {
      const originalWindow = (global as any).window;
      (global as any).window = undefined;
      
      const available = await service.isBiometricAvailable();
      expect(available).toBe(false);
      
      (global as any).window = originalWindow;
    });
  });

  describe('Capabilities Detection', () => {
    it('should return available capabilities', async () => {
      const capabilities = await service.getCapabilities();
      
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities[0]).toMatchObject({
        type: expect.any(String),
        available: true,
        configured: false,
        displayName: expect.any(String),
        icon: expect.any(String)
      });
    });

    it('should detect face recognition on iOS devices', async () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });
      
      const newService = new BiometricService();
      await newService.init();
      
      const capabilities = await newService.getCapabilities();
      const faceCapability = capabilities.find(cap => cap.type === 'face');
      expect(faceCapability).toBeDefined();
      
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true
      });
    });

    it('should filter out unavailable capabilities', async () => {
      mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
        .mockResolvedValueOnce(false);
      
      const capabilities = await service.getCapabilities();
      expect(capabilities).toHaveLength(0);
    });
  });

  describe('Biometric Enrollment', () => {
    const enrollmentOptions: BiometricEnrollmentOptions = {
      displayName: 'Test User',
      userId: 'test-user-123',
      requireUserVerification: true
    };

    it('should enroll biometric credential successfully', async () => {
      const mockCredential = {
        id: 'cred-123',
        rawId: new Uint8Array([1, 2, 3, 4, 5]),
        response: {
          getPublicKey: () => new Uint8Array([10, 20, 30, 40, 50])
        },
        type: 'public-key'
      };
      
      mockNavigator.credentials.create.mockResolvedValue(mockCredential);
      
      const result = await service.enroll(enrollmentOptions);
      
      expect(result.success).toBe(true);
      expect(result.credential).toBeDefined();
      expect(result.credential?.userId).toBe('test-user-123');
      expect(result.credential?.displayName).toBe('Test User');
      expect(service.hasCredentials()).toBe(true);
    });

    it('should handle enrollment cancellation', async () => {
      mockNavigator.credentials.create.mockResolvedValue(null);
      
      const result = await service.enroll(enrollmentOptions);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create credential');
    });

    it('should handle enrollment errors', async () => {
      mockNavigator.credentials.create.mockRejectedValue(new Error('User cancelled'));
      
      const result = await service.enroll(enrollmentOptions);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('User cancelled');
    });

    it('should use custom challenge if provided', async () => {
      const customChallenge = new Uint8Array([100, 200, 300]);
      const optionsWithChallenge = {
        ...enrollmentOptions,
        challenge: customChallenge
      };
      
      mockNavigator.credentials.create.mockImplementation((options) => {
        expect(options.publicKey.challenge).toBe(customChallenge);
        return Promise.resolve({
          id: 'cred-custom',
          rawId: new Uint8Array([1, 2, 3]),
          response: {
            getPublicKey: () => new Uint8Array([10, 20, 30])
          }
        });
      });
      
      await service.enroll(optionsWithChallenge);
    });

    it('should respect timeout option', async () => {
      const optionsWithTimeout = {
        ...enrollmentOptions,
        timeout: 30000
      };
      
      mockNavigator.credentials.create.mockImplementation((options) => {
        expect(options.publicKey.timeout).toBe(30000);
        return Promise.resolve(null);
      });
      
      await service.enroll(optionsWithTimeout);
    });

    it('should save enrolled credentials', async () => {
      const mockCredential = {
        id: 'cred-save',
        rawId: new Uint8Array([1, 2, 3]),
        response: {
          getPublicKey: () => new Uint8Array([10, 20, 30])
        }
      };
      
      mockNavigator.credentials.create.mockResolvedValue(mockCredential);
      
      await service.enroll(enrollmentOptions);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'biometric_credentials',
        expect.any(String)
      );
    });

    it('should reject enrollment when not initialized', async () => {
      const uninitService = new BiometricService();
      
      await expect(uninitService.enroll(enrollmentOptions))
        .rejects.toThrow('Biometric service not initialized');
    });

    it('should handle enrollment without WebAuthn support', async () => {
      const originalWindow = (global as any).window;
      (global as any).window = { location: { hostname: 'localhost' } };
      
      const result = await service.enroll(enrollmentOptions);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('WebAuthn not supported');
      
      (global as any).window = originalWindow;
    });
  });

  describe('Biometric Authentication', () => {
    let mockCredential: BiometricCredential;

    beforeEach(async () => {
      // Enroll a credential first
      mockCredential = {
        id: 'auth-cred-1',
        rawId: new Uint8Array([1, 2, 3, 4, 5]),
        publicKey: new Uint8Array([10, 20, 30, 40, 50]),
        userId: 'test-user',
        displayName: 'Test User',
        createdAt: Date.now(),
        authenticatorType: 'platform',
        isBackedUp: false
      };
      
      // Manually add credential to service
      const credentials = service['credentials'];
      credentials.set(mockCredential.id, mockCredential);
    });

    it('should authenticate successfully', async () => {
      const mockAssertion = {
        id: 'auth-cred-1',
        rawId: new Uint8Array([1, 2, 3, 4, 5]),
        response: {
          signature: new Uint8Array([100, 200, 300]),
          userHandle: new Uint8Array([1, 2, 3])
        }
      };
      
      mockNavigator.credentials.get.mockResolvedValue(mockAssertion);
      
      const result = await service.authenticate();
      
      expect(result.success).toBe(true);
      expect(result.credential).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.userVerified).toBe(true);
    });

    it('should fail authentication without enrolled credentials', async () => {
      await service.clearCredentials();
      
      const result = await service.authenticate();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No biometric credentials enrolled');
    });

    it('should handle authentication cancellation', async () => {
      mockNavigator.credentials.get.mockResolvedValue(null);
      
      const result = await service.authenticate();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('should handle authentication errors', async () => {
      mockNavigator.credentials.get.mockRejectedValue(new Error('User denied'));
      
      const result = await service.authenticate();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('User denied');
    });

    it('should use custom challenge if provided', async () => {
      const customChallenge = new Uint8Array([50, 100, 150]);
      const authOptions: BiometricAuthOptions = {
        challenge: customChallenge
      };
      
      mockNavigator.credentials.get.mockImplementation((options) => {
        expect(options.publicKey.challenge).toBe(customChallenge);
        return Promise.resolve({
          id: 'auth-cred-1',
          response: {
            signature: new Uint8Array([100, 200]),
            userHandle: null
          }
        });
      });
      
      await service.authenticate(authOptions);
    });

    it('should filter allowed credentials', async () => {
      const authOptions: BiometricAuthOptions = {
        allowedCredentialIds: [new Uint8Array([1, 2, 3, 4, 5])]
      };
      
      mockNavigator.credentials.get.mockImplementation((options) => {
        expect(options.publicKey.allowCredentials).toHaveLength(1);
        expect(options.publicKey.allowCredentials[0].type).toBe('public-key');
        return Promise.resolve({
          id: 'auth-cred-1',
          response: {
            signature: new Uint8Array([100, 200]),
            userHandle: null
          }
        });
      });
      
      await service.authenticate(authOptions);
    });

    it('should update last used timestamp', async () => {
      const mockAssertion = {
        id: 'auth-cred-1',
        response: {
          signature: new Uint8Array([100, 200]),
          userHandle: null
        }
      };
      
      mockNavigator.credentials.get.mockResolvedValue(mockAssertion);
      
      const beforeTime = Date.now();
      await service.authenticate();
      const afterTime = Date.now();
      
      const credential = service.getCredentials().find(c => c.id === 'auth-cred-1');
      expect(credential?.lastUsedAt).toBeDefined();
      expect(credential?.lastUsedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(credential?.lastUsedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should handle unknown credential', async () => {
      const mockAssertion = {
        id: 'unknown-cred',
        response: {
          signature: new Uint8Array([100, 200]),
          userHandle: null
        }
      };
      
      mockNavigator.credentials.get.mockResolvedValue(mockAssertion);
      
      const result = await service.authenticate();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown credential');
    });

    it('should reject authentication when not initialized', async () => {
      const uninitService = new BiometricService();
      
      await expect(uninitService.authenticate())
        .rejects.toThrow('Biometric service not initialized');
    });
  });

  describe('Credential Management', () => {
    let testCredential: BiometricCredential;

    beforeEach(() => {
      testCredential = {
        id: 'mgmt-cred-1',
        rawId: new Uint8Array([1, 2, 3]),
        publicKey: new Uint8Array([10, 20, 30]),
        userId: 'test-user',
        displayName: 'Test User',
        createdAt: Date.now(),
        authenticatorType: 'platform',
        isBackedUp: false
      };
      
      const credentials = service['credentials'];
      credentials.set(testCredential.id, testCredential);
    });

    it('should get all credentials', () => {
      const credentials = service.getCredentials();
      
      expect(credentials).toHaveLength(1);
      expect(credentials[0].id).toBe('mgmt-cred-1');
    });

    it('should check if credentials exist', () => {
      expect(service.hasCredentials()).toBe(true);
      
      service['credentials'].clear();
      expect(service.hasCredentials()).toBe(false);
    });

    it('should remove specific credential', async () => {
      const removed = await service.removeCredential('mgmt-cred-1');
      
      expect(removed).toBe(true);
      expect(service.hasCredentials()).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle removing non-existent credential', async () => {
      const removed = await service.removeCredential('non-existent');
      
      expect(removed).toBe(false);
      expect(service.hasCredentials()).toBe(true);
    });

    it('should clear all credentials', async () => {
      const cleared = await service.clearCredentials();
      
      expect(cleared).toBe(true);
      expect(service.hasCredentials()).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'biometric_credentials',
        '{}'
      );
    });

    it('should handle clear credentials error', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const cleared = await service.clearCredentials();
      
      expect(cleared).toBe(false);
    });
  });

  describe('Storage Operations', () => {
    it('should save credentials to localStorage', async () => {
      const credential: BiometricCredential = {
        id: 'storage-cred-1',
        rawId: new Uint8Array([1, 2, 3]),
        publicKey: new Uint8Array([10, 20, 30]),
        userId: 'test-user',
        displayName: 'Test User',
        createdAt: Date.now(),
        authenticatorType: 'platform',
        isBackedUp: false
      };
      
      const credentials = service['credentials'];
      credentials.set(credential.id, credential);
      
      await service['saveCredentials']();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'biometric_credentials',
        expect.any(String)
      );
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData['storage-cred-1']).toBeDefined();
      expect(savedData['storage-cred-1'].rawIdBase64).toBeDefined();
      expect(savedData['storage-cred-1'].publicKeyBase64).toBeDefined();
    });

    it('should handle storage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      // Should not throw
      await expect(service['saveCredentials']()).resolves.not.toThrow();
    });

    it('should load credentials with error handling', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const newService = new BiometricService();
      await expect(newService.init()).resolves.not.toThrow();
    });

    it('should handle corrupted stored data', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      const newService = new BiometricService();
      await expect(newService.init()).resolves.not.toThrow();
      expect(newService.hasCredentials()).toBe(false);
    });
  });

  describe('Random Challenge Generation', () => {
    it('should generate random challenges', () => {
      const challenge1 = service['generateChallenge']();
      const challenge2 = service['generateChallenge']();
      
      expect(challenge1).toBeInstanceOf(Uint8Array);
      expect(challenge1.length).toBe(32);
      expect(challenge1).not.toEqual(challenge2);
    });

    it('should use fallback for environments without crypto', () => {
      const originalCrypto = (global as any).crypto;
      (global as any).crypto = undefined;
      (global as any).window.crypto = undefined;
      
      const challenge = service['generateChallenge']();
      
      expect(challenge).toBeInstanceOf(Uint8Array);
      expect(challenge.length).toBe(32);
      
      (global as any).crypto = originalCrypto;
      (global as any).window.crypto = originalCrypto;
    });
  });

  describe('Cleanup', () => {
    it('should clear cache', async () => {
      await expect(service.clearCache()).resolves.not.toThrow();
    });

    it('should cleanup resources', async () => {
      // Add some credentials
      const credentials = service['credentials'];
      credentials.set('cleanup-cred', {
        id: 'cleanup-cred',
        rawId: new Uint8Array([1, 2, 3]),
        publicKey: new Uint8Array([10, 20, 30]),
        userId: 'test',
        displayName: 'Test',
        createdAt: Date.now(),
        authenticatorType: 'platform',
        isBackedUp: false
      });
      
      await service.cleanup();
      
      expect(service.hasCredentials()).toBe(false);
      expect(service['isInitialized']).toBe(false);
      expect(service['supportedTypes']).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock an error during cleanup
      jest.spyOn(console, 'error').mockImplementation();
      
      service['credentials'] = null as any; // Force an error
      
      await expect(service.cleanup()).resolves.not.toThrow();
      
      jest.restoreAllMocks();
    });
  });

  describe('User Agent Detection', () => {
    it('should detect iOS devices for Face ID', async () => {
      const testUserAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)'
      ];
      
      for (const userAgent of testUserAgents) {
        Object.defineProperty(navigator, 'userAgent', {
          value: userAgent,
          configurable: true
        });
        
        const newService = new BiometricService();
        await newService.init();
        
        expect(newService['supportedTypes']).toContain('face');
      }
    });

    it('should not detect face for non-iOS devices', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true
      });
      
      const newService = new BiometricService();
      await newService.init();
      
      expect(newService['supportedTypes']).not.toContain('face');
    });
  });

  describe('Edge Cases', () => {
    it('should handle enrollment with minimal options', async () => {
      const minimalOptions: BiometricEnrollmentOptions = {
        displayName: 'User',
        userId: '123'
      };
      
      mockNavigator.credentials.create.mockResolvedValue({
        id: 'minimal-cred',
        rawId: new Uint8Array([1]),
        response: {
          getPublicKey: () => new Uint8Array([10])
        }
      });
      
      const result = await service.enroll(minimalOptions);
      expect(result.success).toBe(true);
    });

    it('should handle authentication with no options', async () => {
      // Add a credential first
      const credentials = service['credentials'];
      credentials.set('no-opt-cred', {
        id: 'no-opt-cred',
        rawId: new Uint8Array([1, 2, 3]),
        publicKey: new Uint8Array([10, 20, 30]),
        userId: 'test',
        displayName: 'Test',
        createdAt: Date.now(),
        authenticatorType: 'platform',
        isBackedUp: false
      });
      
      mockNavigator.credentials.get.mockResolvedValue({
        id: 'no-opt-cred',
        response: {
          signature: new Uint8Array([100]),
          userHandle: null
        }
      });
      
      const result = await service.authenticate();
      expect(result.success).toBe(true);
    });
  });
});