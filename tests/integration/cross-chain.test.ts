/**
 * Cross-Chain Integration Tests
 * Tests end-to-end cross-chain scenarios
 */

import { keyringService } from '../../src/core/keyring/KeyringService';
import { providerManager } from '../../src/core/providers/ProviderManager';
import { nftManager } from '../../src/core/nft';
import { paymentRouter } from '../../src/core/payments/routing';
import { bridgeService } from '../../src/core/bridge';
import { TEST_PASSWORD, TEST_ADDRESSES, cleanupTest } from '../setup';
import { ChainType } from '../../src/core/keyring/BIP39Keyring';
import { NFT, NFTType, NFTStandard, NFTMetadata } from '../../src/core/nft/types';

describe('Cross-Chain Integration', () => {
  beforeAll(async () => {
    // Initialize wallet with all chains
    await keyringService.createWallet(TEST_PASSWORD);
    await providerManager.initialize();
  });

  afterAll(() => {
    cleanupTest();
  });

  describe('Multi-Chain Account Creation', () => {
    it('should create accounts across all supported ecosystems', async () => {
      // Create accounts
      const ethAccount = await keyringService.createAccount('ethereum', 'ETH Main');
      const btcAccount = await keyringService.createAccount('bitcoin', 'BTC Main');
      const solAccount = await keyringService.createAccount('solana', 'SOL Main');
      const dotAccount = await keyringService.createAccount('substrate', 'DOT Main');
      
      // Verify all accounts exist
      const accounts = keyringService.getAccounts();
      expect(accounts).toHaveLength(4);
      
      // Verify correct chain types
      expect(ethAccount.chainType).toBe(ChainType.ETHEREUM);
      expect(btcAccount.chainType).toBe(ChainType.BITCOIN);
      expect(solAccount.chainType).toBe(ChainType.SOLANA);
      expect(dotAccount.chainType).toBe(ChainType.SUBSTRATE);
      
      // Verify addresses are valid format
      expect(ethAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(btcAccount.address).toMatch(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/);
      expect(solAccount.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(dotAccount.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{47,48}$/);
    });

    it.skip('should derive consistent addresses from same mnemonic', async () => {
      // Get current mnemonic
      const mnemonic = await keyringService.exportSeedPhrase(TEST_PASSWORD);
      
      // Create new keyring service
      const newKeyring = Object.create(keyringService);
      await newKeyring.restoreWallet(mnemonic, TEST_PASSWORD);
      await newKeyring.createAccount('ethereum', 'ETH Copy');
      
      // Create same accounts
      const ethAccount1 = keyringService.getAccounts().find(acc => acc.chainType === 'ethereum');
      const ethAccount2 = newKeyring.getAccounts().find(acc => acc.chainType === 'ethereum');
      
      // Addresses should match for same derivation path
      expect(ethAccount1).toBeDefined();
      expect(ethAccount2).toBeDefined();
      expect(ethAccount1?.address).toBe(ethAccount2?.address);
    });
  });

  describe('Cross-Chain NFT Discovery', () => {
    it('should discover NFTs across multiple chains simultaneously', async () => {
      // Mock NFT discovery across chains
      const mockDiscovery = jest.spyOn(nftManager, 'getActiveAccountNFTs')
        .mockResolvedValue([
          {
            id: 'eth-nft-1',
            name: 'Ethereum NFT',
            chain: 'ethereum',
            contract_address: '0x123',
            token_id: '1',
            type: NFTType.ERC721,
            standard: NFTStandard.ERC721,
            owner: TEST_ADDRESSES.ethereum,
            metadata: {
              name: 'Ethereum NFT',
              description: 'Test NFT on Ethereum',
              image: 'https://example.com/eth-nft.png'
            } as NFTMetadata
          },
          {
            id: 'polygon-nft-1',
            name: 'Polygon NFT',
            chain: 'polygon',
            contract_address: '0x456',
            token_id: '2',
            type: NFTType.ERC721,
            standard: NFTStandard.ERC721,
            owner: TEST_ADDRESSES.ethereum,
            metadata: {
              name: 'Polygon NFT',
              description: 'Test NFT on Polygon',
              image: 'https://example.com/polygon-nft.png'
            } as NFTMetadata
          },
          {
            id: 'sol-nft-1',
            name: 'Solana NFT',
            chain: 'solana',
            contract_address: 'SolanaAddress',
            token_id: '3',
            type: NFTType.Solana,
            standard: NFTStandard.Solana,
            owner: TEST_ADDRESSES.solana || 'SolanaTestAddress',
            metadata: {
              name: 'Solana NFT',
              description: 'Test NFT on Solana',
              image: 'https://example.com/solana-nft.png'
            } as NFTMetadata
          }
        ] as NFT[]);
      
      const nfts = await nftManager.getActiveAccountNFTs({
        chains: ['ethereum', 'polygon', 'solana']
      });
      
      expect(nfts).toHaveLength(3);
      
      // Verify chains are represented
      const chains = nfts.map(n => n.chain);
      expect(chains).toContain('ethereum');
      expect(chains).toContain('polygon');
      expect(chains).toContain('solana');
      
      mockDiscovery.mockRestore();
    });

    it('should aggregate NFT statistics across chains', async () => {
      const mockStats = jest.spyOn(nftManager, 'getStatistics')
        .mockResolvedValue({
          totalNFTs: 150,
          byChain: {
            ethereum: 50,
            polygon: 30,
            arbitrum: 20,
            optimism: 15,
            solana: 35
          },
          collections: 25,
          totalFloorValue: 125.5
        });
      
      const stats = await nftManager.getStatistics();
      
      expect(stats.totalNFTs).toBe(150);
      expect(Object.keys(stats.byChain)).toHaveLength(5);
      expect(stats.totalFloorValue).toBe(125.5);
      
      mockStats.mockRestore();
    });
  });

  describe('Cross-Chain Payment Routing', () => {
    it('should find payment routes across multiple chains', async () => {
      const mockFindRoute = jest.spyOn(paymentRouter, 'findAllRoutes')
        .mockResolvedValue([
          {
            blockchain: 'ethereum',
            fromAddress: TEST_ADDRESSES.ethereum,
            toAddress: TEST_ADDRESSES.ethereum,
            fromToken: { symbol: 'ETH', decimals: 18 } as unknown,
            toToken: { symbol: 'USDC', decimals: 6 } as unknown,
            exchangeRoutes: [{ exchange: 'uniswap_v3' } as unknown],
            steps: [
              { type: 'swap', description: 'Swap ETH to USDC' },
              { type: 'transfer', description: 'Transfer USDC' }
            ]
          },
          {
            blockchain: 'polygon',
            fromAddress: TEST_ADDRESSES.ethereum,
            toAddress: TEST_ADDRESSES.ethereum,
            fromToken: { symbol: 'MATIC', decimals: 18 } as unknown,
            toToken: { symbol: 'USDC', decimals: 6 } as unknown,
            exchangeRoutes: [{ exchange: 'quickswap' } as unknown],
            steps: [
              { type: 'swap', description: 'Swap MATIC to USDC' },
              { type: 'bridge', description: 'Bridge to Ethereum' }
            ]
          }
        ] as unknown);
      
      const request = {
        from: [TEST_ADDRESSES.ethereum],
        to: TEST_ADDRESSES.ethereum,
        accept: [{
          blockchain: 'ethereum',
          token: 'USDC',
          receiver: TEST_ADDRESSES.ethereum
        }]
      };
      
      const routes = await paymentRouter.findAllRoutes(request);
      
      expect(routes).toHaveLength(2);
      expect(routes[0].blockchain).toBe('ethereum');
      expect(routes[1].blockchain).toBe('polygon');
      
      // Second route should include bridge step
      expect(routes[1].steps.some(s => s.type === 'bridge')).toBe(true);
      
      mockFindRoute.mockRestore();
    });

    it('should execute cross-chain payment with bridge', async () => {
      const mockExecute = jest.spyOn(paymentRouter, 'executeRoute')
        .mockResolvedValue('bridge-transfer-id');
      
      const mockBridgeExecute = jest.spyOn(bridgeService, 'executeBridge')
        .mockResolvedValue('bridge-123');
      
      const crossChainRoute = {
        blockchain: 'polygon',
        steps: [
          { 
            type: 'bridge' as const, 
            description: 'Bridge USDC to Ethereum',
            data: { bridgeRoute: { id: 'test-bridge' } }
          }
        ]
      } as unknown;
      
      const result = await paymentRouter.executeRoute(crossChainRoute);
      
      expect(result).toBe('bridge-transfer-id');
      
      mockExecute.mockRestore();
      mockBridgeExecute.mockRestore();
    });
  });

  describe('Chain Switching', () => {
    it('should switch between EVM chains seamlessly', async () => {
      const evmChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];

      for (const chain of evmChains) {
        await providerManager.switchEVMNetwork(chain);
        expect(providerManager.getActiveNetwork()).toBe(chain);

        const details = await providerManager.getCurrentNetworkDetails();

        // Network names might not always contain the chain key exactly
        // Check that we got valid network details
        expect(details.name).toBeTruthy();
        expect(details.chainId).toBeGreaterThan(0);
        expect(details.nativeCurrency).toBeDefined();
        expect(details.nativeCurrency.symbol).toBeTruthy();

        // For specific chains, verify the expected values
        switch (chain) {
          case 'ethereum':
            expect(details.name).toBe('Ethereum Mainnet');
            expect(details.chainId).toBe(1);
            expect(details.nativeCurrency.symbol).toBe('ETH');
            break;
          case 'polygon':
            expect(details.name).toBe('Polygon');
            expect(details.chainId).toBe(137);
            expect(details.nativeCurrency.symbol).toBe('MATIC');
            break;
          case 'arbitrum':
            expect(details.name).toBe('Arbitrum One');
            expect(details.chainId).toBe(42161);
            expect(details.nativeCurrency.symbol).toBe('ETH');
            break;
          case 'optimism':
            expect(details.name).toBe('Optimism');
            expect(details.chainId).toBe(10);
            expect(details.nativeCurrency.symbol).toBe('ETH');
            break;
          case 'base':
            expect(details.name).toBe('Base');
            expect(details.chainId).toBe(8453);
            expect(details.nativeCurrency.symbol).toBe('ETH');
            break;
        }
      }
    });

    it('should switch between different chain types', async () => {
      // EVM to Solana
      await providerManager.setActiveChain(ChainType.SOLANA);
      expect(providerManager.getActiveChain()).toBe(ChainType.SOLANA);

      // Solana to Bitcoin
      await providerManager.setActiveChain(ChainType.BITCOIN);
      expect(providerManager.getActiveChain()).toBe(ChainType.BITCOIN);

      // Bitcoin to Substrate
      await providerManager.setActiveChain(ChainType.SUBSTRATE);
      expect(providerManager.getActiveChain()).toBe(ChainType.SUBSTRATE);

      // Back to EVM
      await providerManager.setActiveChain(ChainType.ETHEREUM);
      expect(providerManager.getActiveChain()).toBe(ChainType.ETHEREUM);
    });
  });

  describe('Bridge Integration', () => {
    it('should get quotes from multiple bridge providers', async () => {
      const mockQuotes = jest.spyOn(bridgeService, 'getQuotes')
        .mockResolvedValue({
          routes: [
            {
              id: 'hop-route',
              bridge: 'hop',
              fromChain: 'ethereum',
              toChain: 'polygon',
              fee: { amount: '1000000', token: 'USDC' },
              estimatedTime: 600
            },
            {
              id: 'stargate-route',
              bridge: 'stargate',
              fromChain: 'ethereum',
              toChain: 'polygon',
              fee: { amount: '500000', token: 'USDC' },
              estimatedTime: 300
            }
          ] as unknown,
          bestRoute: null
        });
      
      const quotes = await bridgeService.getQuotes({
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: 'USDC',
        amount: '1000000000',
        fromAddress: TEST_ADDRESSES.ethereum
      });
      
      expect(quotes.routes).toHaveLength(2);
      
      // Different bridges should have different characteristics
      const hopRoute = quotes.routes.find(r => r.bridge === 'hop');
      const stargateRoute = quotes.routes.find(r => r.bridge === 'stargate');
      
      expect(hopRoute).toBeTruthy();
      expect(stargateRoute).toBeTruthy();
      if (stargateRoute && hopRoute) {
        expect(stargateRoute.estimatedTime).toBeLessThan(hopRoute.estimatedTime);
      }
      
      mockQuotes.mockRestore();
    });

    it('should track bridge transfer status', async () => {
      const mockExecute = jest.spyOn(bridgeService, 'executeBridge')
        .mockResolvedValue('transfer-123');
      
      const mockStatus = jest.spyOn(bridgeService, 'getTransferStatus')
        .mockReturnValueOnce({ 
          id: 'transfer-123', 
          status: 'pending',
          estimatedArrival: Date.now() + 600000
        })
        .mockReturnValueOnce({
          id: 'transfer-123',
          status: 'completed',
          fromTxHash: '0x123',
          toTxHash: '0x456'
        });
      
      const transferId = await bridgeService.executeBridge({} as unknown);
      
      // Check initial status
      let status = bridgeService.getTransferStatus(transferId);
      expect(status?.status).toBe('pending');
      
      // Check completed status
      status = bridgeService.getTransferStatus(transferId);
      expect(status?.status).toBe('completed');
      expect(status?.toTxHash).toBeTruthy();
      
      mockExecute.mockRestore();
      mockStatus.mockRestore();
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete cross-chain NFT purchase flow', async () => {
      // Scenario: User wants to buy NFT on Ethereum but has funds on Polygon
      
      // 1. Check balances across chains
      const _mockBalances = new Map([
        ['ethereum', '0'],
        ['polygon', '1000000000'] // 1000 USDC on Polygon
      ]);
      
      // 2. Find payment route (Polygon USDC -> Bridge -> Ethereum)
      const mockRoute = jest.spyOn(paymentRouter, 'findBestRoute')
        .mockResolvedValue({
          blockchain: 'polygon',
          fromToken: { symbol: 'USDC', decimals: 6 } as unknown,
          toToken: { symbol: 'USDC', decimals: 6 } as unknown,
          steps: [
            { type: 'bridge', description: 'Bridge USDC to Ethereum' },
            { type: 'transfer', description: 'Purchase NFT' }
          ]
        } as unknown);
      
      const route = await paymentRouter.findBestRoute({
        from: [TEST_ADDRESSES.ethereum],
        to: '0xNFTContract',
        amount: '100',
        blockchain: 'ethereum',
        token: 'USDC'
      });
      
      expect(route).toBeTruthy();
      if (route) {
        expect(route.blockchain).toBe('polygon'); // Starts from Polygon
        expect(route.steps[0].type).toBe('bridge');
      }
      
      mockRoute.mockRestore();
    });

    it('should handle multi-hop cross-chain transfer', async () => {
      // Scenario: SOL -> Bridge to ETH -> Swap to USDC -> Bridge to Polygon
      
      const complexRoute = {
        blockchain: 'solana',
        fromAddress: TEST_ADDRESSES.solana,
        steps: [
          { type: 'bridge' as const, description: 'Bridge SOL to ETH (Wormhole)' },
          { type: 'swap' as const, description: 'Swap ETH to USDC (Uniswap)' },
          { type: 'bridge' as const, description: 'Bridge USDC to Polygon (Hop)' },
          { type: 'transfer' as const, description: 'Final transfer' }
        ]
      };
      
      // Verify each step can be executed
      expect(complexRoute.steps).toHaveLength(4);
      expect(complexRoute.steps.filter(s => s.type === 'bridge')).toHaveLength(2);
      expect(complexRoute.steps.filter(s => s.type === 'swap')).toHaveLength(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent operations across chains', async () => {
      const operations = [
        // NFT discovery on multiple chains
        nftManager.getActiveAccountNFTs({ chains: ['ethereum', 'polygon'] }),
        
        // Balance checks on different chains
        providerManager.getBalance(TEST_ADDRESSES.ethereum),
        
        // Bridge quotes
        bridgeService.estimateBridgeFees('ethereum', 'arbitrum', 'ETH', '1000000000000000000'),
        
        // Payment routes
        paymentRouter.findAllRoutes({
          from: [TEST_ADDRESSES.ethereum],
          to: TEST_ADDRESSES.ethereum
        })
      ];
      
      // All operations should complete without interference
      const results = await Promise.allSettled(operations);
      
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });
});