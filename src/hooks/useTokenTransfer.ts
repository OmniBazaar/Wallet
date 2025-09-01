import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';

const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)'
];

/**
 * React hook that provides safe ERC‑20 token transfer helpers.
 * Returns reactive state for transfer progress and errors, plus
 * convenience methods for `transfer` and `transferFrom` using the
 * connected wallet signer.
 *
 * @param tokenAddress Contract address of the ERC‑20 token
 * @returns Reactive state and transfer helpers
 */
export const useTokenTransfer = (tokenAddress: string): {
    /** Whether a transfer is currently in progress */
    isTransferring: boolean;
    /** Last error message (if any) */
    error: string | null;
    /** Last successful transaction hash */
    lastTxHash: string | null;
    /** Transfer tokens from the connected account to `to` */
    transfer: (to: string, amount: string) => Promise<ethers.TransactionReceipt>;
    /** Transfer tokens from `from` to `to` (requires prior allowance) */
    transferFrom: (from: string, to: string, amount: string) => Promise<ethers.TransactionReceipt>;
} => {
    const { provider, address } = useWallet();
    const [isTransferring, setIsTransferring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastTxHash, setLastTxHash] = useState<string | null>(null);

    const transfer = useCallback(async (to: string, amount: string) => {
        if (!provider || !address || !tokenAddress) {
            throw new Error('Missing required parameters for transfer');
        }

        try {
            setIsTransferring(true);
            setError(null);

            const signer = provider.getSigner();
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

            const tx = await contract.transfer(to, amount);
            const receipt = await tx.wait();

            setLastTxHash(receipt.transactionHash);
            return receipt;

        } catch (err) {
            const error = err as Error;
            setError(error.message ?? 'Failed to transfer token');
            throw error;
        } finally {
            setIsTransferring(false);
        }
    }, [provider, address, tokenAddress]);

    const transferFrom = useCallback(async (from: string, to: string, amount: string) => {
        if (!provider || !address || !tokenAddress) {
            throw new Error('Missing required parameters for transferFrom');
        }

        try {
            setIsTransferring(true);
            setError(null);

            const signer = provider.getSigner();
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

            const tx = await contract.transferFrom(from, to, amount);
            const receipt = await tx.wait();

            setLastTxHash(receipt.transactionHash);
            return receipt;

        } catch (err) {
            const error = err as Error;
            setError(error.message ?? 'Failed to transfer token');
            throw error;
        } finally {
            setIsTransferring(false);
        }
    }, [provider, address, tokenAddress]);

    return {
        isTransferring,
        error,
        lastTxHash,
        transfer,
        transferFrom
    };
};
