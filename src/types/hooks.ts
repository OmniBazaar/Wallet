import { BrowserProvider } from 'ethers';
import { TokenInfo } from './index';
import { TransactionResponse } from 'ethers';
import { ListingNode } from './listing';

export interface UseTokenBalanceResult {
    tokenInfo: TokenInfo | null;
    balance: string;
    formattedBalance: string;
    isLoading: boolean;
    error: string | null;
    refreshBalance: () => Promise<void>;
}

export interface UseTokenTransferResult {
    transfer: (to: string, amount: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export interface UseTokenApprovalResult {
    approve: (spender: string, amount: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export interface UseNFTsResult {
    nfts: NFT[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export interface UseNFTTransferResult {
    transfer: (to: string, tokenId: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export interface UseListingsResult {
    listings: ListingNode[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    search: (filters: SearchFilters) => Promise<void>;
}

export interface NFT {
    tokenId: string;
    name: string;
    description: string;
    image: string;
    owner: string;
    contractAddress: string;
}

export interface SearchFilters {
    query?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sortBy?: 'price' | 'date' | 'popularity';
    sortOrder?: 'asc' | 'desc';
}

export interface ListingNode {
    id: string;
    title: string;
    description: string;
    price: string;
    category: string;
    seller: string;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'sold' | 'cancelled';
    images: string[];
} 