/**
 * Keyring Service Tests
 * Tests the high-level keyring service functionality
 */

import { keyringService } from '../../../src/core/keyring/KeyringService';
import { ChainType } from '../../../src/core/keyring/BIP39Keyring';
import { TEST_PASSWORD, cleanupTest } from '../../setup';

describe('KeyringService', () => {
  afterEach(() => {
    cleanupTest();
    // Reset keyring state
    keyringService['keyring'] = null;
    keyringService['password'] = '';
  });

  describe('Wallet Creation', () => {
    it('should create a new wallet with mnemonic', async () => {
      const mnemonic = await keyringService.createWallet(TEST_PASSWORD);
      
      expect(mnemonic).toBeTruthy();
      expect(mnemonic.split(' ')).toHaveLength(12);
      expect(keyringService.isUnlocked()).toBe(true);
    });

    it('should restore wallet from mnemonic', async () => {
      const mnemonic = await keyringService.createWallet(TEST_PASSWORD);
      
      // Lock and restore
      await keyringService.lock();
      expect(keyringService.isUnlocked()).toBe(false);
      
      await keyringService.restoreWallet(mnemonic, TEST_PASSWORD);
      expect(keyringService.isUnlocked()).toBe(true);
    });

    it('should reject invalid mnemonic on restore', async () => {
      await expect(
        keyringService.restoreWallet('invalid mnemonic', TEST_PASSWORD)
      ).rejects.toThrow();
    });
  });

  describe('Lock/Unlock', () => {
    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
    });

    it('should lock wallet', async () => {
      expect(keyringService.isUnlocked()).toBe(true);
      
      await keyringService.lock();
      expect(keyringService.isUnlocked()).toBe(false);
    });

    it('should unlock wallet with correct password', async () => {
      await keyringService.lock();
      
      await keyringService.unlock(TEST_PASSWORD);
      expect(keyringService.isUnlocked()).toBe(true);
    });

    it('should fail to unlock with wrong password', async () => {
      await keyringService.lock();
      
      await expect(
        keyringService.unlock('wrongPassword')
      ).rejects.toThrow();
    });

    it('should change password', async () => {
      const newPassword = 'newPassword123!';
      
      await keyringService.changePassword(TEST_PASSWORD, newPassword);
      
      // Lock and try to unlock with new password
      await keyringService.lock();
      await keyringService.unlock(newPassword);
      expect(keyringService.isUnlocked()).toBe(true);
    });

    it('should fail to change password with wrong current password', async () => {
      await expect(
        keyringService.changePassword('wrongPassword', 'newPassword')
      ).rejects.toThrow('Incorrect password');
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
    });

    it('should create accounts for all chain types', async () => {
      const ethAccount = await keyringService.createAccount('ethereum', 'ETH Account');
      const btcAccount = await keyringService.createAccount('bitcoin', 'BTC Account');
      const solAccount = await keyringService.createAccount('solana', 'SOL Account');
      const dotAccount = await keyringService.createAccount('substrate', 'DOT Account');
      
      expect(ethAccount.chainType).toBe(ChainType.Ethereum);
      expect(ethAccount.name).toBe('ETH Account');
      expect(ethAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      
      expect(btcAccount.chainType).toBe(ChainType.Bitcoin);
      expect(btcAccount.name).toBe('BTC Account');
      
      expect(solAccount.chainType).toBe(ChainType.Solana);
      expect(solAccount.name).toBe('SOL Account');
      
      expect(dotAccount.chainType).toBe(ChainType.Substrate);
      expect(dotAccount.name).toBe('DOT Account');
    });

    it('should get all accounts', async () => {
      await keyringService.createAccount('ethereum', 'Account 1');
      await keyringService.createAccount('bitcoin', 'Account 2');
      await keyringService.createAccount('solana', 'Account 3');
      
      const accounts = keyringService.getAccounts();
      expect(accounts).toHaveLength(3);
      expect(accounts.map(a => a.name)).toEqual(['Account 1', 'Account 2', 'Account 3']);
    });

    it('should get accounts by chain type', async () => {
      await keyringService.createAccount('ethereum', 'ETH 1');
      await keyringService.createAccount('ethereum', 'ETH 2');
      await keyringService.createAccount('bitcoin', 'BTC 1');
      await keyringService.createAccount('solana', 'SOL 1');
      
      const ethAccounts = keyringService.getAccountsByChain('ethereum');
      expect(ethAccounts).toHaveLength(2);
      expect(ethAccounts.map(a => a.name)).toEqual(['ETH 1', 'ETH 2']);
    });

    it('should find account by address', async () => {
      const account = await keyringService.createAccount('ethereum', 'Test Account');
      
      const found = keyringService.getAccountByAddress(account.address);
      expect(found).toBeTruthy();
      expect(found?.id).toBe(account.id);
      expect(found?.name).toBe('Test Account');
    });

    it('should update account name', async () => {
      const account = await keyringService.createAccount('ethereum', 'Old Name');
      
      keyringService.updateAccountName(account.id, 'New Name');
      
      const updated = keyringService.getAccountByAddress(account.address);
      expect(updated?.name).toBe('New Name');
    });

    it('should export private key', async () => {
      const account = await keyringService.createAccount('ethereum', 'Test');
      
      const privateKey = await keyringService.exportPrivateKey(account.id);
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should derive next account index correctly', async () => {
      const acc1 = await keyringService.createAccount('ethereum', 'Account 1');
      const acc2 = await keyringService.createAccount('ethereum', 'Account 2');
      const acc3 = await keyringService.createAccount('ethereum', 'Account 3');
      
      expect(acc1.index).toBe(0);
      expect(acc2.index).toBe(1);
      expect(acc3.index).toBe(2);
    });
  });

  describe('Signing Operations', () => {
    let account: any;

    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      account = await keyringService.createAccount('ethereum', 'Test Account');
    });

    it('should sign message', async () => {
      const message = 'Hello, OmniBazaar!';
      const signature = await keyringService.signMessage(account.id, message);
      
      expect(signature).toBeTruthy();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    it('should sign transaction', async () => {
      const tx = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7',
        value: '0x1',
        gasPrice: '0x1',
        gasLimit: '0x5208',
        nonce: 0,
        chainId: 1
      };
      
      const signedTx = await keyringService.signTransaction(account.id, tx);
      expect(signedTx).toBeTruthy();
      expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should sign typed data (EIP-712)', async () => {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' }
          ]
        },
        primaryType: 'Person',
        domain: {
          name: 'OmniBazaar',
          version: '1',
          chainId: 1,
          verifyingContract: '0x0000000000000000000000000000000000000000'
        },
        message: {
          name: 'Alice',
          wallet: account.address
        }
      };
      
      const signature = await keyringService.signTypedData(account.id, typedData);
      expect(signature).toBeTruthy();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });
  });

  describe('Persistence', () => {
    it('should persist encrypted vault', async () => {
      const mnemonic = await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Persistent Account');
      
      // Get encrypted vault
      const vault = await keyringService.getEncryptedVault();
      expect(vault).toBeTruthy();
      
      // Reset service
      keyringService['keyring'] = null;
      keyringService['password'] = '';
      
      // Restore from vault
      await keyringService.restoreFromVault(vault, TEST_PASSWORD);
      
      // Check account still exists
      const restored = keyringService.getAccountByAddress(account.address);
      expect(restored).toBeTruthy();
      expect(restored?.name).toBe('Persistent Account');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not unlocked', async () => {
      await expect(
        keyringService.createAccount('ethereum', 'Test')
      ).rejects.toThrow('Keyring is locked');
      
      await expect(
        keyringService.signMessage('any-id', 'message')
      ).rejects.toThrow('Keyring is locked');
    });

    it('should handle invalid chain type', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      await expect(
        keyringService.createAccount('invalid' as any, 'Test')
      ).rejects.toThrow();
    });

    it('should handle non-existent account operations', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      await expect(
        keyringService.signMessage('non-existent-id', 'message')
      ).rejects.toThrow('Account not found');
      
      await expect(
        keyringService.exportPrivateKey('non-existent-id')
      ).rejects.toThrow('Account not found');
    });
  });
});