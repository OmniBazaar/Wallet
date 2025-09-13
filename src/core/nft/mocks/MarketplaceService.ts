/**
 * Mock Marketplace Service
 * Provides mock marketplace functionality for NFT listings
 */

/** Mock listing structure */
export interface MockListing {
  /** Listing ID */
  id: string;
  /** Associated NFT ID */
  nftId: string;
  /** Seller address */
  seller: string;
  /** Price in wei */
  price: string;
  /** Currency symbol */
  currency: string;
  /** Listing status */
  status: string;
}

/** Create listing parameters */
export interface CreateListingParams {
  /** NFT to list */
  nftId: string;
  /** Price in wei */
  price: string;
  /** Currency */
  currency: string;
}

/** Create listing result */
export interface CreateListingResult {
  /** Generated listing ID */
  listingId: string;
}

/** Purchase result */
export interface PurchaseResult {
  /** Transaction hash */
  hash: string;
}

/**
 * Mock Marketplace Service implementation
 */
export class MarketplaceService {
  /**
   * Get NFT listings
   * @param _filter - Optional filter (unused in mock)
   * @returns Promise resolving to array of mock listings
   */
  getListings(_filter?: unknown): Promise<MockListing[]> {
    return Promise.resolve([
      {
        id: 'listing-1',
        nftId: 'nft-1',
        seller: '0x1234567890123456789012345678901234567890',
        price: '1000000000000000000', // 1 ETH
        currency: 'ETH',
        status: 'active'
      }
    ]);
  }

  /**
   * Create a new NFT listing
   * @param _params - Listing parameters (unused in mock)
   * @returns Promise resolving to listing ID
   */
  createListing(_params: CreateListingParams): Promise<CreateListingResult> {
    return Promise.resolve({ listingId: 'listing-' + Date.now().toString() });
  }

  /**
   * Purchase an NFT from a listing
   * @param _listingId - Listing ID (unused in mock)
   * @returns Promise resolving to transaction hash
   */
  purchaseNFT(_listingId: string): Promise<PurchaseResult> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateSecureMockTxHash } = require('../../utils/secure-random') as { generateSecureMockTxHash: () => string };
    return Promise.resolve({ hash: generateSecureMockTxHash() });
  }
}