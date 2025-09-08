/**
 * NFT Manager Tests
 * Tests NFT discovery, caching, and management functionality
 * @jest-environment node
 */

// Setup mocks before any other imports
import './jest.setup';

// Import dependencies and types
import { MOCK_NFTS, TEST_PASSWORD, TEST_ADDRESSES, cleanupTest } from '../../setup';
import { NFT, NFTType, Chain } from '../../../src/core/nft/types';
import { keyringService } from '../../../src/core/keyring/KeyringService';

// Create mocked discovery service
const mockDiscoveryService = {
  discoverNFTs: jest.fn().mockImplementation(() => Promise.resolve({
    nfts: MOCK_NFTS,
    nextCursor: null
  })),
  getNFT: jest.fn().mockResolvedValue(null)
};

// Mock the discovery service module
jest.mock('../../../src/core/nft/discovery', () => ({
  NFTDiscoveryService: jest.fn().mockImplementation(() => mockDiscoveryService)
}));

// Mock provider manager before importing NFTManager
jest.mock('../../../src/core/providers/ProviderManager', () => {
  const mockProvider = {
    sendTransaction: jest.fn().mockResolvedValue('0x123'),
    getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getNetwork: jest.fn().mockResolvedValue({ name: 'ethereum', chainId: 1 })
  };
  
  // Create mock EVM provider with contract interaction methods
  const mockEVMProvider = {
    ...mockProvider,
    getSigner: jest.fn().mockReturnValue({
      getAddress: jest.fn().mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3')
    }),
    call: jest.fn().mockResolvedValue('0x')
  };
  
  const mockProviderManager = {
    providers: new Map([['ethereum', mockProvider]]),
    evmProviders: new Map([['ethereum', mockEVMProvider]]),
    activeChain: 'ethereum',
    activeNetwork: 'ethereum',
    getProvider: jest.fn().mockReturnValue(mockProvider),
    getActiveProvider: jest.fn().mockReturnValue(mockEVMProvider),
    switchEVMNetwork: jest.fn().mockResolvedValue(undefined),
    getEVMProvider: jest.fn().mockReturnValue(mockEVMProvider),
    initialize: jest.fn().mockResolvedValue(undefined),
    getActiveChain: jest.fn().mockReturnValue('ethereum'),
    getActiveNetwork: jest.fn().mockReturnValue('ethereum')
  };
  
  return {
    providerManager: mockProviderManager,
    ProviderManager: {
      getInstance: jest.fn().mockReturnValue(mockProviderManager)
    }
  };
});

// Now import modules that depend on mocks
import { providerManager } from '../../../src/core/providers/ProviderManager';
import { nftManager } from '../../../src/core/nft/NFTManager';

describe('NFTManager', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    await keyringService.createWallet(TEST_PASSWORD);
    await keyringService.createAccount('ethereum', 'Test ETH');
    await keyringService.createAccount('solana', 'Test SOL');
    keyringService.setActiveAccount(TEST_ADDRESSES.ethereum);
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Initialization', () => {
    it('should initialize with discovery service', () => {
      expect(nftManager).toBeDefined();
      // Verify NFTManager was created and has discovery service
      expect((nftManager as any).discoveryService).toBeDefined();
    });
  });

  describe('NFT Discovery', () => {
    it('should discover NFTs for active account', async () => {
      const nfts = await nftManager.getActiveAccountNFTs();
      
      expect(nfts).toHaveLength(MOCK_NFTS.length);
      expect(nfts[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        chain: expect.any(String)
      });
    });

    it('should discover NFTs with options', async () => {
      const options = {
        chains: ['ethereum', 'polygon'] as Chain[],
        includeSpam: false,
        limit: 10
      };

      const nfts = await nftManager.getNFTs(TEST_ADDRESSES.ethereum, options);
      
      expect(mockDiscoveryService.discoverNFTs).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum,
        options
      );
    });

    it('should cache NFT results', async () => {
      // First call
      const nfts1 = await nftManager.getActiveAccountNFTs();
      
      // Clear mock to verify cache is used
      mockDiscoveryService.discoverNFTs.mockClear();
      
      // Second call should use cache
      const nfts2 = await nftManager.getActiveAccountNFTs();
      
      expect(nfts1).toEqual(nfts2);
      expect(mockDiscoveryService.discoverNFTs).not.toHaveBeenCalled();
    });

    it('should refresh NFTs when requested', async () => {
      // Initial fetch
      await nftManager.getActiveAccountNFTs();
      
      mockDiscoveryService.discoverNFTs.mockClear();
      
      // Force refresh
      const refreshedNfts = await nftManager.refreshNFTs();
      
      expect(mockDiscoveryService.discoverNFTs).toHaveBeenCalled();
      expect(refreshedNfts).toHaveLength(MOCK_NFTS.length);
    });
  });

  describe('Collections', () => {
    it('should group NFTs by collection', async () => {
      const collections = await nftManager.getCollections();
      
      expect(collections).toBeInstanceOf(Map);
      
      // Check collection grouping
      for (const [collectionName, nfts] of collections) {
        expect(typeof collectionName).toBe('string');
        expect(Array.isArray(nfts)).toBe(true);
        
        // All NFTs in a collection should have matching collection names
        nfts.forEach(nft => {
          expect(nft.collection?.name || 'Uncategorized').toBe(collectionName);
        });
      }
    });

    it('should get NFTs for specific collection', async () => {
      const collections = await nftManager.getCollections();
      const firstCollectionName = Array.from(collections.keys())[0];
      
      if (firstCollectionName) {
        const collectionNFTs = await nftManager.getNFTsForCollection(firstCollectionName);
        
        expect(Array.isArray(collectionNFTs)).toBe(true);
        expect(collectionNFTs.length).toBeGreaterThan(0);
        
        // Verify all NFTs belong to the requested collection
        collectionNFTs.forEach(nft => {
          expect(nft.collection?.name || 'Uncategorized').toBe(firstCollectionName);
        });
      }
    });
  });

  describe('NFT Transfer', () => {
    it.skip('should transfer ERC721 NFT', async () => {
      const erc721NFT: NFT = {
        ...MOCK_NFTS[0],
        type: NFTType.ERC721,
        chain: 'ethereum' as Chain
      };

      const txHash = await nftManager.transferNFT(
        erc721NFT,
        TEST_ADDRESSES.ethereum,
      );

      expect(txHash).toBe('0x123');
      expect(providerManager.getProvider).toHaveBeenCalledWith('ethereum');
    });

    it.skip('should transfer ERC1155 NFT with amount', async () => {
      const erc1155NFT: NFT = {
        ...MOCK_NFTS[0],
        type: NFTType.ERC1155,
        chain: 'ethereum' as Chain
      };

      const txHash = await nftManager.transferNFT(
        erc1155NFT,
        TEST_ADDRESSES.ethereum,
        '5'
      );

      expect(txHash).toBe('0x123');
      expect(providerManager.getProvider).toHaveBeenCalledWith('ethereum');
    });

    it('should throw error for unsupported chain', async () => {
      const unsupportedNFT: NFT = {
        ...MOCK_NFTS[0],
        chain: 'unsupported' as Chain
      };

      await expect(
        nftManager.transferNFT(unsupportedNFT, TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('not supported');
    });

    it.skip('should throw error for unsupported NFT type', async () => {
      const unsupportedNFT: NFT = {
        ...MOCK_NFTS[0],
        type: 'UNKNOWN' as NFTType,
        chain: 'ethereum' as Chain
      };

      await expect(
        nftManager.transferNFT(unsupportedNFT, TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('Unsupported NFT type');
    });

    it('should handle transfer with no active account', async () => {
      // Mock keyringService to return no active account
      jest.spyOn(keyringService, 'getActiveAccount').mockReturnValueOnce(undefined);

      const nft: NFT = {
        ...MOCK_NFTS[0],
        type: NFTType.ERC721,
        chain: 'ethereum' as Chain
      };

      await expect(
        nftManager.transferNFT(nft, TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('No active account');
    });
  });

  describe('Search', () => {
    it('should search NFTs by name', async () => {
      const searchResults = await nftManager.searchNFTs('Test');
      
      expect(Array.isArray(searchResults)).toBe(true);
      
      // All results should contain search term in name or collection
      searchResults.forEach(nft => {
        const nameMatch = nft.name?.toLowerCase().includes('test') ||
                         nft.metadata?.name?.toLowerCase().includes('test');
        const collectionMatch = nft.collection?.name?.toLowerCase().includes('test');
        
        expect(nameMatch || collectionMatch).toBe(true);
      });
    });

    it('should handle empty search query', async () => {
      const results = await nftManager.searchNFTs('');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(MOCK_NFTS.length); // Should return all NFTs
    });

    it('should handle case-insensitive search', async () => {
      const upperResults = await nftManager.searchNFTs('TEST');
      const lowerResults = await nftManager.searchNFTs('test');
      
      expect(upperResults).toEqual(lowerResults);
    });
  });

  describe('Statistics', () => {
    it('should calculate NFT statistics', async () => {
      const stats = await nftManager.getStatistics();
      
      expect(stats).toMatchObject({
        totalNFTs: expect.any(Number),
        byChain: expect.any(Object),
        byCollection: expect.any(Object),
        collections: expect.any(Number),
        totalFloorValue: expect.any(Number)
      });

      expect(stats.totalNFTs).toBe(MOCK_NFTS.length);
      expect(Object.keys(stats.byChain).length).toBeGreaterThan(0);
    });

    it('should count NFTs by chain correctly', async () => {
      const stats = await nftManager.getStatistics();
      
      // Verify chain counts add up to total
      const totalByChain = Object.values(stats.byChain).reduce((sum, count) => sum + count, 0);
      expect(totalByChain).toBe(stats.totalNFTs);
    });

    it('should calculate total floor value', async () => {
      const stats = await nftManager.getStatistics();
      
      expect(typeof stats.totalFloorValue).toBe('number');
      expect(stats.totalFloorValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      // Fetch NFTs to populate cache
      await nftManager.getActiveAccountNFTs();
      
      // Clear cache
      await nftManager.clearCache();
      
      // Next fetch should call discovery service
      mockDiscoveryService.discoverNFTs.mockClear();
      
      await nftManager.getActiveAccountNFTs();
      
      expect(mockDiscoveryService.discoverNFTs).toHaveBeenCalled();
    });

    it('should refresh cache after timeout', async () => {
      // Set a short cache timeout for testing
      (nftManager as any).cacheTimeout = 100; // 100ms
      
      // First fetch
      await nftManager.getActiveAccountNFTs();
      
      mockDiscoveryService.discoverNFTs.mockClear();
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should fetch again
      await nftManager.getActiveAccountNFTs();
      
      expect(mockDiscoveryService.discoverNFTs).toHaveBeenCalled();
      
      // Restore original timeout
      (nftManager as any).cacheTimeout = 5 * 60 * 1000;
    });
  });

  describe('Error Handling', () => {
    it('should handle discovery service errors', async () => {
      // Clear cache to ensure fresh call
      await nftManager.clearCache();
      
      // Reset mock and set up rejection
      mockDiscoveryService.discoverNFTs.mockReset();
      mockDiscoveryService.discoverNFTs.mockRejectedValueOnce(new Error('Discovery failed'));
      
      await expect(
        nftManager.getNFTs(TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('Discovery failed');
    });

    it.skip('should handle provider errors during transfer', async () => {
      // Create a failing provider mock
      const failingProvider = {
        sendTransaction: jest.fn().mockRejectedValueOnce(new Error('Transaction failed')),
        getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        getNetwork: jest.fn().mockResolvedValue({ name: 'ethereum', chainId: 1 })
      };
      
      // Override getProvider for this test
      (providerManager.getProvider as jest.Mock).mockReturnValueOnce(failingProvider);
      (providerManager.getActiveProvider as jest.Mock).mockReturnValueOnce(failingProvider);

      const nft: NFT = {
        ...MOCK_NFTS[0],
        type: NFTType.ERC721,
        chain: 'ethereum' as Chain
      };

      await expect(
        nftManager.transferNFT(nft, TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('Multi-Chain Support', () => {
    beforeEach(() => {
      // Clear any previous rejection mocks
      mockDiscoveryService.discoverNFTs.mockReset();
      
      // Mock different NFTs for different chains
      mockDiscoveryService.discoverNFTs.mockImplementation((_address: string, options?: any) => {
        const chains = options?.chains || ['ethereum'];
        const nfts = MOCK_NFTS.filter(nft => chains.includes(nft.chain));
        
        return Promise.resolve({
          nfts,
          nextCursor: null
        });
      });
    });

    it('should fetch NFTs from specific chains', async () => {
      const ethereumNFTs = await nftManager.getNFTs(TEST_ADDRESSES.ethereum, {
        chains: ['ethereum'] as Chain[]
      });

      const polygonNFTs = await nftManager.getNFTs(TEST_ADDRESSES.ethereum, {
        chains: ['polygon'] as Chain[]
      });

      expect(ethereumNFTs.every(nft => nft.chain === 'ethereum')).toBe(true);
      expect(polygonNFTs.every(nft => nft.chain === 'polygon')).toBe(true);
    });

    it('should fetch NFTs from multiple chains', async () => {
      const multiChainNFTs = await nftManager.getNFTs(TEST_ADDRESSES.ethereum, {
        chains: ['ethereum', 'polygon', 'solana'] as Chain[]
      });

      const chains = new Set(multiChainNFTs.map(nft => nft.chain));
      expect(chains.size).toBeGreaterThan(1);
    });
  });

  describe('Spam Filtering', () => {
    beforeEach(() => {
      // Clear cache to ensure fresh calls
      nftManager.clearCache();
      
      // Reset the mock to clear call history
      mockDiscoveryService.discoverNFTs.mockClear();
    });
    
    it('should filter spam NFTs by default', async () => {
      const nfts = await nftManager.getNFTs(TEST_ADDRESSES.ethereum);
      
      // Verify discovery was called with spam filtering
      expect(mockDiscoveryService.discoverNFTs).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum,
        expect.objectContaining({
          includeSpam: false
        })
      );
    });

    it('should include spam NFTs when requested', async () => {
      const nfts = await nftManager.getNFTs(TEST_ADDRESSES.ethereum, {
        includeSpam: true
      });

      expect(mockDiscoveryService.discoverNFTs).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum,
        expect.objectContaining({
          includeSpam: true
        })
      );
    });
  });
});