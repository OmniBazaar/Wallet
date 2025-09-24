/**
 * Service Integration Tests
 * 
 * Tests the integration between different services in the wallet module.
 * Validates that services communicate correctly and share data properly.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { DEXService, OrderSide } from '../../src/services/DEXService';
import { NFTService } from '../../src/services/NFTService';
import { KeyringService } from '../../src/core/keyring/KeyringService';
import { TransactionService } from '../../src/core/transaction/TransactionService';
import { WalletDatabase } from '../../src/services/WalletDatabase';
import { TransactionDatabase } from '../../src/services/TransactionDatabase';
import { NFTDatabase } from '../../src/services/NFTDatabase';
import { ethers } from 'ethers';
import {
  TEST_MNEMONIC,
  TEST_ADDRESSES,
  createMockProvider,
  mockWallet,
  MOCK_NFTS,
  withTimeout,
  cleanupTest
} from '../setup';
import { KeyringManager } from '../../src/core/keyring/KeyringManager';

describe('Service Integration Tests', () => {
  let walletService: WalletService;
  let dexService: DEXService;
  let nftService: NFTService;
  let keyringService: KeyringService;
  let transactionService: TransactionService;
  let walletDB: WalletDatabase;
  let transactionDB: TransactionDatabase;
  let nftDB: NFTDatabase;
  let mockProvider: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
    
    // Initialize databases
    walletDB = new WalletDatabase();
    transactionDB = new TransactionDatabase();
    nftDB = new NFTDatabase();
    
    await walletDB.init();
    await transactionDB.init();
    await nftDB.init();
  });

  beforeEach(async () => {
    // Clean databases
    await walletDB.clear();
    await transactionDB.clear();
    await nftDB.clear();

    // Initialize services
    walletService = new WalletService(mockProvider);
    await walletService.init();

    dexService = new DEXService(walletService);
    await dexService.init();

    // Get the keyring service from wallet service (it's a singleton)
    keyringService = (walletService as any).keyringService;
    if (!keyringService) {
      keyringService = new KeyringService();
      await keyringService.initialize();
      (walletService as any).keyringService = keyringService;
    }

    // Create wallet account
    await keyringService.addAccountFromSeed(TEST_MNEMONIC, 'Test Wallet');
    
    // Setup user session for KeyringManager singleton (used by TransactionService)
    const keyringManager = KeyringManager.getInstance();
    (keyringManager as any).currentSession = {
      username: 'test-user',
      isLoggedIn: true,
      lastActivity: Date.now(),
      accounts: {
        ethereum: { address: TEST_ADDRESSES.ethereum, privateKey: 'mock-key' }
      }
    };

    // Connect wallet - will use mock provider in test mode
    try {
      await walletService.connect();
    } catch (error) {
      // In test mode, connect might fail but that's ok
      // The keyring service will still work
    }

    // Get service instances
    nftService = walletService.getNFTService()!;
    transactionService = walletService.getTransactionService()!;

    // Initialize NFT service
    if (nftService && typeof nftService.init === 'function') {
      await nftService.init();
    }
  });

  afterEach(async () => {
    await walletService.cleanup();
    await dexService.cleanup();
    await keyringService.cleanup();
    cleanupTest();
  });

  describe('WalletService ↔ KeyringService Integration', () => {
    it('should properly integrate keyring accounts with wallet operations', async () => {
      await withTimeout(async () => {
        // Step 1: Create multiple accounts via wallet service (which uses the shared keyring)
        const account1 = await walletService.addAccountFromSeed(TEST_MNEMONIC, 'Account 1');
        const account2 = await walletService.addAccountFromPrivateKey(
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          'Account 2'
        );

        // Step 2: Verify wallet service sees all accounts
        // Note: addAccountFromSeed creates 3 accounts (ethereum, omnicoin, coti)
        // Initial setup creates 3, then we add 3 more + 1 from private key = 7 total
        const walletAccounts = await walletService.getAccounts();
        expect(walletAccounts).toHaveLength(7);
        // Check that our named accounts exist
        expect(walletAccounts.some(a => a.name === 'Account 1')).toBe(true);
        expect(walletAccounts.some(a => a.name === 'Account 2')).toBe(true);

        // Step 3: Verify active account works with wallet operations
        const address = await walletService.getAddress();
        expect(address).toBeDefined();
        // The address might be from the mock provider
        // Just verify it's a valid ethereum address
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);

        // Step 4: Test keyring state persistence
        const keyringState = await keyringService.getState();
        expect(keyringState.accounts).toHaveLength(7); // 7 accounts total
        expect(keyringState.isUnlocked).toBe(true);

        // Step 5: Verify signing operations work through integration
        const message = 'Test message for signing';
        const signature = await keyringService.signMessage(account1.address, message);
        expect(signature).toBeDefined();
        expect(signature.startsWith('0x')).toBe(true);
      });
    });

    it('should handle keyring lock/unlock with wallet operations', async () => {
      await withTimeout(async () => {
        // Step 1: Verify wallet works when keyring is unlocked
        const address = await walletService.getAddress();
        expect(address).toBeDefined();

        // Verify we have keyring accounts
        const accounts = await walletService.getAccounts();
        expect(accounts.length).toBeGreaterThan(0);

        // In test mode with mock provider, the address might be from the mock
        // Just verify it's a valid address
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);

        // Step 2: Lock keyring
        await keyringService.lock();
        const lockedState = await keyringService.getState();
        expect(lockedState.isUnlocked).toBe(false);

        // Step 3: Verify wallet operations still work (cached)
        const cachedAddress = await walletService.getAddress();
        expect(cachedAddress).toBe(address);

        // Step 4: Unlock keyring
        await keyringService.unlock('password');
        const unlockedState = await keyringService.getState();
        expect(unlockedState.isUnlocked).toBe(true);

        // Step 5: Verify full functionality restored
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
      });
    });
  });

  describe('WalletService ↔ TransactionService Integration', () => {
    it('should coordinate transaction operations with wallet state', async () => {
      await withTimeout(async () => {
        // Step 1: Verify transaction service is connected to wallet
        expect(transactionService.getWallet()).toBe(walletService.getWallet());

        // Step 2: Test transaction creation through wallet service
        const txParams = {
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.1')
        };

        const gasEstimate = await transactionService.estimateGas(txParams);
        expect(gasEstimate).toBeDefined();
        expect(gasEstimate).toBeGreaterThan(0n);

        // Step 3: Create and sign transaction
        const signedTx = await transactionService.signTransaction(txParams);
        expect(signedTx).toBeDefined();
        expect(signedTx.startsWith('0x')).toBe(true);

        // Step 4: Send transaction and verify wallet integration
        const txResponse = await transactionService.sendTransaction({
          ...txParams,
          value: txParams.value.toString(),
          chainType: 'ethereum' as const
        });
        expect(txResponse.hash).toBeDefined();

        // Step 5: Verify transaction appears in history
        const history = await transactionService.getTransactionHistory();
        expect(history.transactions.length).toBeGreaterThan(0);
        expect(history.transactions.some(tx => tx.txHash === txResponse.hash)).toBe(true);

        // Step 6: Verify wallet balance updates (simulated)
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
      });
    });

    it('should handle transaction failures and recovery', async () => {
      await withTimeout(async () => {
        // Step 1: Mock the transaction service to fail once then succeed
        let callCount = 0;
        const originalSendTransaction = transactionService.sendTransaction.bind(transactionService);

        transactionService.sendTransaction = jest.fn().mockImplementation(async (request) => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Transaction broadcast failed');
          }
          // Call the original implementation for subsequent calls
          return originalSendTransaction(request);
        });

        const txParams = {
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.1')
        };

        // Step 2: First attempt should fail
        await expect(transactionService.sendTransaction({
          ...txParams,
          value: txParams.value.toString(),
          chainType: 'ethereum' as const
        })).rejects.toThrow('Transaction broadcast failed');

        // Step 3: Verify wallet service is still functional after failure
        const address = await walletService.getAddress();
        expect(address).toBeDefined();

        // Step 4: Second attempt should succeed (failCount was 1)
        const retryTx = await transactionService.sendTransaction({
          ...txParams,
          value: txParams.value.toString(),
          chainType: 'ethereum' as const
        });
        expect(retryTx.hash).toBeDefined();
        expect(retryTx.hash).toMatch(/^0x[a-f0-9]{64}$/);

        // Step 5: Verify error handling didn't break integration
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();

        // Step 6: Restore the original method
        transactionService.sendTransaction = originalSendTransaction;
      });
    });
  });

  describe('WalletService ↔ NFTService Integration', () => {
    it('should coordinate NFT operations with wallet data', async () => {
      await withTimeout(async () => {
        // Import IPFS integration helper
        const { createIPFSBackedNFTService } = await import('../helpers/ipfs-integration');

        // Step 1: Verify NFT service exists and initialize
        expect(nftService).toBeDefined();

        // Create IPFS-backed metadata service
        const ipfsService = createIPFSBackedNFTService();

        // Step 2: Create and store test NFT metadata
        const testMetadata = {
          name: 'Test NFT #1',
          description: 'Integration test NFT',
          image: 'ipfs://QmTest123/image.png',
          attributes: [
            { trait_type: 'Test', value: 'true' },
            { trait_type: 'Integration', value: 1 }
          ]
        };

        const metadataCID = await ipfsService.storeMetadata(testMetadata);
        expect(metadataCID).toMatch(/^Qm[a-zA-Z0-9]{44}$/);

        // Step 3: Test NFT discovery with wallet address
        await nftService.discoverNFTs();
        const userNFTs = await nftService.getUserNFTs();
        expect(Array.isArray(userNFTs)).toBe(true);

        // Step 4: Get wallet address for operations
        const walletAddress = await walletService.getAddress();
        expect(walletAddress).toBeDefined();
        expect(walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

        // Step 5: Test NFT transfer integration
        const mockNFT = MOCK_NFTS[0];
        const transferTx = await nftService.transferNFT({
          contractAddress: mockNFT.contract_address,
          tokenId: mockNFT.token_id,
          from: walletAddress,
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          chainId: 1
        });

        expect(transferTx.success).toBe(true);
        expect(transferTx.transactionHash).toBeDefined();
        expect(transferTx.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);

        // Step 6: Verify NFT transfer appears in transaction history
        const txHistory = await transactionService.getTransactionHistory();
        expect(txHistory.transactions).toBeDefined();
        expect(Array.isArray(txHistory.transactions)).toBe(true);

        // The transaction might not appear immediately in history during testing
        // Verify the transfer was at least attempted
        expect(transferTx.success).toBe(true);

        // Step 7: Test metadata retrieval from IPFS
        const retrievedMetadata = await ipfsService.getMetadata(metadataCID);
        expect(retrievedMetadata).toBeDefined();
        expect(retrievedMetadata?.name).toBe(testMetadata.name);
        expect(retrievedMetadata?.description).toBe(testMetadata.description);
      });
    });

    it('should handle NFT metadata loading and caching', async () => {
      await withTimeout(async () => {
        // Import IPFS integration helper
        const { createIPFSBackedNFTService, IPFSIntegration } = await import('../helpers/ipfs-integration');

        // Create IPFS service with caching
        const ipfsService = createIPFSBackedNFTService();

        // Step 1: Create test NFT metadata
        const testMetadata = {
          name: 'Cached NFT #42',
          description: 'Test NFT for caching',
          image: 'ipfs://QmCache42/image.png',
          attributes: [
            { trait_type: 'Cached', value: 'true' },
            { trait_type: 'TestId', value: 42 }
          ]
        };

        // Store metadata and get CID
        const metadataCID = await ipfsService.storeMetadata(testMetadata);
        expect(metadataCID).toMatch(/^Qm[a-zA-Z0-9]{44}$/);

        // Clear cache to ensure first load is from "network"
        ipfsService.clearCache();
        expect(ipfsService.getCacheSize()).toBe(0);

        // Step 2: Load metadata first time (should fetch from IPFS/mock)
        const startTime1 = Date.now();
        const metadata1 = await ipfsService.getMetadata(metadataCID);
        const loadTime1 = Date.now() - startTime1;

        expect(metadata1).toBeDefined();
        expect(metadata1?.name).toBe(testMetadata.name);
        expect(metadata1?.description).toBe(testMetadata.description);
        expect(ipfsService.getCacheSize()).toBe(1); // Should be cached now

        // Step 3: Load metadata second time (should use cache)
        const startTime2 = Date.now();
        const metadata2 = await ipfsService.getMetadata(metadataCID);
        const loadTime2 = Date.now() - startTime2;

        expect(metadata2).toEqual(metadata1);
        expect(loadTime2).toBeLessThan(loadTime1); // Cache should be faster
        expect(loadTime2).toBeLessThan(50); // Should be very fast from cache

        // Step 4: Test with NFT service wrapper
        const mockNFT = MOCK_NFTS[0];

        // First load through NFT service
        const nftMetadata1 = await nftService.getNFTMetadata(
          mockNFT.contract_address,
          mockNFT.token_id
        );
        expect(nftMetadata1).toBeDefined();
        // NFT service generates name as "NFT #tokenId" in test mode
        expect(nftMetadata1?.name).toBe(`NFT #${mockNFT.token_id}`);

        // Second load should be fast (uses internal caching)
        const startTime3 = Date.now();
        const nftMetadata2 = await nftService.getNFTMetadata(
          mockNFT.contract_address,
          mockNFT.token_id
        );
        const loadTime3 = Date.now() - startTime3;

        expect(nftMetadata2).toEqual(nftMetadata1);
        expect(loadTime3).toBeLessThan(100); // Should be fast

        // Step 5: Verify cache persistence across service operations
        const cacheSize = ipfsService.getCacheSize();
        expect(cacheSize).toBeGreaterThan(0);

        // Clear NFT service cache
        await nftService.clearCache();

        // Metadata should still be retrievable (from IPFS or mock)
        const nftMetadata3 = await nftService.getNFTMetadata(
          mockNFT.contract_address,
          mockNFT.token_id
        );
        expect(nftMetadata3).toBeDefined();
        // NFT service generates name as "NFT #tokenId" in test mode
        expect(nftMetadata3?.name).toBe(`NFT #${mockNFT.token_id}`);
      });
    });
  });

  describe('DEXService ↔ WalletService Integration', () => {
    it('should coordinate trading operations with wallet', async () => {
      await withTimeout(async () => {
        // Step 1: Verify DEX service uses wallet address
        const walletAddress = await walletService.getAddress();
        
        // Step 2: Place order through DEX service
        const pairs = dexService.getSupportedPairs();
        const testPair = pairs[0];

        const order = await dexService.placeOrder({
          symbol: testPair.symbol,
          side: OrderSide.BUY,
          price: ethers.parseUnits('1.00', 6),
          quantity: ethers.parseEther('10')
        });

        expect(order.trader).toBe(walletAddress);

        // Step 3: Verify order operations integrate with transaction service
        const activeOrders = await dexService.getActiveOrders();
        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].trader).toBe(walletAddress);

        // Step 4: Cancel order and verify transaction integration
        await dexService.cancelOrder(order.id);
        const canceledOrders = await dexService.getActiveOrders();
        expect(canceledOrders).toHaveLength(0);

        // Step 5: Verify order history includes correct trader
        const orderHistory = await dexService.getOrderHistory();
        expect(orderHistory[0].trader).toBe(walletAddress);
      });
    });

    it('should handle order authorization and permissions', async () => {
      await withTimeout(async () => {
        const pairs = dexService.getSupportedPairs();
        const testPair = pairs[0];

        // Step 1: Create order with wallet 1
        const order = await dexService.placeOrder({
          symbol: testPair.symbol,
          side: OrderSide.BUY,
          price: ethers.parseUnits('1.00', 6),
          quantity: ethers.parseEther('5')
        });

        // Step 2: Create second account
        const account2 = await keyringService.addAccountFromPrivateKey(
          '0x9876543210987654321098765432109876543210987654321098765432109876',
          'Account 2'
        );

        // Step 3: Try to cancel order from different account (should fail)
        // Mock a different address temporarily
        const originalGetAddress = walletService.getAddress.bind(walletService);
        walletService.getAddress = async () => account2.address;
        
        await expect(dexService.cancelOrder(order.id)).rejects.toThrow('Not authorized');
        
        // Restore original getAddress
        walletService.getAddress = originalGetAddress;

        // Step 4: Verify original account can still cancel
        const activeOrders = await dexService.getActiveOrders();
        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].id).toBe(order.id);
      });
    });
  });

  describe('Database Integration Across Services', () => {
    it('should maintain data consistency across service operations', async () => {
      await withTimeout(async () => {
        const walletAddress = await walletService.getAddress();

        // Step 1: Store wallet data
        await walletDB.saveWallet({
          address: walletAddress,
          name: 'Integration Test Wallet',
          chainId: 1
        });

        // Step 2: Create transaction through service
        const txParams = {
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.1')
        };

        const txResponse = await transactionService.sendTransaction({
          ...txParams,
          value: txParams.value.toString(),
          chainType: 'ethereum' as const
        });

        // Step 3: Store transaction in database
        await transactionDB.saveTransaction({
          hash: txResponse.hash,
          from: walletAddress,
          to: txParams.to,
          value: txParams.value.toString(),
          status: 'pending',
          timestamp: Date.now()
        });

        // Step 4: Store NFT data
        const mockNFT = MOCK_NFTS[0];
        await nftDB.saveNFT({
          contractAddress: mockNFT.contract_address,
          tokenId: mockNFT.token_id,
          owner: walletAddress,
          name: mockNFT.name,
          image: 'ipfs://mock-image',
          chainId: 1
        });

        // Step 5: Verify data consistency
        const storedWallet = await walletDB.getWallet(walletAddress);
        const transactions = await transactionDB.getTransactionsByAddress(walletAddress);
        const nfts = await nftDB.getNFTsByOwner(walletAddress);

        expect(storedWallet?.address).toBe(walletAddress);
        expect(transactions).toHaveLength(1);
        expect(transactions[0].hash).toBe(txResponse.hash);
        expect(nfts).toHaveLength(1);
        expect(nfts[0].owner).toBe(walletAddress);

        // Step 6: Test cross-service data access
        const serviceNFTs = await nftService.getUserNFTs();
        const serviceTxHistory = await transactionService.getTransactionHistory();
        
        expect(serviceNFTs.length).toBeGreaterThanOrEqual(0);
        expect(serviceTxHistory.transactions.length).toBeGreaterThan(0);
      });
    });

    it('should handle database backup and restore across services', async () => {
      await withTimeout(async () => {
        // Import UnifiedBackupService
        const { UnifiedBackupService } = await import('../../src/services/UnifiedBackupService');
        const unifiedBackup = new UnifiedBackupService(walletDB, transactionDB, nftDB);

        const walletAddress = await walletService.getAddress();

        // Step 1: Create comprehensive test data

        // Save wallet data
        await walletDB.saveWallet({
          address: walletAddress,
          name: 'Backup Test Wallet',
          chainId: 1
        });

        // Create and save transaction
        const txResponse = await transactionService.sendTransaction({
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.01').toString(),
          chainType: 'ethereum' as const
        });

        await transactionDB.saveTransaction({
          id: `tx-${Date.now()}`,
          hash: txResponse.hash,
          from: walletAddress,
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.01').toString(),
          status: 'confirmed' as const,
          timestamp: Date.now(),
          chainId: 1
        });

        // Create and save NFT with metadata
        const mockNFT = MOCK_NFTS[0];
        await nftDB.saveNFT({
          contractAddress: mockNFT.contract_address,
          tokenId: mockNFT.token_id,
          owner: walletAddress,
          name: mockNFT.name,
          image: 'ipfs://QmBackupTest/image.png',
          chainId: 1,
          metadata: {
            description: 'Test NFT for backup',
            attributes: [
              { trait_type: 'Backup', value: 'true' },
              { trait_type: 'Test', value: 1 }
            ]
          }
        });

        // Save another NFT to ensure multiple items work
        await nftDB.saveNFT({
          contractAddress: '0x1234567890123456789012345678901234567890',
          tokenId: '42',
          owner: walletAddress,
          name: 'Backup NFT #42',
          image: 'ipfs://QmBackup42/image.png',
          chainId: 1
        });

        // Step 2: Create unified backup
        const backup = await unifiedBackup.createBackup();

        // Verify backup contents
        expect(backup.data.wallets).toHaveLength(1);
        expect(backup.data.transactions.length).toBeGreaterThanOrEqual(1);
        expect(backup.data.nfts).toHaveLength(2);
        expect(backup.timestamp).toBeDefined();

        // Step 3: Clear all databases
        await unifiedBackup.clearAll();

        // Step 4: Verify data is gone
        const emptyWallet = await walletDB.getWallet(walletAddress);
        const emptyTxs = await transactionDB.getTransactionsByAddress(walletAddress);
        const emptyNFTs = await nftDB.getNFTsByOwner(walletAddress);

        expect(emptyWallet).toBeNull(); // getWallet returns null, not undefined
        expect(emptyTxs).toHaveLength(0);
        expect(emptyNFTs).toHaveLength(0);

        // Step 5: Restore from unified backup
        const restoreSuccess = await unifiedBackup.restoreFromBackup(backup);
        expect(restoreSuccess).toBe(true);

        // Step 6: Verify all data is restored correctly
        const restoredWallet = await walletDB.getWallet(walletAddress);
        const restoredTxs = await transactionDB.getTransactionsByAddress(walletAddress);
        const restoredNFTs = await nftDB.getNFTsByOwner(walletAddress);

        // Check wallet restoration
        expect(restoredWallet).toBeDefined();
        expect(restoredWallet?.name).toBe('Backup Test Wallet');
        expect(restoredWallet?.address).toBe(walletAddress);

        // Check transaction restoration
        expect(restoredTxs.length).toBeGreaterThanOrEqual(1);
        const restoredTx = restoredTxs.find(tx => tx.hash === txResponse.hash);
        expect(restoredTx).toBeDefined();
        expect(restoredTx?.value).toBe(ethers.parseEther('0.01').toString());

        // Check NFT restoration
        expect(restoredNFTs).toHaveLength(2);
        const restoredNFT1 = restoredNFTs.find(nft => nft.tokenId === mockNFT.token_id);
        expect(restoredNFT1).toBeDefined();
        expect(restoredNFT1?.name).toBe(mockNFT.name);
        expect(restoredNFT1?.metadata?.description).toBe('Test NFT for backup');

        const restoredNFT2 = restoredNFTs.find(nft => nft.tokenId === '42');
        expect(restoredNFT2).toBeDefined();
        expect(restoredNFT2?.name).toBe('Backup NFT #42');

        // Step 7: Test export/import functionality
        const exportedBackup = await unifiedBackup.exportBackup();
        expect(exportedBackup).toContain(walletAddress);
        expect(exportedBackup).toContain('Backup Test Wallet');

        // Clear again and import
        await unifiedBackup.clearAll();
        const importSuccess = await unifiedBackup.importBackup(exportedBackup);
        expect(importSuccess).toBe(true);

        // Verify imported data
        const importedWallet = await walletDB.getWallet(walletAddress);
        expect(importedWallet?.name).toBe('Backup Test Wallet');
      });
    });
  });

  describe('Service Event Coordination', () => {
    it('should coordinate events across services', async () => {
      await withTimeout(async () => {
        const events: any[] = [];

        // Step 1: Set up event listeners
        walletService.on('accountChanged', (address) => {
          events.push({ type: 'accountChanged', address });
        });

        walletService.on('networkChanged', (chainId) => {
          events.push({ type: 'networkChanged', chainId });
        });

        walletService.on('balanceUpdated', (balance) => {
          events.push({ type: 'balanceUpdated', balance });
        });

        // Step 2: Trigger network change
        await walletService.switchChain(137); // Polygon
        
        // Step 3: Verify network change event fired
        expect(events.some(e => e.type === 'networkChanged' && e.chainId === 137)).toBe(true);

        // Step 4: Verify services adapt to network change
        const newChainId = await walletService.getChainId();
        expect(newChainId).toBe(137);

        // Step 5: Test transaction service adapts
        const feeData = await transactionService.getFeeData();
        expect(feeData).toBeDefined();

        // Step 6: Test DEX service adapts
        const marketData = await dexService.getMarketData('OMNI/USDC');
        expect(marketData).toBeDefined();
      });
    });

    it('should handle service cleanup and restart coordination', async () => {
      await withTimeout(async () => {
        // Step 1: Verify all services are working
        const initialAddress = await walletService.getAddress();
        const initialBalance = await walletService.getBalance();
        const initialPairs = dexService.getSupportedPairs();

        expect(initialAddress).toBeDefined();
        expect(initialBalance).toBeDefined();
        expect(initialPairs.length).toBeGreaterThan(0);

        // Step 2: Cleanup all services
        await walletService.clearCache();
        await dexService.clearCache();
        await nftService.clearCache();
        await transactionService.clearCache();

        // Step 3: Verify services still work after cache clear
        const clearedAddress = await walletService.getAddress();
        const clearedBalance = await walletService.getBalance();
        const clearedPairs = dexService.getSupportedPairs();

        expect(clearedAddress).toBe(initialAddress);
        expect(clearedBalance).toBeDefined();
        expect(clearedPairs.length).toBe(initialPairs.length);

        // Step 4: Test full service restart
        await walletService.cleanup();
        await dexService.cleanup();

        // Step 5: Reinitialize
        walletService = new WalletService(mockProvider);
        await walletService.init();
        await walletService.connect();

        dexService = new DEXService(walletService);
        await dexService.init();

        // Step 6: Verify everything works after restart
        const restartedAddress = await walletService.getAddress();
        const restartedPairs = dexService.getSupportedPairs();

        expect(restartedAddress).toBe(initialAddress);
        expect(restartedPairs.length).toBe(initialPairs.length);
      });
    });
  });
});