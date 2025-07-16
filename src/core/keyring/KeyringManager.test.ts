/**
 * Test suite for KeyringManager with ENS integration
 */

import { KeyringManager } from './KeyringManager';
import { ContractManager } from '../contracts/ContractConfig';

// Mock the contract manager
jest.mock('../contracts/ContractConfig', () => ({
  ContractManager: {
    initialize: jest.fn().mockReturnValue({
      getRegistryContract: jest.fn().mockReturnValue({
        isAvailable: jest.fn().mockResolvedValue(true),
        resolve: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
        reverseResolve: jest.fn().mockResolvedValue('alice')
      }),
      getResolverContract: jest.fn().mockReturnValue({
        resolve: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
      })
    })
  },
  defaultConfig: {
    registryAddress: '0x1234567890123456789012345678901234567890',
    resolverAddress: '0x1234567890123456789012345678901234567890',
    cotiRpcUrl: 'https://testnet.coti.io/rpc',
    ethereumRpcUrl: 'https://sepolia.infura.io/v3/test-key'
  }
}));

describe('KeyringManager', () => {
  let keyringManager: KeyringManager;

  beforeEach(() => {
    keyringManager = KeyringManager.getInstance();
  });

  describe('Username availability', () => {
    it('should check if username is available', async () => {
      const isAvailable = await keyringManager.isUsernameAvailable('alice');
      expect(isAvailable).toBe(true);
    });
  });

  describe('Username resolution', () => {
    it('should resolve username to address', async () => {
      const address = await keyringManager.resolveUsername('alice');
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should resolve username via Ethereum resolver', async () => {
      const address = await keyringManager.resolveUsernameViaEthereum('alice');
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should reverse resolve address to username', async () => {
      const username = await keyringManager.reverseResolve('0x1234567890123456789012345678901234567890');
      expect(username).toBe('alice');
    });
  });

  describe('User registration', () => {
    it('should validate username format', async () => {
      const credentials = {
        username: 'a', // Too short
        password: 'test-password-123'
      };

      await expect(keyringManager.registerUser(credentials)).rejects.toThrow(
        'Username must be between 3 and 20 characters'
      );
    });

    it('should validate password length', async () => {
      const credentials = {
        username: 'alice',
        password: 'short' // Too short
      };

      await expect(keyringManager.registerUser(credentials)).rejects.toThrow(
        'Password must be at least 12 characters'
      );
    });
  });

  describe('User login', () => {
    it('should generate consistent seed from credentials', async () => {
      const credentials = {
        username: 'alice',
        password: 'test-password-123456'
      };

      // Mock the contract calls to avoid actual blockchain interaction
      const keyringManagerInstance = keyringManager as any;
      keyringManagerInstance.verifyAccountExists = jest.fn().mockResolvedValue(true);
      keyringManagerInstance.storeUserData = jest.fn().mockResolvedValue(undefined);

      const session1 = await keyringManager.loginUser(credentials);
      const session2 = await keyringManager.loginUser(credentials);

      // Same credentials should generate same mnemonic
      expect(session1.accounts.ethereum.mnemonic).toBe(session2.accounts.ethereum.mnemonic);
      expect(session1.accounts.omnicoin.mnemonic).toBe(session2.accounts.omnicoin.mnemonic);
    });
  });

  describe('Session management', () => {
    it('should create valid session', async () => {
      const credentials = {
        username: 'alice',
        password: 'test-password-123456'
      };

      const keyringManagerInstance = keyringManager as any;
      keyringManagerInstance.verifyAccountExists = jest.fn().mockResolvedValue(true);
      keyringManagerInstance.storeUserData = jest.fn().mockResolvedValue(undefined);

      const session = await keyringManager.loginUser(credentials);

      expect(session.username).toBe('alice');
      expect(session.isLoggedIn).toBe(true);
      expect(session.accounts.ethereum.omniAddress).toBe('alice.omnicoin');
      expect(session.accounts.omnicoin.omniAddress).toBe('alice.omnicoin');
    });

    it('should validate session timeout', () => {
      const session = keyringManager.getCurrentSession();
      expect(session).toBeNull(); // No session initially
    });
  });
});