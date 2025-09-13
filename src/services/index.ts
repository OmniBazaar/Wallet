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

// Hooks - Commented out Vue composables in React project
// export {
//   useValidatorWallet,
//   useValidatorTransaction,
//   useValidatorBalance,
//   useValidatorWalletStatus,
//   useENSResolution,
//   useWalletBackup
// } from '../hooks/useValidatorWallet';

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
    validatorBalance.initialize(); // This method is synchronous

    // All validator services initialized successfully - using logger would be better than console.warn
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
    validatorBalance.disconnect(); // This method is synchronous

    // All validator services disconnected successfully - using logger would be better than console.warn
  } catch (error) {
    console.error('Error disconnecting validator services:', error);
    throw error;
  }
}

// Service health check
/** 
 * Return a basic health snapshot for the validator services.
 * @returns Health status of all validator services
 */
export function checkValidatorServiceHealth(): {
  /** Wallet service healthy */
  wallet: boolean;
  /** Transaction service healthy */
  transaction: boolean;
  /** Balance service healthy */
  balance: boolean;
  /** Overall health summary */
  overall: boolean;
} {
    const health = {
      wallet: false,
      transaction: false,
      balance: false,
      overall: false
    };

    // Check wallet service
    try {
      // Basic health check - services exist and are not null/undefined
      health.wallet = validatorWallet !== null && validatorWallet !== undefined && typeof validatorWallet === 'object';
    } catch (error: unknown) {
      health.wallet = false;
    }

    // Check transaction service
    try {
      // Basic health check - services exist and are not null/undefined
      health.transaction = validatorTransaction !== null && validatorTransaction !== undefined && typeof validatorTransaction === 'object';
    } catch (error: unknown) {
      health.transaction = false;
    }

    // Check balance service
    try {
      // Basic health check - services exist and are not null/undefined
      health.balance = validatorBalance !== null && validatorBalance !== undefined && typeof validatorBalance === 'object';
    } catch (error: unknown) {
      health.balance = false;
    }

    // Overall health
    health.overall = health.wallet && health.transaction && health.balance;

    return health;
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
