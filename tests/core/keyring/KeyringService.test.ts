/**
 * KeyringService Tests
 * Tests for keyring functionality including mnemonic consistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { keyringService } from '../../../src/core/keyring/KeyringService';

const TEST_PASSWORD = 'testPassword123!';
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('KeyringService', () => {
  beforeEach(async () => {
    // Clean up any existing wallet
    try {
      await keyringService.lock();
    } catch (error) {
      // Ignore if no wallet exists
    }
  });

  afterEach(async () => {
    // Clean up
    try {
      await keyringService.lock();
    } catch (error) {
      // Ignore
    }
  });

  describe('Mnemonic Consistency', () => {
    it('should derive consistent addresses from same mnemonic', async () => {
      // Create wallet with known mnemonic
      await keyringService.createWallet(TEST_PASSWORD);
      const originalMnemonic = await keyringService.exportSeedPhrase(TEST_PASSWORD);
      
      // Create accounts
      const ethAccount1 = await keyringService.createAccount('ethereum', 'ETH 1');
      const solAccount1 = await keyringService.createAccount('solana', 'SOL 1');
      
      // Lock and restore with same mnemonic
      await keyringService.lock();
      await keyringService.restoreWallet(originalMnemonic, TEST_PASSWORD);
      
      // Create same accounts again
      const ethAccount2 = await keyringService.createAccount('ethereum', 'ETH 2');
      const solAccount2 = await keyringService.createAccount('solana', 'SOL 2');
      
      // Addresses should match for same chain type and index
      expect(ethAccount1.address).toBe(ethAccount2.address);
      expect(solAccount1.address).toBe(solAccount2.address);
    });

    it('should generate different addresses for different chains', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const ethAccount = await keyringService.createAccount('ethereum', 'ETH');
      const solAccount = await keyringService.createAccount('solana', 'SOL');
      const btcAccount = await keyringService.createAccount('bitcoin', 'BTC');
      
      // All addresses should be different
      expect(ethAccount.address).not.toBe(solAccount.address);
      expect(ethAccount.address).not.toBe(btcAccount.address);
      expect(solAccount.address).not.toBe(btcAccount.address);
      
      // Validate address formats
      expect(ethAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(solAccount.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(btcAccount.address).toMatch(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/);
    });

    it('should use deterministic derivation paths', async () => {
      // Create wallet with test mnemonic
      await keyringService.restoreWallet(TEST_MNEMONIC, TEST_PASSWORD);
      
      // Create multiple Ethereum accounts
      const eth1 = await keyringService.createAccount('ethereum', 'ETH 1');
      const eth2 = await keyringService.createAccount('ethereum', 'ETH 2');
      const eth3 = await keyringService.createAccount('ethereum', 'ETH 3');
      
      // Lock and restore
      await keyringService.lock();
      await keyringService.restoreWallet(TEST_MNEMONIC, TEST_PASSWORD);
      
      // Recreate accounts - they should match
      const eth1_restored = await keyringService.createAccount('ethereum', 'ETH 1 Restored');
      const eth2_restored = await keyringService.createAccount('ethereum', 'ETH 2 Restored');
      const eth3_restored = await keyringService.createAccount('ethereum', 'ETH 3 Restored');
      
      expect(eth1.address).toBe(eth1_restored.address);
      expect(eth2.address).toBe(eth2_restored.address);
      expect(eth3.address).toBe(eth3_restored.address);
    });

    it('should maintain account order after restoration', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const mnemonic = await keyringService.exportSeedPhrase(TEST_PASSWORD);
      
      // Create accounts in specific order
      const accounts = [];
      accounts.push(await keyringService.createAccount('ethereum', 'ETH'));
      accounts.push(await keyringService.createAccount('solana', 'SOL'));
      accounts.push(await keyringService.createAccount('ethereum', 'ETH 2'));
      accounts.push(await keyringService.createAccount('bitcoin', 'BTC'));
      
      // Lock and restore
      await keyringService.lock();
      await keyringService.restoreWallet(mnemonic, TEST_PASSWORD);
      
      // Recreate in same order
      const restoredAccounts = [];
      restoredAccounts.push(await keyringService.createAccount('ethereum', 'ETH Restored'));
      restoredAccounts.push(await keyringService.createAccount('solana', 'SOL Restored'));
      restoredAccounts.push(await keyringService.createAccount('ethereum', 'ETH 2 Restored'));
      restoredAccounts.push(await keyringService.createAccount('bitcoin', 'BTC Restored'));
      
      // Check all addresses match
      for (let i = 0; i < accounts.length; i++) {
        expect(accounts[i].address).toBe(restoredAccounts[i].address);
      }
    });
  });

  describe('Invalid Mnemonic Handling', () => {
    it('should reject invalid mnemonic phrases', async () => {
      const invalidMnemonics = [
        'invalid mnemonic phrase',
        'abandon abandon abandon invalid',
        '', // Empty
        'word1 word2 word3', // Too short
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invalid' // Wrong checksum
      ];
      
      for (const mnemonic of invalidMnemonics) {
        await expect(
          keyringService.restoreWallet(mnemonic, TEST_PASSWORD)
        ).rejects.toThrow();
      }
    });

    it('should accept valid mnemonic phrases', async () => {
      const validMnemonics = [
        TEST_MNEMONIC, // 12 words
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art' // 24 words
      ];
      
      for (const mnemonic of validMnemonics) {
        await keyringService.restoreWallet(mnemonic, TEST_PASSWORD);
        
        // Verify wallet is unlocked
        expect(keyringService.isLocked()).toBe(false);
        
        // Clean up for next iteration
        await keyringService.lock();
      }
    });
  });
});