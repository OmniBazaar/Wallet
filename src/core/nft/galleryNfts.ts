/**
 * NFT Gallery Module
 * Provides functionality for fetching and displaying user's NFT collection
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { NFTManager } from '../../../../../Bazaar/src/services/nft/NFTManager';
import { NFTService } from '../../../../../Bazaar/src/services/nft/NFTService';
import { MarketplaceService } from '../../../../../Bazaar/src/services/MarketplaceService';
import type { NFT, NFTCollection } from './types';
import type { ChainType } from '../keyring/BIP39Keyring';
import { providerManager } from '../providers/ProviderManager';
import { parseTokenURI, validateNFTMetadata } from '../../utils/nft';

/**
 * Gallery NFT data with enhanced metadata
 */
export interface GalleryNFT extends NFT {
  /** Floor price in native currency */
  floorPrice?: bigint;
  /** Collection details */
  collection?: NFTCollection;
  /** Whether NFT is listed for sale */
  isListed?: boolean;
  /** Listing price if listed */
  listingPrice?: bigint;
}

/**
 * Options for fetching gallery NFTs
 */
export interface GalleryNFTsOptions {
  /** Chains to fetch NFTs from */
  chains?: ChainType[];
  /** Whether to include spam/low-value NFTs */
  includeSpam?: boolean;
  /** Page size for pagination */
  pageSize?: number;
  /** Whether to fetch collection metadata */
  includeCollectionData?: boolean;
}

/**
 * Result of gallery NFT fetch
 */
export interface GalleryNFTsResult {
  /** Array of NFTs */
  data: GalleryNFT[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count across all chains */
  totalCount: number;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Load more function for pagination */
  loadMore: () => Promise<void>;
  /** Whether more NFTs are available */
  hasMore: boolean;
}

/** NFT manager instance */
let nftManager: NFTManager | null = null;

/** NFT service instance */
let nftService: NFTService | null = null;

/** Marketplace service instance */
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
 * React hook for fetching and managing gallery NFTs
 * @param options - Options for fetching NFTs
 * @returns Gallery NFTs result
 */
export const useGalleryNFTs = (options: GalleryNFTsOptions = {}): GalleryNFTsResult => {
  const [data, setData] = useState<GalleryNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const {
    chains = ['ethereum', 'polygon', 'avalanche', 'arbitrum', 'optimism'] as ChainType[],
    includeSpam = false,
    pageSize = 50,
    includeCollectionData = true
  } = options;
  
  /**
   * Fetch NFTs for a single chain
   */
  const fetchNFTsForChain = useCallback(async (
    chain: ChainType,
    address: string,
    offset: number
  ): Promise<GalleryNFT[]> => {
    if (!nftManager || !nftService) {
      throw new Error('NFT services not initialized');
    }
    
    // Get NFTs from blockchain
    const nfts = await nftManager.getUserNFTs({
      address,
      chain,
      limit: pageSize,
      offset,
      includeMetadata: true
    });
    
    // Filter out spam if requested
    let filteredNFTs = nfts;
    if (!includeSpam) {
      filteredNFTs = nfts.filter(nft => !nft.isSpam);
    }
    
    // Enhance with collection data if requested
    if (includeCollectionData && filteredNFTs.length > 0) {
      const enhancedNFTs: GalleryNFT[] = [];
      
      for (const nft of filteredNFTs) {
        try {
          // Get collection data
          const collection = await nftService.getCollection({
            contractAddress: nft.contractAddress,
            chain
          });
          
          // Check if listed on marketplace
          const listing = marketplaceService ? await marketplaceService.getListingByTokenId({
            contractAddress: nft.contractAddress,
            tokenId: nft.tokenId,
            chain
          }) : null;
          
          enhancedNFTs.push({
            ...nft,
            collection,
            floorPrice: collection?.floorPrice,
            isListed: !!listing,
            listingPrice: listing?.price
          } as GalleryNFT);
        } catch {
          // If enhancement fails, add basic NFT
          enhancedNFTs.push(nft as GalleryNFT);
        }
      }
      
      return enhancedNFTs;
    }
    
    return filteredNFTs as GalleryNFT[];
  }, [includeSpam, pageSize, includeCollectionData]);
  
  /**
   * Fetch all NFTs across specified chains
   */
  const fetchAllNFTs = useCallback(async (offset: number = 0) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize services
      await initializeServices();
      
      // Get user address
      const address = await providerManager.getAddress();
      if (!address) {
        throw new Error('No wallet connected');
      }
      
      // Fetch NFTs from all chains in parallel
      const chainPromises = chains.map(chain => 
        fetchNFTsForChain(chain, address, offset).catch(err => {
          console.error(`Failed to fetch NFTs from ${chain}:`, err);
          return [];
        })
      );
      
      const nftsByChain = await Promise.all(chainPromises);
      const allNFTs = nftsByChain.flat();
      
      // Sort by latest activity or value
      const sortedNFTs = allNFTs.sort((a, b) => {
        // Prioritize listed NFTs
        if (a.isListed && !b.isListed) return -1;
        if (!a.isListed && b.isListed) return 1;
        
        // Then by floor price
        const aPrice = a.floorPrice || BigInt(0);
        const bPrice = b.floorPrice || BigInt(0);
        if (aPrice > bPrice) return -1;
        if (aPrice < bPrice) return 1;
        
        // Finally by token ID
        return b.tokenId.localeCompare(a.tokenId);
      });
      
      if (offset === 0) {
        setData(sortedNFTs);
      } else {
        setData(prev => [...prev, ...sortedNFTs]);
      }
      
      setTotalCount(allNFTs.length);
      setHasMore(allNFTs.length === chains.length * pageSize);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch NFTs'));
    } finally {
      setIsLoading(false);
    }
  }, [chains, fetchNFTsForChain, pageSize]);
  
  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchAllNFTs(0);
  }, []); // Only run on mount
  
  /**
   * Refetch function
   */
  const refetch = useCallback(async () => {
    setPage(0);
    await fetchAllNFTs(0);
  }, [fetchAllNFTs]);
  
  /**
   * Load more function
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchAllNFTs(nextPage * pageSize);
  }, [page, hasMore, isLoading, pageSize, fetchAllNFTs]);
  
  return {
    data,
    isLoading,
    error,
    totalCount,
    refetch,
    loadMore,
    hasMore
  };
};

/**
 * Non-hook function to get gallery NFTs
 * @param address - User address
 * @param options - Fetch options
 * @returns Promise resolving to array of gallery NFTs
 */
export const getGalleryNFTs = async (
  address: string,
  options: GalleryNFTsOptions = {}
): Promise<GalleryNFT[]> => {
  const {
    chains = ['ethereum', 'polygon', 'avalanche', 'arbitrum', 'optimism'] as ChainType[],
    includeSpam = false,
    pageSize = 50,
    includeCollectionData = true
  } = options;
  
  // Initialize services
  await initializeServices();
  
  if (!nftManager || !nftService) {
    throw new Error('NFT services not initialized');
  }
  
  const allNFTs: GalleryNFT[] = [];
  
  // Fetch NFTs from each chain
  for (const chain of chains) {
    try {
      const nfts = await nftManager.getUserNFTs({
        address,
        chain,
        limit: pageSize,
        offset: 0,
        includeMetadata: true
      });
      
      // Filter and enhance NFTs
      let processedNFTs = nfts;
      if (!includeSpam) {
        processedNFTs = nfts.filter(nft => !nft.isSpam);
      }
      
      if (includeCollectionData) {
        for (const nft of processedNFTs) {
          try {
            const collection = await nftService.getCollection({
              contractAddress: nft.contractAddress,
              chain
            });
            
            allNFTs.push({
              ...nft,
              collection,
              floorPrice: collection?.floorPrice
            } as GalleryNFT);
          } catch {
            allNFTs.push(nft as GalleryNFT);
          }
        }
      } else {
        allNFTs.push(...(processedNFTs as GalleryNFT[]));
      }
    } catch (error) {
      console.error(`Failed to fetch NFTs from ${chain}:`, error);
    }
  }
  
  return allNFTs;
};

/**
 * Get NFT metadata directly from contract
 * @param contractAddress - NFT contract address
 * @param tokenId - Token ID
 * @param chain - Blockchain
 * @returns NFT metadata
 */
export const getNFTMetadata = async (
  contractAddress: string,
  tokenId: string,
  chain: ChainType
): Promise<GalleryNFT | null> => {
  try {
    await initializeServices();
    
    if (!nftManager) {
      throw new Error('NFT manager not initialized');
    }
    
    // Get NFT from blockchain
    const nft = await nftManager.getNFT({
      contractAddress,
      tokenId,
      chain
    });
    
    if (!nft) {
      return null;
    }
    
    // Validate metadata
    if (!validateNFTMetadata(nft.metadata)) {
      console.warn('Invalid NFT metadata:', nft.metadata);
    }
    
    return nft as GalleryNFT;
  } catch (error) {
    console.error('Failed to get NFT metadata:', error);
    return null;
  }
};