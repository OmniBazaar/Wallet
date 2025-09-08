/**
 * OmniBazaar Wallet Store
 * Manages wallet state and communication with background script
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Declare global chrome API
declare const chrome: {
  runtime: {
    sendMessage: (message: { type: string; data?: unknown }, callback: (response: unknown) => void) => void;
    lastError?: { message: string };
  };
};

/** Wallet account information */
export interface WalletAccount {
  /** Account address */
  address: string;
  /** Account display name */
  name: string;
  /** Account balance */
  balance: string;
  /** Network identifier */
  network: string;
}

/** NFT collection information */
export interface NFTCollection {
  /** Collection ID */
  id: string;
  /** Collection name */
  name: string;
  /** Collection description */
  description: string;
  /** Collection image URL */
  image: string;
  /** Number of items in collection */
  itemCount: number;
}

/** Transaction information */
export interface Transaction {
  /** Transaction ID */
  id: string;
  /** Transaction type */
  type: 'send' | 'receive' | 'mint' | 'listing';
  /** Transaction amount */
  amount: string;
  /** Token symbol */
  token?: string;
  /** Recipient address (optional) */
  to?: string;
  /** Sender address (optional) */
  from?: string;
  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed';
  /** Transaction timestamp */
  timestamp: number;
  /** Network identifier */
  network: string;
  /** Transaction hash */
  hash?: string;
}

/** Notification information */
export interface Notification {
  /** Notification ID */
  id: string;
  /** Notification type */
  type: 'transaction' | 'info' | 'warning' | 'error' | 'success';
  /** Notification message */
  message: string;
  /** Notification timestamp */
  timestamp: number;
  /** Read status */
  read?: boolean;
}

/** Portfolio change information */
export interface PortfolioChange {
  /** Change amount in USD */
  amount: number;
  /** Change percentage */
  percentage: number;
}

/** Balance information */
export interface Balance {
  /** Native token balance */
  native: string;
  /** USD value */
  usd: string;
}

export const useWalletStore = defineStore('wallet', () => {
  // State
  const isSetup = ref(false);
  const isUnlocked = ref(false);
  const isConnected = ref(false);
  const currentAccount = ref<WalletAccount | null>(null);
  const accounts = ref<WalletAccount[]>([]);
  const currentNetwork = ref('ethereum');
  const supportedNetworks = ref<string[]>(['ethereum']);
  const nftCollections = ref<NFTCollection[]>([]);
  const transactions = ref<Transaction[]>([]);
  const recentTransactions = ref<Transaction[]>([]);
  const notifications = ref<Notification[]>([]);
  const unreadNotifications = ref(0);
  const portfolioChange24h = ref<PortfolioChange | null>(null);
  const balance = ref<Balance | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const hasAccounts = computed(() => accounts.value.length > 0);
  const currentBalance = computed(() => currentAccount.value?.balance || '0');
  const address = computed(() => currentAccount.value?.address || '');

  /**
   *
   */
  type BackgroundResponse = Record<string, any>;

  // Send message to background script
  async function sendToBackground(type: string, data: unknown = {}): Promise<BackgroundResponse> {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      chrome.runtime.sendMessage({ type, data }, (response: unknown) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve((response as BackgroundResponse) ?? {});
        }
      });
    });
  }

  // Initialize wallet
  async function initialize(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      console.warn('🔄 Initializing wallet store...');

      const state = await sendToBackground('GET_WALLET_STATE');

      if (state['error']) {
        throw new Error(state['error']);
      }

      // Update store state
      isUnlocked.value = state['isUnlocked'] || false;
      currentNetwork.value = state['currentNetwork'] || 'ethereum';
      supportedNetworks.value = state['supportedNetworks'] || ['ethereum'];
      nftCollections.value = state['nftCollections'] || [];
      transactions.value = state['transactions'] || [];

      // Check if wallet is set up (has accounts)
      isSetup.value = hasAccounts.value;

      console.warn('✅ Wallet store initialized:', {
        isSetup: isSetup.value,
        isUnlocked: isUnlocked.value,
        network: currentNetwork.value
      });

    } catch (err: unknown) {
      console.error('❌ Failed to initialize wallet:', err);
      error.value = (err as Error).message || 'Failed to initialize wallet';
    } finally {
      isLoading.value = false;
    }
  }

  // Connect account
  async function connectAccount(address?: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('CONNECT_ACCOUNT', { address });

      if (response['error']) {
        throw new Error(response['error']);
      }

      if (response['success']) {
        await refreshWalletState();
        return true;
      }

      return false;
    } catch (err: unknown) {
      console.error('❌ Failed to connect account:', err);
      error.value = (err as Error).message || 'Failed to connect account';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // Disconnect account
  async function disconnectAccount(): Promise<void> {
    isLoading.value = true;

    try {
      await sendToBackground('DISCONNECT_ACCOUNT');

      // Clear current account
      currentAccount.value = null;
      isUnlocked.value = false;

    } catch (err: unknown) {
      console.error('❌ Failed to disconnect account:', err);
      error.value = (err as Error).message || 'Failed to disconnect account';
    } finally {
      isLoading.value = false;
    }
  }

  // Switch network
  async function switchNetwork(network: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('SWITCH_NETWORK', { network });

      if (response['error']) {
        throw new Error(response['error']);
      }

      if (response['success']) {
        currentNetwork.value = network;
        await refreshWalletState();
        return true;
      }

      return false;
    } catch (err: unknown) {
      console.error('❌ Failed to switch network:', err);
      error.value = (err as Error).message || 'Failed to switch network';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // Get balance for address
  async function getBalance(address: string, network?: string): Promise<string> {
    try {
      const response = await sendToBackground('GET_BALANCE', {
        address,
        network: network || currentNetwork.value
      });

      if (response['error']) {
        throw new Error(response['error']);
      }

      return response['balance'] || '0';
    } catch (err: unknown) {
      console.error('❌ Failed to get balance:', err);
      return '0';
    }
  }

  // Send transaction
  async function sendTransaction(transaction: {
    /**
     *
     */
    to: string;
    /**
     *
     */
    value: string;
    /**
     *
     */
    data?: string;
    /**
     *
     */
    gasLimit?: string;
    /**
     *
     */
    gasPrice?: string;
  }): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('SIGN_TRANSACTION', transaction);

      if (response['error']) {
        throw new Error(response['error']);
      }

      if (response['success']) {
        await refreshWalletState();
        return response['txHash'] || null;
      }

      return null;
    } catch (err: unknown) {
      console.error('❌ Failed to send transaction:', err);
      error.value = (err as Error).message || 'Failed to send transaction';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Mint NFT
  async function mintNFT(metadata: {
    /**
     *
     */
    name: string;
    /**
     *
     */
    description: string;
    /**
     *
     */
    image: string;
    /**
     *
     */
    attributes?: Array<{ /**
                          *
                          */
      trait_type: string; /**
                           *
                           */
      value: string | number
    }>;
  }): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('MINT_NFT', metadata);

      if (response['error']) {
        throw new Error(response['error']);
      }

      if (response['success']) {
        await refreshWalletState();
        return response['txHash'] || null;
      }

      return null;
    } catch (err: unknown) {
      console.error('❌ Failed to mint NFT:', err);
      error.value = (err as Error).message || 'Failed to mint NFT';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Create marketplace listing
  async function createListing(listing: {
    /**
     *
     */
    title: string;
    /**
     *
     */
    description: string;
    /**
     *
     */
    price: string;
    /**
     *
     */
    category: string;
    /**
     *
     */
    images: string[];
  }): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('CREATE_LISTING', listing);

      if (response['error']) {
        throw new Error(response['error']);
      }

      if (response['success']) {
        await refreshWalletState();
        return response['listingId'] || null;
      }

      return null;
    } catch (err: unknown) {
      console.error('❌ Failed to create listing:', err);
      error.value = (err as Error).message || 'Failed to create listing';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Refresh wallet state
  async function refreshWalletState(): Promise<void> {
    try {
      const state = await sendToBackground('GET_WALLET_STATE');

      if (!state['error']) {
        isUnlocked.value = state['isUnlocked'] || false;
        currentNetwork.value = state['currentNetwork'] || 'ethereum';
        nftCollections.value = state['nftCollections'] || [];
        transactions.value = state['transactions'] || [];
      }
    } catch (err) {
      console.warn('Failed to refresh wallet state:', err);
    }
  }

  // Clear error
  function clearError(): void {
    error.value = null;
  }

  // Connect wallet (for dashboard)
  async function connect(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;
      
      // In real implementation, this would connect to browser wallet
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      isConnected.value = true;
      currentAccount.value = {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f80752',
        name: 'Main Account',
        balance: '1234000000000000000', // 1.234 ETH
        network: 'ethereum'
      };
      
      balance.value = {
        native: '1.234',
        usd: '2468.00'
      };
      
      // Load initial transactions
      await fetchRecentTransactions();
      
    } catch (err) {
      error.value = 'Failed to connect wallet';
      console.error('Failed to connect:', err);
    } finally {
      isLoading.value = false;
    }
  }

  // Retry connection
  async function retryConnection(): Promise<void> {
    error.value = null;
    await connect();
  }

  // Mark notifications as read
  function markNotificationsAsRead(): void {
    notifications.value = notifications.value.map(n => ({ ...n, read: true }));
    unreadNotifications.value = 0;
  }

  // Refresh activity
  async function refreshActivity(): Promise<void> {
    try {
      isLoading.value = true;
      await fetchRecentTransactions();
      await fetchBalance();
    } catch (err) {
      console.error('Failed to refresh activity:', err);
    } finally {
      isLoading.value = false;
    }
  }

  // Fetch balance
  async function fetchBalance(): Promise<void> {
    if (!currentAccount.value) return;
    
    try {
      const balanceWei = await getBalance(currentAccount.value.address);
      const ethBalance = parseFloat(balanceWei) / 1e18;
      
      balance.value = {
        native: ethBalance.toFixed(3),
        usd: (ethBalance * 2000).toFixed(2) // Mock ETH price
      };
      
      // Update account balance
      currentAccount.value.balance = balanceWei;
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }

  // Fetch recent transactions
  async function fetchRecentTransactions(): Promise<void> {
    try {
      // In real implementation, fetch from blockchain or indexer
      recentTransactions.value = [
        {
          id: '1',
          hash: '0x123...',
          type: 'send',
          amount: '100',
          token: 'USDC',
          timestamp: Date.now() - 3600000,
          status: 'confirmed',
          network: 'ethereum'
        },
        {
          id: '2',
          hash: '0x456...',
          type: 'receive',
          amount: '50',
          token: 'XOM',
          timestamp: Date.now() - 7200000,
          status: 'confirmed',
          network: 'ethereum'
        }
      ];
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  }

  return {
    // State
    isSetup,
    isUnlocked,
    isConnected,
    currentAccount,
    accounts,
    currentNetwork,
    supportedNetworks,
    nftCollections,
    transactions,
    recentTransactions,
    notifications,
    unreadNotifications,
    portfolioChange24h,
    balance,
    isLoading,
    error,

    // Computed
    hasAccounts,
    currentBalance,
    address,

    // Actions
    initialize,
    connectAccount,
    disconnectAccount,
    switchNetwork,
    getBalance,
    sendTransaction,
    mintNFT,
    createListing,
    refreshWalletState,
    clearError,
    connect,
    retryConnection,
    markNotificationsAsRead,
    refreshActivity,
    fetchBalance,
    fetchRecentTransactions
  };
});
