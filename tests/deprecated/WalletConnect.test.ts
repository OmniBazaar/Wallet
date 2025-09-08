/**
 * WalletConnect Component Tests
 * Tests for the wallet connection UI component
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WalletConnect from '../../src/components/WalletConnect.vue';
import { useWalletStore } from '../../src/stores/wallet';
import { mockWallet } from '../setup';

describe('WalletConnect Component', () => {
  let wrapper: VueWrapper;
  let walletStore: ReturnType<typeof useWalletStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    walletStore = useWalletStore();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe('Connection Button', () => {
    it('should render connect button when not connected', () => {
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      const button = wrapper.find('[data-testid="connect-button"]');
      expect(button.exists()).toBe(true);
      expect(button.text()).toContain('Connect Wallet');
    });

    it('should show address when connected', async () => {
      walletStore.isConnected = true;
      walletStore.address = mockWallet.address;

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain(mockWallet.address.slice(0, 6));
      expect(wrapper.text()).toContain(mockWallet.address.slice(-4));
    });

    it('should handle connection click', async () => {
      const connectSpy = vi.spyOn(walletStore, 'connect');
      
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="connect-button"]').trigger('click');
      
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should show loading state during connection', async () => {
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      walletStore.isConnecting = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="connect-button"]').attributes('disabled')).toBeDefined();
    });

    it('should handle disconnection', async () => {
      walletStore.isConnected = true;
      walletStore.address = mockWallet.address;

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      const disconnectSpy = vi.spyOn(walletStore, 'disconnect');
      
      await wrapper.find('[data-testid="disconnect-button"]').trigger('click');
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Network Display', () => {
    it('should display current network', async () => {
      walletStore.isConnected = true;
      walletStore.currentNetwork = 'ethereum';

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="network-display"]').text()).toContain('Ethereum');
    });

    it('should show network dropdown when clicked', async () => {
      walletStore.isConnected = true;

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="network-selector"]').trigger('click');
      
      expect(wrapper.find('[data-testid="network-dropdown"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="network-option"]').length).toBeGreaterThan(0);
    });

    it('should handle network switch', async () => {
      walletStore.isConnected = true;
      const switchNetworkSpy = vi.spyOn(walletStore, 'switchNetwork');

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="network-selector"]').trigger('click');
      await wrapper.find('[data-testid="network-option-avalanche"]').trigger('click');
      
      expect(switchNetworkSpy).toHaveBeenCalledWith('avalanche');
    });

    it('should show network error state', async () => {
      walletStore.isConnected = true;
      walletStore.networkError = 'Network not supported';

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="network-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="network-error"]').text()).toContain('Network not supported');
    });
  });

  describe('Balance Display', () => {
    it('should show wallet balance', async () => {
      walletStore.isConnected = true;
      walletStore.balance = {
        native: '1.234',
        usd: '2468.00'
      };

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="balance-native"]').text()).toContain('1.234');
      expect(wrapper.find('[data-testid="balance-usd"]').text()).toContain('$2,468.00');
    });

    it('should refresh balance on click', async () => {
      walletStore.isConnected = true;
      const refreshBalanceSpy = vi.spyOn(walletStore, 'refreshBalance');

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="refresh-balance"]').trigger('click');
      
      expect(refreshBalanceSpy).toHaveBeenCalled();
    });

    it('should show loading state while fetching balance', async () => {
      walletStore.isConnected = true;
      walletStore.isLoadingBalance = true;

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="balance-loading"]').exists()).toBe(true);
    });
  });

  describe('Account Menu', () => {
    it('should show account menu when connected', async () => {
      walletStore.isConnected = true;
      walletStore.address = mockWallet.address;

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="account-button"]').trigger('click');
      
      expect(wrapper.find('[data-testid="account-menu"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="copy-address"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="view-explorer"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="account-settings"]').exists()).toBe(true);
    });

    it('should copy address to clipboard', async () => {
      walletStore.isConnected = true;
      walletStore.address = mockWallet.address;

      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextSpy
        }
      });

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="account-button"]').trigger('click');
      await wrapper.find('[data-testid="copy-address"]').trigger('click');
      
      expect(writeTextSpy).toHaveBeenCalledWith(mockWallet.address);
      expect(wrapper.find('[data-testid="copy-success"]').exists()).toBe(true);
    });

    it('should open explorer link', async () => {
      walletStore.isConnected = true;
      walletStore.address = mockWallet.address;
      walletStore.currentNetwork = 'ethereum';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="account-button"]').trigger('click');
      await wrapper.find('[data-testid="view-explorer"]').trigger('click');
      
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('etherscan.io'),
        '_blank'
      );
    });
  });

  describe('Error Handling', () => {
    it('should display connection error', async () => {
      walletStore.connectionError = 'User rejected connection';

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="error-message"]').text()).toContain('User rejected connection');
    });

    it('should clear error on dismiss', async () => {
      walletStore.connectionError = 'Error message';
      const clearErrorSpy = vi.spyOn(walletStore, 'clearError');

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="dismiss-error"]').trigger('click');
      
      expect(clearErrorSpy).toHaveBeenCalled();
    });

    it('should retry connection after error', async () => {
      walletStore.connectionError = 'Connection failed';
      const connectSpy = vi.spyOn(walletStore, 'connect');

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="retry-connection"]').trigger('click');
      
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('Multi-Wallet Support', () => {
    it('should show wallet selection modal', async () => {
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="connect-button"]').trigger('click');
      
      expect(wrapper.find('[data-testid="wallet-modal"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="wallet-option-metamask"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="wallet-option-walletconnect"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="wallet-option-omnibazaar"]').exists()).toBe(true);
    });

    it('should connect with selected wallet', async () => {
      const connectWithWalletSpy = vi.spyOn(walletStore, 'connectWithWallet');

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="connect-button"]').trigger('click');
      await wrapper.find('[data-testid="wallet-option-metamask"]').trigger('click');
      
      expect(connectWithWalletSpy).toHaveBeenCalledWith('metamask');
    });

    it('should show wallet not detected message', async () => {
      walletStore.availableWallets = [];

      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="connect-button"]').trigger('click');
      
      expect(wrapper.find('[data-testid="no-wallet-detected"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="install-wallet-link"]').exists()).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="connect-button"]').attributes('aria-label')).toBeDefined();
      expect(wrapper.find('[data-testid="connect-button"]').attributes('role')).toBe('button');
    });

    it('should be keyboard navigable', async () => {
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      const button = wrapper.find('[data-testid="connect-button"]');
      
      await button.trigger('keydown.enter');
      expect(wrapper.find('[data-testid="wallet-modal"]').exists()).toBe(true);
      
      await wrapper.trigger('keydown.escape');
      expect(wrapper.find('[data-testid="wallet-modal"]').exists()).toBe(false);
    });

    it('should manage focus properly', async () => {
      wrapper = mount(WalletConnect, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="connect-button"]').trigger('click');
      
      const modal = wrapper.find('[data-testid="wallet-modal"]');
      expect(document.activeElement).toBe(modal.element);
    });
  });
});