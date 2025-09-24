import { useState, useCallback, useEffect } from 'react';
import { useWallet } from './useWallet';
import { ListingMetadata, SearchFilters } from '../types/listing';
import { OmniProvider } from '../core/providers/OmniProvider';

/**
 * Return type for the `useListings` hook.
 */
interface UseListingsReturn {
    listings: ListingMetadata[];
    isLoading: boolean;
    error: string | null;
    totalResults: number;
    currentPage: number;
    searchListings: (filters: SearchFilters) => Promise<void>;
    getListing: (tokenId: string) => Promise<ListingMetadata | null>;
    refreshListings: () => Promise<void>;
}

/**
 * React hook for discovering and fetching marketplace listings.
 * Tries OmniProvider (P2P validator network) first and falls back to
 * the HTTP API. Exposes search, single fetch, and refresh helpers.
 *
 * @param contractAddress Marketplace NFT or listing contract address
 * @returns Listing data, loading state, pagination and helpers
 */
export const useListings = (contractAddress: string): UseListingsReturn => {
    const { provider: _provider } = useWallet();
    const [listings, setListings] = useState<ListingMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [omniProvider, setOmniProvider] = useState<OmniProvider | null>(null);
    
    // Initialize OmniProvider for marketplace data
    useEffect(() => {
        const initProvider = (): void => {
            try {
                const provider = new OmniProvider('marketplace-listings');
                setOmniProvider(provider);
            } catch (error: unknown) {
                console.error('Failed to initialize OmniProvider:', error);
            }
        };

        initProvider();
    }, []);

    const searchListings = useCallback(async (filters: SearchFilters): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            // Try OmniProvider first for P2P marketplace data
            if (omniProvider !== null) {
                try {
                    const result = await omniProvider.send('omni_searchListings', [{
                        contractAddress,
                        ...filters
                    }]);
                    
                    const resultData = result as {
                        listings?: ListingMetadata[];
                        total?: number;
                    } | null;
                    if (resultData !== null && resultData.listings !== undefined) {
                        setListings(resultData.listings);
                        setTotalResults(resultData.total ?? resultData.listings.length);
                        setCurrentPage(filters.page ?? 1);
                        return;
                    }
                } catch (error: unknown) {
                    console.warn('OmniProvider search failed, falling back to API:', error);
                }
            }

            // Fallback to direct API if OmniProvider not available
            const response = await fetch('/api/listings/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contractAddress,
                    filters,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to search listings');
            }

            const data = await response.json() as {
                listings: ListingMetadata[];
                total: number;
            };
            setListings(data.listings);
            setTotalResults(data.total);
            setCurrentPage(filters.page ?? 1);

        } catch (err: unknown) {
            console.error('Error searching listings:', err);
            setError(err instanceof Error ? err.message : 'Failed to search listings');
        } finally {
            setIsLoading(false);
        }
    }, [omniProvider, contractAddress]);

    const getListing = useCallback(async (tokenId: string): Promise<ListingMetadata | null> => {
        try {
            // Try OmniProvider first
            if (omniProvider !== null) {
                try {
                    const result = await omniProvider.send('omni_getListing', [contractAddress, tokenId]);
                    const resultData = result as {
                        listing?: ListingMetadata;
                    } | null;
                    if (resultData !== null && resultData.listing !== undefined) {
                        return resultData.listing;
                    }
                } catch (error: unknown) {
                    console.warn('OmniProvider get listing failed, falling back to API:', error);
                }
            }

            // Fallback to direct API
            const response = await fetch(`/api/listings/${contractAddress}/${tokenId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch listing');
            }

            const data = await response.json() as {
                listing: ListingMetadata;
            };
            return data.listing;

        } catch (err: unknown) {
            console.error('Error getting listing:', err);
            return null;
        }
    }, [omniProvider, contractAddress]);

    const refreshListings = useCallback(async (): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            // Try OmniProvider first
            if (omniProvider !== null) {
                try {
                    const result = await omniProvider.send('omni_refreshListings', [contractAddress]);
                    const resultData = result as {
                        listings?: ListingMetadata[];
                        total?: number;
                    } | null;
                    if (resultData !== null && resultData.listings !== undefined) {
                        setListings(resultData.listings);
                        setTotalResults(resultData.total ?? resultData.listings.length);
                        return;
                    }
                } catch (error: unknown) {
                    console.warn('OmniProvider refresh failed, falling back to API:', error);
                }
            }

            // Fallback to direct API
            const response = await fetch(`/api/listings/${contractAddress}/refresh`);

            if (!response.ok) {
                throw new Error('Failed to refresh listings');
            }

            const data = await response.json() as {
                listings: ListingMetadata[];
                total: number;
            };
            setListings(data.listings);
            setTotalResults(data.total);

        } catch (err: unknown) {
            console.error('Error refreshing listings:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh listings');
        } finally {
            setIsLoading(false);
        }
    }, [omniProvider, contractAddress]);

    return {
        listings,
        isLoading,
        error,
        totalResults,
        currentPage,
        searchListings,
        getListing,
        refreshListings,
    };
}; 
