import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
];

/**
 *
 * @param tokenAddress
 * @param spenderAddress
 */
export const useTokenApproval = (tokenAddress: string, spenderAddress: string): {
    /**
     *
     */
    isApproving: boolean;
    /**
     *
     */
    error: string | null;
    /**
     *
     */
    allowance: string;
    /**
     *
     */
    approve: (amount: string) => Promise<ethers.TransactionResponse>;
    /**
     *
     */
    approveMax: () => Promise<ethers.TransactionResponse>;
    /**
     *
     */
    checkAllowance: () => Promise<void>;
} => {
    const { provider, address } = useWallet();
    const [isApproving, setIsApproving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [allowance, setAllowance] = useState<string>('0');

    const checkAllowance = useCallback(async () => {
        if (!provider || !address || !tokenAddress || !spenderAddress) return;

        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const currentAllowance = await contract.allowance(address, spenderAddress);
            setAllowance(currentAllowance.toString());
        } catch (err) {
            console.error('Error checking allowance:', err);
            setError('Failed to check token allowance');
        }
    }, [provider, address, tokenAddress, spenderAddress]);

    const approve = useCallback(async (amount: string) => {
        if (!provider || !address || !tokenAddress || !spenderAddress) {
            throw new Error('Missing required parameters for approval');
        }

        try {
            setIsApproving(true);
            setError(null);

            const signer = provider.getSigner();
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

            const tx = await contract.approve(spenderAddress, amount);
            await tx.wait();

            await checkAllowance();
            return tx;

        } catch (err) {
            const error = err as Error;
            setError(error.message || 'Failed to approve token');
            throw error;
        } finally {
            setIsApproving(false);
        }
    }, [provider, address, tokenAddress, spenderAddress, checkAllowance]);

    const approveMax = useCallback(async () => {
        return approve(ethers.constants.MaxUint256.toString());
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