/**
 * Vue Composable for Validator Wallet Integration
 * 
 * Provides reactive hooks for wallet operations through the Validator network
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { ValidatorWalletService, WalletAccount, TransactionRequest, TransactionResult } from '../services/ValidatorWallet';
import { ValidatorTransactionService, Transaction, GasEstimate } from '../services/ValidatorTransaction';
import { ValidatorBalanceService, AccountBalance, TokenBalance } from '../services/ValidatorBalance';
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
export function useValidatorWallet() {
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
   */
  const initializeWallet = async (userId: string): Promise<void> => {
    if (globalWalletState.isInitialized.value) {
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
      console.log('Validator wallet services initialized');
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
      console.log('Validator wallet services disconnected');
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  };
  
  /**
   * Create new account
   */
  const createAccount = async (
    name: string,
    type: WalletAccount['type'],
    chainId: string,
    options?: any
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
   */
  const setActiveAccount = (accountId: string): void => {
    walletService.setActiveAccount(accountId);
  };
  
  /**
   * Remove account
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
export function useValidatorTransaction() {
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
export function useValidatorBalance() {
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
   */
  const startBalanceUpdates = (addresses: string[], interval = 30000): void => {
    balanceService.startBalanceUpdates(addresses, interval);
  };
  
  /**
   * Stop automatic balance updates
   */
  const stopBalanceUpdates = (address?: string): void => {
    balanceService.stopBalanceUpdates(address);
  };
  
  /**
   * Get balance history
   */
  const getBalanceHistory = (address: string, limit = 100) => {
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
export function useValidatorWalletStatus() {
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
export function useENSResolution() {
  const walletService = validatorWallet;
  
  // Reactive state
  const isResolving = ref(false);
  const resolutionCache = ref<Record<string, any>>({});
  
  /**
   * Resolve ENS name
   */
  const resolveENS = async (name: string) => {
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
   * Clear resolution cache
   */
  const clearCache = (): void => {
    resolutionCache.value = {};
  };
  
  return {
    // State
    isResolving,
    resolutionCache,
    
    // Actions
    resolveENS,
    clearCache
  };
}

/**
 * Wallet backup composable
 */
export function useWalletBackup() {
  const walletService = validatorWallet;
  
  // Reactive state
  const isBackingUp = ref(false);
  const isRestoring = ref(false);
  const lastBackup = ref<string | null>(null);
  
  /**
   * Create wallet backup
   */
  const createBackup = async (password: string) => {
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
   */
  const restoreFromBackup = async (backup: any, password: string) => {
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