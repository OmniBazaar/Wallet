// OmniBazaar Wallet NFT Types
// Enhanced for marketplace integration

/**
 * Represents an individual NFT with marketplace integration
 */
export interface NFTItem {
  /** Unique identifier for this NFT */
  id: string;
  /** Token ID on the blockchain */
  tokenId: string;
  /** Human-readable name of the NFT */
  name: string;
  /** Description of the NFT */
  description: string;
  /** Primary image URL for the NFT */
  image: string;
  /** Alternative image URL */
  imageUrl?: string;
  /** Animation or video URL */
  animationUrl?: string;
  /** External URL for more information */
  externalUrl?: string;
  /** Array of trait attributes */
  attributes: NFTAttribute[];
  /** Contract name or identifier */
  contract: string;
  /** Smart contract address */
  contractAddress: string;
  /** NFT token standard */
  tokenStandard: 'ERC721' | 'ERC1155' | 'SPL' | 'other';
  /** Blockchain network name */
  blockchain: string;
  /** Current owner address */
  owner: string;
  /** Original creator address */
  creator?: string;
  /** Royalty percentage (0-100) */
  royalties?: number;
  /** Metadata object with flexible structure for different NFT standards */
  metadata?: { name?: string; description?: string; image?: string; attributes?: Array<{ trait_type: string; value: unknown }> };

  // Marketplace-specific fields
  /** Whether this NFT is currently listed for sale */
  isListed?: boolean;
  /** Marketplace listing identifier */
  listingId?: string;
  /** Listing price as string */
  price?: string;
  /** Currency for the listing price */
  currency?: string;
  /** URL to view on marketplace */
  marketplaceUrl?: string;

  // IPFS fields
  /** IPFS hash for decentralized storage */
  ipfsHash?: string;
  /** URI pointing to metadata JSON */
  metadataUri?: string;
}

/**
 * Represents an NFT attribute/trait following OpenSea metadata standard
 */
export interface NFTAttribute {
  /** The category or name of this trait */
  trait_type: string;
  /** The value of this trait */
  value: string | number;
  /** How this trait should be displayed in UI */
  display_type?: string;
  /** Maximum value for boost traits */
  max_value?: number;
}

/**
 * Represents an NFT collection with marketplace data
 */
export interface NFTCollection {
  /** Unique collection identifier */
  id: string;
  /** Collection name */
  name: string;
  /** Collection description */
  description?: string;
  /** Collection logo/image */
  image?: string;
  /** Collection banner image */
  banner?: string;
  /** Contract name or identifier */
  contract: string;
  /** Smart contract address */
  contractAddress: string;
  /** NFT standard used by this collection */
  tokenStandard: 'ERC721' | 'ERC1155' | 'SPL' | 'other';
  /** Blockchain network */
  blockchain: string;
  /** Collection creator address */
  creator: string;
  /** Whether collection is verified */
  verified: boolean;
  /** Total number of tokens in collection */
  totalSupply?: number;
  /** Floor price in collection currency */
  floorPrice?: string;
  /** 24-hour trading volume */
  volume24h?: string;
  /** Array of NFT items in this collection */
  items: NFTItem[];

  // Marketplace-specific fields
  /** Marketplace category identifier */
  categoryId?: string;
  /** Tags for discoverability */
  tags?: string[];
  /** Default royalty percentage for collection */
  royalties?: number;
  /** Official website URL */
  website?: string;
  /** Social media links */
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
  /** NFT name */
  name: string;
  /** NFT description */
  description: string;
  /** Primary image URL */
  image: string;
  /** Animation or video URL */
  animation_url?: string;
  /** External link for more info */
  external_url?: string;
  /** Array of trait attributes */
  attributes: NFTAttribute[];
  /** Additional properties for the NFT */
  properties?: {
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };

  // OmniBazaar marketplace extensions
  /** Marketplace-specific metadata for commerce */
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
  /** Unique listing identifier */
  id: string;
  /** Associated NFT identifier */
  nftId: string;
  /** Token ID on the blockchain */
  tokenId: string;
  /** Smart contract address */
  contract: string;
  /** Address of the NFT seller */
  seller: string;
  /** Listing price as string */
  price: string;
  /** Currency for the price */
  currency: string;
  /** Type of marketplace listing */
  listingType: 'fixed_price' | 'auction' | 'best_offer';

  // Auction-specific fields
  /** Unix timestamp when auction ends */
  auctionEndTime?: number;
  /** Current highest bid amount */
  currentBid?: string;
  /** Array of bidder addresses */
  bidders?: string[];
  /** Minimum acceptable auction price */
  reservePrice?: string;

  // Listing metadata
  /** Listing title for marketplace display */
  title: string;
  /** Detailed description of the listing */
  description: string;
  /** Primary category classification */
  category: string;
  /** Secondary category classification */
  subcategory?: string;
  /** Tags for search and discovery */
  tags: string[];
  /** Condition of the item being sold */
  condition?: 'new' | 'used' | 'refurbished';
  /** Geographic location of seller */
  location?: string;

  // Marketplace features
  /** Whether this listing is featured */
  featured: boolean;
  /** Whether seller is verified */
  verified: boolean;
  /** Whether escrow protection is enabled */
  escrowEnabled: boolean;
  /** Whether immediate purchase is allowed */
  instantPurchase: boolean;

  // Timestamps
  /** Unix timestamp when listing was created */
  createdAt: number;
  /** Unix timestamp when listing was last updated */
  updatedAt: number;
  /** Unix timestamp when listing expires */
  expiresAt?: number;

  // Analytics
  /** Number of times listing has been viewed */
  views: number;
  /** Number of likes/favorites */
  likes: number;
  /** Number of times listing has been shared */
  shares: number;
}

/**
 * Represents an NFT transfer/transaction event on the blockchain
 */
export interface NFTTransferEvent {
  /** Unique event identifier */
  id: string;
  /** Blockchain transaction hash */
  transactionHash: string;
  /** Block number where event occurred */
  blockNumber: number;
  /** Unix timestamp of the event */
  timestamp: number;
  /** Address that sent the NFT */
  from: string;
  /** Address that received the NFT */
  to: string;
  /** Token ID that was transferred */
  tokenId: string;
  /** Smart contract address */
  contract: string;
  /** Type of transfer event */
  type: 'mint' | 'transfer' | 'burn' | 'sale';
  /** Sale value for sale events */
  value?: string; // For sale events
  /** Gas used for the transaction */
  gasUsed?: string;
  /** Gas price for the transaction */
  gasPrice?: string;
}

/**
 * Request parameters for minting a new NFT
 */
export interface NFTMintRequest {
  /** Name of the NFT to be minted */
  name: string;
  /** Description of the NFT */
  description: string;
  /** Image file or URL for the NFT */
  image: File | string;
  /** Array of traits and attributes */
  attributes: NFTAttribute[];
  /** Royalty percentage for future sales */
  royalties?: number;
  /** Collection to mint the NFT into */
  collection?: string;

  // Marketplace listing options
  /** Whether to list on marketplace immediately */
  listImmediately?: boolean;
  /** Initial listing price if listing immediately */
  listingPrice?: string;
  /** Currency for the listing price */
  listingCurrency?: string;
  /** Marketplace category for listing */
  category?: string;

  // IPFS storage options
  /** Whether to store metadata on IPFS */
  useIPFS: boolean;
  /** Whether to pin the metadata to IPFS */
  pinToIPFS?: boolean;
}

/**
 * Search query parameters for marketplace NFT discovery
 */
export interface NFTSearchQuery {
  /** Free text search query */
  query?: string;
  /** Filter by marketplace category */
  category?: string;
  /** Filter by marketplace subcategory */
  subcategory?: string;
  /** Filter by blockchain network */
  blockchain?: string;
  /** Minimum price filter */
  priceMin?: number;
  /** Maximum price filter */
  priceMax?: number;
  /** Currency for price filters */
  currency?: string;
  /** Filter by item condition */
  condition?: string;
  /** Filter by geographic location */
  location?: string;
  /** Sort order for results */
  sortBy?: 'price_asc' | 'price_desc' | 'created_desc' | 'popular' | 'ending_soon';
  /** Filter for verified sellers only */
  verified?: boolean;
  /** Filter for items with offers */
  hasOffers?: boolean;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

/**
 * Result set from NFT marketplace search operations
 */
export interface NFTSearchResult {
  /** Array of marketplace listings matching the search */
  items: MarketplaceListing[];
  /** Total number of items matching the search */
  total: number;
  /** Whether more results are available */
  hasMore: boolean;
  /** Available filters and their counts */
  filters: {
    categories: Array<{ id: string; name: string; count: number }>;
    blockchains: Array<{ id: string; name: string; count: number }>;
    priceRange: { min: number; max: number };
  };
}
