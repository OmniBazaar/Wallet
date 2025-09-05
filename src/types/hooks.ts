// import { BrowserProvider } from 'ethers'; // TODO: implement provider integration
import { TokenInfo } from './index';
// import { TransactionResponse } from 'ethers'; // TODO: implement transaction integration
// Use locally-declared ListingNode to avoid conflicts with listing.ts

/**
 * Result interface for the useTokenBalance hook
 */
export interface UseTokenBalanceResult {
    /**
     *
     */
    tokenInfo: TokenInfo | null;
    /**
     *
     */
    balance: string;
    /**
     *
     */
    formattedBalance: string;
    /**
     *
     */
    isLoading: boolean;
    /**
     *
     */
    error: string | null;
    /**
     *
     */
    refreshBalance: () => Promise<void>;
}

/**
 * Result interface for the useTokenTransfer hook
 */
export interface UseTokenTransferResult {
    /**
     *
     */
    transfer: (to: string, amount: string) => Promise<void>;
    /**
     *
     */
    isLoading: boolean;
    /**
     *
     */
    error: string | null;
}

/**
 * Result interface for the useTokenApproval hook
 */
export interface UseTokenApprovalResult {
    /**
     *
     */
    approve: (spender: string, amount: string) => Promise<void>;
    /**
     *
     */
    isLoading: boolean;
    /**
     *
     */
    error: string | null;
}

/**
 * Result interface for the useNFTs hook
 */
export interface UseNFTsResult {
    /**
     *
     */
    nfts: NFT[];
    /**
     *
     */
    isLoading: boolean;
    /**
     *
     */
    error: string | null;
    /**
     *
     */
    refresh: () => Promise<void>;
}

/**
 * Result interface for the useNFTTransfer hook
 */
export interface UseNFTTransferResult {
    /**
     *
     */
    transfer: (to: string, tokenId: string) => Promise<void>;
    /**
     *
     */
    isLoading: boolean;
    /**
     *
     */
    error: string | null;
}

/**
 * Result interface for the useListings hook
 */
export interface UseListingsResult {
    /**
     *
     */
    listings: ListingNode[];
    /**
     *
     */
    isLoading: boolean;
    /**
     *
     */
    error: string | null;
    /**
     *
     */
    refresh: () => Promise<void>;
    /**
     *
     */
    search: (filters: SearchFilters) => Promise<void>;
}

/**
 * Simplified NFT interface for React hooks
 */
export interface NFT {
    /**
     *
     */
    tokenId: string;
    /**
     *
     */
    name: string;
    /**
     *
     */
    description: string;
    /**
     *
     */
    image: string;
    /**
     *
     */
    owner: string;
    /**
     *
     */
    contractAddress: string;
}

/**
 * Search filter parameters for marketplace listings
 */
export interface SearchFilters {
    /**
     *
     */
    query?: string;
    /**
     *
     */
    category?: string;
    /**
     *
     */
    minPrice?: string;
    /**
     *
     */
    maxPrice?: string;
    /**
     *
     */
    sortBy?: 'price' | 'date' | 'popularity';
    /**
     *
     */
    sortOrder?: 'asc' | 'desc';
}

/**
 * Simplified listing node interface for React hooks
 * Note: This duplicates types/listing.ts - consider consolidation
 */
export interface ListingNode {
    /**
     *
     */
    id: string;
    /**
     *
     */
    title: string;
    /**
     *
     */
    description: string;
    /**
     *
     */
    price: string;
    /**
     *
     */
    category: string;
    /**
     *
     */
    seller: string;
    /**
     *
     */
    createdAt: string;
    /**
     *
     */
    updatedAt: string;
    /**
     *
     */
    status: 'active' | 'sold' | 'cancelled';
    /**
     *
     */
    images: string[];
} 
