/**
 * Mock Marketplace Service
 */

export class MarketplaceService {
  async getListings(filter?: any): Promise<any[]> {
    return [
      {
        id: 'listing-1',
        nftId: 'nft-1',
        seller: '0x1234567890123456789012345678901234567890',
        price: '1000000000000000000', // 1 ETH
        currency: 'ETH',
        status: 'active'
      }
    ];
  }

  async createListing(params: any): Promise<{ listingId: string }> {
    return { listingId: 'listing-' + Date.now() };
  }

  async purchaseNFT(listingId: string): Promise<{ hash: string }> {
    return { hash: '0x' + Math.random().toString(16).substring(2, 66) };
  }
}