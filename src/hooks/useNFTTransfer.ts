import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';

const ERC721_ABI = [
    'function safeTransferFrom(address from, address to, uint256 tokenId)'
];

const ERC1155_ABI = [
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)'
];

export const useNFTTransfer = (contractAddress: string, tokenType: 'ERC721' | 'ERC1155') => {
    const { provider, address } = useWallet();
    const [isTransferring, setIsTransferring] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const transfer = useCallback(async (to: string, tokenId: string, amount: string = '1') => {
        if (!provider || !address) {
            throw new Error('Wallet not connected');
        }

        try {
            setIsTransferring(true);
            setError(null);

            const signer = provider.getSigner();
            const contract = new ethers.Contract(
                contractAddress,
                tokenType === 'ERC721' ? ERC721_ABI : ERC1155_ABI,
                signer
            );

            let tx;
            if (tokenType === 'ERC721') {
                tx = await contract.safeTransferFrom(address, to, tokenId);
            } else {
                tx = await contract.safeTransferFrom(address, to, tokenId, amount, '0x');
            }

            const receipt = await tx.wait();
            return receipt;

        } catch (err) {
            const error = err as Error;
            setError(error.message || 'Failed to transfer NFT');
            throw error;
        } finally {
            setIsTransferring(false);
        }
    }, [provider, address, contractAddress, tokenType]);

    return {
        isTransferring,
        error,
        transfer
    };
}; 