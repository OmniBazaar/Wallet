import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { NFT, getOwnedNFTs, getNFTMetadata } from '../utils/nft';

export const useNFTs = (contractAddress?: string) => {
    const { provider, address } = useWallet();
    const [nfts, setNfts] = useState<NFT[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchNFTs = useCallback(async () => {
        if (!provider || !address) return;

        try {
            setIsLoading(true);
            setError(null);

            const ownedNFTs = await getOwnedNFTs(provider, address, contractAddress || '');
            setNfts(ownedNFTs);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
            console.error('Error fetching NFTs:', err);
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