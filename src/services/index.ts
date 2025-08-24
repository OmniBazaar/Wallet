/**
 * Validator Services Export Index
 * 
 * Central export point for all Validator service integrations
 */

// Main services
export { ValidatorWalletService, validatorWallet } from './ValidatorWallet';
export { ValidatorTransactionService, validatorTransaction } from './ValidatorTransaction';
export { ValidatorBalanceService, validatorBalance } from './ValidatorBalance';

// Types
export type {
  ValidatorWalletConfig,
  WalletAccount,
  TransactionRequest,
  TransactionResult,
  WalletBackup,
  ENSResolution
} from './ValidatorWallet';

export type {
  ValidatorTransactionConfig,
  Transaction,
  TransactionBatch,
  GasEstimate,
  TransactionReceipt
} from './ValidatorTransaction';

export type {
  ValidatorBalanceConfig,
  TokenBalance,
  AccountBalance,
  BalanceHistory,
  PriceData
} from './ValidatorBalance';

// Hooks
export {
  useValidatorWallet,
  useValidatorTransaction,
  useValidatorBalance,
  useValidatorWalletStatus,
  useENSResolution,
  useWalletBackup
} from '../hooks/useValidatorWallet';

// Service initialization helper
/**
 *
 * @param userId
 */
export async function initializeValidatorServices(userId: string): Promise<void> {
  try {
    // Update user IDs
    validatorWallet.config.userId = userId;
    validatorTransaction.config.userId = userId;
    validatorBalance.config.userId = userId;
    
    // Initialize services
    await validatorWallet.initialize();
    await validatorTransaction.initialize();
    await validatorBalance.initialize();
    
    console.warn('All validator services initialized successfully');
  } catch (error) {
    console.error('Error initializing validator services:', error);
    throw error;
  }
}

// Service cleanup helper
/**
 *
 */
export async function disconnectValidatorServices(): Promise<void> {
  try {
    await validatorWallet.disconnect();
    await validatorTransaction.disconnect();
    await validatorBalance.disconnect();
    
    console.warn('All validator services disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting validator services:', error);
    throw error;
  }
}

// Service health check
/**
 *
 */
export async function checkValidatorServiceHealth(): Promise<{
  /**
   *
   */
  wallet: boolean;
  /**
   *
   */
  transaction: boolean;
  /**
   *
   */
  balance: boolean;
  /**
   *
   */
  overall: boolean;
}> {
  try {
    const health = {
      wallet: false,
      transaction: false,
      balance: false,
      overall: false
    };
    
    // Check wallet service
    try {
      health.wallet = validatorWallet.accountsRef.value !== null;
    } catch (error) {
      health.wallet = false;
    }
    
    // Check transaction service
    try {
      health.transaction = validatorTransaction.pendingTxRef.value !== null;
    } catch (error) {
      health.transaction = false;
    }
    
    // Check balance service
    try {
      health.balance = validatorBalance.balancesRef.value !== null;
    } catch (error) {
      health.balance = false;
    }
    
    // Overall health
    health.overall = health.wallet && health.transaction && health.balance;
    
    return health;
  } catch (error) {
    console.error('Error checking service health:', error);
    return {
      wallet: false,
      transaction: false,
      balance: false,
      overall: false
    };
  }
}

// Default export
export default {
  // Services
  validatorWallet,
  validatorTransaction,
  validatorBalance,
  
  // Helpers
  initializeValidatorServices,
  disconnectValidatorServices,
  checkValidatorServiceHealth
};