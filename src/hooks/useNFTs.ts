import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { NFT, getOwnedNFTs } from '../utils/nft';

/**
 * React hook for fetching and managing the connected user’s NFTs.
 * Optionally filters by a specific NFT contract. Uses the shared
 * NFT utilities to detect token standard and collect metadata.
 *
 * @param contractAddress Optional NFT contract to filter results
 * @returns NFT list, loading state, last error and refresh helper
 */
export const useNFTs = (contractAddress?: string): {
    /** Array of user's NFTs */
    nfts: NFT[];
    /** Whether NFTs are currently loading */
    isLoading: boolean;
    /** Error message if fetch failed */
    error: string | null;
    /** Function to manually refresh NFTs */
    refreshNFTs: () => void;
} => {
    const { provider, address } = useWallet();
    const [nfts, setNfts] = useState<NFT[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load NFTs owned by the connected user, optionally filtered by contract.
     */
    const fetchNFTs = useCallback(async (): Promise<void> => {
        if (provider == null || address == null) return;

        try {
            setIsLoading(true);
            setError(null);

            const ownedNFTs = await getOwnedNFTs(provider, address, contractAddress || '');
            setNfts(ownedNFTs);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
            console.warn('Error fetching NFTs:', err);
        } finally {
            setIsLoading(false);
        }
    }, [provider, address, contractAddress]);

    useEffect(() => {
        fetchNFTs();
    }, [fetchNFTs]);

    /** Manually trigger a refresh of the NFT list. */
    const refreshNFTs = useCallback((): void => {
        fetchNFTs();
    }, [fetchNFTs]);

    return {
        nfts,
        isLoading,
        error,
        refreshNFTs
    };
};
