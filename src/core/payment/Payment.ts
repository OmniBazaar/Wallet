import { ethers } from 'ethers';
import { Wallet } from '../wallet/Wallet';
import { Transaction } from '../wallet/Transaction';
import { OmniCoinMetadata, getContractAddress } from '../blockchain/OmniCoin';

/** Payment request parameters */
export interface PaymentRequest {
  /** Recipient address or ENS name */
  to: string;
  /** Payment amount (in human-readable format) */
  amount: string;
  /** Optional payment description */
  description?: string;
  /** Optional payment metadata */
  metadata?: Record<string, unknown>;
}

/** Payment transaction response */
export interface PaymentResponse {
  /** Transaction hash */
  transactionHash: string;
  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed';
  /** Block number (optional) */
  blockNumber?: number;
  /** Number of confirmations (optional) */
  confirmations?: number;
}

/** Payment-specific error class */
export class PaymentError extends Error {
  /**
   * Create a new payment error
   * @param message Error message
   * @param code Error code
   */
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Payment service for OmniCoin transactions
 */
export class Payment {
  private wallet: Wallet;

  /**
   * Create a new Payment service
   * @param wallet - Wallet instance for managing transactions
   */
  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  /**
   * Send a payment to another address
   * @param request - Payment request parameters
   * @returns Promise resolving to payment response
   */
  async sendPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Convert amount to wei
      const amount = ethers.parseUnits(request.amount, OmniCoinMetadata.decimals);

      // Get contract address for current network
      const provider = this.wallet.getProvider();
      const contractAddress = getContractAddress(provider);

      // Create and send transaction
      const tx = Transaction.createTokenTransfer(
        contractAddress,
        request.to,
        amount
      );

      const response = await this.wallet.sendTransaction(tx);

      return {
        transactionHash: response.hash,
        status: 'pending',
        confirmations: 0
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentError(
        `Payment failed: ${errorMessage}`,
        'PAYMENT_FAILED'
      );
    }
  }

  /**
   * Get the status of a payment transaction
   * @param transactionHash - Transaction hash to check
   * @returns Promise resolving to payment response with status
   */
  async getPaymentStatus(transactionHash: string): Promise<PaymentResponse> {
    try {
      const provider = this.wallet.getProvider();
      const tx = await provider.getTransaction(transactionHash);
      if (tx === null || tx === undefined) {
        throw new PaymentError('Transaction not found', 'TX_NOT_FOUND');
      }
      const receipt = await tx.wait();
      if (receipt === null || receipt === undefined) {
        return {
          transactionHash,
          status: 'pending',
        };
      }
      let confirmations: number | undefined;
      const rc = receipt as { confirmations?: number | (() => Promise<number>); transactionHash?: string; hash?: string; status?: number | boolean; blockNumber?: number | bigint };
      if (typeof rc.confirmations === 'function') {
        confirmations = await rc.confirmations();
      } else {
        confirmations = rc.confirmations ?? undefined;
      }
      return {
        transactionHash: (rc.transactionHash ?? rc.hash) as string,
        status: (rc.status === true || rc.status === 1) ? 'confirmed' : 'failed',
        ...(rc.blockNumber != null && { blockNumber: Number(rc.blockNumber) }),
        ...(confirmations != null && { confirmations }),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentError(
        `Failed to get payment status: ${errorMessage}`,
        'STATUS_CHECK_FAILED'
      );
    }
  }

  /**
   * Estimate gas required for a payment
   * @param request - Payment request parameters
   * @returns Promise resolving to estimated gas amount
   */
  async estimateGas(request: PaymentRequest): Promise<bigint> {
    try {
      const amount = ethers.parseUnits(request.amount, OmniCoinMetadata.decimals);
      const provider = this.wallet.getProvider();
      const contractAddress = getContractAddress(provider);

      const tx = Transaction.createTokenTransfer(
        contractAddress,
        request.to,
        amount
      );
      return provider.estimateGas(tx.toEthersTransaction());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentError(
        `Failed to estimate gas: ${errorMessage}`,
        'GAS_ESTIMATE_FAILED'
      );
    }
  }
}
