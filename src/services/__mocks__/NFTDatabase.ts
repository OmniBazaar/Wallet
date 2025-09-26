/**
 * Mock NFTDatabase for testing
 */

/** NFT data structure for mock storage */
interface MockNFTData {
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
  /** NFT metadata */
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
      display_type?: string;
    }>;
  };
  /** Timestamp when metadata was cached */
  metadataCachedAt?: number;
}

/** Collection data structure for mock storage */
interface MockCollectionData {
  /** Collection name */
  name: string;
  /** Contract address */
  contractAddress: string;
  /** Total supply of NFTs */
  totalSupply: number;
  /** NFTs in this collection */
  nfts: MockNFTData[];
}

/**
 * Mock implementation of NFTDatabase for testing purposes.
 * Provides in-memory storage of NFT data with initialization state tracking.
 */
export class NFTDatabase {
  /** In-memory storage for NFTs indexed by contractAddress:tokenId */
  private nfts = new Map<string, MockNFTData>();
  /** Database initialization state */
  private isInitialized = false;

  /**
   * Initialize the mock database.
   * Sets the initialization flag to true.
   * @returns Promise that resolves when initialization is complete
   */
  init(): Promise<void> {
    this.isInitialized = true;
    return Promise.resolve();
  }

  /**
   * Clear all NFT data from the mock database.
   * Removes all entries from the in-memory storage.
   * @returns Promise that resolves when clearing is complete
   */
  clear(): Promise<void> {
    this.nfts.clear();
    return Promise.resolve();
  }

  /**
   * Save an NFT to the mock database.
   * @param nft - NFT data to save
   * @returns Promise that resolves when save is complete
   * @throws Error if database is not initialized
   */
  saveNFT(nft: MockNFTData): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const key = `${nft.contractAddress}:${nft.tokenId}`;
    this.nfts.set(key, nft);
    return Promise.resolve();
  }

  /**
   * Retrieve an NFT from the mock database.
   * @param contractAddress - Contract address of the NFT
   * @param tokenId - Token ID of the NFT
   * @returns NFT data if found, null otherwise
   * @throws Error if database is not initialized
   */
  getNFT(contractAddress: string, tokenId: string): Promise<MockNFTData | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const key = `${contractAddress}:${tokenId}`;
    return Promise.resolve(this.nfts.get(key) ?? null);
  }

  /**
   * Get all NFTs owned by a specific address.
   * @param owner - Owner address to filter by
   * @returns Array of NFTs owned by the address
   * @throws Error if database is not initialized
   */
  getNFTsByOwner(owner: string): Promise<MockNFTData[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return Promise.resolve(
      Array.from(this.nfts.values()).filter(nft => nft.owner === owner)
    );
  }

  /**
   * Transfer an NFT from one owner to another.
   * Updates owner and previousOwner fields if the current owner matches.
   * @param contractAddress - Contract address of the NFT
   * @param tokenId - Token ID of the NFT
   * @param from - Current owner address
   * @param to - New owner address
   * @throws Error if database is not initialized
   */
  async transferNFT(
    contractAddress: string,
    tokenId: string,
    from: string,
    to: string
  ): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    if (nft !== null && nft.owner === from) {
      nft.previousOwner = from;
      nft.owner = to;
      await this.saveNFT(nft);
    }
  }

  /**
   * Cache metadata for an NFT.
   * Updates the metadata and metadataCachedAt timestamp.
   * @param contractAddress - Contract address of the NFT
   * @param tokenId - Token ID of the NFT
   * @param metadata - Metadata object to cache
   * @throws Error if database is not initialized
   */
  async cacheMetadata(contractAddress: string, tokenId: string, metadata: MockNFTData['metadata']): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    if (nft !== null) {
      if (metadata !== undefined) {
        nft.metadata = metadata;
      }
      nft.metadataCachedAt = Date.now();
      await this.saveNFT(nft);
    }
  }

  /**
   * Get collection information for a contract address.
   * Returns mock collection data with filtered NFTs.
   * @param contractAddress - Contract address of the collection
   * @returns Collection data with NFTs
   * @throws Error if database is not initialized
   */
  getCollection(contractAddress: string): Promise<MockCollectionData> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nfts = Array.from(this.nfts.values()).filter(
      nft => nft.contractAddress === contractAddress
    );

    // Return collection metadata
    return Promise.resolve({
      name: 'Test Collection',
      contractAddress,
      totalSupply: 10000,
      nfts
    });
  }

  /**
   * Get cached metadata for an NFT.
   * @param contractAddress - Contract address of the NFT
   * @param tokenId - Token ID of the NFT
   * @returns Cached metadata if available, null otherwise
   * @throws Error if database is not initialized
   */
  async getCachedMetadata(contractAddress: string, tokenId: string): Promise<MockNFTData['metadata'] | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    return nft?.metadata ?? null;
  }

  /**
   * Save a collection and its NFTs to the database.
   * For this mock implementation, only saves the NFTs.
   * @param collection - Collection data to save
   * @throws Error if database is not initialized
   */
  async saveCollection(collection: MockCollectionData): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    // Store collection metadata - for this mock, just ensure NFTs are saved
    if (Array.isArray(collection.nfts) && collection.nfts.length > 0) {
      for (const nft of collection.nfts) {
        await this.saveNFT(nft);
      }
    }
  }

  /**
   * Close the mock database.
   * Clears all data and resets initialization state.
   * @returns Promise that resolves when database is closed
   */
  close(): Promise<void> {
    this.isInitialized = false;
    this.nfts.clear();
    return Promise.resolve();
  }
}