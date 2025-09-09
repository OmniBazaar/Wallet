/**
 * NFTs for Collection Hook for OmniBazaar Wallet
 * Provides functionality for fetching all NFTs within a specific collection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NFTManager } from '../../../../../Bazaar/src/services/nft/NFTManager';
import { NFTService } from '../../../../../Bazaar/src/services/nft/NFTService';
import { MarketplaceService } from '../../../../../Bazaar/src/services/MarketplaceService';
import type { NFT, NFTCollection } from './types';
import type { ChainType } from '../keyring/BIP39Keyring';
import { parseTokenURI, validateNFTMetadata, calculateRarityScore } from '../../utils/nft';

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
  if (!nftManager) {
    nftManager = new NFTManager();
    await nftManager.init();
  }
  
  if (!nftService) {
    nftService = new NFTService();
    await nftService.init();
  }
  
  if (!marketplaceService) {
    marketplaceService = new MarketplaceService();
    await marketplaceService.init();
  }
};

/**
 * Convert chain ID to ChainType
 */
const getChainType = (chainId: number): ChainType => {
  const chainMap: Record<number, ChainType> = {
    1: 'ethereum',
    137: 'polygon',
    43114: 'avalanche',
    42161: 'arbitrum',
    10: 'optimism',
    56: 'bsc',
    100: 'gnosis',
    250: 'fantom'
  };
  
  return chainMap[chainId] || 'ethereum';
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
        if (!nft.metadata?.attributes) return false;
        
        return attributeFilters.every(filter => {
          const attribute = nft.metadata?.attributes?.find(
            attr => attr.trait_type === filter.trait_type
          );
          
          return attribute && filter.values.includes(attribute.value);
        });
      });
    }
    
    // Apply price range filter
    if (priceRange && (priceRange.min || priceRange.max)) {
      filtered = filtered.filter(nft => {
        const price = nft.lastSalePrice || BigInt(0);
        
        if (priceRange.min && price < priceRange.min) return false;
        if (priceRange.max && price > priceRange.max) return false;
        
        return true;
      });
    }
    
    return filtered;
  }, [attributeFilters, priceRange]);
  
  /**
   * Sort NFTs based on selected criteria
   */
  const sortNFTs = useCallback((nfts: NFT[]): NFT[] => {
    const sorted = [...nfts];
    
    switch (sortBy) {
      case 'tokenId':
        sorted.sort((a, b) => {
          const aId = parseInt(a.tokenId) || 0;
          const bId = parseInt(b.tokenId) || 0;
          return aId - bId;
        });
        break;
        
      case 'rarity':
        // Calculate rarity scores
        sorted.forEach(nft => {
          if (nft.metadata?.attributes) {
            nft.rarityScore = calculateRarityScore(
              nft.metadata.attributes,
              attributeStats.current
            );
          }
        });
        
        sorted.sort((a, b) => (b.rarityScore || 50) - (a.rarityScore || 50));
        break;
        
      case 'price':
        sorted.sort((a, b) => {
          const aPrice = a.lastSalePrice || BigInt(0);
          const bPrice = b.lastSalePrice || BigInt(0);
          return aPrice > bPrice ? -1 : aPrice < bPrice ? 1 : 0;
        });
        break;
        
      case 'recent':
        sorted.sort((a, b) => {
          const aTime = a.lastTransferTime || 0;
          const bTime = b.lastTransferTime || 0;
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
    if (!nftService) return;
    
    try {
      const collectionData = await nftService.getCollection({
        contractAddress: params.contractAddress,
        chain
      });
      
      setCollection(collectionData);
      setTotalSupply(collectionData?.totalSupply);
    } catch (err) {
      console.error('Failed to fetch collection data:', err);
    }
  }, [params.contractAddress, chain]);
  
  /**
   * Build attribute statistics for rarity calculations
   */
  const buildAttributeStats = useCallback((nfts: NFT[]) => {
    const stats = new Map<string, Map<string | number, number>>();
    
    nfts.forEach(nft => {
      if (!nft.metadata?.attributes) return;
      
      nft.metadata.attributes.forEach(attr => {
        if (!stats.has(attr.trait_type)) {
          stats.set(attr.trait_type, new Map());
        }
        
        const traitMap = stats.get(attr.trait_type)!;
        const currentCount = traitMap.get(attr.value) || 0;
        traitMap.set(attr.value, currentCount + 1);
      });
    });
    
    attributeStats.current = stats;
  }, []);
  
  /**
   * Fetch NFTs from the collection
   */
  const fetchNFTs = useCallback(async (startOffset: number = 0) => {
    if (!enabled || !nftManager) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch NFTs from collection
      const nfts = await nftManager.getCollectionNFTs({
        contractAddress: params.contractAddress,
        chain,
        limit: pageSize,
        offset: startOffset,
        includeMetadata: true
      });
      
      // Update attribute statistics
      if (startOffset === 0) {
        buildAttributeStats(nfts);
      } else {
        buildAttributeStats([...data, ...nfts]);
      }
      
      // Apply filters and sorting
      const filteredNFTs = applyFilters(nfts);
      const sortedNFTs = sortNFTs(filteredNFTs);
      
      // Update state
      if (startOffset === 0) {
        setData(sortedNFTs);
      } else {
        setData(prev => [...prev, ...sortedNFTs]);
      }
      
      setHasMore(nfts.length === pageSize);
      setOffset(startOffset + nfts.length);
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
    const init = async () => {
      await initializeServices();
      await fetchCollectionData();
      await fetchNFTs(0);
    };
    
    if (enabled) {
      init();
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
    collection,
    totalSupply
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
  
  if (!nftManager) {
    throw new Error('NFT manager not initialized');
  }
  
  const chain = getChainType(params.chainId);
  const allNFTs: NFT[] = [];
  let offset = 0;
  const limit = 100;
  
  // Fetch all NFTs in batches
  while (true) {
    try {
      const batch = await nftManager.getCollectionNFTs({
        contractAddress: params.contractAddress,
        chain,
        limit,
        offset,
        includeMetadata: true
      });
      
      allNFTs.push(...batch);
      
      if (batch.length < limit) {
        break;
      }
      
      offset += limit;
    } catch (error) {
      console.error(`Failed to fetch NFTs at offset ${offset}:`, error);
      break;
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
  
  if (!nftService || !marketplaceService) {
    throw new Error('Services not initialized');
  }
  
  const chain = getChainType(chainId);
  
  // Get collection data
  const collection = await nftService.getCollection({
    contractAddress,
    chain
  });
  
  // Get marketplace stats
  const marketStats = await marketplaceService.getCollectionStats({
    contractAddress,
    chain
  });
  
  // Get all NFTs to build attribute statistics
  const nfts = await getNftsForCollection({ contractAddress, chainId });
  
  // Build attribute map
  const attributes = new Map<string, Map<string | number, number>>();
  nfts.forEach(nft => {
    if (!nft.metadata?.attributes) return;
    
    nft.metadata.attributes.forEach(attr => {
      if (!attributes.has(attr.trait_type)) {
        attributes.set(attr.trait_type, new Map());
      }
      
      const traitMap = attributes.get(attr.trait_type)!;
      const currentCount = traitMap.get(attr.value) || 0;
      traitMap.set(attr.value, currentCount + 1);
    });
  });
  
  return {
    totalSupply: collection?.totalSupply || nfts.length,
    owners: collection?.owners || 0,
    floorPrice: collection?.floorPrice,
    totalVolume: marketStats?.totalVolume,
    attributes
  };
}