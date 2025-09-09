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
  const fetchNFTs = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get NFT service instance
      const nftService = NFTService.getInstance();

      // Try to get NFTs for the current active account first
      let walletNFTs: unknown[];
      try {
        walletNFTs = await nftService.getActiveAccountNFTs();
      } catch (err: unknown) {
        // If no active account, we'll get empty results - that's ok
        walletNFTs = [];
      }

      // Convert WalletNFT format to NFTItem format if needed
      const convertedNFTs: NFTItem[] = walletNFTs.map((nftUnknown: unknown) => {
        const nft = nftUnknown as {
          id?: string;
          tokenId?: string | number;
          name?: string;
          description?: string;
          image?: string;
          imageUrl?: string;
          animationUrl?: string;
          animation_url?: string;
          externalUrl?: string;
          external_url?: string;
          attributes?: unknown[];
          contract?: string;
          contractAddress?: string;
          tokenStandard?: string;
          blockchain?: string;
          chain?: string;
          owner?: string;
          creator?: string;
          royalties?: unknown;
          metadata?: {
            name?: string;
            description?: string;
            image?: string;
            attributes?: unknown[];
          };
          isListed?: boolean;
          listingId?: string;
          price?: string;
          currency?: string;
          marketplaceUrl?: string;
          ipfsHash?: string;
          metadataUri?: string;
          tokenURI?: string;
        };

        return {
          id: nft.id ?? `${nft.contractAddress ?? 'unknown'}_${nft.tokenId ?? '0'}`,
          tokenId: nft.tokenId?.toString() ?? '0',
          name: nft.name ?? nft.metadata?.name ?? `Token #${nft.tokenId ?? '0'}`,
          description: nft.description ?? nft.metadata?.description ?? '',
          image: nft.image ?? nft.metadata?.image ?? '',
          imageUrl: nft.imageUrl ?? nft.image ?? nft.metadata?.image ?? '',
          ...(nft.animationUrl !== undefined && { animationUrl: nft.animationUrl }),
          ...(nft.animation_url !== undefined && { animationUrl: nft.animation_url }),
          ...(nft.externalUrl !== undefined && { externalUrl: nft.externalUrl }),
          ...(nft.external_url !== undefined && { externalUrl: nft.external_url }),
          attributes: (nft.attributes ?? nft.metadata?.attributes ?? []).map((attr: unknown) => {
            const attrObj = attr as { trait_type?: string; value?: unknown };
            return {
              trait_type: attrObj.trait_type ?? 'Unknown',
              value: (typeof attrObj.value === 'number' ? attrObj.value : String(attrObj.value ?? ''))
            };
          }),
          contract: nft.contract ?? nft.contractAddress?.slice(0, 10) ?? 'Unknown',
          contractAddress: nft.contractAddress ?? '',
          tokenStandard: (nft.tokenStandard === 'ERC721' || nft.tokenStandard === 'ERC1155' || nft.tokenStandard === 'SPL') ? nft.tokenStandard : 'ERC721' as const,
          blockchain: nft.blockchain ?? nft.chain ?? 'ethereum',
          owner: nft.owner ?? '',
          ...(nft.creator !== undefined && { creator: nft.creator }),
          ...(nft.royalties !== undefined && typeof nft.royalties === 'number' && { royalties: nft.royalties }),
          ...(nft.metadata !== undefined && { 
            metadata: {
              ...nft.metadata,
              attributes: (nft.metadata.attributes ?? []).map((attr: unknown) => {
                const attrObj = attr as { trait_type?: string; value?: unknown };
                return {
                  trait_type: attrObj.trait_type ?? 'Unknown',
                  value: (typeof attrObj.value === 'number' ? attrObj.value : String(attrObj.value ?? ''))
                };
              })
            } 
          }),
          // Optional marketplace fields
          ...(nft.isListed !== undefined && { isListed: nft.isListed }),
          ...(nft.listingId !== undefined && { listingId: nft.listingId }),
          ...(nft.price !== undefined && { price: nft.price }),
          ...(nft.currency !== undefined && { currency: nft.currency }),
          ...(nft.marketplaceUrl !== undefined && { marketplaceUrl: nft.marketplaceUrl }),
          ...(nft.ipfsHash !== undefined && { ipfsHash: nft.ipfsHash }),
          ...(nft.metadataUri !== undefined && { metadataUri: nft.metadataUri }),
          ...(nft.tokenURI !== undefined && { metadataUri: nft.tokenURI })
        };
      });

      // Filter by contract address if specified
      const filteredNFTs = contractAddress !== undefined
        ? convertedNFTs.filter(nft => 
            nft.contractAddress.toLowerCase() === contractAddress.toLowerCase()
          )
        : convertedNFTs;

      setNFTs(filteredNFTs);
      setIsLoading(false);

    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error?.message ?? 'Failed to fetch NFTs';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [contractAddress]);

  /**
   * Refetch NFTs (exposed function for manual refresh)
   */
  const refetch = useCallback(async (): Promise<void> => {
    await fetchNFTs();
  }, [fetchNFTs]);

  // Initial load
  useEffect(() => {
    void fetchNFTs();
  }, [fetchNFTs]);

  return {
    nfts,
    isLoading,
    error,
    refetch
  };
};