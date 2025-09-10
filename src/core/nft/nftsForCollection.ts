/**
 * NFTs for Collection Hook for OmniBazaar Wallet
 * Provides functionality for fetching all NFTs within a specific collection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NFTManager } from './NFTManager';
import { NFTService } from './NFTService';
import { MarketplaceService } from './mocks/MarketplaceService';
import type { NFT, NFTCollection } from './types';
// ChainType is not used since we're using string for chain
import { calculateRarityScore } from '../../utils/nft';

/**
 * Parameters for fetching NFTs in a collection
 */
export interface NftsForCollectionParams {
  /** Collection contract address */
  contractAddress: string;
  /** Chain ID where collection exists */
  chainId: number;
  /** Optional collection name */
  collectionName?: string;
}

/**
 * Options for the useNftsForCollection hook
 */
export interface NftsForCollectionOptions {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Number of NFTs to fetch per page */
  pageSize?: number;
  /** Sort order for NFTs */
  sortBy?: 'tokenId' | 'rarity' | 'price' | 'recent';
  /** Filter by attributes */
  attributeFilters?: Array<{
    trait_type: string;
    values: Array<string | number>;
  }>;
  /** Price range filter */
  priceRange?: {
    min?: bigint;
    max?: bigint;
  };
}

/**
 * Result of the useNftsForCollection hook
 */
export interface NftsForCollectionResult {
  /** Array of NFTs in the collection */
  data?: NFT[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether there are more NFTs to load */
  hasMore: boolean;
  /** Function to load more NFTs */
  loadMore: () => Promise<void>;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Collection metadata */
  collection?: NFTCollection;
  /** Total supply of collection */
  totalSupply?: number;
}

/** Service instances */
let nftManager: NFTManager | null = null;
let nftService: NFTService | null = null;
let marketplaceService: MarketplaceService | null = null;

/**
 * Initialize services if not already initialized
 */
const initializeServices = async (): Promise<void> => {
  if (nftManager === null) {
    nftManager = new NFTManager();
  }
  
  if (nftService === null) {
    nftService = NFTService.getInstance();
    await nftService.initialize();
  }
  
  if (marketplaceService === null) {
    marketplaceService = new MarketplaceService();
  }
};

/**
 * Convert chain ID to ChainType
 * @param chainId - Chain ID to convert
 * @returns Chain type string
 */
const getChainType = (chainId: number): string => {
  const chainMap: Record<number, string> = {
    1: 'ethereum',
    137: 'polygon',
    43114: 'avalanche',
    42161: 'arbitrum',
    10: 'optimism',
    56: 'bsc',
    100: 'gnosis',
    250: 'fantom'
  };
  
  return chainMap[chainId] ?? 'ethereum';
};

/**
 * Hook to fetch NFTs for a specific collection
 * @param params Collection identification parameters
 * @param options Query options
 * @returns Query result for collection NFTs
 */
export function useNftsForCollection(
  params: NftsForCollectionParams,
  options: NftsForCollectionOptions = {}
): NftsForCollectionResult {
  const [data, setData] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [collection, setCollection] = useState<NFTCollection | undefined>();
  const [totalSupply, setTotalSupply] = useState<number | undefined>();
  const [offset, setOffset] = useState(0);
  
  // Track attribute statistics for rarity calculations
  const attributeStats = useRef<Map<string, Map<string | number, number>>>(new Map());
  
  const {
    enabled = true,
    pageSize = 50,
    sortBy = 'tokenId',
    attributeFilters = [],
    priceRange
  } = options;
  
  const chain = getChainType(params.chainId);
  
  /**
   * Apply filters to NFT array
   */
  const applyFilters = useCallback((nfts: NFT[]): NFT[] => {
    let filtered = [...nfts];
    
    // Apply attribute filters
    if (attributeFilters.length > 0) {
      filtered = filtered.filter(nft => {
        if (nft.metadata?.attributes === undefined || nft.metadata.attributes === null) return false;
        
        return attributeFilters.every(filter => {
          const attribute = nft.metadata?.attributes?.find(
            attr => attr.trait_type === filter.trait_type
          );
          
          return attribute !== undefined && filter.values.includes(attribute.value);
        });
      });
    }
    
    // Apply price range filter
    if (priceRange !== undefined && (priceRange.min !== undefined || priceRange.max !== undefined)) {
      filtered = filtered.filter(nft => {
        // Use marketplace price if available
        const price = nft.marketplace_data?.price !== undefined && nft.marketplace_data.price !== null && nft.marketplace_data.price !== '' ? 
          BigInt(nft.marketplace_data.price) : BigInt(0);
        
        if (priceRange.min !== undefined && price < priceRange.min) return false;
        if (priceRange.max !== undefined && price > priceRange.max) return false;
        
        return true;
      });
    }
    
    return filtered;
  }, [attributeFilters, priceRange]);
  
  /**
   * Sort NFTs based on selected criteria
   */
  const sortNFTs = useCallback((nfts: NFT[]): NFT[] => {
    let sorted = [...nfts];
    
    switch (sortBy) {
      case 'tokenId':
        sorted.sort((a, b) => {
          const aId = parseInt(a.token_id);
          const bId = parseInt(b.token_id);
          if (isNaN(aId)) return isNaN(bId) ? 0 : 1;
          if (isNaN(bId)) return -1;
          return aId - bId;
        });
        break;
        
      case 'rarity': {
        // Calculate rarity scores and sort
        const nftsWithRarity = sorted.map(nft => {
          const rarityScore = nft.metadata?.attributes !== undefined && nft.metadata.attributes !== null ? 
            calculateRarityScore(nft.metadata.attributes, attributeStats.current) : 50;
          return { nft, rarityScore };
        });
        
        nftsWithRarity.sort((a, b) => b.rarityScore - a.rarityScore);
        sorted = nftsWithRarity.map(item => item.nft);
        break;
      }
        
      case 'price':
        sorted.sort((a, b) => {
          const aPrice = a.marketplace_data?.price !== undefined && a.marketplace_data.price !== null && a.marketplace_data.price !== '' ?
            BigInt(a.marketplace_data.price) : BigInt(0);
          const bPrice = b.marketplace_data?.price !== undefined && b.marketplace_data.price !== null && b.marketplace_data.price !== '' ?
            BigInt(b.marketplace_data.price) : BigInt(0);
          return aPrice > bPrice ? -1 : aPrice < bPrice ? 1 : 0;
        });
        break;
        
      case 'recent':
        sorted.sort((a, b) => {
          // Use last_updated timestamp if available
          const aTime = a.last_updated !== undefined && a.last_updated !== null && a.last_updated !== '' ? 
            new Date(a.last_updated).getTime() : 0;
          const bTime = b.last_updated !== undefined && b.last_updated !== null && b.last_updated !== '' ? 
            new Date(b.last_updated).getTime() : 0;
          return bTime - aTime;
        });
        break;
    }
    
    return sorted;
  }, [sortBy]);
  
  /**
   * Fetch collection metadata
   */
  const fetchCollectionData = useCallback(async () => {
    if (nftService === null) return;
    
    try {
      // Get collections and find the matching one
      const collections = await nftService.getCollections(params.contractAddress, params.chainId);
      const collectionData = collections?.[0];
      
      setCollection(collectionData as NFTCollection | undefined);
      if (collectionData !== undefined && collectionData !== null && typeof collectionData === 'object' && 'total_supply' in collectionData) {
        setTotalSupply((collectionData as NFTCollection).total_supply);
      }
    } catch (err) {
      // Failed to fetch collection data
    }
  }, [params.contractAddress, chain]);
  
  /**
   * Build attribute statistics for rarity calculations
   */
  const buildAttributeStats = useCallback((nfts: NFT[]) => {
    const stats = new Map<string, Map<string | number, number>>();
    
    nfts.forEach(nft => {
      if (nft.metadata?.attributes === undefined || nft.metadata.attributes === null) return;
      
      nft.metadata.attributes.forEach(attr => {
        if (!stats.has(attr.trait_type)) {
          stats.set(attr.trait_type, new Map());
        }
        
        const traitMap = stats.get(attr.trait_type);
        if (traitMap === undefined) return;
        const currentCount = traitMap.get(attr.value) ?? 0;
        traitMap.set(attr.value, currentCount + 1);
      });
    });
    
    attributeStats.current = stats;
  }, []);
  
  /**
   * Fetch NFTs from the collection
   */
  const fetchNFTs = useCallback(async (startOffset: number = 0) => {
    if (!enabled || nftManager === null) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch NFTs from collection using getNFTs with contract filter
      const nfts = await nftManager.getNFTs(params.contractAddress, {
        chains: [chain],
        // contracts filter doesn't exist, will filter manually
        includeSpam: false
      });
      
      // Filter by contract and apply pagination
      const contractNfts = nfts.filter(nft => nft.contract_address === params.contractAddress);
      const paginatedNfts = contractNfts.slice(startOffset, startOffset + pageSize);
      
      // Update attribute statistics
      if (startOffset === 0) {
        buildAttributeStats(nfts);
      } else {
        buildAttributeStats([...data, ...paginatedNfts]);
      }
      
      // Apply filters and sorting
      const filteredNFTs = applyFilters(paginatedNfts);
      const sortedNFTs = sortNFTs(filteredNFTs);
      
      // Update state
      if (startOffset === 0) {
        setData(sortedNFTs);
      } else {
        setData(prev => [...prev, ...sortedNFTs]);
      }
      
      setHasMore(paginatedNfts.length === pageSize);
      setOffset(startOffset + paginatedNfts.length);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch NFTs'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, params.contractAddress, chain, pageSize, applyFilters, sortNFTs, buildAttributeStats, data]);
  
  /**
   * Initial fetch
   */
  useEffect(() => {
    const init = async (): Promise<void> => {
      await initializeServices();
      await fetchCollectionData();
      await fetchNFTs(0);
    };
    
    if (enabled) {
      void init();
    }
  }, [enabled, params.contractAddress, params.chainId]);
  
  /**
   * Re-fetch when filters or sorting changes
   */
  useEffect(() => {
    if (data.length > 0) {
      const filtered = applyFilters(data);
      const sorted = sortNFTs(filtered);
      setData(sorted);
    }
  }, [sortBy, attributeFilters, priceRange]);
  
  /**
   * Load more function
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchNFTs(offset);
  }, [hasMore, isLoading, offset, fetchNFTs]);
  
  /**
   * Refetch function
   */
  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchCollectionData();
    await fetchNFTs(0);
  }, [fetchCollectionData, fetchNFTs]);
  
  return {
    data,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
    ...(collection !== undefined && { collection }),
    ...(totalSupply !== undefined && { totalSupply })
  };
}

/**
 * Fetch NFTs for a collection without using React hooks
 * @param params Collection parameters
 * @returns Promise resolving to array of NFTs
 */
export async function getNftsForCollection(
  params: NftsForCollectionParams
): Promise<NFT[]> {
  await initializeServices();
  
  if (nftManager === null) {
    throw new Error('NFT manager not initialized');
  }
  
  const chain = getChainType(params.chainId);
  const allNFTs: NFT[] = [];
  let offset = 0;
  const limit = 100;
  
  // Fetch all NFTs in batches
  let hasMore = true;
  while (hasMore) {
    try {
      // Get all NFTs for the contract
      const allNftsForContract = await nftManager.getNFTs(params.contractAddress, {
        chains: [chain],
        // contracts filter doesn't exist, will filter manually
        includeSpam: false
      });
      
      // Filter by contract and apply pagination
      const contractNfts = allNftsForContract.filter(nft => nft.contract_address === params.contractAddress);
      const batch = contractNfts.slice(offset, offset + limit);
      
      allNFTs.push(...batch);
      
      if (batch.length < limit) {
        hasMore = false;
      }
      
      offset += limit;
    } catch (error) {
      // Failed to fetch NFTs at offset
      hasMore = false;
    }
  }
  
  return allNFTs;
}

/**
 * Get collection statistics
 * @param contractAddress - Collection contract address
 * @param chainId - Chain ID
 * @returns Collection statistics
 */
export async function getCollectionStats(
  contractAddress: string,
  chainId: number
): Promise<{
  totalSupply: number;
  owners: number;
  floorPrice?: bigint;
  totalVolume?: bigint;
  attributes: Map<string, Map<string | number, number>>;
}> {
  await initializeServices();
  
  if (nftService === null || marketplaceService === null) {
    throw new Error('Services not initialized');
  }
  
  // Chain is not needed here
  
  // Get collection data
  // Get collections and find the matching one
  const collections = await nftService.getCollections(contractAddress, chainId);
  const collection = collections?.[0];
  
  // MarketplaceService doesn't have getCollectionStats, return default values
  const marketStats = {
    totalVolume: undefined
  };
  
  // Get all NFTs to build attribute statistics
  const nfts = await getNftsForCollection({ contractAddress, chainId });
  
  // Build attribute map
  const attributes = new Map<string, Map<string | number, number>>();
  nfts.forEach(nft => {
    if (nft.metadata?.attributes === undefined || nft.metadata.attributes === null) return;
    
    nft.metadata.attributes.forEach(attr => {
      if (!attributes.has(attr.trait_type)) {
        attributes.set(attr.trait_type, new Map());
      }
      
      const traitMap = attributes.get(attr.trait_type);
      if (traitMap === undefined) return;
      const currentCount = traitMap.get(attr.value) ?? 0;
      traitMap.set(attr.value, currentCount + 1);
    });
  });
  
  const collectionObj = collection as NFTCollection | undefined;
  
  return {
    totalSupply: collectionObj?.total_supply ?? nfts.length,
    owners: collectionObj?.owner_count ?? 0,
    ...(collectionObj?.floor_price !== undefined && { 
      floorPrice: BigInt(Math.floor(collectionObj.floor_price.value * 1e18)) 
    }),
    ...(marketStats?.totalVolume !== undefined && { totalVolume: marketStats.totalVolume }),
    attributes
  };
}