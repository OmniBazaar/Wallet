/**
 * NFT Management Hook
 * 
 * Provides NFT fetching and management functionality using the NFTService
 * to retrieve NFTs from various providers and blockchains.
 */

import { useState, useEffect, useCallback } from 'react';
import { NFTService } from '../core/nft/NFTService';
import type { NFTItem } from '../types/nft';

/** NFT hook return type */
interface NFTHook {
  nfts: NFTItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for NFT management and fetching
 * @param contractAddress - Optional contract address to filter NFTs
 * @returns NFT data and management functions
 */
export const useNFTs = (contractAddress?: string): NFTHook => {
  const [nfts, setNFTs] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch NFTs from the NFTService
   */
  const fetchNFTs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get NFT service instance
      const nftService = NFTService.getInstance();

      // Try to get NFTs for the current active account first
      let walletNFTs;
      try {
        walletNFTs = await nftService.getActiveAccountNFTs();
      } catch (err) {
        // If no active account, we'll get empty results - that's ok
        walletNFTs = [];
      }

      // Convert WalletNFT format to NFTItem format if needed
      const convertedNFTs: NFTItem[] = walletNFTs.map((nft: any) => ({
        id: nft.id || `${nft.contractAddress}_${nft.tokenId}`,
        tokenId: nft.tokenId?.toString() || '0',
        name: nft.name || nft.metadata?.name || `Token #${nft.tokenId}`,
        description: nft.description || nft.metadata?.description || '',
        image: nft.image || nft.metadata?.image || '',
        imageUrl: nft.imageUrl || nft.image || nft.metadata?.image,
        animationUrl: nft.animationUrl || nft.animation_url,
        externalUrl: nft.externalUrl || nft.external_url,
        attributes: nft.attributes || nft.metadata?.attributes || [],
        contract: nft.contract || nft.contractAddress?.slice(0, 10) || 'Unknown',
        contractAddress: nft.contractAddress || '',
        tokenStandard: (nft.tokenStandard) || 'ERC721',
        blockchain: nft.blockchain || nft.chain || 'ethereum',
        owner: nft.owner || '',
        creator: nft.creator,
        royalties: nft.royalties,
        metadata: nft.metadata,
        // Optional marketplace fields
        isListed: nft.isListed,
        listingId: nft.listingId,
        price: nft.price,
        currency: nft.currency,
        marketplaceUrl: nft.marketplaceUrl,
        ipfsHash: nft.ipfsHash,
        metadataUri: nft.metadataUri || nft.tokenURI
      }));

      // Filter by contract address if specified
      const filteredNFTs = contractAddress 
        ? convertedNFTs.filter(nft => 
            nft.contractAddress.toLowerCase() === contractAddress.toLowerCase()
          )
        : convertedNFTs;

      setNFTs(filteredNFTs);
      setIsLoading(false);

    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch NFTs';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Error fetching NFTs:', err);
    }
  }, [contractAddress]);

  /**
   * Refetch NFTs (exposed function for manual refresh)
   */
  const refetch = useCallback(async () => {
    await fetchNFTs();
  }, [fetchNFTs]);

  // Initial load
  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  return {
    nfts,
    isLoading,
    error,
    refetch
  };
};