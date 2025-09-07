<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Convert XOM ↔ pXOM</h2>
        <button class="close-button" @click="$emit('close')">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Conversion Type Selector -->
        <div class="conversion-type">
          <button 
            class="type-button"
            :class="{ active: conversionType === 'xom-to-pxom' }"
            @click="conversionType = 'xom-to-pxom'"
          >
            XOM → pXOM
          </button>
          <button 
            class="type-button"
            :class="{ active: conversionType === 'pxom-to-xom' }"
            @click="conversionType = 'pxom-to-xom'"
          >
            pXOM → XOM
          </button>
        </div>
        
        <!-- Amount Input -->
        <div class="input-group">
          <label class="input-label">Amount</label>
          <div class="input-wrapper">
            <input 
              v-model="amount"
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.0"
              class="amount-input"
            >
            <span class="input-suffix">{{ fromToken }}</span>
          </div>
          <div class="balance-info">
            Available: {{ availableBalance }} {{ fromToken }}
          </div>
        </div>
        
        <!-- Conversion Info -->
        <div class="conversion-info">
          <div class="info-row">
            <span class="info-label">You will receive:</span>
            <span class="info-value">{{ calculateReceiveAmount() }} {{ toToken }}</span>
          </div>
          <div v-if="conversionType === 'xom-to-pxom'" class="info-row">
            <span class="info-label">Conversion fee (0.5%):</span>
            <span class="info-value fee">{{ calculateFee() }} XOM</span>
          </div>
          <div v-else class="info-row">
            <span class="info-label">Conversion fee:</span>
            <span class="info-value success">No fee</span>
          </div>
        </div>
        
        <!-- Privacy Notice -->
        <div class="privacy-notice" v-if="conversionType === 'xom-to-pxom'">
          <div class="notice-icon">🔒</div>
          <div class="notice-text">
            <strong>Privacy Mode</strong><br>
            Converting to pXOM enables private transactions using COTI V2 Garbled Circuits. 
            Your balance and transaction amounts will be encrypted on-chain.
          </div>
        </div>
        
        <div class="privacy-notice info" v-else>
          <div class="notice-icon">👁</div>
          <div class="notice-text">
            <strong>Public Mode</strong><br>
            Converting to XOM makes your balance publicly visible on the blockchain. 
            There is no fee for converting pXOM back to XOM.
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="$emit('close')">
            Cancel
          </button>
          <button 
            class="btn btn-primary"
            :disabled="!canConvert"
            @click="performConversion"
          >
            {{ isConverting ? 'Converting...' : 'Convert' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useWalletStore } from '@/stores/wallet';

// Props
interface Props {
  show: boolean;
  xomBalance: string;
  pxomBalance: string;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  close: [];
  converted: [type: string, amount: string];
}>();

// State
const walletStore = useWalletStore();
const conversionType = ref<'xom-to-pxom' | 'pxom-to-xom'>('xom-to-pxom');
const amount = ref('');
const isConverting = ref(false);

// Computed
const fromToken = computed(() => 
  conversionType.value === 'xom-to-pxom' ? 'XOM' : 'pXOM'
);

const toToken = computed(() => 
  conversionType.value === 'xom-to-pxom' ? 'pXOM' : 'XOM'
);

const availableBalance = computed(() => 
  conversionType.value === 'xom-to-pxom' 
    ? props.xomBalance 
    : props.pxomBalance
);

const canConvert = computed(() => {
  const amountNum = parseFloat(amount.value);
  const balanceNum = parseFloat(availableBalance.value);
  return amountNum > 0 && amountNum <= balanceNum && !isConverting.value;
});

// Methods
function calculateFee(): string {
  if (conversionType.value !== 'xom-to-pxom') return '0';
  const amountNum = parseFloat(amount.value) || 0;
  return (amountNum * 0.005).toFixed(6); // 0.5% fee
}

function calculateReceiveAmount(): string {
  const amountNum = parseFloat(amount.value) || 0;
  if (conversionType.value === 'xom-to-pxom') {
    // Subtract 0.5% fee
    return (amountNum * 0.995).toFixed(6);
  } else {
    // No fee for pXOM to XOM
    return amountNum.toFixed(6);
  }
}

async function performConversion(): Promise<void> {
  if (!canConvert.value) return;
  
  isConverting.value = true;
  
  try {
    const provider = await walletStore.getProvider();
    const address = walletStore.currentAccount?.address;
    
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }
    
    let txHash: string;
    
    if (conversionType.value === 'xom-to-pxom') {
      // Convert XOM to pXOM
      txHash = await provider.request({
        method: 'coti_convertXOMToPXOM',
        params: [amount.value, address]
      });
    } else {
      // Convert pXOM to XOM
      txHash = await provider.request({
        method: 'coti_convertPXOMToXOM',
        params: [amount.value, address]
      });
    }
    
    console.log('Conversion transaction:', txHash);
    
    // Emit success event
    emit('converted', conversionType.value, amount.value);
    
    // Reset and close
    amount.value = '';
    emit('close');
    
    // Refresh balances
    await walletStore.refreshWalletState();
    
  } catch (error) {
    console.error('Conversion failed:', error);
    alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    isConverting.value = false;
  }
}

// Reset amount when conversion type changes
watch(conversionType, () => {
  amount.value = '';
});
</script>

<style scoped>
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

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
}

.modal-body {
  padding: 20px;
}

.conversion-type {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 24px;
}

.type-button {
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.type-button.active {
  border-color: #667eea;
  background: #667eea;
  color: white;
}

.input-group {
  margin-bottom: 20px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.input-wrapper {
  display: flex;
  align-items: center;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  transition: border-color 0.2s;
}

.input-wrapper:focus-within {
  border-color: #667eea;
}

.amount-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  font-weight: 500;
}

.input-suffix {
  color: #6b7280;
  font-weight: 500;
  margin-left: 8px;
}

.balance-info {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.conversion-info {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.info-label {
  font-size: 14px;
  color: #6b7280;
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.info-value.fee {
  color: #ef4444;
}

.info-value.success {
  color: #10b981;
}

.privacy-notice {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 20px;
}

.privacy-notice.info {
  background: #dbeafe;
  border-color: #60a5fa;
}

.notice-icon {
  font-size: 20px;
}

.notice-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a67d8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>