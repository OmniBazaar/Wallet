import { AbiCoder, concat } from 'ethers';
import type { TransactionRequest, AddressLike } from 'ethers';

/** Core transaction data for blockchain transactions */
export interface TransactionData {
    /** Recipient address (optional) */
    to?: string;
    /** Sender address (optional) */
    from?: string;
    /** Transaction nonce (optional) */
    nonce?: number;
    /** Gas limit for transaction (optional) */
    gasLimit?: bigint;
    /** Gas price in wei (optional) */
    gasPrice?: bigint;
    /** Transaction data payload (optional) */
    data?: string;
    /** Transaction value in wei (optional) */
    value?: bigint;
    /** Chain ID (optional) */
    chainId?: number;
}

/** Optional parameters for transaction execution */
export interface TransactionOptions {
    /** Number of confirmations to wait for (optional) */
    confirmations?: number;
    /** Transaction timeout in milliseconds (optional) */
    timeout?: number;
    /** Gas limit override (optional) */
    gasLimit?: bigint;
    /** Gas price override (optional) */
    gasPrice?: bigint;
    /** Maximum fee per gas for EIP-1559 (optional) */
    maxFeePerGas?: bigint;
    /** Maximum priority fee per gas for EIP-1559 (optional) */
    maxPriorityFeePerGas?: bigint;
}

/** Represents a blockchain transaction with gas options and utilities */
export class Transaction {
    private data: TransactionData;
    private options: TransactionOptions;

    /**
     * Creates a new Transaction instance
     * @param data Core transaction data
     * @param options Optional transaction parameters with defaults
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
     * Converts to ethers TransactionRequest format
     * @returns Transaction in ethers format
     */
    toEthersTransaction(): TransactionRequest {
        return {
            to: (this.data.to as unknown as AddressLike) ?? null,
            ...(this.data.value != null && { value: this.data.value }),
            ...(this.data.data && { data: this.data.data }),
            ...((this.options.gasLimit ?? this.data.gasLimit) != null && { gasLimit: this.options.gasLimit ?? this.data.gasLimit }),
            ...(this.options.maxFeePerGas != null && { maxFeePerGas: this.options.maxFeePerGas }),
            ...(this.options.maxPriorityFeePerGas != null && { maxPriorityFeePerGas: this.options.maxPriorityFeePerGas }),
            ...(this.data.nonce != null && { nonce: this.data.nonce }),
            ...(this.data.chainId != null && { chainId: this.data.chainId })
        };
    }

    // Helper methods for common transaction types
    /**
     * Creates a simple ETH transfer transaction
     * @param to Recipient address
     * @param value Amount to transfer in wei
     * @returns New Transaction instance for transfer
     */
    static createTransfer(to: string, value: bigint): Transaction {
        return new Transaction({
            to,
            value,
            data: '0x'
        });
    }

    /**
     *
     * @param to
     * @param data
     * @param value
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
     *
     * @param tokenAddress
     * @param to
     * @param amount
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
