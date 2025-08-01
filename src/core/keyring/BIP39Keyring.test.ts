/**
 * BIP39Keyring Tests
 */

import { BIP39Keyring, createBIP39Keyring } from './BIP39Keyring';
import * as bip39 from 'bip39';

// Mock browser storage
jest.mock('../storage/common/browser-storage', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      const storage = new Map();
      return {
        get: jest.fn((key) => Promise.resolve(storage.get(key))),
        set: jest.fn((key, value) => {
          storage.set(key, value);
          return Promise.resolve();
        }),
        clear: jest.fn(() => {
          storage.clear();
          return Promise.resolve();
        })
      };
    })
  };
});

describe('BIP39Keyring', () => {
  let keyring: BIP39Keyring;
  const testPassword = 'test-password-12345';
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  beforeEach(() => {
    keyring = createBIP39Keyring('test-wallet');
  });

  afterEach(async () => {
    await keyring.reset();
  });

  describe('Initialization', () => {
    it('should initialize with a new mnemonic', async () => {
      const mnemonic = await keyring.initialize({ password: testPassword });
      
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);
      expect(mnemonic.split(' ')).toHaveLength(24); // Default is 24 words
      expect(await keyring.isInitialized()).toBe(true);
      expect(keyring.locked()).toBe(false);
    });

    it('should initialize with a provided mnemonic', async () => {
      const mnemonic = await keyring.initialize({ 
        password: testPassword, 
        mnemonic: testMnemonic 
      });
      
      expect(mnemonic).toBe(testMnemonic);
      expect(await keyring.isInitialized()).toBe(true);
    });

    it('should initialize with different seed phrase lengths', async () => {
      const lengths = [12, 15, 18, 21, 24] as const;
      
      for (const length of lengths) {
        const newKeyring = createBIP39Keyring(`test-wallet-${length}`);
        const mnemonic = await newKeyring.initialize({ 
          password: testPassword,
          seedPhraseLength: length
        });
        
        expect(mnemonic.split(' ')).toHaveLength(length);
        await newKeyring.reset();
      }
    });

    it('should throw error if already initialized', async () => {
      await keyring.initialize({ password: testPassword });
      
      await expect(keyring.initialize({ password: testPassword }))
        .rejects.toThrow('Wallet is already initialized');
    });

    it('should throw error for invalid mnemonic', async () => {
      await expect(keyring.initialize({ 
        password: testPassword,
        mnemonic: 'invalid mnemonic phrase' 
      })).rejects.toThrow('Invalid mnemonic phrase');
    });
  });

  describe('Lock/Unlock', () => {
    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
    });

    it('should unlock with correct password', async () => {
      keyring.lock();
      expect(keyring.locked()).toBe(true);
      
      await keyring.unlock(testPassword);
      expect(keyring.locked()).toBe(false);
    });

    it('should throw error with incorrect password', async () => {
      keyring.lock();
      
      await expect(keyring.unlock('wrong-password'))
        .rejects.toThrow('Failed to unlock wallet: Invalid password');
      expect(keyring.locked()).toBe(true);
    });

    it('should throw error when unlocking uninitialized wallet', async () => {
      const newKeyring = createBIP39Keyring('new-test-wallet');
      
      await expect(newKeyring.unlock(testPassword))
        .rejects.toThrow('Wallet is not initialized');
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
    });

    it('should create Ethereum account', async () => {
      const account = await keyring.createAccount('ethereum');
      
      expect(account.chainType).toBe('ethereum');
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.publicKey).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(account.derivationPath).toBe("m/44'/60'/0'/0/0");
      expect(account.name).toBe('Ethereum Account 1');
    });

    it('should create Bitcoin account', async () => {
      const account = await keyring.createAccount('bitcoin');
      
      expect(account.chainType).toBe('bitcoin');
      expect(account.address).toMatch(/^bc1[a-z0-9]+$/); // Bech32 address
      expect(account.derivationPath).toBe("m/44'/0'/0'/0/0");
      expect(account.name).toBe('Bitcoin Account 1');
    });

    it('should create Solana account', async () => {
      const account = await keyring.createAccount('solana');
      
      expect(account.chainType).toBe('solana');
      expect(account.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/); // Base58 address
      expect(account.derivationPath).toBe("m/44'/501'/0'/0/0");
      expect(account.name).toBe('Solana Account 1');
    });

    it('should create COTI account', async () => {
      const account = await keyring.createAccount('coti');
      
      expect(account.chainType).toBe('coti');
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/); // Ethereum-compatible
      expect(account.derivationPath).toBe("m/44'/60'/0'/0/0");
    });

    it('should create OmniCoin account', async () => {
      const account = await keyring.createAccount('omnicoin');
      
      expect(account.chainType).toBe('omnicoin');
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/); // Ethereum-compatible
      expect(account.derivationPath).toBe("m/44'/9999'/0'/0/0"); // Custom coin type
    });

    it('should create multiple accounts with correct indices', async () => {
      const account1 = await keyring.createAccount('ethereum');
      const account2 = await keyring.createAccount('ethereum');
      const account3 = await keyring.createAccount('ethereum');
      
      expect(account1.derivationPath).toBe("m/44'/60'/0'/0/0");
      expect(account2.derivationPath).toBe("m/44'/60'/0'/0/1");
      expect(account3.derivationPath).toBe("m/44'/60'/0'/0/2");
      
      expect(account1.name).toBe('Ethereum Account 1');
      expect(account2.name).toBe('Ethereum Account 2');
      expect(account3.name).toBe('Ethereum Account 3');
    });

    it('should create account with custom name', async () => {
      const account = await keyring.createAccount('ethereum', 'My Custom Account');
      
      expect(account.name).toBe('My Custom Account');
    });

    it('should throw error when wallet is locked', async () => {
      keyring.lock();
      
      await expect(keyring.createAccount('ethereum'))
        .rejects.toThrow('Wallet is locked');
    });
  });

  describe('Account Retrieval', () => {
    let ethAccount1: any;
    let ethAccount2: any;
    let btcAccount: any;

    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
      ethAccount1 = await keyring.createAccount('ethereum');
      ethAccount2 = await keyring.createAccount('ethereum');
      btcAccount = await keyring.createAccount('bitcoin');
    });

    it('should get all accounts', async () => {
      const accounts = await keyring.getAccounts();
      
      expect(accounts).toHaveLength(3);
      expect(accounts).toContainEqual(ethAccount1);
      expect(accounts).toContainEqual(ethAccount2);
      expect(accounts).toContainEqual(btcAccount);
    });

    it('should get accounts by chain type', async () => {
      const ethAccounts = await keyring.getAccounts('ethereum');
      const btcAccounts = await keyring.getAccounts('bitcoin');
      
      expect(ethAccounts).toHaveLength(2);
      expect(ethAccounts).toContainEqual(ethAccount1);
      expect(ethAccounts).toContainEqual(ethAccount2);
      
      expect(btcAccounts).toHaveLength(1);
      expect(btcAccounts).toContainEqual(btcAccount);
    });

    it('should get account by address', async () => {
      const account = await keyring.getAccount(ethAccount1.address);
      
      expect(account).toEqual(ethAccount1);
    });

    it('should return null for non-existent address', async () => {
      const account = await keyring.getAccount('0xnonexistent');
      
      expect(account).toBeNull();
    });

    it('should return empty array when wallet data is not loaded', async () => {
      keyring.lock();
      const accounts = await keyring.getAccounts();
      
      expect(accounts).toEqual([]);
    });
  });

  describe('Message Signing', () => {
    let ethAccount: any;
    const testMessage = 'Hello OmniBazaar!';

    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
      ethAccount = await keyring.createAccount('ethereum');
    });

    it('should sign message with Ethereum account', async () => {
      const result = await keyring.signMessage(ethAccount.address, testMessage);
      
      expect(result.signature).toBeDefined();
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(result.messageHash).toBeDefined();
      expect(result.messageHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should throw error when wallet is locked', async () => {
      keyring.lock();
      
      await expect(keyring.signMessage(ethAccount.address, testMessage))
        .rejects.toThrow('Wallet is locked');
    });

    it('should throw error for non-existent account', async () => {
      await expect(keyring.signMessage('0xnonexistent', testMessage))
        .rejects.toThrow('Account not found');
    });
  });

  describe('Transaction Signing', () => {
    let ethAccount: any;
    const testTransaction = {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f06789',
      value: '1000000000000000000', // 1 ETH
      gasLimit: 21000,
      gasPrice: '20000000000',
      nonce: 0,
      chainId: 1
    };

    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
      ethAccount = await keyring.createAccount('ethereum');
    });

    it('should sign Ethereum transaction', async () => {
      const result = await keyring.signTransaction(ethAccount.address, testTransaction);
      
      expect(result.signedTransaction).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should throw error when wallet is locked', async () => {
      keyring.lock();
      
      await expect(keyring.signTransaction(ethAccount.address, testTransaction))
        .rejects.toThrow('Wallet is locked');
    });
  });

  describe('Mnemonic Recovery', () => {
    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
    });

    it('should retrieve mnemonic with correct password', async () => {
      const mnemonic = await keyring.getMnemonic(testPassword);
      
      expect(mnemonic).toBe(testMnemonic);
    });

    it('should throw error with incorrect password', async () => {
      await expect(keyring.getMnemonic('wrong-password'))
        .rejects.toThrow();
    });

    it('should throw error when no mnemonic exists', async () => {
      const newKeyring = createBIP39Keyring('empty-wallet');
      
      await expect(newKeyring.getMnemonic(testPassword))
        .rejects.toThrow('No mnemonic found');
    });
  });

  describe('Wallet Reset', () => {
    beforeEach(async () => {
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
      await keyring.createAccount('ethereum');
    });

    it('should reset wallet and clear all data', async () => {
      expect(await keyring.isInitialized()).toBe(true);
      expect(keyring.locked()).toBe(false);
      
      await keyring.reset();
      
      expect(await keyring.isInitialized()).toBe(false);
      expect(keyring.locked()).toBe(true);
      expect(await keyring.getAccounts()).toEqual([]);
    });
  });

  describe('Security', () => {
    it('should use strong encryption parameters', async () => {
      // Test that sensitive data is not exposed
      await keyring.initialize({ password: testPassword, mnemonic: testMnemonic });
      
      // Check that the keyring instance doesn't expose sensitive data
      const keyringStr = JSON.stringify(keyring);
      expect(keyringStr).not.toContain(testMnemonic);
      expect(keyringStr).not.toContain(testPassword);
    });

    it('should generate unique IDs', async () => {
      await keyring.initialize({ password: testPassword });
      
      const account1 = await keyring.createAccount('ethereum');
      const account2 = await keyring.createAccount('ethereum');
      
      expect(account1.id).not.toBe(account2.id);
      expect(account1.id).toMatch(/^[a-f0-9]{32}$/);
    });
  });
});