/**
 * ValidatorWallet Tests
 * Comprehensive tests for financial-critical multi-chain wallet operations
 */

import { 
  ValidatorWalletService,
  ValidatorWalletConfig,
  WalletAccount,
  TransactionRequest,
  TransactionResult,
  WalletBackup,
  ENSResolution
} from '../../src/services/ValidatorWallet';
import { ethers } from 'ethers';

// Mock the AvalancheValidatorClient
jest.mock('../../Validator/src/client/AvalancheValidatorClient', () => ({
  createAvalancheValidatorClient: jest.fn(() => ({
    checkHealth: jest.fn().mockResolvedValue({ data: { health: { healthy: true } } }),
    query: jest.fn(),
    mutate: jest.fn(),
    storeDocument: jest.fn().mockResolvedValue('ipfs-hash-123'),
    resolveUsername: jest.fn()
  }))
}));

// Mock crypto API for testing
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    importKey: jest.fn().mockResolvedValue({}),
    deriveKey: jest.fn().mockResolvedValue({}),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  }
};

(global as any).crypto = mockCrypto;

describe('ValidatorWalletService', () => {
  let service: ValidatorWalletService;
  const config: ValidatorWalletConfig = {
    validatorEndpoint: 'http://localhost:4000',
    wsEndpoint: 'ws://localhost:4000/graphql',
    apiKey: 'test-api-key',
    networkId: 'test-network',
    userId: 'test-user-123',
    enableSecureStorage: true,
    autoBackup: false // Disable for tests
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new ValidatorWalletService(config);
    await service.initialize();
  });

  afterEach(async () => {
    await service.disconnect();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new ValidatorWalletService(config);
      await expect(newService.initialize()).resolves.not.toThrow();
    });

    it('should fail initialization when validator is unhealthy', async () => {
      const mockClient = require('../../Validator/src/client/AvalancheValidatorClient');
      mockClient.createAvalancheValidatorClient.mockReturnValueOnce({
        checkHealth: jest.fn().mockResolvedValue({ data: { health: { healthy: false } } })
      });

      const newService = new ValidatorWalletService(config);
      await expect(newService.initialize())
        .rejects.toThrow('Validator service is not healthy');
    });

    it('should handle initialization errors', async () => {
      const mockClient = require('../../Validator/src/client/AvalancheValidatorClient');
      mockClient.createAvalancheValidatorClient.mockReturnValueOnce({
        checkHealth: jest.fn().mockRejectedValue(new Error('Connection failed'))
      });

      const newService = new ValidatorWalletService(config);
      await expect(newService.initialize())
        .rejects.toThrow('Wallet initialization failed');
    });
  });

  describe('Configuration Management', () => {
    it('should update user ID', () => {
      const newUserId = 'new-user-456';
      service.setUserId(newUserId);
      expect(service.getConfig().userId).toBe(newUserId);
    });

    it('should expose readonly configuration', () => {
      const config = service.getConfig();
      expect(config.validatorEndpoint).toBe('http://localhost:4000');
      expect(config.networkId).toBe('test-network');
      expect(config.enableSecureStorage).toBe(true);
    });
  });

  describe('Account Creation', () => {
    it('should create mnemonic account', async () => {
      const account = await service.createAccount(
        'Test Account',
        'mnemonic',
        '1'
      );

      expect(account).toBeDefined();
      expect(account.id).toBeDefined();
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.name).toBe('Test Account');
      expect(account.type).toBe('mnemonic');
      expect(account.chainId).toBe('1');
      expect(account.balance).toBe('0');
      expect(account.derivationPath).toBe("m/44'/60'/0'/0/0");
      expect(account.publicKey).toBeDefined();
    });

    it('should create account from provided mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      
      const account = await service.createAccount(
        'Imported Account',
        'mnemonic',
        '1',
        { mnemonic }
      );

      expect(account.address).toBe('0x9d27527Ada2CF29fBDAB2973cfa243845a08Bd3F');
      expect(account.type).toBe('mnemonic');
    });

    it('should create private key account', async () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      
      const account = await service.createAccount(
        'Private Key Account',
        'private-key',
        '1',
        { privateKey }
      );

      expect(account.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(account.type).toBe('private-key');
      expect(account.derivationPath).toBeUndefined();
    });

    it('should throw error for private key without key', async () => {
      await expect(service.createAccount(
        'Invalid Account',
        'private-key',
        '1'
      )).rejects.toThrow('Private key required');
    });

    it('should throw error for unsupported account type', async () => {
      await expect(service.createAccount(
        'Hardware Account',
        'ledger',
        '1'
      )).rejects.toThrow('ledger support not yet implemented');
    });

    it('should throw when not initialized', async () => {
      const uninitService = new ValidatorWalletService(config);
      
      await expect(uninitService.createAccount('Test', 'mnemonic', '1'))
        .rejects.toThrow('Wallet service not initialized');
    });

    it('should update reactive references', async () => {
      const account = await service.createAccount('Test', 'mnemonic', '1');
      
      expect(service.accountsRef.value).toHaveLength(1);
      expect(service.accountsRef.value[0].id).toBe(account.id);
    });
  });

  describe('Account Import', () => {
    it('should import mnemonic account', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      
      const account = await service.importAccount(
        'Imported Mnemonic',
        mnemonic,
        '1'
      );

      expect(account.type).toBe('mnemonic');
      expect(account.address).toBe('0x9d27527Ada2CF29fBDAB2973cfa243845a08Bd3F');
    });

    it('should import private key account', async () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      
      const account = await service.importAccount(
        'Imported Private Key',
        privateKey,
        '1'
      );

      expect(account.type).toBe('private-key');
      expect(account.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should auto-detect mnemonic vs private key', async () => {
      // Test with 12 words (mnemonic)
      const mnemonic = 'abandon '.repeat(11) + 'about';
      const mnemonicAccount = await service.importAccount('Test1', mnemonic.trim(), '1');
      expect(mnemonicAccount.type).toBe('mnemonic');

      // Test with hex string (private key)
      const privateKey = '0x' + 'a'.repeat(64);
      const keyAccount = await service.importAccount('Test2', privateKey, '1');
      expect(keyAccount.type).toBe('private-key');
    });
  });

  describe('Account Management', () => {
    let account1: WalletAccount;
    let account2: WalletAccount;

    beforeEach(async () => {
      account1 = await service.createAccount('Account 1', 'mnemonic', '1');
      account2 = await service.createAccount('Account 2', 'mnemonic', '1');
    });

    it('should get all accounts', () => {
      const accounts = service.getAccounts();
      expect(accounts).toHaveLength(2);
      expect(accounts.map(a => a.name)).toContain('Account 1');
      expect(accounts.map(a => a.name)).toContain('Account 2');
    });

    it('should get account by ID', () => {
      const account = service.getAccount(account1.id);
      expect(account).toBeDefined();
      expect(account?.name).toBe('Account 1');
    });

    it('should return undefined for non-existent account', () => {
      const account = service.getAccount('non-existent-id');
      expect(account).toBeUndefined();
    });

    it('should set active account', () => {
      service.setActiveAccount(account2.id);
      
      const activeAccount = service.getActiveAccount();
      expect(activeAccount).toBeDefined();
      expect(activeAccount?.id).toBe(account2.id);
      expect(service.activeAccountRef.value?.id).toBe(account2.id);
    });

    it('should throw when setting non-existent active account', () => {
      expect(() => service.setActiveAccount('non-existent-id'))
        .toThrow('Account not found');
    });

    it('should remove account', async () => {
      await service.removeAccount(account1.id);
      
      const accounts = service.getAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe(account2.id);
    });

    it('should update active account when removing current active', async () => {
      service.setActiveAccount(account1.id);
      await service.removeAccount(account1.id);
      
      const activeAccount = service.getActiveAccount();
      expect(activeAccount?.id).toBe(account2.id);
    });

    it('should clear active account when removing last account', async () => {
      await service.removeAccount(account1.id);
      await service.removeAccount(account2.id);
      
      const activeAccount = service.getActiveAccount();
      expect(activeAccount).toBeNull();
    });

    it('should throw when removing non-existent account', async () => {
      await expect(service.removeAccount('non-existent-id'))
        .rejects.toThrow('Account not found');
    });
  });

  describe('Balance Management', () => {
    let account: WalletAccount;

    beforeEach(async () => {
      account = await service.createAccount('Balance Test', 'mnemonic', '1');
    });

    it('should update account balance', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { account: { balance: '1000000000000000000' } }
      });

      const balance = await service.updateAccountBalance(account.id);
      
      expect(balance).toBe('1000000000000000000');
      expect(account.balance).toBe('1000000000000000000');
      expect(service.balancesRef.value[account.address]).toBe('1000000000000000000');
    });

    it('should handle balance query errors', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      const balance = await service.updateAccountBalance(account.id);
      expect(balance).toBe('0');
    });

    it('should update all balances', async () => {
      const account2 = await service.createAccount('Balance Test 2', 'mnemonic', '1');
      
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { account: { balance: '2000000000000000000' } }
      });

      await service.updateAllBalances();
      
      expect(account.balance).toBe('2000000000000000000');
      expect(account2.balance).toBe('2000000000000000000');
    });

    it('should throw for non-existent account', async () => {
      await expect(service.updateAccountBalance('non-existent'))
        .rejects.toThrow('Account not found');
    });
  });

  describe('Transaction Sending', () => {
    let account: WalletAccount;
    const mockPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    beforeEach(async () => {
      account = await service.createAccount(
        'Transaction Test',
        'private-key',
        '1',
        { privateKey: mockPrivateKey }
      );
      
      // Mock getAccountPrivateKey to return our test key
      jest.spyOn(service as any, 'getAccountPrivateKey')
        .mockResolvedValue(mockPrivateKey);
    });

    it('should send transaction successfully', async () => {
      const mockClient = service['client'];
      mockClient.mutate = jest.fn().mockResolvedValue({
        data: {
          sendRawTransaction: {
            success: true,
            transactionHash: '0x1234567890abcdef',
            blockNumber: 12345,
            confirmations: 1
          }
        }
      });

      const request: TransactionRequest = {
        from: account.address,
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1',
        chainId: '1'
      };

      const result = await service.sendTransaction(request);
      
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('0x1234567890abcdef');
      expect(result.blockNumber).toBe(12345);
      expect(result.confirmations).toBe(1);
    });

    it('should handle transaction failure', async () => {
      const mockClient = service['client'];
      mockClient.mutate = jest.fn().mockResolvedValue({
        data: {
          sendRawTransaction: {
            success: false,
            error: 'Insufficient funds'
          }
        }
      });

      const request: TransactionRequest = {
        from: account.address,
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1000',
        chainId: '1'
      };

      const result = await service.sendTransaction(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });

    it('should validate transaction request', async () => {
      // Invalid from address
      await expect(service.sendTransaction({
        from: 'invalid',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1',
        chainId: '1'
      })).rejects.toThrow('Invalid from address');

      // Invalid to address
      await expect(service.sendTransaction({
        from: account.address,
        to: 'invalid',
        value: '1',
        chainId: '1'
      })).rejects.toThrow('Invalid to address');

      // Invalid value
      await expect(service.sendTransaction({
        from: account.address,
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: 'invalid',
        chainId: '1'
      })).rejects.toThrow('Invalid transaction value');

      // Missing chainId
      await expect(service.sendTransaction({
        from: account.address,
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1',
        chainId: ''
      })).rejects.toThrow('Chain ID required');
    });

    it('should handle account not found', async () => {
      const request: TransactionRequest = {
        from: '0x0000000000000000000000000000000000000000',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1',
        chainId: '1'
      };

      const result = await service.sendTransaction(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account not found for signing');
    });

    it('should handle missing private key', async () => {
      jest.spyOn(service as any, 'getAccountPrivateKey')
        .mockResolvedValue(null);

      const request: TransactionRequest = {
        from: account.address,
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1',
        chainId: '1'
      };

      const result = await service.sendTransaction(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Private key not available');
    });

    it('should include optional transaction parameters', async () => {
      const mockClient = service['client'];
      let capturedSignedTx: string = '';
      
      mockClient.mutate = jest.fn().mockImplementation(({ variables }) => {
        capturedSignedTx = variables.signedTx;
        return Promise.resolve({
          data: { sendRawTransaction: { success: true, transactionHash: '0xabc' } }
        });
      });

      const request: TransactionRequest = {
        from: account.address,
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
        value: '1',
        chainId: '1',
        nonce: 5,
        gasLimit: '50000',
        gasPrice: '20000000000',
        data: '0x123456',
        type: 2
      };

      await service.sendTransaction(request);
      
      expect(capturedSignedTx).toBeDefined();
      expect(capturedSignedTx.startsWith('0x')).toBe(true);
    });
  });

  describe('Message Signing', () => {
    let account: WalletAccount;
    const mockPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    beforeEach(async () => {
      account = await service.createAccount(
        'Signing Test',
        'private-key',
        '1',
        { privateKey: mockPrivateKey }
      );
      
      jest.spyOn(service as any, 'getAccountPrivateKey')
        .mockResolvedValue(mockPrivateKey);
    });

    it('should sign message', async () => {
      const message = 'Hello, OmniBazaar!';
      
      const signature = await service.signMessage(account.id, message);
      
      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
      
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(account.address.toLowerCase());
    });

    it('should throw for non-existent account', async () => {
      await expect(service.signMessage('non-existent', 'test'))
        .rejects.toThrow('Account not found');
    });

    it('should throw when private key not available', async () => {
      jest.spyOn(service as any, 'getAccountPrivateKey')
        .mockResolvedValue(null);

      await expect(service.signMessage(account.id, 'test'))
        .rejects.toThrow('Private key not available');
    });
  });

  describe('ENS Resolution', () => {
    it('should resolve OmniCoin username', async () => {
      const mockClient = service['client'];
      mockClient.resolveUsername = jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockClient.query = jest.fn().mockResolvedValue({
        data: {
          usernameRegistration: {
            metadata: {
              email: 'user@example.com',
              website: 'https://example.com',
              twitter: '@user',
              avatar: 'https://avatar.com/user.png',
              description: 'Test user'
            }
          }
        }
      });

      const resolution = await service.resolveENS('testuser');
      
      expect(resolution).toBeDefined();
      expect(resolution?.address).toBe('0x1234567890123456789012345678901234567890');
      expect(resolution?.name).toBe('testuser');
      expect(resolution?.avatar).toBe('https://avatar.com/user.png');
      expect(resolution?.description).toBe('Test user');
      expect(resolution?.social).toEqual({
        twitter: '@user',
        website: 'https://example.com'
      });
      expect(resolution?.verified).toBe(true);
    });

    it('should handle .omnibazaar suffix', async () => {
      const mockClient = service['client'];
      mockClient.resolveUsername = jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockClient.query = jest.fn().mockResolvedValue({ data: {} });

      await service.resolveENS('testuser.omnibazaar');
      
      expect(mockClient.resolveUsername).toHaveBeenCalledWith('testuser');
    });

    it('should return null for unresolved names', async () => {
      const mockClient = service['client'];
      mockClient.resolveUsername = jest.fn().mockResolvedValue(null);

      const resolution = await service.resolveENS('unknown');
      
      expect(resolution).toBeNull();
    });

    it('should handle resolution errors', async () => {
      const mockClient = service['client'];
      mockClient.resolveUsername = jest.fn().mockRejectedValue(new Error('Network error'));

      const resolution = await service.resolveENS('error');
      
      expect(resolution).toBeNull();
    });
  });

  describe('Wallet Backup and Restore', () => {
    let account: WalletAccount;
    const backupPassword = 'backup-password-123';

    beforeEach(async () => {
      account = await service.createAccount('Backup Test', 'mnemonic', '1');
      
      // Mock text encoder/decoder for crypto operations
      (global as any).TextEncoder = class {
        encode(text: string) {
          return new Uint8Array(Array.from(text, c => c.charCodeAt(0)));
        }
      };
      
      (global as any).TextDecoder = class {
        decode(data: Uint8Array) {
          return String.fromCharCode(...data);
        }
      };
    });

    it('should create wallet backup', async () => {
      const backup = await service.backupWallet(backupPassword);
      
      expect(backup).toBeDefined();
      expect(backup.id).toBeDefined();
      expect(backup.userId).toBe('test-user-123');
      expect(backup.encryptedData).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.version).toBe('1.0.0');
      expect(backup.checksum).toBeDefined();
    });

    it('should throw when secure storage disabled', async () => {
      const insecureService = new ValidatorWalletService({
        ...config,
        enableSecureStorage: false
      });
      await insecureService.initialize();

      await expect(insecureService.backupWallet(backupPassword))
        .rejects.toThrow('Secure storage not enabled');
    });

    it('should restore wallet from backup', async () => {
      // Create backup
      const backup = await service.backupWallet(backupPassword);
      
      // Clear current accounts
      await service.removeAccount(account.id);
      expect(service.getAccounts()).toHaveLength(0);
      
      // Mock decryption to return proper backup data
      mockCrypto.subtle.decrypt = jest.fn().mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({
          accounts: [account],
          activeAccountId: account.id,
          timestamp: Date.now(),
          version: '1.0.0'
        }))
      );
      
      // Restore from backup
      await service.restoreWallet(backup, backupPassword);
      
      // Verify restoration
      const accounts = service.getAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe(account.id);
      expect(accounts[0].address).toBe(account.address);
    });

    it('should verify backup checksum', async () => {
      const backup = await service.backupWallet(backupPassword);
      
      // Corrupt the backup
      backup.checksum = 'invalid-checksum';
      
      await expect(service.restoreWallet(backup, backupPassword))
        .rejects.toThrow('Backup data corrupted');
    });

    it('should handle backup errors', async () => {
      const mockClient = service['client'];
      mockClient.storeDocument = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(service.backupWallet(backupPassword))
        .rejects.toThrow();
    });
  });

  describe('Private Key Export', () => {
    let account: WalletAccount;
    const mockPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const exportPassword = 'export-password';

    beforeEach(async () => {
      account = await service.createAccount(
        'Export Test',
        'private-key',
        '1',
        { privateKey: mockPrivateKey }
      );
      
      jest.spyOn(service as any, 'getAccountPrivateKey')
        .mockResolvedValue(mockPrivateKey);
      jest.spyOn(service as any, 'verifyPassword')
        .mockResolvedValue(undefined);
    });

    it('should export private key with password', async () => {
      const exportedKey = await service.exportPrivateKey(account.id, exportPassword);
      
      expect(exportedKey).toBe(mockPrivateKey);
    });

    it('should verify password before export', async () => {
      const verifyPasswordSpy = jest.spyOn(service as any, 'verifyPassword');
      
      await service.exportPrivateKey(account.id, exportPassword);
      
      expect(verifyPasswordSpy).toHaveBeenCalledWith(exportPassword);
    });

    it('should throw on invalid password', async () => {
      jest.spyOn(service as any, 'verifyPassword')
        .mockRejectedValue(new Error('Invalid password'));

      await expect(service.exportPrivateKey(account.id, 'wrong-password'))
        .rejects.toThrow('Invalid password');
    });

    it('should throw when private key not available', async () => {
      jest.spyOn(service as any, 'getAccountPrivateKey')
        .mockResolvedValue(null);

      await expect(service.exportPrivateKey(account.id, exportPassword))
        .rejects.toThrow('Private key not available');
    });
  });

  describe('Transaction History', () => {
    it('should get transaction history', async () => {
      const mockTransactions = [
        {
          hash: '0x123',
          from: '0xabc',
          to: '0xdef',
          value: '1000000000000000000',
          timestamp: Date.now(),
          blockNumber: 12345,
          status: 'success',
          gasUsed: '21000',
          gasPrice: '20000000000'
        }
      ];

      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: {
          transactionHistory: {
            transactions: mockTransactions,
            total: 1
          }
        }
      });

      const history = await service.getTransactionHistory('0xabc');
      
      expect(history).toHaveLength(1);
      expect(history[0].hash).toBe('0x123');
      expect(history[0].value).toBe('1000000000000000000');
    });

    it('should handle history query with options', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { transactionHistory: { transactions: [] } }
      });

      await service.getTransactionHistory('0xabc', {
        limit: 100,
        offset: 50,
        chainId: '1'
      });
      
      expect(mockClient.query).toHaveBeenCalledWith({
        query: expect.any(Object),
        variables: {
          address: '0xabc',
          limit: 100,
          offset: 50
        }
      });
    });

    it('should handle history query errors', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      const history = await service.getTransactionHistory('0xabc');
      
      expect(history).toEqual([]);
    });
  });

  describe('Gas Estimation', () => {
    it('should estimate gas for transaction', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { estimateGas: '50000' }
      });

      const request: TransactionRequest = {
        from: '0xabc',
        to: '0xdef',
        value: '1',
        chainId: '1'
      };

      const gasEstimate = await service.estimateGas(request);
      
      expect(gasEstimate).toBe('50000');
    });

    it('should use default gas estimate on error', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { estimateGas: null }
      });

      const request: TransactionRequest = {
        from: '0xabc',
        to: '0xdef',
        value: '1',
        chainId: '1'
      };

      const gasEstimate = await service.estimateGas(request);
      
      expect(gasEstimate).toBe('21000');
    });
  });

  describe('Gas Price', () => {
    it('should get current gas price', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { gasPrice: '50000000000' }
      });

      const gasPrice = await service.getGasPrice();
      
      expect(gasPrice).toBe('50000000000');
    });

    it('should use default gas price on error', async () => {
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { gasPrice: null }
      });

      const gasPrice = await service.getGasPrice();
      
      expect(gasPrice).toBe('1000000000'); // 1 gwei default
    });
  });

  describe('Disconnection', () => {
    it('should disconnect and clear data', async () => {
      // Create some accounts
      await service.createAccount('Test 1', 'mnemonic', '1');
      await service.createAccount('Test 2', 'mnemonic', '1');
      
      // Disconnect
      await service.disconnect();
      
      // Verify data is cleared
      expect(service.getAccounts()).toHaveLength(0);
      expect(service.getActiveAccount()).toBeNull();
      expect(service.accountsRef.value).toHaveLength(0);
      expect(service.activeAccountRef.value).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockClient = require('../../Validator/src/client/AvalancheValidatorClient');
      mockClient.createAvalancheValidatorClient.mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const newService = new ValidatorWalletService(config);
      await expect(newService.initialize()).rejects.toThrow();
      
      consoleSpy.mockRestore();
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, async (_, i) => {
        return service.createAccount(`Concurrent ${i}`, 'mnemonic', '1');
      });
      
      const accounts = await Promise.all(operations);
      
      expect(accounts).toHaveLength(5);
      const addresses = accounts.map(a => a.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(5);
    });
  });

  describe('Reactive References', () => {
    it('should update reactive account list', async () => {
      expect(service.accountsRef.value).toHaveLength(0);
      
      const account1 = await service.createAccount('Test 1', 'mnemonic', '1');
      expect(service.accountsRef.value).toHaveLength(1);
      
      const account2 = await service.createAccount('Test 2', 'mnemonic', '1');
      expect(service.accountsRef.value).toHaveLength(2);
      
      await service.removeAccount(account1.id);
      expect(service.accountsRef.value).toHaveLength(1);
      expect(service.accountsRef.value[0].id).toBe(account2.id);
    });

    it('should update reactive active account', async () => {
      expect(service.activeAccountRef.value).toBeNull();
      
      const account = await service.createAccount('Test', 'mnemonic', '1');
      service.setActiveAccount(account.id);
      
      expect(service.activeAccountRef.value).toBeDefined();
      expect(service.activeAccountRef.value?.id).toBe(account.id);
    });

    it('should update reactive balances', async () => {
      const account = await service.createAccount('Test', 'mnemonic', '1');
      
      const mockClient = service['client'];
      mockClient.query = jest.fn().mockResolvedValue({
        data: { account: { balance: '5000000000000000000' } }
      });

      await service.updateAccountBalance(account.id);
      
      expect(service.balancesRef.value[account.address]).toBe('5000000000000000000');
    });
  });
});