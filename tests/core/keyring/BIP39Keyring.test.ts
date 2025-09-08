/**
 * BIP39 Keyring Tests
 * Tests mnemonic generation, key derivation, and multi-chain support
 */

import { BIP39Keyring, ChainType } from '../../../src/core/keyring/BIP39Keyring';
import { TEST_MNEMONIC, TEST_PASSWORD, TEST_ADDRESSES } from '../../setup';
import * as bip39 from 'bip39';

describe('BIP39Keyring', () => {
  let keyring: BIP39Keyring;

  beforeEach(() => {
    keyring = new BIP39Keyring();
  });

  describe('Mnemonic Generation', () => {
    it('should generate a valid 12-word mnemonic', () => {
      const mnemonic = keyring.generateMnemonic();
      expect(mnemonic.split(' ')).toHaveLength(12);
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);
    });

    it('should generate a valid 24-word mnemonic', () => {
      const mnemonic = keyring.generateMnemonic(256);
      expect(mnemonic.split(' ')).toHaveLength(24);
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);
    });

    it('should generate different mnemonics each time', () => {
      const mnemonic1 = keyring.generateMnemonic();
      const mnemonic2 = keyring.generateMnemonic();
      expect(mnemonic1).not.toBe(mnemonic2);
    });
  });

  describe('Keyring Initialization', () => {
    it('should initialize from mnemonic', async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
      expect(keyring.isInitialized()).toBe(true);
    });

    it('should reject invalid mnemonic', async () => {
      await expect(
        keyring.initFromMnemonic('invalid mnemonic phrase')
      ).rejects.toThrow();
    });

    it('should lock and unlock with password', async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
      
      const encryptedVault = await keyring.lock(TEST_PASSWORD);
      expect(encryptedVault).toBeTruthy();
      expect(keyring.isInitialized()).toBe(false);
      
      await keyring.unlock(encryptedVault, TEST_PASSWORD);
      expect(keyring.isInitialized()).toBe(true);
    });

    it('should fail to unlock with wrong password', async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
      const encryptedVault = await keyring.lock(TEST_PASSWORD);
      
      await expect(
        keyring.unlock(encryptedVault, 'wrongPassword')
      ).rejects.toThrow();
    });
  });

  describe('Multi-Chain Account Creation', () => {
    beforeEach(async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
    });

    it('should create Ethereum accounts with correct derivation path', () => {
      const account1 = keyring.createAccount(ChainType.Ethereum, 0);
      const account2 = keyring.createAccount(ChainType.Ethereum, 1);
      
      expect(account1.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account2.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account1.address).not.toBe(account2.address);
      expect(account1.derivationPath).toBe("m/44'/60'/0'/0/0");
      expect(account2.derivationPath).toBe("m/44'/60'/0'/0/1");
    });

    it('should create Bitcoin accounts with correct derivation path', () => {
      const account = keyring.createAccount(ChainType.Bitcoin, 0);
      
      expect(account.address).toMatch(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/);
      expect(account.derivationPath).toBe("m/44'/0'/0'/0/0"); // BIP44 for Bitcoin
    });

    it('should create Solana accounts with correct derivation path', () => {
      const account = keyring.createAccount(ChainType.Solana, 0);
      
      expect(account.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(account.derivationPath).toBe("m/44'/501'/0'/0'");
    });

    it('should create Substrate accounts with correct derivation path', () => {
      const account = keyring.createAccount(ChainType.Substrate, 0);
      
      expect(account.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{47,48}$/);
      expect(account.derivationPath).toBe("m/44'/354'/0'/0/0");
    });

    it('should get all accounts', () => {
      keyring.createAccount(ChainType.Ethereum, 0);
      keyring.createAccount(ChainType.Bitcoin, 0);
      keyring.createAccount(ChainType.Solana, 0);
      keyring.createAccount(ChainType.Substrate, 0);
      
      const accounts = keyring.getAccounts();
      expect(accounts).toHaveLength(4);
      expect(accounts.map(a => a.chainType)).toEqual([
        ChainType.Ethereum,
        ChainType.Bitcoin,
        ChainType.Solana,
        ChainType.Substrate
      ]);
    });
  });

  describe('Key Export', () => {
    beforeEach(async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
    });

    it('should export Ethereum private key in hex format', () => {
      const account = keyring.createAccount(ChainType.Ethereum, 0);
      const privateKey = keyring.exportPrivateKey(account.id);
      
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should export Bitcoin private key in WIF format', () => {
      const account = keyring.createAccount(ChainType.Bitcoin, 0);
      const privateKey = keyring.exportPrivateKey(account.id);
      
      // WIF format for mainnet starts with K, L, or 5
      expect(privateKey).toMatch(/^[KL5][1-9A-HJ-NP-Za-km-z]{50,51}$/);
    });

    it('should export Solana private key in base58 format', () => {
      const account = keyring.createAccount(ChainType.Solana, 0);
      const privateKey = keyring.exportPrivateKey(account.id);
      
      // Solana private keys are 64 bytes encoded in base58
      expect(privateKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/);
    });

    it('should export Substrate private key in hex format', () => {
      const account = keyring.createAccount(ChainType.Substrate, 0);
      const privateKey = keyring.exportPrivateKey(account.id);
      
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should throw error for non-existent account', () => {
      expect(() => {
        keyring.exportPrivateKey('non-existent-id');
      }).toThrow('Account not found');
    });
  });

  describe('Message Signing', () => {
    beforeEach(async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
    });

    it('should sign message with Ethereum account', async () => {
      const account = keyring.createAccount(ChainType.Ethereum, 0);
      const message = 'Hello, OmniBazaar!';
      
      const signature = await keyring.signMessage(account.id, message);
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/); // 65 bytes in hex
    });

    it('should sign message with Bitcoin account', async () => {
      const account = keyring.createAccount(ChainType.Bitcoin, 0);
      const message = 'Hello, Bitcoin!';
      
      const signature = await keyring.signMessage(account.id, message);
      expect(signature).toBeTruthy();
      expect(signature.length).toBeGreaterThan(80); // Base64 encoded signature
    });

    it('should sign message with Solana account', async () => {
      const account = keyring.createAccount(ChainType.Solana, 0);
      const message = 'Hello, Solana!';
      
      const signature = await keyring.signMessage(account.id, message);
      expect(signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/); // Base58 encoded
    });

    it('should sign message with Substrate account', async () => {
      const account = keyring.createAccount(ChainType.Substrate, 0);
      const message = 'Hello, Polkadot!';
      
      const signature = await keyring.signMessage(account.id, message);
      expect(signature).toMatch(/^0x[a-fA-F0-9]{128}$/); // 64 bytes in hex
    });
  });

  describe('Transaction Signing', () => {
    beforeEach(async () => {
      await keyring.initFromMnemonic(TEST_MNEMONIC);
    });

    it('should sign Ethereum transaction', async () => {
      const account = keyring.createAccount(ChainType.Ethereum, 0);
      const tx = {
        to: TEST_ADDRESSES.ethereum,
        value: '0x1',
        gasPrice: '0x1',
        gasLimit: '0x5208',
        nonce: 0,
        chainId: 1
      };
      
      const signedTx = await keyring.signTransaction(account.id, tx);
      expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should sign Bitcoin transaction', async () => {
      const account = keyring.createAccount(ChainType.Bitcoin, 0);
      const tx = {
        inputs: [{
          txid: '0'.repeat(64),
          vout: 0,
          scriptPubKey: '00',
          amount: 100000
        }],
        outputs: [{
          address: TEST_ADDRESSES.bitcoin,
          amount: 90000
        }]
      };
      
      const signedTx = await keyring.signTransaction(account.id, tx);
      expect(signedTx).toBeTruthy();
    });

    it('should sign Solana transaction', async () => {
      const account = keyring.createAccount(ChainType.Solana, 0);
      const tx = {
        recentBlockhash: '11111111111111111111111111111111',
        feePayer: account.address,
        instructions: []
      };
      
      const signedTx = await keyring.signTransaction(account.id, tx);
      expect(signedTx).toBeTruthy();
    });
  });

  describe('Account Recovery', () => {
    it('should recover same accounts from same mnemonic', async () => {
      // Create accounts with first keyring
      const keyring1 = new BIP39Keyring();
      await keyring1.initFromMnemonic(TEST_MNEMONIC);
      
      const eth1 = keyring1.createAccount(ChainType.Ethereum, 0);
      const btc1 = keyring1.createAccount(ChainType.Bitcoin, 0);
      const sol1 = keyring1.createAccount(ChainType.Solana, 0);
      
      // Create accounts with second keyring using same mnemonic
      const keyring2 = new BIP39Keyring();
      await keyring2.initFromMnemonic(TEST_MNEMONIC);
      
      const eth2 = keyring2.createAccount(ChainType.Ethereum, 0);
      const btc2 = keyring2.createAccount(ChainType.Bitcoin, 0);
      const sol2 = keyring2.createAccount(ChainType.Solana, 0);
      
      // Addresses should match
      expect(eth1.address).toBe(eth2.address);
      expect(btc1.address).toBe(btc2.address);
      expect(sol1.address).toBe(sol2.address);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum account index', () => {
      keyring.initFromMnemonic(TEST_MNEMONIC);
      
      // Create account with high index
      const account = keyring.createAccount(ChainType.Ethereum, 999999);
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.derivationPath).toBe("m/44'/60'/0'/0/999999");
    });

    it('should prevent operations on uninitialized keyring', () => {
      expect(() => {
        keyring.createAccount(ChainType.Ethereum, 0);
      }).toThrow('Keyring not initialized');
      
      expect(() => {
        keyring.exportPrivateKey('any-id');
      }).toThrow('Keyring not initialized');
    });
  });
});