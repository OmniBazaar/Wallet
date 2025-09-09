/**
 * KeyringService Tests
 * Tests for keyring functionality including mnemonic consistency
 */

import { keyringService } from '../../../src/core/keyring/KeyringService';

const TEST_PASSWORD = 'testPassword123!';
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('KeyringService', () => {
  beforeEach(async () => {
    // Clean up any existing wallet
    try {
      // Force reset the service
      const state = keyringService.getState();
      if (state.isInitialized) {
        await keyringService.lock();
      }
    } catch (error) {
      // Ignore if no wallet exists
    }
  });

  afterEach(async () => {
    try {
      await keyringService.lock();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Wallet Creation', () => {
    it('should create a new wallet', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const state = keyringService.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLocked).toBe(false);
    });

    it('should restore wallet from mnemonic', async () => {
      await keyringService.restoreWallet(TEST_MNEMONIC, TEST_PASSWORD);
      
      const state = keyringService.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLocked).toBe(false);
    });

    it('should export mnemonic with password', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      const mnemonic = await keyringService.exportSeedPhrase(TEST_PASSWORD);
      
      expect(mnemonic).toBeDefined();
      expect(mnemonic.split(' ')).toHaveLength(12);
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
    });

    it('should create Ethereum account', async () => {
      const account = await keyringService.createAccount('ethereum', 'ETH Account');
      
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.name).toBe('ETH Account');
      expect(account.chainType).toBe('ethereum');
    });

    it('should create Solana account', async () => {
      const account = await keyringService.createAccount('solana', 'SOL Account');
      
      expect(account.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(account.name).toBe('SOL Account');
      expect(account.chainType).toBe('solana');
    });

    it('should create Bitcoin account', async () => {
      const account = await keyringService.createAccount('bitcoin', 'BTC Account');
      
      expect(account.address).toMatch(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/);
      expect(account.name).toBe('BTC Account');
      expect(account.chainType).toBe('bitcoin');
    });

    it('should list all accounts', async () => {
      await keyringService.createAccount('ethereum', 'ETH 1');
      await keyringService.createAccount('solana', 'SOL 1');
      await keyringService.createAccount('ethereum', 'ETH 2');
      
      const accounts = await keyringService.getAccounts();
      expect(accounts.length).toBeGreaterThanOrEqual(3);
      
      // Check that our accounts are in the list
      const accountNames = accounts.map(acc => acc.name);
      expect(accountNames).toContain('ETH 1');
      expect(accountNames).toContain('SOL 1');
      expect(accountNames).toContain('ETH 2');
    });
  });

  describe('Wallet Locking', () => {
    beforeEach(async () => {
      await keyringService.createWallet(TEST_PASSWORD);
    });

    it('should lock wallet', async () => {
      await keyringService.lock();
      
      const state = keyringService.getState();
      expect(state.isLocked).toBe(true);
    });

    it('should unlock wallet with password', async () => {
      await keyringService.lock();
      await keyringService.unlock(TEST_PASSWORD);
      
      const state = keyringService.getState();
      expect(state.isLocked).toBe(false);
    });

    it('should fail to unlock with wrong password', async () => {
      await keyringService.lock();
      
      await expect(keyringService.unlock('wrong password'))
        .rejects.toThrow();
    });
  });

  describe('Invalid Mnemonic Handling', () => {
    it('should reject invalid mnemonic phrases', async () => {
      const invalidMnemonics = [
        'invalid mnemonic phrase',
        'abandon abandon abandon invalid',
        '', // Empty
        'word1 word2 word3', // Too short
      ];
      
      for (const mnemonic of invalidMnemonics) {
        await expect(keyringService.restoreWallet(mnemonic, TEST_PASSWORD))
          .rejects.toThrow();
      }
    });

    it('should accept valid mnemonic phrases', async () => {
      const validMnemonics = [
        TEST_MNEMONIC, // 12 words
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art', // 24 words
      ];
      
      for (const mnemonic of validMnemonics) {
        await keyringService.restoreWallet(mnemonic, TEST_PASSWORD);
        
        // Verify wallet is unlocked by checking state
        const state = keyringService.getState();
        expect(state.isLocked).toBe(false);
        
        // Clean up for next iteration
        await keyringService.lock();
      }
    });
  });

  describe('Account Derivation', () => {
    it('should generate different addresses for different chains', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const ethAccount = await keyringService.createAccount('ethereum', 'ETH');
      const solAccount = await keyringService.createAccount('solana', 'SOL');
      const btcAccount = await keyringService.createAccount('bitcoin', 'BTC');
      
      // All addresses should be different
      expect(ethAccount.address).not.toBe(solAccount.address);
      expect(ethAccount.address).not.toBe(btcAccount.address);
      expect(solAccount.address).not.toBe(btcAccount.address);
    });

    it('should generate different addresses for multiple accounts on same chain', async () => {
      await keyringService.createWallet(TEST_PASSWORD);
      
      const eth1 = await keyringService.createAccount('ethereum', 'ETH 1');
      const eth2 = await keyringService.createAccount('ethereum', 'ETH 2');
      const eth3 = await keyringService.createAccount('ethereum', 'ETH 3');
      
      // All addresses should be different
      expect(eth1.address).not.toBe(eth2.address);
      expect(eth1.address).not.toBe(eth3.address);
      expect(eth2.address).not.toBe(eth3.address);
    });
  });
});