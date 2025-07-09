import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NFTItem, NFTCollection, NFTMetadata, MarketplaceListing, NFTMintRequest } from '../../src/types/nft';
import type { ListingMetadata, ProductDetails, ServiceDetails } from '../../src/types/listing';

describe('NFT Types and Interfaces', () => {
  let mockNFTItem: NFTItem;
  let mockCollection: NFTCollection;
  let mockMarketplaceListing: MarketplaceListing;

  beforeEach(() => {
    mockNFTItem = {
      id: 'nft_1',
      tokenId: '123',
      name: 'Test NFT',
      description: 'A test NFT for OmniBazaar',
      image: 'https://ipfs.io/ipfs/QmTest123',
      attributes: [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Common' }
      ],
      contract: '0x123...',
      contractAddress: '0x123...',
      tokenStandard: 'ERC721',
      blockchain: 'omnicoin',
      owner: '0xowner123...',
      creator: '0xcreator123...',
      royalties: 5.0,
      isListed: true,
      listingId: 'listing_1',
      price: '100',
      currency: 'XOM',
      ipfsHash: 'QmTest123'
    };

    mockCollection = {
      id: 'collection_1',
      name: 'Test Collection',
      description: 'A test collection for OmniBazaar marketplace',
      contract: '0x123...',
      contractAddress: '0x123...',
      tokenStandard: 'ERC721',
      blockchain: 'omnicoin',
      creator: '0xcreator123...',
      verified: true,
      items: [mockNFTItem],
      categoryId: 'electronics',
      tags: ['tech', 'gadgets'],
      royalties: 5.0
    };

    mockMarketplaceListing = {
      id: 'listing_1',
      nftId: 'nft_1',
      tokenId: '123',
      contract: '0x123...',
      seller: '0xseller123...',
      price: '100',
      currency: 'XOM',
      listingType: 'fixed_price',
      title: 'Test Product NFT',
      description: 'A test product listing',
      category: 'electronics',
      tags: ['tech', 'new'],
      condition: 'new',
      featured: false,
      verified: true,
      escrowEnabled: true,
      instantPurchase: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      views: 0,
      likes: 0,
      shares: 0
    };
  });

  describe('NFTItem interface', () => {
    it('should have required properties', () => {
      expect(mockNFTItem).toHaveProperty('id');
      expect(mockNFTItem).toHaveProperty('tokenId');
      expect(mockNFTItem).toHaveProperty('name');
      expect(mockNFTItem).toHaveProperty('contractAddress');
      expect(mockNFTItem).toHaveProperty('blockchain');
      expect(mockNFTItem.blockchain).toBe('omnicoin');
    });

    it('should support marketplace integration', () => {
      expect(mockNFTItem.isListed).toBe(true);
      expect(mockNFTItem.price).toBe('100');
      expect(mockNFTItem.currency).toBe('XOM');
    });

    it('should have IPFS metadata support', () => {
      expect(mockNFTItem.ipfsHash).toBe('QmTest123');
      expect(mockNFTItem.image).toContain('ipfs.io');
    });
  });

  describe('NFTCollection interface', () => {
    it('should contain NFT items', () => {
      expect(mockCollection.items).toHaveLength(1);
      expect(mockCollection.items[0]).toEqual(mockNFTItem);
    });

    it('should support marketplace categories', () => {
      expect(mockCollection.categoryId).toBe('electronics');
      expect(mockCollection.tags).toContain('tech');
    });

    it('should support royalties', () => {
      expect(mockCollection.royalties).toBe(5.0);
    });
  });

  describe('MarketplaceListing interface', () => {
    it('should link to NFT correctly', () => {
      expect(mockMarketplaceListing.nftId).toBe(mockNFTItem.id);
      expect(mockMarketplaceListing.tokenId).toBe(mockNFTItem.tokenId);
    });

    it('should support OmniCoin currency', () => {
      expect(mockMarketplaceListing.currency).toBe('XOM');
    });

    it('should have marketplace features enabled', () => {
      expect(mockMarketplaceListing.escrowEnabled).toBe(true);
      expect(mockMarketplaceListing.instantPurchase).toBe(true);
      expect(mockMarketplaceListing.verified).toBe(true);
    });
  });
});

describe('Listing Types Integration', () => {
  let mockProductListing: ListingMetadata;

  beforeEach(() => {
    const productDetails: ProductDetails = {
      name: 'Test Product',
      description: 'A test product for the marketplace',
      category: 'electronics',
      subcategory: 'smartphones',
      tags: ['mobile', 'tech'],
      price: {
        amount: '100',
        currency: 'XOM'
      },
      images: ['https://ipfs.io/ipfs/QmProductImage'],
      condition: 'new',
      quantity: 1,
      availability: true
    };

    mockProductListing = {
      id: 'product_listing_1',
      type: 'product',
      seller: {
        address: '0xseller123...',
        name: 'Test Seller',
        location: {
          country: 'USA',
          state: 'CA',
          city: 'San Francisco'
        },
        contactInfo: {
          email: 'seller@test.com'
        },
        rating: 4.5,
        totalSales: 10,
        joinedDate: '2023-01-01',
        verified: true
      },
      details: productDetails,
      listingNode: {
        address: '0xnode123...',
        name: 'Test Node',
        location: {
          country: 'USA'
        },
        status: 'active',
        lastSync: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      views: 0,
      favorites: 0
    };
  });

  it('should create valid product listing', () => {
    expect(mockProductListing.type).toBe('product');
    expect(mockProductListing.seller.verified).toBe(true);
    expect((mockProductListing.details as ProductDetails).price.currency).toBe('XOM');
  });

  it('should support OmniCoin blockchain', () => {
    const details = mockProductListing.details as ProductDetails;
    expect(details.price.currency).toBe('XOM');
  });
});

describe('NFT Minting Validation', () => {
  let mockMintRequest: NFTMintRequest;

  beforeEach(() => {
    mockMintRequest = {
      name: 'Test Product NFT',
      description: 'An NFT representing a marketplace product',
      image: 'data:image/jpeg;base64,test',
      attributes: [
        { trait_type: 'Category', value: 'Electronics' },
        { trait_type: 'Condition', value: 'New' }
      ],
      royalties: 5.0,
      listImmediately: true,
      listingPrice: '100',
      listingCurrency: 'XOM',
      category: 'electronics',
      useIPFS: true,
      pinToIPFS: true
    };
  });

  it('should validate mint request structure', () => {
    expect(mockMintRequest.name).toBe('Test Product NFT');
    expect(mockMintRequest.listingCurrency).toBe('XOM');
    expect(mockMintRequest.useIPFS).toBe(true);
  });

  it('should support immediate listing', () => {
    expect(mockMintRequest.listImmediately).toBe(true);
    expect(mockMintRequest.listingPrice).toBe('100');
  });

  it('should have marketplace attributes', () => {
    const categoryAttr = mockMintRequest.attributes.find(attr => attr.trait_type === 'Category');
    expect(categoryAttr?.value).toBe('Electronics');
  });
}); 