<template>
  <div class="transaction-container">
    <!-- Purchase Confirmation -->
    <div v-if="transactionType === 'purchase'" class="transaction-card">
      <div class="header">
        <h2>Complete Your Purchase</h2>
        <p>Review your order details below</p>
      </div>

      <!-- Item Details -->
      <div class="item-section">
        <div class="item-card">
          <div class="item-image">
            <img :src="item.image || '/static/images/placeholder.png'" :alt="item.name" />
          </div>
          <div class="item-details">
            <h3>{{ item.name }}</h3>
            <p class="item-description">{{ item.description }}</p>
            <div class="seller-info">
              <span class="seller-label">Sold by:</span>
              <span class="seller-name">{{ item.seller }}</span>
            </div>
          </div>
          <div class="item-price">
            <span class="price-amount">${{ item.price }}</span>
            <span class="price-currency">{{ item.currency || 'USD' }}</span>
          </div>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="summary-section">
        <h3>Order Summary</h3>
        <div class="summary-row">
          <span>Item Price</span>
          <span>${{ item.price }}</span>
        </div>
        <div class="summary-row">
          <span>Service Fee</span>
          <span>${{ calculateServiceFee(item.price) }}</span>
        </div>
        <div class="summary-row">
          <span>Network Fee</span>
          <span>${{ calculateNetworkFee(item.price) }}</span>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <span>${{ calculateTotal() }}</span>
        </div>
      </div>

      <!-- Payment Method -->
      <div class="payment-section">
        <h3>Payment Method</h3>
        <div class="payment-options">
          <label class="payment-option" :class="{ selected: selectedPaymentMethod === 'wallet' }">
            <input 
              type="radio" 
              value="wallet" 
              v-model="selectedPaymentMethod" 
              name="payment"
            />
            <div class="payment-details">
              <div class="payment-icon">💳</div>
              <div class="payment-info">
                <span class="payment-name">OmniBazaar Wallet</span>
                <span class="payment-balance">Balance: ${{ walletBalance }}</span>
              </div>
            </div>
            <div class="payment-selected">✓</div>
          </label>
          
          <label class="payment-option" :class="{ selected: selectedPaymentMethod === 'card' }">
            <input 
              type="radio" 
              value="card" 
              v-model="selectedPaymentMethod" 
              name="payment"
            />
            <div class="payment-details">
              <div class="payment-icon">💳</div>
              <div class="payment-info">
                <span class="payment-name">Credit/Debit Card</span>
                <span class="payment-balance">Visa, Mastercard, etc.</span>
              </div>
            </div>
            <div class="payment-selected">✓</div>
          </label>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="security-notice">
        <div class="security-icon">🔒</div>
        <div class="security-text">
          <strong>Secure Transaction</strong>
          <p>Your payment is protected by OmniBazaar's secure escrow system. 
             Funds are held safely until you confirm receipt of your item.</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="button secondary" @click="$emit('cancel')">
          Cancel
        </button>
        <button 
          class="button primary" 
          @click="processPurchase"
          :disabled="isProcessing || !selectedPaymentMethod"
        >
          <span v-if="isProcessing" class="loading-spinner"></span>
          {{ isProcessing ? 'Processing...' : `Pay $${calculateTotal()}` }}
        </button>
      </div>
    </div>

    <!-- Send Money -->
    <div v-if="transactionType === 'send'" class="transaction-card">
      <div class="header">
        <h2>Send Money</h2>
        <p>Send funds to another OmniBazaar user</p>
      </div>

      <div class="form-section">
        <div class="form-group">
          <label>Send To</label>
          <input
            v-model="sendForm.recipient"
            type="text"
            class="form-input"
            placeholder="Username or address"
          />
        </div>

        <div class="form-group">
          <label>Amount</label>
          <div class="amount-input">
            <input
              v-model="sendForm.amount"
              type="number"
              class="form-input"
              placeholder="0.00"
              step="0.01"
            />
            <select v-model="sendForm.currency" class="currency-select">
              <option value="USD">USD</option>
              <option value="XOM">XOM</option>
              <option value="ETH">ETH</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Message (optional)</label>
          <input
            v-model="sendForm.message"
            type="text"
            class="form-input"
            placeholder="What's this for?"
          />
        </div>
      </div>

      <div class="summary-section">
        <div class="summary-row">
          <span>Amount</span>
          <span>${{ sendForm.amount || '0.00' }}</span>
        </div>
        <div class="summary-row">
          <span>Network Fee</span>
          <span>${{ calculateSendFee() }}</span>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <span>${{ calculateSendTotal() }}</span>
        </div>
      </div>

      <div class="action-buttons">
        <button class="button secondary" @click="$emit('cancel')">
          Cancel
        </button>
        <button 
          class="button primary" 
          @click="processSend"
          :disabled="isProcessing || !sendForm.recipient || !sendForm.amount"
        >
          <span v-if="isProcessing" class="loading-spinner"></span>
          {{ isProcessing ? 'Sending...' : 'Send Money' }}
        </button>
      </div>
    </div>

    <!-- Transaction Success -->
    <div v-if="transactionType === 'success'" class="transaction-card success">
      <div class="success-icon">✅</div>
      <h2>Transaction Successful!</h2>
      <p v-if="lastTransaction">
        {{ lastTransaction.message }}
      </p>
      
      <div class="transaction-details">
        <div class="detail-row">
          <span>Transaction ID</span>
          <span class="transaction-id">{{ lastTransaction?.id }}</span>
        </div>
        <div class="detail-row">
          <span>Date</span>
          <span>{{ formatDate(lastTransaction?.timestamp) }}</span>
        </div>
      </div>

      <div class="action-buttons">
        <button class="button primary" @click="$emit('close')">
          Done
        </button>
        <button class="button secondary" @click="viewTransaction">
          View Details
        </button>
      </div>
    </div>

    <!-- Transaction Error -->
    <div v-if="transactionType === 'error'" class="transaction-card error">
      <div class="error-icon">❌</div>
      <h2>Transaction Failed</h2>
      <p>{{ errorMessage }}</p>
      
      <div class="action-buttons">
        <button class="button secondary" @click="$emit('close')">
          Close
        </button>
        <button class="button primary" @click="retryTransaction">
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { KeyringManager } from '../../core/keyring/KeyringManager'
import { secureRandomBase36 } from '../../core/utils/secure-random'

interface TransactionItem {
  id: string
  name: string
  description: string
  price: number
  currency?: string
  image?: string
  seller: string
}

interface Transaction {
  id: string
  message: string
  timestamp: number
  amount: number
  recipient?: string
}

// Props
const props = defineProps<{
  transactionType: 'purchase' | 'send' | 'success' | 'error'
  item?: TransactionItem
  initialAmount?: number
  initialRecipient?: string
}>()

// State
const isProcessing = ref(false)
const errorMessage = ref('')
const selectedPaymentMethod = ref('wallet')
const walletBalance = ref(1250.00) // TODO: Get from actual wallet

const sendForm = ref({
  recipient: props.initialRecipient ?? '',
  amount: props.initialAmount ?? 0,
  currency: 'USD',
  message: ''
})

const lastTransaction = ref<Transaction | null>(null)

// Computed
const calculateServiceFee = (price: number): string => {
  return (price * 0.025).toFixed(2) // 2.5% service fee
}

const calculateNetworkFee = (price: number): string => {
  return (price * 0.01).toFixed(2) // 1% network fee (abstracts gas fees)
}

const calculateTotal = (): string => {
  if (props.item === null || props.item === undefined) return '0.00'
  const price = props.item.price
  const serviceFee = parseFloat(calculateServiceFee(price))
  const networkFee = parseFloat(calculateNetworkFee(price))
  return (price + serviceFee + networkFee).toFixed(2)
}

const calculateSendFee = (): string => {
  const amount = parseFloat(sendForm.value.amount.toString())
  if (isNaN(amount) || amount <= 0) return '0.50'
  return Math.max(0.50, amount * 0.01).toFixed(2) // Minimum $0.50 or 1%
}

const calculateSendTotal = (): string => {
  const amount = parseFloat(sendForm.value.amount.toString())
  if (isNaN(amount) || amount <= 0) return '0.50'
  const fee = parseFloat(calculateSendFee())
  return (amount + fee).toFixed(2)
}

const formatDate = (timestamp?: number): string => {
  if (timestamp === undefined || timestamp === null || timestamp <= 0) return ''
  return new Date(timestamp).toLocaleString()
}

// Methods
/**
 * Process purchase transaction
 */
const processPurchase = async (): Promise<void> => {
  if (props.item === null || props.item === undefined) return
  
  try {
    isProcessing.value = true
    
    // Get current session
    const keyring = KeyringManager.getInstance()
    const session = keyring.getCurrentSession()
    
    if (session === null || session === undefined) {
      throw new Error('Please log in to complete your purchase')
    }

    // Check wallet balance
    if (selectedPaymentMethod.value === 'wallet') {
      const total = parseFloat(calculateTotal())
      if (walletBalance.value < total) {
        throw new Error('Insufficient wallet balance')
      }
    }

    // Simulate transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Create transaction record
    const transaction: Transaction = {
      id: generateTransactionId(),
      message: `Successfully purchased "${props.item.name}" from ${props.item.seller}`,
      timestamp: Date.now(),
      amount: parseFloat(calculateTotal()),
      recipient: props.item.seller
    }

    lastTransaction.value = transaction
    
    // Update wallet balance
    if (selectedPaymentMethod.value === 'wallet') {
      walletBalance.value -= transaction.amount
    }

    emit('transaction-success', transaction)
    
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Transaction failed'
    emit('transaction-error', errorMessage.value)
  } finally {
    isProcessing.value = false
  }
}

/**
 * Process send money transaction
 */
const processSend = async (): Promise<void> => {
  try {
    isProcessing.value = true
    
    // Get current session
    const keyring = KeyringManager.getInstance()
    const session = keyring.getCurrentSession()
    
    if (session === null || session === undefined) {
      throw new Error('Please log in to send money')
    }

    // Validate form
    if (sendForm.value.recipient.length === 0 || sendForm.value.amount <= 0) {
      throw new Error('Please fill in all required fields')
    }

    const total = parseFloat(calculateSendTotal())
    if (walletBalance.value < total) {
      throw new Error('Insufficient wallet balance')
    }

    // Simulate transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Create transaction record
    const transaction: Transaction = {
      id: generateTransactionId(),
      message: `Successfully sent $${sendForm.value.amount} to ${sendForm.value.recipient}`,
      timestamp: Date.now(),
      amount: parseFloat(sendForm.value.amount.toString()),
      recipient: sendForm.value.recipient
    }

    lastTransaction.value = transaction
    
    // Update wallet balance
    walletBalance.value -= total

    emit('transaction-success', transaction)
    
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Transaction failed'
    emit('transaction-error', errorMessage.value)
  } finally {
    isProcessing.value = false
  }
}

/**
 * Retry failed transaction
 */
const retryTransaction = (): void => {
  errorMessage.value = ''
  if (props.transactionType === 'purchase') {
    void processPurchase()
  } else if (props.transactionType === 'send') {
    void processSend()
  }
}

/**
 * View transaction details
 */
const viewTransaction = (): void => {
  if (lastTransaction.value !== null) {
    emit('view-transaction', lastTransaction.value)
  }
}

/**
 * Generate secure transaction ID
 */
const generateTransactionId = (): string => {
  return 'txn_' + secureRandomBase36(13)
}

// Events
/**
 * Component event emitters
 * @returns Event emitters for component communication
 */
const emit = defineEmits<{
  'transaction-success': [transaction: Transaction]
  'transaction-error': [error: string]
  'view-transaction': [transaction: Transaction]
  'cancel': []
  'close': []
}>()
</script>

<style scoped>
.transaction-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.transaction-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 32px;
}

.transaction-card.success {
  text-align: center;
  border: 2px solid #10b981;
}

.transaction-card.error {
  text-align: center;
  border: 2px solid #ef4444;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.header p {
  color: #666;
  font-size: 16px;
}

.item-section {
  margin-bottom: 24px;
}

.item-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.item-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-details {
  flex: 1;
}

.item-details h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.item-description {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.seller-info {
  font-size: 14px;
}

.seller-label {
  color: #666;
}

.seller-name {
  font-weight: 500;
  color: #333;
}

.item-price {
  text-align: right;
}

.price-amount {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.price-currency {
  font-size: 14px;
  color: #666;
  margin-left: 4px;
}

.summary-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
}

.summary-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.summary-row.total {
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
  margin-top: 8px;
  font-weight: 600;
  font-size: 16px;
}

.payment-section {
  margin-bottom: 24px;
}

.payment-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.payment-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-option {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.payment-option.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.payment-option input[type="radio"] {
  display: none;
}

.payment-details {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.payment-icon {
  font-size: 24px;
}

.payment-info {
  display: flex;
  flex-direction: column;
}

.payment-name {
  font-weight: 500;
  color: #333;
}

.payment-balance {
  font-size: 14px;
  color: #666;
}

.payment-selected {
  color: #667eea;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s;
}

.payment-option.selected .payment-selected {
  opacity: 1;
}

.form-section {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
}

.amount-input {
  display: flex;
  gap: 8px;
}

.currency-select {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.security-notice {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  margin-bottom: 24px;
}

.security-icon {
  font-size: 20px;
  color: #16a34a;
}

.security-text strong {
  color: #16a34a;
  font-weight: 600;
}

.security-text p {
  color: #166534;
  font-size: 14px;
  margin-top: 4px;
  margin-bottom: 0;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.button {
  flex: 1;
  padding: 14px 24px;
  border-radius: 8px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.button.primary {
  background: #667eea;
  color: white;
}

.button.primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.button.secondary {
  background: #f3f4f6;
  color: #374151;
}

.button.secondary:hover {
  background: #e5e7eb;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.transaction-details {
  margin: 24px 0;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.transaction-id {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}
</style>