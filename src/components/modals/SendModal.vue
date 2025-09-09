<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>Send Tokens</h2>
      <button @click="$emit('close')" class="close-btn">×</button>
      
      <!-- Send form content -->
      <div class="send-form">
        <label>Recipient Address</label>
        <input 
          v-model="recipientAddress"
          type="text" 
          placeholder="0x..." 
          class="address-input"
          :class="{ error: addressError }"
        />
        <div v-if="addressError" class="error-message">{{ addressError }}</div>
        
        <label>Amount</label>
        <input 
          v-model="amount"
          type="number" 
          placeholder="0.0" 
          class="amount-input"
          :class="{ error: amountError }"
          step="0.000001"
        />
        <div v-if="amountError" class="error-message">{{ amountError }}</div>
        
        <button 
          class="send-btn" 
          :disabled="!isFormValid"
          @click="handleSend"
        >
          {{ isLoading ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Send Modal Component
 * Modal for sending tokens to another address
 */
import { ref, computed } from 'vue'
import { useWalletStore } from '../../stores/wallet'

const emit = defineEmits(['close'])

const walletStore = useWalletStore()

// Form state
const recipientAddress = ref('')
const amount = ref('')
const isLoading = ref(false)
const addressError = ref('')
const amountError = ref('')

// Computed
const isFormValid = computed(() => {
  return recipientAddress.value.length > 0 && 
         amount.value.length > 0 && 
         addressError.value.length === 0 && 
         amountError.value.length === 0
})

/**
 * Validate recipient address
 */
const validateAddress = (): void => {
  if (recipientAddress.value.length === 0) {
    addressError.value = ''
    return
  }

  // Basic address validation
  if (!recipientAddress.value.startsWith('0x') || recipientAddress.value.length !== 42) {
    addressError.value = 'Invalid address format'
    return
  }

  addressError.value = ''
}

/**
 * Validate amount
 */
const validateAmount = (): void => {
  if (amount.value.length === 0) {
    amountError.value = ''
    return
  }

  const numAmount = parseFloat(amount.value)
  if (isNaN(numAmount) || numAmount <= 0) {
    amountError.value = 'Amount must be greater than 0'
    return
  }

  // Check balance
  const balance = parseFloat(walletStore.balance.toString())
  if (numAmount > balance) {
    amountError.value = 'Insufficient balance'
    return
  }

  amountError.value = ''
}

/**
 * Handle send transaction
 */
const handleSend = async (): Promise<void> => {
  validateAddress()
  validateAmount()

  if (!isFormValid.value) {
    return
  }

  isLoading.value = true

  try {
    // TODO: Implement actual send functionality
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate transaction
    
    // Close modal on success
    emit('close')
  } catch (error) {
    // Handle error
    amountError.value = error instanceof Error ? error.message : 'Transaction failed'
  } finally {
    isLoading.value = false
  }
}

// Watch for input changes
import { watch } from 'vue'
watch(recipientAddress, validateAddress)
watch(amount, validateAmount)
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
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 2rem;
  max-width: 480px;
  width: 90%;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.send-form {
  margin-top: 1.5rem;
}

.send-form label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.address-input,
.amount-input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
}

.address-input.error,
.amount-input.error {
  border-color: #ef4444;
}

.send-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}
</style>