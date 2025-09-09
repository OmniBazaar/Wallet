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
  const currentBalance = computed(() => currentAccount.value?.balance ?? '0');
  const address = computed(() => currentAccount.value?.address ?? '');

  /**
   * Response from background script
   */
  type BackgroundResponse = Record<string, unknown>;

  /**
   * Send message to background script
   * @param type - Message type
   * @param data - Message data
   * @returns Promise that resolves to background response
   */
  async function sendToBackground(type: string, data: unknown = {}): Promise<BackgroundResponse> {
    return new Promise((resolve, reject) => {
      if (chrome?.runtime === undefined) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      chrome.runtime.sendMessage({ type, data }, (response: unknown) => {
        if (chrome.runtime.lastError !== undefined) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve((response as BackgroundResponse) ?? {});
        }
      });
    });
  }

  /**
   * Initialize wallet store
   * @returns Promise that resolves when wallet is initialized
   */
  async function initialize(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Initialize wallet store

      const state = await sendToBackground('GET_WALLET_STATE');

      if (typeof state['error'] === 'string' && state['error'] !== '') {
        throw new Error(state['error']);
      }

      // Update store state
      isUnlocked.value = Boolean(state['isUnlocked']);
      currentNetwork.value = typeof state['currentNetwork'] === 'string' ? state['currentNetwork'] : 'ethereum';
      supportedNetworks.value = Array.isArray(state['supportedNetworks']) ? state['supportedNetworks'] as string[] : ['ethereum'];
      nftCollections.value = Array.isArray(state['nftCollections']) ? state['nftCollections'] : [];
      transactions.value = Array.isArray(state['transactions']) ? state['transactions'] : [];

      // Check if wallet is set up (has accounts)
      isSetup.value = hasAccounts.value;

      // Wallet store initialized successfully

    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to initialize wallet';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Connect wallet account
   * @param address - Optional account address to connect
   * @returns Promise that resolves to true if successful
   */
  async function connectAccount(address?: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('CONNECT_ACCOUNT', { address });

      if (typeof response['error'] === 'string' && response['error'] !== '') {
        throw new Error(response['error']);
      }

      if (response['success'] === true) {
        await refreshWalletState();
        return true;
      }

      return false;
    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to connect account';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Disconnect wallet account
   * @returns Promise that resolves when account is disconnected
   */
  async function disconnectAccount(): Promise<void> {
    isLoading.value = true;

    try {
      await sendToBackground('DISCONNECT_ACCOUNT');

      // Clear current account
      currentAccount.value = null;
      isUnlocked.value = false;

    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to disconnect account';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Switch to a different network
   * @param network - Network identifier to switch to
   * @returns Promise that resolves to true if successful
   */
  async function switchNetwork(network: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('SWITCH_NETWORK', { network });

      if (typeof response['error'] === 'string' && response['error'] !== '') {
        throw new Error(response['error']);
      }

      if (response['success'] === true) {
        currentNetwork.value = network;
        await refreshWalletState();
        return true;
      }

      return false;
    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to switch network';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get balance for an address
   * @param address - Wallet address
   * @param network - Optional network identifier
   * @returns Promise that resolves to balance string
   */
  async function getBalance(address: string, network?: string): Promise<string> {
    try {
      const response = await sendToBackground('GET_BALANCE', {
        address,
        network: network ?? currentNetwork.value
      });

      if (typeof response['error'] === 'string' && response['error'] !== '') {
        throw new Error(response['error']);
      }

      return typeof response['balance'] === 'string' ? response['balance'] : '0';
    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to get balance';
      return '0';
    }
  }

  /**
   * Transaction parameters interface
   */
  interface TransactionParams {
    /** Recipient address */
    to: string;
    /** Transaction value in wei */
    value: string;
    /** Optional transaction data */
    data?: string;
    /** Optional gas limit */
    gasLimit?: string;
    /** Optional gas price */
    gasPrice?: string;
  }

  /**
   * Send transaction
   * @param transaction - Transaction parameters
   * @returns Promise that resolves to transaction hash or null
   */
  async function sendTransaction(transaction: TransactionParams): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('SIGN_TRANSACTION', transaction);

      if (typeof response['error'] === 'string' && response['error'] !== '') {
        throw new Error(response['error']);
      }

      if (response['success'] === true) {
        await refreshWalletState();
        return typeof response['txHash'] === 'string' ? response['txHash'] : null;
      }

      return null;
    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to send transaction';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * NFT attribute interface
   */
  interface NFTAttribute {
    /** Attribute trait type */
    trait_type: string;
    /** Attribute value */
    value: string | number;
  }

  /**
   * NFT metadata interface
   */
  interface NFTMetadata {
    /** NFT name */
    name: string;
    /** NFT description */
    description: string;
    /** NFT image URL */
    image: string;
    /** Optional NFT attributes */
    attributes?: NFTAttribute[];
  }

  /**
   * Mint NFT
   * @param metadata - NFT metadata
   * @returns Promise that resolves to transaction hash or null
   */
  async function mintNFT(metadata: NFTMetadata): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('MINT_NFT', metadata);

      if (typeof response['error'] === 'string' && response['error'] !== '') {
        throw new Error(response['error']);
      }

      if (response['success'] === true) {
        await refreshWalletState();
        return typeof response['txHash'] === 'string' ? response['txHash'] : null;
      }

      return null;
    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to mint NFT';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Marketplace listing interface
   */
  interface ListingParams {
    /** Listing title */
    title: string;
    /** Listing description */
    description: string;
    /** Listing price */
    price: string;
    /** Listing category */
    category: string;
    /** Listing images URLs */
    images: string[];
  }

  /**
   * Create marketplace listing
   * @param listing - Listing parameters
   * @returns Promise that resolves to listing ID or null
   */
  async function createListing(listing: ListingParams): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await sendToBackground('CREATE_LISTING', listing);

      if (typeof response['error'] === 'string' && response['error'] !== '') {
        throw new Error(response['error']);
      }

      if (response['success'] === true) {
        await refreshWalletState();
        return typeof response['listingId'] === 'string' ? response['listingId'] : null;
      }

      return null;
    } catch (err: unknown) {
      error.value = (err as Error).message ?? 'Failed to create listing';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh wallet state
   * @returns Promise that resolves when wallet state is refreshed
   */
  async function refreshWalletState(): Promise<void> {
    try {
      const state = await sendToBackground('GET_WALLET_STATE');

      if (!(typeof state['error'] === 'string' && state['error'] !== '')) {
        isUnlocked.value = Boolean(state['isUnlocked']);
        currentNetwork.value = typeof state['currentNetwork'] === 'string' ? state['currentNetwork'] : 'ethereum';
        nftCollections.value = Array.isArray(state['nftCollections']) ? state['nftCollections'] : [];
        transactions.value = Array.isArray(state['transactions']) ? state['transactions'] : [];
      }
    } catch (err) {
      error.value = (err as Error).message ?? 'Failed to refresh wallet state';
    }
  }

  /**
   * Clear error state
   * @returns void
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Connect wallet (for dashboard)
   * @returns Promise that resolves when wallet is connected
   */
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
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Retry wallet connection
   * @returns Promise that resolves when retry is complete
   */
  async function retryConnection(): Promise<void> {
    error.value = null;
    await connect();
  }

  /**
   * Mark notifications as read
   * @returns void
   */
  function markNotificationsAsRead(): void {
    notifications.value = notifications.value.map(n => ({ ...n, read: true }));
    unreadNotifications.value = 0;
  }

  /**
   * Refresh activity data
   * @returns Promise that resolves when activity is refreshed
   */
  async function refreshActivity(): Promise<void> {
    try {
      isLoading.value = true;
      await fetchRecentTransactions();
      await fetchBalance();
    } catch (err) {
      error.value = (err as Error).message ?? 'Failed to refresh activity';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch balance for current account
   * @returns Promise that resolves when balance is fetched
   */
  async function fetchBalance(): Promise<void> {
    if (currentAccount.value === undefined || currentAccount.value === null) return;
    
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
      error.value = (err as Error).message ?? 'Failed to fetch balance';
    }
  }

  /**
   * Fetch recent transactions
   * @returns Promise that resolves when transactions are fetched
   */
  async function fetchRecentTransactions(): Promise<void> {
    try {
      // In real implementation, fetch from blockchain or indexer
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
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
      error.value = (err as Error).message ?? 'Failed to fetch transactions';
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
