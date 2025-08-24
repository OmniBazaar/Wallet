import { NetworkConfig, Transaction, TransactionRequest } from '@/types';

/**
 * Base provider class that all chain-specific providers extend
 */
export abstract class BaseProvider {
  protected config: NetworkConfig;

  /**
   * Create a new base provider
   * @param config Network configuration
   */
  constructor(config: NetworkConfig) {
    this.config = config;
  }

  /**
   * Get network configuration
   * @returns Network configuration object
   */
  getConfig(): NetworkConfig {
    return this.config;
  }

  /**
   * Get chain/network name
   * @returns Network name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get currency symbol
   * @returns Native currency symbol
   */
  getCurrency(): string {
    return this.config.currency;
  }

  /**
   * Get RPC URL
   * @returns RPC endpoint URL
   */
  getRpcUrl(): string {
    return this.config.rpcUrl;
  }

  // Abstract methods that each provider must implement

  /** Get balance for an address */
  abstract getBalance(address: string): Promise<string>;

  /** Get formatted balance for an address */
  abstract getFormattedBalance(address: string): Promise<string>;

  /** Sign a transaction */
  abstract signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string>;

  /** Send a signed transaction */
  abstract sendTransaction(signedTransaction: string): Promise<string>;

  /** Get transaction details */
  abstract getTransaction(txHash: string): Promise<Transaction>;

  /** Get transaction history for an address */
  abstract getTransactionHistory(address: string, limit?: number): Promise<Transaction[]>;

  /** Subscribe to new blocks */
  abstract subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void>;

  /** Sign a message */
  abstract signMessage(privateKey: string, message: string): Promise<string>;
}
