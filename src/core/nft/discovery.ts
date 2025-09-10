/**
 * NFT Discovery Service
 * Multi-chain NFT discovery with support for EVM, Solana, and Substrate chains
 */

import { ChainType } from '../keyring/BIP39Keyring';
import {
  NFT,
  NFTType,
  NFTStandard,
  NFTDiscoveryOptions,
  NFTDiscoveryResult,
  // NFTCollection,
  NFTMetadata,
  SolanaNFT,
  NFT_API_ENDPOINTS,
  SPECIAL_NFT_CONTRACTS,
} from './types';

/** SimpleHash NFT type */
type SimpleHashNFT = {
  contract_address: string;
  token_id: string;
  name?: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  model_url?: string;
  contract?: { type?: string };
  owners?: Array<{ owner_address?: string }>;
  previews?: { image_medium_url?: string };
  external_url?: string;
  extra_metadata?: { attributes?: Array<{ trait_type: string; value: unknown }> };
  background_color?: string;
  collection?: {
    collection_id?: string;
    name?: string;
    description?: string;
    image_url?: string;
    external_url?: string;
    twitter_username?: string;
    discord_url?: string;
    marketplace_pages?: Array<{ verified?: boolean }>;
    spam_score?: number;
    floor_prices?: Array<{ value: number; marketplace_id?: string; payment_token?: { symbol?: string } }>;
  };
  last_sale?: {
    unit_price?: number | string;
    payment_token?: { symbol?: string };
    timestamp?: string;
    from_address?: string;
    to_address?: string;
  };
};

/** Helius NFT type */
type HeliusNFT = {
  id: string;
  ownership: { owner: string };
  interface?: string;
  content?: {
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      animation_url?: string;
      external_url?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
      token_standard?: string;
    };
    files?: Array<{ uri?: string }>;
  };
  compression?: { compressed?: boolean };
  token_info?: { supply?: number; decimals?: number };
  creators?: Array<{ address: string; verified: boolean; share: number }>;
  grouping?: Array<{ group_value: string; verified?: boolean }>;
  authorities?: Array<{ address: string }>;
  royalty?: { primary_sale_happened?: boolean; basis_points?: number };
};

/** Multi-chain NFT discovery service */
export class NFTDiscoveryService {
  private apiKeys: Record<string, string> = {};

  /**
   * Create NFT discovery service
   * @param apiKeys API keys for various NFT services
   */
  constructor(apiKeys?: Record<string, string>) {
    this.apiKeys = apiKeys ?? {};
  }

  /**
   * Discover NFTs across multiple chains
   * @param address Wallet address to discover NFTs for
   * @param options Discovery options and filters
   * @returns Promise resolving to discovery result
   */
  async discoverNFTs(
    address: string,
    options: NFTDiscoveryOptions = {}
  ): Promise<NFTDiscoveryResult> {
    const chains = options.chains ?? ['ethereum', 'polygon', 'solana'];
    const allNFTs: NFT[] = [];

    // Discover NFTs on each chain in parallel
    const discoveries = chains.map(chain => {
      switch (chain) {
        case 'ethereum':
        case 'polygon':
        case 'arbitrum':
        case 'optimism':
        case 'base':
        case 'avalanche':
        case 'bsc':
          return this.discoverEVMNFTs(address, chain, options);

        case 'solana':
          return this.discoverSolanaNFTs(address, options);

        case 'substrate':
          return this.discoverSubstrateNFTs(address, options);

        default:
          return Promise.resolve([]);
      }
    });

    const results = await Promise.all(discoveries);
    results.forEach(nfts => allNFTs.push(...nfts));

    // Filter out spam if requested
    const filteredNFTs = options.includeSpam === true
      ? allNFTs
      : allNFTs.filter(nft => !this.isSpamNFT(nft));

    // Apply limit
    const limitedNFTs = options.limit != null
      ? filteredNFTs.slice(0, options.limit)
      : filteredNFTs;

    return {
      nfts: limitedNFTs,
      hasMore: filteredNFTs.length > limitedNFTs.length,
      total: filteredNFTs.length
    };
  }

  /**
   * Discover NFTs on EVM chains using SimpleHash API
   * @param address Wallet address
   * @param chain EVM chain name
   * @param _options Discovery options
   * @returns Promise resolving to array of NFTs
   */
  private async discoverEVMNFTs(
    address: string,
    chain: string,
    _options: NFTDiscoveryOptions
  ): Promise<NFT[]> {
    try {
      const chainMapping: Record<string, string> = {
        ethereum: 'ethereum',
        polygon: 'polygon',
        arbitrum: 'arbitrum',
        optimism: 'optimism',
        base: 'base',
        avalanche: 'avalanche',
        bsc: 'bsc',
      };

      const simpleHashChain = chainMapping[chain] ?? chain;
      const url = `${NFT_API_ENDPOINTS.simplehash}/nfts/owners?chains=${simpleHashChain}&wallet_addresses=${address}`;

      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.apiKeys['simplehash'] ?? '',
        }
      });

      if (!response.ok) {
        // Failed to fetch NFTs for chain
        return [];
      }

      const data = await response.json() as unknown as { nfts?: unknown };
      if (!Array.isArray(data.nfts)) {
        return [];
      }
      return this.parseSimpleHashNFTs(data.nfts as SimpleHashNFT[], chain);
    } catch (error) {
      // Error discovering EVM NFTs on chain
      return [];
    }
  }

  /**
   * Discover Solana NFTs using Helius API
   * @param address - Wallet address to discover NFTs for
   * @param _options - Discovery options (unused)
   * @returns Promise resolving to array of Solana NFTs
   */
  private async discoverSolanaNFTs(
    address: string,
    _options: NFTDiscoveryOptions
  ): Promise<SolanaNFT[]> {
    try {
      const url = `${NFT_API_ENDPOINTS.helius}/addresses/${address}/nfts`;

      const response = await fetch(url, {
        headers: {
          'api-key': this.apiKeys['helius'] ?? '',
        }
      });

      if (!response.ok) {
        // Failed to fetch Solana NFTs - status will be handled by caller
        return [];
      }

      const data = await response.json() as unknown as { items?: unknown };
      if (!Array.isArray(data.items)) {
        return [];
      }
      return this.parseHeliusNFTs(data.items as HeliusNFT[]);
    } catch (error) {
      // Error discovering Solana NFTs
      return [];
    }
  }

  /**
   * Discover Substrate NFTs (Polkadot/Kusama ecosystem)
   * @param _address - Wallet address to discover NFTs for (unused)
   * @param _options - Discovery options (unused)
   * @returns Promise resolving to empty array (not yet implemented)
   */
  private discoverSubstrateNFTs(
    _address: string,
    _options: NFTDiscoveryOptions
  ): Promise<NFT[]> {
    // This would integrate with Subscan or similar APIs
    // For now, return empty array
    return Promise.resolve([]);
  }

  /**
   * Parse SimpleHash NFT data
   * @param nfts - Array of NFT data from SimpleHash API
   * @param chain - Chain name
   * @returns Parsed NFT array
   */
  private parseSimpleHashNFTs(nfts: SimpleHashNFT[], chain: string): NFT[] {
    return nfts.map(nft => ({
      id: `${chain}_${nft.contract_address}_${nft.token_id}`,
      contract_address: nft.contract_address,
      token_id: nft.token_id,
      chain: chain as ChainType,
      type: this.getNFTType(nft.contract?.type),
      standard: this.getNFTStandard(nft.contract?.type),
      owner: nft.owners?.[0]?.owner_address ?? '',
      metadata: {
        name: nft.name ?? 'Unnamed NFT',
        ...(nft.description !== undefined && nft.description !== null && nft.description !== '' ? { description: nft.description } : {}),
        ...((nft.image_url ?? nft.previews?.image_medium_url) !== undefined && (nft.image_url ?? nft.previews?.image_medium_url) !== null ? { image: nft.image_url ?? nft.previews?.image_medium_url } : {}),
        ...((nft.video_url ?? nft.audio_url ?? nft.model_url) !== undefined && (nft.video_url ?? nft.audio_url ?? nft.model_url) !== null ? { animation_url: nft.video_url ?? nft.audio_url ?? nft.model_url } : {}),
        ...(nft.external_url !== undefined && nft.external_url !== null && nft.external_url !== '' ? { external_url: nft.external_url } : {}),
        ...(nft.extra_metadata?.attributes !== undefined && nft.extra_metadata.attributes !== null ? { 
          attributes: nft.extra_metadata.attributes.map((attr: { trait_type: string; value: unknown }) => ({
            trait_type: attr.trait_type,
            value: typeof attr.value === 'string' || typeof attr.value === 'number' 
              ? attr.value 
              : String(attr.value)
          }))
        } : {}),
        ...(nft.background_color !== undefined && nft.background_color !== null && nft.background_color !== '' ? { background_color: nft.background_color } : {}),
      } as NFTMetadata,
      collection: nft.collection?.collection_id !== undefined && nft.collection.collection_id !== null && nft.collection.collection_id !== '' ? {
        id: nft.collection.collection_id,
        name: nft.collection.name ?? 'Unknown Collection',
        ...(nft.collection.description !== undefined && nft.collection.description !== null && nft.collection.description !== '' ? { description: nft.collection.description } : {}),
        ...(nft.collection.image_url !== undefined && nft.collection.image_url !== null && nft.collection.image_url !== '' ? { image: nft.collection.image_url } : {}),
        ...(nft.collection.external_url !== undefined && nft.collection.external_url !== null && nft.collection.external_url !== '' ? { external_url: nft.collection.external_url } : {}),
        ...(nft.collection.twitter_username !== undefined && nft.collection.twitter_username !== null && nft.collection.twitter_username !== '' ? { twitter: nft.collection.twitter_username } : {}),
        ...(nft.collection.discord_url !== undefined && nft.collection.discord_url !== null && nft.collection.discord_url !== '' ? { discord: nft.collection.discord_url } : {}),
        ...(nft.collection.marketplace_pages !== undefined && nft.collection.marketplace_pages !== null ? { 
          verified: nft.collection.marketplace_pages.some((m: { verified?: boolean }) => m.verified) 
        } : {}),
        ...(nft.collection.spam_score !== undefined ? { spam_score: nft.collection.spam_score } : {}),
        ...(nft.collection.floor_prices?.[0] !== undefined && nft.collection.floor_prices[0] !== null ? {
          floor_price: {
            value: nft.collection.floor_prices[0].value,
            currency: nft.collection.floor_prices[0].payment_token?.symbol ?? 'ETH',
            ...(nft.collection.floor_prices[0].marketplace_id !== undefined && nft.collection.floor_prices[0].marketplace_id !== null && nft.collection.floor_prices[0].marketplace_id !== '' ? { marketplace: nft.collection.floor_prices[0].marketplace_id } : {}),
          }
        } : {}),
      } : undefined,
      marketplace_data: nft.last_sale !== undefined && nft.last_sale !== null ? {
        last_sale: {
          price: nft.last_sale.unit_price?.toString() ?? '0',
          currency: nft.last_sale.payment_token?.symbol ?? 'ETH',
          date: nft.last_sale.timestamp ?? '',
          from: nft.last_sale.from_address ?? '',
          to: nft.last_sale.to_address ?? '',
        }
      } : undefined,
      contract: {
        address: nft.contract_address,
        type: this.getNFTType(nft.contract?.type),
      },
    } as NFT));
  }

  /**
   * Parse Helius Solana NFT data
   * @param items - Array of NFT items from Helius API
   * @returns Array of parsed Solana NFTs
   */
  private parseHeliusNFTs(items: HeliusNFT[]): SolanaNFT[] {
    return items.map(nft => ({
      id: `solana_${nft.id}`,
      contract_address: nft.id,
      token_id: nft.id,
      chain: 'solana',
      type: nft.compression?.compressed === true ? NFTType.SOLANA_BGUM : NFTType.SOLANA_TOKEN,
      standard: NFTStandard.METAPLEX,
      owner: nft.ownership?.owner ?? '',
      mint: nft.id,
      contract: {
        address: nft.id,
        type: nft.compression?.compressed === true ? NFTType.SOLANA_BGUM : NFTType.SOLANA_TOKEN,
      },
      metadata: {
        name: nft.content?.metadata?.name ?? 'Unnamed NFT',
        ...(nft.content?.metadata?.description !== undefined && nft.content.metadata.description !== null && nft.content.metadata.description !== '' ? { description: nft.content.metadata.description } : {}),
        ...((nft.content?.files?.[0]?.uri ?? nft.content?.metadata?.image) !== undefined && (nft.content?.files?.[0]?.uri ?? nft.content?.metadata?.image) !== null ? { image: nft.content?.files?.[0]?.uri ?? nft.content?.metadata?.image } : {}),
        ...(nft.content?.metadata?.external_url !== undefined && nft.content.metadata.external_url !== null && nft.content.metadata.external_url !== '' ? { external_url: nft.content.metadata.external_url } : {}),
        ...(nft.content?.metadata?.attributes !== undefined && nft.content.metadata.attributes !== null ? { attributes: nft.content.metadata.attributes.map((attr) => ({
          trait_type: attr.trait_type,
          value: attr.value,
        })) } : {}),
      } as NFTMetadata,
      collection: nft.grouping?.[0] !== undefined && nft.grouping[0] !== null ? {
        id: nft.grouping[0].group_value,
        name: nft.grouping[0].group_value,
        ...(nft.grouping[0].verified !== undefined ? { verified: nft.grouping[0].verified } : {}),
      } : undefined,
      update_authority: nft.authorities?.[0]?.address,
      primary_sale_happened: nft.royalty?.primary_sale_happened,
      seller_fee_basis_points: nft.royalty?.basis_points,
      creators: nft.creators?.map((creator) => ({
        address: creator.address,
        verified: creator.verified,
        share: creator.share,
      })) ?? [],
      token_standard: nft.content?.metadata?.token_standard,
    } as SolanaNFT));
  }

  /**
   * Get NFT type from contract standard
   * @param standard - Contract standard string
   * @returns NFT type enum value
   */
  private getNFTType(standard: string | undefined): NFTType {
    const normalized = standard?.toUpperCase().replace('-', '');
    switch (normalized) {
      case 'ERC721':
        return NFTType.ERC721;
      case 'ERC1155':
        return NFTType.ERC1155;
      default:
        return NFTType.ERC721;
    }
  }

  /**
   * Get NFT standard from contract type
   * @param type - Contract type string
   * @returns NFT standard enum value
   */
  private getNFTStandard(type: string | undefined): NFTStandard {
    const normalized = type?.toUpperCase().replace('-', '');
    switch (normalized) {
      case 'ERC721':
        return NFTStandard.ERC721;
      case 'ERC1155':
        return NFTStandard.ERC1155;
      case 'BEP721':
        return NFTStandard.BEP721;
      case 'BEP1155':
        return NFTStandard.BEP1155;
      default:
        return NFTStandard.ERC721;
    }
  }

  /**
   * Check if NFT is likely spam
   * @param nft - NFT object to check
   * @returns True if NFT is likely spam, false otherwise
   */
  private isSpamNFT(nft: NFT): boolean {
    // Check collection spam score
    if (nft.collection?.spam_score !== undefined && nft.collection.spam_score > 80) {
      return true;
    }

    // Check for common spam indicators
    const name = nft.metadata.name?.toLowerCase() ?? '';
    const spamKeywords = ['airdrop', 'claim', 'voucher', 'test', '$'];

    return name !== '' && spamKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * Get NFT by contract and token ID
   * @param chain - Chain name
   * @param contractAddress - Contract address
   * @param tokenId - Token ID
   * @returns Promise resolving to NFT or null if not found
   */
  async getNFT(
    chain: string,
    contractAddress: string,
    tokenId: string
  ): Promise<NFT | null> {
    try {
      const url = `${NFT_API_ENDPOINTS.simplehash}/nfts/${chain}/${contractAddress}/${tokenId}`;

      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.apiKeys['simplehash'] ?? '',
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as unknown;
      if (typeof data !== 'object' || data === null || !('contract_address' in data) || !('token_id' in data)) {
        return null;
      }
      const nftData = data as { contract_address: string; token_id: string };
      const parsed = this.parseSimpleHashNFTs([nftData], chain);
      return parsed[0] ?? null;
    } catch (error) {
      // Error fetching NFT
      return null;
    }
  }

  /**
   * Get NFTs from a specific collection
   * @param chain - Chain name
   * @param collectionAddress - Collection contract address
   * @param limit - Maximum number of NFTs to return
   * @returns Promise resolving to array of NFTs
   */
  async getCollectionNFTs(
    chain: string,
    collectionAddress: string,
    limit = 50
  ): Promise<NFT[]> {
    try {
      const url = `${NFT_API_ENDPOINTS.simplehash}/nfts/collection/${chain}/${collectionAddress}?limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.apiKeys['simplehash'] ?? '',
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as unknown as { nfts?: unknown };
      if (!Array.isArray(data.nfts)) {
        return [];
      }
      return this.parseSimpleHashNFTs(data.nfts as SimpleHashNFT[], chain);
    } catch (error) {
      // Error fetching collection NFTs
      return [];
    }
  }

  /**
   * Check if address is a special NFT contract
   * @param contractAddress - Contract address to check
   * @returns Contract name if special, null otherwise
   */
  isSpecialNFTContract(contractAddress: string): string | null {
    const lowercased = contractAddress.toLowerCase();

    for (const [name, address] of Object.entries(SPECIAL_NFT_CONTRACTS)) {
      if (lowercased === address.toLowerCase()) {
        return name;
      }
    }

    return null;
  }
}
