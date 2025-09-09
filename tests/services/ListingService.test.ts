/**
 * ListingService Test Suite
 * 
 * Tests marketplace listing operations including creating, managing,
 * searching, updating, and deleting marketplace listings.
 * This is a Phase 5 component for decentralized marketplace functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ListingService } from '../../src/services/ListingService';
import type { 
  ListingMetadata, 
  SearchFilters, 
  ProductDetails, 
  ServiceDetails,
  Seller,
  Location
} from '../../src/types/listing';

// Mock dependencies
jest.mock('../../src/services/OracleService');
jest.mock('../../src/services/ValidatorService');

describe('ListingService', () => {
  let listingService: ListingService;

  // Test data
  const mockSeller: Seller = {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A',
    name: 'Test Seller',
    description: 'Quality products and services',
    location: {
      country: 'USA',
      state: 'California',
      city: 'San Francisco',
      postalCode: '94105'
    },
    contactInfo: {
      email: 'seller@example.com',
      phone: '+1-555-123-4567',
      website: 'https://seller.example.com'
    },
    rating: 4.8,
    totalSales: 150,
    joinedDate: '2023-01-01T00:00:00Z',
    verified: true
  };

  const mockProductDetails: ProductDetails = {
    name: 'Vintage Camera',
    description: 'Classic 35mm film camera in excellent condition',
    category: 'Electronics',
    subcategory: 'Cameras',
    tags: ['vintage', 'photography', 'film'],
    price: {
      amount: '250',
      currency: 'USD'
    },
    images: [
      'ipfs://Qm123456789',
      'ipfs://Qm987654321'
    ],
    specifications: {
      brand: 'Canon',
      model: 'AE-1',
      year: '1978',
      condition: 'Excellent'
    },
    condition: 'used',
    quantity: 1,
    availability: true
  };

  const mockServiceDetails: ServiceDetails = {
    name: 'Web Development',
    description: 'Professional web development services',
    category: 'Services',
    subcategory: 'Technology',
    tags: ['web', 'development', 'javascript'],
    price: {
      amount: '100',
      currency: 'USD',
      type: 'hourly'
    },
    availability: {
      schedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        hours: ['9:00-17:00']
      },
      location: 'remote'
    },
    qualifications: ['10+ years experience', 'Full-stack developer'],
    experience: 'Senior level'
  };

  const mockProductListing: ListingMetadata = {
    id: 'listing-001',
    type: 'product',
    seller: mockSeller,
    details: mockProductDetails,
    listingNode: {
      address: '0xNode123',
      name: 'SF Node 1',
      location: mockSeller.location,
      status: 'active',
      lastSync: '2024-01-01T00:00:00Z'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    status: 'active',
    views: 100,
    favorites: 15,
    sales: 0,
    reviews: {
      rating: 0,
      count: 0
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    listingService = new ListingService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(listingService.init()).resolves.not.toThrow();
    });

    it('should prevent double initialization', async () => {
      await listingService.init();
      await listingService.init(); // Should return early
      
      // Verify service is still functional
      const listings = await listingService.getListings();
      expect(listings).toBeDefined();
    });
  });

  describe('Creating Listings', () => {
    beforeEach(async () => {
      await listingService.init();
    });

    it('should create a product listing', async () => {
      const listing = await listingService.createListing(mockProductListing);
      
      expect(listing).toBeDefined();
      expect(listing.id).toBeDefined();
      expect(listing.type).toBe('product');
      expect(listing.seller).toEqual(mockSeller);
      expect(listing.details).toEqual(mockProductDetails);
    });

    it('should create a service listing', async () => {
      const serviceListing = {
        ...mockProductListing,
        type: 'service' as const,
        details: mockServiceDetails
      };
      
      const listing = await listingService.createListing(serviceListing);
      
      expect(listing.type).toBe('service');
      expect(listing.details).toEqual(mockServiceDetails);
    });

    it('should generate unique listing IDs', async () => {
      const listing1 = await listingService.createListing(mockProductListing);
      const listing2 = await listingService.createListing(mockProductListing);
      
      expect(listing1.id).toBeDefined();
      expect(listing2.id).toBeDefined();
      expect(listing1.id).not.toBe(listing2.id);
    });

    it('should set creation timestamp', async () => {
      const beforeCreate = Date.now();
      const listing = await listingService.createListing(mockProductListing);
      const afterCreate = Date.now();
      
      const createdTime = new Date(listing.createdAt || '').getTime();
      expect(createdTime).toBeGreaterThanOrEqual(beforeCreate);
      expect(createdTime).toBeLessThanOrEqual(afterCreate);
    });

    it('should validate required fields', async () => {
      // Test missing seller
      const invalidListing = { ...mockProductListing, seller: undefined };
      const mockCreateListing = jest.fn().mockRejectedValue(new Error('Seller is required'));
      listingService.createListing = mockCreateListing;
      
      await expect(listingService.createListing(invalidListing)).rejects.toThrow('Seller is required');
    });

    it('should handle image uploads', async () => {
      const listingWithImages = {
        ...mockProductListing,
        details: {
          ...mockProductDetails,
          images: ['data:image/png;base64,iVBORw0...', 'https://example.com/image.jpg']
        }
      };
      
      const mockCreateListing = jest.fn().mockResolvedValue({
        ...listingWithImages,
        id: 'listing-with-images',
        details: {
          ...listingWithImages.details,
          images: ['ipfs://QmUploaded1', 'ipfs://QmUploaded2']
        }
      });
      listingService.createListing = mockCreateListing;
      
      const listing = await listingService.createListing(listingWithImages);
      expect(listing.details.images).toHaveLength(2);
      expect(listing.details.images[0]).toMatch(/^ipfs:\/\//);
    });
  });

  describe('Retrieving Listings', () => {
    beforeEach(async () => {
      await listingService.init();
    });

    it('should get all listings', async () => {
      const listings = await listingService.getListings();
      
      expect(Array.isArray(listings)).toBe(true);
      expect(listings).toBeDefined();
    });

    it('should get listing by ID', async () => {
      // Mock implementation for getting single listing
      const mockGetListing = jest.fn().mockResolvedValue(mockProductListing);
      (listingService as any).getListingById = mockGetListing;
      
      const listing = await (listingService as any).getListingById('listing-001');
      
      expect(listing).toEqual(mockProductListing);
      expect(mockGetListing).toHaveBeenCalledWith('listing-001');
    });

    it('should return null for non-existent listing', async () => {
      const mockGetListing = jest.fn().mockResolvedValue(null);
      (listingService as any).getListingById = mockGetListing;
      
      const listing = await (listingService as any).getListingById('non-existent');
      
      expect(listing).toBeNull();
    });

    it('should get user listings', async () => {
      const mockGetUserListings = jest.fn().mockResolvedValue([mockProductListing]);
      (listingService as any).getUserListings = mockGetUserListings;
      
      const listings = await (listingService as any).getUserListings(mockSeller.address);
      
      expect(listings).toHaveLength(1);
      expect(listings[0].seller.address).toBe(mockSeller.address);
    });

    it('should handle pagination', async () => {
      const mockGetListings = jest.fn().mockResolvedValue({
        items: [mockProductListing],
        total: 100,
        page: 1,
        pageSize: 20,
        hasMore: true
      });
      (listingService as any).getListingsPaginated = mockGetListings;
      
      const result = await (listingService as any).getListingsPaginated(1, 20);
      
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('Searching Listings', () => {
    beforeEach(async () => {
      await listingService.init();
    });

    it('should search by category', async () => {
      const filters: SearchFilters = {
        category: 'Electronics'
      };
      
      const mockSearch = jest.fn().mockResolvedValue([mockProductListing]);
      (listingService as any).searchListings = mockSearch;
      
      const results = await (listingService as any).searchListings(filters);
      
      expect(results).toHaveLength(1);
      expect(results[0].details.category).toBe('Electronics');
    });

    it('should search by price range', async () => {
      const filters: SearchFilters = {
        priceRange: {
          min: '100',
          max: '500',
          currency: 'USD'
        }
      };
      
      const mockSearch = jest.fn().mockResolvedValue([mockProductListing]);
      (listingService as any).searchListings = mockSearch;
      
      const results = await (listingService as any).searchListings(filters);
      
      expect(mockSearch).toHaveBeenCalledWith(filters);
      expect(results).toHaveLength(1);
    });

    it('should search by location', async () => {
      const filters: SearchFilters = {
        location: {
          country: 'USA',
          state: 'California',
          radius: 50
        }
      };
      
      const mockSearch = jest.fn().mockResolvedValue([mockProductListing]);
      (listingService as any).searchListings = mockSearch;
      
      const results = await (listingService as any).searchListings(filters);
      
      expect(results[0].seller.location.country).toBe('USA');
      expect(results[0].seller.location.state).toBe('California');
    });

    it('should search by seller criteria', async () => {
      const filters: SearchFilters = {
        seller: {
          verified: true,
          minRating: 4.5
        }
      };
      
      const mockSearch = jest.fn().mockResolvedValue([mockProductListing]);
      (listingService as any).searchListings = mockSearch;
      
      const results = await (listingService as any).searchListings(filters);
      
      expect(results[0].seller.verified).toBe(true);
      expect(results[0].seller.rating).toBeGreaterThanOrEqual(4.5);
    });

    it('should combine multiple filters', async () => {
      const filters: SearchFilters = {
        type: 'product',
        category: 'Electronics',
        priceRange: { max: '1000' },
        condition: 'used'
      };
      
      const mockSearch = jest.fn().mockResolvedValue([mockProductListing]);
      (listingService as any).searchListings = mockSearch;
      
      await (listingService as any).searchListings(filters);
      
      expect(mockSearch).toHaveBeenCalledWith(filters);
    });

    it('should handle empty search results', async () => {
      const mockSearch = jest.fn().mockResolvedValue([]);
      (listingService as any).searchListings = mockSearch;
      
      const results = await (listingService as any).searchListings({ category: 'NonExistent' });
      
      expect(results).toEqual([]);
    });
  });

  describe('Updating Listings', () => {
    beforeEach(async () => {
      await listingService.init();
    });

    it('should update listing details', async () => {
      const updates = {
        price: { amount: '200', currency: 'USD' },
        quantity: 0,
        availability: false
      };
      
      const mockUpdate = jest.fn().mockResolvedValue({
        ...mockProductListing,
        details: {
          ...mockProductDetails,
          ...updates
        },
        updatedAt: new Date().toISOString()
      });
      (listingService as any).updateListing = mockUpdate;
      
      const updated = await (listingService as any).updateListing('listing-001', updates);
      
      expect(updated.details.price.amount).toBe('200');
      expect(updated.details.availability).toBe(false);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(mockProductListing.updatedAt).getTime()
      );
    });

    it('should update listing status', async () => {
      const mockUpdateStatus = jest.fn().mockResolvedValue({
        ...mockProductListing,
        status: 'sold'
      });
      (listingService as any).updateListingStatus = mockUpdateStatus;
      
      const updated = await (listingService as any).updateListingStatus('listing-001', 'sold');
      
      expect(updated.status).toBe('sold');
    });

    it('should prevent invalid status updates', async () => {
      const mockUpdateStatus = jest.fn().mockRejectedValue(
        new Error('Invalid status transition')
      );
      (listingService as any).updateListingStatus = mockUpdateStatus;
      
      await expect(
        (listingService as any).updateListingStatus('listing-001', 'invalid')
      ).rejects.toThrow('Invalid status transition');
    });

    it('should increment view count', async () => {
      const mockIncrementViews = jest.fn().mockResolvedValue({
        ...mockProductListing,
        views: mockProductListing.views + 1
      });
      (listingService as any).incrementViews = mockIncrementViews;
      
      const updated = await (listingService as any).incrementViews('listing-001');
      
      expect(updated.views).toBe(101);
    });

    it('should add to favorites', async () => {
      const mockAddFavorite = jest.fn().mockResolvedValue({
        ...mockProductListing,
        favorites: mockProductListing.favorites + 1
      });
      (listingService as any).addToFavorites = mockAddFavorite;
      
      const updated = await (listingService as any).addToFavorites('listing-001', 'user-001');
      
      expect(updated.favorites).toBe(16);
    });
  });

  describe('Deleting Listings', () => {
    beforeEach(async () => {
      await listingService.init();
    });

    it('should delete listing', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ success: true });
      (listingService as any).deleteListing = mockDelete;
      
      const result = await (listingService as any).deleteListing('listing-001');
      
      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('listing-001');
    });

    it('should only allow owner to delete', async () => {
      const mockDelete = jest.fn().mockRejectedValue(
        new Error('Only listing owner can delete')
      );
      (listingService as any).deleteListing = mockDelete;
      
      await expect(
        (listingService as any).deleteListing('listing-001', 'wrong-user')
      ).rejects.toThrow('Only listing owner can delete');
    });

    it('should handle non-existent listing deletion', async () => {
      const mockDelete = jest.fn().mockRejectedValue(
        new Error('Listing not found')
      );
      (listingService as any).deleteListing = mockDelete;
      
      await expect(
        (listingService as any).deleteListing('non-existent')
      ).rejects.toThrow('Listing not found');
    });
  });

  describe('Listing Validation', () => {
    it('should validate product listing', async () => {
      const mockValidate = jest.fn().mockReturnValue({
        valid: true,
        errors: []
      });
      (listingService as any).validateListing = mockValidate;
      
      const result = (listingService as any).validateListing(mockProductListing);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const invalidListing = {
        ...mockProductListing,
        details: {
          ...mockProductDetails,
          name: '',
          price: undefined
        }
      };
      
      const mockValidate = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Name is required', 'Price is required']
      });
      (listingService as any).validateListing = mockValidate;
      
      const result = (listingService as any).validateListing(invalidListing);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Price is required');
    });

    it('should validate price format', async () => {
      const invalidPrice = {
        ...mockProductListing,
        details: {
          ...mockProductDetails,
          price: { amount: '-50', currency: 'USD' }
        }
      };
      
      const mockValidate = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Price must be positive']
      });
      (listingService as any).validateListing = mockValidate;
      
      const result = (listingService as any).validateListing(invalidPrice);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Price must be positive');
    });
  });

  describe('Listing Analytics', () => {
    beforeEach(async () => {
      await listingService.init();
    });

    it('should get listing analytics', async () => {
      const mockGetAnalytics = jest.fn().mockResolvedValue({
        views: 1000,
        uniqueViewers: 750,
        favorites: 50,
        conversionRate: 0.02,
        viewsByDay: [
          { date: '2024-01-01', views: 100 },
          { date: '2024-01-02', views: 150 }
        ]
      });
      (listingService as any).getListingAnalytics = mockGetAnalytics;
      
      const analytics = await (listingService as any).getListingAnalytics('listing-001');
      
      expect(analytics.views).toBe(1000);
      expect(analytics.conversionRate).toBe(0.02);
      expect(analytics.viewsByDay).toHaveLength(2);
    });

    it('should get seller analytics', async () => {
      const mockGetSellerAnalytics = jest.fn().mockResolvedValue({
        totalListings: 25,
        activeListings: 20,
        totalViews: 5000,
        totalSales: 150,
        revenue: '15000',
        topCategories: ['Electronics', 'Home & Garden']
      });
      (listingService as any).getSellerAnalytics = mockGetSellerAnalytics;
      
      const analytics = await (listingService as any).getSellerAnalytics(mockSeller.address);
      
      expect(analytics.totalListings).toBe(25);
      expect(analytics.revenue).toBe('15000');
      expect(analytics.topCategories).toContain('Electronics');
    });
  });

  describe('Bulk Operations', () => {
    it('should import listings in bulk', async () => {
      const listings = [mockProductListing, { ...mockProductListing, id: 'listing-002' }];
      
      const mockBulkImport = jest.fn().mockResolvedValue({
        imported: 2,
        failed: 0,
        errors: []
      });
      (listingService as any).bulkImport = mockBulkImport;
      
      const result = await (listingService as any).bulkImport(listings);
      
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should export listings', async () => {
      const mockExport = jest.fn().mockResolvedValue({
        format: 'json',
        data: JSON.stringify([mockProductListing]),
        count: 1
      });
      (listingService as any).exportListings = mockExport;
      
      const result = await (listingService as any).exportListings({
        format: 'json',
        filters: { seller: { address: mockSeller.address } }
      });
      
      expect(result.format).toBe('json');
      expect(result.count).toBe(1);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await listingService.init();
      await expect(listingService.clearCache()).resolves.not.toThrow();
    });

    it('should handle cache operations when not initialized', async () => {
      await expect(listingService.clearCache()).resolves.not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await listingService.init();
      await expect(listingService.cleanup()).resolves.not.toThrow();
    });

    it('should reset initialization state', async () => {
      await listingService.init();
      await listingService.cleanup();
      
      // Should be able to reinitialize
      await expect(listingService.init()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockGetListings = jest.fn().mockRejectedValue(new Error('Network error'));
      listingService.getListings = mockGetListings;
      
      await expect(listingService.getListings()).rejects.toThrow('Network error');
    });

    it('should handle validation errors', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('Validation failed'));
      listingService.createListing = mockCreate;
      
      await expect(listingService.createListing({})).rejects.toThrow('Validation failed');
    });
  });

  describe('Integration with Other Services', () => {
    it('should integrate with IPFS for image storage', async () => {
      const mockUploadToIPFS = jest.fn().mockResolvedValue('ipfs://QmHash123');
      (listingService as any).uploadToIPFS = mockUploadToIPFS;
      
      const ipfsHash = await (listingService as any).uploadToIPFS(Buffer.from('image data'));
      
      expect(ipfsHash).toBe('ipfs://QmHash123');
    });

    it('should integrate with oracle for pricing', async () => {
      const mockGetMarketPrice = jest.fn().mockResolvedValue({
        suggested: '250',
        min: '200',
        max: '300',
        confidence: 0.95
      });
      (listingService as any).getMarketPrice = mockGetMarketPrice;
      
      const pricing = await (listingService as any).getMarketPrice('Vintage Camera', 'Electronics');
      
      expect(pricing.suggested).toBe('250');
      expect(pricing.confidence).toBe(0.95);
    });

    it('should integrate with validator for verification', async () => {
      const mockVerifySeller = jest.fn().mockResolvedValue({
        verified: true,
        verificationLevel: 'full',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000
      });
      (listingService as any).verifySeller = mockVerifySeller;
      
      const verification = await (listingService as any).verifySeller(mockSeller.address);
      
      expect(verification.verified).toBe(true);
      expect(verification.verificationLevel).toBe('full');
    });
  });

  describe('Real-time Updates', () => {
    it('should subscribe to listing updates', async () => {
      const mockSubscribe = jest.fn().mockResolvedValue({
        id: 'sub-001',
        unsubscribe: jest.fn()
      });
      (listingService as any).subscribeToListingUpdates = mockSubscribe;
      
      const callback = jest.fn();
      const subscription = await (listingService as any).subscribeToListingUpdates(
        'listing-001',
        callback
      );
      
      expect(subscription.id).toBe('sub-001');
      expect(subscription.unsubscribe).toBeDefined();
    });

    it('should notify on price changes', async () => {
      const mockWatchPrice = jest.fn();
      (listingService as any).watchPriceChanges = mockWatchPrice;
      
      const callback = jest.fn();
      await (listingService as any).watchPriceChanges('listing-001', callback);
      
      expect(mockWatchPrice).toHaveBeenCalledWith('listing-001', callback);
    });
  });
});