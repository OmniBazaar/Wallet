/**
 * Vue Composable for Validator Wallet Integration
 *
 * Provides reactive hooks for wallet operations through the Validator network
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { WalletAccount, TransactionRequest, TransactionResult } from '../services/ValidatorWallet';
import { Transaction, GasEstimate } from '../services/ValidatorTransaction';
import { AccountBalance } from '../services/ValidatorBalance';
import { validatorWallet, validatorTransaction, validatorBalance } from '../services';

// Global state management
const globalWalletState = {
  isInitialized: ref(false),
  isConnecting: ref(false),
  error: ref<string | null>(null)
};

/**
 * Main wallet composable
 */
export function useValidatorWallet(): {
  isConnected: ReturnType<typeof computed>;
  hasError: ReturnType<typeof computed>;
  accounts: ReturnType<typeof computed>;
  activeAccount: ReturnType<typeof computed>;
  balances: ReturnType<typeof computed>;
  isInitializing: ReturnType<typeof ref>;
  connectionStatus: ReturnType<typeof ref>;
  initializeWallet: (userId: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  createAccount: (name: string, type: WalletAccount['type'], chainId: string, options?: {
    mnemonic?: string;
    derivationPath?: string;
    accountType?: 'validator' | 'user';
    metadata?: Record<string, unknown>;
  }) => Promise<WalletAccount>;
  setActiveAccount: (accountId: string) => void;
  removeAccount: (accountId: string) => Promise<void>;
  updateBalances: (addresses?: string[]) => Promise<void>;
} {
  const walletService = validatorWallet;
  const transactionService = validatorTransaction;
  const balanceService = validatorBalance;

  // Local reactive state
  const isInitializing = ref(false);
  const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // Computed properties
  const isConnected = computed(() => connectionStatus.value === 'connected');
  const hasError = computed(() => connectionStatus.value === 'error');
  const accounts = computed(() => walletService.accountsRef.value);
  const activeAccount = computed(() => walletService.activeAccountRef.value);
  const balances = computed(() => walletService.balancesRef.value);

  /**
   * Initialize wallet services
   * @param userId User identifier for wallet initialization
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  const initializeWallet = async (userId: string): Promise<void> => {
    if (globalWalletState.isInitialized.value === true) {
      return;
    }

    try {
      isInitializing.value = true;
      connectionStatus.value = 'connecting';
      globalWalletState.isConnecting.value = true;
      globalWalletState.error.value = null;

      // Update user ID in service configs
      walletService.config.userId = userId;
      transactionService.config.userId = userId;
      balanceService.config.userId = userId;

      // Initialize services
      await walletService.initialize();
      await transactionService.initialize();
      await balanceService.initialize();

      globalWalletState.isInitialized.value = true;
      connectionStatus.value = 'connected';
      console.warn('Validator wallet services initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize wallet';
      globalWalletState.error.value = errorMessage;
      connectionStatus.value = 'error';
      console.error('Wallet initialization error:', error);
      throw error;
    } finally {
      isInitializing.value = false;
      globalWalletState.isConnecting.value = false;
    }
  };

  /**
   * Disconnect wallet services
   */
  const disconnectWallet = async (): Promise<void> => {
    try {
      await walletService.disconnect();
      await transactionService.disconnect();
      await balanceService.disconnect();

      globalWalletState.isInitialized.value = false;
      connectionStatus.value = 'disconnected';
      console.warn('Validator wallet services disconnected');
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  };

  /**
   * Create new account
   * @param name
   * @param type
   * @param chainId
   * @param options
   * @param options.mnemonic
   * @param options.derivationPath
   * @param options.accountType
   * @param options.metadata
   */
  const createAccount = async (
    name: string,
    type: WalletAccount['type'],
    chainId: string,
    options?: {
      mnemonic?: string;
      derivationPath?: string;
      accountType?: 'validator' | 'user';
      metadata?: Record<string, unknown>;
    }
  ): Promise<WalletAccount> => {
    try {
      const account = await walletService.createAccount(name, type, chainId, options);

      // Update balances for new account
      await balanceService.getBalance(account.address);

      return account;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  };

  /**
   * Import existing account
   * @param name
   * @param privateKeyOrMnemonic
   * @param chainId
   */
  const importAccount = async (
    name: string,
    privateKeyOrMnemonic: string,
    chainId: string
  ): Promise<WalletAccount> => {
    try {
      const account = await walletService.importAccount(name, privateKeyOrMnemonic, chainId);

      // Update balances for imported account
      await balanceService.getBalance(account.address);

      return account;
    } catch (error) {
      console.error('Error importing account:', error);
      throw error;
    }
  };

  /**
   * Set active account
   * @param accountId
   */
  const setActiveAccount = (accountId: string): void => {
    walletService.setActiveAccount(accountId);
  };

  /**
   * Remove account
   * @param accountId
   */
  const removeAccount = async (accountId: string): Promise<void> => {
    try {
      await walletService.removeAccount(accountId);
    } catch (error) {
      console.error('Error removing account:', error);
      throw error;
    }
  };

  /**
   * Update account balances
   * @param addresses
   */
  const updateBalances = async (addresses?: string[]): Promise<void> => {
    try {
      if (addresses) {
        await balanceService.getMultipleBalances(addresses);
      } else {
        await walletService.updateAllBalances();
      }
    } catch (error) {
      console.error('Error updating balances:', error);
      throw error;
    }
  };

  return {
    // State
    isInitializing,
    isConnected,
    hasError,
    connectionStatus,
    accounts,
    activeAccount,
    balances,
    error: globalWalletState.error,

    // Actions
    initializeWallet,
    disconnectWallet,
    createAccount,
    importAccount,
    setActiveAccount,
    removeAccount,
    updateBalances
  };
}

/**
 * Transaction composable
 */
export function useValidatorTransaction(): {
  isProcessing: ReturnType<typeof ref>;
  lastTransaction: ReturnType<typeof ref>;
  gasEstimate: ReturnType<typeof ref>;
  pendingTransactions: ReturnType<typeof computed>;
  transactionHistory: ReturnType<typeof computed>;
  currentGasEstimate: ReturnType<typeof computed>;
  sendTransaction: (request: TransactionRequest) => Promise<TransactionResult>;
  estimateGas: (request: TransactionRequest) => Promise<GasEstimate>;
  getTransaction: (txHash: string) => Promise<Transaction | null>;
  cancelTransaction: (txId: string, privateKey: string) => Promise<Transaction>;
  speedUpTransaction: (txId: string, privateKey: string) => Promise<Transaction>;
} {
  const transactionService = validatorTransaction;

  // Reactive state
  const isProcessing = ref(false);
  const lastTransaction = ref<Transaction | null>(null);
  const gasEstimate = ref<GasEstimate | null>(null);

  // Computed properties
  const pendingTransactions = computed(() => transactionService.pendingTxRef.value);
  const transactionHistory = computed(() => transactionService.historyRef.value);
  const currentGasEstimate = computed(() => transactionService.gasEstimateRef.value);

  /**
   * Send transaction
   * @param request
   */
  const sendTransaction = async (request: TransactionRequest): Promise<TransactionResult> => {
    try {
      isProcessing.value = true;

      const tx = await transactionService.sendTransaction(
        request.from,
        request.to,
        request.value,
        request.data,
        {
          gasLimit: request.gasLimit,
          gasPrice: request.gasPrice,
          nonce: request.nonce
        }
      );

      lastTransaction.value = tx;

      return {
        success: true,
        txHash: tx.hash
      };
    } catch (error) {
      console.error('Error sending transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Estimate gas for transaction
   * @param from
   * @param to
   * @param value
   * @param data
   */
  const estimateGas = async (
    from: string,
    to: string,
    value: string,
    data?: string
  ): Promise<GasEstimate> => {
    try {
      const estimate = await transactionService.estimateGas(from, to, value, data);
      gasEstimate.value = estimate;
      return estimate;
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  };

  /**
   * Get transaction by hash
   * @param txHash
   */
  const getTransaction = async (txHash: string): Promise<Transaction | null> => {
    try {
      return await transactionService.getTransaction(txHash);
    } catch (error) {
      console.error('Error getting transaction:', error);
      return null;
    }
  };

  /**
   * Cancel pending transaction
   * @param txId
   * @param privateKey
   */
  const cancelTransaction = async (txId: string, privateKey: string): Promise<Transaction> => {
    try {
      return await transactionService.cancelTransaction(txId, privateKey);
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      throw error;
    }
  };

  /**
   * Speed up pending transaction
   * @param txId
   * @param privateKey
   */
  const speedUpTransaction = async (txId: string, privateKey: string): Promise<Transaction> => {
    try {
      return await transactionService.speedUpTransaction(txId, privateKey);
    } catch (error) {
      console.error('Error speeding up transaction:', error);
      throw error;
    }
  };

  return {
    // State
    isProcessing,
    lastTransaction,
    gasEstimate,
    pendingTransactions,
    transactionHistory,
    currentGasEstimate,

    // Actions
    sendTransaction,
    estimateGas,
    getTransaction,
    cancelTransaction,
    speedUpTransaction
  };
}

/**
 * Balance composable
 */
export function useValidatorBalance(): {
  isLoading: ReturnType<typeof ref>;
  lastUpdated: ReturnType<typeof ref>;
  balances: ReturnType<typeof computed>;
  prices: ReturnType<typeof computed>;
  history: ReturnType<typeof computed>;
  portfolioSummary: ReturnType<typeof computed>;
  getBalance: (address: string, useCache?: boolean) => Promise<AccountBalance>;
  getMultipleBalances: (addresses: string[]) => Promise<Record<string, AccountBalance>>;
  startBalanceUpdates: (addresses: string[], interval?: number) => void;
  stopBalanceUpdates: (address?: string) => void;
  getBalanceHistory: (address: string, limit?: number) => Array<{
    timestamp: number;
    balance: string;
    value?: number;
  }>;
  clearCache: () => void;
} {
  const balanceService = validatorBalance;

  // Reactive state
  const isLoading = ref(false);
  const lastUpdated = ref<number>(0);

  // Computed properties
  const balances = computed(() => balanceService.balancesRef.value);
  const prices = computed(() => balanceService.pricesRef.value);
  const history = computed(() => balanceService.historyRef.value);
  const portfolioSummary = computed(() => balanceService.getPortfolioSummary());

  /**
   * Get balance for address
   * @param address
   * @param useCache
   */
  const getBalance = async (address: string, useCache = true): Promise<AccountBalance> => {
    try {
      isLoading.value = true;
      const balance = await balanceService.getBalance(address, useCache);
      lastUpdated.value = Date.now();
      return balance;
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Get multiple balances
   * @param addresses
   */
  const getMultipleBalances = async (addresses: string[]): Promise<Record<string, AccountBalance>> => {
    try {
      isLoading.value = true;
      const balances = await balanceService.getMultipleBalances(addresses);
      lastUpdated.value = Date.now();
      return balances;
    } catch (error) {
      console.error('Error getting multiple balances:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Start automatic balance updates
   * @param addresses
   * @param interval
   */
  const startBalanceUpdates = (addresses: string[], interval = 30000): void => {
    balanceService.startBalanceUpdates(addresses, interval);
  };

  /**
   * Stop automatic balance updates
   * @param address
   */
  const stopBalanceUpdates = (address?: string): void => {
    balanceService.stopBalanceUpdates(address);
  };

  /**
   * Get balance history
   * @param address
   * @param limit
   */
  const getBalanceHistory = (address: string, limit = 100): Array<{
    timestamp: number;
    balance: string;
    value?: number;
  }> => {
    return balanceService.getBalanceHistory(address, limit);
  };

  /**
   * Clear balance cache
   */
  const clearCache = (): void => {
    balanceService.clearCache();
  };

  return {
    // State
    isLoading,
    lastUpdated,
    balances,
    prices,
    history,
    portfolioSummary,

    // Actions
    getBalance,
    getMultipleBalances,
    startBalanceUpdates,
    stopBalanceUpdates,
    getBalanceHistory,
    clearCache
  };
}

/**
 * Wallet status composable
 */
export function useValidatorWalletStatus(): {
  connectionStatus: ReturnType<typeof ref>;
  networkInfo: ReturnType<typeof ref>;
  serviceHealth: ReturnType<typeof ref>;
  isHealthy: ReturnType<typeof computed>;
  checkHealth: () => Promise<void>;
} {
  const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const networkInfo = ref<{ networkId: string; endpoint: string } | null>(null);
  const serviceHealth = ref<Record<string, boolean>>({});

  // Computed properties
  const isHealthy = computed(() =>
    Object.values(serviceHealth.value).every(healthy => healthy)
  );

  /**
   * Check service health
   */
  const checkHealth = async (): Promise<void> => {
    try {
      // Check wallet service
      serviceHealth.value.wallet = globalWalletState.isInitialized.value;

      // Check transaction service
      serviceHealth.value.transaction = true; // TODO: Implement health check

      // Check balance service
      serviceHealth.value.balance = true; // TODO: Implement health check

      // Update network info
      networkInfo.value = {
        networkId: validatorWallet.config.networkId,
        endpoint: validatorWallet.config.validatorEndpoint
      };
    } catch (error) {
      console.error('Error checking service health:', error);
      serviceHealth.value = {
        wallet: false,
        transaction: false,
        balance: false
      };
    }
  };

  // Start health checks
  onMounted(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds

    onUnmounted(() => {
      clearInterval(interval);
    });
  });

  return {
    // State
    connectionStatus,
    networkInfo,
    serviceHealth,
    isHealthy,

    // Actions
    checkHealth
  };
}

/**
 * ENS resolution composable
 */
export function useENSResolution(): {
  isResolving: ReturnType<typeof ref>;
  cache: ReturnType<typeof ref>;
  resolveENS: (name: string) => Promise<string | null>;
  reverseResolveENS: (address: string) => Promise<string | null>;
  clearCache: () => void;
} {
  const walletService = validatorWallet;

  // Reactive state
  const isResolving = ref(false);
  const resolutionCache = ref<Record<string, string>>({});

  /**
   * Resolve ENS name
   * @param name
   */
  const resolveENS = async (name: string): Promise<string | null> => {
    try {
      // Check cache first
      if (resolutionCache.value[name]) {
        return resolutionCache.value[name];
      }

      isResolving.value = true;
      const resolution = await walletService.resolveENS(name);

      if (resolution) {
        resolutionCache.value[name] = resolution;
      }

      return resolution;
    } catch (error) {
      console.error('Error resolving ENS:', error);
      return null;
    } finally {
      isResolving.value = false;
    }
  };

  /**
   * Reverse resolve ENS (address to name)
   * @param address
   */
  const reverseResolveENS = async (address: string): Promise<string | null> => {
    try {
      isResolving.value = true;
      const name = await walletService.reverseResolveENS(address);

      if (name) {
        resolutionCache.value[address] = name;
      }

      return name;
    } catch (error) {
      console.error('Error reverse resolving ENS:', error);
      return null;
    } finally {
      isResolving.value = false;
    }
  };

  /**
   * Clear resolution cache
   */
  const clearCache = (): void => {
    resolutionCache.value = {};
  };

  return {
    // State
    isResolving,
    cache: resolutionCache,

    // Actions
    resolveENS,
    reverseResolveENS,
    clearCache
  };
}

/**
 * Wallet backup composable
 */
export function useWalletBackup(): {
  isBackingUp: ReturnType<typeof ref>;
  isRestoring: ReturnType<typeof ref>;
  lastBackup: ReturnType<typeof ref>;
  createBackup: (password: string) => Promise<{
    data: string;
    timestamp: number;
    version: string;
  }>;
  restoreFromBackup: (backup: {
    version: string;
    accounts: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  }, password: string) => Promise<void>;
} {
  const walletService = validatorWallet;

  // Reactive state
  const isBackingUp = ref(false);
  const isRestoring = ref(false);
  const lastBackup = ref<string | null>(null);

  /**
   * Create wallet backup
   * @param password
   */
  const createBackup = async (password: string): Promise<{
    data: string;
    timestamp: number;
    version: string;
  }> => {
    try {
      isBackingUp.value = true;
      const backup = await walletService.backupWallet(password);
      lastBackup.value = new Date().toISOString();
      return backup;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    } finally {
      isBackingUp.value = false;
    }
  };

  /**
   * Restore wallet from backup
   * @param backup
   * @param backup.version
   * @param backup.accounts
   * @param backup.metadata
   * @param password
   */
  const restoreFromBackup = async (backup: {
    version: string;
    accounts: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  }, password: string): Promise<void> => {
    try {
      isRestoring.value = true;
      await walletService.restoreWallet(backup, password);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw error;
    } finally {
      isRestoring.value = false;
    }
  };

  return {
    // State
    isBackingUp,
    isRestoring,
    lastBackup,

    // Actions
    createBackup,
    restoreFromBackup
  };
}

// Export all composables
export default {
  useValidatorWallet,
  useValidatorTransaction,
  useValidatorBalance,
  useValidatorWalletStatus,
  useENSResolution,
  useWalletBackup
};
