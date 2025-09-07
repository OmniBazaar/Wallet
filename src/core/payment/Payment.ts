import { ethers } from 'ethers';
import { Wallet } from '../wallet/Wallet';
import { Transaction } from '../wallet/Transaction';
import { OmniCoinMetadata } from '../blockchain/OmniCoin';

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
 *
 */
export class Payment {
  private wallet: Wallet;

  /**
   *
   * @param wallet
   */
  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  /**
   *
   * @param request
   */
  async sendPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Convert amount to wei
      const amount = ethers.parseUnits(request.amount, OmniCoinMetadata.decimals);

      // Create and send transaction
      const tx = Transaction.createTokenTransfer(
        OmniCoinMetadata.contractAddress,
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
   *
   * @param transactionHash
   */
  async getPaymentStatus(transactionHash: string): Promise<PaymentResponse> {
    try {
      const provider = this.wallet.getProvider();
      const tx = await provider.getTransaction(transactionHash);
      if (!tx) {
        throw new PaymentError('Transaction not found', 'TX_NOT_FOUND');
      }
      const receipt = await tx.wait();
      if (!receipt) {
        return {
          transactionHash,
          status: 'pending',
        };
      }
      let confirmations: number | undefined;
      const rc: any = receipt as any;
      if (typeof rc.confirmations === 'function') {
        confirmations = await rc.confirmations();
      } else {
        confirmations = rc.confirmations ?? undefined;
      }
      return {
        transactionHash: (rc.transactionHash ?? rc.hash) as string,
        status: rc.status ? 'confirmed' : 'failed',
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
   *
   * @param request
   */
  async estimateGas(request: PaymentRequest): Promise<bigint> {
    try {
      const amount = ethers.parseUnits(request.amount, OmniCoinMetadata.decimals);
      const tx = Transaction.createTokenTransfer(
        OmniCoinMetadata.contractAddress,
        request.to,
        amount
      );

      const provider = this.wallet.getProvider();
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
