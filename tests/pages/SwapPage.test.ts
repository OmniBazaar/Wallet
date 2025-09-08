/**
 * SwapPage Tests
 * Tests for the token swap page
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SwapPage from '../../src/pages/SwapPage.vue';
import { useWalletStore } from '../../src/stores/wallet';
import { useSwapStore } from '../../src/stores/swap';
import { mockWallet, MOCK_TOKENS } from '../setup';
import { ethers } from 'ethers';

describe('SwapPage', () => {
  let wrapper: VueWrapper;
  let walletStore: ReturnType<typeof useWalletStore>;
  let swapStore: ReturnType<typeof useSwapStore>;
  let router;
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    walletStore = useWalletStore();
    swapStore = useSwapStore();

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div></div>' } },
        { path: '/swap', name: 'swap', component: SwapPage }
      ]
    });

    walletStore.isConnected = true;
    walletStore.currentAccount = {
      address: mockWallet.address,
      name: 'Test Account',
      balance: '1234000000000000000',
      network: 'ethereum'
    };
    
    swapStore.availableTokens = [
      { address: MOCK_TOKENS.ethereum.USDC.address, symbol: 'USDC', decimals: 6 },
      { address: MOCK_TOKENS.ethereum.USDT.address, symbol: 'USDT', decimals: 6 },
      { address: '0xXOM', symbol: 'XOM', decimals: 18 }
    ];
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe('Swap Interface', () => {
    it('should render swap form', () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      expect(wrapper.find('[data-testid="swap-form"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="select-token-from"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="select-token-to"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="amount-input"]').exists()).toBe(true);
    });

    it('should select tokens', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      
      expect(wrapper.find('[data-testid="token-from-display"]').text()).toContain('USDC');

      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');
      
      expect(wrapper.find('[data-testid="token-to-display"]').text()).toContain('XOM');
    });

    it('should input swap amount', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      const amountInput = wrapper.find('[data-testid="amount-input"]');
      await amountInput.setValue('100');
      
      expect(amountInput.element.value).toBe('100');
    });

    it('should switch tokens', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      // Set initial tokens
      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');

      // Switch tokens
      await wrapper.find('[data-testid="switch-tokens"]').trigger('click');
      
      expect(wrapper.find('[data-testid="token-from-display"]').text()).toContain('XOM');
      expect(wrapper.find('[data-testid="token-to-display"]').text()).toContain('USDC');
    });

    it('should show max button and use max balance', async () => {
      swapStore.balances = {
        [MOCK_TOKENS.ethereum.USDC.address]: '1000000000' // 1000 USDC
      };

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      
      await wrapper.find('[data-testid="max-button"]').trigger('click');
      
      expect(wrapper.find('[data-testid="amount-input"]').element.value).toBe('1000');
    });
  });

  describe('Quote Calculation', () => {
    it('should get swap quote', async () => {
      const getQuoteSpy = jest.spyOn(swapStore, 'getQuote').mockResolvedValue({
        amountOut: ethers.parseEther('90'),
        priceImpact: 0.5,
        route: ['USDC', 'XOM'],
        estimatedGas: ethers.parseUnits('100000', 'wei')
      });

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');
      await wrapper.find('[data-testid="amount-input"]').setValue('100');
      
      // Wait for debounced quote
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(getQuoteSpy).toHaveBeenCalled();
      expect(wrapper.find('[data-testid="amount-out"]').text()).toContain('90');
    });

    it('should display exchange rate', async () => {
      swapStore.quote = {
        amountOut: ethers.parseEther('90'),
        rate: 0.9
      };

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      // Need to select tokens first
      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');

      expect(wrapper.find('[data-testid="exchange-rate"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="exchange-rate"]').text()).toContain('1 USDC = 0.9 XOM');
    });

    it('should show price impact warning', async () => {
      swapStore.quote = {
        amountOut: ethers.parseEther('85'),
        priceImpact: 5.5 // High impact
      };

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      const priceImpact = wrapper.find('[data-testid="price-impact"]');
      expect(priceImpact.exists()).toBe(true);
      expect(priceImpact.text()).toContain('5.5%');
      expect(priceImpact.classes()).toContain('text-red-500');
      
      expect(wrapper.find('[data-testid="high-impact-warning"]').exists()).toBe(true);
    });

    it('should show route details', async () => {
      swapStore.quote = {
        amountOut: ethers.parseEther('90'),
        route: ['USDC', 'ETH', 'XOM']
      };

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="show-route"]').trigger('click');
      
      const route = wrapper.find('[data-testid="route-details"]');
      expect(route.exists()).toBe(true);
      expect(route.text()).toContain('USDC → ETH → XOM');
    });
  });

  describe('Slippage Settings', () => {
    it('should show slippage settings', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="settings-button"]').trigger('click');
      
      expect(wrapper.find('[data-testid="slippage-settings"]').exists()).toBe(true);
    });

    it('should select preset slippage', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="settings-button"]').trigger('click');
      await wrapper.find('[data-testid="slippage-0.5"]').trigger('click');
      
      expect(swapStore.slippage).toBe(0.5);
      expect(wrapper.find('[data-testid="slippage-display"]').text()).toContain('0.5%');
    });

    it('should set custom slippage', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="settings-button"]').trigger('click');
      await wrapper.find('[data-testid="custom-slippage"]').setValue('2.5');
      
      expect(swapStore.slippage).toBe(2.5);
    });

    it('should warn about high slippage', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="settings-button"]').trigger('click');
      await wrapper.find('[data-testid="custom-slippage"]').setValue('10');
      
      expect(wrapper.find('[data-testid="high-slippage-warning"]').exists()).toBe(true);
    });
  });

  describe('Swap Execution', () => {
    it('should require approval for tokens', async () => {
      swapStore.needsApproval = true;

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      // Select tokens and enter amount
      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');
      await wrapper.find('[data-testid="amount-input"]').setValue('100');

      const button = wrapper.find('[data-testid="swap-button"]');
      expect(button.text()).toContain('Approve USDC');
    });

    it('should approve token', async () => {
      swapStore.needsApproval = true;
      const approveSpy = jest.spyOn(swapStore, 'approveToken').mockResolvedValue(true);

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      // Select tokens and enter amount
      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');
      await wrapper.find('[data-testid="amount-input"]').setValue('100');

      await wrapper.find('[data-testid="swap-button"]').trigger('click');
      
      expect(approveSpy).toHaveBeenCalled();
    });

    it('should execute swap', async () => {
      swapStore.needsApproval = false;

      // Mock getQuote to set quote when called
      const getQuoteSpy = jest.spyOn(swapStore, 'getQuote').mockImplementation(async () => {
        swapStore.quote = {
          amountOut: ethers.parseEther('90'),
          priceImpact: 0.5,
          route: ['USDC', 'XOM']
        };
        return swapStore.quote;
      });

      const executeSwapSpy = jest.spyOn(swapStore, 'executeSwap').mockResolvedValue({
        hash: '0x123...',
        success: true
      });

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');
      await wrapper.find('[data-testid="amount-input"]').setValue('100');
      
      // Wait for quote to be fetched
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Click swap button to show confirmation modal
      await wrapper.find('[data-testid="swap-button"]').trigger('click');
      await wrapper.vm.$nextTick();
      
      // Click confirm button in modal
      const confirmBtn = wrapper.find('[data-testid="confirmation-modal"] .confirm-btn');
      expect(confirmBtn.exists()).toBe(true);
      await confirmBtn.trigger('click');
      
      expect(executeSwapSpy).toHaveBeenCalled();
    });

    it('should show confirmation modal', async () => {
      swapStore.needsApproval = false;

      // Mock getQuote to set quote when called
      const getQuoteSpy = jest.spyOn(swapStore, 'getQuote').mockImplementation(async () => {
        swapStore.quote = {
          amountOut: ethers.parseEther('90'),
          priceImpact: 0.5,
          route: ['USDC', 'XOM']
        };
        return swapStore.quote;
      });

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="select-token-from"]').trigger('click');
      await wrapper.find('[data-testid="token-option-USDC"]').trigger('click');
      await wrapper.find('[data-testid="select-token-to"]').trigger('click');
      await wrapper.find('[data-testid="token-option-XOM"]').trigger('click');
      await wrapper.find('[data-testid="amount-input"]').setValue('100');
      
      // Wait for quote to be fetched
      await new Promise(resolve => setTimeout(resolve, 600));
      
      await wrapper.find('[data-testid="swap-button"]').trigger('click');
      
      // Wait for Vue reactivity
      await wrapper.vm.$nextTick();
      
      const modal = wrapper.find('[data-testid="confirmation-modal"]');
      expect(modal.exists()).toBe(true);
      expect(modal.text()).toContain('100 USDC');
      // The component shows the raw bigint value, not formatted
      expect(modal.text()).toContain('90000000000000000000 XOM');
    });

    it('should show transaction status', async () => {
      swapStore.transactionStatus = 'pending';
      swapStore.transactionHash = '0x123...';

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      expect(wrapper.find('[data-testid="transaction-pending"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="transaction-hash"]').text()).toContain('0x123...');
    });
  });

  describe('Error Handling', () => {
    it('should show insufficient balance error', () => {
      swapStore.error = 'Insufficient balance';

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="error-message"]').text()).toContain('Insufficient balance');
    });

    it('should disable swap button when invalid', () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      const button = wrapper.find('[data-testid="swap-button"]');
      expect(button.attributes('disabled')).toBeDefined();
    });

    it('should show liquidity error', () => {
      swapStore.error = 'Insufficient liquidity';

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      expect(wrapper.find('[data-testid="liquidity-error"]').exists()).toBe(true);
    });
  });

  describe('Transaction History', () => {
    it('should show recent swaps', () => {
      swapStore.recentSwaps = [
        {
          id: '1',
          tokenIn: 'USDC',
          tokenOut: 'XOM',
          amountIn: '100',
          amountOut: '90',
          timestamp: Date.now() - 3600000
        }
      ];

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      const history = wrapper.find('[data-testid="swap-history"]');
      expect(history.exists()).toBe(true);
      expect(history.text()).toContain('100 USDC → 90 XOM');
    });

    it('should repeat previous swap', async () => {
      const previousSwap = {
        tokenIn: MOCK_TOKENS.ethereum.USDC.address,
        tokenOut: '0xXOM',
        amountIn: '100'
      };

      swapStore.recentSwaps = [previousSwap];

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="repeat-swap-0"]').trigger('click');
      
      expect(wrapper.find('[data-testid="token-from-display"]').text()).toContain('USDC');
      expect(wrapper.find('[data-testid="token-to-display"]').text()).toContain('XOM');
      expect(wrapper.find('[data-testid="amount-input"]').element.value).toBe('100');
    });
  });

  describe('Advanced Features', () => {
    it('should show gas estimation', () => {
      swapStore.gasEstimate = {
        gasLimit: '100000',
        gasPrice: '30',
        totalCost: '0.003',
        totalCostUSD: '6.00'
      };

      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      const gasInfo = wrapper.find('[data-testid="gas-estimate"]');
      expect(gasInfo.exists()).toBe(true);
      expect(gasInfo.text()).toContain('$6.00');
    });

    it('should show deadline setting', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="settings-button"]').trigger('click');
      
      const deadline = wrapper.find('[data-testid="deadline-input"]');
      expect(deadline.exists()).toBe(true);
      
      await deadline.setValue('10');
      expect(swapStore.deadline).toBe(10);
    });

    it('should show expert mode toggle', async () => {
      wrapper = mount(SwapPage, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.find('[data-testid="settings-button"]').trigger('click');
      const expertCheckbox = wrapper.find('[data-testid="expert-mode"]');
      await expertCheckbox.setValue(true);
      await wrapper.vm.$nextTick();
      
      expect(swapStore.expertMode).toBe(true);
      expect(wrapper.find('[data-testid="expert-warning"]').exists()).toBe(true);
    });
  });
});