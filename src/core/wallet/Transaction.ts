import { ethers } from 'ethers';

export interface TransactionData {
  to?: string;
  from?: string;
  nonce?: number;
  gasLimit?: bigint;
  gasPrice?: bigint;
  data?: string;
  value?: bigint;
  chainId?: number;
}

export interface TransactionOptions {
  confirmations?: number;
  timeout?: number;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export class Transaction {
  private data: TransactionData;
  private options: TransactionOptions;

  constructor(data: TransactionData, options: TransactionOptions = {}) {
    this.data = data;
    this.options = {
      confirmations: 1,
      timeout: 300000, // 5 minutes
      ...options
    };
  }

  getData(): TransactionData {
    return { ...this.data };
  }

  getOptions(): TransactionOptions {
    return { ...this.options };
  }

  toEthersTransaction(): ethers.TransactionRequest {
    return {
      ...this.data,
      gasLimit: this.options.gasLimit || this.data.gasLimit,
      gasPrice: this.options.gasPrice || this.data.gasPrice,
      maxFeePerGas: this.options.maxFeePerGas,
      maxPriorityFeePerGas: this.options.maxPriorityFeePerGas
    };
  }

  // Helper methods for common transaction types
  static createTransfer(to: string, value: bigint): Transaction {
    return new Transaction({
      to,
      value,
      data: '0x'
    });
  }

  static createContractCall(
    to: string,
    data: string,
    value: bigint = 0n
  ): Transaction {
    return new Transaction({
      to,
      data,
      value
    });
  }

  static createTokenTransfer(
    tokenAddress: string,
    to: string,
    amount: bigint
  ): Transaction {
    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [to, amount]
    );
    return new Transaction({
      to: tokenAddress,
      data: ethers.concat([
        '0xa9059cbb', // transfer(address,uint256)
        data
      ])
    });
  }
} 