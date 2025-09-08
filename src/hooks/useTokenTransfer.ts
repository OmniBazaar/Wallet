/**
 * Token Transfer Hook
 * 
 * Provides token transfer functionality with test-friendly state management
 * This implementation is optimized for stability and test compatibility
 */

import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ethers, Contract, BrowserProvider } from 'ethers';

/** ERC-20 ABI for transfer function */
const ERC20_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

/** Token transfer hook return type */
interface TokenTransferHook {
  transfer: (recipient: string, amount: string) => Promise<string>;
  isTransferring: boolean;
  error: string | null;
}

/**
 * Hook for token transfer operations
 * @param tokenAddress - Token contract address
 * @returns Transfer methods and state
 */
export const useTokenTransfer = (tokenAddress: string): TokenTransferHook => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Transfer tokens to a recipient
   * @param recipient - Recipient address
   * @param amount - Amount to transfer (in token units, not wei)
   * @returns Transaction hash
   */
  const transfer = useCallback(async (recipient: string, amount: string): Promise<string> => {
    // Validation checks first
    if (!tokenAddress) {
      throw new Error('Token address is required');
    }

    if (!recipient) {
      throw new Error('Recipient address is required');
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Valid transfer amount is required');
    }

    // Set transferring state at start of actual transfer
    flushSync(() => {
      setIsTransferring(true);
      setError(null);
    });

    try {
      // Get the provider from the browser wallet (MetaMask, etc.)
      const globalWindow = (global as any).window || (typeof window !== 'undefined' ? window : null);
      if (!globalWindow || !globalWindow.ethereum) {
        const errorMessage = 'Ethereum wallet not available. Please install MetaMask or connect a wallet.';
        flushSync(() => {
          setError(errorMessage);
          setIsTransferring(false);
        });
        throw new Error(errorMessage);
      }

      // For test environment, we need to mock the ethereum provider's methods
      let provider: BrowserProvider;
      try {
        provider = new BrowserProvider(globalWindow.ethereum);
      } catch (providerError: any) {
        const errorMessage = providerError?.message || 'Failed to create wallet provider';
        flushSync(() => {
          setError(errorMessage);
          setIsTransferring(false);
        });
        throw new Error(errorMessage);
      }
      const signer = await provider.getSigner();
      
      // Create contract instance
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
      
      // Get token decimals to properly format the amount
      const decimals = await tokenContract.decimals();
      
      // Convert amount to wei (proper token units)
      const tokenAmount = ethers.parseUnits(amount, decimals);
      
      // Validate recipient address
      if (!ethers.isAddress(recipient)) {
        const errorMessage = 'Invalid recipient address';
        flushSync(() => {
          setError(errorMessage);
          setIsTransferring(false);
        });
        throw new Error(errorMessage);
      }
      
      // Execute the transfer
      const transaction = await tokenContract.transfer(recipient, tokenAmount);
      
      // Wait for transaction confirmation
      await transaction.wait();
      
      // Success - update state in one batch
      flushSync(() => {
        setIsTransferring(false);
        setError(null);
      });
      
      return transaction.hash;
      
    } catch (err: any) {
      const errorMessage = err?.reason || err?.message || 'Token transfer failed';
      
      // Batch error state updates with flushSync
      flushSync(() => {
        setError(errorMessage);
        setIsTransferring(false);
      });
      
      throw new Error(errorMessage);
    }
  }, [tokenAddress]);

  return {
    transfer,
    isTransferring,
    error
  };
};