import { ethers } from 'ethers';
// import axios from 'axios';

// ERC-721 ABI for NFT operations
const ERC721_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function transferFrom(address from, address to, uint256 tokenId)',
    'function safeTransferFrom(address from, address to, uint256 tokenId)'
];

// ERC-1155 ABI for NFT operations
const ERC1155_ABI = [
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
    'function uri(uint256 id) view returns (string)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)'
];

/**
 *
 */
export interface NFTMetadata {
    /**
     *
     */
    name: string;
    /**
     *
     */
    description: string;
    /**
     *
     */
    image: string;
    /**
     *
     */
    attributes?: Array<{
        /**
         *
         */
        trait_type: string;
        /**
         *
         */
        value: string | number;
    }>;
}

/**
 *
 */
export interface NFT {
    /**
     *
     */
    contractAddress: string;
    /**
     *
     */
    tokenId: string;
    /**
     *
     */
    tokenType: 'ERC721' | 'ERC1155';
    /**
     *
     */
    metadata?: NFTMetadata;
    /**
     *
     */
    balance?: string;
}

/**
 *
 * @param provider
 * @param address
 */
export const isERC721 = async (provider: ethers.providers.Provider, address: string): Promise<boolean> => {
    try {
        const contract = new ethers.Contract(address, ERC721_ABI, provider);
        await contract.balanceOf(ethers.constants.AddressZero);
        return true;
    } catch {
        return false;
    }
};

/**
 *
 * @param provider
 * @param address
 */
export const isERC1155 = async (provider: ethers.providers.Provider, address: string): Promise<boolean> => {
    try {
        const contract = new ethers.Contract(address, ERC1155_ABI, provider);
        await contract.balanceOf(ethers.constants.AddressZero, 0);
        return true;
    } catch {
        return false;
    }
};

/**
 *
 * @param tokenURI
 */
export const getNFTMetadata = async (tokenURI: string): Promise<NFTMetadata> => {
    try {
        // Handle IPFS URLs
        if (tokenURI.startsWith('ipfs://')) {
            tokenURI = `https://ipfs.io/ipfs/${tokenURI.replace('ipfs://', '')}`;
        }

        // Mock implementation - in production would fetch from IPFS/HTTP
        return {
            name: 'Mock NFT',
            description: 'Mock NFT description',
            image: 'https://via.placeholder.com/300'
        };
    } catch (error) {
        console.error('Error fetching NFT metadata:', error);
        return {
            name: 'Unknown NFT',
            description: 'Metadata not available',
            image: ''
        };
    }
};

/**
 *
 * @param provider
 * @param contractAddress
 * @param tokenId
 * @param tokenType
 */
export const getNFTTokenURI = async (
    provider: ethers.providers.Provider,
    contractAddress: string,
    tokenId: string,
    tokenType: 'ERC721' | 'ERC1155'
): Promise<string> => {
    const contract = new ethers.Contract(
        contractAddress,
        tokenType === 'ERC721' ? ERC721_ABI : ERC1155_ABI,
        provider
    );

    try {
        if (tokenType === 'ERC721') {
            return await contract.tokenURI(tokenId);
        } else {
            return await contract.uri(tokenId);
        }
    } catch (error) {
        console.error('Error fetching token URI:', error);
        return '';
    }
};

/**
 *
 * @param provider
 * @param ownerAddress
 * @param contractAddress
 */
export const getOwnedNFTs = async (
    provider: ethers.providers.Provider,
    ownerAddress: string,
    contractAddress: string
): Promise<NFT[]> => {
    const nfts: NFT[] = [];

    try {
        // Check if contract is ERC721
        if (await isERC721(provider, contractAddress)) {
            const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
            const balance = await contract.balanceOf(ownerAddress);

            for (let i = 0; i < Number(balance); i++) {
                const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
                const tokenURI = await contract.tokenURI(tokenId);
                const metadata = await getNFTMetadata(tokenURI);

                nfts.push({
                    contractAddress,
                    tokenId: tokenId.toString(),
                    tokenType: 'ERC721',
                    metadata
                });
            }
        }

        // Check if contract is ERC1155
        if (await isERC1155(provider, contractAddress)) {
            const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
            // Note: ERC1155 requires additional logic to get all token IDs
            // This is a simplified version
            const tokenId = '0'; // You'll need to implement logic to get all token IDs
            const balance = await contract.balanceOf(ownerAddress, tokenId);

            if (balance > 0n) {
                const tokenURI = await contract.uri(tokenId);
                const metadata = await getNFTMetadata(tokenURI);

                nfts.push({
                    contractAddress,
                    tokenId,
                    tokenType: 'ERC1155',
                    balance: balance.toString(),
                    metadata
                });
            }
        }
    } catch (error) {
        console.error('Error fetching owned NFTs:', error);
    }

    return nfts;
}; 