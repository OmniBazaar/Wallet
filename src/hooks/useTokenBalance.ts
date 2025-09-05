import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { TokenInfo } from '../types';
import { useWallet } from './useWallet';

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];

/**
 * React hook for fetching and tracking an ERC‑20 token balance.
 * Loads token metadata (symbol, name, decimals) and current balance
 * for the connected wallet, and exposes a manual refresh method.
 *
 * @param tokenAddress Contract address of the token
 * @returns Token balance information and refresh function
 */
export const useTokenBalance = (tokenAddress: string): {
    /** Token metadata information */
    tokenInfo: TokenInfo | null;
    /** Raw balance in wei */
    balance: string;
    /** Human-readable formatted balance */
    formattedBalance: string;
    /** Whether balance is currently loading */
    isLoading: boolean;
    /** Error message if fetch failed */
    error: string | null;
    /** Function to manually refresh balance */
    refreshBalance: () => void;
} => {
    const { provider, address } = useWallet();
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [balance, setBalance] = useState<string>('0');
    const [formattedBalance, setFormattedBalance] = useState<string>('0');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load token metadata (symbol, name, decimals) from the ERC‑20 contract.
     */
    const fetchTokenInfo = useCallback(async (): Promise<void> => {
        if (!provider || !tokenAddress) return;

        try {
            setIsLoading(true);
            setError(null);

            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const [symbol, name, decimals] = await Promise.all([
                contract.symbol(),
                contract.name(),
                contract.decimals()
            ]);

            setTokenInfo({
                address: tokenAddress,
                symbol,
                name,
                decimals
            });

        } catch (err) {
            setError('Failed to fetch token info');
            console.error('Error fetching token info:', err);
        } finally {
            setIsLoading(false);
        }
    }, [provider, tokenAddress]);

    /**
     * Load the current token balance for the connected wallet and
     * update both raw and formatted representations.
     */
    const fetchBalance = useCallback(async (): Promise<void> => {
        if (!provider || !address || !tokenAddress || !tokenInfo) return;

        try {
            setIsLoading(true);
            setError(null);

            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);

            setBalance(balance.toString());
            setFormattedBalance(ethers.formatUnits(balance, tokenInfo.decimals));

        } catch (err) {
            setError('Failed to fetch token balance');
            console.error('Error fetching token balance:', err);
        } finally {
            setIsLoading(false);
        }
    }, [provider, address, tokenAddress, tokenInfo]);

    useEffect(() => {
        fetchTokenInfo();
    }, [fetchTokenInfo]);

    useEffect(() => {
        if (tokenInfo) {
            fetchBalance();
        }
    }, [fetchBalance, tokenInfo]);

    /** Manually trigger a balance refresh. */
    const refreshBalance = useCallback((): void => {
        fetchBalance();
    }, [fetchBalance]);

    return {
        tokenInfo,
        balance,
        formattedBalance,
        isLoading,
        error,
        refreshBalance
    };
};
