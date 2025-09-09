/**
 * Mock NFT Service
 * Provides mock NFT collection and metadata services
 */

/** Mock NFT collection structure */
export interface MockNFTCollection {
  /** Collection contract address */
  address: string;
  /** Collection name */
  name: string;
  /** Collection symbol */
  symbol: string;
  /** Total supply */
  totalSupply: number;
}

/** Mock NFT metadata structure */
export interface MockNFTMetadata {
  /** NFT name */
  name: string;
  /** NFT description */
  description: string;
  /** Image URL */
  image: string;
  /** NFT attributes */
  attributes: unknown[];
}

/**
 * Mock NFT Service implementation
 */
export class NFTService {
  /**
   * Get NFT collections for an address
   * @param _address - User wallet address (unused in mock)
   * @returns Promise resolving to array of mock collections
   */
  getNFTCollections(_address: string): Promise<MockNFTCollection[]> {
    return Promise.resolve([
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Collection',
        symbol: 'TEST',
        totalSupply: 100
      }
    ]);
  }

  /**
   * Get NFT metadata for a specific token
   * @param _contractAddress - Contract address (unused in mock)
   * @param tokenId - Token ID
   * @returns Promise resolving to mock metadata
   */
  getNFTMetadata(_contractAddress: string, tokenId: string): Promise<MockNFTMetadata> {
    return Promise.resolve({
      name: `Test NFT #${tokenId}`,
      description: 'A test NFT',
      image: 'https://example.com/nft.png',
      attributes: []
    });
  }
}