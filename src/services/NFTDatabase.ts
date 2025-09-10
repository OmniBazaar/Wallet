/**
 * NFTDatabase - NFT Database Service
 * 
 * Provides database operations for NFT metadata,
 * ownership history, and collection information.
 */

/** NFT data stored in database */
export interface NFTData {
  /** Unique NFT ID */
  id: string;
  /** Token ID */
  tokenId: string;
  /** Contract address */
  contractAddress: string;
  /** Chain ID */
  chainId: number;
  /** Current owner address */
  owner: string;
  /** Previous owner (for transfers) */
  previousOwner?: string;
  /** NFT name */
  name?: string;
  /** NFT description */
  description?: string;
  /** NFT image URL */
  image?: string;
  /** Original image URL */
  imageOriginal?: string;
  /** Animation URL */
  animationUrl?: string;
  /** External URL */
  externalUrl?: string;
  /** NFT attributes */
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  /** Collection information */
  collection?: {
    name: string;
    slug: string;
    description?: string;
    imageUrl?: string;
    externalUrl?: string;
    floorPrice?: string;
  };
  /** Last sale price */
  lastPrice?: string;
  /** Rarity data */
  rarity?: {
    rank: number;
    score: number;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt?: number;
  /** Last update timestamp */
  updatedAt?: number;
}

/** NFT collection data */
export interface NFTCollection {
  /** Collection ID */
  id: string;
  /** Contract address */
  contractAddress: string;
  /** Contract address (alias for compatibility) */
  address?: string;
  /** Chain ID */
  chainId: number;
  /** Collection name */
  name: string;
  /** Collection slug */
  slug: string;
  /** Collection symbol */
  symbol?: string;
  /** Collection description */
  description?: string;
  /** Collection image URL */
  imageUrl?: string;
  /** Banner image URL */
  bannerImageUrl?: string;
  /** External URL */
  externalUrl?: string;
  /** Discord URL */
  discordUrl?: string;
  /** Twitter username */
  twitterUsername?: string;
  /** Instagram username */
  instagramUsername?: string;
  /** Total supply */
  totalSupply?: number;
  /** Floor price */
  floorPrice?: string;
  /** 24h volume */
  volume24h?: string;
  /** Total volume */
  volumeTotal?: string;
  /** Number of owners */
  ownersCount?: number;
  /** Verification status */
  verified: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt?: number;
  /** Last update timestamp */
  updatedAt?: number;
}

/**
 * NFT database service
 */
export class NFTDatabase {
  private isInitialized = false;
  private dbName = 'OmniWalletNFTs';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * Creates a new NFTDatabase instance
   */
  constructor() {}

  /**
   *
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not supported');
    }

    this.db = await this.openDatabase();
    this.isInitialized = true;
    // console.log('NFTDatabase initialized');
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(new Error('Failed to open NFT database'));
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // NFTs store
        if (!db.objectStoreNames.contains('nfts')) {
          const nftStore = db.createObjectStore('nfts', { keyPath: 'id' });
          nftStore.createIndex('tokenId', 'tokenId', { unique: false });
          nftStore.createIndex('contractAddress', 'contractAddress', { unique: false });
          nftStore.createIndex('chainId', 'chainId', { unique: false });
          nftStore.createIndex('owner', 'owner', { unique: false });
          nftStore.createIndex('contractAndToken', ['contractAddress', 'tokenId'], { unique: false });
        }

        // Collections store
        if (!db.objectStoreNames.contains('collections')) {
          const collectionStore = db.createObjectStore('collections', { keyPath: 'id' });
          collectionStore.createIndex('contractAddress', 'contractAddress', { unique: false });
          collectionStore.createIndex('chainId', 'chainId', { unique: false });
          collectionStore.createIndex('slug', 'slug', { unique: false });
          collectionStore.createIndex('verified', 'verified', { unique: false });
        }
      };
    });
  }

  /**
   * Save NFT to database
   * @param nft - NFT data to save
   * @returns Success status
   */
  async saveNFT(nft: NFTData): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Ensure NFT has an ID and timestamps
      const nftToSave = {
        ...nft,
        id: nft.id || `${nft.contractAddress}-${nft.tokenId}`,
        createdAt: nft.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      
      const tx = this.db.transaction(['nfts'], 'readwrite');
      const store = tx.objectStore('nfts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(nftToSave);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error saving NFT:', error);
      return false;
    }
  }

  /**
   *
   * @param id
   */
  async getNFT(id: string): Promise<NFTData | null>;
  /**
   * Get NFT by contract and token ID (overload)
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   */
  async getNFT(contractAddress: string, tokenId: string): Promise<NFTData | null>;
  /**
   *
   * @param idOrContract
   * @param tokenId
   */
  async getNFT(idOrContract: string, tokenId?: string): Promise<NFTData | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['nfts'], 'readonly');
      const store = tx.objectStore('nfts');
      
      if (tokenId === undefined) {
        // Get by ID
        return new Promise<NFTData | null>((resolve, reject) => {
          const request = store.get(idOrContract);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } else {
        // Get by contract and token ID
        const index = store.index('contractAndToken');
        return new Promise<NFTData | null>((resolve, reject) => {
          const request = index.get([idOrContract, tokenId]);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error('Error getting NFT:', error);
      return null;
    }
  }

  /**
   *
   * @param filters
   */
  async getNFTs(filters?: any): Promise<NFTData[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['nfts'], 'readonly');
      const store = tx.objectStore('nfts');
      
      return new Promise<NFTData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let results = request.result || [];
          
          // Apply filters if provided
          if (filters) {
            results = results.filter(nft => {
              return Object.entries(filters).every(([key, value]) => {
                return (nft)[key] === value;
              });
            });
          }

          // Sort by updated timestamp (newest first)
          results.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting NFTs:', error);
      return [];
    }
  }

  /**
   *
   * @param owner
   * @param chainId
   */
  async getNFTsByOwner(owner: string, chainId?: number): Promise<NFTData[]> {
    const filters: any = { owner };
    if (chainId !== undefined) {
      filters.chainId = chainId;
    }
    return await this.getNFTs(filters);
  }

  /**
   *
   * @param contractAddress
   * @param chainId
   */
  async getNFTsByCollection(contractAddress: string, chainId: number): Promise<NFTData[]> {
    return await this.getNFTs({ contractAddress, chainId });
  }

  /**
   *
   * @param collection
   */
  async saveCollection(collection: NFTCollection): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      collection.updatedAt = Date.now();
      
      const tx = this.db.transaction(['collections'], 'readwrite');
      const store = tx.objectStore('collections');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(collection);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error saving collection:', error);
      return false;
    }
  }

  /**
   *
   * @param id
   */
  async getCollection(id: string): Promise<NFTCollection | null>;
  /**
   * Get collection by contract address (overload for compatibility)
   * @param contractAddress - Contract address
   */
  async getCollection(contractAddress: string): Promise<NFTCollection | null>;
  /**
   *
   * @param idOrAddress
   */
  async getCollection(idOrAddress: string): Promise<NFTCollection | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['collections'], 'readonly');
      const store = tx.objectStore('collections');
      
      // First try to get by ID
      let result = await new Promise<NFTCollection | null>((resolve, reject) => {
        const request = store.get(idOrAddress);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      // If not found by ID, try to find by contract address
      if (!result) {
        const index = store.index('contractAddress');
        result = await new Promise<NFTCollection | null>((resolve, reject) => {
          const request = index.get(idOrAddress);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      }

      // Add address alias for compatibility
      if (result) {
        result.address = result.contractAddress;
      }

      return result;
    } catch (error) {
      console.error('Error getting collection:', error);
      return null;
    }
  }

  /**
   *
   * @param filters
   */
  async getCollections(filters?: any): Promise<NFTCollection[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['collections'], 'readonly');
      const store = tx.objectStore('collections');
      
      return new Promise<NFTCollection[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let results = request.result || [];
          
          // Apply filters if provided
          if (filters) {
            results = results.filter(collection => {
              return Object.entries(filters).every(([key, value]) => {
                return (collection)[key] === value;
              });
            });
          }

          // Sort by updated timestamp (newest first)
          results.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting collections:', error);
      return [];
    }
  }

  /**
   *
   * @param id
   */
  async deleteNFT(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['nfts'], 'readwrite');
      const store = tx.objectStore('nfts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error deleting NFT:', error);
      return false;
    }
  }

  /**
   *
   */
  async clear(): Promise<boolean> {
    return await this.clearAll();
  }

  /**
   *
   */
  async clearAll(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['nfts', 'collections'], 'readwrite');
      
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const request = tx.objectStore('nfts').clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise<void>((resolve, reject) => {
          const request = tx.objectStore('collections').clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      ]);

      return true;
    } catch (error) {
      console.error('Error clearing NFT data:', error);
      return false;
    }
  }

  /**
   *
   */
  async cleanup(): Promise<void> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      this.isInitialized = false;
      // console.log('NFTDatabase cleanup completed');
    } catch (error) {
      console.error('Error during NFTDatabase cleanup:', error);
    }
  }

  /**
   * Transfer NFT ownership
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @param fromAddress - Current owner
   * @param toAddress - New owner
   * @returns Success status
   */
  async transferNFT(
    contractAddress: string, 
    tokenId: string, 
    fromAddress: string, 
    toAddress: string
  ): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const nft = await this.getNFT(contractAddress, tokenId);
      if (!nft || nft.owner.toLowerCase() !== fromAddress.toLowerCase()) {
        return false;
      }

      const updated = {
        ...nft,
        owner: toAddress,
        previousOwner: fromAddress,
        updatedAt: Date.now()
      };

      const tx = this.db.transaction(['nfts'], 'readwrite');
      const store = tx.objectStore('nfts');
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('Error transferring NFT:', error);
      return false;
    }
  }

  /**
   * Cache NFT metadata
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @param metadata - Metadata to cache
   * @returns Success status
   */
  async cacheMetadata(
    contractAddress: string, 
    tokenId: string, 
    metadata: any
  ): Promise<boolean> {
    try {
      const nft = await this.getNFT(contractAddress, tokenId);
      
      if (nft) {
        // Update existing NFT with metadata
        const updated = {
          ...nft,
          ...metadata,
          metadata: { ...nft.metadata, ...metadata },
          updatedAt: Date.now()
        };
        return await this.saveNFT(updated);
      } else {
        // Create new NFT with metadata
        const newNFT: NFTData = {
          id: `${contractAddress}-${tokenId}`,
          contractAddress,
          tokenId,
          chainId: 1, // Default chain ID
          owner: '', // Will be updated when owner is known
          ...metadata,
          metadata: metadata || {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        return await this.saveNFT(newNFT);
      }
    } catch (error) {
      console.error('Error caching metadata:', error);
      return false;
    }
  }

  /**
   * Get cached metadata
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @returns Cached metadata or null
   */
  async getCachedMetadata(
    contractAddress: string, 
    tokenId: string
  ): Promise<any | null> {
    try {
      const nft = await this.getNFT(contractAddress, tokenId);
      if (!nft) return null;

      // Return metadata in expected format
      return {
        name: nft.name,
        description: nft.description,
        image: nft.image,
        attributes: nft.attributes || [],
        ...nft.metadata
      };
    } catch (error) {
      console.error('Error getting cached metadata:', error);
      return null;
    }
  }

  /**
   * Close database connection (alias for cleanup)
   */
  async close(): Promise<void> {
    return this.cleanup();
  }
}