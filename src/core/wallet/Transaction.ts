import { TransactionRequest, AbiCoder, concat } from 'ethers';

/**
 * Core transaction data for blockchain transactions
 */
export interface TransactionData {
  /**
   *
   */
  to?: string;
  /**
   *
   */
  from?: string;
  /**
   *
   */
  nonce?: number;
  /**
   *
   */
  gasLimit?: bigint;
  /**
   *
   */
  gasPrice?: bigint;
  /**
   *
   */
  data?: string;
  /**
   *
   */
  value?: bigint;
  /**
   *
   */
  chainId?: number;
}

/**
 * Optional parameters for transaction execution
 */
export interface TransactionOptions {
  /**
   *
   */
  confirmations?: number;
  /**
   *
   */
  timeout?: number;
  /**
   *
   */
  gasLimit?: bigint;
  /**
   *
   */
  gasPrice?: bigint;
  /**
   *
   */
  maxFeePerGas?: bigint;
  /**
   *
   */
  maxPriorityFeePerGas?: bigint;
}

/**
 * Represents a blockchain transaction with gas options and utilities
 * Provides methods to convert to Ethers.js format and create common transaction types
 */
export class Transaction {
  private data: TransactionData;
  private options: TransactionOptions;

  /**
   * Creates a new Transaction instance
   * @param data - Core transaction data
   * @param options - Optional transaction parameters with defaults
   */
  constructor(data: TransactionData, options: TransactionOptions = {}) {
    this.data = data;
    this.options = {
      confirmations: 1,
      timeout: 300000, // 5 minutes
      ...options
    };
  }

  /**
   * Gets a copy of the transaction data
   * @returns Cloned transaction data object
   */
  getData(): TransactionData {
    return { ...this.data };
  }

  /**
   * Gets a copy of the transaction options
   * @returns Cloned transaction options object
   */
  getOptions(): TransactionOptions {
    return { ...this.options };
  }

  /**
   * Converts the transaction to Ethers.js TransactionRequest format
   * @returns Transaction in Ethers.js format
   */
  toEthersTransaction(): TransactionRequest {
    return {
      to: this.data.to,
      value: this.data.value,
      data: this.data.data,
      gasLimit: this.options.gasLimit || this.data.gasLimit,
      maxFeePerGas: this.options.maxFeePerGas,
      maxPriorityFeePerGas: this.options.maxPriorityFeePerGas,
      nonce: this.data.nonce,
      chainId: this.data.chainId
    };
  }

  /**
   * Creates a simple ETH transfer transaction
   * @param to - Recipient address
   * @param value - Amount to transfer in wei
   * @returns New Transaction instance
   */
  static createTransfer(to: string, value: bigint): Transaction {
    return new Transaction({
      to,
      value,
      data: '0x'
    });
  }

  /**
   * Creates a smart contract call transaction
   * @param to - Contract address
   * @param data - Encoded function call data
   * @param value - ETH value to send with call (default: 0)
   * @returns New Transaction instance
   */
  static createContractCall(
    to: string,
    data: string,
    value = 0n
  ): Transaction {
    return new Transaction({
      to,
      data,
      value
    });
  }

  /**
   * Creates an ERC-20 token transfer transaction
   * @param tokenAddress - Token contract address
   * @param to - Recipient address
   * @param amount - Amount of tokens to transfer
   * @returns New Transaction instance with encoded transfer call
   */
  static createTokenTransfer(
    tokenAddress: string,
    to: string,
    amount: bigint
  ): Transaction {
    const abiCoder = new AbiCoder();
    const data = abiCoder.encode(
      ['address', 'uint256'],
      [to, amount]
    );
    return new Transaction({
      to: tokenAddress,
      data: concat([
        '0xa9059cbb', // transfer(address,uint256)
        data
      ])
    });
  }
} 