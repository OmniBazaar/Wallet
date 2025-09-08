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
   *
   */
  image_url?: string;
  /**
   *
   */
  animation_url?: string;
  /**
   *
   */
  external_url?: string;
  /**
   *
   */
  attributes?: NFTAttribute[];
  /**
   *
   */
  properties?: Record<string, unknown>;
  /**
   *
   */
  background_color?: string;
}

/**
 *
 */
export interface NFTAttribute {
  /**
   *
   */
  trait_type: string;
  /**
   *
   */
  value: string | number;
  /**
   *
   */
  display_type?: string;
  /**
   *
   */
  max_value?: number;
}

/**
 *
 */
export interface NFTCollection {
  /**
   *
   */
  id: string;
  /**
   *
   */
  name: string;
  /**
   *
   */
  description?: string;
  /**
   *
   */
  image?: string;
  /**
   *
   */
  external_url?: string;
  /**
   *
   */
  twitter?: string;
  /**
   *
   */
  discord?: string;
  /**
   *
   */
  website?: string;
  /**
   *
   */
  verified?: boolean;
  /**
   *
   */
  spam_score?: number;
  /**
   *
   */
  floor_price?: NFTFloorPrice;
  /**
   *
   */
  total_supply?: number;
  /**
   *
   */
  owner_count?: number;
}

/**
 *
 */
export interface NFTFloorPrice {
  /**
   *
   */
  value: number;
  /**
   *
   */
  currency: string;
  /**
   *
   */
  marketplace?: string;
  /**
   *
   */
  updated_at?: string;
}

/**
 *
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
 *
 */
export interface NFTMarketplaceData {
  /**
   *
   */
  listed?: boolean;
  /**
   *
   */
  price?: string;
  /**
   *
   */
  currency?: string;
  /**
   *
   */
  marketplace?: string;
  /**
   *
   */
  listing_url?: string;
  /**
   *
   */
  last_sale?: {
    /**
     *
     */
    price: string;
    /**
     *
     */
    currency: string;
    /**
     *
     */
    date: string;
    /**
     *
     */
    from: string;
    /**
     *
     */
    to: string;
  };
}

/**
 *
 */
export interface SolanaNFT extends NFT {
  /**
   *
   */
  mint: string;
  /**
   *
   */
  update_authority?: string;
  /**
   *
   */
  primary_sale_happened?: boolean;
  /**
   *
   */
  seller_fee_basis_points?: number;
  /**
   *
   */
  creators?: SolanaCreator[];
  /**
   *
   */
  edition?: SolanaEdition;
  /**
   *
   */
  token_standard?: SolanaTokenStandard;
}

/**
 *
 */
export interface SolanaCreator {
  /**
   *
   */
  address: string;
  /**
   *
   */
  verified: boolean;
  /**
   *
   */
  share: number;
}

/**
 *
 */
export interface SolanaEdition {
  /**
   *
   */
  edition: number;
  /**
   *
   */
  max_supply?: number;
}

/**
 *
 */
export enum SolanaTokenStandard {
  NON_FUNGIBLE = 'NonFungible',
  FUNGIBLE_ASSET = 'FungibleAsset',
  FUNGIBLE = 'Fungible',
  NON_FUNGIBLE_EDITION = 'NonFungibleEdition',
  PROGRAMMABLE_NON_FUNGIBLE = 'ProgrammableNonFungible',
}

/**
 *
 */
export interface NFTDiscoveryOptions {
  /**
   *
   */
  chains?: (ChainType | string)[];
  /**
   *
   */
  collections?: string[];
  /**
   *
   */
  includeSpam?: boolean;
  /**
   *
   */
  limit?: number;
  /**
   *
   */
  cursor?: string;
}

/**
 *
 */
export interface NFTDiscoveryResult {
  /**
   *
   */
  nfts: NFT[];
  /**
   *
   */
  nextCursor?: string;
  /**
   *
   */
  hasMore: boolean;
  /**
   *
   */
  total?: number;
}

/**
 *
 */
export interface NFTTransferRequest {
  /**
   *
   */
  nft: NFT;
  /**
   *
   */
  from: string;
  /**
   *
   */
  to: string;
  /**
   *
   */
  amount?: string; // For ERC1155
  /**
   *
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
 *
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
