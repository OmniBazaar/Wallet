/**
 * TokenList Component Tests
 * Tests for the token list display component
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TokenList from '../../src/components/TokenList.vue';
import { useTokenStore } from '../../src/stores/tokens';
import { MOCK_TOKENS } from '../setup';

describe('TokenList Component', () => {
  let wrapper: VueWrapper;
  let tokenStore: ReturnType<typeof useTokenStore>;

  const mockTokens = [
    {
      address: MOCK_TOKENS.ethereum.USDC.address,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      balance: '1000000000', // 1000 USDC
      balanceFormatted: '1000.00',
      price: 1.00,
      value: 1000.00,
      change24h: 0.01,
      logo: 'https://example.com/usdc.png'
    },
    {
      address: MOCK_TOKENS.ethereum.USDT.address,
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      balance: '500000000', // 500 USDT
      balanceFormatted: '500.00',
      price: 0.999,
      value: 499.50,
      change24h: -0.05,
      logo: 'https://example.com/usdt.png'
    },
    {
      address: '0xXOM',
      symbol: 'XOM',
      name: 'OmniCoin',
      decimals: 18,
      balance: '10000000000000000000', // 10 XOM
      balanceFormatted: '10.00',
      price: 150.00,
      value: 1500.00,
      change24h: 5.25,
      logo: 'https://example.com/xom.png'
    }
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    tokenStore = useTokenStore();
    tokenStore.tokens = mockTokens;
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe('Token Display', () => {
    it('should render all tokens', () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const tokenItems = wrapper.findAll('[data-testid="token-item"]');
      expect(tokenItems).toHaveLength(3);
    });

    it('should display token information correctly', () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const firstToken = wrapper.find('[data-testid="token-item-0"]');
      
      expect(firstToken.find('[data-testid="token-symbol"]').text()).toBe('USDC');
      expect(firstToken.find('[data-testid="token-name"]').text()).toBe('USD Coin');
      expect(firstToken.find('[data-testid="token-balance"]').text()).toBe('1,000.00');
      expect(firstToken.find('[data-testid="token-value"]').text()).toContain('$1,000.00');
    });

    it('should show token logos', () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const logos = wrapper.findAll('[data-testid="token-logo"]');
      expect(logos).toHaveLength(3);
      expect(logos[0].attributes('src')).toBe('https://example.com/usdc.png');
    });

    it('should display price changes', () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const priceChanges = wrapper.findAll('[data-testid="token-price-change"]');
      
      expect(priceChanges[0].text()).toContain('+0.01%');
      expect(priceChanges[0].classes()).toContain('text-green-500');
      
      expect(priceChanges[1].text()).toContain('-0.05%');
      expect(priceChanges[1].classes()).toContain('text-red-500');
      
      expect(priceChanges[2].text()).toContain('+5.25%');
      expect(priceChanges[2].classes()).toContain('text-green-500');
    });

    it('should show total portfolio value', () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const totalValue = wrapper.find('[data-testid="portfolio-total"]');
      expect(totalValue.text()).toContain('$2,999.50'); // Sum of all token values
    });
  });

  describe('Token Filtering', () => {
    it('should filter tokens by search', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const searchInput = wrapper.find('[data-testid="token-search"]');
      await searchInput.setValue('USDC');

      const visibleTokens = wrapper.findAll('[data-testid="token-item"]:visible');
      expect(visibleTokens).toHaveLength(1);
      expect(visibleTokens[0].find('[data-testid="token-symbol"]').text()).toBe('USDC');
    });

    it('should filter by minimum value', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="filter-button"]').trigger('click');
      await wrapper.find('[data-testid="min-value-input"]').setValue('500');
      await wrapper.find('[data-testid="apply-filter"]').trigger('click');

      const visibleTokens = wrapper.findAll('[data-testid="token-item"]:visible');
      expect(visibleTokens).toHaveLength(2); // USDC and XOM
    });

    it('should toggle zero balance tokens', async () => {
      tokenStore.tokens.push({
        ...mockTokens[0],
        balance: '0',
        balanceFormatted: '0.00',
        value: 0
      });

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.findAll('[data-testid="token-item"]')).toHaveLength(3);

      await wrapper.find('[data-testid="hide-zero-balance"]').trigger('click');
      
      expect(wrapper.findAll('[data-testid="token-item"]:visible')).toHaveLength(3);
    });

    it('should filter by chain', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        },
        props: {
          showChainFilter: true
        }
      });

      await wrapper.find('[data-testid="chain-filter"]').trigger('change', {
        target: { value: 'ethereum' }
      });

      const visibleTokens = wrapper.findAll('[data-testid="token-item"]:visible');
      expect(visibleTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Token Sorting', () => {
    it('should sort by value descending', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="sort-select"]').setValue('value-desc');

      const tokenSymbols = wrapper.findAll('[data-testid="token-symbol"]')
        .map(el => el.text());
      
      expect(tokenSymbols).toEqual(['XOM', 'USDC', 'USDT']);
    });

    it('should sort alphabetically', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="sort-select"]').setValue('name-asc');

      const tokenNames = wrapper.findAll('[data-testid="token-name"]')
        .map(el => el.text());
      
      expect(tokenNames).toEqual(['OmniCoin', 'Tether USD', 'USD Coin']);
    });

    it('should sort by 24h change', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="sort-select"]').setValue('change-desc');

      const tokenSymbols = wrapper.findAll('[data-testid="token-symbol"]')
        .map(el => el.text());
      
      expect(tokenSymbols).toEqual(['XOM', 'USDC', 'USDT']);
    });
  });

  describe('Token Actions', () => {
    it('should open send modal on click', async () => {
      const sendTokenSpy = vi.fn();
      
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()],
          provide: {
            sendToken: sendTokenSpy
          }
        }
      });

      await wrapper.find('[data-testid="token-item-0"]')
        .find('[data-testid="send-button"]').trigger('click');
      
      expect(sendTokenSpy).toHaveBeenCalledWith(mockTokens[0]);
    });

    it('should open receive modal', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="token-item-0"]')
        .find('[data-testid="receive-button"]').trigger('click');
      
      expect(wrapper.find('[data-testid="receive-modal"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="receive-address"]').text())
        .toContain(MOCK_TOKENS.ethereum.USDC.address);
    });

    it('should open swap interface', async () => {
      const router = {
        push: vi.fn()
      };

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $router: router
          }
        }
      });

      await wrapper.find('[data-testid="token-item-0"]')
        .find('[data-testid="swap-button"]').trigger('click');
      
      expect(router.push).toHaveBeenCalledWith({
        name: 'swap',
        query: { from: MOCK_TOKENS.ethereum.USDC.address }
      });
    });

    it('should add custom token', async () => {
      const addTokenSpy = vi.spyOn(tokenStore, 'addCustomToken');

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="add-token-button"]').trigger('click');
      
      const modal = wrapper.find('[data-testid="add-token-modal"]');
      await modal.find('[data-testid="token-address-input"]').setValue('0xnewtoken');
      await modal.find('[data-testid="add-token-confirm"]').trigger('click');
      
      expect(addTokenSpy).toHaveBeenCalledWith('0xnewtoken');
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton', () => {
      tokenStore.isLoading = true;
      tokenStore.tokens = [];

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.findAll('[data-testid="token-skeleton"]').length).toBeGreaterThan(0);
    });

    it('should show refresh button and handle refresh', async () => {
      const refreshTokensSpy = vi.spyOn(tokenStore, 'refreshTokens');

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="refresh-tokens"]').trigger('click');
      
      expect(refreshTokensSpy).toHaveBeenCalled();
    });

    it('should show empty state', () => {
      tokenStore.tokens = [];

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="empty-state"]').text())
        .toContain('No tokens found');
    });
  });

  describe('Token Details', () => {
    it('should expand token details on click', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      const tokenItem = wrapper.find('[data-testid="token-item-0"]');
      await tokenItem.trigger('click');
      
      expect(tokenItem.find('[data-testid="token-details"]').exists()).toBe(true);
      expect(tokenItem.find('[data-testid="token-contract"]').text())
        .toContain(MOCK_TOKENS.ethereum.USDC.address);
    });

    it('should show token transactions', async () => {
      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="token-item-0"]').trigger('click');
      await wrapper.find('[data-testid="view-transactions"]').trigger('click');
      
      expect(wrapper.find('[data-testid="transaction-list"]').exists()).toBe(true);
    });

    it('should copy token address', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextSpy
        }
      });

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="token-item-0"]').trigger('click');
      await wrapper.find('[data-testid="copy-address"]').trigger('click');
      
      expect(writeTextSpy).toHaveBeenCalledWith(MOCK_TOKENS.ethereum.USDC.address);
    });
  });

  describe('Error Handling', () => {
    it('should show error state', () => {
      tokenStore.error = 'Failed to load tokens';

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      expect(wrapper.find('[data-testid="error-state"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="error-message"]').text())
        .toContain('Failed to load tokens');
    });

    it('should retry on error', async () => {
      tokenStore.error = 'Network error';
      const refreshTokensSpy = vi.spyOn(tokenStore, 'refreshTokens');

      wrapper = mount(TokenList, {
        global: {
          plugins: [createPinia()]
        }
      });

      await wrapper.find('[data-testid="retry-button"]').trigger('click');
      
      expect(refreshTokensSpy).toHaveBeenCalled();
    });
  });
});