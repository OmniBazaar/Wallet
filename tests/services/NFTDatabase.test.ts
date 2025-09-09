/**
 * Tests for NFTDatabase Service
 * 
 * Tests the NFT database functionality including NFT storage,
 * collection management, metadata caching, and ownership transfers.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  NFTDatabase,
  type NFTData,
  type NFTCollection
} from '../../src/services/NFTDatabase';

// Mock IndexedDB
const mockObjectStore = {
  put: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn()
};

const mockIndex = {
  get: jest.fn(),
  getAll: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn((storeName: string) => mockObjectStore)
};

const mockDatabase = {
  transaction: jest.fn((storeNames: string[], mode: string) => mockTransaction),
  createObjectStore: jest.fn(() => mockObjectStore),
  objectStoreNames: {
    contains: jest.fn((name: string) => false)
  },
  close: jest.fn()
};

const mockOpenDBRequest = {
  result: mockDatabase,
  error: null,
  onsuccess: null as any,
  onerror: null as any,
  onupgradeneeded: null as any
};

// Mock indexedDB global
global.indexedDB = {
  open: jest.fn(() => mockOpenDBRequest),
  deleteDatabase: jest.fn(),
  databases: jest.fn(),
  cmp: jest.fn()
} as any;

describe('NFTDatabase', () => {
  let db: NFTDatabase;

  const mockNFT: NFTData = {
    id: 'nft-1',
    tokenId: '1234',
    contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    chainId: 1,
    owner: '0x1234567890123456789012345678901234567890',
    name: 'Test NFT #1234',
    description: 'A test NFT for unit testing',
    image: 'https://example.com/nft/1234.png',
    imageOriginal: 'https://example.com/nft/1234-original.png',
    attributes: [
      { trait_type: 'Background', value: 'Blue' },
      { trait_type: 'Rarity', value: 95, display_type: 'number' }
    ],
    collection: {
      name: 'Test Collection',
      slug: 'test-collection',
      description: 'A test NFT collection',
      imageUrl: 'https://example.com/collection.png',
      floorPrice: '1.5'
    },
    lastPrice: '2.5',
    rarity: {
      rank: 100,
      score: 95
    },
    metadata: {
      custom: 'data'
    },
    createdAt: 1234567890000,
    updatedAt: 1234567890000
  };

  const mockCollection: NFTCollection = {
    id: 'collection-1',
    contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    chainId: 1,
    name: 'Test Collection',
    slug: 'test-collection',
    symbol: 'TEST',
    description: 'A test NFT collection',
    imageUrl: 'https://example.com/collection.png',
    bannerImageUrl: 'https://example.com/banner.png',
    externalUrl: 'https://example.com',
    discordUrl: 'https://discord.gg/test',
    twitterUsername: '@testcollection',
    instagramUsername: '@testcollection',
    totalSupply: 10000,
    floorPrice: '1.5',
    volume24h: '150.5',
    volumeTotal: '5000.0',
    ownersCount: 3500,
    verified: true,
    metadata: { featured: true },
    createdAt: 1234567880000,
    updatedAt: 1234567890000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db = new NFTDatabase();

    // Setup mock index
    mockObjectStore.index.mockReturnValue(mockIndex);

    // Reset mock request callbacks
    mockOpenDBRequest.onsuccess = null;
    mockOpenDBRequest.onerror = null;
    mockOpenDBRequest.onupgradeneeded = null;
  });

  afterEach(async () => {
    await db.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize database successfully', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();

      expect(global.indexedDB.open).toHaveBeenCalledWith('OmniWalletNFTs', 1);
      expect(db['isInitialized']).toBe(true);
    });

    it('should handle initialization errors', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onerror?.(), 0);
        return mockOpenDBRequest;
      });

      await expect(db.init()).rejects.toThrow('Failed to open NFT database');
    });

    it('should not reinitialize if already initialized', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      const openCalls = (global.indexedDB.open as jest.Mock).mock.calls.length;

      await db.init();
      expect((global.indexedDB.open as jest.Mock).mock.calls.length).toBe(openCalls);
    });

    it('should handle missing IndexedDB', async () => {
      const originalIndexedDB = global.indexedDB;
      (global as any).indexedDB = undefined;

      await expect(db.init()).rejects.toThrow('IndexedDB not supported');

      global.indexedDB = originalIndexedDB;
    });

    it('should create object stores and indexes on upgrade', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenDBRequest.onupgradeneeded?.({ target: mockOpenDBRequest } as any);
          mockOpenDBRequest.onsuccess?.();
        }, 0);
        return mockOpenDBRequest;
      });

      await db.init();

      // NFTs store
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('nfts', { keyPath: 'id' });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('tokenId', 'tokenId', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('contractAddress', 'contractAddress', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('chainId', 'chainId', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('owner', 'owner', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('contractAndToken', ['contractAddress', 'tokenId'], { unique: false });

      // Collections store
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('collections', { keyPath: 'id' });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('slug', 'slug', { unique: false });
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith('verified', 'verified', { unique: false });
    });
  });

  describe('NFT Management', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save NFT successfully', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveNFT(mockNFT);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockNFT,
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should auto-generate ID if not provided', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const nftWithoutId = { ...mockNFT };
      delete (nftWithoutId as any).id;

      const result = await db.saveNFT(nftWithoutId);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...nftWithoutId,
          id: `${nftWithoutId.contractAddress}-${nftWithoutId.tokenId}`
        })
      );
    });

    it('should add timestamps if not provided', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const nftWithoutTimestamps = { ...mockNFT };
      delete nftWithoutTimestamps.createdAt;
      delete nftWithoutTimestamps.updatedAt;

      const result = await db.saveNFT(nftWithoutTimestamps);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should get NFT by ID', async () => {
      mockObjectStore.get.mockImplementation((id) => ({
        result: id === mockNFT.id ? mockNFT : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const nft = await db.getNFT(mockNFT.id);

      expect(nft).toEqual(mockNFT);
      expect(mockObjectStore.get).toHaveBeenCalledWith(mockNFT.id);
    });

    it('should get NFT by contract and token ID', async () => {
      mockIndex.get.mockImplementation((key) => ({
        result: key[0] === mockNFT.contractAddress && key[1] === mockNFT.tokenId ? mockNFT : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const nft = await db.getNFT(mockNFT.contractAddress, mockNFT.tokenId);

      expect(nft).toEqual(mockNFT);
      expect(mockIndex.get).toHaveBeenCalledWith([mockNFT.contractAddress, mockNFT.tokenId]);
    });

    it('should return null for non-existent NFT', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const nft = await db.getNFT('non-existent');

      expect(nft).toBeNull();
    });

    it('should delete NFT', async () => {
      mockObjectStore.delete.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.deleteNFT(mockNFT.id);

      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith(mockNFT.id);
    });
  });

  describe('NFT Queries', () => {
    const mockNFTs: NFTData[] = [
      mockNFT,
      {
        ...mockNFT,
        id: 'nft-2',
        tokenId: '1235',
        owner: '0xbcdefabcdefabcdefabcdefabcdefabcdefabcde',
        updatedAt: 1234567900000
      },
      {
        ...mockNFT,
        id: 'nft-3',
        tokenId: '1236',
        chainId: 137,
        updatedAt: 1234567880000
      }
    ];

    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();

      mockObjectStore.getAll.mockImplementation(() => ({
        result: [...mockNFTs],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));
    });

    it('should get all NFTs sorted by updatedAt', async () => {
      const nfts = await db.getNFTs();

      expect(nfts).toHaveLength(3);
      expect(nfts[0].updatedAt).toBeGreaterThanOrEqual(nfts[1].updatedAt);
      expect(nfts[1].updatedAt).toBeGreaterThanOrEqual(nfts[2].updatedAt);
    });

    it('should filter NFTs', async () => {
      const nfts = await db.getNFTs({ chainId: 137 });

      expect(nfts).toHaveLength(1);
      expect(nfts[0].chainId).toBe(137);
    });

    it('should get NFTs by owner', async () => {
      const owner = mockNFT.owner;
      const nfts = await db.getNFTsByOwner(owner);

      expect(nfts.length).toBeGreaterThan(0);
      expect(nfts.every(nft => nft.owner === owner)).toBe(true);
    });

    it('should get NFTs by owner and chain', async () => {
      const nfts = await db.getNFTsByOwner(mockNFT.owner, 1);

      expect(nfts).toHaveLength(1);
      expect(nfts[0].owner).toBe(mockNFT.owner);
      expect(nfts[0].chainId).toBe(1);
    });

    it('should get NFTs by collection', async () => {
      const nfts = await db.getNFTsByCollection(mockNFT.contractAddress, mockNFT.chainId);

      expect(nfts.length).toBeGreaterThan(0);
      expect(nfts.every(nft => 
        nft.contractAddress === mockNFT.contractAddress && 
        nft.chainId === mockNFT.chainId
      )).toBe(true);
    });

    it('should handle query errors', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Query failed')
      }));

      const nfts = await db.getNFTs();

      expect(nfts).toEqual([]);
    });
  });

  describe('Collection Management', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should save collection successfully', async () => {
      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveCollection(mockCollection);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockCollection,
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should get collection by ID', async () => {
      mockObjectStore.get.mockImplementation((id) => ({
        result: id === mockCollection.id ? mockCollection : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const collection = await db.getCollection(mockCollection.id);

      expect(collection).toEqual({
        ...mockCollection,
        address: mockCollection.contractAddress // Added alias
      });
    });

    it('should get collection by contract address', async () => {
      mockObjectStore.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockIndex.get.mockImplementation((address) => ({
        result: address === mockCollection.contractAddress ? mockCollection : null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const collection = await db.getCollection(mockCollection.contractAddress);

      expect(collection).toEqual({
        ...mockCollection,
        address: mockCollection.contractAddress
      });
    });

    it('should get all collections', async () => {
      mockObjectStore.getAll.mockImplementation(() => ({
        result: [mockCollection],
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const collections = await db.getCollections();

      expect(collections).toHaveLength(1);
      expect(collections[0]).toEqual(mockCollection);
    });

    it('should filter collections', async () => {
      const collections = [
        mockCollection,
        { ...mockCollection, id: 'collection-2', verified: false }
      ];

      mockObjectStore.getAll.mockImplementation(() => ({
        result: collections,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const verified = await db.getCollections({ verified: true });

      expect(verified).toHaveLength(1);
      expect(verified[0].verified).toBe(true);
    });
  });

  describe('NFT Transfers', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should transfer NFT ownership', async () => {
      const fromAddress = mockNFT.owner;
      const toAddress = '0x9876543210987654321098765432109876543210';

      mockIndex.get.mockImplementation(() => ({
        result: mockNFT,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.transferNFT(
        mockNFT.contractAddress,
        mockNFT.tokenId,
        fromAddress,
        toAddress
      );

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: toAddress,
          previousOwner: fromAddress,
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should not transfer if not owner', async () => {
      const wrongOwner = '0x0000000000000000000000000000000000000000';
      const toAddress = '0x9876543210987654321098765432109876543210';

      mockIndex.get.mockImplementation(() => ({
        result: mockNFT,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.transferNFT(
        mockNFT.contractAddress,
        mockNFT.tokenId,
        wrongOwner,
        toAddress
      );

      expect(result).toBe(false);
      expect(mockObjectStore.put).not.toHaveBeenCalled();
    });

    it('should not transfer non-existent NFT', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.transferNFT(
        '0xnonexistent',
        '999',
        mockNFT.owner,
        '0x9876543210987654321098765432109876543210'
      );

      expect(result).toBe(false);
    });

    it('should handle case-insensitive owner comparison', async () => {
      const fromAddress = mockNFT.owner.toUpperCase(); // Different case
      const toAddress = '0x9876543210987654321098765432109876543210';

      mockIndex.get.mockImplementation(() => ({
        result: mockNFT,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.transferNFT(
        mockNFT.contractAddress,
        mockNFT.tokenId,
        fromAddress,
        toAddress
      );

      expect(result).toBe(true); // Should succeed despite case difference
    });
  });

  describe('Metadata Caching', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should cache metadata for existing NFT', async () => {
      const metadata = {
        name: 'Updated Name',
        description: 'Updated Description',
        newAttribute: 'New Value'
      };

      mockIndex.get.mockImplementation(() => ({
        result: mockNFT,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.cacheMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId,
        metadata
      );

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockNFT,
          ...metadata,
          metadata: expect.objectContaining({
            ...mockNFT.metadata,
            ...metadata
          })
        })
      );
    });

    it('should cache metadata for new NFT', async () => {
      const metadata = {
        name: 'New NFT',
        description: 'A newly cached NFT',
        image: 'https://example.com/new.png'
      };

      mockIndex.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.cacheMetadata(
        '0xnewcontract',
        '999',
        metadata
      );

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '0xnewcontract-999',
          contractAddress: '0xnewcontract',
          tokenId: '999',
          chainId: 1,
          owner: '',
          ...metadata,
          metadata,
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number)
        })
      );
    });

    it('should get cached metadata', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: mockNFT,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const metadata = await db.getCachedMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(metadata).toEqual({
        name: mockNFT.name,
        description: mockNFT.description,
        image: mockNFT.image,
        attributes: mockNFT.attributes,
        ...mockNFT.metadata
      });
    });

    it('should return null for non-cached metadata', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: null,
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const metadata = await db.getCachedMetadata('0xnonexistent', '999');

      expect(metadata).toBeNull();
    });

    it('should handle metadata caching errors', async () => {
      mockIndex.get.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Get failed')
      }));

      const result = await db.cacheMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId,
        { name: 'Test' }
      );

      expect(result).toBe(false);
    });
  });

  describe('Clear Operations', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should clear all data', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.clearAll();

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalledTimes(2); // nfts and collections
    });

    it('should use clear as alias for clearAll', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.clear();

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });

    it('should handle clear errors', async () => {
      mockObjectStore.clear.mockImplementation(() => ({
        onsuccess: null,
        onerror: function() { this.onerror?.(); },
        error: new Error('Clear failed')
      }));

      const result = await db.clearAll();

      expect(result).toBe(false);
    });
  });

  describe('Database Cleanup', () => {
    it('should cleanup database connection', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      await db.cleanup();

      expect(mockDatabase.close).toHaveBeenCalled();
      expect(db['isInitialized']).toBe(false);
      expect(db['db']).toBeNull();
    });

    it('should use close as alias for cleanup', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      await db.close();

      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });

      await db.init();
      mockDatabase.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      await db.cleanup(); // Should not throw
      expect(db['isInitialized']).toBe(false);
    });
  });

  describe('Error Handling Without Initialization', () => {
    it('should throw when saving without init', async () => {
      await expect(db.saveNFT(mockNFT))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when getting NFT without init', async () => {
      await expect(db.getNFT('id'))
        .rejects.toThrow('Database not initialized');
    });

    it('should throw when clearing without init', async () => {
      await expect(db.clearAll())
        .rejects.toThrow('Database not initialized');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => mockOpenDBRequest.onsuccess?.(), 0);
        return mockOpenDBRequest;
      });
      await db.init();
    });

    it('should handle NFTs with minimal data', async () => {
      const minimalNFT: NFTData = {
        id: 'minimal',
        tokenId: '1',
        contractAddress: '0xminimal',
        chainId: 1,
        owner: '0xowner'
      };

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveNFT(minimalNFT);

      expect(result).toBe(true);
    });

    it('should handle collections with minimal data', async () => {
      const minimalCollection: NFTCollection = {
        id: 'minimal',
        contractAddress: '0xminimal',
        chainId: 1,
        name: 'Minimal Collection',
        slug: 'minimal',
        verified: false
      };

      mockObjectStore.put.mockImplementation((data) => ({
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const result = await db.saveCollection(minimalCollection);

      expect(result).toBe(true);
    });

    it('should handle empty attributes array', async () => {
      mockIndex.get.mockImplementation(() => ({
        result: { ...mockNFT, attributes: undefined },
        onsuccess: function() { this.onsuccess?.(); },
        onerror: null
      }));

      const metadata = await db.getCachedMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(metadata?.attributes).toEqual([]);
    });
  });
});