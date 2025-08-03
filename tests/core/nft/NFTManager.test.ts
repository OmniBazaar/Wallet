/**
 * NFT Manager Tests
 * Tests NFT discovery, caching, and management functionality
 */

import { nftManager } from '../../../src/core/nft/NFTManager';
import { NFTDiscoveryService } from '../../../src/core/nft/discovery';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { providerManager } from '../../../src/core/providers/ProviderManager';
import { MOCK_NFTS, TEST_PASSWORD, TEST_ADDRESSES, cleanupTest } from '../../setup';
import { NFT, NFTType, Chain } from '../../../src/core/nft/types';

// Mock NFT Discovery Service
jest.mock('../../../src/core/nft/discovery', () => ({
  NFTDiscoveryService: jest.fn().mockImplementation(() => ({
    discoverNFTs: jest.fn().mockResolvedValue({
      nfts: MOCK_NFTS,
      nextCursor: null
    })
  }))
}));

// Mock provider manager
jest.mock('../../../src/core/providers/ProviderManager', () => ({
  providerManager: {
    getProvider: jest.fn().mockReturnValue({
      sendTransaction: jest.fn().mockResolvedValue('0x' + '1'.repeat(64))
    })
  }
}));

describe('NFTManager', () => {
  beforeEach(async () => {
    await keyringService.createWallet(TEST_PASSWORD);
    await keyringService.createAccount('ethereum', 'ETH Account');
    await keyringService.createAccount('solana', 'SOL Account');
    
    // Clear NFT cache
    nftManager['nftCache'].clear();
    nftManager['lastFetchTime'].clear();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('NFT Discovery', () => {
    it('should discover NFTs for active account', async () => {
      const nfts = await nftManager.getActiveAccountNFTs();
      
      expect(nfts).toHaveLength(MOCK_NFTS.length);
      expect(nfts[0].name).toBe('Bored Ape #1234');
      expect(nfts[1].name).toBe('DeGod #5678');
    });

    it('should discover NFTs with options', async () => {
      const nfts = await nftManager.getActiveAccountNFTs({
        chains: ['ethereum', 'polygon'],
        includeSpam: false,
        limit: 50
      });
      
      expect(NFTDiscoveryService).toHaveBeenCalled();
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      expect(discoveryInstance.discoverNFTs).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          chains: ['ethereum', 'polygon'],
          includeSpam: false,
          limit: 50
        })
      );
    });

    it('should discover NFTs for specific address', async () => {
      const nfts = await nftManager.getNFTs(TEST_ADDRESSES.ethereum);
      
      expect(nfts).toHaveLength(MOCK_NFTS.length);
      expect(NFTDiscoveryService).toHaveBeenCalled();
    });

    it('should cache NFT results', async () => {
      // First call - should fetch from API
      const nfts1 = await nftManager.getActiveAccountNFTs();
      expect(nfts1).toHaveLength(MOCK_NFTS.length);
      
      // Reset mock to track calls
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockClear();
      
      // Second call within cache time - should use cache
      const nfts2 = await nftManager.getActiveAccountNFTs();
      expect(nfts2).toHaveLength(MOCK_NFTS.length);
      expect(discoveryInstance.discoverNFTs).not.toHaveBeenCalled();
    });

    it('should force refresh when requested', async () => {
      // First call
      await nftManager.getActiveAccountNFTs();
      
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockClear();
      
      // Force refresh
      const nfts = await nftManager.refreshNFTs();
      expect(nfts).toHaveLength(MOCK_NFTS.length);
      expect(discoveryInstance.discoverNFTs).toHaveBeenCalled();
    });
  });

  describe('NFT Collections', () => {
    beforeEach(async () => {
      await nftManager.getActiveAccountNFTs();
    });

    it('should group NFTs by collection', async () => {
      const collections = await nftManager.getCollections();
      
      expect(collections.size).toBe(2);
      expect(collections.has('Bored Ape Yacht Club')).toBe(true);
      expect(collections.has('DeGods')).toBe(true);
      
      const baycNfts = collections.get('Bored Ape Yacht Club');
      expect(baycNfts).toHaveLength(1);
      expect(baycNfts![0].name).toBe('Bored Ape #1234');
    });

    it('should get NFTs for specific collection', async () => {
      const nfts = await nftManager.getNFTsForCollection('Bored Ape Yacht Club');
      
      expect(nfts).toHaveLength(1);
      expect(nfts[0].collection?.name).toBe('Bored Ape Yacht Club');
    });

    it('should return empty array for unknown collection', async () => {
      const nfts = await nftManager.getNFTsForCollection('Unknown Collection');
      expect(nfts).toEqual([]);
    });
  });

  describe('NFT Statistics', () => {
    beforeEach(async () => {
      // Add floor price to mock NFTs
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockResolvedValue({
        nfts: [
          { ...MOCK_NFTS[0], floor_price: 50.5 },
          { ...MOCK_NFTS[1], floor_price: 10.2 }
        ],
        nextCursor: null
      });
      
      await nftManager.refreshNFTs();
    });

    it('should calculate NFT statistics', async () => {
      const stats = await nftManager.getStatistics();
      
      expect(stats.totalNFTs).toBe(2);
      expect(stats.byChain.ethereum).toBe(1);
      expect(stats.byChain.solana).toBe(1);
      expect(stats.collections).toBe(2);
      expect(stats.totalFloorValue).toBe(60.7);
    });

    it('should handle NFTs without floor price', async () => {
      // Reset with NFTs without floor price
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockResolvedValue({
        nfts: MOCK_NFTS,
        nextCursor: null
      });
      
      await nftManager.refreshNFTs();
      const stats = await nftManager.getStatistics();
      
      expect(stats.totalFloorValue).toBe(0);
    });
  });

  describe('NFT Search', () => {
    beforeEach(async () => {
      // Add more NFTs for search testing
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockResolvedValue({
        nfts: [
          ...MOCK_NFTS,
          {
            id: 'mock-nft-3',
            contract_address: '0x123',
            token_id: '999',
            name: 'Cool Cat #999',
            collection: { name: 'Cool Cats', symbol: 'COOL' },
            chain: 'ethereum'
          }
        ],
        nextCursor: null
      });
      
      await nftManager.refreshNFTs();
    });

    it('should search NFTs by name', async () => {
      const results = await nftManager.searchNFTs('Bored');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bored Ape #1234');
    });

    it('should search NFTs case-insensitive', async () => {
      const results = await nftManager.searchNFTs('degod');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('DeGod #5678');
    });

    it('should search by collection name', async () => {
      const results = await nftManager.searchNFTs('Cool Cats');
      
      expect(results).toHaveLength(1);
      expect(results[0].collection?.name).toBe('Cool Cats');
    });

    it('should return empty array for no matches', async () => {
      const results = await nftManager.searchNFTs('NonExistent');
      expect(results).toEqual([]);
    });
  });

  describe('NFT Transfers', () => {
    it('should transfer EVM NFT', async () => {
      const nft: NFT = {
        ...MOCK_NFTS[0],
        contract: {
          address: MOCK_NFTS[0].contract_address,
          type: NFTType.ERC721
        }
      } as NFT;
      
      const txHash = await nftManager.transferNFT(
        nft,
        TEST_ADDRESSES.ethereum
      );
      
      expect(txHash).toBe('0x' + '1'.repeat(64));
      expect(providerManager.getProvider).toHaveBeenCalledWith('ethereum');
    });

    it('should transfer Solana NFT', async () => {
      const nft: NFT = {
        ...MOCK_NFTS[1],
        contract: {
          address: MOCK_NFTS[1].contract_address,
          type: NFTType.SolanaToken
        }
      } as NFT;
      
      const txHash = await nftManager.transferNFT(
        nft,
        TEST_ADDRESSES.solana
      );
      
      expect(txHash).toBe('0x' + '1'.repeat(64));
      expect(providerManager.getProvider).toHaveBeenCalledWith('solana');
    });

    it('should throw error for unsupported chain transfer', async () => {
      const nft: NFT = {
        ...MOCK_NFTS[0],
        chain: 'unsupported' as Chain
      } as NFT;
      
      await expect(
        nftManager.transferNFT(nft, TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('NFT transfers not supported');
    });
  });

  describe('Multi-Chain Support', () => {
    it('should discover NFTs across multiple chains', async () => {
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockResolvedValue({
        nfts: [
          { ...MOCK_NFTS[0], chain: 'ethereum' },
          { ...MOCK_NFTS[0], chain: 'polygon' },
          { ...MOCK_NFTS[0], chain: 'arbitrum' },
          { ...MOCK_NFTS[1], chain: 'solana' }
        ],
        nextCursor: null
      });
      
      const nfts = await nftManager.getActiveAccountNFTs({
        chains: ['ethereum', 'polygon', 'arbitrum', 'solana']
      });
      
      expect(nfts).toHaveLength(4);
      const chains = nfts.map(n => n.chain);
      expect(chains).toContain('ethereum');
      expect(chains).toContain('polygon');
      expect(chains).toContain('arbitrum');
      expect(chains).toContain('solana');
    });

    it('should filter NFTs by chain', async () => {
      const allNFTs = await nftManager.getActiveAccountNFTs();
      
      const ethNFTs = allNFTs.filter(n => n.chain === 'ethereum');
      const solNFTs = allNFTs.filter(n => n.chain === 'solana');
      
      expect(ethNFTs).toHaveLength(1);
      expect(solNFTs).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle discovery service errors', async () => {
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockRejectedValue(new Error('API Error'));
      
      await expect(
        nftManager.getActiveAccountNFTs()
      ).rejects.toThrow('API Error');
    });

    it('should handle no active account', async () => {
      // Mock no active account
      keyringService.getActiveAccount = jest.fn().mockReturnValue(null);
      
      await expect(
        nftManager.getActiveAccountNFTs()
      ).rejects.toThrow('No active account');
    });

    it('should handle transfer errors', async () => {
      const provider = providerManager.getProvider('ethereum' as any);
      provider.sendTransaction = jest.fn().mockRejectedValue(new Error('Transfer failed'));
      
      const nft: NFT = {
        ...MOCK_NFTS[0],
        contract: {
          address: MOCK_NFTS[0].contract_address,
          type: NFTType.ERC721
        }
      } as NFT;
      
      await expect(
        nftManager.transferNFT(nft, TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('Transfer failed');
    });
  });

  describe('Cache Management', () => {
    it('should expire cache after timeout', async () => {
      // First call
      await nftManager.getActiveAccountNFTs();
      
      // Mock time passing (6 minutes)
      const originalTime = nftManager['lastFetchTime'].get;
      nftManager['lastFetchTime'].get = jest.fn().mockReturnValue(
        Date.now() - 6 * 60 * 1000
      );
      
      const discoveryInstance = (NFTDiscoveryService as jest.Mock).mock.results[0].value;
      discoveryInstance.discoverNFTs.mockClear();
      
      // Should fetch again
      await nftManager.getActiveAccountNFTs();
      expect(discoveryInstance.discoverNFTs).toHaveBeenCalled();
      
      // Restore
      nftManager['lastFetchTime'].get = originalTime;
    });

    it('should clear cache on refresh', async () => {
      await nftManager.getActiveAccountNFTs();
      expect(nftManager['nftCache'].size).toBe(1);
      
      await nftManager.refreshNFTs();
      
      // Cache should still have entry but with fresh data
      expect(nftManager['nftCache'].size).toBe(1);
    });
  });
});