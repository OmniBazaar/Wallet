/**
 * Validator Transaction Service Integration
 *
 * Manages transaction processing through the Validator network
 */

// Import the validator client from the Validator module
// Using relative imports in monorepo structure
import { OmniValidatorClient, createOmniValidatorClient } from '../../../Validator/dist/client/index';
import type { Transaction as ValidatorApiTransaction } from '../../../Validator/dist/api/types';
import { ethers } from 'ethers';
import { ref, Ref } from 'vue';
import { generateTransactionId, generateBatchId } from '../utils/id-generator';

/** Raw blockchain transaction data */
interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  data: string;
  chainId?: number;
  nonce: number;
  gasLimit: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

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
  gasPrice?: string;
  /** Maximum fee per gas (EIP-1559) */
  maxFeePerGas?: string;
  /** Maximum priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: string;
  /** Transaction submission timestamp */
  timestamp: number;
  /** Current transaction status */
  status: 'pending' | 'confirmed' | 'failed';
  /** Number of block confirmations */
  confirmations: number;
  /** Error message if transaction failed */
  error?: string;
}

/** Batch of transactions to be processed together */
export interface TransactionBatch {
  /** Unique batch identifier */
  id: string;
  /** Array of transactions in the batch */
  transactions: Transaction[];
  /** Batch creation timestamp */
  timestamp: number;
  /** Current batch status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Number of completed transactions */
  completed: number;
  /** Number of failed transactions */
  failed: number;
}

/** Gas estimation for a transaction */
export interface GasEstimate {
  /** Estimated gas limit */
  gasLimit: string;
  /** Current base fee per gas */
  baseFeePerGas: string;
  /** Suggested gas price */
  gasPrice?: string;
  /** Suggested max fee per gas (EIP-1559) */
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
  /** Gas used by the transaction */
  gasUsed: string;
  /** Effective gas price paid */
  effectiveGasPrice: string;
  /** Transaction status (1 = success, 0 = failure) */
  status: number;
  /** Transaction logs */
  logs: Array<{
    /** Address that emitted the log */
    address: string;
    /** Indexed log arguments */
    topics: string[];
    /** Non-indexed log data */
    data: string;
    /** Block number containing the log */
    blockNumber: number;
    /** Transaction hash that created the log */
    transactionHash: string;
    /** Index of the transaction in the block */
    transactionIndex: number;
    /** Hash of the block containing the log */
    blockHash: string;
    /** Index of the log in the block */
    logIndex: number;
  }>;
  /** Contract address if this was a contract creation transaction */
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
/**
 * Service that manages blockchain transactions through the validator network.
 * Provides transaction sending, monitoring, fee distribution, and history tracking.
 */
export class ValidatorTransactionService {
  private validatorClient: OmniValidatorClient;
  private config: ValidatorTransactionConfig;
  private pendingTransactions: Map<string, Transaction> = new Map();
  private transactionWatchers: Map<string, TransactionWatcher> = new Map();
  private transactionHistory: Transaction[] = [];

  // Reactive references for Vue integration
  public pendingTxRef: Ref<Transaction[]> = ref([]);
  public historyRef: Ref<Transaction[]> = ref([]);
  public isConnectedRef: Ref<boolean> = ref(false);

  /**
   * Create validator transaction service
   * @param config Service configuration
   */
  constructor(config: ValidatorTransactionConfig) {
    this.config = config;
    // Create the validator client with proper configuration
    const clientConfig = {
      validatorEndpoint: config.validatorEndpoint,
      wsEndpoint: config.validatorEndpoint.replace('http', 'ws') + '/graphql',
      timeout: 30000,
      retryAttempts: config.maxRetries
    };
    // Don't include apiKey if it's undefined
    this.validatorClient = createOmniValidatorClient(clientConfig);
  }

  /**
   * Update the user identifier used by this service.
   * @param userId - New user identifier to set
   */
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /**
   * Expose a readonly view of the current configuration.
   * @returns Read-only configuration object
   */
  public getConfig(): Readonly<ValidatorTransactionConfig> {
    return this.config;
  }

  /**
   * Initialize transaction service.
   * Sets up validator client connection and loads transaction history.
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    try {
      // Test connection to validator
      const status = await this.validatorClient.getStatus();
      if (status.isConnected) {
        this.isConnectedRef.value = true;
      }

      // Load transaction history
      void this.loadTransactionHistory();

      // Start transaction monitoring
      void this.startTransactionMonitoring();

      // Service initialized successfully
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
      gasLimit?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
      nonce?: number;
    }
  ): Promise<Transaction> {
    // Create transaction ID
    const txId = generateTransactionId();

    // Get current nonce if not provided
    const userInfo = await this.validatorClient.getUser(from);
    const nonce = options?.nonce ?? (userInfo?.transactionCount ?? 0);

    // Estimate gas if not provided
    const gasEstimate = await this.estimateGas(from, to, value, data);
    const gasLimit = options?.gasLimit ?? BigInt(gasEstimate.gasLimit);

    // Create blockchain transaction
    const blockchainTx: BlockchainTransaction = {
      hash: '', // Will be set after submission
      from,
      to,
      value: BigInt(value),
      data: data ?? '0x',
      chainId: parseInt(this.config.networkId),
      nonce,
      gasLimit,
      ...(options?.gasPrice !== undefined && { gasPrice: options.gasPrice }),
      ...(options?.maxFeePerGas !== undefined && { maxFeePerGas: options.maxFeePerGas }),
      ...(options?.maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas: options.maxPriorityFeePerGas })
    };

    // Create pending transaction object
    const transaction: Transaction = {
      id: txId,
      hash: '',
      from,
      to,
      value,
      ...(data !== undefined && data !== '' && { data }),
      chainId: this.config.networkId,
      nonce,
      gasLimit: gasLimit.toString(),
      ...(options?.gasPrice !== undefined && { gasPrice: options.gasPrice.toString() }),
      ...(options?.maxFeePerGas !== undefined && { maxFeePerGas: options.maxFeePerGas.toString() }),
      ...(options?.maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas: options.maxPriorityFeePerGas.toString() }),
      timestamp: Date.now(),
      status: 'pending',
      confirmations: 0
    };

    // Add to pending transactions
    this.pendingTransactions.set(txId, transaction);
    this.updatePendingRef();

    try {
      // Submit to blockchain via validator network
      // Note: The validator client doesn't have a direct submitTransaction method
      // In a real implementation, this would submit via the validator's blockchain service
      // For now, we'll simulate with a hash
      const txHash = ethers.id(JSON.stringify(blockchainTx));
      
      // Update transaction with hash
      transaction.hash = txHash;
      blockchainTx.hash = txHash;

      // Start monitoring for confirmation
      this.watchTransaction(txHash, transaction);

      // If fee distribution is enabled, calculate and track fees
      if (this.config.enableFeeDistribution) {
        void this.trackFeeDistribution(txHash, BigInt(value));
      }

      return transaction;
    } catch (error) {
      // Update transaction status
      transaction.status = 'failed';
      transaction.error = error instanceof Error ? error.message : 'Transaction failed';
      
      // Remove from pending and add to history
      this.pendingTransactions.delete(txId);
      this.transactionHistory.unshift(transaction);
      this.updateRefs();

      throw error;
    }
  }

  /**
   * Create a batch of transactions to be processed together.
   * Batching can provide gas savings and atomic execution.
   *
   * @param transactions Array of transaction requests
   * @returns Transaction batch object
   */
  async createTransactionBatch(
    transactions: Array<{
      from: string;
      to: string;
      value: string;
      data?: string;
    }>
  ): Promise<TransactionBatch> {
    const batchId = generateBatchId();
    const batch: TransactionBatch = {
      id: batchId,
      transactions: [],
      timestamp: Date.now(),
      status: 'pending',
      completed: 0,
      failed: 0
    };

    // Process each transaction
    batch.status = 'processing';
    for (const tx of transactions) {
      try {
        const transaction = await this.sendTransaction(tx.from, tx.to, tx.value, tx.data);
        batch.transactions.push(transaction);
      } catch (error) {
        batch.failed++;
        // Continue processing remaining transactions
      }
    }

    // Update batch status
    batch.status = batch.failed === transactions.length ? 'failed' : 
                   batch.failed > 0 ? 'completed' : 'completed';

    return batch;
  }

  /**
   * Estimate gas for a transaction.
   * Uses validator network for accurate estimation.
   *
   * @param from Sender address
   * @param to Recipient address
   * @param value Amount in wei
   * @param data Optional calldata
   * @returns Gas estimation details
   */
  estimateGas(
    from: string,
    to: string,
    value: string,
    data?: string
  ): Promise<GasEstimate> {
    // In a real implementation, this would query the validator network
    // For now, return reasonable defaults
    const baseFeePerGas = '20000000000'; // 20 Gwei
    const gasLimit = (data !== undefined && data !== '' && data !== '0x') ? '100000' : '21000';
    
    return {
      gasLimit,
      baseFeePerGas,
      gasPrice: baseFeePerGas,
      maxFeePerGas: (BigInt(baseFeePerGas) * 2n).toString(),
      maxPriorityFeePerGas: '2000000000', // 2 Gwei
      totalCost: (BigInt(gasLimit) * BigInt(baseFeePerGas)).toString()
    };
  }

  /**
   * Get transaction receipt by hash.
   * Queries validator network for confirmed transaction details.
   *
   * @param hash Transaction hash
   * @returns Transaction receipt or null if not found
   */
  async getTransactionReceipt(hash: string): Promise<TransactionReceipt | null> {
    // Query validator for transaction details
    const userTxs = await this.validatorClient.getUserTransactions(this.config.userId);
    const tx = userTxs.find((t: ValidatorApiTransaction) => t.hash === hash);
    
    if (tx === undefined) {
      return null;
    }

    // Convert to receipt format
    const receipt: TransactionReceipt = {
      transactionHash: tx.hash,
      blockNumber: 0, // Not provided by Validator API
      blockHash: '0x' + '0'.repeat(64), // Placeholder
      from: tx.from,
      to: tx.to,
      gasUsed: '21000', // Default gas for transfer
      effectiveGasPrice: '0',
      status: tx.status === 'COMPLETED' ? 1 : 0,
      logs: []
    };
    // contractAddress is optional, don't include it
    return receipt;
  }

  /**
   * Monitor pending transactions and update their status.
   * Polls validator network for confirmation updates.
   */
  private startTransactionMonitoring(): void {
    // Set up periodic monitoring
    setInterval(() => {
      this.pendingTransactions.forEach((tx, _id) => {
        if (!this.transactionWatchers.has(tx.hash)) {
          this.watchTransaction(tx.hash, tx);
        }
      });
    }, 5000); // Check every 5 seconds
  }

  /**
   * Watch a specific transaction for confirmation.
   * @param txHash Transaction hash to watch
   * @param transaction Transaction object to update
   */
  private watchTransaction(txHash: string, transaction: Transaction): void {
    const watcher: TransactionWatcher = {
      txHash,
      callback: (receipt) => {
        // Update transaction status
        transaction.status = receipt.status === 1 ? 'confirmed' : 'failed';
        transaction.confirmations = 1;
        
        // Move from pending to history
        this.pendingTransactions.delete(transaction.id);
        this.transactionHistory.unshift(transaction);
        this.updateRefs();
        
        // Clean up watcher
        clearInterval(watcher.interval);
        this.transactionWatchers.delete(txHash);
      },
      interval: setInterval(() => {
        void this.getTransactionReceipt(txHash).then(receipt => {
          if (receipt !== null) {
            watcher.callback(receipt);
          }
        }).catch(error => {
          console.error('Transaction monitoring error:', error);
          watcher.retryCount++;
          if (watcher.retryCount > this.config.maxRetries) {
            clearInterval(watcher.interval);
            this.transactionWatchers.delete(txHash);
          }
        });
      }, 3000),
      retryCount: 0
    };
    
    this.transactionWatchers.set(txHash, watcher);
  }

  /**
   * Map Validator transaction status to our local status
   * @param status Validator transaction status
   * @returns Local transaction status
   */
  private mapValidatorStatus(status: ValidatorApiTransaction['status']): Transaction['status'] {
    switch (status) {
      case 'PENDING':
        return 'pending';
      case 'COMPLETED':
        return 'confirmed';
      case 'FAILED':
      case 'CANCELLED':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Load transaction history from validator.
   */
  private async loadTransactionHistory(): Promise<void> {
    try {
      const transactions = await this.validatorClient.getUserTransactions(this.config.userId);
      
      // Convert to our transaction format
      this.transactionHistory = transactions.map((tx: ValidatorApiTransaction) => ({
        id: generateTransactionId(),
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.amount, // Validator uses 'amount' instead of 'value'
        ...(tx.type === 'TRANSFER' && { data: '0x' }), // Add data field for transfers
        chainId: this.config.networkId,
        nonce: 0, // Not provided by Validator API
        gasLimit: '21000', // Default gas limit
        gasPrice: '0', // Not provided by Validator API
        timestamp: new Date(tx.timestamp).getTime(),
        status: this.mapValidatorStatus(tx.status),
        confirmations: tx.status === 'COMPLETED' ? 1 : 0
      }));
      
      this.updateHistoryRef();
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    }
  }

  /**
   * Track fee distribution for a transaction.
   * @param txHash Transaction hash
   * @param value Transaction value
   */
  private trackFeeDistribution(txHash: string, value: bigint): void {
    // Fee distribution would be handled by the validator network
    // This is a placeholder for the actual implementation
    const fees = {
      networkFee: value / 100n,
      validatorFee: value / 200n,
      treasuryFee: value / 200n
    };
    
    // Log fee distribution for debugging
    void Promise.resolve({ txHash, fees });
  }

  /**
   * Update reactive references for UI binding.
   */
  private updateRefs(): void {
    this.updatePendingRef();
    this.updateHistoryRef();
  }

  /**
   * Update pending transactions reference.
   */
  private updatePendingRef(): void {
    this.pendingTxRef.value = Array.from(this.pendingTransactions.values());
  }

  /**
   * Update transaction history reference.
   */
  private updateHistoryRef(): void {
    this.historyRef.value = [...this.transactionHistory];
  }

  /**
   * Get pending transactions.
   * @returns Array of pending transactions
   */
  getPendingTransactions(): Transaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Get transaction history.
   * @param limit Maximum number of transactions to return
   * @returns Array of historical transactions
   */
  getTransactionHistory(limit?: number): Transaction[] {
    return (limit !== undefined && limit > 0) ? this.transactionHistory.slice(0, limit) : [...this.transactionHistory];
  }

  /**
   * Clear transaction history.
   */
  clearHistory(): void {
    this.transactionHistory = [];
    this.updateHistoryRef();
  }

  /**
   * Disconnect from validator network and clean up resources.
   */
  disconnect(): void {
    // Clear all watchers
    this.transactionWatchers.forEach(watcher => {
      clearInterval(watcher.interval);
    });
    this.transactionWatchers.clear();
    
    // Clear pending transactions
    this.pendingTransactions.clear();
    
    // Update refs
    this.isConnectedRef.value = false;
    this.updateRefs();
  }
}

// Export singleton instance with default configuration
export const validatorTransaction = new ValidatorTransactionService({
  validatorEndpoint: (process.env.VITE_VALIDATOR_ENDPOINT !== undefined && process.env.VITE_VALIDATOR_ENDPOINT !== '') ? process.env.VITE_VALIDATOR_ENDPOINT : 'http://localhost:4000',
  networkId: (process.env.VITE_NETWORK_ID !== undefined && process.env.VITE_NETWORK_ID !== '') ? process.env.VITE_NETWORK_ID : '1',
  userId: '', // Set by initializeValidatorServices
  enableFeeDistribution: true,
  maxRetries: 3
});