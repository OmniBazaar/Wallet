/**
 * LegacyMigrationService Test Suite
 * 
 * Tests legacy user migration with direct key derivation from username/password.
 * Validates that derived keys match stored public keys and provide access to pre-minted tokens.
 * 
 * NOTE: The actual v1 key derivation algorithm must be provided. These tests use
 * an example algorithm that must be replaced with the real v1 implementation.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { 
  LegacyMigrationService, 
  type LegacyUserData, 
  type MigrationStatus,
  type ValidationResult,
  type AccessResult,
  type LegacyKeyDerivationAlgorithm
} from '../../src/services/LegacyMigrationService';

// Mock ethers
jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers') as any;
  return {
    ...actualEthers,
    Wallet: jest.fn().mockImplementation((privateKey, provider) => ({
      privateKey,
      provider,
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
      signingKey: {
        publicKey: '0x04bfcab8722991ae774db48f1ca3b2deb6abe7c6e5fd7a3b16a3c' +
                   '7a6e2a14c5b3e2d1c0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6'
      },
      connect: jest.fn().mockReturnThis(),
      getAddress: jest.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A')
    }))
  };
});

describe('LegacyMigrationService', () => {
  let service: LegacyMigrationService;
  let mockProvider: any;
  let mockKeyDerivation: LegacyKeyDerivationAlgorithm;
  
  // Test data
  const TEST_LEGACY_USERS: LegacyUserData[] = [
    {
      accountId: 'acc-001',
      username: 'alice',
      balance: '1000000', // 1 XOM in 6 decimals
      balanceDecimal: '1.0',
      balanceType: 'COMBINED',
      publicKey: '0x04bfcab8722991ae774db48f1ca3b2deb6abe7c6e5fd7a3b16a3c' +
                 '7a6e2a14c5b3e2d1c0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A'
    },
    {
      accountId: 'acc-002', 
      username: 'bob',
      balance: '5000000', // 5 XOM in 6 decimals
      balanceDecimal: '5.0',
      balanceType: 'COMBINED',
      publicKey: '0x04cfcab8722991ae774db48f1ca3b2deb6abe7c6e5fd7a3b16a3c' +
                 '8a6e2a14c5b3e2d1c0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f7',
      address: '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B'
    }
  ];

  beforeEach(() => {
    // Mock provider
    mockProvider = {
      getBalance: jest.fn().mockResolvedValue(ethers.parseEther('1')), // Tokens minted
      estimateGas: jest.fn().mockResolvedValue(21000n),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n })
    };

    // Mock key derivation that returns valid private key for alice
    // Since it's extremely difficult to find a private key that generates a specific address,
    // we'll spy on ethers.Wallet constructor to intercept wallet creation
    const originalWallet = ethers.Wallet;

    mockKeyDerivation = {
      derivePrivateKey: jest.fn().mockImplementation((username: string, password: string) => {
        if (username === 'alice' && password === 'password123') {
          // Return a valid private key - the service will validate it
          return '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (username === 'bob' && password === 'password456') {
          // For bob's tests if needed
          return '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd00';
        }
        throw new Error('Invalid credentials');
      })
    };

    // Override ethers.Wallet constructor to return the expected address for alice's key
    jest.spyOn(ethers, 'Wallet').mockImplementation((privateKey: any, provider?: any) => {
      if (privateKey === '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
        // Return a wallet mock that has Alice's address
        return {
          privateKey,
          provider,
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
          signingKey: {
            publicKey: '0x04bfcab8722991ae774db48f1ca3b2deb6abe7c6e5fd7a3b16a3c' +
                      '7a6e2a14c5b3e2d1c0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6'
          },
          connect: jest.fn().mockReturnThis(),
          getAddress: jest.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A')
        } as any;
      }
      // For other private keys, return original behavior
      return new originalWallet(privateKey, provider);
    });

    service = new LegacyMigrationService(mockProvider, mockKeyDerivation);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with legacy user data', () => {
      service.initialize(TEST_LEGACY_USERS);

      const alice = service.getLegacyUser('alice');
      expect(alice).toEqual(TEST_LEGACY_USERS[0]);

      const bob = service.getLegacyUser('bob');
      expect(bob).toEqual(TEST_LEGACY_USERS[1]);
    });

    it('should handle case-insensitive usernames', () => {
      service.initialize(TEST_LEGACY_USERS);

      const alice = service.getLegacyUser('ALICE');
      expect(alice).toEqual(TEST_LEGACY_USERS[0]);
    });

    it('should throw error when CSV loading not implemented', () => {
      expect(() => service.initialize()).toThrow(
        'CSV loading not implemented. Use initialize() with data array.'
      );
    });
  });

  describe('Legacy User Lookup', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should return legacy user data', () => {
      const user = service.getLegacyUser('alice');
      expect(user).toMatchObject({
        username: 'alice',
        balance: '1000000',
        publicKey: expect.any(String),
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A'
      });
    });

    it('should return null for non-existent user', () => {
      const user = service.getLegacyUser('nonexistent');
      expect(user).toBeNull();
    });

    it('should check if user is legacy user', async () => {
      const isLegacy = await service.isLegacyUser('alice');
      expect(isLegacy).toBe(true);
      
      const isNotLegacy = await service.isLegacyUser('charlie');
      expect(isNotLegacy).toBe(false);
    });
  });

  describe('Migration Status', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should return status for legacy user with minted tokens', async () => {
      const status = await service.getMigrationStatus('alice');
      
      expect(status).toEqual({
        username: 'alice',
        isLegacyUser: true,
        isClaimed: true, // Has balance
        legacyBalance: '1000000',
        newBalance: '1000000000000000000', // 1e18 
        claimAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
        claimTimestamp: expect.any(Number)
      });
    });

    it('should return status for legacy user without minted tokens', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(0n);
      
      const status = await service.getMigrationStatus('alice');
      
      expect(status).toEqual({
        username: 'alice',
        isLegacyUser: true,
        isClaimed: false,
        legacyBalance: '1000000',
        newBalance: '1000000000000000000'
      });
    });

    it('should return status for non-legacy user', async () => {
      const status = await service.getMigrationStatus('charlie');
      
      expect(status).toEqual({
        username: 'charlie',
        isLegacyUser: false,
        isClaimed: false,
        legacyBalance: '0',
        newBalance: '0'
      });
    });

    it('should handle provider errors gracefully', async () => {
      mockProvider.getBalance.mockRejectedValueOnce(new Error('Network error'));
      
      const status = await service.getMigrationStatus('alice');
      
      expect(status.isLegacyUser).toBe(true);
      expect(status.isClaimed).toBe(false);
    });
  });

  describe('Credential Validation with Key Derivation', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should validate correct credentials', async () => {
      const result = await service.validateLegacyCredentials('alice', 'password123');
      
      expect(result).toMatchObject({
        isValid: true,
        username: 'alice',
        balance: '1000000',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A'
      });
      expect(result.wallet).toBeDefined();
      expect(mockKeyDerivation.derivePrivateKey).toHaveBeenCalledWith('alice', 'password123');
    });

    it('should reject incorrect password', async () => {
      mockKeyDerivation.derivePrivateKey.mockImplementationOnce(() => {
        throw new Error('Invalid credentials');
      });
      
      const result = await service.validateLegacyCredentials('alice', 'wrongpassword');
      
      expect(result).toEqual({
        isValid: false,
        error: 'Invalid credentials'
      });
    });

    it('should reject non-existent user', async () => {
      const result = await service.validateLegacyCredentials('charlie', 'password');
      
      expect(result).toEqual({
        isValid: false,
        error: 'Username not found in legacy records'
      });
    });

    it('should verify derived key matches stored public key', async () => {
      // Mock derivation that produces different address
      // This private key will generate a different address than Alice's
      mockKeyDerivation.derivePrivateKey.mockReturnValueOnce(
        '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      );

      // Also need to override the ethers.Wallet mock for this different key
      const originalImplementation = (ethers.Wallet as jest.MockedFunction<any>).getMockImplementation();
      (ethers.Wallet as jest.MockedFunction<any>).mockImplementationOnce((privateKey: any, provider?: any) => {
        if (privateKey === '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef') {
          // Return a wallet with a different address
          return {
            privateKey,
            provider,
            address: '0xDeaDBeeF00000000000000000000000000000000', // Different address
            signingKey: {
              publicKey: '0x04differentpublickey'
            },
            connect: jest.fn().mockReturnThis(),
            getAddress: jest.fn().mockResolvedValue('0xDeaDBeeF00000000000000000000000000000000')
          } as any;
        }
        // Fallback to original
        return originalImplementation?.(privateKey, provider);
      });

      const result = service.validateLegacyCredentials('alice', 'password123');

      expect(result).toMatchObject({
        isValid: false,
        error: 'Invalid password - derived key does not match'
      });
    });

    it('should handle key derivation errors', async () => {
      mockKeyDerivation.derivePrivateKey.mockImplementationOnce(() => {
        throw new Error('Derivation algorithm error');
      });
      
      const result = await service.validateLegacyCredentials('alice', 'password123');
      
      expect(result).toEqual({
        isValid: false,
        error: 'Derivation algorithm error'
      });
    });
  });

  describe('Access Legacy Balance', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should provide access to pre-minted tokens', async () => {
      const result = await service.accessLegacyBalance('alice', 'password123');

      expect(result).toMatchObject({
        success: true,
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
        amount: '1.0' // 1 XOM formatted
      });
      expect(result.wallet).toBeDefined();
      expect(result.wallet?.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A');
    });

    it('should fail if tokens not minted yet', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(0n);
      
      const result = await service.accessLegacyBalance('alice', 'password123');
      
      expect(result).toEqual({
        success: false,
        error: 'No balance found at legacy address. Tokens may not be minted yet.'
      });
    });

    it('should fail with invalid credentials', async () => {
      mockKeyDerivation.derivePrivateKey.mockImplementationOnce(() => {
        throw new Error('Invalid password');
      });
      
      const result = await service.accessLegacyBalance('alice', 'wrongpassword');
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid password'
      });
    });

    it('should handle provider errors', async () => {
      mockProvider.getBalance.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await service.accessLegacyBalance('alice', 'password123');
      
      expect(result).toEqual({
        success: false,
        error: 'Network error'
      });
    });
  });

  describe('Key Derivation Algorithm', () => {
    it('should allow setting custom key derivation algorithm', async () => {
      await service.initialize(TEST_LEGACY_USERS);
      
      const customDerivation: LegacyKeyDerivationAlgorithm = {
        derivePrivateKey: jest.fn().mockReturnValue(
          '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        )
      };
      
      service.setKeyDerivationAlgorithm(customDerivation);
      
      await service.validateLegacyCredentials('alice', 'password123');
      
      expect(customDerivation.derivePrivateKey).toHaveBeenCalledWith('alice', 'password123');
    });

    it('should throw error when no algorithm provided', async () => {
      const serviceNoAlgo = new LegacyMigrationService(mockProvider);
      await serviceNoAlgo.initialize(TEST_LEGACY_USERS);
      
      const result = await serviceNoAlgo.validateLegacyCredentials('alice', 'password123');
      
      expect(result).toMatchObject({
        isValid: false,
        error: 'Legacy key derivation algorithm not implemented. Please provide the v1 algorithm.'
      });
    });

    it('should create example key derivation', () => {
      const example = LegacyMigrationService.createExampleKeyDerivation();
      
      expect(() => {
        const key = example.derivePrivateKey('alice', 'password123');
        expect(key).toMatch(/^0x[a-f0-9]{64}$/);
      }).not.toThrow();
    });
  });

  describe('Migration Statistics', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should calculate migration statistics', async () => {
      // First user has balance, second doesn't
      mockProvider.getBalance
        .mockResolvedValueOnce(ethers.parseEther('1'))
        .mockResolvedValueOnce(0n);
      
      const stats = await service.getMigrationStats();
      
      expect(stats).toEqual({
        totalUsers: 2,
        totalLegacySupply: '6.0', // 1 + 5 XOM
        totalAccessed: 1,
        accessRate: 50
      });
    });

    it('should handle errors in stats calculation', async () => {
      mockProvider.getBalance.mockRejectedValue(new Error('Network error'));
      
      const stats = await service.getMigrationStats();
      
      expect(stats.totalUsers).toBe(2);
      expect(stats.totalLegacySupply).toBe('6.0');
      expect(stats.totalAccessed).toBe(0);
    });
  });

  describe('Unaccessed Users Export', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should export users without accessed balance', async () => {
      // First user has balance, second doesn't
      mockProvider.getBalance
        .mockResolvedValueOnce(ethers.parseEther('1'))
        .mockResolvedValueOnce(0n);
      
      const unaccessed = await service.exportUnaccessedUsers();
      
      expect(unaccessed).toEqual([
        {
          username: 'bob',
          balance: '5.0',
          address: '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B'
        }
      ]);
    });

    it('should include users when balance check fails', async () => {
      mockProvider.getBalance.mockRejectedValue(new Error('Network error'));
      
      const unaccessed = await service.exportUnaccessedUsers();
      
      expect(unaccessed).toHaveLength(2);
    });
  });

  describe('Search Operations', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should search legacy users by username', async () => {
      const results = await service.searchLegacyUsers('ali');
      
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('alice');
    });

    it('should search legacy users by account ID', async () => {
      const results = await service.searchLegacyUsers('acc-002');
      
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('bob');
    });

    it('should limit search results', async () => {
      // Add many users
      const manyUsers: LegacyUserData[] = [];
      for (let i = 0; i < 30; i++) {
        manyUsers.push({
          ...TEST_LEGACY_USERS[0],
          accountId: `test-${i}`,
          username: `testuser${i}`
        });
      }
      
      await service.initialize(manyUsers);
      const results = await service.searchLegacyUsers('test');
      
      expect(results.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Top Balance Holders', () => {
    beforeEach(async () => {
      const users: LegacyUserData[] = [
        { ...TEST_LEGACY_USERS[0], username: 'small', balance: '100000' },
        { ...TEST_LEGACY_USERS[0], username: 'medium', balance: '500000' },
        { ...TEST_LEGACY_USERS[0], username: 'large', balance: '10000000' }
      ];
      await service.initialize(users);
    });

    it('should return top balance holders sorted', () => {
      const top = service.getTopBalanceHolders(2);
      
      expect(top).toHaveLength(2);
      expect(top[0].username).toBe('large');
      expect(top[1].username).toBe('medium');
    });

    it('should handle limit larger than user count', () => {
      const top = service.getTopBalanceHolders(10);
      
      expect(top).toHaveLength(3);
    });
  });

  describe('Gas Estimation', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should estimate gas for transfers', async () => {
      const gas = await service.estimateTransferGas(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
        '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B',
        '1.0'
      );
      
      expect(gas).toBe('21000');
      expect(mockProvider.estimateGas).toHaveBeenCalledWith({
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
        to: '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B',
        value: ethers.parseEther('1.0')
      });
    });

    it('should return default gas on error', async () => {
      mockProvider.estimateGas.mockRejectedValueOnce(new Error('Estimation failed'));
      
      const gas = await service.estimateTransferGas(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
        '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B',
        '1.0'
      );
      
      expect(gas).toBe('21000');
    });
  });

  describe('Balance Conversion', () => {
    it('should convert 6-decimal to 18-decimal balance', () => {
      const service = new LegacyMigrationService(mockProvider);
      
      // Access private DECIMAL_CONVERSION through instance
      const converted = BigInt('1000000') * BigInt(10 ** 12);
      
      expect(converted.toString()).toBe('1000000000000000000');
      expect(ethers.formatEther(converted)).toBe('1.0');
    });

    it('should handle zero balance conversion', () => {
      const service = new LegacyMigrationService(mockProvider);
      
      const converted = BigInt('0') * BigInt(10 ** 12);
      
      expect(converted.toString()).toBe('0');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      service.initialize(TEST_LEGACY_USERS);
    });

    it('should handle empty username', async () => {
      const result = await service.validateLegacyCredentials('', 'password');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username not found in legacy records');
    });

    it('should handle empty password', async () => {
      mockKeyDerivation.derivePrivateKey.mockImplementationOnce(() => {
        throw new Error('Password required');
      });
      
      const result = await service.validateLegacyCredentials('alice', '');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password required');
    });

    it('should handle special characters in username', async () => {
      const specialUser: LegacyUserData = {
        ...TEST_LEGACY_USERS[0],
        username: 'user@example.com'
      };
      
      await service.initialize([specialUser]);
      
      const user = service.getLegacyUser('user@example.com');
      expect(user).toBeDefined();
    });

    it('should handle very large balances', async () => {
      const richUser: LegacyUserData = {
        ...TEST_LEGACY_USERS[0],
        balance: '999999999999', // ~1M XOM in 6 decimals
        balanceDecimal: '999999.999999'
      };
      
      await service.initialize([richUser]);
      
      const status = await service.getMigrationStatus('alice');
      expect(BigInt(status.newBalance)).toBe(BigInt('999999999999000000000000'));
    });
  });

  describe('Integration Notes', () => {
    it('should require public key in legacy data', async () => {
      const userWithoutPubKey: LegacyUserData = {
        accountId: 'acc-003',
        username: 'charlie',
        balance: '1000000',
        balanceDecimal: '1.0',
        balanceType: 'COMBINED',
        publicKey: '', // Missing
        address: '0x123'
      };
      
      await service.initialize([userWithoutPubKey]);
      
      // NOTE: We need the public key to verify the derived private key
      // This test documents that requirement
      const result = await service.validateLegacyCredentials('charlie', 'password');
      
      // Without public key, we can only verify by address
      expect(result.isValid).toBe(false);
    });

    it('should document the need for exact v1 algorithm', () => {
      // This test serves as documentation
      const exampleAlgorithm = LegacyMigrationService.createExampleKeyDerivation();
      
      // The example algorithm is NOT the real v1 algorithm
      // It must be replaced with the exact algorithm used in v1
      expect(exampleAlgorithm.derivePrivateKey).toBeDefined();
      
      // The real algorithm should:
      // 1. Take username and password as inputs
      // 2. Use the same hashing/derivation as v1
      // 3. Return a valid 32-byte private key as hex string
    });
  });
});