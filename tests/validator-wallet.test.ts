/**
 * Validator Wallet Integration Tests
 * 
 * Tests for Wallet module integration with Validator services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValidatorWalletService } from '../src/services/ValidatorWallet';
import { ValidatorTransactionService } from '../src/services/ValidatorTransaction';
import { ValidatorBalanceService } from '../src/services/ValidatorBalance';
import { KYCTier } from '../src/types';

// Mock the validator client
vi.mock('../../Validator/src/client/ValidatorClient');

describe('Validator Wallet Integration Tests', () => {
  let walletService: ValidatorWalletService;
  let transactionService: ValidatorTransactionService;
  let balanceService: ValidatorBalanceService;
  
  const mockWalletConfig = {
    validatorEndpoint: 'localhost:3000',
    networkId: 'test-network',
    userId: 'test-user-123',
    enableSecureStorage: true,
    autoBackup: false
  };
  
  const mockTransactionConfig = {
    validatorEndpoint: 'localhost:3000',
    networkId: 'test-network',
    userId: 'test-user-123',
    enableFeeDistribution: true,
    maxRetries: 3
  };
  
  const mockBalanceConfig = {
    validatorEndpoint: 'localhost:3000',
    networkId: 'test-network',
    userId: 'test-user-123',
    enableCaching: true,
    cacheTimeout: 30000,
    enableHistoryTracking: true
  };

  beforeEach(() => {
    walletService = new ValidatorWalletService(mockWalletConfig);
    transactionService = new ValidatorTransactionService(mockTransactionConfig);
    balanceService = new ValidatorBalanceService(mockBalanceConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ValidatorWalletService', () => {
    describe('initialization', () => {
      it('should initialize successfully', async () => {
        await expect(walletService.initialize()).resolves.not.toThrow();
      });

      it('should handle initialization errors', async () => {
        const invalidService = new ValidatorWalletService({
          ...mockWalletConfig,
          validatorEndpoint: 'invalid-endpoint'
        });
        
        await expect(invalidService.initialize()).rejects.toThrow('Wallet initialization failed');
      });
    });

    describe('account management', () => {
      beforeEach(async () => {
        await walletService.initialize();
      });

      it('should create a new mnemonic account', async () => {
        const account = await walletService.createAccount(
          'Test Account',
          'mnemonic',
          'ethereum'
        );
        
        expect(account).toBeDefined();
        expect(account.name).toBe('Test Account');
        expect(account.type).toBe('mnemonic');
        expect(account.chainId).toBe('ethereum');
        expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });

      it('should create a new private key account', async () => {
        const privateKey = '0x' + '1'.repeat(64);
        const account = await walletService.createAccount(
          'Private Key Account',
          'private-key',
          'ethereum',
          { privateKey }
        );
        
        expect(account).toBeDefined();
        expect(account.name).toBe('Private Key Account');
        expect(account.type).toBe('private-key');
        expect(account.chainId).toBe('ethereum');
      });

      it('should import an existing account', async () => {
        const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
        const account = await walletService.importAccount(
          'Imported Account',
          mnemonic,
          'ethereum'
        );
        
        expect(account).toBeDefined();
        expect(account.name).toBe('Imported Account');
        expect(account.type).toBe('mnemonic');
      });

      it('should set and get active account', async () => {
        const account = await walletService.createAccount(
          'Active Account',
          'mnemonic',
          'ethereum'
        );
        
        walletService.setActiveAccount(account.id);
        const activeAccount = walletService.getActiveAccount();
        
        expect(activeAccount).toBeDefined();
        expect(activeAccount?.id).toBe(account.id);
      });

      it('should remove account', async () => {
        const account = await walletService.createAccount(
          'Removable Account',
          'mnemonic',
          'ethereum'
        );
        
        const initialCount = walletService.getAccounts().length;
        await walletService.removeAccount(account.id);
        
        expect(walletService.getAccounts().length).toBe(initialCount - 1);
        expect(walletService.getAccount(account.id)).toBeUndefined();
      });
    });

    describe('transaction operations', () => {
      let testAccount: any;
      
      beforeEach(async () => {
        await walletService.initialize();
        testAccount = await walletService.createAccount(
          'Test Account',
          'mnemonic',
          'ethereum'
        );
      });

      it('should send transaction', async () => {
        const txRequest = {
          from: testAccount.address,
          to: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          value: '0.1',
          chainId: 'ethereum'
        };
        
        const result = await walletService.sendTransaction(txRequest);
        
        expect(result.success).toBe(true);
        expect(result.txHash).toBeDefined();
      });

      it('should handle transaction errors', async () => {
        const txRequest = {
          from: 'invalid-address',
          to: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          value: '0.1',
          chainId: 'ethereum'
        };
        
        const result = await walletService.sendTransaction(txRequest);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should sign message', async () => {
        const message = 'Test message';
        const signature = await walletService.signMessage(testAccount.id, message);
        
        expect(signature).toBeDefined();
        expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
      });
    });

    describe('ENS resolution', () => {
      beforeEach(async () => {
        await walletService.initialize();
      });

      it('should resolve ENS name', async () => {
        const resolution = await walletService.resolveENS('test.eth');
        
        if (resolution) {
          expect(resolution.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
          expect(resolution.name).toBe('test.eth');
        }
      });

      it('should handle invalid ENS name', async () => {
        const resolution = await walletService.resolveENS('invalid.eth');
        expect(resolution).toBeNull();
      });
    });

    describe('wallet backup and restore', () => {
      beforeEach(async () => {
        await walletService.initialize();
      });

      it('should create wallet backup', async () => {
        const password = 'test-password';
        const backup = await walletService.backupWallet(password);
        
        expect(backup).toBeDefined();
        expect(backup.id).toBeDefined();
        expect(backup.encryptedData).toBeDefined();
        expect(backup.checksum).toBeDefined();
      });

      it('should restore wallet from backup', async () => {
        const password = 'test-password';
        const backup = await walletService.backupWallet(password);
        
        // Create a new account before restore
        await walletService.createAccount('Before Restore', 'mnemonic', 'ethereum');
        
        // Restore from backup
        await walletService.restoreWallet(backup, password);
        
        // Verify restoration
        const accounts = walletService.getAccounts();
        expect(accounts.length).toBeGreaterThan(0);
      });
    });

    describe('balance operations', () => {
      beforeEach(async () => {
        await walletService.initialize();
      });

      it('should update account balance', async () => {
        const account = await walletService.createAccount(
          'Balance Account',
          'mnemonic',
          'ethereum'
        );
        
        const balance = await walletService.updateAccountBalance(account.id);
        
        expect(balance).toBeDefined();
        expect(typeof balance).toBe('string');
      });

      it('should update all balances', async () => {
        await walletService.createAccount('Account 1', 'mnemonic', 'ethereum');
        await walletService.createAccount('Account 2', 'mnemonic', 'ethereum');
        
        await expect(walletService.updateAllBalances()).resolves.not.toThrow();
      });
    });

    describe('disconnection', () => {
      it('should disconnect cleanly', async () => {
        await walletService.initialize();
        await expect(walletService.disconnect()).resolves.not.toThrow();
      });
    });
  });

  describe('ValidatorTransactionService', () => {
    describe('initialization', () => {
      it('should initialize successfully', async () => {
        await expect(transactionService.initialize()).resolves.not.toThrow();
      });
    });

    describe('transaction operations', () => {
      beforeEach(async () => {
        await transactionService.initialize();
      });

      it('should send transaction', async () => {
        const tx = await transactionService.sendTransaction(
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          '0.1'
        );
        
        expect(tx).toBeDefined();
        expect(tx.from).toBe('0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09');
        expect(tx.to).toBe('0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09');
        expect(tx.value).toBe('0.1');
        expect(tx.status).toBe('pending');
      });

      it('should estimate gas', async () => {
        const estimate = await transactionService.estimateGas(
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          '0.1'
        );
        
        expect(estimate).toBeDefined();
        expect(estimate.gasLimit).toBeDefined();
        expect(estimate.gasPrice).toBeDefined();
        expect(estimate.totalCost).toBeDefined();
      });

      it('should get transaction count', async () => {
        const count = await transactionService.getTransactionCount(
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
        );
        
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it('should get gas price', async () => {
        const gasPrice = await transactionService.getGasPrice();
        
        expect(gasPrice).toBeDefined();
        expect(typeof gasPrice).toBe('string');
      });
    });

    describe('batch transactions', () => {
      beforeEach(async () => {
        await transactionService.initialize();
      });

      it('should send batch transactions', async () => {
        const transactions = [
          {
            from: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
            to: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
            value: '0.1'
          },
          {
            from: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
            to: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
            value: '0.2'
          }
        ];
        
        const batch = await transactionService.sendBatchTransactions(transactions);
        
        expect(batch).toBeDefined();
        expect(batch.transactions.length).toBe(2);
        expect(batch.status).toBe('processing');
      });
    });

    describe('transaction history', () => {
      beforeEach(async () => {
        await transactionService.initialize();
      });

      it('should get pending transactions', () => {
        const pending = transactionService.getPendingTransactions();
        expect(Array.isArray(pending)).toBe(true);
      });

      it('should get transaction history', () => {
        const history = transactionService.getTransactionHistory();
        expect(Array.isArray(history)).toBe(true);
      });

      it('should export transaction history', () => {
        const jsonExport = transactionService.exportTransactionHistory('json');
        expect(typeof jsonExport).toBe('string');
        expect(() => JSON.parse(jsonExport)).not.toThrow();
        
        const csvExport = transactionService.exportTransactionHistory('csv');
        expect(typeof csvExport).toBe('string');
        expect(csvExport).toContain('ID,Hash,From,To,Value,Status,Block,Timestamp');
      });
    });

    describe('disconnection', () => {
      it('should disconnect cleanly', async () => {
        await transactionService.initialize();
        await expect(transactionService.disconnect()).resolves.not.toThrow();
      });
    });
  });

  describe('ValidatorBalanceService', () => {
    describe('initialization', () => {
      it('should initialize successfully', async () => {
        await expect(balanceService.initialize()).resolves.not.toThrow();
      });
    });

    describe('balance operations', () => {
      beforeEach(async () => {
        await balanceService.initialize();
      });

      it('should get account balance', async () => {
        const balance = await balanceService.getBalance(
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
        );
        
        expect(balance).toBeDefined();
        expect(balance.address).toBe('0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09');
        expect(balance.nativeBalance).toBeDefined();
        expect(balance.nativeBalanceFormatted).toBeDefined();
        expect(Array.isArray(balance.tokens)).toBe(true);
      });

      it('should get multiple balances', async () => {
        const addresses = [
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
        ];
        
        const balances = await balanceService.getMultipleBalances(addresses);
        
        expect(balances).toBeDefined();
        expect(Object.keys(balances).length).toBe(2);
      });

      it('should get token balances', async () => {
        const tokens = await balanceService.getTokenBalances(
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
        );
        
        expect(Array.isArray(tokens)).toBe(true);
        tokens.forEach(token => {
          expect(token.address).toBeDefined();
          expect(token.symbol).toBeDefined();
          expect(token.balance).toBeDefined();
        });
      });
    });

    describe('price operations', () => {
      beforeEach(async () => {
        await balanceService.initialize();
      });

      it('should get token price', async () => {
        const price = await balanceService.getTokenPrice('ETH');
        
        if (price) {
          expect(price.symbol).toBe('ETH');
          expect(price.price).toBeDefined();
          expect(price.lastUpdated).toBeDefined();
        }
      });
    });

    describe('balance history', () => {
      beforeEach(async () => {
        await balanceService.initialize();
      });

      it('should get balance history', () => {
        const history = balanceService.getBalanceHistory(
          '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
        );
        
        expect(Array.isArray(history)).toBe(true);
      });
    });

    describe('portfolio operations', () => {
      beforeEach(async () => {
        await balanceService.initialize();
      });

      it('should get portfolio summary', () => {
        const summary = balanceService.getPortfolioSummary();
        
        expect(summary).toBeDefined();
        expect(summary.totalAccounts).toBeDefined();
        expect(summary.totalValueUSD).toBeDefined();
        expect(Array.isArray(summary.topTokens)).toBe(true);
      });

      it('should export balance data', () => {
        const jsonExport = balanceService.exportBalanceData('json');
        expect(typeof jsonExport).toBe('string');
        expect(() => JSON.parse(jsonExport)).not.toThrow();
        
        const csvExport = balanceService.exportBalanceData('csv');
        expect(typeof csvExport).toBe('string');
        expect(csvExport).toContain('Address,Native Balance,Total Value USD,Last Updated');
      });
    });

    describe('cache operations', () => {
      beforeEach(async () => {
        await balanceService.initialize();
      });

      it('should clear cache', () => {
        expect(() => balanceService.clearCache()).not.toThrow();
      });
    });

    describe('disconnection', () => {
      it('should disconnect cleanly', async () => {
        await balanceService.initialize();
        await expect(balanceService.disconnect()).resolves.not.toThrow();
      });
    });
  });

  describe('Integration flows', () => {
    beforeEach(async () => {
      await walletService.initialize();
      await transactionService.initialize();
      await balanceService.initialize();
    });

    afterEach(async () => {
      await walletService.disconnect();
      await transactionService.disconnect();
      await balanceService.disconnect();
    });

    it('should complete full wallet transaction flow', async () => {
      // Step 1: Create account
      const account = await walletService.createAccount(
        'Integration Test Account',
        'mnemonic',
        'ethereum'
      );
      
      expect(account).toBeDefined();
      
      // Step 2: Get initial balance
      const initialBalance = await balanceService.getBalance(account.address);
      expect(initialBalance).toBeDefined();
      
      // Step 3: Estimate gas for transaction
      const gasEstimate = await transactionService.estimateGas(
        account.address,
        '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
        '0.1'
      );
      
      expect(gasEstimate).toBeDefined();
      
      // Step 4: Send transaction
      const tx = await transactionService.sendTransaction(
        account.address,
        '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
        '0.1'
      );
      
      expect(tx.status).toBe('pending');
      
      // Step 5: Check transaction in history
      const history = transactionService.getTransactionHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should handle multiple accounts with balance tracking', async () => {
      // Create multiple accounts
      const accounts = await Promise.all([
        walletService.createAccount('Account 1', 'mnemonic', 'ethereum'),
        walletService.createAccount('Account 2', 'mnemonic', 'ethereum'),
        walletService.createAccount('Account 3', 'mnemonic', 'ethereum')
      ]);
      
      expect(accounts.length).toBe(3);
      
      // Get balances for all accounts
      const addresses = accounts.map(acc => acc.address);
      const balances = await balanceService.getMultipleBalances(addresses);
      
      expect(Object.keys(balances).length).toBe(3);
      
      // Start balance updates for all accounts
      balanceService.startBalanceUpdates(addresses, 5000);
      
      // Stop updates
      balanceService.stopBalanceUpdates();
    });

    it('should handle ENS resolution and transactions', async () => {
      // Create account
      const account = await walletService.createAccount(
        'ENS Test Account',
        'mnemonic',
        'ethereum'
      );
      
      // Try to resolve ENS name
      const resolution = await walletService.resolveENS('test.eth');
      
      if (resolution) {
        // Send transaction to ENS address
        const tx = await transactionService.sendTransaction(
          account.address,
          resolution.address,
          '0.01'
        );
        
        expect(tx.to).toBe(resolution.address);
      }
    });

    it('should handle backup and restore workflow', async () => {
      // Create accounts
      const account1 = await walletService.createAccount('Backup Account 1', 'mnemonic', 'ethereum');
      const account2 = await walletService.createAccount('Backup Account 2', 'mnemonic', 'ethereum');
      
      // Create backup
      const backup = await walletService.backupWallet('backup-password');
      expect(backup).toBeDefined();
      
      // Clear current accounts
      await walletService.removeAccount(account1.id);
      await walletService.removeAccount(account2.id);
      
      expect(walletService.getAccounts().length).toBe(0);
      
      // Restore from backup
      await walletService.restoreWallet(backup, 'backup-password');
      
      // Verify accounts restored
      const restoredAccounts = walletService.getAccounts();
      expect(restoredAccounts.length).toBe(2);
    });
  });

  describe('Error handling', () => {
    it('should handle service initialization failures', async () => {
      const invalidWalletService = new ValidatorWalletService({
        validatorEndpoint: '',
        networkId: '',
        userId: '',
        enableSecureStorage: false,
        autoBackup: false
      });
      
      await expect(invalidWalletService.initialize()).rejects.toThrow();
    });

    it('should handle network connectivity issues', async () => {
      const offlineService = new ValidatorWalletService({
        validatorEndpoint: 'offline-endpoint',
        networkId: 'offline-network',
        userId: 'test-user',
        enableSecureStorage: true,
        autoBackup: false
      });
      
      await expect(offlineService.initialize()).rejects.toThrow();
    });

    it('should handle invalid transaction parameters', async () => {
      await transactionService.initialize();
      
      const invalidTx = transactionService.sendTransaction(
        'invalid-address',
        '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
        '0.1'
      );
      
      await expect(invalidTx).rejects.toThrow();
    });

    it('should handle balance service errors gracefully', async () => {
      await balanceService.initialize();
      
      const balance = await balanceService.getBalance('invalid-address');
      expect(balance).toBeDefined(); // Should return default values
    });
  });

  describe('Performance tests', () => {
    beforeEach(async () => {
      await walletService.initialize();
      await transactionService.initialize();
      await balanceService.initialize();
    });

    it('should handle multiple concurrent account creations', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          walletService.createAccount(`Account ${i}`, 'mnemonic', 'ethereum')
        );
      }
      
      const accounts = await Promise.all(promises);
      expect(accounts.length).toBe(5);
      
      // Verify all accounts are unique
      const addresses = accounts.map(acc => acc.address);
      const uniqueAddresses = [...new Set(addresses)];
      expect(uniqueAddresses.length).toBe(5);
    });

    it('should handle batch balance updates efficiently', async () => {
      // Create test accounts
      const accounts = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          walletService.createAccount(`Batch Account ${i}`, 'mnemonic', 'ethereum')
        )
      );
      
      const addresses = accounts.map(acc => acc.address);
      
      // Measure balance update time
      const startTime = Date.now();
      const balances = await balanceService.getMultipleBalances(addresses);
      const endTime = Date.now();
      
      expect(Object.keys(balances).length).toBe(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent transaction processing', async () => {
      const account = await walletService.createAccount('Concurrent Test', 'mnemonic', 'ethereum');
      
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          transactionService.sendTransaction(
            account.address,
            '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
            '0.01'
          )
        );
      }
      
      const transactions = await Promise.all(promises);
      expect(transactions.length).toBe(3);
      
      // Verify all transactions have unique hashes
      const hashes = transactions.map(tx => tx.hash);
      const uniqueHashes = [...new Set(hashes)];
      expect(uniqueHashes.length).toBe(3);
    });
  });
});

// Test utilities
class WalletTestUtils {
  static createMockAccount(overrides: Partial<any> = {}) {
    return {
      id: 'test-account-id',
      address: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
      name: 'Test Account',
      type: 'mnemonic',
      chainId: 'ethereum',
      balance: '0',
      derivationPath: "m/44'/60'/0'/0/0",
      metadata: {
        createdAt: Date.now(),
        lastUsed: Date.now()
      },
      ...overrides
    };
  }
  
  static createMockTransaction(overrides: Partial<any> = {}) {
    return {
      id: 'test-tx-id',
      hash: '0x' + '1'.repeat(64),
      from: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
      to: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
      value: '0.1',
      data: '0x',
      chainId: 'ethereum',
      nonce: 1,
      gasLimit: '21000',
      gasPrice: '20000000000',
      status: 'pending',
      confirmations: 0,
      timestamp: Date.now(),
      ...overrides
    };
  }
  
  static createMockBalance(overrides: Partial<any> = {}) {
    return {
      address: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
      nativeBalance: '1000000000000000000',
      nativeBalanceFormatted: '1.0',
      tokens: [],
      totalValueUSD: '0',
      lastUpdated: Date.now(),
      ...overrides
    };
  }
  
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 5000
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Condition not met within timeout');
  }
  
  static generateRandomAddress(): string {
    return '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
  
  static generateRandomHash(): string {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

export { WalletTestUtils };