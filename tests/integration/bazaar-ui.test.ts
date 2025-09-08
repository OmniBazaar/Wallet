/**
 * Bazaar/UI Integration Tests
 * Tests wallet integration with OmniBazaar marketplace UI
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { BazaarIntegration } from '../../src/integrations/BazaarIntegration';
import { ListingService } from '../../src/services/ListingService';
import { mockWallet, mockNFT, createMockProvider } from '../setup';

describe('Bazaar/UI Integration', () => {
  let walletService: WalletService;
  let bazaarIntegration: BazaarIntegration;
  let listingService: ListingService;

  beforeAll(async () => {
    // Create mock provider
    const mockProvider = createMockProvider('ethereum');
    
    walletService = new WalletService({
      providers: {
        1: {
          chainId: 1,
          network: 'ethereum',
          rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
          nativeSymbol: 'ETH',
          nativeDecimals: 18
        }
      },
      defaultChainId: 1,
      autoConnect: false
    });
    
    // Mock the wallet initialization to use our mock provider
    jest.spyOn(walletService as any, 'initializeProvider').mockImplementation(async () => {
      (walletService as any).currentProvider = mockProvider;
    });
    
    bazaarIntegration = new BazaarIntegration(walletService);
    listingService = new ListingService();
    
    await walletService.init();
    
    // Mock successful connection
    jest.spyOn(walletService, 'connect').mockResolvedValue(undefined);
    jest.spyOn(walletService, 'getAddress').mockResolvedValue(mockWallet.address);
    
    // Set the private isConnected property
    (walletService as any).isConnected = true;
    
    await walletService.connect();
    await bazaarIntegration.connect();
  });

  afterAll(async () => {
    await bazaarIntegration.disconnect();
    await walletService.cleanup();
  });

  beforeEach(async () => {
    await bazaarIntegration.reset();
  });

  describe('Wallet Connection to Bazaar', () => {
    it('should connect wallet to Bazaar marketplace', async () => {
      const connection = await bazaarIntegration.connectWallet(mockWallet.address);
      
      expect(connection.success).toBe(true);
      expect(connection.walletAddress).toBe(mockWallet.address);
      expect(connection.bazaarAccount).toBeDefined();
    });

    it('should authenticate user with wallet signature', async () => {
      const message = 'Sign this message to authenticate with OmniBazaar';
      const signature = await walletService.signMessage(message);
      
      const auth = await bazaarIntegration.authenticate(mockWallet.address, signature);
      expect(auth.authenticated).toBe(true);
      expect(auth.token).toBeDefined();
      expect(auth.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should maintain session across page refreshes', async () => {
      await bazaarIntegration.connectWallet(mockWallet.address);
      const session1 = await bazaarIntegration.getSession();
      
      // Simulate page refresh
      await bazaarIntegration.restoreSession();
      const session2 = await bazaarIntegration.getSession();
      
      expect(session2.walletAddress).toBe(session1.walletAddress);
      expect(session2.isActive).toBe(true);
    });

    it('should handle wallet disconnection', async () => {
      await bazaarIntegration.connectWallet(mockWallet.address);
      expect(bazaarIntegration.isConnected()).toBe(true);
      
      await bazaarIntegration.disconnectWallet();
      expect(bazaarIntegration.isConnected()).toBe(false);
      expect(await bazaarIntegration.getSession()).toBeNull();
    });
  });

  describe('Listing Creation and Management', () => {
    beforeEach(async () => {
      // Ensure wallet is connected to bazaar for each test
      await bazaarIntegration.connectWallet(mockWallet.address);
    });

    it('should create listing with wallet signature', async () => {
      const listingData = {
        title: 'Test Product',
        description: 'Test Description',
        price: '100',
        currency: 'XOM',
        images: ['ipfs://image1'],
        category: 'Electronics'
      };

      const listing = await bazaarIntegration.createListing(listingData, mockWallet.address);
      
      expect(listing).toBeDefined();
      expect(listing.id).toBeDefined();
      expect(listing.seller).toBe(mockWallet.address);
      expect(listing.status).toBe('active');
    });

    it('should mint listing as NFT', async () => {
      const listingData = {
        title: 'NFT Listing',
        price: '50',
        currency: 'XOM'
      };

      const nft = await bazaarIntegration.mintListingNFT(listingData, mockWallet.address);
      
      expect(nft.tokenId).toBeDefined();
      expect(nft.contractAddress).toBeDefined();
      expect(nft.owner).toBe(mockWallet.address);
      expect(nft.metadata.listing).toEqual(listingData);
    });

    it('should update listing details', async () => {
      const listing = await bazaarIntegration.createListing({
        title: 'Original Title',
        price: '100'
      }, mockWallet.address);

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await bazaarIntegration.updateListing(listing.id, {
        title: 'Updated Title',
        price: '150'
      }, mockWallet.address);

      expect(updated.title).toBe('Updated Title');
      expect(updated.price).toBe('150');
      expect(updated.lastModified).toBeGreaterThan(listing.createdAt);
    });

    it('should delete listing', async () => {
      const listing = await bazaarIntegration.createListing({
        title: 'To Delete',
        price: '100'
      }, mockWallet.address);

      const deleted = await bazaarIntegration.deleteListing(listing.id, mockWallet.address);
      expect(deleted.success).toBe(true);
      
      const retrieved = await bazaarIntegration.getListing(listing.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Purchase Flow Integration', () => {
    beforeEach(async () => {
      // Ensure wallet is connected to bazaar for each test
      await bazaarIntegration.connectWallet(mockWallet.address);
    });

    it('should initiate purchase with wallet', async () => {
      const listing = {
        id: 'listing-123',
        price: '100',
        currency: 'XOM',
        seller: '0xseller...'
      };

      const purchase = await bazaarIntegration.initiatePurchase(
        listing.id,
        mockWallet.address
      );

      expect(purchase.transactionId).toBeDefined();
      expect(purchase.buyer).toBe(mockWallet.address);
      expect(purchase.status).toBe('pending');
    });

    it('should handle escrow payment', async () => {
      const escrow = await bazaarIntegration.createEscrow({
        listingId: 'listing-123',
        buyer: mockWallet.address,
        seller: '0xseller...',
        amount: '100',
        currency: 'XOM'
      });

      expect(escrow.escrowId).toBeDefined();
      expect(escrow.status).toBe('funded');
      expect(escrow.releaseConditions).toBeDefined();
    });

    it('should process payment confirmation', async () => {
      const payment = {
        transactionHash: '0xabc...',
        from: mockWallet.address,
        to: '0xseller...',
        amount: '100'
      };

      const confirmation = await bazaarIntegration.confirmPayment(payment);
      
      expect(confirmation.confirmed).toBe(true);
      expect(confirmation.blockNumber).toBeDefined();
      expect(confirmation.timestamp).toBeDefined();
    });

    it('should update order status', async () => {
      const orderId = 'order-123';
      
      // Create order
      await bazaarIntegration.createOrder({
        listingId: 'listing-123',
        buyer: mockWallet.address,
        status: 'pending'
      });

      // Update status
      const updated = await bazaarIntegration.updateOrderStatus(orderId, 'shipped');
      expect(updated.status).toBe('shipped');
      
      // Complete order
      const completed = await bazaarIntegration.completeOrder(orderId);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });
  });

  describe('UI Component Integration', () => {
    beforeEach(async () => {
      // Ensure wallet is connected to bazaar for each test
      await bazaarIntegration.connectWallet(mockWallet.address);
    });

    it('should render wallet connection button', async () => {
      const button = await bazaarIntegration.renderWalletButton({
        containerId: 'wallet-button-container',
        theme: 'dark'
      });

      expect(button.rendered).toBe(true);
      expect(button.element).toBeDefined();
      expect(button.onClick).toBeDefined();
    });

    it('should display wallet balance', async () => {
      await bazaarIntegration.connectWallet(mockWallet.address);
      
      const balance = await bazaarIntegration.getWalletBalance();
      expect(balance).toBeDefined();
      expect(balance.XOM).toBeDefined();
      expect(balance.USD).toBeDefined();
    });

    it('should show transaction history', async () => {
      const history = await bazaarIntegration.getTransactionHistory(mockWallet.address);
      
      expect(Array.isArray(history)).toBe(true);
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('hash');
        expect(history[0]).toHaveProperty('from');
        expect(history[0]).toHaveProperty('to');
        expect(history[0]).toHaveProperty('timestamp');
      }
    });

    it('should handle network switching', async () => {
      const networks = await bazaarIntegration.getAvailableNetworks();
      expect(networks.length).toBeGreaterThan(0);

      const switched = await bazaarIntegration.switchNetwork('avalanche');
      expect(switched.success).toBe(true);
      expect(switched.currentNetwork).toBe('avalanche');
    });
  });

  describe('User Profile Integration', () => {
    it('should sync wallet with user profile', async () => {
      const profile = await bazaarIntegration.syncUserProfile(mockWallet.address);
      
      expect(profile.walletAddress).toBe(mockWallet.address);
      expect(profile.username).toBeDefined();
      expect(profile.reputation).toBeDefined();
      expect(profile.joinedDate).toBeDefined();
    });

    it('should update profile settings', async () => {
      const settings = {
        displayName: 'TestUser',
        bio: 'Test bio',
        avatar: 'ipfs://avatar',
        preferences: {
          notifications: true,
          privacy: 'public'
        }
      };

      const updated = await bazaarIntegration.updateProfile(mockWallet.address, settings);
      expect(updated.displayName).toBe('TestUser');
      expect(updated.preferences.notifications).toBe(true);
    });

    it('should retrieve user listings', async () => {
      const listings = await bazaarIntegration.getUserListings(mockWallet.address);
      
      expect(Array.isArray(listings)).toBe(true);
      listings.forEach(listing => {
        expect(listing.seller).toBe(mockWallet.address);
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('title');
        expect(listing).toHaveProperty('price');
      });
    });

    it('should get user purchase history', async () => {
      const purchases = await bazaarIntegration.getUserPurchases(mockWallet.address);
      
      expect(Array.isArray(purchases)).toBe(true);
      purchases.forEach(purchase => {
        expect(purchase.buyer).toBe(mockWallet.address);
        expect(purchase).toHaveProperty('listingId');
        expect(purchase).toHaveProperty('transactionHash');
      });
    });
  });

  describe('Search and Filter Integration', () => {
    it('should search listings with wallet filters', async () => {
      const searchParams = {
        query: 'electronics',
        priceRange: { min: 10, max: 1000 },
        currency: 'XOM',
        userAddress: mockWallet.address
      };

      const results = await bazaarIntegration.searchListings(searchParams);
      
      expect(Array.isArray(results)).toBe(true);
      results.forEach(listing => {
        const price = parseInt(listing.price);
        expect(price).toBeGreaterThanOrEqual(10);
        expect(price).toBeLessThanOrEqual(1000);
      });
    });

    it('should filter by user favorites', async () => {
      // Add favorites
      await bazaarIntegration.addFavorite('listing-1', mockWallet.address);
      await bazaarIntegration.addFavorite('listing-2', mockWallet.address);

      const favorites = await bazaarIntegration.getUserFavorites(mockWallet.address);
      expect(favorites).toHaveLength(2);
      expect(favorites).toContain('listing-1');
      expect(favorites).toContain('listing-2');
    });

    it('should get recommended listings', async () => {
      const recommendations = await bazaarIntegration.getRecommendations(mockWallet.address);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(10);
      recommendations.forEach(listing => {
        expect(listing).toHaveProperty('relevanceScore');
        expect(listing.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(listing.relevanceScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Notification Integration', () => {
    it('should send wallet notifications', async () => {
      const notification = {
        type: 'purchase_complete',
        title: 'Purchase Successful',
        message: 'Your purchase has been completed',
        data: { orderId: 'order-123' }
      };

      const sent = await bazaarIntegration.sendNotification(
        mockWallet.address,
        notification
      );

      expect(sent.success).toBe(true);
      expect(sent.notificationId).toBeDefined();
    });

    it('should retrieve notifications', async () => {
      const notifications = await bazaarIntegration.getNotifications(mockWallet.address);
      
      expect(Array.isArray(notifications)).toBe(true);
      notifications.forEach(notif => {
        expect(notif).toHaveProperty('id');
        expect(notif).toHaveProperty('type');
        expect(notif).toHaveProperty('timestamp');
        expect(notif).toHaveProperty('read');
      });
    });

    it('should mark notifications as read', async () => {
      const notificationIds = ['notif-1', 'notif-2'];
      
      const marked = await bazaarIntegration.markNotificationsRead(
        notificationIds,
        mockWallet.address
      );

      expect(marked.success).toBe(true);
      expect(marked.updated).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle wallet connection errors', async () => {
      const invalidAddress = 'invalid-address';
      
      const result = await bazaarIntegration.connectWallet(invalidAddress);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid wallet address');
    });

    it('should handle insufficient balance', async () => {
      // Need to connect wallet first
      await bazaarIntegration.connectWallet(mockWallet.address);
      
      const purchase = {
        listingId: 'expensive-listing',
        price: '1000000',
        buyer: mockWallet.address
      };

      await expect(
        bazaarIntegration.initiatePurchase(purchase.listingId, purchase.buyer)
      ).rejects.toThrow('Insufficient balance');
    });

    it('should handle network errors gracefully', async () => {
      // Simulate network failure
      await bazaarIntegration.simulateNetworkError(true);
      
      const result = await bazaarIntegration.getListings().catch(err => err);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('Network error');
      
      // Restore network
      await bazaarIntegration.simulateNetworkError(false);
    });

    it('should retry failed transactions', async () => {
      const transaction = {
        to: '0xrecipient...',
        value: '100',
        data: '0x...'
      };

      const result = await bazaarIntegration.sendTransactionWithRetry(
        transaction,
        mockWallet.address,
        { maxRetries: 3, retryDelay: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBeLessThanOrEqual(3);
    });
  });
});