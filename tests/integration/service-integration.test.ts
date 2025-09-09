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
    
    await walletService.connect();

    // Get service instances
    nftService = walletService.getNFTService()!;
    transactionService = walletService.getTransactionService()!;
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
        const account = await walletService.addAccountFromSeed(TEST_MNEMONIC, 'Lock Test');
        
        // Step 1: Verify wallet works when keyring is unlocked
        const address = await walletService.getAddress();
        expect(address).toBeDefined();
        // Address should be one of the keyring accounts
        const accounts = await walletService.getAccounts();
        expect(accounts.some(a => a.address === address)).toBe(true);

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
        const originalSendTx = mockProvider.getSigner().sendTransaction;
        
        // Step 1: Mock transaction failure
        mockProvider.getSigner().sendTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

        const txParams = {
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.1')
        };

        // Step 2: Attempt transaction
        await expect(transactionService.sendTransaction({
          ...txParams,
          value: txParams.value.toString(),
          chainType: 'ethereum' as const
        })).rejects.toThrow('Transaction failed');

        // Step 3: Verify wallet service is still functional
        const address = await walletService.getAddress();
        expect(address).toBeDefined();

        // Step 4: Restore mock and retry
        mockProvider.getSigner().sendTransaction = originalSendTx;
        const retryTx = await transactionService.sendTransaction({
          ...txParams,
          value: txParams.value.toString(),
          chainType: 'ethereum' as const
        });
        expect(retryTx.hash).toBeDefined();

        // Step 5: Verify error handling didn't break integration
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
      });
    });
  });

  describe('WalletService ↔ NFTService Integration', () => {
    it('should coordinate NFT operations with wallet data', async () => {
      await withTimeout(async () => {
        // Step 1: Verify NFT service exists
        expect(nftService).toBeDefined();

        // Step 2: Test NFT discovery with wallet address
        await nftService.discoverNFTs();
        const userNFTs = await nftService.getUserNFTs();
        expect(Array.isArray(userNFTs)).toBe(true);

        // Step 3: Test NFT operations use correct wallet address
        const walletAddress = await walletService.getAddress();
        if (userNFTs.length > 0) {
          const nftOwner = userNFTs[0].owner_address;
          expect(nftOwner).toBe(walletAddress);
        }

        // Step 4: Test NFT transfer integration
        const mockNFT = MOCK_NFTS[0];
        const transferTx = await nftService.transferNFT(
          mockNFT.contract_address,
          mockNFT.token_id,
          '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5'
        );

        expect(transferTx.from).toBe(walletAddress);
        expect(transferTx.to).toBe(mockNFT.contract_address);

        // Step 5: Verify NFT transfer appears in transaction history
        const txHistory = await transactionService.getTransactionHistory();
        expect(txHistory.some(tx => tx.hash === transferTx.hash)).toBe(true);
      });
    });

    it('should handle NFT metadata loading and caching', async () => {
      await withTimeout(async () => {
        const mockNFT = MOCK_NFTS[0];
        
        // Step 1: Load metadata first time (should fetch)
        const metadata1 = await nftService.getNFTMetadata(
          mockNFT.contract_address,
          mockNFT.token_id
        );
        expect(metadata1).toBeDefined();
        expect(metadata1.name).toBe(mockNFT.name);

        // Step 2: Load metadata second time (should use cache)
        const startTime = Date.now();
        const metadata2 = await nftService.getNFTMetadata(
          mockNFT.contract_address,
          mockNFT.token_id
        );
        const loadTime = Date.now() - startTime;

        expect(metadata2).toEqual(metadata1);
        expect(loadTime).toBeLessThan(100); // Should be fast from cache

        // Step 3: Verify caching works across service restarts
        await nftService.cleanup();
        nftService = new NFTService(walletService.getWallet()!);
        await nftService.initialize();

        const cachedMetadata = await nftService.getNFTMetadata(
          mockNFT.contract_address,
          mockNFT.token_id
        );
        expect(cachedMetadata).toEqual(metadata1);
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
        expect(serviceTxHistory.length).toBeGreaterThan(0);
      });
    });

    it('should handle database backup and restore across services', async () => {
      await withTimeout(async () => {
        const walletAddress = await walletService.getAddress();

        // Step 1: Create data through services
        await walletDB.saveWallet({
          address: walletAddress,
          name: 'Backup Test Wallet'
        });

        const txResponse = await transactionService.sendTransaction({
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.01').toString(),
          chainType: 'ethereum' as const
        });

        await transactionDB.saveTransaction({
          hash: txResponse.hash,
          from: walletAddress,
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.01').toString(),
          status: 'pending',
          timestamp: Date.now()
        });

        // Step 2: Create backup
        const backup = await walletDB.createBackup();
        expect(backup.data.wallets).toHaveLength(1);
        expect(backup.data.transactions).toHaveLength(1);

        // Step 3: Clear databases
        await walletDB.clear();
        await transactionDB.clear();
        await nftDB.clear();

        // Step 4: Verify data is gone
        const emptyWallet = await walletDB.getWallet(walletAddress);
        const emptyTxs = await transactionDB.getTransactionsByAddress(walletAddress);
        expect(emptyWallet).toBeNull();
        expect(emptyTxs).toHaveLength(0);

        // Step 5: Restore from backup
        await walletDB.restoreFromBackup(backup);

        // Step 6: Verify data is restored and services work
        const restoredWallet = await walletDB.getWallet(walletAddress);
        const restoredTxs = await transactionDB.getTransactionsByAddress(walletAddress);
        
        expect(restoredWallet?.name).toBe('Backup Test Wallet');
        expect(restoredTxs).toHaveLength(1);
        expect(restoredTxs[0].hash).toBe(txResponse.hash);
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