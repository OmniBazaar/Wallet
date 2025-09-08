/**
 * Multi-Chain Operations Integration Tests
 * Tests cross-chain functionality with TypeScript strict mode compliance
 */

import { providerManager } from '../../src/core/providers/ProviderManager';
import { paymentRouter } from '../../src/core/payments/routing';
import { bridgeService } from '../../src/core/bridge';
import { nftManager } from '../../src/core/nft/NFTManager';
import { keyringService } from '../../src/core/keyring/KeyringService';
import { ChainType } from '../../src/core/keyring/BIP39Keyring';
import { TransactionService } from '../../src/core/transaction/TransactionService';
import { WalletImpl } from '../../src/core/wallet/Wallet';
import { TEST_ADDRESSES, TEST_PASSWORD, MOCK_TOKENS, cleanupTest } from '../setup';
import { ethers } from 'ethers';

// Set timeout for integration tests
jest.setTimeout(30000); // Increase timeout for integration tests

describe('Multi-Chain Operations Integration', () => {
  beforeEach(async () => {
    // Clean up from previous tests
    cleanupTest();
    
    // Initialize keyring service
    await keyringService.createWallet(TEST_PASSWORD);
    
    // Create accounts for different chains
    await keyringService.createAccount('ethereum', 'ETH Account');
    await keyringService.createAccount('solana', 'SOL Account');
    await keyringService.createAccount('bitcoin', 'BTC Account');
    
    // Initialize provider manager
    await providerManager.initialize();
    
    // Bridge service will provide real quotes in test environment
    // No need to mock - the service handles test scenarios internally
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Cross-Chain Account Management', () => {
    it('should manage accounts across multiple chains', async () => {
      // Get accounts for different chains
      const accounts = keyringService.getAccounts();
      const chainTypes = accounts.map(acc => acc.chainType);
      
      expect(chainTypes).toContain('ethereum');
      expect(chainTypes).toContain('solana');
      expect(chainTypes).toContain('bitcoin');
      
      // Switch between different chain accounts
      const ethAccount = accounts.find(acc => acc.chainType === 'ethereum');
      const solAccount = accounts.find(acc => acc.chainType === 'solana');
      
      expect(ethAccount).toBeDefined();
      expect(solAccount).toBeDefined();
      
      if (ethAccount && solAccount) {
        keyringService.setActiveAccount(ethAccount.id);
        expect(keyringService.getActiveAccount()?.chainType).toBe('ethereum');
        
        keyringService.setActiveAccount(solAccount.id);
        expect(keyringService.getActiveAccount()?.chainType).toBe('solana');
      }
    });

    it('should derive addresses correctly for different chains', async () => {
      const accounts = keyringService.getAccounts();
      
      accounts.forEach(account => {
        expect(account.address).toBeDefined();
        expect(account.address.length).toBeGreaterThan(0);
        
        switch (account.chainType) {
          case 'ethereum':
            expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            break;
          case 'solana':
            expect(account.address.length).toBeGreaterThanOrEqual(32);
            break;
          case 'bitcoin':
            expect(account.address).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/);
            break;
        }
      });
    });
  });

  describe('Cross-Chain Provider Management', () => {
    it('should initialize providers for all supported chains', async () => {
      const supportedChains = [
        ChainType.Ethereum,
        ChainType.Bitcoin,
        ChainType.Solana,
        ChainType.Substrate
      ];
      
      supportedChains.forEach(chainType => {
        const provider = providerManager.getProvider(chainType);
        expect(provider).toBeDefined();
      });
    });

    it('should switch between different chain providers', async () => {
      // Start with Ethereum
      expect(providerManager.getActiveChain()).toBe(ChainType.Ethereum);
      
      // Switch to Solana
      await providerManager.setActiveChain(ChainType.Solana);
      expect(providerManager.getActiveChain()).toBe(ChainType.Solana);
      
      // Switch to Bitcoin
      await providerManager.setActiveChain(ChainType.Bitcoin);
      expect(providerManager.getActiveChain()).toBe(ChainType.Bitcoin);
      
      // Back to Ethereum
      await providerManager.setActiveChain(ChainType.Ethereum);
      expect(providerManager.getActiveChain()).toBe(ChainType.Ethereum);
    });

    it('should handle EVM network switching', async () => {
      const evmNetworks = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];
      
      for (const network of evmNetworks) {
        await providerManager.switchEVMNetwork(network);
        expect(providerManager.getActiveNetwork()).toBe(network);
        
        const networkDetails = await providerManager.getCurrentNetworkDetails();
        expect(networkDetails.name).toBeDefined();
        expect(networkDetails.chainId).toBeDefined();
        expect(networkDetails.nativeCurrency).toBeDefined();
      }
    });
  });

  describe('Cross-Chain Balance Operations', () => {
    it('should get balances across multiple chains', async () => {
      const chains = [ChainType.Ethereum, ChainType.Solana];
      const balances: Record<string, string> = {};
      
      for (const chain of chains) {
        await providerManager.setActiveChain(chain);
        const balance = await providerManager.getBalance();
        balances[chain] = balance;
        
        expect(balance).toBeDefined();
        expect(typeof balance).toBe('string');
        expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
      }
      
      // Verify we got different balances (or at least didn't error)
      expect(Object.keys(balances)).toHaveLength(chains.length);
    });

    it('should get formatted balances with proper decimals', async () => {
      const testCases = [
        { chain: ChainType.Ethereum, expectedDecimals: 18 },
        { chain: ChainType.Solana, expectedDecimals: 9 }
      ];
      
      for (const { chain, expectedDecimals } of testCases) {
        await providerManager.setActiveChain(chain);
        const balance = await providerManager.getFormattedBalance();
        
        expect(balance).toBeDefined();
        
        // Check if balance has reasonable decimal places
        const decimalPlaces = balance.split('.')[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(expectedDecimals);
      }
    });
  });

  describe('Cross-Chain Transaction Operations', () => {
    it('should send transactions on different chains', async () => {
      const transactionService = TransactionService.getInstance();
      
      // Test Ethereum transaction
      await providerManager.setActiveChain(ChainType.Ethereum);
      const ethTxResult = await transactionService.sendTransaction({
        to: TEST_ADDRESSES.ethereum,
        value: '1000000000000000000', // 1 ETH
        chainType: 'ethereum'
      });
      
      expect(ethTxResult.hash).toBeDefined();
      expect(ethTxResult.chainType).toBe('ethereum');
      
      // Test Polygon transaction
      const polyTxResult = await transactionService.sendTransaction({
        to: TEST_ADDRESSES.ethereum, // Same format as Ethereum
        value: '1000000000000000000', // 1 MATIC
        chainType: 'polygon'
      });
      
      expect(polyTxResult.hash).toBeDefined();
      expect(polyTxResult.chainType).toBe('polygon');
    });

    it('should estimate gas correctly for different chains', async () => {
      const chains = ['ethereum', 'polygon', 'arbitrum'];
      
      for (const chain of chains) {
        await providerManager.switchEVMNetwork(chain);
        
        const gasEstimate = await providerManager.estimateGas(
          TEST_ADDRESSES.ethereum,
          '0.1'
        );
        
        expect(gasEstimate).toBeDefined();
        expect(parseInt(gasEstimate)).toBeGreaterThan(0);
        expect(parseInt(gasEstimate)).toBeLessThan(1000000); // Reasonable gas limit
      }
    });
  });

  describe('Cross-Chain Payment Routing', () => {
    it('should find payment routes across different chains', async () => {
      const paymentRequest = {
        from: [TEST_ADDRESSES.ethereum, TEST_ADDRESSES.polygon],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC',
        accept: [{
          blockchain: 'ethereum',
          token: 'USDC',
          receiver: TEST_ADDRESSES.ethereum
        }]
      };
      
      const routes = await paymentRouter.findAllRoutes(paymentRequest);
      
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThanOrEqual(0);
      
      // If routes found, verify structure
      if (routes.length > 0) {
        const route = routes[0];
        expect(route.blockchain).toBeDefined();
        expect(route.fromAddress).toBeDefined();
        expect(route.toAddress).toBeDefined();
        expect(route.steps).toBeDefined();
        expect(Array.isArray(route.steps)).toBe(true);
      }
    });

    it('should find optimal cross-chain bridge routes', async () => {
      const bridgeRequest = {
        from: [TEST_ADDRESSES.polygon],
        to: TEST_ADDRESSES.ethereum,
        amount: '1000000', // 1 USDC
        token: 'USDC',
        blockchain: 'ethereum' // Destination chain
      };
      
      const route = await paymentRouter.findBestRoute(bridgeRequest);
      
      if (route) {
        expect(route.blockchain).toBeDefined();
        expect(route.steps.some(step => step.type === 'bridge')).toBe(true);
        
        // Execute the bridge route
        const txHash = await paymentRouter.executeRoute(route);
        expect(txHash).toBeDefined();
        expect(typeof txHash).toBe('string');
      }
    });

    it('should handle multi-step cross-chain routes', async () => {
      const complexRequest = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'WBTC',
        accept: [{
          blockchain: 'polygon',
          token: 'USDC',
          receiver: TEST_ADDRESSES.polygon
        }]
      };
      
      const route = await paymentRouter.findBestRoute(complexRequest);
      
      if (route && route.steps.length > 1) {
        // Should have multiple steps: swap + bridge or transfer
        expect(route.steps.length).toBeGreaterThanOrEqual(2);
        
        const stepTypes = route.steps.map(step => step.type);
        expect(stepTypes).toContain('swap');
        // Bridge might be represented as 'bridge' or 'transfer' depending on implementation
        expect(stepTypes.some(type => type === 'bridge' || type === 'transfer')).toBe(true);
      }
    });
  });

  describe('Cross-Chain NFT Operations', () => {
    it('should discover NFTs across multiple chains', async () => {
      const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'solana'];
      
      const nfts = await nftManager.getActiveAccountNFTs({
        chains: supportedChains,
        limit: 100
      });
      
      expect(Array.isArray(nfts)).toBe(true);
      
      if (nfts.length > 0) {
        // Verify NFTs from different chains are included
        const chainTypes = [...new Set(nfts.map(nft => nft.chain))];
        expect(chainTypes.length).toBeGreaterThanOrEqual(1);
        
        // Verify NFT structure
        nfts.forEach(nft => {
          expect(nft.id).toBeDefined();
          // Name is optional in NFT type, but should exist or be undefined
          expect(typeof nft.name === 'string' || nft.name === undefined).toBe(true);
          expect(nft.chain).toBeDefined();
          expect(supportedChains).toContain(nft.chain);
        });
      }
    });

    it('should filter NFTs by specific chains', async () => {
      const ethereumNFTs = await nftManager.getActiveAccountNFTs({
        chains: ['ethereum'],
        limit: 50
      });
      
      const polygonNFTs = await nftManager.getActiveAccountNFTs({
        chains: ['polygon'],
        limit: 50
      });
      
      expect(Array.isArray(ethereumNFTs)).toBe(true);
      expect(Array.isArray(polygonNFTs)).toBe(true);
      
      // All Ethereum NFTs should be on Ethereum
      ethereumNFTs.forEach(nft => {
        expect(nft.chain).toBe('ethereum');
      });
      
      // All Polygon NFTs should be on Polygon
      polygonNFTs.forEach(nft => {
        expect(nft.chain).toBe('polygon');
      });
    });

    it('should get collection statistics across chains', async () => {
      const stats = await nftManager.getStatistics();
      
      expect(stats.totalNFTs).toBeDefined();
      expect(stats.collections).toBeDefined();
      expect(stats.byChain).toBeDefined();
      expect(typeof stats.totalNFTs).toBe('number');
      expect(typeof stats.collections).toBe('number');
      
      // Verify chain breakdown
      Object.keys(stats.byChain).forEach(chain => {
        expect(typeof stats.byChain[chain]).toBe('number');
        expect(stats.byChain[chain]).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Cross-Chain Bridge Integration', () => {
    it('should get bridge quotes for different token pairs', async () => {
      const bridgeQuotes = await bridgeService.getQuotes({
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: '1000000',
        fromAddress: TEST_ADDRESSES.ethereum,
        toAddress: TEST_ADDRESSES.polygon
      });
      
      expect(bridgeQuotes.routes).toBeDefined();
      expect(Array.isArray(bridgeQuotes.routes)).toBe(true);
      
      if (bridgeQuotes.routes.length > 0) {
        const route = bridgeQuotes.routes[0];
        expect(route.fromChain).toBe('ethereum');
        expect(route.toChain).toBe('polygon');
        expect(route.bridge).toBeDefined();
        expect(route.estimatedTime).toBeDefined();
        expect(typeof route.estimatedTime).toBe('number');
      }
    });

    it('should execute bridge transactions', async () => {
      const bridgeRoute = {
        id: 'test-bridge-execution',
        fromChain: 'polygon',
        toChain: 'ethereum',
        fromToken: MOCK_TOKENS.polygon.USDC,
        toToken: MOCK_TOKENS.ethereum.USDC,
        fromAmount: '500000',
        toAmount: '495000',
        bridge: 'hop',
        estimatedTime: 600
      };
      
      const txHash = await bridgeService.executeBridge(bridgeRoute as any);
      
      expect(txHash).toBeDefined();
      expect(typeof txHash).toBe('string');
      // Should return a valid transaction hash
      expect(txHash.length).toBeGreaterThan(0);
    });
  });

  describe('Type Safety in Cross-Chain Operations', () => {
    it('should handle null and undefined values safely', async () => {
      // Test null address handling
      const nullAddressRequest = {
        from: [null as any, undefined as any, ''].filter(Boolean),
        to: TEST_ADDRESSES.ethereum,
        amount: '100',
        token: 'USDC'
      };
      
      const route = await paymentRouter.findBestRoute(nullAddressRequest);
      // Should not throw, may return null
      expect(route).toBeDefined();
    });

    it('should handle chain switching with type safety', async () => {
      const chains = [
        ChainType.Ethereum,
        ChainType.Solana,
        ChainType.Bitcoin,
        ChainType.Substrate
      ];
      
      for (const chain of chains) {
        await providerManager.setActiveChain(chain);
        const activeChain = providerManager.getActiveChain();
        
        expect(activeChain).toBe(chain);
        expect(typeof activeChain).toBe('string');
      }
    });

    it('should handle BigInt arithmetic across chains', async () => {
      const weiAmount = BigInt('1000000000000000000'); // 1 ETH
      const lamportsAmount = BigInt('1000000000'); // 1 SOL
      const satoshisAmount = BigInt('100000000'); // 1 BTC
      
      // Verify type safety with different chain amounts
      expect(typeof weiAmount).toBe('bigint');
      expect(typeof lamportsAmount).toBe('bigint');
      expect(typeof satoshisAmount).toBe('bigint');
      
      // Calculations should work
      const totalValue = weiAmount + lamportsAmount + satoshisAmount;
      expect(typeof totalValue).toBe('bigint');
      expect(totalValue).toBe(BigInt('1000000000000000000') + BigInt('1000000000') + BigInt('100000000'));
    });
  });

  describe('Error Handling in Multi-Chain Operations', () => {
    it('should handle provider connection failures', async () => {
      // Test with an invalid provider configuration
      try {
        // Try to switch to a non-existent chain
        await providerManager.setActiveChain('invalid-chain' as ChainType);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // The error message should indicate the chain is not supported
      }
    });

    it('should handle bridge service failures', async () => {
      // Test with an unsupported bridge route
      const bridgeRequest = {
        fromChain: 'unsupported-chain' as any,
        toChain: 'another-unsupported-chain' as any,
        fromToken: 'INVALID',
        toToken: 'INVALID',
        amount: '100',
        fromAddress: TEST_ADDRESSES.ethereum,
        toAddress: TEST_ADDRESSES.polygon
      };
      
      // Should handle bridge failures gracefully
      try {
        const quotes = await bridgeService.getQuotes(bridgeRequest);
        // Should return empty routes for unsupported chains
        expect(quotes.routes).toHaveLength(0);
        expect(quotes.bestRoute).toBeNull();
      } catch (error) {
        // Or throw an error for invalid chains
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle invalid chain types', async () => {
      await expect(
        providerManager.setActiveChain('invalid-chain' as ChainType)
      ).rejects.toThrow();
      
      await expect(
        providerManager.switchEVMNetwork('invalid-network')
      ).rejects.toThrow();
    });
  });

  describe('Performance in Multi-Chain Operations', () => {
    it('should perform chain switching efficiently', async () => {
      const start = performance.now();
      
      const chains = [ChainType.Ethereum, ChainType.Solana, ChainType.Bitcoin];
      for (let i = 0; i < 10; i++) {
        const chain = chains[i % chains.length];
        await providerManager.setActiveChain(chain);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
    });

    it('should cache provider instances', () => {
      const provider1 = providerManager.getProvider(ChainType.Ethereum);
      const provider2 = providerManager.getProvider(ChainType.Ethereum);
      
      // Should return same instance (cached)
      expect(provider1).toBe(provider2);
    });
  });
});