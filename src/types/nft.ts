// OmniBazaar Wallet NFT Types
// Enhanced for marketplace integration

/**
 * Represents an individual NFT with marketplace integration
 */
export interface NFTItem {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  image: string;
  imageUrl?: string;
  animationUrl?: string;
  externalUrl?: string;
  attributes: NFTAttribute[];
  contract: string;
  contractAddress: string;
  tokenStandard: 'ERC721' | 'ERC1155' | 'SPL' | 'other';
  blockchain: string;
  owner: string;
  creator?: string;
  royalties?: number;
  metadata?: { name?: string; description?: string; image?: string; attributes?: Array<{ trait_type: string; value: unknown }> };
  
  // Marketplace-specific fields
  isListed?: boolean;
  listingId?: string;
  price?: string;
  currency?: string;
  marketplaceUrl?: string;
  
  // IPFS fields
  ipfsHash?: string;
  metadataUri?: string;
}

/**
 * Represents an NFT attribute/trait following OpenSea metadata standard
 */
export interface NFTAttribute {
  trait_type: string;
  value: string | number;
  display_type?: 'number' | 'boost_percentage' | 'boost_number' | 'date' | string;
  max_value?: number;
}

/**
 * Represents an NFT collection with marketplace data
 */
export interface NFTCollection {
  id: string;
  name: string;
  description?: string;
  image?: string;
  banner?: string;
  contract: string;
  contractAddress: string;
  tokenStandard: 'ERC721' | 'ERC1155' | 'SPL' | 'other';
  blockchain: string;
  creator: string;
  verified: boolean;
  totalSupply?: number;
  floorPrice?: string;
  volume24h?: string;
  items: NFTItem[];
  
  // Marketplace-specific fields
  categoryId?: string;
  tags?: string[];
  royalties?: number;
  website?: string;
  social?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
  };
}

/**
 * Standard NFT metadata with OmniBazaar marketplace extensions
 */
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  animation_url?: string;
  external_url?: string;
  attributes: NFTAttribute[];
  properties?: {
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
  
  // OmniBazaar marketplace extensions
  marketplace?: {
    category: string;
    subcategory?: string;
    condition?: 'new' | 'used' | 'refurbished';
    location?: string;
    shipping?: {
      domestic: number;
      international: number;
      free_shipping?: boolean;
    };
    returns?: {
      accepted: boolean;
      period_days: number;
      policy: string;
    };
  };
}

/**
 * Represents an NFT listing on the OmniBazaar marketplace
 */
export interface MarketplaceListing {
  id: string;
  nftId: string;
  tokenId: string;
  contract: string;
  seller: string;
  price: string;
  currency: string;
  listingType: 'fixed_price' | 'auction' | 'best_offer';
  
  // Auction-specific fields
  auctionEndTime?: number;
  currentBid?: string;
  bidders?: string[];
  reservePrice?: string;
  
  // Listing metadata
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  condition?: 'new' | 'used' | 'refurbished';
  location?: string;
  
  // Marketplace features
  featured: boolean;
  verified: boolean;
  escrowEnabled: boolean;
  instantPurchase: boolean;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  
  // Analytics
  views: number;
  likes: number;
  shares: number;
}

/**
 * Represents an NFT transfer/transaction event on the blockchain
 */
export interface NFTTransferEvent {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  tokenId: string;
  contract: string;
  type: 'mint' | 'transfer' | 'burn' | 'sale';
  value?: string; // For sale events
  gasUsed?: string;
  gasPrice?: string;
}

/**
 * Request parameters for minting a new NFT
 */
export interface NFTMintRequest {
  name: string;
  description: string;
  image: File | string;
  attributes: NFTAttribute[];
  royalties?: number;
  collection?: string;
  
  // Marketplace listing options
  listImmediately?: boolean;
  listingPrice?: string;
  listingCurrency?: string;
  category?: string;
  
  // IPFS storage options
  useIPFS: boolean;
  pinToIPFS?: boolean;
}

/**
 * Search query parameters for marketplace NFT discovery
 */
export interface NFTSearchQuery {
  query?: string;
  category?: string;
  subcategory?: string;
  blockchain?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  condition?: string;
  location?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'created_desc' | 'popular' | 'ending_soon';
  verified?: boolean;
  hasOffers?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Result set from NFT marketplace search operations
 */
export interface NFTSearchResult {
  items: MarketplaceListing[];
  total: number;
  hasMore: boolean;
  filters: {
    categories: Array<{ id: string; name: string; count: number }>;
    blockchains: Array<{ id: string; name: string; count: number }>;
    priceRange: { min: number; max: number };
  };
} 