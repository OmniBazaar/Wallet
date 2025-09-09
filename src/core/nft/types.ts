/**
 * NFT Types and Interfaces
 * Extracted and enhanced from Rainbow and Enkrypt
 */

import { ChainType } from '../keyring/BIP39Keyring';

/** Types of NFT standards supported */
export enum NFTType {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  ORDINALS = 'ORDINALS',
  SOLANA_BGUM = 'SOLANABGUM',
  SOLANA_TOKEN = 'SOLANATOKEN',
  SUBSTRATE_NFT = 'SUBSTRATENFT',
}

/** NFT standard identifiers */
export enum NFTStandard {
  ERC721 = 'ERC-721',
  ERC1155 = 'ERC-1155',
  BEP721 = 'BEP-721',
  BEP1155 = 'BEP-1155',
  SPL = 'SPL',
  METAPLEX = 'METAPLEX',
  ORDINALS = 'ORDINALS',
  RMRK = 'RMRK',
  UNIQUE = 'UNIQUE',
}

/** Metadata for an NFT token */
export interface NFTMetadata {
  /** Name of the NFT */
  name: string;
  /** Description of the NFT */
  description?: string;
  /** Image URL for the NFT */
  image?: string;
  /**
   * Alternative property for image URL (some APIs use this instead of 'image')
   */
  image_url?: string;
  /**
   * URL for animated content (videos, GIFs, etc.)
   */
  animation_url?: string;
  /**
   * External URL for more information about the NFT
   */
  external_url?: string;
  /**
   * Array of attributes/traits for the NFT
   */
  attributes?: NFTAttribute[];
  /**
   * Additional properties not covered by standard fields
   */
  properties?: Record<string, unknown>;
  /**
   * Background color for NFT display (hex color)
   */
  background_color?: string;
}

/**
 * Attribute or trait for an NFT
 */
export interface NFTAttribute {
  /**
   * Type or category of the trait (e.g., 'Color', 'Rarity')
   */
  trait_type: string;
  /**
   * Value of the trait
   */
  value: string | number;
  /**
   * How to display the value (e.g., 'number', 'date', 'boost_percentage')
   */
  display_type?: string;
  /**
   * Maximum value for numeric traits (used for display purposes)
   */
  max_value?: number;
}

/**
 * Represents a collection of NFTs
 */
export interface NFTCollection {
  /**
   * Unique identifier for the collection
   */
  id: string;
  /**
   * Display name of the collection
   */
  name: string;
  /**
   * Description of the collection
   */
  description?: string;
  /**
   * Cover image URL for the collection
   */
  image?: string;
  /**
   * External website URL for the collection
   */
  external_url?: string;
  /**
   * Twitter handle for the collection
   */
  twitter?: string;
  /**
   * Discord server URL for the collection
   */
  discord?: string;
  /**
   * Official website URL for the collection
   */
  website?: string;
  /**
   * Whether the collection is verified by the platform
   */
  verified?: boolean;
  /**
   * Spam detection score (0-100, higher means more likely spam)
   */
  spam_score?: number;
  /**
   * Current floor price information for the collection
   */
  floor_price?: NFTFloorPrice;
  /**
   * Total number of NFTs in the collection
   */
  total_supply?: number;
  /**
   * Number of unique owners in the collection
   */
  owner_count?: number;
}

/**
 * Floor price information for an NFT collection
 */
export interface NFTFloorPrice {
  /**
   * Floor price value in the specified currency
   */
  value: number;
  /**
   * Currency code (e.g., 'ETH', 'USD')
   */
  currency: string;
  /**
   * Marketplace where this floor price was observed
   */
  marketplace?: string;
  /**
   * Timestamp when the floor price was last updated
   */
  updated_at?: string;
}

/**
 * Represents a Non-Fungible Token (NFT)
 */
export interface NFT {
  /** Unique NFT identifier */
  id: string;
  /** Contract address */
  contract_address: string;
  /** Token ID */
  token_id: string;
  /** Chain the NFT is on */
  chain: ChainType | string;
  /** NFT type (ERC721, ERC1155, etc) */
  type: NFTType;
  /** NFT standard */
  standard: NFTStandard;
  /** Current owner address */
  owner: string;
  /** NFT name (convenience field from metadata) */
  name?: string;
  /** NFT metadata */
  metadata: NFTMetadata;
  /** Collection info */
  collection?: NFTCollection;
  /** NFT attributes (convenience field from metadata) */
  attributes?: NFTAttribute[];
  /** Floor price (convenience field from collection) */
  floor_price?: number;
  /** Contract details */
  contract?: {
    /** Contract address */
    address: string;
    /** Contract type */
    type: NFTType;
  };
  /** Balance for ERC1155 tokens */
  balance?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  last_updated?: string;
  /** Marketplace data */
  marketplace_data?: NFTMarketplaceData;
}

/**
 * Marketplace-specific data for an NFT
 */
export interface NFTMarketplaceData {
  /**
   * Whether the NFT is currently listed for sale
   */
  listed?: boolean;
  /**
   * Current listing price
   */
  price?: string;
  /**
   * Currency for the listing price
   */
  currency?: string;
  /**
   * Name of the marketplace where it's listed
   */
  marketplace?: string;
  /**
   * URL to the marketplace listing
   */
  listing_url?: string;
  /**
   * Information about the last sale of this NFT
   */
  last_sale?: {
    /**
     * Sale price
     */
    price: string;
    /**
     * Currency of the sale
     */
    currency: string;
    /**
     * Date when the sale occurred
     */
    date: string;
    /**
     * Address of the seller
     */
    from: string;
    /**
     * Address of the buyer
     */
    to: string;
  };
}

/**
 * Solana-specific NFT interface extending base NFT
 */
export interface SolanaNFT extends NFT {
  /**
   * Mint address of the NFT
   */
  mint: string;
  /**
   * Address with update authority for the NFT
   */
  update_authority?: string;
  /**
   * Whether the primary sale has occurred
   */
  primary_sale_happened?: boolean;
  /**
   * Royalty percentage in basis points (100 = 1%)
   */
  seller_fee_basis_points?: number;
  /**
   * Array of creators and their royalty shares
   */
  creators?: SolanaCreator[];
  /**
   * Edition information for the NFT
   */
  edition?: SolanaEdition;
  /**
   * Solana token standard used by the NFT
   */
  token_standard?: SolanaTokenStandard;
}

/**
 * Creator information for Solana NFTs
 */
export interface SolanaCreator {
  /**
   * Creator's wallet address
   */
  address: string;
  /**
   * Whether the creator has been verified
   */
  verified: boolean;
  /**
   * Creator's share of royalties (percentage)
   */
  share: number;
}

/**
 * Edition information for Solana NFTs
 */
export interface SolanaEdition {
  /**
   * Edition number for this NFT
   */
  edition: number;
  /**
   * Maximum number of editions that can be minted
   */
  max_supply?: number;
}

/**
 * Solana token standards for NFTs
 */
export enum SolanaTokenStandard {
  NON_FUNGIBLE = 'NonFungible',
  FUNGIBLE_ASSET = 'FungibleAsset',
  FUNGIBLE = 'Fungible',
  NON_FUNGIBLE_EDITION = 'NonFungibleEdition',
  PROGRAMMABLE_NON_FUNGIBLE = 'ProgrammableNonFungible',
}

/**
 * Options for NFT discovery/search
 */
export interface NFTDiscoveryOptions {
  /**
   * Chains to search for NFTs
   */
  chains?: (ChainType | string)[];
  /**
   * Specific collection addresses to filter by
   */
  collections?: string[];
  /**
   * Whether to include NFTs marked as spam
   */
  includeSpam?: boolean;
  /**
   * Maximum number of results to return
   */
  limit?: number;
  /**
   * Pagination cursor for getting next page of results
   */
  cursor?: string;
}

/**
 * Result of NFT discovery/search operation
 */
export interface NFTDiscoveryResult {
  /**
   * Array of discovered NFTs
   */
  nfts: NFT[];
  /**
   * Cursor for getting the next page of results
   */
  nextCursor?: string;
  /**
   * Whether there are more results available
   */
  hasMore: boolean;
  /**
   * Total number of NFTs matching the search criteria
   */
  total?: number;
}

/**
 * Request to transfer an NFT
 */
export interface NFTTransferRequest {
  /**
   * The NFT to transfer
   */
  nft: NFT;
  /**
   * Address to transfer from (must be current owner)
   */
  from: string;
  /**
   * Address to transfer to
   */
  to: string;
  /**
   * Amount to transfer (for ERC1155 tokens)
   */
  amount?: string; // For ERC1155
  /**
   * Additional data to include in the transaction
   */
  data?: string;
}

// Special NFT contract addresses
export const SPECIAL_NFT_CONTRACTS = {
  ENS: '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85',
  POAP: '0x22c1f6050e56d2876009903609a2cc3fef83b415',
  CRYPTOPUNKS: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb',
  LOOT: '0xff9c1b15b16263c61d017ee9f65c50e4ae0113d7',
} as const;

// Marketplace identifiers
/**
 * Common NFT marketplace identifiers
 */
export enum NFTMarketplace {
  OPEN_SEA = 'opensea',
  BLUR = 'blur',
  LOOKS_RARE = 'looksrare',
  X2Y2 = 'x2y2',
  RARIBLE = 'rarible',
  MAGIC_EDEN = 'magiceden',
  SOLANART = 'solanart',
  DIGITAL_EYES = 'digitaleyes',
  SINGULAR = 'singular',
  KODADOT = 'kodadot',
}

// Chain-specific NFT API endpoints
export const NFT_API_ENDPOINTS = {
  simplehash: 'https://api.simplehash.com/api/v0',
  alchemy: {
    ethereum: 'https://eth-mainnet.g.alchemy.com/nft/v3',
    polygon: 'https://polygon-mainnet.g.alchemy.com/nft/v3',
    arbitrum: 'https://arb-mainnet.g.alchemy.com/nft/v3',
    optimism: 'https://opt-mainnet.g.alchemy.com/nft/v3',
  },
  moralis: 'https://deep-index.moralis.io/api/v2',
  helius: 'https://api.helius.xyz/v0',
  subscan: 'https://api.subscan.io',
} as const;
