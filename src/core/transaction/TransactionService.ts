/**
 * Transaction Service for handling multi‑chain transactions with ENS resolution.
 *
 * Responsibilities:
 * - Resolve human‑readable names (ENS/Omni usernames) to addresses per chain
 * - Prepare, sign and persist outgoing transactions
 * - Provide lightweight validation and gas estimation
 * - Persist, fetch and annotate transaction history via the DB adapter
 */

import { ethers } from 'ethers';
import { KeyringManager } from '../keyring/KeyringManager';
import { TransactionDatabase } from '../../services/database/TransactionDatabase';

/** Transaction request parameters */
export interface TransactionRequest {
  /** Recipient address or ENS name */
  to: string;           // Can be address or ENS name
  /** Transaction value in wei */
  value?: string;       // Amount in wei
  /** Transaction data payload */
  data?: string;        // Transaction data
  /** Target blockchain network */
  chainType: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism';
  /** Gas limit for transaction */
  gasLimit?: number;
  /** Gas price in wei */
  gasPrice?: string;
}

/** Result of a completed transaction */
export interface TransactionResult {
  /** Transaction hash */
  hash: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Transaction value */
  value: string;
  /** Blockchain network */
  chainType: string;
  /** Address after ENS resolution */
  resolvedAddress: string;
  /** Original input address/ENS name */
  originalAddress: string;
}

/** Service for handling multi-chain transactions with ENS resolution */
export class TransactionService {
  private static instance: TransactionService;
  private keyringManager: KeyringManager;
  private transactionDb: TransactionDatabase;

  private constructor() {
    this.keyringManager = KeyringManager.getInstance();
    this.transactionDb = new TransactionDatabase();
  }

  /**
   * Get singleton instance of TransactionService
   * @returns TransactionService instance
   */
  public static getInstance(): TransactionService {
    if (TransactionService.instance == null) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Send a transaction after resolving the destination to a chain address.
   * Supports names such as `bob.eth`, `alice.omnicoin`, or raw addresses.
   *
   * Persists a pending record in the transaction database on success.
   *
   * @param request Transaction request parameters
   * @returns Result containing hashes and resolved addressing info
   * @throws Error if resolution fails or user session is not available
   */
  public async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    try {
      // 1. Resolve destination address
      const resolvedAddress = await this.keyringManager.resolveAddressForChain(
        request.to,
        request.chainType
      );

      if (!resolvedAddress) {
        throw new Error(`Could not resolve address: ${request.to}`);
      }

      // 2. Get current user session
      const session = this.keyringManager.getCurrentSession();
      if (!session) {
        throw new Error('User not logged in');
      }

      // 3. Prepare transaction
      const transaction = {
        to: resolvedAddress,
        value: request.value || '0',
        data: request.data || '0x',
        gasLimit: request.gasLimit || 21000,
        gasPrice: request.gasPrice || '20000000000' // 20 gwei
      };

      // 4. Sign transaction
      const chainType = request.chainType === 'ethereum' ? 'ethereum' : 'ethereum'; // All EVM chains use ethereum account
      const signedTx = await this.keyringManager.signTransaction(transaction, chainType);

      // 5. Store transaction in database
      try {
        await this.transactionDb.storeTransaction({
          txHash: signedTx,
          userAddress: session.accounts.ethereum.address,
          txType: 'send',
          fromAddress: session.accounts.ethereum.address,
          toAddress: resolvedAddress,
          amount: transaction.value,
          tokenSymbol: 'ETH', // Default to ETH, can be updated for token transfers
          status: 'pending',
          gasPrice: transaction.gasPrice,
          createdAt: new Date(),
          metadata: {
            chainType: request.chainType,
            originalAddress: request.to,
            resolvedAddress: resolvedAddress
          }
        });
      } catch (dbError) {
        console.warn('Failed to store transaction in database:', dbError);
        // Continue even if database storage fails
      }

      // 6. Return transaction result
      return {
        hash: signedTx,
        from: session.accounts.ethereum.address,
        to: resolvedAddress,
        value: transaction.value,
        chainType: request.chainType,
        resolvedAddress: resolvedAddress,
        originalAddress: request.to
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for the current user, optionally filtered.
   *
   * @param filters Optional filters and pagination
   * @param filters.txType Transaction category to include
   * @param filters.status Status to include (pending/confirmed/failed)
   * @param filters.fromDate Only include transactions on/after this date
   * @param filters.toDate Only include transactions on/before this date
   * @param filters.limit Maximum number of rows to return
   * @param filters.offset Number of rows to skip (for pagination)
   * @returns A list of transactions and a total count
   */
  public async getTransactionHistory(filters?: {
    /** Transaction category to include */
    txType?: 'send' | 'receive' | 'swap' | 'stake' | 'purchase' | 'sale';
    /** Status to include (pending/confirmed/failed) */
    status?: 'pending' | 'confirmed' | 'failed';
    /** Only include transactions on/after this date */
    fromDate?: Date;
    /** Only include transactions on/before this date */
    toDate?: Date;
    /** Maximum number of rows to return */
    limit?: number;
    /** Number of rows to skip (for pagination) */
    offset?: number;
  }) {
    const session = this.keyringManager.getCurrentSession();
    if (!session) {
      throw new Error('User not logged in');
    }

    try {
      const result = await this.transactionDb.getUserTransactions(
        session.accounts.ethereum.address,
        filters
      );
      return result;
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return { transactions: [], total: 0 };
    }
  }

  /**
   * Get a transaction by hash from the transaction database.
   *
   * @param txHash Transaction hash
   * @returns Transaction record or null if not found
   */
  public async getTransaction(txHash: string) {
    try {
      return await this.transactionDb.getTransaction(txHash);
    } catch (error) {
      console.error('Failed to get transaction:', error);
      return null;
    }
  }

  /**
   * Update a transaction’s status in the database (monitoring helper).
   *
   * @param txHash Transaction hash to update
   * @param status New status
   * @param blockNumber Optional block number
   * @param confirmations Optional confirmation count
   */
  public async updateTransactionStatus(
    txHash: string,
    status: 'pending' | 'confirmed' | 'failed',
    blockNumber?: number,
    confirmations?: number
  ) {
    try {
      await this.transactionDb.updateTransactionStatus(
        txHash,
        status,
        blockNumber,
        confirmations
      );
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  }

  /**
   * Return all pending transactions for the current session user.
   */
  public async getPendingTransactions() {
    const session = this.keyringManager.getCurrentSession();
    if (!session) {
      return [];
    }

    try {
      return await this.transactionDb.getPendingTransactions(
        session.accounts.ethereum.address
      );
    } catch (error) {
      console.error('Failed to get pending transactions:', error);
      return [];
    }
  }

  /**
   * Attach a note and optional categorization/tags to a transaction.
   *
   * @param txHash Transaction hash to annotate
   * @param note Note text
   * @param category Optional category label
   * @param tags Optional free‑form tag list
   */
  public async addTransactionNote(
    txHash: string,
    note: string,
    category?: string,
    tags?: string[]
  ) {
    try {
      await this.transactionDb.addTransactionNote(txHash, note, category, tags);
    } catch (error) {
      console.error('Failed to add transaction note:', error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction after resolving the destination.
   * This is a simplified heuristic used when a live provider estimate
   * is not available.
   *
   * @param request Transaction request parameters
   * @returns Estimated gas units
   */
  public async estimateGas(request: TransactionRequest): Promise<number> {
    try {
      // Resolve destination address
      const resolvedAddress = await this.keyringManager.resolveAddressForChain(
        request.to,
        request.chainType
      );

      if (!resolvedAddress) {
        throw new Error(`Could not resolve address: ${request.to}`);
      }

      // Get current user session
      const session = this.keyringManager.getCurrentSession();
      if (!session) {
        throw new Error('User not logged in');
      }

      // Estimate gas (simplified - would need actual provider)
      const baseGas = 21000; // Basic transfer
      const dataGas = request.data ? (request.data.length - 2) / 2 * 68 : 0; // Data cost

      return baseGas + dataGas;
    } catch (error) {
      console.error('Gas estimation failed:', error);
      throw error;
    }
  }

  /**
   * Validate a transaction request prior to sending.
   * Performs name/address resolution, numeric validation and limits.
   *
   * @param request Transaction request parameters
   * @returns Validation result with aggregated errors and resolved address
   */
  public async validateTransaction(request: TransactionRequest): Promise<{
    /** Whether the request passed validation */
    valid: boolean;
    /** List of validation errors (empty when valid) */
    errors: string[];
    /** Resolved chain address if available */
    resolvedAddress?: string;
  }> {
    const errors: string[] = [];
    let resolvedAddress: string | undefined;

    try {
      // Check if user is logged in
      const session = this.keyringManager.getCurrentSession();
      if (!session) {
        errors.push('User not logged in');
        return { valid: false, errors };
      }

      // Resolve destination address
      resolvedAddress = await this.keyringManager.resolveAddressForChain(
        request.to,
        request.chainType
      );

      if (!resolvedAddress) {
        errors.push(`Could not resolve address: ${request.to}`);
      }

      // Validate value
      if (request.value) {
        try {
          const value = ethers.parseEther(request.value);
          if (value < 0) {
            errors.push('Value cannot be negative');
          }
        } catch {
          errors.push('Invalid value format');
        }
      }

      // Validate gas settings
      if (request.gasLimit && request.gasLimit < 21000) {
        errors.push('Gas limit too low (minimum 21000)');
      }

      if (request.gasPrice) {
        try {
          const gasPrice = ethers.parseUnits(request.gasPrice, 'gwei');
          if (gasPrice <= 0) {
            errors.push('Gas price must be greater than 0');
          }
        } catch {
          errors.push('Invalid gas price format');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        resolvedAddress
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Placeholder: returns an empty list until history backend is wired.
   */
  public async getTransactionHistory(): Promise<TransactionResult[]> {
    // TODO: Implement transaction history retrieval
    return [];
  }

  /**
   * Check whether a value is a valid address or resolvable name.
   *
   * @param addressOrName Raw address or human‑readable name
   * @returns True if valid or resolvable, false otherwise
   */
  public async isValidDestination(addressOrName: string): Promise<boolean> {
    try {
      // Check if it's a valid address
      if (ethers.isAddress(addressOrName)) {
        return true;
      }

      // Check if it's a valid ENS name
      const resolved = await this.keyringManager.resolveAddress(addressOrName);
      return resolved !== null;
    } catch (error) {
      console.error('Error validating destination:', error);
      return false;
    }
  }
}
