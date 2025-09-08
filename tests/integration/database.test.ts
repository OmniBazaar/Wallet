/**
 * Database Integration Tests for Wallet
 * Tests wallet database operations, storage, and synchronization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { WalletDatabase, WalletAccountData } from '../../src/services/WalletDatabase';
import { TransactionDatabase, TransactionData } from '../../src/services/TransactionDatabase';
import { NFTDatabase, NFTData } from '../../src/services/NFTDatabase';
import { TEST_ADDRESSES, MOCK_NFTS, clearMockStores } from '../setup';

describe('Wallet Database Integration', () => {
  let walletDB: WalletDatabase;
  let transactionDB: TransactionDatabase;
  let nftDB: NFTDatabase;

  // Mock data for testing
  const mockAccount: WalletAccountData = {
    id: 'test-account-1',
    address: TEST_ADDRESSES.ethereum,
    name: 'Test Account',
    type: 'generated',
    chainId: 1,
    publicKey: '0x04a8b8c7d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5',
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    isActive: true
  };

  const mockTransaction: TransactionData = {
    id: 'tx-test-1',
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    from: TEST_ADDRESSES.ethereum,
    to: '0x742d35Cc6636C0532925a3b8F0d9df0f01426443',
    value: '1000000000000000000',
    gasPrice: '20000000000',
    gasLimit: '21000',
    gasUsed: '21000',
    nonce: 1,
    blockNumber: 12345,
    blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    status: 'confirmed',
    timestamp: Date.now(),
    chainId: 1,
    data: '0x',
    receipt: null
  };

  const mockNFT: NFTData = {
    id: 'nft-test-1',
    contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    tokenId: '1234',
    owner: TEST_ADDRESSES.ethereum,
    name: 'Test NFT',
    description: 'A test NFT',
    image: 'https://example.com/nft.png',
    chainId: 1,
    metadata: {
      attributes: [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Size', value: 'Large' }
      ]
    }
  };

  beforeAll(async () => {
    walletDB = new WalletDatabase();
    transactionDB = new TransactionDatabase();
    nftDB = new NFTDatabase();
    
    await walletDB.init();
    await transactionDB.init();
    await nftDB.init();
  });

  afterAll(async () => {
    await walletDB.cleanup();
    await transactionDB.cleanup();
    await nftDB.cleanup();
  });

  beforeEach(async () => {
    // Clear mock store data and reset database clear methods
    clearMockStores();
    await walletDB.clear();
    await transactionDB.clear();
    await nftDB.clear();
  });

  describe('Wallet Account Storage', () => {
    it('should save and retrieve wallet account data', async () => {
      const success = await walletDB.saveAccount(mockAccount);
      expect(success).toBe(true);
      
      const retrieved = await walletDB.getAccount(mockAccount.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.address).toBe(mockAccount.address);
      expect(retrieved?.name).toBe(mockAccount.name);
      expect(retrieved?.type).toBe(mockAccount.type);
    });

    it('should handle multiple wallet accounts', async () => {
      const accounts: WalletAccountData[] = [
        {
          ...mockAccount,
          id: 'account-1',
          address: '0x111111111111111111111111111111111111111111',
          name: 'Account 1'
        },
        {
          ...mockAccount,
          id: 'account-2', 
          address: '0x222222222222222222222222222222222222222222',
          name: 'Account 2'
        },
        {
          ...mockAccount,
          id: 'account-3',
          address: '0x333333333333333333333333333333333333333333', 
          name: 'Account 3'
        }
      ];

      for (const account of accounts) {
        const success = await walletDB.saveAccount(account);
        expect(success).toBe(true);
      }

      const allAccounts = await walletDB.getAccounts();
      expect(allAccounts).toHaveLength(3);
      expect(allAccounts.map(a => a.name)).toEqual(['Account 1', 'Account 2', 'Account 3']);
    });

    it('should query accounts with filters', async () => {
      const accounts: WalletAccountData[] = [
        { ...mockAccount, id: 'eth-1', chainId: 1, type: 'generated' },
        { ...mockAccount, id: 'eth-2', chainId: 1, type: 'imported' },
        { ...mockAccount, id: 'polygon-1', chainId: 137, type: 'generated' }
      ];

      for (const account of accounts) {
        await walletDB.saveAccount(account);
      }

      const ethAccounts = await walletDB.getAccounts({ filters: { chainId: 1 } });
      expect(ethAccounts).toHaveLength(2);

      const generatedAccounts = await walletDB.getAccounts({ filters: { type: 'generated' } });
      expect(generatedAccounts).toHaveLength(2);
    });

    it('should delete wallet account', async () => {
      await walletDB.saveAccount(mockAccount);
      const retrieved = await walletDB.getAccount(mockAccount.id);
      expect(retrieved).toBeDefined();

      const deleted = await walletDB.deleteAccount(mockAccount.id);
      expect(deleted).toBe(true);

      const afterDelete = await walletDB.getAccount(mockAccount.id);
      expect(afterDelete).toBeNull();
    });
  });

  describe('Wallet Preferences', () => {
    it('should save and retrieve preferences', async () => {
      const preferences = {
        userId: 'test-user-1',
        defaultCurrency: 'USD',
        language: 'en',
        theme: 'dark' as const,
        autoLockTimeout: 30,
        showBalanceOnStartup: false,
        privacyMode: true,
        notifications: {
          transactions: true,
          priceAlerts: false,
          security: true
        },
        gasSettings: {
          defaultGasPrice: '25000000000',
          maxGasPrice: '150000000000',
          gasLimitBuffer: 1.3
        },
        updatedAt: Date.now()
      };

      const success = await walletDB.savePreferences(preferences);
      expect(success).toBe(true);

      const retrieved = await walletDB.getPreferences(preferences.userId);
      expect(retrieved.theme).toBe('dark');
      expect(retrieved.privacyMode).toBe(true);
      expect(retrieved.autoLockTimeout).toBe(30);
    });

    it('should return default preferences for new user', async () => {
      const preferences = await walletDB.getPreferences('new-user');
      expect(preferences.defaultCurrency).toBe('USD');
      expect(preferences.language).toBe('en');
      expect(preferences.theme).toBe('auto');
      expect(preferences.showBalanceOnStartup).toBe(true);
    });
  });

  describe('Transaction History', () => {
    it('should save and retrieve transaction records', async () => {
      const success = await transactionDB.saveTransaction(mockTransaction);
      expect(success).toBe(true);
      
      const retrieved = await transactionDB.getTransaction(mockTransaction.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.hash).toBe(mockTransaction.hash);
      expect(retrieved?.from).toBe(mockTransaction.from);
      expect(retrieved?.to).toBe(mockTransaction.to);
    });

    it('should filter transactions by criteria', async () => {
      const transactions: TransactionData[] = [
        {
          ...mockTransaction,
          id: 'tx-1',
          hash: '0x111',
          from: TEST_ADDRESSES.ethereum,
          status: 'confirmed',
          timestamp: Date.now() - 86400000 // 1 day ago
        },
        {
          ...mockTransaction,
          id: 'tx-2', 
          hash: '0x222',
          from: TEST_ADDRESSES.ethereum,
          status: 'pending',
          timestamp: Date.now() - 3600000 // 1 hour ago
        },
        {
          ...mockTransaction,
          id: 'tx-3',
          hash: '0x333',
          from: '0x999999999999999999999999999999999999999999',
          status: 'confirmed',
          timestamp: Date.now() - 1800000 // 30 min ago
        }
      ];

      for (const tx of transactions) {
        await transactionDB.saveTransaction(tx);
      }

      // Filter by address - fix: pass filters directly, not nested
      const userTxs = await transactionDB.getTransactions({ 
        from: TEST_ADDRESSES.ethereum
      });
      expect(userTxs).toHaveLength(2);

      // Filter by status
      const confirmedTxs = await transactionDB.getTransactions({
        status: 'confirmed'
      });
      expect(confirmedTxs).toHaveLength(2);
    });

    it('should update transaction data', async () => {
      await transactionDB.saveTransaction(mockTransaction);
      
      // Update transaction with new data
      const updatedTx = {
        ...mockTransaction,
        status: 'failed' as const,
        gasUsed: '0' // Failed transaction
      };

      const success = await transactionDB.saveTransaction(updatedTx);
      expect(success).toBe(true);

      const retrieved = await transactionDB.getTransaction(mockTransaction.id);
      expect(retrieved?.status).toBe('failed');
      expect(retrieved?.gasUsed).toBe('0');
    });
  });

  describe('NFT Storage', () => {
    it('should save and retrieve NFT data', async () => {
      const success = await nftDB.saveNFT(mockNFT);
      expect(success).toBe(true);
      
      const retrieved = await nftDB.getNFT(mockNFT.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.contractAddress).toBe(mockNFT.contractAddress);
      expect(retrieved?.tokenId).toBe(mockNFT.tokenId);
      expect(retrieved?.owner).toBe(mockNFT.owner);
      expect(retrieved?.name).toBe(mockNFT.name);
    });

    it('should query NFTs by owner', async () => {
      const nfts: NFTData[] = [
        {
          ...mockNFT,
          id: 'nft-1',
          tokenId: '1',
          owner: TEST_ADDRESSES.ethereum
        },
        {
          ...mockNFT,
          id: 'nft-2',
          tokenId: '2', 
          owner: TEST_ADDRESSES.ethereum
        },
        {
          ...mockNFT,
          id: 'nft-3',
          tokenId: '3',
          owner: '0x999999999999999999999999999999999999999999'
        }
      ];

      for (const nft of nfts) {
        await nftDB.saveNFT(nft);
      }

      const userNFTs = await nftDB.getNFTsByOwner(TEST_ADDRESSES.ethereum);
      expect(userNFTs).toHaveLength(2);
      expect(userNFTs.map(n => n.tokenId).sort()).toEqual(['1', '2']);
    });

    it('should query NFTs by collection', async () => {
      const contractAddress = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
      const nfts: NFTData[] = [
        { ...mockNFT, id: 'nft-1', contractAddress, tokenId: '1' },
        { ...mockNFT, id: 'nft-2', contractAddress, tokenId: '2' },
        { ...mockNFT, id: 'nft-3', contractAddress: '0x123', tokenId: '3' }
      ];

      for (const nft of nfts) {
        await nftDB.saveNFT(nft);
      }

      const collectionNFTs = await nftDB.getNFTsByCollection(contractAddress, 1);
      expect(collectionNFTs).toHaveLength(2);
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data integrity across operations', async () => {
      // Save related data
      await walletDB.saveAccount(mockAccount);
      await transactionDB.saveTransaction(mockTransaction);
      await nftDB.saveNFT(mockNFT);

      // Verify all data exists
      const account = await walletDB.getAccount(mockAccount.id);
      const transaction = await transactionDB.getTransaction(mockTransaction.id);
      const nft = await nftDB.getNFT(mockNFT.id);

      expect(account).toBeDefined();
      expect(transaction).toBeDefined();
      expect(nft).toBeDefined();

      // Verify relationships
      expect(account?.address).toBe(transaction?.from);
      expect(account?.address).toBe(nft?.owner);
    });

    it('should handle concurrent modifications safely', async () => {
      const promises = [];
      
      // Simulate concurrent saves
      for (let i = 0; i < 10; i++) {
        promises.push(
          walletDB.saveAccount({
            ...mockAccount,
            id: `account-${i}`,
            address: `0x${i.toString().padStart(40, '0')}`,
            lastAccessedAt: Date.now() + i
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);

      const accounts = await walletDB.getAccounts();
      expect(accounts).toHaveLength(10);
    });

    it('should clear all data correctly', async () => {
      // Add some data
      await walletDB.saveAccount(mockAccount);
      await transactionDB.saveTransaction(mockTransaction);
      await nftDB.saveNFT(mockNFT);

      // Verify data exists
      expect(await walletDB.getAccounts()).toHaveLength(1);
      expect(await transactionDB.getTransactions()).toHaveLength(1);
      expect(await nftDB.getNFTs()).toHaveLength(1);

      // Clear all
      await walletDB.clear();
      await transactionDB.clear(); 
      await nftDB.clear();

      // Verify data is cleared
      expect(await walletDB.getAccounts()).toHaveLength(0);
      expect(await transactionDB.getTransactions()).toHaveLength(0);
      expect(await nftDB.getNFTs()).toHaveLength(0);
    });
  });

  describe('Database Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Insert 100 accounts
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          walletDB.saveAccount({
            ...mockAccount,
            id: `perf-account-${i}`,
            address: `0x${i.toString().padStart(40, '0')}`,
            name: `Performance Account ${i}`
          })
        );
      }
      
      await Promise.all(promises);
      const insertTime = Date.now() - startTime;
      
      // Query all accounts
      const queryStart = Date.now();
      const accounts = await walletDB.getAccounts();
      const queryTime = Date.now() - queryStart;
      
      expect(accounts).toHaveLength(100);
      expect(insertTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(queryTime).toBeLessThan(1000); // Should query in under 1 second
    }, 10000);
  });
});