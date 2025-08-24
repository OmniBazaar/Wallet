/**
 * Custom error classes for the OmniBazaar Wallet
 * Following TypeScript coding standards for proper error handling
 */

/**
 * Base error class for OmniBazaar wallet errors
 */
export class WalletError extends Error {
  /**
   * Create a new wallet error
   * @param message Error message
   * @param code Error code
   */
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'WalletError';
  }
}

/**
 * Thrown when a wallet connection fails
 */
export class WalletConnectionError extends WalletError {
  /**
   * Create a new wallet connection error
   * @param message Error message
   */
  constructor(message: string) {
    super(message, 'WALLET_CONNECTION_FAILED');
    this.name = 'WalletConnectionError';
  }
}

/**
 * Thrown when insufficient funds for transaction
 */
export class InsufficientFundsError extends WalletError {
  /**
   * Create a new insufficient funds error
   * @param message Error message
   */
  constructor(message: string) {
    super(message, 'INSUFFICIENT_FUNDS');
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Thrown when a contract call fails
 */
export class ContractError extends WalletError {
  /**
   * Create a new contract error
   * @param message Error message
   * @param originalError Original error that caused this error
   */
  constructor(message: string, public readonly originalError?: unknown) {
    super(message, 'CONTRACT_ERROR');
    this.name = 'ContractError';
  }
}

/**
 * Thrown when network operations fail
 */
export class NetworkError extends WalletError {
  /**
   * Create a new network error
   * @param message Error message
   * @param networkName Name of the network that failed
   */
  constructor(message: string, public readonly networkName?: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Thrown when transaction signing fails
 */
export class TransactionSigningError extends WalletError {
  /**
   * Create a new transaction signing error
   * @param message Error message
   */
  constructor(message: string) {
    super(message, 'TRANSACTION_SIGNING_FAILED');
    this.name = 'TransactionSigningError';
  }
}

/**
 * Thrown when keyring operations fail
 */
export class KeyringError extends WalletError {
  /**
   *
   * @param message
   */
  constructor(message: string) {
    super(message, 'KEYRING_ERROR');
    this.name = 'KeyringError';
  }
}

/**
 * Thrown when bridge operations fail
 */
export class BridgeError extends WalletError {
  /**
   *
   * @param message
   * @param bridgeProvider
   */
  constructor(message: string, public readonly bridgeProvider?: string) {
    super(message, 'BRIDGE_ERROR');
    this.name = 'BridgeError';
  }
}
