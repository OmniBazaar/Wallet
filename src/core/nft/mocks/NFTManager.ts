/**
 * Mock NFT Manager
 */

export class NFTManager {
  async getNFTs(address: string): Promise<any[]> {
    return [
      {
        id: 'nft-1',
        tokenId: '1',
        contractAddress: '0x1234567890123456789012345678901234567890',
        name: 'Test NFT #1',
        image: 'https://example.com/nft1.png',
        owner: address
      }
    ];
  }

  async transferNFT(params: {
    contractAddress: string;
    tokenId: string;
    from: string;
    to: string;
  }): Promise<{ hash: string }> {
    return { hash: '0x' + Math.random().toString(16).substring(2, 66) };
  }
}