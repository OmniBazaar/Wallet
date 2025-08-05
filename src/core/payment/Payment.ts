import { ethers } from 'ethers';
import { Wallet } from '../wallet/Wallet';
import { Transaction } from '../wallet/Transaction';
import { OmniCoinMetadata } from '../blockchain/OmniCoin';

export interface PaymentRequest {
  to: string;
  amount: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResponse {
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  confirmations?: number;
}

export class PaymentError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class Payment {
  private wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  async sendPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Convert amount to wei
      const amount = ethers.utils.parseUnits(request.amount, OmniCoinMetadata.decimals);

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

  async getPaymentStatus(transactionHash: string): Promise<PaymentResponse> {
    try {
      const provider = this.wallet.getProvider();
      const tx = await provider.getTransaction(transactionHash);
      if (!tx) {
        throw new PaymentError('Transaction not found', 'TX_NOT_FOUND');
      }
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.transactionHash,
        status: receipt.status ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentError(
        `Failed to get payment status: ${errorMessage}`,
        'STATUS_CHECK_FAILED'
      );
    }
  }

  async estimateGas(request: PaymentRequest): Promise<ethers.BigNumber> {
    try {
      const amount = ethers.utils.parseUnits(request.amount, OmniCoinMetadata.decimals);
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