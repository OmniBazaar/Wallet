/**
 * Mock NFT Service
 */

export class NFTService {
  async getNFTCollections(address: string): Promise<any[]> {
    return [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Collection',
        symbol: 'TEST',
        totalSupply: 100
      }
    ];
  }

  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<any> {
    return {
      name: `Test NFT #${tokenId}`,
      description: 'A test NFT',
      image: 'https://example.com/nft.png',
      attributes: []
    };
  }
}