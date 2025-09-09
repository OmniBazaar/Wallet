/**
 * NFTService Test Suite
 * 
 * Tests NFT operations including metadata retrieval, collection management,
 * transfers, minting, listings, and multi-chain support.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NFTService } from '../../src/services/NFTService';
import type { NFTServiceConfig } from '../../src/core/nft/NFTService';

// Mock the core NFTService
jest.mock('../../src/core/nft/NFTService', () => {
  return {
    NFTService: jest.fn().mockImplementation((wallet, config) => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getActiveAccountNFTs: jest.fn().mockResolvedValue([]),
      getNFTs: jest.fn().mockResolvedValue([]),
      getNFTsForChain: jest.fn().mockResolvedValue([]),
      getNFTMetadata: jest.fn().mockResolvedValue(null),
      getCollections: jest.fn().mockResolvedValue([]),
      transferNFT: jest.fn().mockResolvedValue({ success: true, txHash: '0x123' }),
      listNFT: jest.fn().mockResolvedValue({ success: true, listingId: 'listing123' }),
      mintNFT: jest.fn().mockResolvedValue({ success: true, tokenId: '1', transactionHash: '0x456' }),
      buyNFT: jest.fn().mockResolvedValue({ success: true, txHash: '0x789' }),
      getTrendingNFTs: jest.fn().mockResolvedValue([]),
      getSupportedChains: jest.fn().mockReturnValue([{ chainId: 1, name: 'Ethereum' }]),
      isUsingOmniProvider: jest.fn().mockReturnValue(true),
      switchProvider: jest.fn().mockResolvedValue(undefined),
      discoverNFTs: jest.fn().mockResolvedValue(undefined),
      clearCache: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('NFTService', () => {
  let nftService: NFTService;
  let mockWallet: any;
  let mockCoreService: any;

  // Test data
  const TEST_CONFIG: NFTServiceConfig = {
    useOmniProvider: true,
    validatorUrl: 'http://localhost:3001',
    apiKeys: {
      alchemy: 'test-alchemy-key',
      moralis: 'test-moralis-key',
      opensea: 'test-opensea-key'
    }
  };

  const TEST_NFT = {
    id: 'nft-1',
    contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    tokenId: '1234',
    name: 'Bored Ape #1234',
    description: 'A bored ape from the yacht club',
    image: 'ipfs://QmPbxeGcXhYQQNgsC6a36dDyYUcHgMLnGKnF8pTvnyjQz',
    owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
    chainId: 1,
    collection: {
      name: 'Bored Ape Yacht Club',
      symbol: 'BAYC'
    },
    attributes: [
      { trait_type: 'Background', value: 'Blue' },
      { trait_type: 'Fur', value: 'Golden Brown' }
    ]
  };

  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue(TEST_ADDRESS)
    };

    nftService = new NFTService(mockWallet, TEST_CONFIG);
    
    // Get reference to the mocked core service
    mockCoreService = (nftService as any).coreService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with wallet and config', async () => {
      await nftService.init();
      
      expect(mockCoreService.initialize).toHaveBeenCalled();
      expect(nftService.isNFTServiceInitialized()).toBe(true);
    });

    it('should initialize with default config', async () => {
      const defaultService = new NFTService();
      await defaultService.init();
      
      expect((defaultService as any).coreService.initialize).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await nftService.init();
      await nftService.init();
      
      expect(mockCoreService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockCoreService.initialize.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(nftService.init()).rejects.toThrow(
        'Failed to initialize NFT service: Network error'
      );
    });

    it('should wrap unknown errors', async () => {
      mockCoreService.initialize.mockRejectedValueOnce('Unknown error');
      
      await expect(nftService.init()).rejects.toThrow(
        'Failed to initialize NFT service: Unknown error'
      );
    });
  });

  describe('NFT Retrieval', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should get NFTs for active account', async () => {
      mockCoreService.getActiveAccountNFTs.mockResolvedValueOnce([TEST_NFT]);
      
      const nfts = await nftService.getActiveAccountNFTs();
      
      expect(nfts).toEqual([TEST_NFT]);
      expect(mockCoreService.getActiveAccountNFTs).toHaveBeenCalled();
    });

    it('should get NFTs for specific address', async () => {
      mockCoreService.getNFTs.mockResolvedValueOnce([TEST_NFT]);
      
      const nfts = await nftService.getNFTs(TEST_ADDRESS);
      
      expect(nfts).toEqual([TEST_NFT]);
      expect(mockCoreService.getNFTs).toHaveBeenCalledWith(TEST_ADDRESS);
    });

    it('should get NFTs for specific chain', async () => {
      mockCoreService.getNFTsForChain.mockResolvedValueOnce([TEST_NFT]);
      
      const nfts = await nftService.getNFTsForChain(TEST_ADDRESS, 1);
      
      expect(nfts).toEqual([TEST_NFT]);
      expect(mockCoreService.getNFTsForChain).toHaveBeenCalledWith(TEST_ADDRESS, 1);
    });

    it('should get user NFTs (alias for active account)', async () => {
      mockCoreService.getActiveAccountNFTs.mockResolvedValueOnce([TEST_NFT]);
      
      const nfts = await nftService.getUserNFTs();
      
      expect(nfts).toEqual([TEST_NFT]);
      expect(mockCoreService.getActiveAccountNFTs).toHaveBeenCalled();
    });

    it('should get trending NFTs', async () => {
      const trendingNFTs = [TEST_NFT];
      mockCoreService.getTrendingNFTs.mockResolvedValueOnce(trendingNFTs);
      
      const result = await nftService.getTrendingNFTs(1);
      
      expect(result).toEqual(trendingNFTs);
      expect(mockCoreService.getTrendingNFTs).toHaveBeenCalledWith(1);
    });

    it('should get trending NFTs without chain ID', async () => {
      const trendingNFTs = [TEST_NFT];
      mockCoreService.getTrendingNFTs.mockResolvedValueOnce(trendingNFTs);
      
      const result = await nftService.getTrendingNFTs();
      
      expect(result).toEqual(trendingNFTs);
      expect(mockCoreService.getTrendingNFTs).toHaveBeenCalledWith(undefined);
    });
  });

  describe('NFT Metadata', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should get NFT metadata', async () => {
      const metadata = {
        name: 'Test NFT',
        description: 'A test NFT',
        image: 'ipfs://test',
        attributes: []
      };
      mockCoreService.getNFTMetadata.mockResolvedValueOnce(metadata);
      
      const result = await nftService.getNFTMetadata(
        TEST_NFT.contractAddress,
        TEST_NFT.tokenId,
        1
      );
      
      expect(result).toEqual(metadata);
      expect(mockCoreService.getNFTMetadata).toHaveBeenCalledWith(
        TEST_NFT.contractAddress,
        TEST_NFT.tokenId,
        1
      );
    });

    it('should use default chain ID for metadata', async () => {
      await nftService.getNFTMetadata(
        TEST_NFT.contractAddress,
        TEST_NFT.tokenId
      );
      
      expect(mockCoreService.getNFTMetadata).toHaveBeenCalledWith(
        TEST_NFT.contractAddress,
        TEST_NFT.tokenId,
        1
      );
    });

    it('should handle null metadata', async () => {
      mockCoreService.getNFTMetadata.mockResolvedValueOnce(null);
      
      const result = await nftService.getNFTMetadata(
        TEST_NFT.contractAddress,
        TEST_NFT.tokenId
      );
      
      expect(result).toBeNull();
    });
  });

  describe('Collections', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should get collections for address', async () => {
      const collections = [{
        address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
        name: 'Bored Ape Yacht Club',
        symbol: 'BAYC',
        totalSupply: 10000
      }];
      mockCoreService.getCollections.mockResolvedValueOnce(collections);
      
      const result = await nftService.getCollections(TEST_ADDRESS);
      
      expect(result).toEqual(collections);
      expect(mockCoreService.getCollections).toHaveBeenCalledWith(TEST_ADDRESS, undefined);
    });

    it('should get collections for specific chain', async () => {
      const collections = [{
        address: '0x123',
        name: 'Test Collection',
        symbol: 'TEST'
      }];
      mockCoreService.getCollections.mockResolvedValueOnce(collections);
      
      const result = await nftService.getCollections(TEST_ADDRESS, 1);
      
      expect(result).toEqual(collections);
      expect(mockCoreService.getCollections).toHaveBeenCalledWith(TEST_ADDRESS, 1);
    });
  });

  describe('NFT Transfers', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should transfer NFT successfully', async () => {
      const transferParams = {
        contractAddress: TEST_NFT.contractAddress,
        tokenId: TEST_NFT.tokenId,
        from: TEST_ADDRESS,
        to: '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B',
        chainId: 1
      };
      
      const result = await nftService.transferNFT(transferParams);
      
      expect(result).toEqual({ success: true, txHash: '0x123' });
      expect(mockCoreService.transferNFT).toHaveBeenCalledWith(transferParams);
    });

    it('should handle transfer errors', async () => {
      mockCoreService.transferNFT.mockResolvedValueOnce({
        success: false,
        error: 'Insufficient funds'
      });
      
      const result = await nftService.transferNFT({
        contractAddress: TEST_NFT.contractAddress,
        tokenId: TEST_NFT.tokenId,
        from: TEST_ADDRESS,
        to: '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B',
        chainId: 1
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });
  });

  describe('NFT Listing', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should list NFT for sale', async () => {
      const listParams = {
        contractAddress: TEST_NFT.contractAddress,
        tokenId: TEST_NFT.tokenId,
        price: '1.5',
        chainId: 1
      };
      
      const result = await nftService.listNFT(listParams);
      
      expect(result).toEqual({ success: true, listingId: 'listing123' });
      expect(mockCoreService.listNFT).toHaveBeenCalledWith(listParams);
    });

    it('should handle listing errors', async () => {
      mockCoreService.listNFT.mockResolvedValueOnce({
        success: false,
        error: 'Not approved'
      });
      
      const result = await nftService.listNFT({
        contractAddress: TEST_NFT.contractAddress,
        tokenId: TEST_NFT.tokenId,
        price: '1.5',
        chainId: 1
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not approved');
    });
  });

  describe('NFT Minting', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should mint NFT successfully', async () => {
      const mintParams = {
        name: 'New NFT',
        description: 'A newly minted NFT',
        image: 'ipfs://newimage',
        attributes: [
          { trait_type: 'Rarity', value: 'Common' }
        ],
        recipient: TEST_ADDRESS,
        chainId: 1
      };
      
      const result = await nftService.mintNFT(mintParams);
      
      expect(result).toEqual({
        success: true,
        tokenId: '1',
        transactionHash: '0x456'
      });
      expect(mockCoreService.mintNFT).toHaveBeenCalledWith(mintParams);
    });

    it('should mint NFT without optional params', async () => {
      const mintParams = {
        name: 'Simple NFT',
        description: 'Basic NFT',
        image: 'ipfs://simple'
      };
      
      const result = await nftService.mintNFT(mintParams);
      
      expect(result.success).toBe(true);
      expect(mockCoreService.mintNFT).toHaveBeenCalledWith(mintParams);
    });

    it('should handle minting errors', async () => {
      mockCoreService.mintNFT.mockResolvedValueOnce({
        success: false,
        error: 'Gas estimation failed'
      });
      
      const result = await nftService.mintNFT({
        name: 'Failed NFT',
        description: 'Will fail',
        image: 'ipfs://fail'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Gas estimation failed');
    });
  });

  describe('NFT Purchasing', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should buy NFT successfully', async () => {
      const buyParams = {
        contractAddress: TEST_NFT.contractAddress,
        tokenId: TEST_NFT.tokenId,
        price: '2.0',
        chainId: 1
      };
      
      const result = await nftService.buyNFT(buyParams);
      
      expect(result).toEqual({ success: true, txHash: '0x789' });
      expect(mockCoreService.buyNFT).toHaveBeenCalledWith(buyParams);
    });

    it('should handle purchase errors', async () => {
      mockCoreService.buyNFT.mockResolvedValueOnce({
        success: false,
        error: 'Price mismatch'
      });
      
      const result = await nftService.buyNFT({
        contractAddress: TEST_NFT.contractAddress,
        tokenId: TEST_NFT.tokenId,
        price: '1.0',
        chainId: 1
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Price mismatch');
    });
  });

  describe('Chain Support', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should get supported chains', () => {
      const chains = [
        { chainId: 1, name: 'Ethereum' },
        { chainId: 137, name: 'Polygon' },
        { chainId: 56, name: 'BSC' }
      ];
      mockCoreService.getSupportedChains.mockReturnValueOnce(chains);
      
      const result = nftService.getSupportedChains();
      
      expect(result).toEqual(chains);
      expect(mockCoreService.getSupportedChains).toHaveBeenCalled();
    });
  });

  describe('Provider Management', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should check if using OmniProvider', () => {
      const isUsing = nftService.isUsingOmniProvider();
      
      expect(isUsing).toBe(true);
      expect(mockCoreService.isUsingOmniProvider).toHaveBeenCalled();
    });

    it('should switch to OmniProvider', async () => {
      await nftService.switchProvider(true);
      
      expect(mockCoreService.switchProvider).toHaveBeenCalledWith(true);
    });

    it('should switch to external APIs', async () => {
      await nftService.switchProvider(false);
      
      expect(mockCoreService.switchProvider).toHaveBeenCalledWith(false);
    });
  });

  describe('NFT Discovery', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should discover NFTs for active account', async () => {
      await nftService.discoverNFTs();
      
      expect(mockCoreService.discoverNFTs).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should clear cache', async () => {
      await nftService.clearCache();
      
      expect(mockCoreService.clearCache).toHaveBeenCalled();
    });
  });

  describe('Service Cleanup', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should cleanup resources', async () => {
      await nftService.cleanup();
      
      expect(mockCoreService.cleanup).toHaveBeenCalled();
      expect(nftService.isNFTServiceInitialized()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockCoreService.cleanup.mockRejectedValueOnce(new Error('Cleanup failed'));
      
      await expect(nftService.cleanup()).resolves.not.toThrow();
      
      expect(consoleError).toHaveBeenCalledWith(
        'Error during NFTService cleanup:',
        expect.any(Error)
      );
      consoleError.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await nftService.init();
    });

    it('should handle empty NFT arrays', async () => {
      mockCoreService.getActiveAccountNFTs.mockResolvedValueOnce([]);
      
      const nfts = await nftService.getActiveAccountNFTs();
      
      expect(nfts).toEqual([]);
    });

    it('should handle null values from core service', async () => {
      mockCoreService.getNFTMetadata.mockResolvedValueOnce(null);
      mockCoreService.getCollections.mockResolvedValueOnce(null);
      
      const metadata = await nftService.getNFTMetadata('0x123', '1');
      expect(metadata).toBeNull();
      
      const collections = await nftService.getCollections(TEST_ADDRESS);
      expect(collections).toBeNull();
    });

    it('should handle very large token IDs', async () => {
      const largeTokenId = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      
      await nftService.getNFTMetadata(TEST_NFT.contractAddress, largeTokenId);
      
      expect(mockCoreService.getNFTMetadata).toHaveBeenCalledWith(
        TEST_NFT.contractAddress,
        largeTokenId,
        1
      );
    });

    it('should handle special characters in NFT data', async () => {
      const specialMintParams = {
        name: 'NFT with "quotes" and \'apostrophes\'',
        description: 'Description with\nnewlines\tand\ttabs',
        image: 'ipfs://QmSpecialChars!@#$%^&*()',
        attributes: [
          { trait_type: 'Special <tag>', value: 'Value & more' }
        ]
      };
      
      await nftService.mintNFT(specialMintParams);
      
      expect(mockCoreService.mintNFT).toHaveBeenCalledWith(specialMintParams);
    });

    it('should handle concurrent operations', async () => {
      const promises = [
        nftService.getActiveAccountNFTs(),
        nftService.getNFTs(TEST_ADDRESS),
        nftService.getCollections(TEST_ADDRESS),
        nftService.getTrendingNFTs()
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(4);
      expect(mockCoreService.getActiveAccountNFTs).toHaveBeenCalled();
      expect(mockCoreService.getNFTs).toHaveBeenCalled();
      expect(mockCoreService.getCollections).toHaveBeenCalled();
      expect(mockCoreService.getTrendingNFTs).toHaveBeenCalled();
    });
  });
});