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
   * Initialize the NFT database
   * @returns Promise that resolves when database is initialized
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
    if (this.db === null) throw new Error('Database not initialized');

    try {
      // Ensure NFT has an ID and timestamps
      const nftToSave = {
        ...nft,
        id: nft.id ?? `${nft.contractAddress}-${nft.tokenId}`,
        createdAt: nft.createdAt ?? Date.now(),
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
   * Get NFT by ID
   * @param id - NFT ID
   * @returns NFT data or null if not found
   */
  async getNFT(id: string): Promise<NFTData | null>;
  /**
   * Get NFT by contract and token ID (overload)
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @returns NFT data or null if not found
   */
  async getNFT(contractAddress: string, tokenId: string): Promise<NFTData | null>;
  /**
   * Get NFT implementation
   * @param idOrContract - NFT ID or contract address
   * @param tokenId - Token ID (optional, required when using contract address)
   * @returns NFT data or null if not found
   */
  async getNFT(idOrContract: string, tokenId?: string): Promise<NFTData | null> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['nfts'], 'readonly');
      const store = tx.objectStore('nfts');
      
      if (tokenId === undefined) {
        // Get by ID
        return new Promise<NFTData | null>((resolve, reject) => {
          const request = store.get(idOrContract);
          request.onsuccess = () => resolve(request.result as NFTData | null ?? null);
          request.onerror = () => reject(request.error);
        });
      } else {
        // Get by contract and token ID
        const index = store.index('contractAndToken');
        return new Promise<NFTData | null>((resolve, reject) => {
          const request = index.get([idOrContract, tokenId]);
          request.onsuccess = () => resolve(request.result as NFTData | null ?? null);
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error('Error getting NFT:', error);
      return null;
    }
  }

  /**
   * Get NFTs with optional filters
   * @param filters - Optional filters to apply
   * @returns Array of NFT data
   */
  async getNFTs(filters?: Record<string, unknown>): Promise<NFTData[]> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['nfts'], 'readonly');
      const store = tx.objectStore('nfts');
      
      return new Promise<NFTData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let results: NFTData[] = (request.result as NFTData[]) ?? [];
          
          // Apply filters if provided
          if (filters !== undefined) {
            results = results.filter((nft: NFTData) => {
              return Object.entries(filters).every(([key, value]) => {
                return (nft as unknown as Record<string, unknown>)[key] === value;
              });
            });
          }

          // Sort by updated timestamp (newest first)
          results.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
   * Get NFTs by owner
   * @param owner - Owner address
   * @param chainId - Optional chain ID filter
   * @returns Array of NFT data
   */
  async getNFTsByOwner(owner: string, chainId?: number): Promise<NFTData[]> {
    const filters: Record<string, unknown> = { owner };
    if (chainId !== undefined) {
      filters['chainId'] = chainId;
    }
    return await this.getNFTs(filters);
  }

  /**
   * Get NFTs by collection
   * @param contractAddress - Contract address
   * @param chainId - Chain ID
   * @returns Array of NFT data
   */
  async getNFTsByCollection(contractAddress: string, chainId: number): Promise<NFTData[]> {
    return await this.getNFTs({ contractAddress, chainId });
  }

  /**
   * Save collection to database
   * @param collection - Collection data to save
   * @returns Success status
   */
  async saveCollection(collection: NFTCollection): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

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
   * Get collection by ID
   * @param id - Collection ID
   * @returns Collection data or null if not found
   */
  async getCollection(id: string): Promise<NFTCollection | null>;
  /**
   * Get collection by contract address (overload for compatibility)
   * @param contractAddress - Contract address
   * @returns Collection data or null if not found
   */
  async getCollection(contractAddress: string): Promise<NFTCollection | null>;
  /**
   * Get collection implementation
   * @param idOrAddress - Collection ID or contract address
   * @returns Collection data or null if not found
   */
  async getCollection(idOrAddress: string): Promise<NFTCollection | null> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['collections'], 'readonly');
      const store = tx.objectStore('collections');
      
      // First try to get by ID
      let result = await new Promise<NFTCollection | null>((resolve, reject) => {
        const request = store.get(idOrAddress);
        request.onsuccess = () => resolve(request.result as NFTCollection | null ?? null);
        request.onerror = () => reject(request.error);
      });

      // If not found by ID, try to find by contract address
      if (result === null) {
        const index = store.index('contractAddress');
        result = await new Promise<NFTCollection | null>((resolve, reject) => {
          const request = index.get(idOrAddress);
          request.onsuccess = () => resolve(request.result as NFTCollection | null ?? null);
          request.onerror = () => reject(request.error);
        });
      }

      // Add address alias for compatibility
      if (result !== null) {
        result.address = result.contractAddress;
      }

      return result;
    } catch (error) {
      console.error('Error getting collection:', error);
      return null;
    }
  }

  /**
   * Get collections with optional filters
   * @param filters - Optional filters to apply
   * @returns Array of collection data
   */
  async getCollections(filters?: Record<string, unknown>): Promise<NFTCollection[]> {
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(['collections'], 'readonly');
      const store = tx.objectStore('collections');
      
      return new Promise<NFTCollection[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let results: NFTCollection[] = (request.result as NFTCollection[]) ?? [];
          
          // Apply filters if provided
          if (filters !== undefined) {
            results = results.filter((collection: NFTCollection) => {
              return Object.entries(filters).every(([key, value]) => {
                return (collection as unknown as Record<string, unknown>)[key] === value;
              });
            });
          }

          // Sort by updated timestamp (newest first)
          results.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
   * Delete NFT from database
   * @param id - NFT ID to delete
   * @returns Success status
   */
  async deleteNFT(id: string): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

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
   * Clear all NFT and collection data (alias for clearAll)
   * @returns Success status
   */
  async clear(): Promise<boolean> {
    return await this.clearAll();
  }

  /**
   * Clear all NFT and collection data from database
   * @returns Success status
   */
  async clearAll(): Promise<boolean> {
    if (this.db === null) throw new Error('Database not initialized');

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
   * Cleanup database connections and resources
   */
  cleanup(): void {
    try {
      if (this.db !== null) {
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
    if (this.db === null) throw new Error('Database not initialized');

    try {
      const nft = await this.getNFT(contractAddress, tokenId);
      if (nft === null || nft.owner.toLowerCase() !== fromAddress.toLowerCase()) {
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
    metadata: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const nft = await this.getNFT(contractAddress, tokenId);
      
      if (nft !== null) {
        // Update existing NFT with metadata
        const { name, description, image, attributes, ...otherMetadata } = metadata;
        const updated = {
          ...nft,
          name: name !== undefined ? name as string : nft.name,
          description: description !== undefined ? description as string : nft.description,
          image: image !== undefined ? image as string : nft.image,
          attributes: attributes !== undefined && Array.isArray(attributes) ? attributes as NFTData['attributes'] : nft.attributes,
          metadata: { ...nft.metadata, ...otherMetadata },
          updatedAt: Date.now()
        } as NFTData;
        return await this.saveNFT(updated);
      } else {
        // Create new NFT with metadata
        const { name, description, image, attributes, ...otherMetadata } = metadata;
        const newNFT = {
          id: `${contractAddress}-${tokenId}`,
          contractAddress,
          tokenId,
          chainId: 1, // Default chain ID
          owner: '', // Will be updated when owner is known
          name: name !== undefined ? name as string : undefined,
          description: description !== undefined ? description as string : undefined,
          image: image !== undefined ? image as string : undefined,
          imageOriginal: undefined,
          externalUrl: undefined,
          animationUrl: undefined,
          attributes: attributes !== undefined && Array.isArray(attributes) ? attributes as NFTData['attributes'] : undefined,
          collection: undefined,
          lastPrice: undefined,
          rarity: undefined,
          metadata: otherMetadata,
          createdAt: Date.now(),
          updatedAt: Date.now()
        } as unknown as NFTData;
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
  ): Promise<Record<string, unknown> | null> {
    try {
      const nft = await this.getNFT(contractAddress, tokenId);
      if (nft === null) return null;

      // Return metadata in expected format
      return {
        name: nft.name,
        description: nft.description,
        image: nft.image,
        attributes: nft.attributes ?? [],
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
  close(): void {
    this.cleanup();
  }
}