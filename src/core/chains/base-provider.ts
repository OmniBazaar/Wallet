import { NetworkConfig, Transaction, TransactionRequest } from '@/types';

/**
 * Base provider class that all chain-specific providers extend
 */
export abstract class BaseProvider {
  protected config: NetworkConfig;

  /**
   *
   * @param config
   */
  constructor(config: NetworkConfig) {
    this.config = config;
  }

  /**
   * Get network configuration
   */
  getConfig(): NetworkConfig {
    return this.config;
  }

  /**
   * Get chain/network name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get currency symbol
   */
  getCurrency(): string {
    return this.config.currency;
  }

  /**
   * Get RPC URL
   */
  getRpcUrl(): string {
    return this.config.rpcUrl;
  }

  // Abstract methods that each provider must implement
  abstract getBalance(address: string): Promise<string>;
  abstract getFormattedBalance(address: string): Promise<string>;
  abstract signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string>;
  abstract sendTransaction(signedTransaction: string): Promise<string>;
  abstract getTransaction(txHash: string): Promise<Transaction>;
  abstract getTransactionHistory(address: string, limit?: number): Promise<Transaction[]>;
  abstract subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void>;
  abstract signMessage(privateKey: string, message: string): Promise<string>;
}