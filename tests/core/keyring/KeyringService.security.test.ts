/**
 * KeyringService Security Tests
 * Comprehensive security tests for critical keyring operations
 */

import { keyringService, KeyringAccount, TransactionRequest } from '../../../src/core/keyring/KeyringService';
import { ethers } from 'ethers';

const TEST_PASSWORD = 'testPassword123!@#$';
const WEAK_PASSWORD = '123';
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_MNEMONIC_24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Well-known test key

describe('KeyringService Security Tests', () => {
  beforeEach(async () => {
    try {
      await keyringService.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    try {
      await keyringService.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Password Security', () => {
    it('should handle password change correctly', async () => {
      const mnemonic = await keyringService.createWallet(TEST_PASSWORD);
      expect(mnemonic).toBeDefined();
      
      // Change password
      const newPassword = 'newSecurePassword123!@#$';
      await keyringService.changePassword(TEST_PASSWORD, newPassword);
      
      // Lock and try to unlock with old password
      await keyringService.lock();
      await expect(keyringService.unlock(TEST_PASSWORD))
        .rejects.toThrow('Invalid password');
      
      // Unlock with new password should work
      await keyringService.unlock(newPassword);
      const state = keyringService.getState();
      expect(state.isLocked).toBe(false);
    });

    it('should reject password change with wrong current password', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      await expect(keyringService.changePassword('wrongPassword', 'newPassword123'))
        .rejects.toThrow('Incorrect password');
    });

    it('should reject password change when wallet is locked', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      await keyringService.lock();
      
      await expect(keyringService.changePassword(TEST_PASSWORD, 'newPassword123'))
        .rejects.toThrow('Wallet is locked');
    });
  });

  describe('Private Key Security', () => {
    it('should export private key only when unlocked', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Test Account');
      
      // Export should work when unlocked
      const privateKey = await keyringService.exportPrivateKey(account.id);
      expect(privateKey).toBeDefined();
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Lock wallet
      await keyringService.lock();
      
      // Export should fail when locked
      await expect(keyringService.exportPrivateKey(account.id))
        .rejects.toThrow('Keyring is locked');
    });

    it('should import account from private key', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const account = await keyringService.addAccountFromPrivateKey(
        TEST_PRIVATE_KEY,
        'Imported Test Account'
      );
      
      expect(account).toBeDefined();
      expect(account.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(account.name).toBe('Imported Test Account');
    });

    it('should reject invalid private key', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      await expect(keyringService.addAccountFromPrivateKey(
        'invalid_private_key',
        'Test'
      )).rejects.toThrow('Invalid private key');
    });

    it('should sanitize account name to prevent XSS', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const maliciousName = '<script>alert("xss")</script>Test';
      const account = await keyringService.addAccountFromPrivateKey(
        TEST_PRIVATE_KEY,
        maliciousName
      );
      
      expect(account.name).toBe('alertxssTest');
      expect(account.name).not.toContain('<script>');
    });
  });

  describe('Message Signing Security', () => {
    it('should sign message correctly', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Signing Account');
      
      const message = 'Hello, OmniBazaar!';
      const signature = await keyringService.signMessage(account.id, message);
      
      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
      
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(account.address.toLowerCase());
    });

    it('should reject signing when wallet is locked', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Test');
      
      await keyringService.lock();
      
      await expect(keyringService.signMessage(account.id, 'test'))
        .rejects.toThrow('Keyring is locked');
    });

    it('should reject signing for non-existent account', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      await expect(keyringService.signMessage('invalid-id', 'test'))
        .rejects.toThrow('Account not found');
    });

    it('should sign typed data (EIP-712)', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'EIP-712 Account');
      
      const typedData = {
        domain: {
          name: 'OmniBazaar',
          version: '1',
          chainId: 1,
          verifyingContract: '0x0000000000000000000000000000000000000000'
        },
        types: {
          Order: [
            { name: 'seller', type: 'address' },
            { name: 'price', type: 'uint256' },
            { name: 'nonce', type: 'uint256' }
          ]
        },
        value: {
          seller: account.address,
          price: '1000000000000000000',
          nonce: 1
        }
      };
      
      const signature = await keyringService.signTypedData(account.id, typedData);
      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });
  });

  describe('Transaction Security', () => {
    let account: KeyringAccount;
    
    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      account = await keyringService.createAccount('ethereum', 'Transaction Account');
    });

    it('should sign valid transaction', async () => {
      const transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '0.1',
        gasLimit: '21000',
        gasPrice: '20000000000'
      };
      
      const signedTx = await keyringService.signTransaction(account.id, transaction);
      expect(signedTx).toBeDefined();
      expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should reject transaction to suspicious addresses', async () => {
      const suspiciousAddresses = [
        '0x0000000000000000000000000000000000000000',
        '0x000000000000000000000000000000000000dEaD',
        '0xffffffffffffffffffffffffffffffffffffffff'
      ];
      
      for (const address of suspiciousAddresses) {
        const transaction: TransactionRequest = {
          to: address,
          value: '0.1'
        };
        
        await expect(keyringService.signTransaction(account.id, transaction))
          .rejects.toThrow('Suspicious recipient address detected');
      }
    });

    it('should reject transaction with invalid recipient', async () => {
      const transaction: TransactionRequest = {
        to: 'invalid-address',
        value: '0.1'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid recipient address');
    });

    it('should reject transaction without recipient', async () => {
      const transaction: TransactionRequest = {
        to: '',
        value: '0.1'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Transaction recipient address is required');
    });

    it('should reject transaction with negative value', async () => {
      const transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '-0.1'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid transaction amount');
    });

    it('should reject transaction exceeding maximum allowed', async () => {
      const transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1000001' // Over 1M ETH
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Transaction amount exceeds maximum allowed');
    });

    it('should validate gas parameters', async () => {
      // Invalid gas limit
      let transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '0.1',
        gasLimit: '0'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid gas limit');
      
      // Gas limit too high
      transaction = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '0.1',
        gasLimit: '20000000'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid gas limit');
      
      // Invalid gas price
      transaction = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '0.1',
        gasPrice: '0'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid gas price');
    });

    it('should validate transaction data field', async () => {
      const transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        data: 'invalid-hex-data'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid transaction data format');
    });

    it('should handle hex value amounts', async () => {
      const transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '0x16345785D8A0000', // 0.1 ETH in hex
        gasLimit: '21000'
      };
      
      const signedTx = await keyringService.signTransaction(account.id, transaction);
      expect(signedTx).toBeDefined();
    });
  });

  describe('Seed Phrase Security', () => {
    it('should export seed phrase with correct password', async () => {
      const mnemonic = await keyringService.createWallet(TEST_PASSWORD);
      
      const exportedMnemonic = await keyringService.exportSeedPhrase(TEST_PASSWORD);
      expect(exportedMnemonic).toBe(mnemonic);
    });

    it('should reject seed phrase export with wrong password', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      await expect(keyringService.exportSeedPhrase('wrongPassword'))
        .rejects.toThrow();
    });

    it('should reject seed phrase export for Web2 wallets', async () => {
      await keyringService.initializeWeb2Wallet('testuser', TEST_PASSWORD);
      
      await expect(keyringService.exportSeedPhrase(TEST_PASSWORD))
        .rejects.toThrow('Seed phrase export only available for Web3 wallets');
    });

    it('should restore wallet from seed phrase', async () => {
      await keyringService.addAccountFromSeed(TEST_MNEMONIC, 'Restored Account');
      
      const accounts = keyringService.getAccounts();
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0].name).toBe('Restored Account');
    });
  });

  describe('Vault Security', () => {
    it('should create and restore encrypted vault', async () => {
      const mnemonic = await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Vault Test');
      
      // Get encrypted vault
      const vault = await keyringService.getEncryptedVault();
      expect(vault).toBeDefined();
      
      // Reset wallet
      await keyringService.cleanup();
      
      // Restore from vault
      await keyringService.restoreFromVault(vault, TEST_PASSWORD);
      
      // Verify restoration
      const state = keyringService.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLocked).toBe(false);
      
      // Verify we can still use the same mnemonic
      const exportedMnemonic = await keyringService.exportSeedPhrase(TEST_PASSWORD);
      expect(exportedMnemonic).toBe(mnemonic);
    });

    it('should fail to restore vault with wrong password', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const vault = await keyringService.getEncryptedVault();
      
      await keyringService.cleanup();
      
      await expect(keyringService.restoreFromVault(vault, 'wrongPassword'))
        .rejects.toThrow();
    });
  });

  describe('State Management Security', () => {
    it('should not expose sensitive data in state', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'State Test');
      
      const state = keyringService.getState();
      
      // State should not contain sensitive data
      expect(JSON.stringify(state)).not.toContain(TEST_PASSWORD);
      expect(JSON.stringify(state)).not.toContain('privateKey');
      expect(JSON.stringify(state)).not.toContain('mnemonic');
      
      // State should contain safe data
      expect(state.accounts).toContainEqual(expect.objectContaining({
        address: account.address,
        name: 'State Test'
      }));
    });

    it('should properly track lock/unlock state', async () => {
      let state = keyringService.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isLocked).toBe(true);
      
      await keyringService.createWallet(TEST_PASSWORD);
      state = keyringService.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLocked).toBe(false);
      expect(state.isUnlocked).toBe(true);
      
      await keyringService.lock();
      state = keyringService.getState();
      expect(state.isLocked).toBe(true);
      expect(state.isUnlocked).toBe(false);
    });
  });

  describe('Username Resolution Security', () => {
    it('should resolve ENS names', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      // This will likely return null in test environment
      const address = await keyringService.resolveUsername('vitalik.eth');
      // Just verify it doesn't throw
      expect(address === null || ethers.isAddress(address || '')).toBe(true);
    });

    it('should handle OmniCoin usernames', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const address = await keyringService.resolveUsername('testuser.omnibazaar');
      expect(address === null || ethers.isAddress(address || '')).toBe(true);
    });

    it('should handle invalid usernames gracefully', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const invalidUsernames = [
        '',
        'a'.repeat(1000), // Very long
        '<script>alert("xss")</script>',
        'user@evil.com'
      ];
      
      for (const username of invalidUsernames) {
        const address = await keyringService.resolveUsername(username);
        expect(address === null || ethers.isAddress(address || '')).toBe(true);
      }
    });
  });

  describe('Web2 Authentication Security', () => {
    it('should initialize Web2 wallet', async () => {
      const session = await keyringService.initializeWeb2Wallet('testuser', TEST_PASSWORD);
      
      expect(session).toBeDefined();
      expect(session.username).toBe('testuser');
      expect(session.accounts).toBeDefined();
      
      const state = keyringService.getState();
      expect(state.authMethod).toBe('web2');
      expect(state.isLocked).toBe(false);
    });

    it('should not allow account creation in Web2 mode', async () => {
      await keyringService.initializeWeb2Wallet('testuser', TEST_PASSWORD);
      
      await expect(keyringService.createAccount('ethereum', 'Test'))
        .rejects.toThrow('Web2 wallets use fixed accounts');
    });
  });

  describe('Account Management Security', () => {
    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
    });

    it('should update account name safely', async () => {
      const account = await keyringService.createAccount('ethereum', 'Original Name');
      
      keyringService.updateAccountName(account.id, 'New Name');
      
      const updatedAccount = keyringService.getAccountByAddress(account.address);
      expect(updatedAccount?.name).toBe('New Name');
    });

    it('should filter accounts by chain', async () => {
      await keyringService.createAccount('ethereum', 'ETH 1');
      await keyringService.createAccount('ethereum', 'ETH 2');
      await keyringService.createAccount('bitcoin', 'BTC 1');
      await keyringService.createAccount('solana', 'SOL 1');
      
      const ethAccounts = keyringService.getAccountsByChain('ethereum');
      expect(ethAccounts).toHaveLength(2);
      expect(ethAccounts.every(acc => acc.chainType === 'ethereum')).toBe(true);
      
      const btcAccounts = keyringService.getAccountsByChain('bitcoin');
      expect(btcAccounts).toHaveLength(1);
      expect(btcAccounts[0].name).toBe('BTC 1');
    });

    it('should set and get active account', async () => {
      const acc1 = await keyringService.createAccount('ethereum', 'Account 1');
      const acc2 = await keyringService.createAccount('ethereum', 'Account 2');
      
      // First account should be active by default
      let active = keyringService.getActiveAccount();
      expect(active?.id).toBe(acc1.id);
      
      // Set second account as active
      keyringService.setActiveAccount(acc2.id);
      active = keyringService.getActiveAccount();
      expect(active?.id).toBe(acc2.id);
      
      // Can also set by address
      keyringService.setActiveAccount(acc1.address);
      active = keyringService.getActiveAccount();
      expect(active?.id).toBe(acc1.id);
    });
  });

  describe('Reset and Cleanup Security', () => {
    it('should completely reset wallet state', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      await keyringService.createAccount('ethereum', 'Test Account');
      
      await keyringService.reset();
      
      const state = keyringService.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isLocked).toBe(true);
      expect(state.accounts).toHaveLength(0);
      expect(state.activeAccount).toBeNull();
      expect(state.authMethod).toBeNull();
    });

    it('should cleanup all sensitive data', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Test');
      
      await keyringService.cleanup();
      
      // Verify complete cleanup
      const state = keyringService.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isLocked).toBe(true);
      expect(state.accounts).toHaveLength(0);
      
      // Should not be able to perform operations
      await expect(keyringService.signMessage(account.id, 'test'))
        .rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle operations on uninitialized wallet', async () => {
      await expect(keyringService.unlock(TEST_PASSWORD))
        .rejects.toThrow('Wallet not initialized');
      
      await expect(keyringService.exportSeedPhrase(TEST_PASSWORD))
        .rejects.toThrow();
      
      await expect(keyringService.signMessage('any-id', 'test'))
        .rejects.toThrow('Keyring is locked');
    });

    it('should handle concurrent operations safely', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      // Try concurrent account creation
      const promises = Array.from({ length: 5 }, (_, i) => 
        keyringService.createAccount('ethereum', `Concurrent ${i}`)
      );
      
      const accounts = await Promise.all(promises);
      
      // All accounts should be unique
      const addresses = accounts.map(acc => acc.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(5);
    });

    it('should handle provider initialization failures gracefully', async () => {
      // Even if providers fail to initialize, basic operations should work
      await keyringService.initialize();
      await keyringService.createWallet(TEST_PASSWORD);
      
      const account = await keyringService.createAccount('ethereum', 'Test');
      expect(account).toBeDefined();
      
      // Simulate provider failure by clearing the ethereum provider
      (keyringService as any).providers.delete('ethereum');
      
      // Balance check should gracefully fall back to 0 instead of throwing
      const balance = await keyringService.getBalance(account.address);
      expect(balance).toBe('0'); // Falls back to 0 on error
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize transaction inputs', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const account = await keyringService.createAccount('ethereum', 'Test');
      
      const transaction: TransactionRequest = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65<script>',
        value: '0.1',
        data: '0x1234<script>alert("xss")</script>'
      };
      
      await expect(keyringService.signTransaction(account.id, transaction))
        .rejects.toThrow('Invalid recipient address');
    });

    it('should handle very long inputs', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const longName = 'a'.repeat(1500);
      const account = await keyringService.addAccountFromPrivateKey(
        TEST_PRIVATE_KEY,
        longName
      );
      
      // Should truncate to reasonable length
      expect(account.name.length).toBeLessThanOrEqual(1000);
    });
  });
});