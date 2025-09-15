import type { NFTItem, NFTCollection, NFTSearchQuery, NFTSearchResult } from '../../../types/nft';
import { EthereumNFTProvider } from '../providers/ethereum-provider';
import { PolygonNFTProvider } from '../providers/polygon-provider';
import { SolanaNFTProvider } from '../providers/solana-provider';
import { logger } from '../../../utils/logger';
import { secureRandom, secureRandomInt, generateSecureMockAddress } from '../../utils/secure-random';

/**
 * Static configuration for a supported blockchain.
 */
export interface ChainConfig {
  /** Human‑readable chain name */
  name: string;
  /** Numeric chain id (custom id for non‑EVM like Solana) */
  chainId: number;
  /** Public RPC endpoint */
  rpcUrl: string;
  /** Block explorer base URL */
  explorer: string;
  /** Supported NFT standards on this chain */
  nftStandards: Array<'ERC721' | 'ERC1155' | 'SPL' | 'other'>;
  /** Marketplaces commonly used on this chain */
  supportedMarketplaces: string[];
}

/**
 * Provider abstraction for fetching NFTs/collections on a chain.
 */
export interface ChainProvider {
  /** Numeric chain id */
  chainId: number;
  /** Chain name */
  name: string;
  /** Whether the provider is connected */
  isConnected: boolean;
  /** Fetch NFTs for a wallet address */
  getNFTs(address: string): Promise<NFTItem[]>;
  /** Fetch metadata for a specific NFT */
  getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTItem | null>;
  /** Fetch NFT collections owned by a wallet */
  getCollections(address: string): Promise<NFTCollection[]>;
}

/**
 * Multi-chain NFT display service for OmniBazaar wallet
 * Supports displaying NFTs from multiple blockchains while minting on OmniCoin
 */
export class MultiChainNFTDisplay {
  private chains: Map<number, ChainConfig> = new Map();
  private providers: Map<number, ChainProvider> = new Map();
  private enabledChains: Set<number> = new Set();

  /** Initialize with default supported chains. */
  constructor() {
    this.initializeSupportedChains();
  }

  /**
   * Initialize supported blockchain configurations
   */
  private initializeSupportedChains(): void {
    const supportedChains: ChainConfig[] = [
      {
        name: 'OmniCoin',
        chainId: 8888,
        rpcUrl: 'https://rpc.omnicoin.network',
        explorer: 'https://explorer.omnicoin.network',
        nftStandards: ['ERC721', 'ERC1155'],
        supportedMarketplaces: ['OmniBazaar']
      },
      {
        name: 'Ethereum',
        chainId: 1,
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
        explorer: 'https://etherscan.io',
        nftStandards: ['ERC721', 'ERC1155'],
        supportedMarketplaces: ['OpenSea', 'Rarible', 'Foundation']
      },
      {
        name: 'Polygon',
        chainId: 137,
        rpcUrl: 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        nftStandards: ['ERC721', 'ERC1155'],
        supportedMarketplaces: ['OpenSea', 'Rarible']
      },
      {
        name: 'Binance Smart Chain',
        chainId: 56,
        rpcUrl: 'https://bsc-dataseed.binance.org',
        explorer: 'https://bscscan.com',
        // BSC is EVM-compatible; use ERC standards to fit our union
        nftStandards: ['ERC721', 'ERC1155'],
        supportedMarketplaces: ['PancakeSwap', 'BakerySwap']
      },
      {
        name: 'Avalanche',
        chainId: 43114,
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
        explorer: 'https://snowtrace.io',
        nftStandards: ['ERC721', 'ERC1155'],
        supportedMarketplaces: ['Kalao', 'NFTrade']
      },
      {
        name: 'Solana',
        chainId: 101, // Custom ID for non-EVM
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        explorer: 'https://explorer.solana.com',
        nftStandards: ['SPL'],
        supportedMarketplaces: ['Magic Eden', 'Solanart', 'Digital Eyes']
      },
      {
        name: 'COTI',
        chainId: 13068200,
        rpcUrl: 'https://mainnet.coti.io',
        explorer: 'https://explorer.coti.io',
        nftStandards: ['ERC721', 'ERC1155'],
        supportedMarketplaces: ['COTI Marketplace']
      }
    ];

    for (const chain of supportedChains) {
      this.chains.set(chain.chainId, chain);
      // Enable OmniCoin and major chains by default
      if ([8888, 1, 137, 56].includes(chain.chainId)) {
        this.enabledChains.add(chain.chainId);
      }
    }
  }

  /**
   * Get NFTs from all enabled chains for a given address.
   * Returns a flattened list and a per‑chain breakdown.
   * @param address - Wallet address
   * @returns Promise resolving to NFTs from all chains
   */
  async getAllNFTs(address: string): Promise<{
    nfts: NFTItem[];
    chains: { [chainId: number]: NFTItem[] };
    totalCount: number;
  }> {
    const allNFTs: NFTItem[] = [];
    const nftsByChain: { [chainId: number]: NFTItem[] } = {};

    for (const chainId of this.enabledChains) {
      try {
        const provider = this.providers.get(chainId);
        if (provider !== undefined && provider.isConnected) {
          const chainNFTs = await provider.getNFTs(address);
          allNFTs.push(...chainNFTs);
          nftsByChain[chainId] = chainNFTs;
        } else {
          // Simulate NFT fetching for demonstration
          const mockNFTs = this.getMockNFTsForChain(chainId, address);
          allNFTs.push(...mockNFTs);
          nftsByChain[chainId] = mockNFTs;
        }
      } catch (error) {
        logger.warn(`Failed to fetch NFTs from chain ${chainId}:`, error);
        nftsByChain[chainId] = [];
      }
    }

    return {
      nfts: allNFTs,
      chains: nftsByChain,
      totalCount: allNFTs.length
    };
  }

  /**
   * Get NFT collections from all enabled chains for a wallet address.
   * @param address - Wallet address
   * @returns Promise resolving to collections from all chains
   */
  async getAllCollections(address: string): Promise<{
    collections: NFTCollection[];
    chains: { [chainId: number]: NFTCollection[] };
  }> {
    const allCollections: NFTCollection[] = [];
    const collectionsByChain: { [chainId: number]: NFTCollection[] } = {};

    for (const chainId of this.enabledChains) {
      try {
        const provider = this.providers.get(chainId);
        if (provider !== undefined && provider.isConnected) {
          const chainCollections = await provider.getCollections(address);
          allCollections.push(...chainCollections);
          collectionsByChain[chainId] = chainCollections;
        } else {
          // Simulate collection fetching
          const mockCollections = this.getMockCollectionsForChain(chainId);
          allCollections.push(...mockCollections);
          collectionsByChain[chainId] = mockCollections;
        }
      } catch (error) {
        console.warn(`Failed to fetch collections from chain ${chainId}:`, error);
        collectionsByChain[chainId] = [];
      }
    }

    return {
      collections: allCollections,
      chains: collectionsByChain
    };
  }

  /**
   * Search NFTs across all enabled chains
   * @param query - Search parameters and filters
   * @returns Search results with pagination
   */
  searchNFTs(query: NFTSearchQuery): NFTSearchResult {
    const results: NFTItem[] = [];
    const filters = {
      categories: new Map<string, number>(),
      blockchains: new Map<string, number>(),
      priceRange: { min: Infinity, max: 0 }
    };

    for (const chainId of this.enabledChains) {
      try {
        const chainConfig = this.chains.get(chainId);
        if (chainConfig === undefined) continue;

        // Filter by blockchain if specified
        if (query.blockchain !== undefined && query.blockchain.length > 0 && chainConfig.name.toLowerCase() !== query.blockchain.toLowerCase()) {
          continue;
        }

        const chainNFTs = this.searchChainNFTs(chainId, query);
        results.push(...chainNFTs);

        // Update filters
        for (const nft of chainNFTs) {
          // Categories
          const category = nft.attributes.find(attr => attr.trait_type === 'Category')?.value as string;
          if (category !== undefined && category.length > 0) {
            filters.categories.set(category, (filters.categories.get(category) ?? 0) + 1);
          }

          // Blockchain
          filters.blockchains.set(chainConfig.name, (filters.blockchains.get(chainConfig.name) ?? 0) + 1);

          // Price range
          if (nft.price !== undefined && nft.price.length > 0) {
            const price = parseFloat(nft.price);
            if (price > 0) {
              filters.priceRange.min = Math.min(filters.priceRange.min, price);
              filters.priceRange.max = Math.max(filters.priceRange.max, price);
            }
          }
        }
      } catch (error) {
        console.warn(`Search failed for chain ${chainId}:`, error);
      }
    }

    // Sort results
    if (query.sortBy !== undefined && query.sortBy.length > 0) {
      results.sort((a, b) => {
        const order = (query as { sortOrder?: string }).sortOrder === 'desc' ? -1 : 1;
        switch (query.sortBy) {
          case 'price_asc':
          case 'price_desc': {
            const priceA = parseFloat(a.price ?? '0');
            const priceB = parseFloat(b.price ?? '0');
            return (priceA - priceB) * order;
          }
          case 'created_desc':
            // Use token ID as proxy for creation time
            return (parseInt(b.tokenId) - parseInt(a.tokenId)) * order;
          default:
            return 0;
        }
      });
    }

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const paginatedResults = results.slice(offset, offset + limit);

    // Convert NFTItems to MarketplaceListing format for search results
    const marketplaceListings = paginatedResults.map(nft => this.convertNFTToListing(nft));

    return {
      items: marketplaceListings,
      total: results.length,
      hasMore: offset + limit < results.length,
      filters: {
        categories: Array.from(filters.categories.entries()).map(([id, count]) => ({ id, name: id, count })),
        blockchains: Array.from(filters.blockchains.entries()).map(([id, count]) => ({ id, name: id, count })),
        priceRange: filters.priceRange.min === Infinity ? { min: 0, max: 0 } : filters.priceRange
      }
    };
  }

  /**
   * Search NFTs on a specific chain
   * @param chainId - Chain ID to search
   * @param query - Search query parameters
   * @returns Promise resolving to filtered NFTs
   */
  private searchChainNFTs(chainId: number, query: NFTSearchQuery): NFTItem[] {
    // This would be replaced with actual chain-specific search logic
    const mockNFTs = this.getMockNFTsForChain(chainId, 'search');
    
    // Apply basic filtering
    return mockNFTs.filter(nft => {
      if (query.query !== undefined && query.query.length > 0 && !nft.name.toLowerCase().includes(query.query.toLowerCase())) {
        return false;
      }
      if (query.category !== undefined && query.category.length > 0) {
        const category = nft.attributes.find(attr => attr.trait_type === 'Category')?.value;
        if (category !== query.category) return false;
      }
      if ((query.priceMin !== undefined && query.priceMin > 0) || (query.priceMax !== undefined && query.priceMax > 0)) {
        const price = parseFloat(nft.price ?? '0');
        if (query.priceMin !== undefined && query.priceMin > 0 && price < query.priceMin) return false;
        if (query.priceMax !== undefined && query.priceMax > 0 && price > query.priceMax) return false;
      }
      return true;
    });
  }

  /**
   * Generate mock NFTs for demonstration (replace with real provider calls)
   * @param chainId - Chain ID to generate NFTs for
   * @param address - Wallet address
   * @returns Promise resolving to mock NFTs
   */
  private getMockNFTsForChain(chainId: number, address: string): NFTItem[] {
    const chainConfig = this.chains.get(chainId);
    if (chainConfig === undefined) return [];

    const mockNFTs: NFTItem[] = [];
    const count = secureRandomInt(1, 5); // 1-5 NFTs per chain

    for (let i = 0; i < count; i++) {
      const tokenId = (Date.now() + i).toString();
      const isListed = secureRandom() > 0.5;
      const price = isListed ? (secureRandom() * 10).toFixed(3) : undefined;
      const currency = isListed ? (chainId === 8888 ? 'XOM' : ['ETH', 'MATIC', 'BNB', 'AVAX', 'SOL'][secureRandomInt(0, 4)]) : undefined;

      mockNFTs.push({
        id: `${chainConfig.name.toLowerCase()}_${chainId}_${tokenId}`,
        tokenId,
        name: `${chainConfig.name} NFT #${tokenId.slice(-4)}`,
        description: `Sample NFT from ${chainConfig.name} blockchain`,
        image: `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
        imageUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
        attributes: [
          { trait_type: 'Blockchain', value: chainConfig.name !== '' ? chainConfig.name : 'Unknown' },
          { trait_type: 'Category', value: ['Art', 'Gaming', 'Collectibles'][i % 3] ?? 'Art' },
          { trait_type: 'Rarity', value: ['Common', 'Rare', 'Epic'][i % 3] ?? 'Common' }
        ],
        contract: generateSecureMockAddress(),
        contractAddress: generateSecureMockAddress(),
        // Ensure a valid token standard string for strict types
        tokenStandard: chainConfig.nftStandards[0] !== undefined ? chainConfig.nftStandards[0] : 'other',
        blockchain: chainConfig.name.toLowerCase(),
        owner: address,
        creator: generateSecureMockAddress(),
        ...(isListed === true && { isListed }),
        ...(price !== undefined && price !== null && { price }),
        ...(currency !== undefined && currency !== null && currency !== '' && { currency })
      });
    }

    return mockNFTs;
  }

  /**
   * Generate mock collections for demonstration
   * @param chainId - Chain ID to generate mock collections for
   * @returns Promise resolving to array of mock NFT collections
   */
  private getMockCollectionsForChain(chainId: number): NFTCollection[] {
    const chainConfig = this.chains.get(chainId);
    if (chainConfig === undefined) return [];

    return [{
      id: `collection_${chainId}`,
      name: `${chainConfig.name} Collection`,
      description: `Sample collection from ${chainConfig.name}`,
      contract: generateSecureMockAddress(),
      contractAddress: generateSecureMockAddress(),
      tokenStandard: chainConfig.nftStandards[0] !== undefined ? chainConfig.nftStandards[0] : 'other',
      blockchain: chainConfig.name.toLowerCase(),
      creator: generateSecureMockAddress(),
      verified: true,
      items: []
    }];
  }

  /**
   * Enable/disable a blockchain for NFT display
   * @param chainId - The chain ID to enable or disable
   * @param enabled - Whether to enable or disable the chain
   */
  toggleChain(chainId: number, enabled: boolean): void {
    if (enabled) {
      this.enabledChains.add(chainId);
    } else {
      this.enabledChains.delete(chainId);
    }
  }

  /**
   * Get list of supported chains
   * @returns Array of supported chain configurations
   */
  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  /**
   * Get list of enabled chains
   * @returns Array of enabled chain configurations
   */
  getEnabledChains(): ChainConfig[] {
    return Array.from(this.enabledChains).map(id => this.chains.get(id)).filter((chain): chain is ChainConfig => chain !== undefined);
  }

  /**
   * Register a custom chain provider
   * @param chainId - The chain ID to register the provider for
   * @param provider - The provider instance to register
   */
  registerProvider(chainId: number, provider: ChainProvider): void {
    this.providers.set(chainId, provider);
  }

  /**
   * Convert NFTItem to MarketplaceListing format
   * @param nft - The NFT item to convert to listing format
   * @returns The converted marketplace listing object
   */
  private convertNFTToListing(nft: NFTItem): {
    id: string;
    nftId: string;
    tokenId: string;
    contract: string;
    seller: string;
    price: string;
    currency: string;
    listingType: 'fixed_price';
    title: string;
    description: string;
    category: string;
    tags: string[];
    featured: boolean;
    verified: boolean;
    escrowEnabled: boolean;
    instantPurchase: boolean;
    createdAt: number;
    updatedAt: number;
    views: number;
    likes: number;
    shares: number;
  } {
    const categoryAttr = nft.attributes.find(attr => attr.trait_type === 'Category');
    const category = typeof categoryAttr?.value === 'string' ? categoryAttr.value : 'general';
    return {
      id: `listing_${nft.id}`,
      nftId: nft.id,
      tokenId: nft.tokenId,
      contract: nft.contractAddress,
      seller: nft.owner !== undefined && nft.owner !== null && nft.owner !== '' ? nft.owner : 'unknown',
      price: nft.price !== undefined && nft.price !== null && nft.price !== '' ? nft.price : '0',
      currency: nft.currency !== undefined && nft.currency !== null && nft.currency !== '' ? nft.currency : 'ETH',
      listingType: 'fixed_price' as const,
      title: nft.name,
      description: nft.description !== undefined && nft.description !== '' ? nft.description : '',
      category,
      tags: [],
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
  }

  /**
   * Initialize real chain providers with API keys
   * @param apiKeys - Object containing API keys for different chains
   * @param apiKeys.ethereum - Ethereum provider API keys
   * @param apiKeys.ethereum.alchemyApiKey - Alchemy API key for Ethereum
   * @param apiKeys.ethereum.openseaApiKey - OpenSea API key for Ethereum NFTs
   * @param apiKeys.polygon - Polygon provider API keys
   * @param apiKeys.polygon.alchemyApiKey - Alchemy API key for Polygon
   * @param apiKeys.solana - Solana provider API keys
   * @param apiKeys.solana.heliusApiKey - Helius API key for Solana
   * @param apiKeys.solana.magicEdenApiKey - Magic Eden API key for Solana NFTs
   */
  initializeProviders(apiKeys: {
    ethereum?: { alchemyApiKey?: string; openseaApiKey?: string };
    polygon?: { alchemyApiKey?: string };
    solana?: { heliusApiKey?: string; magicEdenApiKey?: string };
  }): void {
    // Initialize Ethereum provider
    if (apiKeys.ethereum !== undefined && apiKeys.ethereum !== null) {
      const ethereumProvider = new EthereumNFTProvider({
        rpcUrl: 'https://mainnet.infura.io/v3/demo',
        ...apiKeys.ethereum
      });
      this.registerProvider(1, ethereumProvider);
    }

    // Initialize Polygon provider
    if (apiKeys.polygon !== undefined && apiKeys.polygon !== null) {
      const polygonProvider = new PolygonNFTProvider({
        rpcUrl: 'https://polygon-rpc.com',
        ...apiKeys.polygon
      });
      this.registerProvider(137, polygonProvider);
    }

    // Initialize Solana provider
    if (apiKeys.solana !== undefined && apiKeys.solana !== null) {
      const solanaProvider = new SolanaNFTProvider({
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        ...apiKeys.solana
      });
      this.registerProvider(101, solanaProvider);
    }

    logger.warn('Multi-chain NFT providers initialized');
  }

  /**
   * Get chain statistics
   * @returns Statistics for each chain
   */
  getChainStatistics(): {
    [chainId: number]: {
      name: string;
      enabled: boolean;
      nftCount: number;
      collectionCount: number;
      isConnected: boolean;
    };
  } {
    const stats: Record<number, {
      name: string;
      enabled: boolean;
      nftCount: number;
      collectionCount: number;
      isConnected: boolean;
    }> = {};

    for (const [chainId, config] of this.chains) {
      const provider = this.providers.get(chainId);
      stats[chainId] = {
        name: config.name,
        enabled: this.enabledChains.has(chainId),
        nftCount: 0, // Would be fetched from provider
        collectionCount: 0, // Would be fetched from provider
        isConnected: provider !== undefined && provider !== null ? provider.isConnected : false
      };
    }

    return stats;
  }
} 
