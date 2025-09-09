import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { MPCKeyManager } from '../../../src/core/keyring/MPCKeyManager';
import { SecureStorageService } from '../../../../../Validator/src/services/SecureStorageService';
import { RecoveryService } from '../../../../../Validator/src/services/RecoveryService';
import { ethers } from 'ethers';
import * as shamir from 'shamir-secret-sharing';

// Mock the Validator module dependencies
vi.mock('../../../../../Validator/src/services/SecureStorageService');
vi.mock('../../../../../Validator/src/services/RecoveryService');

// Mock shamir secret sharing
vi.mock('shamir-secret-sharing', () => ({
  split: vi.fn(),
  combine: vi.fn()
}));

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    Wallet: {
      createRandom: vi.fn()
    },
    randomBytes: vi.fn(),
    hexlify: vi.fn(),
    getBytes: vi.fn(),
    concat: vi.fn()
  }
}));

describe('MPCKeyManager', () => {
  let mpcKeyManager: MPCKeyManager;
  let mockSecureStorage: SecureStorageService;
  let mockRecoveryService: RecoveryService;

  const mockPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockShards = [
    Buffer.from('shard1-device'),
    Buffer.from('shard2-server'),
    Buffer.from('shard3-recovery')
  ];

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockSecureStorage = new SecureStorageService();
    mockRecoveryService = new RecoveryService();

    // Setup mock implementations
    (mockSecureStorage.init as Mock).mockResolvedValue(undefined);
    (mockRecoveryService.init as Mock).mockResolvedValue(undefined);

    (mockSecureStorage.store as Mock).mockResolvedValue({ id: 'storage-id' });
    (mockSecureStorage.retrieve as Mock).mockResolvedValue(null);
    (mockSecureStorage.delete as Mock).mockResolvedValue(undefined);

    (mockRecoveryService.storeRecoveryData as Mock).mockResolvedValue({ id: 'recovery-id' });
    (mockRecoveryService.getRecoveryData as Mock).mockResolvedValue(null);

    // Setup shamir mocks
    (shamir.split as Mock).mockReturnValue(mockShards);
    (shamir.combine as Mock).mockReturnValue(Buffer.from(mockPrivateKey));

    // Setup ethers mocks
    (ethers.Wallet.createRandom as Mock).mockReturnValue({
      privateKey: mockPrivateKey,
      address: '0xTestAddress'
    });
    (ethers.randomBytes as Mock).mockReturnValue(Buffer.from('random-bytes'));
    (ethers.hexlify as Mock).mockImplementation(b => '0x' + b.toString('hex'));
    (ethers.getBytes as Mock).mockImplementation(hex => Buffer.from(hex.slice(2), 'hex'));

    // Create service instance
    mpcKeyManager = new MPCKeyManager();
    await mpcKeyManager.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize secure storage and recovery service', async () => {
      const manager = new MPCKeyManager();
      await expect(manager.init()).resolves.not.toThrow();

      expect(mockSecureStorage.init).toHaveBeenCalled();
      expect(mockRecoveryService.init).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      const manager = new MPCKeyManager();
      (mockSecureStorage.init as Mock).mockRejectedValue(new Error('Storage init failed'));

      await expect(manager.init()).rejects.toThrow('Failed to initialize MPC key manager');
    });
  });

  describe('key generation and splitting', () => {
    it('should generate new wallet and split into 3 shards', async () => {
      const result = await mpcKeyManager.generateAndSplitKey({
        userId: 'user-123',
        threshold: 2
      });

      expect(result).toEqual({
        address: '0xTestAddress',
        shards: {
          device: expect.any(String),
          serverId: expect.any(String),
          recovery: expect.any(String)
        }
      });

      // Verify Shamir splitting was called correctly
      expect(shamir.split).toHaveBeenCalledWith(
        expect.any(Buffer),
        { shares: 3, threshold: 2 }
      );
    });

    it('should encrypt server shard before storage', async () => {
      await mpcKeyManager.generateAndSplitKey({
        userId: 'user-123',
        threshold: 2
      });

      expect(mockSecureStorage.store).toHaveBeenCalledWith(
        expect.stringContaining('mpc-shard:user-123'),
        expect.objectContaining({
          shardType: 'server',
          encryptedData: expect.any(String),
          metadata: expect.objectContaining({
            threshold: 2,
            totalShards: 3
          })
        })
      );
    });

    it('should store recovery shard with recovery service', async () => {
      const result = await mpcKeyManager.generateAndSplitKey({
        userId: 'user-123',
        threshold: 2
      });

      expect(mockRecoveryService.storeRecoveryData).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'mpc-recovery-shard',
        data: expect.any(String),
        metadata: expect.objectContaining({
          shardIndex: 2,
          threshold: 2
        })
      });
    });

    it('should handle custom threshold values', async () => {
      await mpcKeyManager.generateAndSplitKey({
        userId: 'user-123',
        threshold: 3 // Requires all 3 shards
      });

      expect(shamir.split).toHaveBeenCalledWith(
        expect.any(Buffer),
        { shares: 3, threshold: 3 }
      );
    });
  });

  describe('key reconstruction', () => {
    beforeEach(() => {
      // Mock stored server shard
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        shardType: 'server',
        encryptedData: ethers.hexlify(mockShards[1]),
        metadata: { threshold: 2, totalShards: 3 }
      });

      // Mock recovery shard
      (mockRecoveryService.getRecoveryData as Mock).mockResolvedValue({
        data: ethers.hexlify(mockShards[2]),
        metadata: { shardIndex: 2 }
      });
    });

    it('should reconstruct private key from 2 shards', async () => {
      const privateKey = await mpcKeyManager.reconstructPrivateKey({
        userId: 'user-123',
        shards: [
          { type: 'device', data: ethers.hexlify(mockShards[0]) },
          { type: 'server', id: 'server-shard-id' }
        ]
      });

      expect(privateKey).toBe(mockPrivateKey);
      expect(shamir.combine).toHaveBeenCalledWith([mockShards[0], mockShards[1]]);
    });

    it('should reconstruct using device and recovery shards', async () => {
      const privateKey = await mpcKeyManager.reconstructPrivateKey({
        userId: 'user-123',
        shards: [
          { type: 'device', data: ethers.hexlify(mockShards[0]) },
          { type: 'recovery', data: ethers.hexlify(mockShards[2]) }
        ]
      });

      expect(privateKey).toBe(mockPrivateKey);
      expect(shamir.combine).toHaveBeenCalledWith([mockShards[0], mockShards[2]]);
    });

    it('should throw error with insufficient shards', async () => {
      await expect(
        mpcKeyManager.reconstructPrivateKey({
          userId: 'user-123',
          shards: [
            { type: 'device', data: ethers.hexlify(mockShards[0]) }
          ]
        })
      ).rejects.toThrow('Insufficient shards provided');
    });

    it('should validate shard integrity', async () => {
      // Mock invalid combination
      (shamir.combine as Mock).mockImplementation(() => {
        throw new Error('Invalid shares');
      });

      await expect(
        mpcKeyManager.reconstructPrivateKey({
          userId: 'user-123',
          shards: [
            { type: 'device', data: 'invalid-shard' },
            { type: 'server', id: 'server-shard-id' }
          ]
        })
      ).rejects.toThrow('Failed to reconstruct private key');
    });

    it('should handle server shard retrieval failure', async () => {
      (mockSecureStorage.retrieve as Mock).mockResolvedValue(null);

      await expect(
        mpcKeyManager.reconstructPrivateKey({
          userId: 'user-123',
          shards: [
            { type: 'device', data: ethers.hexlify(mockShards[0]) },
            { type: 'server', id: 'non-existent-id' }
          ]
        })
      ).rejects.toThrow('Server shard not found');
    });
  });

  describe('shard rotation', () => {
    it('should rotate all shards while preserving key', async () => {
      const originalKey = mockPrivateKey;
      
      // Mock existing key reconstruction
      (shamir.combine as Mock).mockReturnValueOnce(Buffer.from(originalKey));

      const result = await mpcKeyManager.rotateShards({
        userId: 'user-123',
        currentShards: [
          { type: 'device', data: ethers.hexlify(mockShards[0]) },
          { type: 'server', id: 'server-shard-id' }
        ],
        newThreshold: 2
      });

      expect(result.shards).toBeDefined();
      expect(result.shards.device).not.toBe(ethers.hexlify(mockShards[0]));
      
      // Verify new shards were generated
      expect(shamir.split).toHaveBeenCalledTimes(2); // Once for reconstruction check, once for rotation
    });

    it('should update stored shards after rotation', async () => {
      await mpcKeyManager.rotateShards({
        userId: 'user-123',
        currentShards: [
          { type: 'device', data: ethers.hexlify(mockShards[0]) },
          { type: 'server', id: 'server-shard-id' }
        ],
        newThreshold: 2
      });

      // Verify old server shard was deleted
      expect(mockSecureStorage.delete).toHaveBeenCalled();
      
      // Verify new server shard was stored
      expect(mockSecureStorage.store).toHaveBeenCalledWith(
        expect.stringContaining('mpc-shard:user-123'),
        expect.objectContaining({
          shardType: 'server'
        })
      );
    });
  });

  describe('emergency recovery', () => {
    it('should support recovery with recovery code', async () => {
      const recoveryCode = 'RECOVERY-CODE-123456';
      
      (mockRecoveryService.validateRecoveryCode as Mock).mockResolvedValue({
        valid: true,
        userId: 'user-123',
        data: ethers.hexlify(mockShards[2])
      });

      const privateKey = await mpcKeyManager.recoverWithCode({
        recoveryCode,
        deviceShard: ethers.hexlify(mockShards[0])
      });

      expect(privateKey).toBe(mockPrivateKey);
      expect(mockRecoveryService.validateRecoveryCode).toHaveBeenCalledWith(recoveryCode);
    });

    it('should reject invalid recovery code', async () => {
      (mockRecoveryService.validateRecoveryCode as Mock).mockResolvedValue({
        valid: false
      });

      await expect(
        mpcKeyManager.recoverWithCode({
          recoveryCode: 'INVALID-CODE',
          deviceShard: ethers.hexlify(mockShards[0])
        })
      ).rejects.toThrow('Invalid recovery code');
    });
  });

  describe('security features', () => {
    it('should encrypt shards with user-specific key', async () => {
      await mpcKeyManager.generateAndSplitKey({
        userId: 'user-123',
        threshold: 2
      });

      // Verify encryption was applied
      const storeCall = (mockSecureStorage.store as Mock).mock.calls[0];
      const storedData = storeCall[1];
      
      expect(storedData.encryptedData).toBeTruthy();
      expect(storedData.encryptedData).not.toBe(ethers.hexlify(mockShards[1]));
    });

    it('should validate shard ownership', async () => {
      // Mock shard belonging to different user
      (mockSecureStorage.retrieve as Mock).mockResolvedValue({
        userId: 'different-user',
        shardType: 'server',
        encryptedData: 'encrypted'
      });

      await expect(
        mpcKeyManager.reconstructPrivateKey({
          userId: 'user-123',
          shards: [
            { type: 'device', data: ethers.hexlify(mockShards[0]) },
            { type: 'server', id: 'wrong-user-shard' }
          ]
        })
      ).rejects.toThrow('Shard ownership mismatch');
    });

    it('should implement rate limiting for reconstruction attempts', async () => {
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await mpcKeyManager.reconstructPrivateKey({
            userId: 'user-123',
            shards: [{ type: 'device', data: 'invalid' }]
          });
        } catch {
          // Expected to fail
        }
      }

      await expect(
        mpcKeyManager.reconstructPrivateKey({
          userId: 'user-123',
          shards: [
            { type: 'device', data: ethers.hexlify(mockShards[0]) },
            { type: 'server', id: 'server-id' }
          ]
        })
      ).rejects.toThrow('Too many reconstruction attempts');
    });
  });

  describe('shard management', () => {
    it('should list available shards for user', async () => {
      (mockSecureStorage.scan as Mock).mockResolvedValue([
        { id: 'shard-1', shardType: 'server', createdAt: Date.now() }
      ]);

      const shards = await mpcKeyManager.listUserShards('user-123');

      expect(shards).toEqual([
        {
          id: 'shard-1',
          type: 'server',
          createdAt: expect.any(Number)
        }
      ]);
    });

    it('should delete specific shard', async () => {
      await mpcKeyManager.deleteShard({
        userId: 'user-123',
        shardId: 'shard-to-delete'
      });

      expect(mockSecureStorage.delete).toHaveBeenCalledWith('shard-to-delete');
    });

    it('should export recovery shard for backup', async () => {
      const exportData = await mpcKeyManager.exportRecoveryShard({
        userId: 'user-123',
        shards: [
          { type: 'device', data: ethers.hexlify(mockShards[0]) },
          { type: 'server', id: 'server-id' }
        ]
      });

      expect(exportData).toEqual({
        recoveryCode: expect.any(String),
        encryptedShard: expect.any(String),
        instructions: expect.stringContaining('Store this recovery code')
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await mpcKeyManager.cleanup();
      
      // Should be able to reinitialize
      await expect(mpcKeyManager.init()).resolves.not.toThrow();
    });

    it('should clear rate limit counters on cleanup', async () => {
      // Add some failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await mpcKeyManager.reconstructPrivateKey({
            userId: 'user-123',
            shards: []
          });
        } catch {
          // Expected
        }
      }

      await mpcKeyManager.cleanup();
      await mpcKeyManager.init();

      // Should be able to attempt reconstruction again
      await expect(
        mpcKeyManager.reconstructPrivateKey({
          userId: 'user-123',
          shards: [
            { type: 'device', data: ethers.hexlify(mockShards[0]) }
          ]
        })
      ).rejects.toThrow('Insufficient shards'); // Not rate limited
    });
  });
});