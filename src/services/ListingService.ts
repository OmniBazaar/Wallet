/**
 * ListingService - Marketplace Listing Service
 * 
 * Provides marketplace listing operations for creating,
 * managing, and searching marketplace listings.
 */

import { OmniValidatorClient, createOmniValidatorClient } from '../../../Validator/dist/client/index';

/** Listing data structure */
export interface Listing {
  /** Unique listing ID */
  id?: string;
  /** Listing title */
  title: string;
  /** Listing description */
  description: string;
  /** Price in XOM */
  price: string;
  /** Seller address */
  seller: string;
  /** Category */
  category: string;
  /** Image URLs */
  images: string[];
  /** Creation timestamp */
  createdAt?: number;
  /** Status */
  status?: 'active' | 'sold' | 'cancelled';
}

/**
 * Service for managing marketplace listings
 */
export class ListingService {
  private isInitialized = false;
  private marketplaceService?: P2PMarketplaceService;
  private listingNodeService?: ListingNodeService;

  /**
   * Creates a new ListingService instance
   */
  constructor() {}

  /**
   * Initialize the listing service
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Initialize P2P marketplace service
      const { MasterMerkleEngine } = await import('../../../Validator/src/engines/MasterMerkleEngine');
      const merkleEngine = new MasterMerkleEngine();
      
      this.marketplaceService = new P2PMarketplaceService(
        merkleEngine,
        { port: 4501, validateWithBlockchain: false }
      );
      
      // Initialize listing node service
      this.listingNodeService = new ListingNodeService(merkleEngine);
      
      // Start services
      await this.marketplaceService.start();
      await this.listingNodeService.start();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ListingService:', error);
      throw error;
    }
  }

  /**
   * Create a new marketplace listing
   * @param listing Listing data
   * @returns Created listing with generated ID
   */
  async createListing(listing: Listing): Promise<Listing> {
    if (!this.marketplaceService) {
      throw new Error('ListingService not initialized');
    }
    
    // Convert to marketplace listing format
    const marketplaceListing: MarketplaceListing = {
      id: '', // Will be generated
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: 'XOM',
      seller: listing.seller,
      buyer: '',
      category: listing.category,
      subcategory: '',
      tags: [],
      images: listing.images,
      condition: 'new',
      location: {
        country: '',
        city: '',
        postalCode: ''
      },
      shipping: {
        domestic: true,
        international: false,
        price: '0',
        estimatedDays: 7
      },
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      views: 0,
      likes: 0,
      isNFT: false,
      metadata: {}
    };
    
    // Create listing through P2P marketplace
    const result = await this.marketplaceService.createListing(marketplaceListing);
    
    // Return in wallet format
    return {
      id: result.id,
      title: result.title,
      description: result.description,
      price: result.price,
      seller: result.seller,
      category: result.category,
      images: result.images,
      createdAt: result.createdAt,
      status: result.status as 'active' | 'sold' | 'cancelled'
    };
  }

  /**
   * Get all listings
   * @returns Array of listings
   */
  async getListings(): Promise<Listing[]> {
    if (!this.marketplaceService) {
      throw new Error('ListingService not initialized');
    }
    
    // Search for all active listings
    const results = await this.marketplaceService.searchListings({
      status: 'active'
    });
    
    // Convert to wallet format
    return results.map(listing => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      seller: listing.seller,
      category: listing.category,
      images: listing.images,
      createdAt: listing.createdAt,
      status: listing.status as 'active' | 'sold' | 'cancelled'
    }));
  }

  /**
   * Clear any cached data
   * @returns Promise that resolves when cache is cleared
   */
  async clearCache(): Promise<void> {
    // console.log('ListingService cache cleared');
  }

  /**
   * Clean up resources and reset service
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    if (this.marketplaceService) {
      await this.marketplaceService.stop();
    }
    if (this.listingNodeService) {
      await this.listingNodeService.stop();
    }
    this.isInitialized = false;
  }
}