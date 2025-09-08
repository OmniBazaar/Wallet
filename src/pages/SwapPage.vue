<template>
  <div class="swap-page">
    <h1>Swap Tokens</h1>
    
    <!-- Swap Form -->
    <div data-testid="swap-form" class="swap-form">
      <!-- From Token -->
      <div class="token-section">
        <label>From</label>
        <div class="token-input-group">
          <input
            v-model="fromAmount"
            @input="handleAmountInput"
            type="number"
            placeholder="0.0"
            data-testid="amount-input"
            class="amount-input"
          />
          <button
            @click="showFromTokenSelect = true"
            data-testid="select-token-from"
            class="token-select-btn"
          >
            <span v-if="fromToken" data-testid="token-from-display">
              {{ fromToken.symbol }}
            </span>
            <span v-else>Select Token</span>
            <span class="chevron">▼</span>
          </button>
        </div>
        <div class="balance-info">
          <span>Balance: {{ getBalance(fromToken) }}</span>
          <button
            v-if="fromToken"
            @click="setMaxAmount"
            data-testid="max-button"
            class="max-btn"
          >
            MAX
          </button>
        </div>
      </div>

      <!-- Switch Button -->
      <button
        @click="switchTokens"
        data-testid="switch-tokens"
        class="switch-btn"
      >
        ⇅
      </button>

      <!-- To Token -->
      <div class="token-section">
        <label>To</label>
        <div class="token-input-group">
          <div data-testid="amount-out" class="amount-output">
            {{ formatAmount(toAmount) }}
          </div>
          <button
            @click="showToTokenSelect = true"
            data-testid="select-token-to"
            class="token-select-btn"
          >
            <span v-if="toToken" data-testid="token-to-display">
              {{ toToken.symbol }}
            </span>
            <span v-else>Select Token</span>
            <span class="chevron">▼</span>
          </button>
        </div>
      </div>

      <!-- Swap Details -->
      <div v-if="swapStore.quote" class="swap-details">
        <div v-if="swapStore.quote.rate" data-testid="exchange-rate" class="detail-row">
          <span>Rate</span>
          <span>1 {{ fromToken?.symbol }} = {{ swapStore.quote.rate }} {{ toToken?.symbol }}</span>
        </div>
        
        <div v-if="swapStore.quote.priceImpact !== undefined" 
             data-testid="price-impact" 
             :class="['detail-row', getPriceImpactClass(swapStore.quote.priceImpact)]">
          <span>Price Impact</span>
          <span>{{ swapStore.quote.priceImpact }}%</span>
        </div>
        
        <div v-if="swapStore.quote.priceImpact > 3" 
             data-testid="high-impact-warning" 
             class="warning">
          High price impact! Your swap may result in significant loss.
        </div>
        
        <button @click="showRoute = !showRoute" data-testid="show-route" class="show-route-btn">
          {{ showRoute ? 'Hide' : 'Show' }} Route
        </button>
        
        <div v-if="showRoute && swapStore.quote.route" data-testid="route-details" class="route-details">
          {{ swapStore.quote.route.join(' → ') }}
        </div>
      </div>

      <!-- Gas Estimate -->
      <div v-if="swapStore.gasEstimate" data-testid="gas-estimate" class="gas-estimate">
        <span>Estimated Gas:</span>
        <span>${{ swapStore.gasEstimate.totalCostUSD }}</span>
      </div>

      <!-- Settings Button -->
      <button @click="showSettings = !showSettings" data-testid="settings-button" class="settings-btn">
        ⚙️ Settings
      </button>

      <!-- Slippage Settings -->
      <div v-if="showSettings" data-testid="slippage-settings" class="settings-panel">
        <div class="slippage-section">
          <label>Slippage Tolerance</label>
          <div class="slippage-options">
            <button
              v-for="preset in [0.1, 0.5, 1.0]"
              :key="preset"
              @click="setSlippage(preset)"
              :data-testid="`slippage-${preset}`"
              :class="['slippage-btn', { active: swapStore.slippage === preset }]"
            >
              {{ preset }}%
            </button>
            <input
              v-model.number="customSlippage"
              @input="setCustomSlippage"
              type="number"
              step="0.1"
              placeholder="Custom"
              data-testid="custom-slippage"
              class="custom-slippage-input"
            />
          </div>
          <div v-if="swapStore.slippage > 5" data-testid="high-slippage-warning" class="warning">
            High slippage tolerance may result in unfavorable rates
          </div>
          <div data-testid="slippage-display" class="current-slippage">
            Current: {{ swapStore.slippage }}%
          </div>
        </div>
        
        <div class="deadline-section">
          <label>Transaction Deadline (minutes)</label>
          <input
            v-model.number="swapStore.deadline"
            type="number"
            min="1"
            max="60"
            data-testid="deadline-input"
            class="deadline-input"
          />
        </div>
        
        <div class="expert-mode-section">
          <label>
            <input
              v-model="swapStore.expertMode"
              type="checkbox"
              data-testid="expert-mode"
            />
            Expert Mode
          </label>
          <div v-if="swapStore.expertMode" data-testid="expert-warning" class="warning">
            Expert mode allows high slippage trades. Use at your own risk!
          </div>
        </div>
      </div>

      <!-- Error Messages -->
      <div v-if="swapStore.error" data-testid="error-message" class="error-message">
        {{ swapStore.error }}
      </div>
      <div v-if="swapStore.error === 'Insufficient liquidity'" data-testid="liquidity-error" class="error-message">
        Not enough liquidity for this trade. Try a smaller amount.
      </div>

      <!-- Transaction Status -->
      <div v-if="swapStore.transactionStatus === 'pending'" data-testid="transaction-pending" class="tx-status">
        Transaction pending...
        <div v-if="swapStore.transactionHash" data-testid="transaction-hash" class="tx-hash">
          {{ swapStore.transactionHash }}
        </div>
      </div>

      <!-- Swap Button -->
      <button
        @click="handleSwap"
        :disabled="!canSwap"
        data-testid="swap-button"
        class="swap-btn"
      >
        {{ swapButtonText }}
      </button>
    </div>

    <!-- Recent Swaps -->
    <div v-if="swapStore.recentSwaps?.length > 0" data-testid="swap-history" class="swap-history">
      <h2>Recent Swaps</h2>
      <div v-for="(swap, index) in swapStore.recentSwaps" :key="swap.id" class="swap-history-item">
        <div class="swap-info">
          {{ swap.amountIn }} {{ swap.tokenIn }} → {{ swap.amountOut }} {{ swap.tokenOut }}
        </div>
        <button
          @click="repeatSwap(swap)"
          :data-testid="`repeat-swap-${index}`"
          class="repeat-btn"
        >
          Repeat
        </button>
      </div>
    </div>

    <!-- Token Select Modal -->
    <div v-if="showFromTokenSelect || showToTokenSelect" class="modal-overlay" @click="closeTokenSelect">
      <div class="token-select-modal" @click.stop>
        <h3>Select Token</h3>
        <div class="token-list">
          <div
            v-for="token in availableTokens"
            :key="token.address"
            @click="selectToken(token)"
            :data-testid="`token-option-${token.symbol}`"
            class="token-option"
          >
            {{ token.symbol }}
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmation" data-testid="confirmation-modal" class="modal-overlay">
      <div class="confirmation-modal">
        <h3>Confirm Swap</h3>
        <div class="swap-summary">
          <p>{{ fromAmount }} {{ fromToken?.symbol }}</p>
          <p>↓</p>
          <p>{{ formatAmount(toAmount) }} {{ toToken?.symbol }}</p>
        </div>
        <button @click="confirmSwap" class="confirm-btn">Confirm</button>
        <button @click="showConfirmation = false" class="cancel-btn">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Swap Page Component
 * Interface for swapping tokens with DEX integration
 */
import { ref, computed, watch } from 'vue';
import { useSwapStore } from '../stores/swap';
import { useWalletStore } from '../stores/wallet';
import { ethers } from 'ethers';

// Types
interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

// Store
const swapStore = useSwapStore();
const walletStore = useWalletStore();

// Refs
const fromAmount = ref('');
const toAmount = ref('');
const fromToken = ref<Token | null>(null);
const toToken = ref<Token | null>(null);
const showFromTokenSelect = ref(false);
const showToTokenSelect = ref(false);
const showSettings = ref(false);
const showRoute = ref(false);
const showConfirmation = ref(false);
const customSlippage = ref('');

// Computed
const availableTokens = computed(() => swapStore.availableTokens || []);

const canSwap = computed(() => {
  return fromToken.value && 
         toToken.value && 
         fromAmount.value && 
         parseFloat(fromAmount.value) > 0 &&
         !swapStore.error &&
         swapStore.transactionStatus !== 'pending';
});

const swapButtonText = computed(() => {
  if (!walletStore.isConnected) return 'Connect Wallet';
  if (!fromToken.value || !toToken.value) return 'Select Tokens';
  if (!fromAmount.value || parseFloat(fromAmount.value) === 0) return 'Enter Amount';
  if (swapStore.needsApproval) return `Approve ${fromToken.value.symbol}`;
  if (swapStore.transactionStatus === 'pending') return 'Swapping...';
  return 'Swap';
});

// Methods
const formatAmount = (amount: string | bigint | undefined): string => {
  if (!amount) return '0.0';
  if (typeof amount === 'bigint') {
    return ethers.formatEther(amount);
  }
  return amount;
};

const getBalance = (token: Token | null): string => {
  if (!token) return '0.0';
  const balance = swapStore.balances?.[token.address];
  if (!balance) return '0.0';
  return ethers.formatUnits(balance, token.decimals);
};

const setMaxAmount = () => {
  if (!fromToken.value) return;
  fromAmount.value = getBalance(fromToken.value);
};

const switchTokens = () => {
  const temp = fromToken.value;
  fromToken.value = toToken.value;
  toToken.value = temp;
  fromAmount.value = '';
  toAmount.value = '';
};

const selectToken = (token: Token) => {
  if (showFromTokenSelect.value) {
    fromToken.value = token;
    showFromTokenSelect.value = false;
  } else if (showToTokenSelect.value) {
    toToken.value = token;
    showToTokenSelect.value = false;
  }
};

const closeTokenSelect = () => {
  showFromTokenSelect.value = false;
  showToTokenSelect.value = false;
};

const handleAmountInput = () => {
  getQuote();
};

const getQuote = async () => {
  if (!fromToken.value || !toToken.value || !fromAmount.value || parseFloat(fromAmount.value) === 0) {
    toAmount.value = '';
    return;
  }

  try {
    const quote = await swapStore.getQuote({
      tokenIn: fromToken.value.address,
      tokenOut: toToken.value.address,
      amountIn: ethers.parseUnits(fromAmount.value, fromToken.value.decimals)
    });
    
    if (quote?.amountOut) {
      toAmount.value = quote.amountOut.toString();
    }
  } catch (error) {
    console.error('Failed to get quote:', error);
  }
};

const setSlippage = (value: number) => {
  swapStore.slippage = value;
  customSlippage.value = '';
};

const setCustomSlippage = () => {
  if (customSlippage.value) {
    swapStore.slippage = parseFloat(customSlippage.value);
  }
};

const getPriceImpactClass = (impact: number): string => {
  if (impact > 5) return 'text-red-500';
  if (impact > 3) return 'text-orange-500';
  return '';
};

const handleSwap = async () => {
  if (!canSwap.value) return;
  
  if (swapStore.needsApproval) {
    await swapStore.approveToken(fromToken.value!.address);
    return;
  }
  
  showConfirmation.value = true;
};

const confirmSwap = async () => {
  showConfirmation.value = false;
  
  if (!fromToken.value || !toToken.value) return;
  
  await swapStore.executeSwap({
    tokenIn: fromToken.value.address,
    tokenOut: toToken.value.address,
    amountIn: ethers.parseUnits(fromAmount.value, fromToken.value.decimals)
  });
};

const repeatSwap = (swap: any) => {
  // Find tokens by address
  fromToken.value = availableTokens.value.find(t => t.address === swap.tokenIn) || null;
  toToken.value = availableTokens.value.find(t => t.address === swap.tokenOut) || null;
  fromAmount.value = swap.amountIn;
  getQuote();
};

// Watch for quote updates
let quoteDebounce: ReturnType<typeof setTimeout>;
watch(fromAmount, () => {
  clearTimeout(quoteDebounce);
  quoteDebounce = setTimeout(getQuote, 500);
});
</script>

<style scoped>
.swap-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem;
}

.swap-form {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.token-section {
  margin-bottom: 1rem;
}

.token-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.token-input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.amount-input,
.amount-output {
  flex: 1;
  padding: 0.75rem;
  font-size: 1.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
}

.amount-output {
  display: flex;
  align-items: center;
}

.token-select-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.token-select-btn:hover {
  background: var(--bg-tertiary);
}

.chevron {
  font-size: 0.75rem;
}

.balance-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.max-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-weight: 500;
}

.switch-btn {
  display: block;
  margin: 1rem auto;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1.5rem;
  cursor: pointer;
}

.swap-details {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.text-red-500 { color: #ef4444; }
.text-orange-500 { color: #f97316; }

.warning {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.show-route-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.875rem;
  text-decoration: underline;
}

.route-details {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.gas-estimate {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.settings-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  margin: 1rem 0;
}

.settings-panel {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.slippage-section,
.deadline-section,
.expert-mode-section {
  margin-bottom: 1rem;
}

.slippage-section label,
.deadline-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.slippage-options {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.slippage-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

.slippage-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.custom-slippage-input,
.deadline-input {
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  width: 80px;
}

.current-slippage {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 1rem 0;
}

.tx-status {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 1rem 0;
  text-align: center;
}

.tx-hash {
  font-family: monospace;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.swap-btn {
  width: 100%;
  padding: 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.swap-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.swap-btn:disabled {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.swap-history {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
}

.swap-history h2 {
  margin-bottom: 1rem;
}

.swap-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.swap-info {
  font-size: 0.875rem;
}

.repeat-btn {
  padding: 0.25rem 0.75rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.token-select-modal,
.confirmation-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
}

.token-list {
  max-height: 300px;
  overflow-y: auto;
}

.token-option {
  padding: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.token-option:hover {
  background: var(--bg-tertiary);
}

.swap-summary {
  text-align: center;
  margin: 1.5rem 0;
  font-size: 1.125rem;
}

.confirm-btn,
.cancel-btn {
  width: 48%;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin: 0.25rem;
}

.confirm-btn {
  background: var(--primary-color);
  color: white;
}

.cancel-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
</style>