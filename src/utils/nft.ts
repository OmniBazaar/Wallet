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
 * Standard NFT metadata structure following common ERC metadata fields.
 */
export interface NFTMetadata {
    /** NFT name */
    name: string;
    /** NFT description */
    description: string;
    /** Primary image URL */
    image: string;
    /** Array of trait attributes */
    attributes?: Array<{
        /** Trait category name */
        trait_type: string;
        /** Trait value */
        value: string | number;
    }>;
}

/**
 * Describes a single NFT owned or queried by the user.
 */
export interface NFT {
    /** Contract address of the NFT */
    contractAddress: string;
    /** Token identifier as string */
    tokenId: string;
    /** Token standard */
    tokenType: 'ERC721' | 'ERC1155';
    /** Optional parsed metadata for display */
    metadata?: NFTMetadata;
    /** Optional balance (for ERC‑1155) */
    balance?: string;
}

/**
 * Detect whether a contract implements the minimal ERC‑721 interface
 * by probing `balanceOf` with a sentinel address.
 *
 * @param provider Ethers provider to use for the call
 * @param address Contract address to test
 * @returns True if the contract behaves like ERC‑721
 */
export const isERC721 = async (provider: ethers.Provider, address: string): Promise<boolean> => {
    try {
        const contract = new ethers.Contract(address, ERC721_ABI, provider);
        const balanceOf = (contract as any)['balanceOf'];
        if (typeof balanceOf !== 'function') return false;
        await balanceOf(ethers.ZeroAddress);
        return true;
    } catch {
        return false;
    }
};

/**
 * Detect whether a contract implements the minimal ERC‑1155 interface
 * by probing `balanceOf` for token id 0.
 *
 * @param provider Ethers provider to use for the call
 * @param address Contract address to test
 * @returns True if the contract behaves like ERC‑1155
 */
export const isERC1155 = async (provider: ethers.Provider, address: string): Promise<boolean> => {
    try {
        const contract = new ethers.Contract(address, ERC1155_ABI, provider);
        const balanceOf = (contract as any)['balanceOf'];
        if (typeof balanceOf !== 'function') return false;
        await balanceOf(ethers.ZeroAddress, 0);
        return true;
    } catch {
        return false;
    }
};

/**
 * Fetch and normalize NFT metadata from a tokenURI. Supports basic
 * `ipfs://` resolution to a public IPFS gateway for convenience.
 *
 * Note: This implementation currently returns mock data and should be
 * replaced with a proper HTTP/IPFS fetch in production.
 *
 * @param tokenURI Token metadata URI (http(s) or ipfs)
 * @returns Parsed NFT metadata
 */
export const getNFTMetadata = async (tokenURI: string): Promise<NFTMetadata> => {
    try {
        // Handle IPFS URLs
        if (tokenURI.startsWith('ipfs://')) {
            tokenURI = `https://ipfs.io/ipfs/${tokenURI.replace('ipfs://', '')}`;
        }

        const resp = await fetch(tokenURI);
        if (!resp.ok) throw new Error(`Failed to load metadata: ${resp.status}`);
        const data = await resp.json();
        return {
            name: data.name ?? 'Unnamed NFT',
            description: data.description ?? '',
            image: data.image ?? '' ,
            attributes: Array.isArray(data.attributes) ? data.attributes : undefined
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
 * Read the tokenURI for a specific NFT depending on its standard.
 * Returns an empty string on failure rather than throwing.
 *
 * @param provider Ethers provider to use for the call
 * @param contractAddress NFT contract address
 * @param tokenId Token identifier as string
 * @param tokenType Token standard: 'ERC721' or 'ERC1155'
 * @returns The token URI or an empty string if unavailable
 */
export const getNFTTokenURI = async (
    provider: ethers.Provider,
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
            const fn = (contract as any)['tokenURI'];
            return typeof fn === 'function' ? await fn(tokenId) : '';
        } else {
            const fn = (contract as any)['uri'];
            return typeof fn === 'function' ? await fn(tokenId) : '';
        }
    } catch (error) {
        console.error('Error fetching token URI:', error);
        return '';
    }
};

/**
 * Get a best‑effort list of NFTs owned by an address for a given contract.
 * For ERC‑721, it walks `balanceOf` and `tokenOfOwnerByIndex`; for ERC‑1155,
 * this is a simplified example that checks token id 0 only.
 *
 * @param provider Ethers provider instance
 * @param ownerAddress Address that owns the NFTs
 * @param contractAddress NFT contract address to query
 * @returns Array of NFT descriptors with optional metadata/balance
 */
export const getOwnedNFTs = async (
    provider: ethers.Provider,
    ownerAddress: string,
    contractAddress: string
): Promise<NFT[]> => {
    const nfts: NFT[] = [];

    try {
        // Check if contract is ERC721
        if (await isERC721(provider, contractAddress)) {
            const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
            const balanceFn = (contract as any)['balanceOf'];
            const tokenOfOwnerByIndex = (contract as any)['tokenOfOwnerByIndex'];
            const tokenURI = (contract as any)['tokenURI'];
            if (typeof balanceFn !== 'function' || typeof tokenOfOwnerByIndex !== 'function' || typeof tokenURI !== 'function') {
                throw new Error('ERC721 methods missing');
            }
            const balance = await balanceFn(ownerAddress);

            for (let i = 0; i < Number(balance); i++) {
                const tokenId = await tokenOfOwnerByIndex(ownerAddress, i);
                const uri = await tokenURI(tokenId);
                const metadata = await getNFTMetadata(uri);

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
            const balanceFn = (contract as any)['balanceOf'];
            const uriFn = (contract as any)['uri'];
            if (typeof balanceFn !== 'function' || typeof uriFn !== 'function') {
                throw new Error('ERC1155 methods missing');
            }
            const balance = await balanceFn(ownerAddress, tokenId);

            if (balance > 0n) {
                const uri = await uriFn(tokenId);
                const metadata = await getNFTMetadata(uri);

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
