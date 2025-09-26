/**
 * Mock NFT Manager
 * Provides mock NFT data for testing and development
 */

/** Mock NFT data structure */
export interface MockNFT {
  /** NFT identifier */
  id: string;
  /** Token ID */
  tokenId: string;
  /** Contract address */
  contractAddress: string;
  /** NFT name */
  name: string;
  /** Image URL */
  image: string;
  /** Owner address */
  owner: string;
}

/** Transfer result */
export interface TransferResult {
  /** Transaction hash */
  hash: string;
}

/** NFT transfer parameters */
export interface TransferParams {
  /** Contract address */
  contractAddress: string;
  /** Token ID */
  tokenId: string;
  /** From address */
  from: string;
  /** To address */
  to: string;
}

/**
 * Mock NFT Manager implementation
 */
export class NFTManager {
  /**
   * Get NFTs for an address
   * @param address - User wallet address
   * @returns Promise resolving to array of mock NFTs
   */
  getNFTs(address: string): Promise<MockNFT[]> {
    return Promise.resolve([
      {
        id: 'nft-1',
        tokenId: '1',
        contractAddress: '0x1234567890123456789012345678901234567890',
        name: 'Test NFT #1',
        image: 'https://example.com/nft1.png',
        owner: address
      }
    ]);
  }

  /**
   * Transfer NFT to another address
   * @param _params - Transfer parameters
   * @returns Promise resolving to transaction hash
   */
  async transferNFT(_params: TransferParams): Promise<TransferResult> {
    const { generateSecureMockTxHash } = await import('../../utils/secure-random');
    return { hash: generateSecureMockTxHash() };
  }
}