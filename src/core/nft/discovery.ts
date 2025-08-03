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
  NFTCollection,
  NFTMetadata,
  SolanaNFT,
  NFT_API_ENDPOINTS,
  SPECIAL_NFT_CONTRACTS,
} from './types';

export class NFTDiscoveryService {
  private apiKeys: Record<string, string> = {};

  constructor(apiKeys?: Record<string, string>) {
    this.apiKeys = apiKeys || {};
  }

  /**
   * Discover NFTs across multiple chains
   */
  async discoverNFTs(
    address: string,
    options: NFTDiscoveryOptions = {}
  ): Promise<NFTDiscoveryResult> {
    const chains = options.chains || ['ethereum', 'polygon', 'solana'];
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
    const filteredNFTs = options.includeSpam 
      ? allNFTs 
      : allNFTs.filter(nft => !this.isSpamNFT(nft));

    // Apply limit
    const limitedNFTs = options.limit 
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
   */
  private async discoverEVMNFTs(
    address: string,
    chain: string,
    options: NFTDiscoveryOptions
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

      const simpleHashChain = chainMapping[chain] || chain;
      const url = `${NFT_API_ENDPOINTS.simplehash}/nfts/owners?chains=${simpleHashChain}&wallet_addresses=${address}`;
      
      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.apiKeys.simplehash || '',
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch NFTs for ${chain}:`, response.statusText);
        return [];
      }

      const data = await response.json();
      return this.parseSimpleHashNFTs(data.nfts || [], chain);
    } catch (error) {
      console.error(`Error discovering EVM NFTs on ${chain}:`, error);
      return [];
    }
  }

  /**
   * Discover Solana NFTs using Helius API
   */
  private async discoverSolanaNFTs(
    address: string,
    options: NFTDiscoveryOptions
  ): Promise<SolanaNFT[]> {
    try {
      const url = `${NFT_API_ENDPOINTS.helius}/addresses/${address}/nfts`;
      
      const response = await fetch(url, {
        headers: {
          'api-key': this.apiKeys.helius || '',
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch Solana NFTs:', response.statusText);
        return [];
      }

      const data = await response.json();
      return this.parseHeliusNFTs(data.items || []);
    } catch (error) {
      console.error('Error discovering Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Discover Substrate NFTs (Polkadot/Kusama ecosystem)
   */
  private async discoverSubstrateNFTs(
    address: string,
    options: NFTDiscoveryOptions
  ): Promise<NFT[]> {
    // This would integrate with Subscan or similar APIs
    // For now, return empty array
    return [];
  }

  /**
   * Parse SimpleHash NFT data
   */
  private parseSimpleHashNFTs(nfts: any[], chain: string): NFT[] {
    return nfts.map(nft => ({
      id: `${chain}_${nft.contract_address}_${nft.token_id}`,
      contract_address: nft.contract_address,
      token_id: nft.token_id,
      chain: chain as ChainType,
      type: this.getNFTType(nft.contract.type),
      standard: this.getNFTStandard(nft.contract.type),
      owner: nft.owners?.[0]?.owner_address || '',
      metadata: {
        name: nft.name || 'Unnamed NFT',
        description: nft.description,
        image: nft.image_url || nft.previews?.image_medium_url,
        animation_url: nft.video_url || nft.audio_url || nft.model_url,
        external_url: nft.external_url,
        attributes: nft.extra_metadata?.attributes || [],
        background_color: nft.background_color,
      },
      collection: nft.collection ? {
        id: nft.collection.collection_id,
        name: nft.collection.name,
        description: nft.collection.description,
        image: nft.collection.image_url,
        external_url: nft.collection.external_url,
        twitter: nft.collection.twitter_username,
        discord: nft.collection.discord_url,
        verified: nft.collection.marketplace_pages?.some((m: any) => m.verified),
        spam_score: nft.collection.spam_score,
        floor_price: nft.collection.floor_prices?.[0] ? {
          value: nft.collection.floor_prices[0].value,
          currency: nft.collection.floor_prices[0].payment_token?.symbol || 'ETH',
          marketplace: nft.collection.floor_prices[0].marketplace_id,
        } : undefined,
      } : undefined,
      marketplace_data: nft.last_sale ? {
        last_sale: {
          price: nft.last_sale.unit_price?.toString() || '0',
          currency: nft.last_sale.payment_token?.symbol || 'ETH',
          date: nft.last_sale.timestamp,
          from: nft.last_sale.from_address,
          to: nft.last_sale.to_address,
        }
      } : undefined,
    }));
  }

  /**
   * Parse Helius Solana NFT data
   */
  private parseHeliusNFTs(nfts: any[]): SolanaNFT[] {
    return nfts.map(nft => ({
      id: `solana_${nft.id}`,
      contract_address: nft.id,
      token_id: nft.id,
      chain: 'solana',
      type: NFTType.SolanaToken,
      standard: NFTStandard.METAPLEX,
      owner: nft.ownership.owner,
      mint: nft.id,
      metadata: {
        name: nft.content.metadata.name || 'Unnamed NFT',
        description: nft.content.metadata.description,
        image: nft.content.files?.[0]?.uri || nft.content.metadata.image,
        external_url: nft.content.metadata.external_url,
        attributes: nft.content.metadata.attributes?.map((attr: any) => ({
          trait_type: attr.trait_type,
          value: attr.value,
        })) || [],
      },
      collection: nft.grouping?.[0] ? {
        id: nft.grouping[0].group_value,
        name: nft.grouping[0].group_value,
        verified: nft.grouping[0].verified,
      } : undefined,
      update_authority: nft.authorities?.[0]?.address,
      primary_sale_happened: nft.royalty?.primary_sale_happened,
      seller_fee_basis_points: nft.royalty?.basis_points,
      creators: nft.creators?.map((creator: any) => ({
        address: creator.address,
        verified: creator.verified,
        share: creator.share,
      })) || [],
      token_standard: nft.content.metadata.token_standard,
    } as SolanaNFT));
  }

  /**
   * Get NFT type from contract standard
   */
  private getNFTType(standard: string): NFTType {
    switch (standard?.toUpperCase()) {
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
   */
  private getNFTStandard(type: string): NFTStandard {
    switch (type?.toUpperCase()) {
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
   */
  private isSpamNFT(nft: NFT): boolean {
    // Check collection spam score
    if (nft.collection?.spam_score && nft.collection.spam_score > 80) {
      return true;
    }

    // Check for common spam indicators
    const name = nft.metadata.name?.toLowerCase() || '';
    const spamKeywords = ['airdrop', 'claim', 'voucher', 'test', '$'];
    
    return spamKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * Get NFT by contract and token ID
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
          'X-API-KEY': this.apiKeys.simplehash || '',
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const parsed = this.parseSimpleHashNFTs([data], chain);
      return parsed[0] || null;
    } catch (error) {
      console.error('Error fetching NFT:', error);
      return null;
    }
  }

  /**
   * Get NFTs from a specific collection
   */
  async getCollectionNFTs(
    chain: string,
    collectionAddress: string,
    limit: number = 50
  ): Promise<NFT[]> {
    try {
      const url = `${NFT_API_ENDPOINTS.simplehash}/nfts/collection/${chain}/${collectionAddress}?limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.apiKeys.simplehash || '',
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return this.parseSimpleHashNFTs(data.nfts || [], chain);
    } catch (error) {
      console.error('Error fetching collection NFTs:', error);
      return [];
    }
  }

  /**
   * Check if address is a special NFT contract
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