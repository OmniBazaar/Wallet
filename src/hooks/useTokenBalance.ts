import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { TokenInfo, TokenBalance } from '../types';
import { useWallet } from './useWallet';

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];

export const useTokenBalance = (tokenAddress: string) => {
    const { provider, address } = useWallet();
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [balance, setBalance] = useState<string>('0');
    const [formattedBalance, setFormattedBalance] = useState<string>('0');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTokenInfo = useCallback(async () => {
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

    const fetchBalance = useCallback(async () => {
        if (!provider || !address || !tokenAddress || !tokenInfo) return;

        try {
            setIsLoading(true);
            setError(null);

            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const balance = await contract.balanceOf(address);

            setBalance(balance.toString());
            setFormattedBalance(ethers.utils.formatUnits(balance, tokenInfo.decimals));

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

    const refreshBalance = useCallback(() => {
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