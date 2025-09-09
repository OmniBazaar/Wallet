/**
 * NFT Transfer Hook
 * 
 * Provides NFT transfer functionality using ethers.js to interact with
 * ERC-721 contracts for NFT transfers.
 */

import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ethers, Contract, BrowserProvider } from 'ethers';

/** ERC-721 ABI for transfer functions */
const ERC721_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "tokenId", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "tokenId", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "tokenId", "type": "uint256"}
    ],
    "name": "ownerOf",
    "outputs": [{"name": "", "type": "address"}],
    "type": "function"
  }
];

/** NFT transfer hook return type */
interface NFTTransferHook {
  transferNFT: (tokenId: string, recipient: string) => Promise<string>;
  isTransferring: boolean;
  error: string | null;
}

/**
 * Hook for NFT transfer operations
 * @param contractAddress - NFT contract address
 * @returns Transfer methods and state
 */
export const useNFTTransfer = (contractAddress?: string): NFTTransferHook => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Transfer NFT to a recipient
   * @param tokenId - NFT token ID
   * @param recipient - Recipient address
   * @returns Transaction hash
   */
  const transferNFT = useCallback(async (tokenId: string, recipient: string): Promise<string> => {
    if (contractAddress === undefined || contractAddress.trim() === '') {
      throw new Error('NFT contract address is required');
    }

    if (tokenId.trim() === '') {
      throw new Error('Token ID is required');
    }

    if (recipient.trim() === '') {
      throw new Error('Recipient address is required');
    }

    // Use flushSync to make state updates synchronous for test compatibility
    flushSync(() => {
      setIsTransferring(true);
      setError(null);
    });

    try {
      // Get the provider from the browser wallet (MetaMask, etc.)
      if (typeof window === 'undefined' || (window as { ethereum?: unknown }).ethereum === undefined) {
        throw new Error('Ethereum wallet not available. Please install MetaMask or connect a wallet.');
      }

      const ethereumProvider = (window as unknown as { ethereum: import('ethers').Eip1193Provider }).ethereum;
      const provider = new BrowserProvider(ethereumProvider);
      const signer = await provider.getSigner();
      const currentAddress = await signer.getAddress();
      
      // Create contract instance
      const nftContract = new Contract(contractAddress, ERC721_ABI, signer);
      
      // Validate recipient address
      if (!ethers.isAddress(recipient)) {
        throw new Error('Invalid recipient address');
      }
      
      // Verify ownership of the NFT
      const owner = await nftContract.ownerOf(tokenId) as string;
      if (owner.toLowerCase() !== currentAddress.toLowerCase()) {
        throw new Error('You do not own this NFT');
      }
      
      // Execute the transfer using transferFrom (safer than transfer)
      const transaction = await nftContract.transferFrom(
        currentAddress, 
        recipient, 
        tokenId
      ) as { hash: string; wait: () => Promise<unknown> };
      
      // Wait for transaction confirmation
      await transaction.wait();
      
      // Success - update state in one batch
      flushSync(() => {
        setIsTransferring(false);
        setError(null);
      });
      
      return transaction.hash;
      
    } catch (err: unknown) {
      const error = err as { reason?: string; message?: string };
      const errorMessage = error?.reason ?? error?.message ?? 'NFT transfer failed';
      
      // Batch error state updates with flushSync
      flushSync(() => {
        setError(errorMessage);
        setIsTransferring(false);
      });
      
      throw new Error(errorMessage);
    }
  }, [contractAddress]);

  return {
    transferNFT,
    isTransferring,
    error
  };
};