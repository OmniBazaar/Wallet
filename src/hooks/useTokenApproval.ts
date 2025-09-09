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
    approve: (amount: string) => Promise<string>;
    /** Approve maximum amount of tokens */
    approveMax: () => Promise<string>;
    /** Check current allowance */
    checkAllowance: () => Promise<void>;
} => {
    const { provider, address } = useWallet();
    const [isApproving, setIsApproving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [allowance, setAllowance] = useState<string>('0');

    const checkAllowance = useCallback(async (): Promise<void> => {
        if (provider === null || address === null || tokenAddress.trim() === '' || spenderAddress.trim() === '') {
            return;
        }

        try {
            const encodedCall = new ethers.Interface(ERC20_ABI).encodeFunctionData('allowance', [address, spenderAddress]);
            const result = await provider.request({
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: encodedCall
                }, 'latest']
            }) as string;
            
            const decoded = new ethers.Interface(ERC20_ABI).decodeFunctionResult('allowance', result);
            const currentAllowance = decoded[0] as bigint;
            setAllowance(currentAllowance.toString());
        } catch (err: unknown) {
            const error = err as Error;
            setError(`Failed to check token allowance: ${error.message ?? 'Unknown error'}`);
        }
    }, [provider, address, tokenAddress, spenderAddress]);

    const approve = useCallback(async (amount: string): Promise<string> => {
        if (provider === null || address === null || tokenAddress.trim() === '' || spenderAddress.trim() === '') {
            throw new Error('Missing required parameters for approval');
        }

        try {
            setIsApproving(true);
            setError(null);

            const encodedCall = new ethers.Interface(ERC20_ABI).encodeFunctionData('approve', [spenderAddress, amount]);
            
            const txHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: address,
                    to: tokenAddress,
                    data: encodedCall
                }]
            }) as string;

            await checkAllowance();
            return txHash;

        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message ?? 'Failed to approve token');
            throw error;
        } finally {
            setIsApproving(false);
        }
    }, [provider, address, tokenAddress, spenderAddress, checkAllowance]);

    const approveMax = useCallback(async (): Promise<string> => {
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
