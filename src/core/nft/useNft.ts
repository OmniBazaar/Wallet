import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';

import { fetchNft } from '~/core/network/nfts';
import { createQueryKey } from '~/core/react-query';
import { ChainId } from '~/core/types/chains';
import { UniqueAsset } from '~/core/types/nfts';

/**
 * Hook to fetch NFT data
 * @param nftIdentifier NFT identification parameters
 * @param nftIdentifier.contractAddress NFT contract address
 * @param nftIdentifier.chainId Chain ID where NFT exists
 * @param nftIdentifier.tokenId Token ID of the NFT
 * @param options Query options
 * @param options.initialData Initial NFT data
 * @returns Query result for NFT data
 */
export function useNft(
  {
    contractAddress,
    chainId,
    tokenId,
  }: {
    /** NFT contract address */
    contractAddress: Address;
    /** Chain ID where NFT exists */
    chainId: ChainId;
    /** Token ID of the NFT */
    tokenId: string;
  },
  { initialData }: {
    /** Initial NFT data for the query */
    initialData: UniqueAsset;
  },
): unknown {
  return useQuery({
    queryKey: createQueryKey(
      'nft',
      { contractAddress, chainId, tokenId },
      { persisterVersion: 1 },
    ),
    queryFn: ({ queryKey }) => fetchNft(queryKey[0]),
    initialData,
    initialDataUpdatedAt: initialData != null ? Date.now() : 0,
    enabled: contractAddress != null && chainId != null && tokenId != null,
    // TODO: restore this when we find a SimpleHash replacement
    // retry: 3,
    staleTime: Infinity, // Keep data in cache indefinitely
    gcTime: Infinity, // Keep data in cache indefinitely
  });
}
