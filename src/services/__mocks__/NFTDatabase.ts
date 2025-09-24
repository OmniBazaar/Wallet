/**
 * Mock NFTDatabase for testing
 */

export class NFTDatabase {
  private nfts = new Map<string, any>();
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async clear(): Promise<void> {
    this.nfts.clear();
  }

  async saveNFT(nft: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const key = `${nft.contractAddress}:${nft.tokenId}`;
    this.nfts.set(key, nft);
  }

  async getNFT(contractAddress: string, tokenId: string): Promise<any | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const key = `${contractAddress}:${tokenId}`;
    return this.nfts.get(key) || null;
  }

  async getNFTsByOwner(owner: string): Promise<any[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    return Array.from(this.nfts.values()).filter(nft => nft.owner === owner);
  }

  async transferNFT(
    contractAddress: string,
    tokenId: string,
    from: string,
    to: string
  ): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    if (nft && nft.owner === from) {
      nft.previousOwner = from;
      nft.owner = to;
      await this.saveNFT(nft);
    }
  }

  async cacheMetadata(contractAddress: string, tokenId: string, metadata: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    if (nft) {
      nft.metadata = metadata;
      nft.metadataCachedAt = Date.now();
      await this.saveNFT(nft);
    }
  }

  async getCollection(contractAddress: string): Promise<any> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nfts = Array.from(this.nfts.values()).filter(
      nft => nft.contractAddress === contractAddress
    );

    // Return collection metadata
    return {
      name: 'Test Collection',
      contractAddress,
      totalSupply: 10000,
      nfts
    };
  }

  async getCachedMetadata(contractAddress: string, tokenId: string): Promise<any | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    const nft = await this.getNFT(contractAddress, tokenId);
    return nft?.metadata || null;
  }

  async saveCollection(collection: any): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    // Store collection metadata - for this mock, just ensure NFTs are saved
    if (collection.nfts) {
      for (const nft of collection.nfts) {
        await this.saveNFT(nft);
      }
    }
  }

  async close(): Promise<void> {
    this.isInitialized = false;
    this.nfts.clear();
  }
}