/**
 * Transaction Service for handling multi-chain transactions with ENS resolution
 */

import { ethers } from 'ethers';
import { KeyringManager } from '../keyring/KeyringManager';
import { TransactionDatabase } from '../../services/database/TransactionDatabase';

export interface TransactionRequest {
  to: string;           // Can be address or ENS name
  value?: string;       // Amount in wei
  data?: string;        // Transaction data
  chainType: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism';
  gasLimit?: number;
  gasPrice?: string;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  chainType: string;
  resolvedAddress: string;
  originalAddress: string;
}

export class TransactionService {
  private static instance: TransactionService;
  private keyringManager: KeyringManager;
  private transactionDb: TransactionDatabase;

  private constructor() {
    this.keyringManager = KeyringManager.getInstance();
    this.transactionDb = new TransactionDatabase();
  }

  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Send transaction with ENS resolution
   * Supports sending to bob.eth, alice.omnicoin, or regular addresses
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
   * Get transaction history for current user
   */
  public async getTransactionHistory(filters?: {
    txType?: 'send' | 'receive' | 'swap' | 'stake' | 'purchase' | 'sale';
    status?: 'pending' | 'confirmed' | 'failed';
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
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
   * Get transaction by hash
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
   * Update transaction status (for monitoring)
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
   * Get pending transactions for monitoring
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
   * Add note to transaction
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
   * Estimate gas for transaction with ENS resolution
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
   * Validate transaction before sending
   */
  public async validateTransaction(request: TransactionRequest): Promise<{
    valid: boolean;
    errors: string[];
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
   * Get transaction history (placeholder for future implementation)
   */
  public async getTransactionHistory(): Promise<TransactionResult[]> {
    // TODO: Implement transaction history retrieval
    return [];
  }

  /**
   * Check if an address or name is valid for transactions
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