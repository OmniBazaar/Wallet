// import { BrowserProvider } from 'ethers'; // TODO: implement provider integration
import { TokenInfo } from './index';
// import { TransactionResponse } from 'ethers'; // TODO: implement transaction integration
// Use locally-declared ListingNode to avoid conflicts with listing.ts

/**
 * Result interface for the useTokenBalance hook
 */
export interface UseTokenBalanceResult {
    /** Token information if found, null if not available */
    tokenInfo: TokenInfo | null;
    /** Raw balance amount as string */
    balance: string;
    /** Human-readable formatted balance with symbol */
    formattedBalance: string;
    /** Whether the balance is currently being loaded */
    isLoading: boolean;
    /** Error message if balance loading failed */
    error: string | null;
    /** Function to manually refresh the balance */
    refreshBalance: () => Promise<void>;
}

/**
 * Result interface for the useTokenTransfer hook
 */
export interface UseTokenTransferResult {
    /** Function to initiate a token transfer */
    transfer: (to: string, amount: string) => Promise<void>;
    /** Whether a transfer is currently being processed */
    isLoading: boolean;
    /** Error message if transfer failed */
    error: string | null;
}

/**
 * Result interface for the useTokenApproval hook
 */
export interface UseTokenApprovalResult {
    /** Function to approve spending allowance for a spender */
    approve: (spender: string, amount: string) => Promise<void>;
    /** Whether an approval is currently being processed */
    isLoading: boolean;
    /** Error message if approval failed */
    error: string | null;
}

/**
 * Result interface for the useNFTs hook
 */
export interface UseNFTsResult {
    /** Array of NFTs owned by the user */
    nfts: NFT[];
    /** Whether NFTs are currently being loaded */
    isLoading: boolean;
    /** Error message if NFT loading failed */
    error: string | null;
    /** Function to manually refresh the NFT list */
    refresh: () => Promise<void>;
}

/**
 * Result interface for the useNFTTransfer hook
 */
export interface UseNFTTransferResult {
    /** Function to initiate an NFT transfer */
    transfer: (to: string, tokenId: string) => Promise<void>;
    /** Whether a transfer is currently being processed */
    isLoading: boolean;
    /** Error message if transfer failed */
    error: string | null;
}

/**
 * Result interface for the useListings hook
 */
export interface UseListingsResult {
    /** Array of marketplace listings */
    listings: ListingNode[];
    /** Whether listings are currently being loaded */
    isLoading: boolean;
    /** Error message if listing loading failed */
    error: string | null;
    /** Function to manually refresh the listings */
    refresh: () => Promise<void>;
    /** Function to search listings with filters */
    search: (filters: SearchFilters) => Promise<void>;
}

/**
 * Simplified NFT interface for React hooks
 */
export interface NFT {
    /** Unique token identifier */
    tokenId: string;
    /** NFT display name */
    name: string;
    /** NFT description text */
    description: string;
    /** URL or IPFS hash for the NFT image */
    image: string;
    /** Address of the current owner */
    owner: string;
    /** Contract address where the NFT is minted */
    contractAddress: string;
}

/**
 * Search filter parameters for marketplace listings
 */
export interface SearchFilters {
    /** Search query text */
    query?: string;
    /** Category filter */
    category?: string;
    /** Minimum price filter */
    minPrice?: string;
    /** Maximum price filter */
    maxPrice?: string;
    /** Field to sort results by */
    sortBy?: 'price' | 'date' | 'popularity';
    /** Sort order direction */
    sortOrder?: 'asc' | 'desc';
}

/**
 * Simplified listing node interface for React hooks
 * Note: This duplicates types/listing.ts - consider consolidation
 */
export interface ListingNode {
    /** Unique listing identifier */
    id: string;
    /** Listing title */
    title: string;
    /** Detailed description of the item */
    description: string;
    /** Price in the listing currency */
    price: string;
    /** Item category */
    category: string;
    /** Seller's address or identifier */
    seller: string;
    /** Timestamp when listing was created */
    createdAt: string;
    /** Timestamp when listing was last updated */
    updatedAt: string;
    /** Current status of the listing */
    status: 'active' | 'sold' | 'cancelled';
    /** Array of image URLs for the listing */
    images: string[];
} 
