/**
 * NFT Gallery Module
 * Provides functionality for fetching and displaying user's NFT collection
 */

import { useState, useEffect, useCallback } from 'react';
import { NFTManager, type MockNFT } from './mocks/NFTManager';
import { NFTService, type MockNFTCollection, type MockNFTMetadata } from './mocks/NFTService';
import { MarketplaceService, type MockListing } from './mocks/MarketplaceService';
import type { NFT, NFTCollection, NFTAttribute } from './types';
import type { ChainType } from '../keyring/BIP39Keyring';
import { keyringService } from '../keyring/KeyringService';
import { validateNFTMetadata } from '../../utils/nft';

/**
 * Gallery NFT data with enhanced metadata
 */
export interface GalleryNFT extends NFT {
  /** Floor price in native currency */
  floorPrice?: bigint;
  /** Whether NFT is listed for sale */
  isListed?: boolean;
  /** Listing price if listed */
  listingPrice?: bigint;
  /** Whether NFT is spam */
  isSpam?: boolean;
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
const initializeServices = (): void => {
  if (nftManager === null) {
    nftManager = new NFTManager();
  }
  
  if (nftService === null) {
    nftService = new NFTService();
  }
  
  if (marketplaceService === null) {
    marketplaceService = new MarketplaceService();
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
   * @param chain - Blockchain to fetch from
   * @param address - User wallet address
   * @param _offset - Pagination offset (unused in mock)
   * @returns Promise resolving to array of gallery NFTs
   */
  const fetchNFTsForChain = useCallback(async (
    chain: ChainType,
    address: string,
    _offset: number
  ): Promise<GalleryNFT[]> => {
    if (nftManager === null || nftService === null) {
      throw new Error('NFT services not initialized');
    }
    
    // Get NFTs from mock service
    const nfts: MockNFT[] = await nftManager.getNFTs(address);
    
    // Convert mock data to proper NFT format and add chain info
    const convertedNFTs: GalleryNFT[] = nfts.map((nft: MockNFT) => ({
      id: nft.id,
      contract_address: nft.contractAddress,
      token_id: nft.tokenId,
      chain: chain,
      type: 'ERC721' as NFT['type'],
      standard: 'ERC-721' as NFT['standard'],
      owner: nft.owner,
      name: nft.name,
      metadata: {
        name: nft.name,
        image: nft.image
      },
      isSpam: false, // Mock data is not spam
      isListed: false, // Default to not listed
      floorPrice: BigInt(0) // Default floor price
    }));
    
    // Filter out spam if requested
    let filteredNFTs = convertedNFTs;
    if (!includeSpam) {
      filteredNFTs = convertedNFTs.filter(nft => nft.isSpam !== true);
    }
    
    // Enhance with collection data if requested
    if (includeCollectionData && filteredNFTs.length > 0) {
      const enhancedNFTs: GalleryNFT[] = [];
      
      for (const nft of filteredNFTs) {
        try {
          // Get collection metadata from service
          const collectionData: MockNFTCollection[] = await nftService.getNFTCollections(address);
          const collection = collectionData.find((c: MockNFTCollection) => 
            c.address === nft.contract_address
          );
          
          // Check if listed on marketplace
          const listings: MockListing[] = marketplaceService !== null ? 
            await marketplaceService.getListings() : [];
          const listing = listings.find((l: MockListing) => l.nftId === nft.id);
          
          const galleryNft: GalleryNFT = {
            ...nft,
            ...(collection !== null && collection !== undefined && {
              collection: {
                id: collection.address,
                name: collection.name,
                floor_price: { value: 0, currency: 'ETH' }
              } as NFTCollection
            }),
            floorPrice: BigInt(0),
            isListed: listing !== undefined,
            ...(listing !== undefined && listing !== null && { listingPrice: BigInt(listing.price) })
          };
          enhancedNFTs.push(galleryNft);
        } catch {
          // If enhancement fails, add basic NFT
          enhancedNFTs.push(nft);
        }
      }
      
      return enhancedNFTs;
    }
    
    return filteredNFTs;
  }, [includeSpam, includeCollectionData]);
  
  /**
   * Fetch all NFTs across specified chains
   * @param offset - Pagination offset
   * @returns Promise that resolves when fetch completes
   */
  const fetchAllNFTs = useCallback(async (offset: number = 0): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize services
      initializeServices();
      
      // Get user address from keyring
      const activeAccount = keyringService.getActiveAccount();
      if (activeAccount === null || activeAccount === undefined) {
        throw new Error('No wallet connected');
      }
      const address = activeAccount.address;
      
      // Fetch NFTs from all chains in parallel
      const chainPromises = chains.map(chain => 
        fetchNFTsForChain(chain, address, offset).catch(err => {
          // Log error but don't throw - continue with other chains
          if (err instanceof Error) {
            console.error(`Failed to fetch NFTs from ${chain}:`, err.message);
          }
          return [] as GalleryNFT[];
        })
      );
      
      const nftsByChain = await Promise.all(chainPromises);
      const allNFTs = nftsByChain.flat();
      
      // Sort by latest activity or value
      const sortedNFTs = allNFTs.sort((a, b) => {
        // Prioritize listed NFTs
        if (a.isListed === true && b.isListed !== true) return -1;
        if (a.isListed !== true && b.isListed === true) return 1;
        
        // Then by floor price
        const aPrice = a.floorPrice ?? BigInt(0);
        const bPrice = b.floorPrice ?? BigInt(0);
        if (aPrice > bPrice) return -1;
        if (aPrice < bPrice) return 1;
        
        // Finally by token ID
        return b.token_id.localeCompare(a.token_id);
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
    void fetchAllNFTs(0);
  }, [fetchAllNFTs]);
  
  /**
   * Refetch function
   */
  const refetch = useCallback(async () => {
    setPage(0);
    await fetchAllNFTs(0);
  }, [fetchAllNFTs]);
  
  /**
   * Load more function
   * @returns Promise that resolves when load more completes
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (hasMore !== true || isLoading === true) return;
    
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
    includeCollectionData = true
  } = options;
  
  // Initialize services
  initializeServices();
  
  if (nftManager === null || nftService === null) {
    throw new Error('NFT services not initialized');
  }
  
  const allNFTs: GalleryNFT[] = [];
  
  // Fetch NFTs from each chain
  for (const chain of chains) {
    try {
      const nfts: MockNFT[] = await nftManager.getNFTs(address);
      
      // Convert mock data to proper NFT format
      const convertedNFTs: GalleryNFT[] = nfts.map((nft: MockNFT) => ({
        id: nft.id,
        contract_address: nft.contractAddress,
        token_id: nft.tokenId,
        chain: chain,
        type: 'ERC721' as NFT['type'],
        standard: 'ERC-721' as NFT['standard'],
        owner: nft.owner,
        name: nft.name,
        metadata: {
          name: nft.name,
          image: nft.image
        },
        isSpam: false,
        isListed: false,
        floorPrice: BigInt(0)
      }));
      
      // Filter and enhance NFTs
      let processedNFTs = convertedNFTs;
      if (!includeSpam) {
        processedNFTs = convertedNFTs.filter(nft => nft.isSpam !== true);
      }
      
      if (includeCollectionData) {
        for (const nft of processedNFTs) {
          try {
            const collectionData: MockNFTCollection[] = await nftService.getNFTCollections(address);
            const collection = collectionData.find((c: MockNFTCollection) => 
              c.address === nft.contract_address
            );
            
            const galleryNft: GalleryNFT = {
              ...nft,
              ...(collection !== null && collection !== undefined && {
                collection: {
                  id: collection.address,
                  name: collection.name,
                  floor_price: { value: 0, currency: 'ETH' }
                } as NFTCollection
              }),
              floorPrice: BigInt(0)
            };
            allNFTs.push(galleryNft);
          } catch {
            allNFTs.push(nft);
          }
        }
      } else {
        allNFTs.push(...processedNFTs);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch NFTs from ${chain}:`, error.message);
      }
    }
  }
  
  return allNFTs;
};

/**
 * Get NFT metadata directly from contract
 * @param contractAddress - NFT contract address
 * @param tokenId - Token ID
 * @param chain - Blockchain
 * @returns NFT metadata or null if not found
 */
export const getNFTMetadata = async (
  contractAddress: string,
  tokenId: string,
  chain: ChainType
): Promise<GalleryNFT | null> => {
  try {
    initializeServices();
    
    if (nftService === null) {
      throw new Error('NFT service not initialized');
    }
    
    // Get NFT metadata from service
    const metadata: MockNFTMetadata = await nftService.getNFTMetadata(contractAddress, tokenId);
    
    // Validate metadata
    if (!validateNFTMetadata(metadata)) {
      console.warn('Invalid NFT metadata:', metadata);
    }
    
    // Create GalleryNFT from metadata
    const nft: GalleryNFT = {
      id: `${contractAddress}-${tokenId}`,
      contract_address: contractAddress,
      token_id: tokenId,
      chain: chain,
      type: 'ERC721' as NFT['type'],
      standard: 'ERC-721' as NFT['standard'],
      owner: '', // Unknown owner from metadata only
      name: metadata.name,
      metadata: {
        name: metadata.name,
        ...(metadata.description !== undefined && metadata.description !== '' && { description: metadata.description }),
        ...(metadata.image !== undefined && metadata.image !== '' && { image: metadata.image }),
        ...(metadata.attributes !== undefined && Array.isArray(metadata.attributes) && { 
          attributes: metadata.attributes.filter((attr): attr is NFTAttribute => 
            attr !== null && 
            typeof attr === 'object' && 
            'trait_type' in attr && 
            'value' in attr
          )
        })
      },
      isSpam: false,
      isListed: false,
      floorPrice: BigInt(0)
    };
    
    return nft;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to get NFT metadata:', error.message);
    }
    return null;
  }
};