import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
];

/**
 * Hook for ERC-20 token approvals
 * @param tokenAddress Contract address of the token
 * @param spenderAddress Address that will be approved to spend tokens
 * @returns Token approval utilities and state
 */
export const useTokenApproval = (tokenAddress: string, spenderAddress: string): {
    /** Whether an approval is currently in progress */
    isApproving: boolean;
    /** Error message if approval failed */
    error: string | null;
    /** Current allowance amount */
    allowance: string;
    /** Approve specific amount of tokens */
    approve: (amount: string) => Promise<ethers.TransactionResponse>;
    /** Approve maximum amount of tokens */
    approveMax: () => Promise<ethers.TransactionResponse>;
    /** Check current allowance */
    checkAllowance: () => Promise<void>;
} => {
    const { provider, address } = useWallet();
    const [isApproving, setIsApproving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [allowance, setAllowance] = useState<string>('0');

    const checkAllowance = useCallback(async () => {
        if (provider == null || address == null || tokenAddress == null || spenderAddress == null) return;

        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const allowanceMethod = contract['allowance'];
            if (!allowanceMethod || typeof allowanceMethod !== 'function') {
                throw new Error('Contract does not have allowance method');
            }
            const currentAllowance = await allowanceMethod(address, spenderAddress);
            setAllowance(currentAllowance.toString());
        } catch (err) {
            console.error('Error checking allowance:', err);
            setError('Failed to check token allowance');
        }
    }, [provider, address, tokenAddress, spenderAddress]);

    const approve = useCallback(async (amount: string) => {
        if (provider == null || address == null || tokenAddress == null || spenderAddress == null) {
            throw new Error('Missing required parameters for approval');
        }

        try {
            setIsApproving(true);
            setError(null);

            const signer = await provider.getSigner();
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

            const approveMethod = contract['approve'];
            if (!approveMethod || typeof approveMethod !== 'function') {
                throw new Error('Contract does not have approve method');
            }
            const tx = await approveMethod(spenderAddress, amount);
            await tx.wait();

            await checkAllowance();
            return tx;

        } catch (err) {
            const error = err as Error;
            setError(error.message ?? 'Failed to approve token');
            throw error;
        } finally {
            setIsApproving(false);
        }
    }, [provider, address, tokenAddress, spenderAddress, checkAllowance]);

    const approveMax = useCallback(async () => {
        return approve(ethers.MaxUint256.toString());
    }, [approve]);

    return {
        isApproving,
        error,
        allowance,
        approve,
        approveMax,
        checkAllowance
    };
};
