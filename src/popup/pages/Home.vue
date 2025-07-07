<template>
  <div class="home-page">
    <!-- Account Overview -->
    <div class="account-section">
      <div class="account-header">
        <div class="account-avatar">👤</div>
        <div class="account-info">
          <h2 class="account-name">{{ currentAccountName }}</h2>
          <p class="account-address">{{ shortenAddress(currentAccountAddress) }}</p>
        </div>
        <button class="copy-button" @click="copyAddress" :disabled="!currentAccountAddress">
          📋
        </button>
      </div>
      
      <div class="balance-card">
        <div class="balance-label">Total Balance</div>
        <div class="balance-amount">{{ formatBalance(walletStore.currentBalance) }} ETH</div>
        <div class="balance-usd">≈ ${{ formatUSD(walletStore.currentBalance) }}</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="actions-section">
      <h3 class="section-title">Quick Actions</h3>
      <div class="action-grid">
        <button class="action-button" @click="$router.push('/send')">
          <div class="action-icon">📤</div>
          <span class="action-label">Send</span>
        </button>
        
        <button class="action-button" @click="$router.push('/receive')">
          <div class="action-icon">📥</div>
          <span class="action-label">Receive</span>
        </button>
        
        <button class="action-button" @click="$router.push('/nft-mint')">
          <div class="action-icon">🎨</div>
          <span class="action-label">Mint NFT</span>
        </button>
        
        <button class="action-button" @click="$router.push('/marketplace')">
          <div class="action-icon">🏪</div>
          <span class="action-label">Market</span>
        </button>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="transactions-section">
      <div class="section-header">
        <h3 class="section-title">Recent Activity</h3>
        <button class="view-all-button" @click="viewAllTransactions">View All</button>
      </div>
      
      <div class="transaction-list" v-if="recentTransactions.length > 0">
        <div 
          v-for="tx in recentTransactions" 
          :key="tx.id"
          class="transaction-item"
          @click="viewTransaction(tx)"
        >
          <div class="tx-icon">
            {{ getTransactionIcon(tx.type) }}
          </div>
          <div class="tx-details">
            <div class="tx-type">{{ formatTransactionType(tx.type) }}</div>
            <div class="tx-time">{{ formatTime(tx.timestamp) }}</div>
          </div>
          <div class="tx-amount" :class="{ 'positive': tx.type === 'receive' }">
            {{ tx.type === 'receive' ? '+' : '-' }}{{ tx.amount }}
          </div>
          <div class="tx-status" :class="tx.status">
            {{ tx.status }}
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <div class="empty-icon">📝</div>
        <p class="empty-text">No transactions yet</p>
        <button class="empty-action" @click="$router.push('/send')">
          Send your first transaction
        </button>
      </div>
    </div>

    <!-- Network Status -->
    <div class="network-section">
      <div class="network-info">
        <div class="network-indicator" :class="networkStatus"></div>
        <span class="network-name">{{ currentNetworkName }}</span>
        <button class="switch-network" @click="showNetworkSelector = true">
          Switch
        </button>
      </div>
    </div>

    <!-- Network Selector Modal -->
    <div v-if="showNetworkSelector" class="modal-overlay" @click="showNetworkSelector = false">
      <div class="modal-content" @click.stop>
        <h3>Select Network</h3>
        <div class="network-list">
          <button 
            v-for="network in walletStore.supportedNetworks" 
            :key="network"
            class="network-option"
            :class="{ active: network === walletStore.currentNetwork }"
            @click="switchNetwork(network)"
          >
            {{ formatNetworkName(network) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useWalletStore } from '@/stores/wallet';

const walletStore = useWalletStore();
const showNetworkSelector = ref(false);

// Computed properties
const currentAccountName = computed(() => 
  walletStore.currentAccount?.name || 'Account 1'
);

const currentAccountAddress = computed(() => 
  walletStore.currentAccount?.address || ''
);

const currentNetworkName = computed(() => 
  formatNetworkName(walletStore.currentNetwork)
);

const networkStatus = computed(() => 'connected'); // Will be dynamic later

const recentTransactions = computed(() => 
  walletStore.transactions.slice(0, 5)
);

// Methods
function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  return num.toFixed(4);
}

function formatUSD(balance: string): string {
  const num = parseFloat(balance);
  const usdRate = 2000; // Mock ETH/USD rate
  return (num * usdRate).toFixed(2);
}

function formatNetworkName(network: string): string {
  const names: { [key: string]: string } = {
    ethereum: 'Ethereum',
    sepolia: 'Sepolia Testnet',
    polygon: 'Polygon',
    arbitrum: 'Arbitrum'
  };
  return names[network] || network.charAt(0).toUpperCase() + network.slice(1);
}

function formatTransactionType(type: string): string {
  const types: { [key: string]: string } = {
    send: 'Sent',
    receive: 'Received',
    mint: 'Minted NFT',
    listing: 'Listed Item'
  };
  return types[type] || type;
}

function getTransactionIcon(type: string): string {
  const icons: { [key: string]: string } = {
    send: '📤',
    receive: '📥',
    mint: '🎨',
    listing: '🏪'
  };
  return icons[type] || '💸';
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function copyAddress(): Promise<void> {
  if (!currentAccountAddress.value) return;
  
  try {
    await navigator.clipboard.writeText(currentAccountAddress.value);
    // Show toast notification (to be implemented)
    console.log('Address copied to clipboard');
  } catch (error) {
    console.error('Failed to copy address:', error);
  }
}

async function switchNetwork(network: string): Promise<void> {
  showNetworkSelector.value = false;
  
  if (network === walletStore.currentNetwork) return;
  
  try {
    await walletStore.switchNetwork(network);
  } catch (error) {
    console.error('Failed to switch network:', error);
  }
}

function viewTransaction(transaction: any): void {
  // Open transaction details (to be implemented)
  console.log('View transaction:', transaction);
}

function viewAllTransactions(): void {
  // Navigate to transactions page (to be implemented)
  console.log('View all transactions');
}

// Lifecycle
onMounted(async () => {
  console.log('🏠 Home page mounted');
  
  // Refresh wallet state
  try {
    await walletStore.refreshWalletState();
  } catch (error) {
    console.error('Failed to refresh wallet state:', error);
  }
});
</script>

<style scoped>
.home-page {
  padding: 16px;
  max-width: 400px;
  margin: 0 auto;
}

.account-section {
  margin-bottom: 24px;
}

.account-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.account-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.account-info {
  flex: 1;
}

.account-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.account-address {
  font-size: 14px;
  color: #666;
  margin: 2px 0 0 0;
  font-family: monospace;
}

.copy-button {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 16px;
  transition: background-color 0.2s;
}

.copy-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: white;
}

.balance-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.balance-amount {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
}

.balance-usd {
  font-size: 16px;
  opacity: 0.8;
}

.actions-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #333;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.action-button {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.action-button:hover {
  border-color: #667eea;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.action-icon {
  font-size: 24px;
}

.action-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.transactions-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.view-all-button {
  background: none;
  border: none;
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transaction-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}

.transaction-item:hover {
  border-color: #667eea;
  transform: translateY(-1px);
}

.tx-icon {
  font-size: 20px;
}

.tx-details {
  flex: 1;
}

.tx-type {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.tx-time {
  font-size: 12px;
  color: #666;
}

.tx-amount {
  font-size: 14px;
  font-weight: 500;
  color: #dc2626;
}

.tx-amount.positive {
  color: #059669;
}

.tx-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
  text-transform: capitalize;
}

.tx-status.confirmed {
  background: #dcfce7;
  color: #059669;
}

.tx-status.pending {
  background: #fef3c7;
  color: #d97706;
}

.tx-status.failed {
  background: #fee2e2;
  color: #dc2626;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  color: #666;
  margin-bottom: 16px;
}

.empty-action {
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.network-section {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.network-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.network-indicator.connected {
  background: #10b981;
}

.network-indicator.connecting {
  background: #f59e0b;
}

.network-indicator.disconnected {
  background: #ef4444;
}

.network-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.switch-network {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
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

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  width: 300px;
  max-width: 90vw;
}

.network-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.network-option {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.network-option:hover {
  border-color: #667eea;
}

.network-option.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
</style> 