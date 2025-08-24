import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { NFT, getOwnedNFTs } from '../utils/nft';

/**
 * Hook for fetching and managing user's NFTs
 * @param contractAddress Optional contract address to filter NFTs
 * @returns NFT data and loading state
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

    const fetchNFTs = useCallback(async () => {
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

    const refreshNFTs = useCallback(() => {
        fetchNFTs();
    }, [fetchNFTs]);

    return {
        nfts,
        isLoading,
        error,
        refreshNFTs
    };
};
