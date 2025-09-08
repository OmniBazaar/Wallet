/**
 * Validator Transaction Service Integration
 *
 * Manages transaction processing through the Validator network
 */

import { ValidatorClient } from '../../Validator/src/client/ValidatorClient';
import { OmniCoinBlockchain } from '../../Validator/src/services/blockchain/OmniCoinBlockchain';
import { FeeDistributionEngine } from '../../Validator/src/services/fees/FeeDistributionEngine';
import { ethers } from 'ethers';
import { ref, Ref } from 'vue';
import { generateTransactionId, generateBatchId } from '../utils/id-generator';

/** Configuration for validator transaction service */
export interface ValidatorTransactionConfig {
  /** URL endpoint for validator node */
  validatorEndpoint: string;
  /** Network identifier */
  networkId: string;
  /** User identifier */
  userId: string;
  /** Whether to enable fee distribution */
  enableFeeDistribution: boolean;
  /** Maximum number of retry attempts */
  maxRetries: number;
}

/** Represents a blockchain transaction */
export interface Transaction {
  /** Unique transaction identifier */
  id: string;
  /** Transaction hash on blockchain */
  hash: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Transaction value in wei */
  value: string;
  /** Transaction data payload */
  data?: string;
  /** Chain identifier */
  chainId: string;
  /** Transaction nonce */
  nonce: number;
  /** Gas limit for transaction */
  gasLimit: string;
  /** Gas price in wei */
  gasPrice: string;
  /** Current transaction status */
  status: 'pending' | 'confirmed' | 'failed';
  /** Block number where transaction was mined */
  blockNumber?: number;
  /** Number of confirmations */
  confirmations: number;
  /** Transaction timestamp */
  timestamp: number;
  /** Estimated fee paid for this transaction in ETH/XOM (formatted) */
  fee?: string;
  /** Error message if transaction failed */
  error?: string;
}

/**
 * Group of transactions submitted as a single logical batch.
 */
export interface TransactionBatch {
  /** Batch identifier */
  id: string;
  /** Transactions that belong to the batch */
  transactions: Transaction[];
  /** Current batch processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Sum of `value` across transactions */
  totalValue: string;
  /** Sum of `fee` across transactions */
  totalFee: string;
  /** Creation timestamp */
  timestamp: number;
}

/** Gas estimation for a transaction */
export interface GasEstimate {
  /** Estimated gas limit */
  gasLimit: string;
  /** Gas price in wei */
  gasPrice: string;
  /** Maximum fee per gas (EIP-1559) */
  maxFeePerGas?: string;
  /** Maximum priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: string;
  /** Total estimated cost in wei */
  totalCost: string;
}

/** Transaction receipt from blockchain */
export interface TransactionReceipt {
  /** Transaction hash */
  transactionHash: string;
  /** Block number where transaction was mined */
  blockNumber: number;
  /** Hash of the block containing the transaction */
  blockHash: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /**
   *
   */
  gasUsed: string;
  /**
   *
   */
  effectiveGasPrice: string;
  /**
   *
   */
  status: number;
  /**
   *
   */
  logs: Array<{
    /**
     *
     */
    address: string;
    /**
     *
     */
    topics: string[];
    /**
     *
     */
    data: string;
    /**
     *
     */
    blockNumber: number;
    /**
     *
     */
    transactionHash: string;
    /**
     *
     */
    transactionIndex: number;
    /**
     *
     */
    blockHash: string;
    /**
     *
     */
    logIndex: number;
    /**
     *
     */
    removed: boolean;
  }>;
  /**
   *
   */
  contractAddress?: string;
}

/**
 * Watcher used to poll a transaction until it is confirmed.
 */
export interface TransactionWatcher {
  /** Transaction hash being watched */
  txHash: string;
  /** Callback invoked once a receipt is available */
  callback: (receipt: TransactionReceipt) => void;
  /** Polling interval handle */
  interval: NodeJS.Timeout;
  /** Number of consecutive retry attempts */
  retryCount: number;
}

/**
 * Transaction service that sends transactions via the validator network,
 * tracks their lifecycle, distributes fees when enabled, and exposes
 * reactive state for UI components.
 */
export class ValidatorTransactionService {
  private validatorClient: ValidatorClient;
  private blockchain: OmniCoinBlockchain;
  private feeDistribution: FeeDistributionEngine;
  private config: ValidatorTransactionConfig;
  private pendingTransactions: Map<string, Transaction> = new Map();
  private transactionWatchers: Map<string, TransactionWatcher> = new Map();
  private transactionHistory: Transaction[] = [];

  // Reactive references for Vue integration
  public pendingTxRef: Ref<Transaction[]> = ref([]);
  public historyRef: Ref<Transaction[]> = ref([]);
  public gasEstimateRef: Ref<GasEstimate | null> = ref(null);

  /**
   * Create a new ValidatorTransactionService.
   * @param config Service configuration
   */
  constructor(config: ValidatorTransactionConfig) {
    this.config = config;
    this.validatorClient = new ValidatorClient(config.validatorEndpoint);
    this.blockchain = this.validatorClient.getBlockchain();
    this.feeDistribution = this.validatorClient.getFeeDistribution();
  }

  /**
   * Update the user identifier used by this service.
   * @param userId
   */
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /** Expose a readonly view of the current configuration. */
  public getConfig(): Readonly<ValidatorTransactionConfig> {
    return this.config;
  }

  /**
   * Initialize transaction service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize validator client
      await this.validatorClient.initialize();

      // Load transaction history
      await this.loadTransactionHistory();

      // Start transaction monitoring
      this.startTransactionMonitoring();

      console.warn('Validator Transaction Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Validator Transaction Service:', error);
      throw new Error(`Transaction service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create and send a transaction through the validator blockchain.
   * Estimates gas/fee if not provided and starts monitoring for confirmations.
   *
   * @param from Sender address
   * @param to Recipient address
   * @param value Amount in wei
   * @param data Optional calldata
   * @param options Optional gas/nonce overrides
   * @param options.gasLimit Gas limit override
   * @param options.gasPrice Gas price override
   * @param options.maxFeePerGas Max fee per gas (EIP‑1559)
   * @param options.maxPriorityFeePerGas Priority fee per gas (EIP‑1559)
   * @param options.nonce Nonce override
   * @returns Pending transaction object
   */
  async sendTransaction(
    from: string,
    to: string,
    value: string,
    data?: string,
    options?: {
      /**
       *
       */
      gasLimit?: string;
      /**
       *
       */
      gasPrice?: string;
      /**
       *
       */
      maxFeePerGas?: string;
      /**
       *
       */
      maxPriorityFeePerGas?: string;
      /**
       *
       */
      nonce?: number;
    }
  ): Promise<Transaction> {
    try {
      // Create transaction object
      const tx: Transaction = {
        id: this.generateTransactionId(),
        hash: '', // Will be set after submission
        from,
        to,
        value,
        data: data || '0x',
        chainId: this.config.networkId,
        nonce: options?.nonce || await this.getTransactionCount(from),
        gasLimit: options?.gasLimit || '21000',
        gasPrice: options?.gasPrice || await this.getGasPrice(),
        status: 'pending',
        confirmations: 0,
        timestamp: Date.now()
      };

      // Estimate gas if not provided
      if (!options?.gasLimit) {
        const estimate = await this.estimateGas(from, to, value, data);
        tx.gasLimit = estimate.gasLimit;
      }

      // Calculate total fee
      tx.fee = ethers.formatEther(
        BigInt(tx.gasLimit) * BigInt(tx.gasPrice)
      );

      // Add to pending transactions
      this.pendingTransactions.set(tx.id, tx);
      this.updateReactiveData();

      // Submit transaction through validator blockchain
      const result = await this.blockchain.sendTransaction({
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce
      });

      if (result.success && result.transactionHash) {
        // Update transaction with hash
        tx.hash = result.transactionHash;

        // Start watching for confirmations
        this.watchTransaction(tx.hash, (receipt) => {
          this.handleTransactionReceipt(tx.id, receipt);
        });

        // Distribute fees if enabled
        if (this.config.enableFeeDistribution && tx.fee) {
          await this.distributeFees(tx);
        }

        console.warn(`Transaction sent: ${tx.hash}`);
        return tx;
      } else {
        // Transaction failed
        tx.status = 'failed';
        tx.error = result.error || 'Transaction submission failed';
        this.updateReactiveData();
        throw new Error(tx.error);
      }
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  /**
   * Send a batch of transactions.
   * @param transactions Array of tx parameters to submit as a batch
   */
  async sendBatchTransactions(
    transactions: Array<{
      /**
       *
       */
      from: string;
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
    }>
  ): Promise<TransactionBatch> {
    try {
      const batch: TransactionBatch = {
        id: this.generateBatchId(),
        transactions: [],
        status: 'pending',
        totalValue: '0',
        totalFee: '0',
        timestamp: Date.now()
      };

      let totalValue = BigInt(0);
      let totalFee = BigInt(0);

      // Process transactions sequentially to maintain nonce order
      for (const txData of transactions) {
        try {
          const tx = await this.sendTransaction(
            txData.from,
            txData.to,
            txData.value,
            txData.data
          );

          batch.transactions.push(tx);
          totalValue += ethers.parseEther(tx.value);
          totalFee += ethers.parseEther(tx.fee || '0');
        } catch (error) {
          console.error('Batch transaction failed:', error);
          batch.status = 'failed';
          break;
        }
      }

      batch.totalValue = ethers.formatEther(totalValue);
      batch.totalFee = ethers.formatEther(totalFee);

      if (batch.transactions.length === transactions.length) {
        batch.status = 'processing';
      }

      return batch;
    } catch (error) {
      console.error('Error sending batch transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction by hash
   * @param txHash
   */
  async getTransaction(txHash: string): Promise<Transaction | null> {
    try {
      // Check pending transactions first
      for (const tx of this.pendingTransactions.values()) {
        if (tx.hash === txHash) {
          return tx;
        }
      }

      // Check history
      const historicalTx = this.transactionHistory.find(tx => tx.hash === txHash);
      if (historicalTx) {
        return historicalTx;
      }

      // Fetch from blockchain
      const blockchainTx = await this.blockchain.getTransaction(txHash);
      if (blockchainTx) {
        return this.convertBlockchainTransaction(blockchainTx);
      }

      return null;
    } catch (error) {
      console.error('Error getting transaction:', error);
      return null;
    }
  }

  /**
   * Get transaction receipt
   * @param txHash
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.blockchain.getTransactionReceipt(txHash);

      if (!receipt) {
        return null;
      }

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        from: receipt.from,
        to: receipt.to,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        status: receipt.status,
        logs: receipt.logs,
        contractAddress: receipt.contractAddress
      };
    } catch (error) {
      console.error('Error getting transaction receipt:', error);
      return null;
    }
  }

  /**
   * Estimate gas and return current price and total estimated cost.
   * @param from Sender address
   * @param to Recipient address
   * @param value Amount in wei
   * @param data Optional calldata
   */
  async estimateGas(
    from: string,
    to: string,
    value: string,
    data?: string
  ): Promise<GasEstimate> {
    try {
      // Get gas estimate from blockchain
      const gasLimit = await this.blockchain.estimateGas({
        from,
        to,
        value,
        data: data || '0x'
      });

      // Get current gas prices
      const gasPrice = await this.blockchain.getGasPrice();
      const feeData = await this.blockchain.getFeeData();

      // Calculate total cost
      const totalCost = ethers.formatEther(
        BigInt(gasLimit) * BigInt(gasPrice)
      );

      const estimate: GasEstimate = {
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
        totalCost
      };

      // Update reactive reference
      this.gasEstimateRef.value = estimate;

      return estimate;
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }

  /**
   * Get the next nonce for an address.
   * @param address Address to query
   * @returns Nonce number
   */
  async getTransactionCount(address: string): Promise<number> {
    try {
      const count = await this.blockchain.getTransactionCount(address);
      return count;
    } catch (error) {
      console.error('Error getting transaction count:', error);
      return 0;
    }
  }

  /** Get the current gas price from the blockchain. */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = await this.blockchain.getGasPrice();
      return gasPrice.toString();
    } catch (error) {
      console.error('Error getting gas price:', error);
      return '0';
    }
  }

  /**
   * Cancel a pending transaction by replacing it with a higher gas price tx.
   * @param txId Internal transaction id
   * @param privateKey Private key used to sign the replacement transaction
   */
  async cancelTransaction(txId: string, privateKey: string): Promise<Transaction> {
    try {
      const pendingTx = this.pendingTransactions.get(txId);
      if (!pendingTx) {
        throw new Error('Transaction not found');
      }

      if (pendingTx.status !== 'pending') {
        throw new Error('Transaction already confirmed or failed');
      }

      // Create replacement transaction with higher gas price
      const replacementGasPrice = BigInt(pendingTx.gasPrice) * BigInt(110) / BigInt(100); // 10% higher

      // Send replacement transaction to same address with 0 value
      const _wallet = new ethers.Wallet(privateKey);
      const replacementTx = await this.sendTransaction(
        pendingTx.from,
        pendingTx.from, // Send to self
        '0',
        '0x',
        {
          nonce: pendingTx.nonce,
          gasPrice: replacementGasPrice.toString(),
          gasLimit: '21000'
        }
      );

      // Mark original transaction as failed
      pendingTx.status = 'failed';
      pendingTx.error = 'Cancelled by user';
      this.updateReactiveData();

      return replacementTx;
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      throw error;
    }
  }

  /**
   * Speed up pending transaction
   * @param txId
   * @param privateKey
   */
  async speedUpTransaction(txId: string, privateKey: string): Promise<Transaction> {
    try {
      const pendingTx = this.pendingTransactions.get(txId);
      if (!pendingTx) {
        throw new Error('Transaction not found');
      }

      if (pendingTx.status !== 'pending') {
        throw new Error('Transaction already confirmed or failed');
      }

      // Create replacement transaction with higher gas price
      const replacementGasPrice = BigInt(pendingTx.gasPrice) * BigInt(125) / BigInt(100); // 25% higher

      // Send replacement transaction with same data but higher gas
      const _wallet = new ethers.Wallet(privateKey);
      const replacementTx = await this.sendTransaction(
        pendingTx.from,
        pendingTx.to,
        pendingTx.value,
        pendingTx.data,
        {
          nonce: pendingTx.nonce,
          gasPrice: replacementGasPrice.toString(),
          gasLimit: pendingTx.gasLimit
        }
      );

      // Mark original transaction as replaced
      pendingTx.status = 'failed';
      pendingTx.error = 'Replaced with higher gas';
      this.updateReactiveData();

      return replacementTx;
    } catch (error) {
      console.error('Error speeding up transaction:', error);
      throw error;
    }
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): Transaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Get transaction history
   * @param options
   * @param options.address
   * @param options.limit
   * @param options.offset
   */
  getTransactionHistory(options?: {
    /**
     *
     */
    address?: string;
    /**
     *
     */
    limit?: number;
    /**
     *
     */
    offset?: number;
  }): Transaction[] {
    let history = [...this.transactionHistory];

    // Filter by address if provided
    if (options?.address) {
      const address = options.address.toLowerCase();
      history = history.filter(tx =>
        tx.from.toLowerCase() === address ||
        tx.to.toLowerCase() === address
      );
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return history.slice(offset, offset + limit);
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this.transactionHistory = [];
    this.historyRef.value = [];
    this.saveTransactionHistory();
  }

  /**
   * Export transaction history
   * @param format
   */
  exportTransactionHistory(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.transactionHistory, null, 2);
    } else if (format === 'csv') {
      const headers = ['ID', 'Hash', 'From', 'To', 'Value', 'Status', 'Block', 'Timestamp'];
      const rows = this.transactionHistory.map(tx => [
        tx.id,
        tx.hash,
        tx.from,
        tx.to,
        tx.value,
        tx.status,
        tx.blockNumber || '',
        new Date(tx.timestamp).toISOString()
      ]);

      return [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
    }

    throw new Error('Unsupported export format');
  }

  /**
   * Watch transaction for confirmations
   * @param txHash
   * @param callback
   */
  watchTransaction(
    txHash: string,
    callback: (receipt: TransactionReceipt) => void
  ): void {
    // Check if already watching
    if (this.transactionWatchers.has(txHash)) {
      return;
    }

    const watcher: TransactionWatcher = {
      txHash,
      callback,
      retryCount: 0,
      interval: setInterval(async () => {
        try {
          const receipt = await this.getTransactionReceipt(txHash);

          if (receipt) {
            // Transaction confirmed
            callback(receipt);
            this.stopWatchingTransaction(txHash);
          } else if (watcher.retryCount >= this.config.maxRetries) {
            // Max retries reached
            this.stopWatchingTransaction(txHash);
          } else {
            watcher.retryCount++;
          }
        } catch (error) {
          console.error('Error watching transaction:', error);
          watcher.retryCount++;
        }
      }, 5000) // Check every 5 seconds
    };

    this.transactionWatchers.set(txHash, watcher);
  }

  /**
   * Stop watching transaction
   * @param txHash
   */
  stopWatchingTransaction(txHash: string): void {
    const watcher = this.transactionWatchers.get(txHash);
    if (watcher) {
      clearInterval(watcher.interval);
      this.transactionWatchers.delete(txHash);
    }
  }

  /**
   * Disconnect from Validator services
   */
  async disconnect(): Promise<void> {
    try {
      // Stop all watchers
      for (const watcher of this.transactionWatchers.values()) {
        clearInterval(watcher.interval);
      }
      this.transactionWatchers.clear();

      // Save transaction history
      await this.saveTransactionHistory();

      // Disconnect from validator client
      await this.validatorClient.disconnect();

      console.warn('Validator Transaction Service disconnected');
    } catch (error) {
      console.error('Error disconnecting transaction service:', error);
    }
  }

  // Private helper methods
  private async loadTransactionHistory(): Promise<void> {
    try {
      // Load from local storage or IPFS
      const stored = localStorage.getItem(`tx_history_${this.config.userId}`);
      if (stored) {
        this.transactionHistory = JSON.parse(stored);
        this.historyRef.value = this.transactionHistory;
      }
    } catch (error) {
      console.error('Error loading transaction history:', error);
    }
  }

  private async saveTransactionHistory(): Promise<void> {
    try {
      // Save to local storage
      localStorage.setItem(
        `tx_history_${this.config.userId}`,
        JSON.stringify(this.transactionHistory)
      );
    } catch (error) {
      console.error('Error saving transaction history:', error);
    }
  }

  private startTransactionMonitoring(): void {
    // Monitor pending transactions every 10 seconds
    setInterval(() => {
      this.checkPendingTransactions();
    }, 10000);
  }

  private async checkPendingTransactions(): Promise<void> {
    for (const tx of this.pendingTransactions.values()) {
      if (tx.status === 'pending' && tx.hash) {
        try {
          const receipt = await this.getTransactionReceipt(tx.hash);
          if (receipt) {
            this.handleTransactionReceipt(tx.id, receipt);
          }
        } catch (error) {
          console.error(`Error checking transaction ${tx.hash}:`, error);
        }
      }
    }
  }

  private async handleTransactionReceipt(
    txId: string,
    receipt: TransactionReceipt
  ): Promise<void> {
    const tx = this.pendingTransactions.get(txId);
    if (!tx) {
      return;
    }

    // Update transaction status
    tx.status = receipt.status === 1 ? 'confirmed' : 'failed';
    tx.blockNumber = receipt.blockNumber;
    tx.confirmations = 1; // Will be updated as more blocks are mined

    if (tx.status === 'confirmed') {
      // Move to history
      this.transactionHistory.unshift(tx);
      this.pendingTransactions.delete(txId);

      // Keep history size manageable
      if (this.transactionHistory.length > 1000) {
        this.transactionHistory = this.transactionHistory.slice(0, 1000);
      }

      await this.saveTransactionHistory();
    }

    this.updateReactiveData();
  }

  private async distributeFees(tx: Transaction): Promise<void> {
    if (!this.config.enableFeeDistribution || !tx.fee) {
      return;
    }

    try {
      await this.feeDistribution.distributeFees(
        ethers.parseEther(tx.fee),
        'fixed',
        tx.hash
      );
      console.warn(`Fees distributed for transaction ${tx.hash}`);
    } catch (error) {
      console.error('Error distributing fees:', error);
    }
  }

  private convertBlockchainTransaction(blockchainTx: {
    /**
     *
     */
    hash: string;
    /**
     *
     */
    from: string;
    /**
     *
     */
    to: string;
    /**
     *
     */
    value: bigint;
    /**
     *
     */
    data: string;
    /**
     *
     */
    chainId?: number;
    /**
     *
     */
    nonce: number;
    /**
     *
     */
    gasLimit: bigint;
    /**
     *
     */
    gasPrice: bigint;
    /**
     *
     */
    blockNumber?: number;
    /**
     *
     */
    confirmations: number;
  }): Transaction {
    return {
      id: this.generateTransactionId(),
      hash: blockchainTx.hash,
      from: blockchainTx.from,
      to: blockchainTx.to,
      value: ethers.formatEther(blockchainTx.value),
      data: blockchainTx.data,
      chainId: blockchainTx.chainId?.toString() || this.config.networkId,
      nonce: blockchainTx.nonce,
      gasLimit: blockchainTx.gasLimit?.toString() || '0',
      gasPrice: blockchainTx.gasPrice?.toString() || '0',
      status: 'confirmed',
      blockNumber: blockchainTx.blockNumber,
      confirmations: blockchainTx.confirmations || 0,
      timestamp: Date.now(), // Use current timestamp since blockchainTx doesn't include timestamp
      fee: ethers.formatEther(
        BigInt(blockchainTx.gasLimit || 0) * BigInt(blockchainTx.gasPrice || 0)
      )
    };
  }

  private updateReactiveData(): void {
    this.pendingTxRef.value = Array.from(this.pendingTransactions.values());
    this.historyRef.value = [...this.transactionHistory];
  }

  private generateTransactionId(): string {
    return generateTransactionId();
  }

  private generateBatchId(): string {
    return generateBatchId();
  }
}

// Export configured instance
export const validatorTransaction = new ValidatorTransactionService({
  validatorEndpoint: import.meta.env.VITE_VALIDATOR_ENDPOINT || 'localhost:3000',
  networkId: import.meta.env.VITE_NETWORK_ID || 'omnibazaar-mainnet',
  userId: '', // Will be set when user logs in
  enableFeeDistribution: true,
  maxRetries: 60 // 5 minutes with 5-second intervals
});

export default ValidatorTransactionService;
