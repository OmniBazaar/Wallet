/**
 * useListings Hook Test Suite
 * 
 * Tests marketplace listing display functionality including search,
 * filtering, pagination, and real-time updates. This is a Phase 4
 * component for core functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { useListings } from '../../src/hooks/useListings';
import { ListingMetadata, SearchFilters, ProductDetails, ServiceDetails } from '../../src/types/listing';
import * as useWalletModule from '../../src/hooks/useWallet';

// Mock dependencies
jest.mock('../../src/hooks/useWallet');
jest.mock('../../src/core/providers/OmniProvider');

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('useListings', () => {
  let mockProvider: any;
  let mockWalletHook: any;
  let mockOmniProvider: any;

  // Test constants
  const TEST_CONTRACT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
  
  const MOCK_PRODUCT_LISTING: ListingMetadata = {
    id: 'listing-001',
    type: 'product',
    seller: {
      address: '0xSellerAddress123',
      name: 'Test Seller',
      description: 'Quality products seller',
      location: {
        country: 'USA',
        state: 'CA',
        city: 'San Francisco'
      },
      contactInfo: {
        email: 'seller@test.com'
      },
      rating: 4.5,
      totalSales: 100,
      joinedDate: '2023-01-01',
      verified: true
    },
    details: {
      name: 'Vintage Camera',
      description: 'Professional vintage camera in excellent condition',
      category: 'Electronics',
      subcategory: 'Cameras',
      tags: ['vintage', 'photography', 'professional'],
      price: {
        amount: '500',
        currency: 'USDC'
      },
      images: ['https://example.com/camera1.jpg', 'https://example.com/camera2.jpg'],
      condition: 'used',
      quantity: 1,
      availability: true
    } as ProductDetails,
    listingNode: {
      address: '0xNodeAddress123',
      name: 'SF Node 1',
      location: {
        country: 'USA',
        state: 'CA',
        city: 'San Francisco'
      },
      status: 'active',
      lastSync: '2024-01-15T10:00:00Z'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    status: 'active',
    views: 250,
    favorites: 25,
    sales: 0,
    reviews: {
      rating: 4.8,
      count: 15
    }
  };

  const MOCK_SERVICE_LISTING: ListingMetadata = {
    id: 'listing-002',
    type: 'service',
    seller: {
      address: '0xServiceProvider456',
      name: 'Pro Services',
      location: {
        country: 'USA',
        state: 'NY',
        city: 'New York'
      },
      contactInfo: {
        email: 'services@test.com',
        website: 'https://proservices.com'
      },
      rating: 4.8,
      totalSales: 50,
      joinedDate: '2023-06-01',
      verified: true
    },
    details: {
      name: 'Web Development',
      description: 'Full-stack web development services',
      category: 'Technology',
      subcategory: 'Development',
      tags: ['web', 'development', 'full-stack'],
      price: {
        amount: '100',
        currency: 'USDC',
        type: 'hourly'
      },
      availability: {
        schedule: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          hours: ['9AM-5PM']
        },
        location: 'remote'
      },
      qualifications: ['10+ years experience', 'React/Node.js expert'],
      experience: 'Senior developer with Fortune 500 experience'
    } as ServiceDetails,
    listingNode: {
      address: '0xNodeAddress456',
      name: 'NY Node 1',
      location: {
        country: 'USA',
        state: 'NY',
        city: 'New York'
      },
      status: 'active',
      lastSync: '2024-01-15T11:00:00Z'
    },
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-11T00:00:00Z',
    status: 'active',
    views: 150,
    favorites: 20,
    sales: 5,
    reviews: {
      rating: 4.9,
      count: 10
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = {
      // Basic provider mock
    };

    // Setup wallet hook mock
    mockWalletHook = {
      provider: mockProvider,
      address: TEST_CONTRACT_ADDRESS,
      chainId: 1
    };

    jest.spyOn(useWalletModule, 'useWallet').mockReturnValue(mockWalletHook as any);

    // Setup OmniProvider mock
    mockOmniProvider = {
      send: jest.fn()
    };

    // Mock OmniProvider constructor
    jest.mocked(require('../../src/core/providers/OmniProvider').OmniProvider).mockImplementation(() => mockOmniProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have initial empty state', () => {
      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      expect(result.current.listings).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.totalResults).toBe(0);
      expect(result.current.currentPage).toBe(1);
    });

    it('should initialize OmniProvider', async () => {
      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await waitFor(() => {
        expect(require('../../src/core/providers/OmniProvider').OmniProvider).toHaveBeenCalledWith('marketplace-listings');
      });
    });
  });

  describe('Search Listings', () => {
    it('should search listings with OmniProvider', async () => {
      const mockListings = [MOCK_PRODUCT_LISTING, MOCK_SERVICE_LISTING];
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: mockListings,
        total: 2
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      const searchFilters: SearchFilters = {
        type: 'product',
        category: 'Electronics',
        priceRange: {
          min: '100',
          max: '1000',
          currency: 'USDC'
        }
      };

      await act(async () => {
        await result.current.searchListings(searchFilters);
      });

      expect(mockOmniProvider.send).toHaveBeenCalledWith('omni_searchListings', [{
        contractAddress: TEST_CONTRACT_ADDRESS,
        ...searchFilters
      }]);
      expect(result.current.listings).toEqual(mockListings);
      expect(result.current.totalResults).toBe(2);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should fallback to API when OmniProvider fails', async () => {
      mockOmniProvider.send.mockRejectedValueOnce(new Error('P2P network error'));
      
      const mockListings = [MOCK_PRODUCT_LISTING];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          listings: mockListings,
          total: 1
        })
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      const searchFilters: SearchFilters = {
        type: 'product'
      };

      await act(async () => {
        await result.current.searchListings(searchFilters);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/listings/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress: TEST_CONTRACT_ADDRESS,
          filters: searchFilters,
        }),
      });
      expect(result.current.listings).toEqual(mockListings);
      expect(result.current.totalResults).toBe(1);
    });

    it('should handle search with pagination', async () => {
      const page2Listings = [
        { ...MOCK_PRODUCT_LISTING, id: 'listing-003' },
        { ...MOCK_SERVICE_LISTING, id: 'listing-004' }
      ];
      
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: page2Listings,
        total: 50
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      const searchFilters: SearchFilters = {
        page: 2,
        limit: 20
      };

      await act(async () => {
        await result.current.searchListings(searchFilters);
      });

      expect(result.current.currentPage).toBe(2);
      expect(result.current.totalResults).toBe(50);
      expect(result.current.listings).toEqual(page2Listings);
    });

    it('should handle complex search filters', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: [MOCK_PRODUCT_LISTING],
        total: 1
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      const complexFilters: SearchFilters = {
        type: 'product',
        category: 'Electronics',
        subcategory: 'Cameras',
        priceRange: {
          min: '100',
          max: '1000',
          currency: 'USDC'
        },
        location: {
          country: 'USA',
          state: 'CA',
          radius: 50
        },
        seller: {
          verified: true,
          minRating: 4
        },
        condition: 'used',
        availability: true,
        tags: ['vintage'],
        sortBy: 'price',
        sortOrder: 'asc'
      };

      await act(async () => {
        await result.current.searchListings(complexFilters);
      });

      expect(mockOmniProvider.send).toHaveBeenCalledWith('omni_searchListings', [{
        contractAddress: TEST_CONTRACT_ADDRESS,
        ...complexFilters
      }]);
    });

    it('should handle search errors', async () => {
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Search failed'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({});
      });

      expect(result.current.error).toBe('Failed to search listings');
      expect(result.current.listings).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle empty search results', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: [],
        total: 0
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({ category: 'NonExistent' });
      });

      expect(result.current.listings).toEqual([]);
      expect(result.current.totalResults).toBe(0);
    });

    it('should set loading state during search', async () => {
      let resolveSearch: any;
      mockOmniProvider.send.mockReturnValueOnce(new Promise(resolve => {
        resolveSearch = resolve;
      }));

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      const searchPromise = act(async () => {
        await result.current.searchListings({});
      });

      expect(result.current.isLoading).toBe(true);

      resolveSearch({ listings: [], total: 0 });
      await searchPromise;

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Get Single Listing', () => {
    it('should get single listing via OmniProvider', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listing: MOCK_PRODUCT_LISTING
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      let listing: ListingMetadata | null = null;
      await act(async () => {
        listing = await result.current.getListing('listing-001');
      });

      expect(mockOmniProvider.send).toHaveBeenCalledWith('omni_getListing', [TEST_CONTRACT_ADDRESS, 'listing-001']);
      expect(listing).toEqual(MOCK_PRODUCT_LISTING);
    });

    it('should fallback to API for single listing', async () => {
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Network error'));
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          listing: MOCK_SERVICE_LISTING
        })
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      let listing: ListingMetadata | null = null;
      await act(async () => {
        listing = await result.current.getListing('listing-002');
      });

      expect(global.fetch).toHaveBeenCalledWith(`/api/listings/${TEST_CONTRACT_ADDRESS}/listing-002`);
      expect(listing).toEqual(MOCK_SERVICE_LISTING);
    });

    it('should return null for non-existent listing', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listing: null
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      let listing: ListingMetadata | null = null;
      await act(async () => {
        listing = await result.current.getListing('non-existent');
      });

      expect(listing).toBeNull();
    });

    it('should handle get listing errors gracefully', async () => {
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Network error'));
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      let listing: ListingMetadata | null = null;
      await act(async () => {
        listing = await result.current.getListing('error-listing');
      });

      expect(listing).toBeNull();
      // Should not set global error state for single listing fetch
      expect(result.current.error).toBeNull();
    });
  });

  describe('Refresh Listings', () => {
    it('should refresh listings via OmniProvider', async () => {
      const refreshedListings = [
        { ...MOCK_PRODUCT_LISTING, views: 300 },
        { ...MOCK_SERVICE_LISTING, views: 200 }
      ];
      
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: refreshedListings,
        total: 2
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.refreshListings();
      });

      expect(mockOmniProvider.send).toHaveBeenCalledWith('omni_refreshListings', [TEST_CONTRACT_ADDRESS]);
      expect(result.current.listings).toEqual(refreshedListings);
      expect(result.current.totalResults).toBe(2);
    });

    it('should fallback to API for refresh', async () => {
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Refresh failed'));
      
      const refreshedListings = [MOCK_PRODUCT_LISTING];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          listings: refreshedListings,
          total: 1
        })
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.refreshListings();
      });

      expect(global.fetch).toHaveBeenCalledWith(`/api/listings/${TEST_CONTRACT_ADDRESS}/refresh`);
      expect(result.current.listings).toEqual(refreshedListings);
    });

    it('should handle refresh errors', async () => {
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Network error'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.refreshListings();
      });

      expect(result.current.error).toBe('Failed to refresh listings');
    });

    it('should set loading state during refresh', async () => {
      let resolveRefresh: any;
      mockOmniProvider.send.mockReturnValueOnce(new Promise(resolve => {
        resolveRefresh = resolve;
      }));

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      const refreshPromise = act(async () => {
        await result.current.refreshListings();
      });

      expect(result.current.isLoading).toBe(true);

      resolveRefresh({ listings: [], total: 0 });
      await refreshPromise;

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('OmniProvider Integration', () => {
    it('should handle OmniProvider initialization failure', async () => {
      jest.mocked(require('../../src/core/providers/OmniProvider').OmniProvider).mockImplementationOnce(() => {
        throw new Error('Provider init failed');
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      // Should still work with API fallback
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          listings: [MOCK_PRODUCT_LISTING],
          total: 1
        })
      });

      await act(async () => {
        await result.current.searchListings({});
      });

      expect(result.current.listings).toHaveLength(1);
    });

    it('should handle OmniProvider returning invalid data', async () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      // Return data without listings property
      mockOmniProvider.send.mockResolvedValueOnce({ invalid: 'data' });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      // Should fallback to API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          listings: [MOCK_SERVICE_LISTING],
          total: 1
        })
      });

      await act(async () => {
        await result.current.searchListings({});
      });

      expect(result.current.listings).toEqual([MOCK_SERVICE_LISTING]);
      
      consoleWarn.mockRestore();
    });
  });

  describe('Different Listing Types', () => {
    it('should handle product listings correctly', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: [MOCK_PRODUCT_LISTING],
        total: 1
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({ type: 'product' });
      });

      const productListing = result.current.listings[0];
      expect(productListing.type).toBe('product');
      expect((productListing.details as ProductDetails).condition).toBe('used');
      expect((productListing.details as ProductDetails).quantity).toBe(1);
    });

    it('should handle service listings correctly', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: [MOCK_SERVICE_LISTING],
        total: 1
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({ type: 'service' });
      });

      const serviceListing = result.current.listings[0];
      expect(serviceListing.type).toBe('service');
      expect((serviceListing.details as ServiceDetails).price.type).toBe('hourly');
      expect((serviceListing.details as ServiceDetails).availability.location).toBe('remote');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty contract address', () => {
      const { result } = renderHook(() => useListings(''));

      expect(result.current.listings).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle contract address change', async () => {
      const { result, rerender } = renderHook(
        ({ address }) => useListings(address),
        {
          initialProps: { address: TEST_CONTRACT_ADDRESS }
        }
      );

      const NEW_CONTRACT = '0xNewContract1234567890abcdef1234567890abcdef';
      
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: [MOCK_PRODUCT_LISTING],
        total: 1
      });

      rerender({ address: NEW_CONTRACT });

      await act(async () => {
        await result.current.searchListings({});
      });

      expect(mockOmniProvider.send).toHaveBeenCalledWith('omni_searchListings', [{
        contractAddress: NEW_CONTRACT
      }]);
    });

    it('should handle very large result sets', async () => {
      const largeListings = Array(1000).fill(null).map((_, i) => ({
        ...MOCK_PRODUCT_LISTING,
        id: `listing-${i}`
      }));

      mockOmniProvider.send.mockResolvedValueOnce({
        listings: largeListings.slice(0, 20),
        total: 1000
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({ limit: 20 });
      });

      expect(result.current.listings).toHaveLength(20);
      expect(result.current.totalResults).toBe(1000);
    });

    it('should handle concurrent operations', async () => {
      mockOmniProvider.send
        .mockResolvedValueOnce({ listings: [MOCK_PRODUCT_LISTING], total: 1 })
        .mockResolvedValueOnce({ listings: [MOCK_SERVICE_LISTING], total: 1 });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await Promise.all([
          result.current.searchListings({ type: 'product' }),
          result.current.searchListings({ type: 'service' })
        ]);
      });

      // Last search should win
      expect(result.current.listings).toEqual([MOCK_SERVICE_LISTING]);
    });

    it('should handle special characters in search', async () => {
      mockOmniProvider.send.mockResolvedValueOnce({
        listings: [],
        total: 0
      });

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({
          tags: ['special!@#$%^&*()', 'unicode: 你好']
        });
      });

      expect(mockOmniProvider.send).toHaveBeenCalledWith('omni_searchListings', [{
        contractAddress: TEST_CONTRACT_ADDRESS,
        tags: ['special!@#$%^&*()', 'unicode: 你好']
      }]);
    });
  });

  describe('Console Logging', () => {
    it('should log OmniProvider initialization errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      jest.mocked(require('../../src/core/providers/OmniProvider').OmniProvider).mockImplementationOnce(() => {
        throw new Error('Init error');
      });

      renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to initialize OmniProvider:', expect.any(Error));
      });

      consoleError.mockRestore();
    });

    it('should log search errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Search error'));
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.searchListings({});
      });

      expect(consoleError).toHaveBeenCalledWith('Error searching listings:', expect.any(Error));
      
      consoleError.mockRestore();
    });

    it('should log refresh errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Refresh error'));
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      await act(async () => {
        await result.current.refreshListings();
      });

      expect(consoleError).toHaveBeenCalledWith('Error refreshing listings:', expect.any(Error));
      
      consoleError.mockRestore();
    });

    it('should warn about OmniProvider fallbacks', async () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      mockOmniProvider.send.mockRejectedValueOnce(new Error('Provider error'));

      const { result } = renderHook(() => useListings(TEST_CONTRACT_ADDRESS));

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ listings: [], total: 0 })
      });

      await act(async () => {
        await result.current.searchListings({});
      });

      expect(consoleWarn).toHaveBeenCalledWith('OmniProvider search failed, falling back to API:', expect.any(Error));
      
      consoleWarn.mockRestore();
    });
  });
});