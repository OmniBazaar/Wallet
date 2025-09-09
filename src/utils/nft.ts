/**
 * NFT Utility Functions
 * Provides utility functions for NFT formatting, validation, and processing
 */

import { ethers } from 'ethers';

// Local NFT type definition removed as it was unused

/**
 * NFT metadata structure according to OpenSea and ERC-721 standards
 */
export interface NFTMetadata {
  /** NFT name */
  name?: string;
  /** Alternative name field */
  title?: string;
  /** NFT description */
  description?: string;
  /** Image URL or IPFS hash */
  image?: string;
  /** External URL for more info */
  external_url?: string;
  /** Animation URL for video/audio NFTs */
  animation_url?: string;
  /** NFT attributes/traits */
  attributes?: Array<{
    /** Trait category name */
    trait_type: string;
    /** Trait value */
    value: string | number;
    /** Optional display type */
    display_type?: string;
  }>;
}

/**
 * IPFS gateway configurations for redundancy
 */
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.ipfs.io/ipfs/'
];

/**
 * Format NFT name with fallback to token ID
 * @param name - NFT name from metadata
 * @param tokenId - Token ID as fallback
 * @returns Formatted NFT name
 */
export const formatNFTName = (name: string | undefined, tokenId: string): string => {
  if (name !== undefined && name.trim() !== '') {
    // Truncate long names
    return name.length > 50 ? `${name.substring(0, 47)}...` : name;
  }
  
  // Format token ID for display
  if (tokenId.length > 10) {
    return `Token #${tokenId.substring(0, 6)}...${tokenId.slice(-4)}`;
  }
  
  return `Token #${tokenId}`;
};

/**
 * Format NFT price with proper decimals and symbol
 * @param price - Price in wei or smallest unit
 * @param currency - Currency symbol (e.g., 'ETH', 'MATIC')
 * @param decimals - Token decimals (default 18)
 * @returns Formatted price string
 */
export const formatNFTPrice = (
  price: string | bigint,
  currency: string,
  decimals: number = 18
): string => {
  try {
    const priceInWei = typeof price === 'string' ? BigInt(price) : price;
    const formattedPrice = ethers.formatUnits(priceInWei, decimals);
    
    // Format to reasonable decimal places
    const numPrice = parseFloat(formattedPrice);
    let displayPrice: string;
    
    if (numPrice === 0) {
      return `0 ${currency}`;
    } else if (numPrice < 0.0001) {
      displayPrice = numPrice.toExponential(2);
    } else if (numPrice < 1) {
      displayPrice = numPrice.toFixed(4);
    } else if (numPrice < 1000) {
      displayPrice = numPrice.toFixed(2);
    } else {
      displayPrice = numPrice.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    
    return `${displayPrice} ${currency}`;
  } catch (error) {
    // Return unformatted price if formatting fails
    return `${price.toString()} ${currency}`;
  }
};

/**
 * Generate thumbnail URL with IPFS gateway fallback
 * @param imageUrl - Original image URL
 * @param size - Thumbnail size (optional)
 * @returns Thumbnail URL with proper gateway
 */
export const generateNFTThumbnail = (imageUrl: string, size?: number): string => {
  if (imageUrl === '') {
    return '/images/nft-placeholder.png';
  }
  
  // Handle IPFS URLs
  if (imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    // Use primary gateway by default
    return `${IPFS_GATEWAYS[0]}${ipfsHash}`;
  }
  
  // Handle Arweave URLs
  if (imageUrl.startsWith('ar://')) {
    const arweaveId = imageUrl.replace('ar://', '');
    return `https://arweave.net/${arweaveId}`;
  }
  
  // For HTTP URLs, check if we can use a thumbnail service
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Some NFT platforms provide thumbnail endpoints
    if (size !== undefined && imageUrl.includes('opensea.io')) {
      return imageUrl.replace(/w=\d+/, `w=${size}`);
    }
    return imageUrl;
  }
  
  // Return original URL if no processing needed
  return imageUrl;
};

/**
 * Get fallback IPFS gateway URL if primary fails
 * @param ipfsUrl - IPFS URL that failed
 * @param currentGatewayIndex - Current gateway index
 * @returns Next gateway URL or null
 */
export const getFallbackIPFSUrl = (
  ipfsUrl: string,
  currentGatewayIndex: number
): string | null => {
  const ipfsHash = ipfsUrl.split('/ipfs/').pop();
  if (ipfsHash === undefined || ipfsHash === '' || currentGatewayIndex >= IPFS_GATEWAYS.length - 1) {
    return null;
  }
  
  return `${IPFS_GATEWAYS[currentGatewayIndex + 1]}${ipfsHash}`;
};

/**
 * Validate NFT metadata structure
 * @param metadata - Metadata object to validate
 * @returns True if metadata is valid
 */
export const validateNFTMetadata = (metadata: unknown): metadata is NFTMetadata => {
  if (metadata === null || metadata === undefined || typeof metadata !== 'object') {
    return false;
  }
  
  const meta = metadata as Record<string, unknown>;
  
  // Check required fields
  if (typeof meta['name'] !== 'string' && typeof meta['title'] !== 'string') {
    return false;
  }
  
  // Validate image URL if present
  if (meta['image'] !== undefined && typeof meta['image'] !== 'string') {
    return false;
  }
  
  // Validate attributes if present
  if (meta['attributes'] !== undefined) {
    if (!Array.isArray(meta['attributes'])) {
      return false;
    }
    
    // Each attribute should have trait_type and value
    for (const attr of meta['attributes'] as unknown[]) {
      if (
        typeof attr !== 'object' ||
        attr === null ||
        !('trait_type' in (attr)) ||
        !('value' in (attr))
      ) {
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Parse token URI to handle various formats
 * @param tokenUri - Token URI from contract
 * @returns Parsed URI ready for fetching
 */
export const parseTokenURI = (tokenUri: string): string => {
  if (tokenUri === '') {
    throw new Error('Token URI is empty');
  }
  
  // Handle data URIs (base64 encoded JSON)
  if (tokenUri.startsWith('data:')) {
    return tokenUri;
  }
  
  // Handle IPFS URIs
  if (tokenUri.startsWith('ipfs://')) {
    const ipfsHash = tokenUri.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${ipfsHash}`;
  }
  
  // Handle Arweave URIs
  if (tokenUri.startsWith('ar://')) {
    const arweaveId = tokenUri.replace('ar://', '');
    return `https://arweave.net/${arweaveId}`;
  }
  
  // Return as-is for HTTP(S) URLs
  return tokenUri;
};

/**
 * Extract attributes from NFT metadata
 * @param metadata - NFT metadata object
 * @returns Normalized attributes array
 */
export const extractNFTAttributes = (
  metadata: NFTMetadata
): Array<{ trait_type: string; value: string | number }> => {
  if (metadata.attributes === undefined || metadata.attributes === null || !Array.isArray(metadata.attributes)) {
    return [];
  }
  
  return metadata.attributes
    .filter((attr: unknown): attr is { trait_type: string; value: string | number } => 
      attr !== null && 
      typeof attr === 'object' && 
      'trait_type' in attr && 
      'value' in attr &&
      typeof (attr as { trait_type: unknown }).trait_type === 'string' &&
      (typeof (attr as { value: unknown }).value === 'string' || typeof (attr as { value: unknown }).value === 'number'))
    .map((attr: { trait_type: string; value: string | number }) => ({
      trait_type: attr.trait_type,
      value: attr.value
    }));
};

/**
 * Calculate NFT rarity score based on attributes
 * @param attributes - NFT attributes
 * @param collectionAttributes - All attributes in collection
 * @returns Rarity score (0-100)
 */
export const calculateRarityScore = (
  attributes: Array<{ trait_type: string; value: string | number }>,
  collectionAttributes: Map<string, Map<string | number, number>>
): number => {
  if ((attributes.length === 0) || (collectionAttributes.size === 0)) {
    return 50; // Default middle rarity
  }
  
  let totalRarity = 0;
  let attributeCount = 0;
  
  for (const attr of attributes) {
    const traitMap = collectionAttributes.get(attr.trait_type);
    if (traitMap === undefined) continue;
    
    const occurrences = traitMap.get(attr.value) ?? 0;
    const totalInTrait = Array.from(traitMap.values()).reduce((a, b) => a + b, 0);
    
    if (totalInTrait > 0) {
      const rarity = 1 - (occurrences / totalInTrait);
      totalRarity += rarity;
      attributeCount++;
    }
  }
  
  if (attributeCount === 0) {
    return 50;
  }
  
  // Convert to 0-100 scale
  return Math.round((totalRarity / attributeCount) * 100);
};

/**
 * Format token ID for display
 * @param tokenId - Token ID (string or number)
 * @returns Formatted token ID
 */
export const formatTokenId = (tokenId: string | number): string => {
  const id = tokenId.toString();
  
  // Handle very large token IDs
  if (id.length > 10) {
    return `${id.substring(0, 4)}...${id.slice(-4)}`;
  }
  
  // Add commas for readability
  return parseInt(id).toLocaleString();
};