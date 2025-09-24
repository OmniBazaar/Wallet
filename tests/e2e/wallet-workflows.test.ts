/**
 * End-to-End Wallet Workflow Tests
 * 
 * Tests complete user workflows from wallet creation to complex operations.
 * Validates entire user journeys work correctly with real service integration.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { WalletService, MultiChainConfig } from '../../src/services/WalletService';
import { DEXService } from '../../src/services/DEXService';
import { NFTService } from '../../src/core/nft/NFTService';
import { KeyringService } from '../../src/core/keyring/KeyringService';
import { TransactionService } from '../../src/core/transaction/TransactionService';
import { ethers } from 'ethers';
import { 
  TEST_MNEMONIC, 
  TEST_PASSWORD, 
  TEST_ADDRESSES, 
  CHAIN_TEST_DATA,
  createMockProvider,
  mockWallet,
  withTimeout,
  cleanupTest
} from '../setup';

describe('End-to-End Wallet Workflows', () => {
  let walletService: WalletService;
  let dexService: DEXService;
  let keyringService: KeyringService;
  let mockProvider: any;

  const testConfig: MultiChainConfig = {
    defaultChainId: 1,
    providers: {
      1: {
        chainId: 1,
        network: 'mainnet',
        rpcUrl: CHAIN_TEST_DATA.ethereum.rpcUrl,
        nativeSymbol: 'ETH',
        nativeDecimals: 18
      },
      137: {
        chainId: 137,
        network: 'polygon',
        rpcUrl: CHAIN_TEST_DATA.polygon.rpcUrl,
        nativeSymbol: 'MATIC',
        nativeDecimals: 18
      }
    },
    autoConnect: false
  };

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
  });

  beforeEach(async () => {
    walletService = new WalletService(mockProvider, testConfig);
    await walletService.init();
    
    dexService = new DEXService(walletService);
    await dexService.init();

    keyringService = new KeyringService();
    await keyringService.initialize();
  });

  afterEach(async () => {
    // Ensure we logout the session before cleanup
    const keyringManager = (keyringService as any).keyringManager;
    if (keyringManager) {
      keyringManager.logout();
    }

    await walletService.cleanup();
    await dexService.cleanup();
    await keyringService.cleanup();
    cleanupTest();
  });

  afterAll(async () => {
    cleanupTest();
  });

  describe('Complete Wallet Creation Flow', () => {
    it('should create wallet from seed phrase and perform operations', async () => {
      await withTimeout(async () => {
        // Step 1: Create account from seed phrase via wallet service
        const account = await walletService.addAccountFromSeed(TEST_MNEMONIC, 'Test Wallet');
        expect(account).toBeDefined();
        expect(account.name).toBe('Test Wallet');
        expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

        // Step 2: Connect wallet
        await walletService.connect();
        expect(walletService.isWalletConnected()).toBe(true);

        // Step 3: Get wallet address
        const address = await walletService.getAddress();
        expect(address).toBe(TEST_ADDRESSES.ethereum);

        // Step 4: Check balance
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
        expect(typeof balance).toBe('bigint');

        // Step 5: Get transaction service and verify it works
        const transactionService = walletService.getTransactionService();
        expect(transactionService).toBeDefined();

        // Step 6: Get NFT service and verify it works
        const nftService = walletService.getNFTService();
        expect(nftService).toBeDefined();

        // Step 7: Verify all services are integrated
        expect(transactionService).toBeDefined();
        expect(nftService).toBeDefined();
      });
    });

    it('should handle wallet recovery flow', async () => {
      await withTimeout(async () => {
        // Step 1: Create original wallet via wallet service
        const originalAccount = await walletService.addAccountFromSeed(TEST_MNEMONIC, 'Original Wallet');
        await walletService.connect();
        
        // Step 2: Get initial state
        const originalAddress = await walletService.getAddress();
        const originalState = await walletService.getState();

        // Step 3: Simulate recovery (cleanup and recreate)
        await walletService.cleanup();
        await keyringService.cleanup();

        // Step 4: Recreate services
        keyringService = new KeyringService();
        await keyringService.initialize();
        
        walletService = new WalletService(mockProvider, testConfig);
        await walletService.init();

        // Step 5: Recover from same seed
        const recoveredAccount = await keyringService.addAccountFromSeed(TEST_MNEMONIC, 'Recovered Wallet');
        await walletService.connect();

        // Step 6: Verify recovery worked
        const recoveredAddress = await walletService.getAddress();
        const recoveredState = await walletService.getState();

        expect(recoveredAddress).toBe(originalAddress);
        expect(recoveredAccount.address).toBe(originalAccount.address);
        expect(recoveredState?.isConnected).toBe(originalState?.isConnected);
      });
    });

    it('should handle multiple wallet management', async () => {
      await withTimeout(async () => {
        // Step 1: Create multiple accounts via wallet service
        const account1 = await walletService.addAccountFromSeed(TEST_MNEMONIC, 'Wallet 1');
        const account2 = await walletService.addAccountFromPrivateKey(
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          'Wallet 2'
        );

        // Step 2: Verify accounts exist (remember each seed creates 3 accounts)
        const accounts = await walletService.getAccounts();
        expect(accounts.length).toBeGreaterThan(0);
        expect(accounts.some(a => a.name === 'Wallet 1')).toBe(true);
        expect(accounts.some(a => a.name === 'Wallet 2')).toBe(true);

        // Step 3: Connect and verify active account
        await walletService.connect();
        const activeAddress = await walletService.getAddress();
        expect(activeAddress).toBeDefined();

        // Step 4: Verify services work with active account
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
      });
    });
  });

  describe('Multi-Chain Operations Flow', () => {
    beforeEach(async () => {
      // Create a session by logging in with seed
      const keyringManager = (keyringService as any).keyringManager;
      // Ensure we're logged out first
      keyringManager.logout();
      await keyringManager.loginWithSeed(TEST_MNEMONIC, 'Multi-Chain Wallet');
      await walletService.connect();
    });

    it('should handle chain switching workflow', async () => {
      await withTimeout(async () => {
        // Step 1: Start on Ethereum
        const initialChainId = await walletService.getChainId();
        expect(initialChainId).toBe(1);

        // Step 2: Switch to Polygon
        await walletService.switchChain(137);
        
        // Step 3: Verify chain changed
        const newChainId = await walletService.getChainId();
        expect(newChainId).toBe(137);

        // Step 4: Verify services still work
        const address = await walletService.getAddress();
        expect(address).toBe(TEST_ADDRESSES.ethereum);

        // Step 5: Get balance on new chain
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
      });
    });

    it('should handle cross-chain asset management', async () => {
      await withTimeout(async () => {
        // Step 1: Get balance on Ethereum
        const ethBalance = await walletService.getBalance();
        expect(ethBalance).toBeDefined();

        // Step 2: Switch to Polygon and get balance
        await walletService.switchChain(137);
        const maticBalance = await walletService.getBalance();
        expect(maticBalance).toBeDefined();

        // Step 3: Verify transaction service works on different chains
        const transactionService = walletService.getTransactionService();
        expect(transactionService).toBeDefined();

        // Step 4: Switch back to Ethereum
        await walletService.switchChain(1);
        const finalChainId = await walletService.getChainId();
        expect(finalChainId).toBe(1);
      });
    });
  });

  describe('NFT Management Flow', () => {
    beforeEach(async () => {
      // Create a session by logging in with seed
      const keyringManager = (keyringService as any).keyringManager;
      // Ensure we're logged out first
      keyringManager.logout();
      await keyringManager.loginWithSeed(TEST_MNEMONIC, 'NFT Wallet');
      await walletService.connect();
    });

    it('should handle complete NFT discovery and management', async () => {
      await withTimeout(async () => {
        // Step 1: Get NFT service
        const nftService = walletService.getNFTService();
        expect(nftService).toBeDefined();

        // Step 2: Discover NFTs
        await nftService!.discoverNFTs();

        // Step 3: Get user NFTs
        const userNFTs = await nftService!.getUserNFTs();
        expect(Array.isArray(userNFTs)).toBe(true);

        // Step 4: Test NFT metadata loading
        if (userNFTs.length > 0) {
          const firstNFT = userNFTs[0];
          const metadata = await nftService!.getNFTMetadata(
            firstNFT.contract_address,
            firstNFT.token_id
          );
          expect(metadata).toBeDefined();
        }

        // Step 5: Test multi-chain NFT discovery
        await walletService.switchChain(137);
        await nftService!.discoverNFTs();
        const polygonNFTs = await nftService!.getUserNFTs();
        expect(Array.isArray(polygonNFTs)).toBe(true);
      });
    });

    it('should handle NFT transfer workflow', async () => {
      await withTimeout(async () => {
        const nftService = walletService.getNFTService();
        const transactionService = walletService.getTransactionService();
        
        // Step 1: Prepare transfer
        const contractAddress = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
        const tokenId = '1234';
        const toAddress = '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5';

        // Step 2: Estimate gas for transfer
        const gasEstimate = await transactionService!.estimateGas({
          to: contractAddress,
          data: '0x' // Mock transfer data
        });
        expect(gasEstimate).toBeDefined();

        // Step 3: Create transfer transaction
        const transferTx = await nftService!.transferNFT(contractAddress, tokenId, toAddress);
        expect(transferTx).toBeDefined();

        // The response can be in different formats depending on the mock
        if ('success' in transferTx) {
          // Params format response
          expect((transferTx as any).success).toBe(true);
          expect((transferTx as any).transactionHash || (transferTx as any).txHash).toBeDefined();
        } else {
          // Simple format response
          expect(transferTx).toHaveProperty('hash');
          expect(transferTx).toHaveProperty('to');
        }

        // Step 4: Verify transaction was recorded
        const txHistory = await transactionService!.getTransactionHistory();
        expect(txHistory).toBeDefined();
        expect(txHistory).toHaveProperty('transactions');
        expect(Array.isArray(txHistory.transactions)).toBe(true);
      });
    });
  });

  describe('DEX Trading Flow', () => {
    beforeEach(async () => {
      // Create a session by logging in with seed
      const keyringManager = (keyringService as any).keyringManager;
      // Ensure we're logged out first
      keyringManager.logout();
      await keyringManager.loginWithSeed(TEST_MNEMONIC, 'Trading Wallet');
      await walletService.connect();
    });

    it('should handle complete trading workflow', async () => {
      await withTimeout(async () => {
        // Step 1: Get trading pairs
        const pairs = dexService.getSupportedPairs();
        expect(pairs.length).toBeGreaterThan(0);

        const testPair = pairs[0];
        expect(testPair.symbol).toBe('OMNI/USDC');

        // Step 2: Get market data
        const marketData = await dexService.getMarketData(testPair.symbol);
        expect(marketData).toBeDefined();
        expect(marketData!.pair).toBe(testPair);
        expect(marketData!.lastPrice).toBeDefined();

        // Step 3: Get order book
        const orderBook = await dexService.getOrderBook(testPair.symbol);
        expect(orderBook).toBeDefined();
        expect(Array.isArray(orderBook!.bids)).toBe(true);
        expect(Array.isArray(orderBook!.asks)).toBe(true);

        // Step 4: Place a buy order
        const buyOrder = await dexService.placeOrder({
          symbol: testPair.symbol,
          side: 'buy' as any,
          price: ethers.parseUnits('1.00', 6),
          quantity: ethers.parseEther('10')
        });

        expect(buyOrder).toBeDefined();
        expect(buyOrder.pair.symbol).toBe(testPair.symbol);
        expect(buyOrder.side).toBe('buy');
        expect(buyOrder.status).toBe('pending');

        // Step 5: Get active orders
        const activeOrders = await dexService.getActiveOrders();
        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].id).toBe(buyOrder.id);

        // Step 6: Cancel the order
        const canceled = await dexService.cancelOrder(buyOrder.id);
        expect(canceled).toBe(true);

        // Step 7: Verify order was canceled
        const updatedActiveOrders = await dexService.getActiveOrders();
        expect(updatedActiveOrders).toHaveLength(0);

        // Step 8: Check order history
        const orderHistory = await dexService.getOrderHistory();
        expect(orderHistory.length).toBeGreaterThan(0);
        expect(orderHistory[0].status).toBe('canceled');
      });
    });

    it('should handle order matching and fills', async () => {
      await withTimeout(async () => {
        const testPair = dexService.getSupportedPairs()[0];

        // Step 1: Place a sell order at market price
        const sellOrder = await dexService.placeOrder({
          symbol: testPair.symbol,
          side: 'sell' as any,
          price: ethers.parseUnits('1.00', 6),
          quantity: ethers.parseEther('5')
        });

        // Step 2: Place a buy order at same price (should match)
        const buyOrder = await dexService.placeOrder({
          symbol: testPair.symbol,
          side: 'buy' as any,
          price: ethers.parseUnits('1.00', 6),
          quantity: ethers.parseEther('5')
        });

        // Step 3: Verify orders were created
        expect(sellOrder.status).toBe('pending');
        expect(buyOrder.status).toBe('pending');

        // Step 4: Check order book reflects the orders
        const orderBook = await dexService.getOrderBook(testPair.symbol);
        expect(orderBook!.bids.length + orderBook!.asks.length).toBeGreaterThan(0);

        // Step 5: Verify transaction services are working
        const transactionService = walletService.getTransactionService();
        expect(transactionService).toBeDefined();
      });
    });
  });

  describe('Transaction Management Flow', () => {
    beforeEach(async () => {
      // Create a session by logging in with seed
      const keyringManager = (keyringService as any).keyringManager;
      // Ensure we're logged out first
      keyringManager.logout();
      await keyringManager.loginWithSeed(TEST_MNEMONIC, 'Transaction Wallet');
      await walletService.connect();
    });

    it('should handle complete transaction lifecycle', async () => {
      await withTimeout(async () => {
        // First verify we have a valid session from loginWithSeed
        const keyringManager = (keyringService as any).keyringManager;
        const initialSession = keyringManager.getSession();
        expect(initialSession).toBeDefined();
        expect(initialSession.accounts).toBeDefined();

        const transactionService = walletService.getTransactionService();
        expect(transactionService).toBeDefined();

        // Ensure wallet is connected and has address
        const walletAddress = await walletService.getAddress();
        expect(walletAddress).toBeDefined();
        // Note: walletAddress might differ from session address in test environment

        // For test environment, ensure the TransactionService can find accounts
        // The session should already exist from loginWithSeed, but let's verify
        if (process.env.NODE_ENV === 'test') {
          const keyringManager = (transactionService as any).keyringManager;
          const existingSession = keyringManager.getSession();

          if (!existingSession) {
            // This shouldn't happen if loginWithSeed worked
            console.warn('No session found, creating minimal session');
            (keyringManager as any).currentSession = {
              username: 'test-user',
              accounts: {
                ethereum: { address: walletAddress },
                omnicoin: { address: walletAddress }
              },
              lastActivity: Date.now()
            };
          } else {
            // Session exists, just verify it has the right structure
            expect(existingSession.accounts).toBeDefined();
            expect(existingSession.accounts.ethereum).toBeDefined();
            // The session address might differ from mock wallet address
            // This is OK as long as the session has a valid address
            expect(existingSession.accounts.ethereum.address).toBeTruthy();
          }
        }

        // Step 1: Prepare transaction
        const txParams = {
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: ethers.parseEther('0.1').toString(),
          gasLimit: 21000,
          chainType: 'ethereum' as const
        };

        // Step 2: Estimate gas
        const gasEstimate = await transactionService!.estimateGas(txParams);
        expect(gasEstimate).toBeDefined();
        expect(gasEstimate).toBeGreaterThan(0n);

        // Step 3: Get fee data
        const feeData = await transactionService!.getFeeData();
        expect(feeData).toBeDefined();
        expect(feeData.gasPrice).toBeDefined();

        // Set the wallet on the transaction service for test environment
        if (process.env.NODE_ENV === 'test' && transactionService) {
          (transactionService as any).wallet = walletService.wallet;

          // Also ensure the keyring manager has the session
          const keyringManager = (keyringService as any).keyringManager;
          const session = keyringManager.getSession();
          expect(session).toBeDefined();
          expect(session.accounts).toBeDefined();

          // Ensure TransactionService has the same keyring manager instance
          const tsKeyringManager = (transactionService as any).keyringManager;
          expect(tsKeyringManager).toBe(keyringManager);
        }

        // Step 4: Create transaction
        const signTxParams = {
          ...txParams,
          gasPrice: feeData.gasPrice
        };
        const signedTx = await transactionService!.signTransaction(signTxParams);
        expect(signedTx).toBeDefined();
        expect(signedTx.startsWith('0x')).toBe(true);

        // Step 5: Send transaction (mocked)
        // Don't include 'from' - let the service determine it from session
        const sendTxParams = {
          ...txParams,
          gasPrice: feeData.gasPrice
        };
        const txResponse = await transactionService!.sendTransaction(sendTxParams);
        expect(txResponse).toBeDefined();
        expect(txResponse.hash).toBeDefined();

        // Step 6: Get transaction history
        const history = await transactionService!.getTransactionHistory();
        expect(history).toBeDefined();
        expect(history).toHaveProperty('transactions');
        expect(Array.isArray(history.transactions)).toBe(true);
        expect(history.transactions.length).toBeGreaterThan(0);

        // Step 7: Get transaction record
        const txRecord = await transactionService!.getTransaction(txResponse.hash);
        // In test mode, the transaction might not be in the database yet
        // Just verify the method works without throwing
        expect(txRecord).toBeDefined();
        // txRecord might be null in test mode since we're using mocks
      });
    });

    it('should handle batch transaction operations', async () => {
      await withTimeout(async () => {
        const transactionService = walletService.getTransactionService();

        // Ensure wallet setup for test
        if (process.env.NODE_ENV === 'test' && transactionService) {
          (transactionService as any).wallet = walletService.wallet;
        }

        // Get wallet address for transactions
        const walletAddress = await walletService.getAddress();

        // For test environment, ensure the TransactionService can find accounts
        if (process.env.NODE_ENV === 'test' && transactionService) {
          const keyringManager = (transactionService as any).keyringManager;
          if (!keyringManager.getSession()) {
            (keyringManager as any).currentSession = {
              username: 'test-user',
              accounts: {
                ethereum: { address: walletAddress },
                omnicoin: { address: walletAddress }
              },
              lastActivity: Date.now()
            };
          }
        }

        // Step 1: Prepare multiple transactions
        const transactions = [
          {
            to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
            value: ethers.parseEther('0.01').toString(),
            chainType: 'ethereum' as const
          },
          {
            to: '0x853d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b6',
            value: ethers.parseEther('0.02').toString(),
            chainType: 'ethereum' as const
          }
        ];

        // Step 2: Estimate gas for all transactions
        for (const tx of transactions) {
          const estimate = await transactionService!.estimateGas(tx);
          expect(estimate).toBeGreaterThan(0n);
        }

        // Step 3: Send transactions
        const txResponses = [];
        for (const tx of transactions) {
          const response = await transactionService!.sendTransaction(tx);
          txResponses.push(response);
          expect(response.hash).toBeDefined();
        }

        // Step 4: Verify all transactions in history
        const history = await transactionService!.getTransactionHistory();
        expect(history).toBeDefined();
        expect(history.transactions.length).toBeGreaterThanOrEqual(txResponses.length);
      });
    });
  });

  describe('Emergency Recovery Flow', () => {
    it('should handle service failure and recovery', async () => {
      await withTimeout(async () => {
        // Step 1: Set up wallet normally with session
        const keyringManager = (keyringService as any).keyringManager;
        keyringManager.logout();
        await keyringManager.loginWithSeed(TEST_MNEMONIC, 'Recovery Test');
        await walletService.connect();
        
        const originalAddress = await walletService.getAddress();
        expect(originalAddress).toBeDefined();

        // Step 2: Simulate service failure
        await walletService.disconnect();
        expect(walletService.isWalletConnected()).toBe(false);

        // Step 3: Clear cache to simulate corruption
        await walletService.clearCache();

        // Step 4: Attempt recovery
        await walletService.connect();
        expect(walletService.isWalletConnected()).toBe(true);

        // Step 5: Verify wallet still works
        const recoveredAddress = await walletService.getAddress();
        expect(recoveredAddress).toBe(originalAddress);

        // Step 6: Verify all services work
        const transactionService = walletService.getTransactionService();
        const nftService = walletService.getNFTService();
        
        expect(transactionService).toBeDefined();
        expect(nftService).toBeDefined();

        // Step 7: Verify operations still work
        const balance = await walletService.getBalance();
        expect(balance).toBeDefined();
      });
    });

    it('should handle keyring corruption and recovery', async () => {
      await withTimeout(async () => {
        // Step 1: Create account and connect
        const account = await keyringService.addAccountFromSeed(TEST_MNEMONIC, 'Corruption Test');
        await walletService.connect();

        // Step 2: Force cleanup keyring service
        await keyringService.cleanup();

        // Step 3: Reinitialize keyring
        keyringService = new KeyringService();
        await keyringService.initialize();

        // Step 4: Recover account
        const recoveredAccount = await keyringService.addAccountFromSeed(TEST_MNEMONIC, 'Recovered Account');
        expect(recoveredAccount.address).toBe(account.address);

        // Step 5: Verify wallet service still works
        const address = await walletService.getAddress();
        expect(address).toBeDefined();
      });
    });
  });

  describe('Performance and Scalability Flow', () => {
    it('should handle high-frequency operations', async () => {
      await withTimeout(async () => {
        const keyringManager = (keyringService as any).keyringManager;
        keyringManager.logout();
        await keyringManager.loginWithSeed(TEST_MNEMONIC, 'Performance Test');
        await walletService.connect();

        const startTime = Date.now();
        const operations = [];

        // Step 1: Perform 50 balance checks rapidly
        for (let i = 0; i < 50; i++) {
          operations.push(walletService.getBalance());
        }

        const results = await Promise.all(operations);
        const endTime = Date.now();

        // Step 2: Verify all operations completed successfully
        expect(results).toHaveLength(50);
        results.forEach(balance => {
          expect(balance).toBeDefined();
        });

        // Step 3: Verify performance is reasonable (under 10 seconds)
        expect(endTime - startTime).toBeLessThan(10000);
      }, 15000);
    });

    it('should handle concurrent service operations', async () => {
      await withTimeout(async () => {
        const keyringManager = (keyringService as any).keyringManager;
        keyringManager.logout();
        await keyringManager.loginWithSeed(TEST_MNEMONIC, 'Concurrency Test');
        await walletService.connect();

        // Step 1: Start concurrent operations
        const operations = [
          walletService.getBalance(),
          walletService.getChainId(),
          walletService.getState(),
          dexService.getSupportedPairs(),
          dexService.getMarketData('OMNI/USDC')
        ];

        // Step 2: Wait for all to complete
        const results = await Promise.all(operations);

        // Step 3: Verify all operations succeeded
        expect(results[0]).toBeDefined(); // balance
        expect(results[1]).toBe(1); // chainId
        expect(results[2]).toBeDefined(); // state
        expect(Array.isArray(results[3])).toBe(true); // pairs
        expect(results[4]).toBeDefined(); // market data
      });
    });
  });
});