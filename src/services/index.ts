/**
 * Validator Services Export Index
 *
 * Central export point for all Validator service integrations
 */

// Main services: import for local usage and export types/classes separately
import { validatorWallet, ValidatorWalletService } from './ValidatorWallet';
import { validatorTransaction, ValidatorTransactionService } from './ValidatorTransaction';
import { validatorBalance, ValidatorBalanceService } from './ValidatorBalance';

// Re-export preconfigured singletons for consumers that dynamically import
export { validatorWallet, validatorTransaction, validatorBalance };

export { ValidatorWalletService };
export { ValidatorTransactionService };
export { ValidatorBalanceService };

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
 * Initialize all validator services for a specific user
 * @param userId User identifier for service initialization
 * @returns Promise that resolves when all services are initialized
 * @throws Error if initialization fails
 */
export async function initializeValidatorServices(userId: string): Promise<void> {
  try {
    // Update user IDs via public setters
    validatorWallet.setUserId(userId);
    validatorTransaction.setUserId(userId);
    validatorBalance.setUserId(userId);

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
/** Disconnect all validator services and clear state. */
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
/** Return a basic health snapshot for the validator services. */
export async function checkValidatorServiceHealth(): Promise<{
  /** Wallet service healthy */
  wallet: boolean;
  /** Transaction service healthy */
  transaction: boolean;
  /** Balance service healthy */
  balance: boolean;
  /** Overall health summary */
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
