<template>
  <div class="dashboard" data-testid="dashboard-page">
    <!-- Loading State -->
    <div v-if="walletStore.isLoading" data-testid="dashboard-loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading dashboard...</p>
    </div>

    <!-- Disconnected State -->
    <div v-else-if="!walletStore.isConnected" data-testid="connect-prompt" class="connect-prompt">
      <h2>Connect your wallet</h2>
      <p>Please connect your wallet to view your dashboard</p>
      <button @click="connectWallet" class="btn-primary">Connect Wallet</button>
    </div>

    <!-- Connected Dashboard -->
    <div v-else class="dashboard-content">
      <!-- Error Banner -->
      <div v-if="walletStore.error" data-testid="error-banner" class="error-banner">
        <p>{{ walletStore.error }}</p>
        <button @click="retryConnection" data-testid="retry-button" class="btn-secondary">
          Retry
        </button>
      </div>

      <!-- Header -->
      <header data-testid="dashboard-header" class="dashboard-header">
        <h1 data-testid="dashboard-title">Dashboard</h1>
        <div class="header-actions">
          <div data-testid="wallet-address" class="wallet-address">
            {{ formatAddress(walletStore.address) }}
          </div>
          <button
            @click="openNotifications"
            data-testid="notification-bell"
            class="notification-bell"
          >
            <span v-if="walletStore.unreadNotifications > 0" 
                  data-testid="notification-badge" 
                  class="badge">
              {{ walletStore.unreadNotifications }}
            </span>
            🔔
          </button>
          <button
            @click="goToSettings"
            data-testid="settings-gear"
            class="settings-gear"
          >
            ⚙️
          </button>
        </div>
      </header>

      <!-- Navigation Menu -->
      <nav class="dashboard-nav">
        <button data-testid="nav-dashboard" class="nav-item active">Dashboard</button>
        <button @click="goTo('tokens')" data-testid="nav-tokens" class="nav-item">Tokens</button>
        <button @click="goTo('nfts')" data-testid="nav-nfts" class="nav-item">NFTs</button>
        <button @click="goTo('swap')" data-testid="nav-swap" class="nav-item">Swap</button>
        <button @click="goTo('settings')" data-testid="nav-settings" class="nav-item">Settings</button>
      </nav>

      <!-- Portfolio Overview -->
      <section class="portfolio-overview">
        <div class="portfolio-value-container">
          <h2>Total Portfolio Value</h2>
          <div data-testid="portfolio-value" class="portfolio-value">
            ${{ formatNumber(totalPortfolioValue) }}
          </div>
          <div v-if="portfolioChange24h" 
               data-testid="portfolio-change" 
               :class="['portfolio-change', portfolioChange24h.amount >= 0 ? 'text-green-500' : 'text-red-500']">
            {{ portfolioChange24h.amount >= 0 ? '+' : '' }}${{ formatNumber(Math.abs(portfolioChange24h.amount)) }}
            ({{ portfolioChange24h.amount >= 0 ? '+' : '' }}{{ portfolioChange24h.percentage }}%)
          </div>
        </div>

        <div data-testid="portfolio-chart" class="portfolio-chart">
          <!-- Portfolio distribution chart -->
          <canvas ref="portfolioChart"></canvas>
        </div>

        <div data-testid="asset-breakdown" class="asset-breakdown">
          <div class="breakdown-item">
            <span>Native Balance</span>
            <span>${{ walletStore.balance?.usd || '0.00' }}</span>
          </div>
          <div class="breakdown-item">
            <span>Tokens</span>
            <span>${{ formatNumber(tokenStore.totalValue) }}</span>
          </div>
          <div class="breakdown-item">
            <span>NFTs</span>
            <span>{{ nftStore.totalCount }} items</span>
          </div>
        </div>

        <!-- Portfolio History Chart -->
        <div data-testid="portfolio-history-chart" class="portfolio-history">
          <div class="timeframe-selector">
            <button v-for="tf in timeframes" 
                    :key="tf" 
                    :data-testid="`timeframe-${tf}`"
                    @click="selectTimeframe(tf)"
                    :class="['timeframe-btn', { active: selectedTimeframe === tf }]">
              {{ tf }}
            </button>
          </div>
          <canvas ref="historyChart"></canvas>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="action-buttons">
          <button @click="openSend" data-testid="quick-send" class="action-btn">
            <span class="icon">📤</span>
            <span>Send</span>
          </button>
          <button @click="openReceive" data-testid="quick-receive" class="action-btn">
            <span class="icon">📥</span>
            <span>Receive</span>
          </button>
          <button @click="goToSwap" data-testid="quick-swap" class="action-btn">
            <span class="icon">🔄</span>
            <span>Swap</span>
          </button>
          <button @click="openBuy" data-testid="quick-buy" class="action-btn">
            <span class="icon">💳</span>
            <span>Buy</span>
          </button>
        </div>
      </section>

      <!-- Recent Activity -->
      <section class="recent-activity">
        <div class="section-header">
          <h2>Recent Activity</h2>
          <button @click="refreshActivity" data-testid="refresh-activity" class="refresh-btn">
            🔄
          </button>
        </div>

        <div v-if="walletStore.recentTransactions?.length > 0" class="transaction-list">
          <div v-for="(tx, index) in walletStore.recentTransactions" 
               :key="tx.hash"
               :data-testid="`transaction-${index}`"
               @click="viewTransaction(tx.hash)"
               class="transaction-item">
            <div class="tx-icon" :class="`tx-${tx.type}`">
              {{ tx.type === 'send' ? '📤' : '📥' }}
            </div>
            <div class="tx-details">
              <div class="tx-amount">{{ tx.amount }} {{ tx.token }}</div>
              <div class="tx-time">{{ formatTime(tx.timestamp) }}</div>
            </div>
          </div>
        </div>
        <div v-else data-testid="no-activity" class="empty-state">
          No recent activity
        </div>
      </section>

      <!-- Token Summary -->
      <section data-testid="token-summary" class="token-summary">
        <div class="section-header">
          <h2>Top Tokens</h2>
          <button @click="goTo('tokens')" data-testid="view-all-tokens" class="view-all">
            View All →
          </button>
        </div>
        <div class="token-list">
          <div v-for="(token, index) in tokenStore.topTokens" 
               :key="token.symbol"
               :data-testid="`token-summary-${index}`"
               class="token-item">
            <span class="token-symbol">{{ token.symbol }}</span>
            <span class="token-balance">{{ token.balance }}</span>
            <span class="token-value">${{ formatNumber(token.value) }}</span>
          </div>
        </div>
      </section>

      <!-- NFT Preview -->
      <section data-testid="nft-preview" class="nft-preview">
        <div class="section-header">
          <h2>Featured NFTs</h2>
          <button @click="goTo('nfts')" data-testid="view-all-nfts" class="view-all">
            View All →
          </button>
        </div>
        <div class="nft-grid">
          <div v-for="(nft, index) in nftStore.featuredNFTs" 
               :key="nft.id"
               :data-testid="`nft-preview-${index}`"
               class="nft-item">
            <img :src="nft.image" :alt="nft.name" />
            <div class="nft-name">{{ nft.name }}</div>
          </div>
        </div>
      </section>

      <!-- Modals -->
      <SendModal v-if="showSendModal" @close="showSendModal = false" data-testid="send-modal" />
      <ReceiveModal v-if="showReceiveModal" @close="showReceiveModal = false" data-testid="receive-modal" />
      <NotificationPanel v-if="showNotifications" @close="showNotifications = false" 
                        @mark-all-read="markAllRead" 
                        data-testid="notification-panel" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Dashboard Page Component
 * Main overview page showing portfolio value, quick actions, and recent activity
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWalletStore } from '../stores/wallet';
import { useTokenStore } from '../stores/tokens';
import { useNFTStore } from '../stores/nfts';
import SendModal from '../components/modals/SendModal.vue';
import ReceiveModal from '../components/modals/ReceiveModal.vue';
import NotificationPanel from '../components/NotificationPanel.vue';

const router = useRouter();
const walletStore = useWalletStore();
const tokenStore = useTokenStore();
const nftStore = useNFTStore();

// Refs
const portfolioChart = ref<HTMLCanvasElement>();
const historyChart = ref<HTMLCanvasElement>();
const showSendModal = ref(false);
const showReceiveModal = ref(false);
const showNotifications = ref(false);
const selectedTimeframe = ref('7D');

// Data
const timeframes = ['1D', '7D', '1M', '3M', '1Y'];

// Computed
const totalPortfolioValue = computed(() => {
  const walletValue = parseFloat(walletStore.balance?.usd || '0');
  const tokensValue = tokenStore.totalValue || 0;
  return walletValue + tokensValue;
});

const portfolioChange24h = computed(() => {
  return walletStore.portfolioChange24h;
});

// Methods
const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const formatTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const connectWallet = async () => {
  await walletStore.connect();
};

const retryConnection = async () => {
  await walletStore.retryConnection();
};

const goTo = (name: string) => {
  router.push({ name });
};

const goToSettings = () => {
  router.push({ name: 'settings' });
};

const goToSwap = () => {
  router.push({ name: 'swap' });
};

const openSend = () => {
  showSendModal.value = true;
};

const openReceive = () => {
  showReceiveModal.value = true;
};

const openBuy = () => {
  // Implementation for buy functionality
  console.log('Open buy modal');
};

const openNotifications = () => {
  showNotifications.value = true;
};

const markAllRead = () => {
  walletStore.markNotificationsAsRead();
};

const viewTransaction = (hash: string) => {
  router.push({ name: 'transaction', params: { hash } });
};

const refreshActivity = async () => {
  await walletStore.refreshActivity();
};

const selectTimeframe = (tf: string) => {
  selectedTimeframe.value = tf;
  updateHistoryChart();
};

const updateHistoryChart = () => {
  // Implementation for updating history chart based on timeframe
  console.log('Update history chart for timeframe:', selectedTimeframe.value);
};

// Lifecycle
onMounted(async () => {
  if (walletStore.isConnected) {
    await Promise.all([
      walletStore.fetchBalance(),
      tokenStore.fetchTokens(),
      nftStore.fetchNFTs()
    ]);
  }
  
  // Initialize charts
  // Chart initialization would go here
});
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.loading-container,
.connect-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dashboard-content {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.error-banner {
  background: var(--error-bg);
  color: var(--error-color);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.wallet-address {
  background: var(--bg-secondary);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-family: monospace;
}

.notification-bell,
.settings-gear {
  position: relative;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
}

.badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--error-color);
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 0.75rem;
}

.dashboard-nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;
}

.nav-item {
  background: none;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.nav-item.active,
.nav-item:hover {
  color: var(--primary-color);
}

.portfolio-overview {
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
}

.portfolio-value-container {
  text-align: center;
  margin-bottom: 2rem;
}

.portfolio-value {
  font-size: 3rem;
  font-weight: bold;
  margin: 0.5rem 0;
}

.portfolio-change {
  font-size: 1.2rem;
}

.text-green-500 { color: #10b981; }
.text-red-500 { color: #ef4444; }

.portfolio-chart {
  width: 100%;
  height: 200px;
  margin: 2rem 0;
}

.asset-breakdown {
  display: flex;
  justify-content: space-around;
  margin-top: 2rem;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.portfolio-history {
  margin-top: 2rem;
}

.timeframe-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.timeframe-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

.timeframe-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.quick-actions {
  margin-bottom: 2rem;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  transform: translateY(-2px);
}

.action-btn .icon {
  font-size: 2rem;
}

.recent-activity,
.token-summary,
.nft-preview {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.refresh-btn,
.view-all {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 1rem;
}

.transaction-list {
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;
}

.transaction-item:hover {
  background: var(--bg-tertiary);
}

.transaction-item:last-child {
  border-bottom: none;
}

.tx-icon {
  font-size: 1.5rem;
}

.tx-details {
  flex: 1;
}

.tx-amount {
  font-weight: bold;
}

.tx-time {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.token-symbol {
  font-weight: bold;
}

.token-balance {
  color: var(--text-secondary);
}

.token-value {
  font-weight: 500;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.nft-item {
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}

.nft-item:hover {
  transform: scale(1.05);
}

.nft-item img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.nft-name {
  padding: 0.5rem;
  font-size: 0.875rem;
  text-align: center;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}
</style>