/**
 * Dashboard Page Tests
 * Tests for the main dashboard page
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../../src/pages/Dashboard.vue';
import { useWalletStore } from '../../src/stores/wallet';
import { useTokenStore } from '../../src/stores/tokens';
import { useNFTStore } from '../../src/stores/nfts';
import { mockWallet } from '../setup';

describe('Dashboard Page', () => {
  let wrapper: VueWrapper;
  let walletStore: ReturnType<typeof useWalletStore>;
  let tokenStore: ReturnType<typeof useTokenStore>;
  let nftStore: ReturnType<typeof useNFTStore>;
  let router;

  beforeEach(() => {
    setActivePinia(createPinia());
    walletStore = useWalletStore();
    tokenStore = useTokenStore();
    nftStore = useNFTStore();

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: Dashboard },
        { path: '/tokens', name: 'tokens', component: { template: '<div></div>' } },
        { path: '/nfts', name: 'nfts', component: { template: '<div></div>' } }
      ]
    });

    // Setup mock data
    walletStore.isConnected = true;
    walletStore.address = mockWallet.address;
    walletStore.balance = {
      native: '1.234',
      usd: '2468.00'
    };

    tokenStore.totalValue = 5000.00;
    nftStore.totalCount = 10;
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe('Page Layout', () => {
    it('should render dashboard header', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="dashboard-header"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="dashboard-title"]').text()).toBe('Dashboard');
    });

    it('should display wallet address', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const addressDisplay = wrapper.find('[data-testid="wallet-address"]');
      expect(addressDisplay.exists()).toBe(true);
      expect(addressDisplay.text()).toContain(mockWallet.address.slice(0, 6));
    });

    it('should show navigation menu', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nav-tokens"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nav-nfts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nav-swap"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="nav-settings"]').exists()).toBe(true);
    });
  });

  describe('Portfolio Overview', () => {
    it('should display total portfolio value', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const portfolioValue = wrapper.find('[data-testid="portfolio-value"]');
      expect(portfolioValue.exists()).toBe(true);
      expect(portfolioValue.text()).toContain('$7,468.00'); // wallet + tokens
    });

    it('should show portfolio breakdown', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="portfolio-chart"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="asset-breakdown"]').exists()).toBe(true);
    });

    it('should display 24h change', () => {
      walletStore.portfolioChange24h = {
        amount: 150.00,
        percentage: 2.05
      };

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const change = wrapper.find('[data-testid="portfolio-change"]');
      expect(change.text()).toContain('+$150.00');
      expect(change.text()).toContain('+2.05%');
      expect(change.classes()).toContain('text-green-500');
    });

    it('should show portfolio history chart', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="portfolio-history-chart"]').exists()).toBe(true);
      
      const timeframes = wrapper.findAll('[data-testid^="timeframe-"]');
      expect(timeframes.length).toBeGreaterThan(0);
    });
  });

  describe('Quick Actions', () => {
    it('should display quick action buttons', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="quick-send"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="quick-receive"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="quick-swap"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="quick-buy"]').exists()).toBe(true);
    });

    it('should open send modal', async () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="quick-send"]').trigger('click');
      
      expect(wrapper.find('[data-testid="send-modal"]').exists()).toBe(true);
    });

    it('should navigate to swap page', async () => {
      const pushSpy = vi.spyOn(router, 'push');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="quick-swap"]').trigger('click');
      
      expect(pushSpy).toHaveBeenCalledWith({ name: 'swap' });
    });

    it('should show receive QR code', async () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="quick-receive"]').trigger('click');
      
      const modal = wrapper.find('[data-testid="receive-modal"]');
      expect(modal.exists()).toBe(true);
      expect(modal.find('[data-testid="qr-code"]').exists()).toBe(true);
      expect(modal.find('[data-testid="receive-address"]').text())
        .toContain(mockWallet.address);
    });
  });

  describe('Recent Activity', () => {
    it('should display recent transactions', () => {
      walletStore.recentTransactions = [
        {
          hash: '0x123...',
          type: 'send',
          amount: '100',
          token: 'USDC',
          timestamp: Date.now() - 3600000
        },
        {
          hash: '0x456...',
          type: 'receive',
          amount: '50',
          token: 'XOM',
          timestamp: Date.now() - 7200000
        }
      ];

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const transactions = wrapper.findAll('[data-testid^="transaction-"]');
      expect(transactions).toHaveLength(2);
      expect(transactions[0].text()).toContain('100 USDC');
    });

    it('should show empty state for no activity', () => {
      walletStore.recentTransactions = [];

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="no-activity"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="no-activity"]').text())
        .toContain('No recent activity');
    });

    it('should navigate to transaction details', async () => {
      walletStore.recentTransactions = [{
        hash: '0x123...',
        type: 'send',
        amount: '100',
        token: 'USDC',
        timestamp: Date.now()
      }];

      const pushSpy = vi.spyOn(router, 'push');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="transaction-0"]').trigger('click');
      
      expect(pushSpy).toHaveBeenCalledWith({
        name: 'transaction',
        params: { hash: '0x123...' }
      });
    });

    it('should refresh activity', async () => {
      const refreshSpy = vi.spyOn(walletStore, 'refreshActivity');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="refresh-activity"]').trigger('click');
      
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('Token Summary', () => {
    it('should show top tokens', () => {
      tokenStore.topTokens = [
        { symbol: 'XOM', balance: '100', value: 15000 },
        { symbol: 'USDC', balance: '1000', value: 1000 },
        { symbol: 'ETH', balance: '1', value: 2000 }
      ];

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const tokenSummary = wrapper.find('[data-testid="token-summary"]');
      expect(tokenSummary.exists()).toBe(true);
      
      const tokens = tokenSummary.findAll('[data-testid^="token-summary-"]');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].text()).toContain('XOM');
    });

    it('should navigate to tokens page', async () => {
      const pushSpy = vi.spyOn(router, 'push');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="view-all-tokens"]').trigger('click');
      
      expect(pushSpy).toHaveBeenCalledWith({ name: 'tokens' });
    });
  });

  describe('NFT Preview', () => {
    it('should show NFT collection preview', () => {
      nftStore.featuredNFTs = [
        { id: '1', name: 'NFT 1', image: 'https://example.com/1.png' },
        { id: '2', name: 'NFT 2', image: 'https://example.com/2.png' },
        { id: '3', name: 'NFT 3', image: 'https://example.com/3.png' }
      ];

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const nftPreview = wrapper.find('[data-testid="nft-preview"]');
      expect(nftPreview.exists()).toBe(true);
      
      const nfts = nftPreview.findAll('[data-testid^="nft-preview-"]');
      expect(nfts.length).toBeGreaterThan(0);
    });

    it('should navigate to NFT gallery', async () => {
      const pushSpy = vi.spyOn(router, 'push');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="view-all-nfts"]').trigger('click');
      
      expect(pushSpy).toHaveBeenCalledWith({ name: 'nfts' });
    });
  });

  describe('Notifications', () => {
    it('should show notification badge', () => {
      walletStore.unreadNotifications = 3;

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const badge = wrapper.find('[data-testid="notification-badge"]');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toBe('3');
    });

    it('should display notification panel', async () => {
      walletStore.notifications = [
        {
          id: '1',
          type: 'transaction',
          message: 'Transaction confirmed',
          timestamp: Date.now()
        }
      ];

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="notification-bell"]').trigger('click');
      
      const panel = wrapper.find('[data-testid="notification-panel"]');
      expect(panel.exists()).toBe(true);
      expect(panel.text()).toContain('Transaction confirmed');
    });

    it('should mark notifications as read', async () => {
      const markAsReadSpy = vi.spyOn(walletStore, 'markNotificationsAsRead');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="notification-bell"]').trigger('click');
      await wrapper.find('[data-testid="mark-all-read"]').trigger('click');
      
      expect(markAsReadSpy).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      walletStore.isLoading = true;

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="dashboard-loading"]').exists()).toBe(true);
    });

    it('should handle disconnected state', () => {
      walletStore.isConnected = false;

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="connect-prompt"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="connect-prompt"]').text())
        .toContain('Connect your wallet');
    });

    it('should display error banner', () => {
      walletStore.error = 'Network connection failed';

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      const errorBanner = wrapper.find('[data-testid="error-banner"]');
      expect(errorBanner.exists()).toBe(true);
      expect(errorBanner.text()).toContain('Network connection failed');
    });

    it('should retry on error', async () => {
      walletStore.error = 'Failed to load data';
      const retrySpy = vi.spyOn(walletStore, 'retryConnection');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="retry-button"]').trigger('click');
      
      expect(retrySpy).toHaveBeenCalled();
    });
  });

  describe('Settings Shortcut', () => {
    it('should show settings gear', () => {
      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      expect(wrapper.find('[data-testid="settings-gear"]').exists()).toBe(true);
    });

    it('should navigate to settings', async () => {
      const pushSpy = vi.spyOn(router, 'push');

      wrapper = mount(Dashboard, {
        global: {
          plugins: [createPinia(), router]
        }
      });

      await wrapper.find('[data-testid="settings-gear"]').trigger('click');
      
      expect(pushSpy).toHaveBeenCalledWith({ name: 'settings' });
    });
  });
});