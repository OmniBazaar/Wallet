import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

/** Configuration for Arbitrum NFT provider */
export interface ArbitrumNFTConfig {
  /** RPC URL for Arbitrum connection */
  rpcUrl: string;
  /** Arbiscan API key for blockchain data (optional) */
  arbiscanApiKey?: string;
  /** Alchemy API key for NFT data (optional) */
  alchemyApiKey?: string;
  /** Moralis API key for NFT data (optional) */
  moralisApiKey?: string;
}

/** Alchemy NFT data structure */
interface AlchemyNFT {
  id: {
    tokenId: string;
    tokenMetadata?: {
      tokenType?: string;
    };
  };
  contract: {
    address: string;
  };
  title?: string;
  description?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    creator?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
  media?: Array<{ gateway: string }>;
}

/** Moralis NFT data structure */
interface MoralisNFT {
  token_address: string;
  token_id: string;
  name?: string;
  metadata?: string;
  token_uri?: string;
  contract_type?: string;
  owner_of?: string;
  minter_address?: string;
}

/** NFT metadata structure */
interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/** Alchemy response structure */
interface AlchemyResponse {
  ownedNfts?: AlchemyNFT[];
  nfts?: AlchemyNFT[];
}

/** Moralis response structure */
interface MoralisResponse {
  result?: MoralisNFT[];
}

/**
 * Arbitrum NFT Provider for fetching NFTs from Arbitrum One
 * Supports Arbiscan, Alchemy, and Moralis APIs for comprehensive NFT data
 */
export class ArbitrumNFTProvider implements ChainProvider {
  chainId = 42161; // Arbitrum One mainnet
  name = 'Arbitrum';
  isConnected = false;
  
  private config: ArbitrumNFTConfig;
  private arbiscanUrl = 'https://api.arbiscan.io/api';
  private alchemyUrl = 'https://arb-mainnet.g.alchemy.com/nft/v2';
  private moralisUrl = 'https://deep-index.moralis.io/api/v2';

  /**
   * Create Arbitrum NFT provider
   * @param config - Configuration for provider setup
   */
  constructor(config: ArbitrumNFTConfig) {
    this.config = config;
    this.isConnected = config.rpcUrl !== undefined && config.rpcUrl !== null && config.rpcUrl !== '';
  }

  /**
   * Get all NFTs for a wallet address
   * @param address - Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        return await this.fetchFromAlchemy(address);
      }
      
      // Try Moralis API if available
      if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey !== null && this.config.moralisApiKey !== '') {
        return await this.fetchFromMoralis(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Get specific NFT metadata
   * @param contractAddress - NFT contract address
   * @param tokenId - Token ID to fetch metadata for
   * @returns Promise resolving to NFT item or null
   */
  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTItem | null> {
    try {
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`
        );
        
        if (response.ok) {
          const data = await response.json() as AlchemyNFT;
          return this.transformAlchemyNFT(data);
        }
      }
      
      // Fallback to direct blockchain query
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      const erc721Abi = [
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function ownerOf(uint256 tokenId) view returns (address)'
      ];
      
      const contract = new ethers.Contract(contractAddress, erc721Abi, provider);
      
      const contractTyped = contract as unknown as {
        tokenURI: (tokenId: string) => Promise<string>;
        name: () => Promise<string>;
        ownerOf: (tokenId: string) => Promise<string>;
      };
      
      const [tokenURI, name, owner] = await Promise.all([
        contractTyped.tokenURI(tokenId).catch(() => ''),
        contractTyped.name().catch(() => 'Unknown Collection'),
        contractTyped.ownerOf(tokenId).catch(() => '0x0000000000000000000000000000000000000000')
      ]);
      
      // Parse metadata
      let metadata: NFTMetadata = { name: `${name} #${tokenId}`, description: '' };
      if (tokenURI !== '') {
        if (tokenURI.startsWith('data:')) {
          const json = tokenURI.split(',')[1];
          if (json !== undefined) {
            metadata = JSON.parse(atob(json)) as NFTMetadata;
          }
        } else if (tokenURI.startsWith('ipfs://')) {
          const ipfsGateway = 'https://ipfs.io/ipfs/';
          const ipfsHash = tokenURI.replace('ipfs://', '');
          try {
            const response = await fetch(ipfsGateway + ipfsHash);
            metadata = await response.json() as NFTMetadata;
          } catch {
            // Keep default metadata
          }
        } else if (tokenURI.startsWith('http')) {
          try {
            const response = await fetch(tokenURI);
            metadata = await response.json() as NFTMetadata;
          } catch {
            // Keep default metadata
          }
        }
      }
      
      return {
        id: `arbitrum_${contractAddress}_${tokenId}`,
        tokenId,
        name: (metadata.name !== undefined && metadata.name !== '') ? metadata.name : `${name} #${tokenId}`,
        description: metadata.description ?? '',
        image: metadata.image ?? '',
        imageUrl: metadata.image ?? '',
        attributes: metadata.attributes ?? [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'arbitrum',
        owner: owner !== '' ? owner : '0x0000000000000000000000000000000000000000',
        creator: '',
        isListed: false
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   * @param address - Wallet address to fetch collections for
   * @returns Promise resolving to array of NFT collections
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      const nfts = await this.getNFTs(address);
      const collectionMap = new Map<string, NFTCollection>();
      
      for (const nft of nfts) {
        if (!collectionMap.has(nft.contractAddress)) {
          const collectionName = nft.name !== undefined && nft.name !== '' 
            ? nft.name.split('#')[0]?.trim() ?? 'Unknown Collection'
            : 'Unknown Collection';
          
          collectionMap.set(nft.contractAddress, {
            id: `arbitrum_collection_${nft.contractAddress}`,
            name: collectionName,
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'arbitrum',
            creator: (nft.creator !== undefined && nft.creator !== '') ? nft.creator : address,
            verified: false,
            items: []
          });
        }
        const collection = collectionMap.get(nft.contractAddress);
        if (collection !== undefined) {
          collection.items.push(nft);
        }
      }
      
      return Array.from(collectionMap.values());
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch NFTs from Alchemy API
   * @param address - Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromAlchemy(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?owner=${address}&withMetadata=true&pageSize=100`
    );
    
    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }
    
    const data = await response.json() as AlchemyResponse;
    return data.ownedNfts?.map((nft) => this.transformAlchemyNFT(nft)) ?? [];
  }

  /**
   * Fetch NFTs from Moralis API
   * @param address - Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromMoralis(address: string): Promise<NFTItem[]> {
    if (this.config.moralisApiKey === undefined) {
      throw new Error('Moralis API key is undefined');
    }
    
    const response = await fetch(
      `${this.moralisUrl}/${address}/nft?chain=arbitrum&limit=100`,
      {
        headers: {
          'X-API-Key': this.config.moralisApiKey
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }
    
    const data = await response.json() as MoralisResponse;
    return data.result?.map((nft) => this.transformMoralisNFT(nft)) ?? [];
  }

  /**
   * Transform Alchemy NFT data to our format
   * @param nft - Alchemy NFT data
   * @returns Transformed NFT item
   */
  private transformAlchemyNFT(nft: AlchemyNFT): NFTItem {
    const metadata = nft.metadata ?? {};
    
    return {
      id: `arbitrum_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name ?? nft.title ?? `Arbitrum NFT #${nft.id.tokenId}`,
      description: metadata.description ?? nft.description ?? '',
      image: metadata.image ?? nft.media?.[0]?.gateway ?? '',
      imageUrl: metadata.image ?? nft.media?.[0]?.gateway ?? '',
      attributes: metadata.attributes ?? [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: (nft.id.tokenMetadata?.tokenType ?? 'ERC721') as 'ERC721' | 'ERC1155' | 'SPL' | 'other',
      blockchain: 'arbitrum',
      owner: '',
      creator: metadata.creator ?? '',
      isListed: false
    };
  }

  /**
   * Transform Moralis NFT data to our format
   * @param nft - Moralis NFT data
   * @returns Transformed NFT item
   */
  private transformMoralisNFT(nft: MoralisNFT): NFTItem {
    let metadata: NFTMetadata = {};
    if (nft.metadata !== undefined && nft.metadata !== null && nft.metadata !== '') {
      try {
        metadata = JSON.parse(nft.metadata) as NFTMetadata;
      } catch {
        metadata = {};
      }
    }
    
    return {
      id: `arbitrum_${nft.token_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name ?? metadata.name ?? `Arbitrum NFT #${nft.token_id}`,
      description: metadata.description ?? '',
      image: metadata.image ?? nft.token_uri ?? '',
      imageUrl: metadata.image ?? nft.token_uri ?? '',
      attributes: metadata.attributes ?? [],
      contract: nft.token_address,
      contractAddress: nft.token_address,
      tokenStandard: (nft.contract_type ?? 'ERC721') as 'ERC721' | 'ERC1155' | 'SPL' | 'other',
      blockchain: 'arbitrum',
      owner: nft.owner_of ?? '',
      creator: nft.minter_address ?? '',
      isListed: false
    };
  }

  /**
   * Fetch NFTs directly from blockchain using ethers
   * @param address - Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromBlockchain(address: string): Promise<NFTItem[]> {
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      // Popular Arbitrum NFT contracts to check
      const nftContracts = [
        '0xfA2FbFc5F8CD91DbC93B6E5BE4E1FA1FA35A4e83', // GMX Blueberry Club
        '0x53B05eB238E80bBF3e722b008c081725081cd5a9', // Bridgeworld Legions
        '0x17DaCAD7975960833f374622fad08b90Ed67D1B5', // MAGIC Dragons
        '0xc3323b2e3bAcBe3E3c5d96351a421F060e97732B', // TreasureDAO NFTs
        '0xeFe302129b3DCC239Ea8ADCcAE57B3aBB7f8Da2c'  // Smol Brains
      ];
      
      const nfts: NFTItem[] = [];
      
      // ERC721 ABI for balanceOf and tokenOfOwnerByIndex
      const erc721Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function symbol() view returns (string)'
      ];
      
      for (const contractAddress of nftContracts) {
        try {
          const contract = new ethers.Contract(contractAddress, erc721Abi, provider);
          
          // Type the contract methods
          const contractTyped = contract as unknown as {
            balanceOf: (owner: string) => Promise<bigint>;
            tokenOfOwnerByIndex: (owner: string, index: number) => Promise<bigint>;
            tokenURI: (tokenId: bigint) => Promise<string>;
            name: () => Promise<string>;
          };
          
          // Get balance
          const balance = await contractTyped.balanceOf(address);
          if (balance === BigInt(0)) continue;
          
          // Get collection name
          const collectionName = await contractTyped.name().catch(() => 'Unknown Collection');
          
          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);
          
          for (let i = 0; i < limit; i++) {
            try {
              const tokenId = await contractTyped.tokenOfOwnerByIndex(address, i);
              const tokenURI = await contractTyped.tokenURI(tokenId).catch(() => '');
              
              // Parse metadata if available
              let metadata: NFTMetadata = { name: `${collectionName} #${tokenId}`, description: '' };
              if (tokenURI !== '') {
                if (tokenURI.startsWith('data:')) {
                  // On-chain metadata
                  const json = tokenURI.split(',')[1];
                  if (json !== undefined) {
                    metadata = JSON.parse(atob(json)) as NFTMetadata;
                  }
                } else if (tokenURI.startsWith('ipfs://')) {
                  // IPFS metadata
                  const ipfsGateway = 'https://ipfs.io/ipfs/';
                  const ipfsHash = tokenURI.replace('ipfs://', '');
                  try {
                    const response = await fetch(ipfsGateway + ipfsHash);
                    metadata = await response.json() as NFTMetadata;
                  } catch {
                    metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                  }
                } else if (tokenURI.startsWith('http')) {
                  // HTTP metadata
                  try {
                    const response = await fetch(tokenURI);
                    metadata = await response.json() as NFTMetadata;
                  } catch {
                    metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                  }
                }
              }
              
              nfts.push({
                id: `arbitrum_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name ?? `${collectionName} #${tokenId}`,
                description: metadata.description ?? '',
                image: metadata.image ?? '',
                imageUrl: metadata.image ?? '',
                attributes: metadata.attributes ?? [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'arbitrum',
                owner: address,
                creator: '',
                price: '0',
                currency: 'ETH',
                isListed: false
              });
            } catch (error) {
              // Skip individual NFT errors
            }
          }
        } catch (error) {
          // Skip contract errors
        }
      }
      
      return nfts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search NFTs on Arbitrum
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Promise resolving to array of NFT items
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Alchemy API, use it for search
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?contractAddresses[]=${query}&withMetadata=true&pageSize=${limit}`
        );
        
        if (response.ok) {
          const data = await response.json() as AlchemyResponse;
          return data.ownedNfts?.map((nft) => this.transformAlchemyNFT(nft)) ?? [];
        }
      }
      
      // If we have Moralis API, use it for search
      if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey !== null && this.config.moralisApiKey !== '') {
        const response = await fetch(
          `${this.moralisUrl}/nft/search?chain=arbitrum&q=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              'X-API-Key': this.config.moralisApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json() as MoralisResponse;
          return data.result?.map((nft) => this.transformMoralisNFT(nft)) ?? [];
        }
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get trending NFTs on Arbitrum
   * @param limit - Maximum number of results to return
   * @returns Promise resolving to array of trending NFT items
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from Treasure Marketplace or other Arbitrum NFT marketplaces
      // For now, return NFTs from popular collections
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        // Get NFTs from popular collections
        const popularContracts = [
          '0xfA2FbFc5F8CD91DbC93B6E5BE4E1FA1FA35A4e83', // GMX Blueberry Club
          '0x53B05eB238E80bBF3e722b008c081725081cd5a9'  // Bridgeworld Legions
        ];
        
        const nfts: NFTItem[] = [];
        
        for (const contract of popularContracts) {
          const response = await fetch(
            `${this.alchemyUrl}/${this.config.alchemyApiKey}/getContractMetadata?contractAddress=${contract}`
          );
          
          if (response.ok) {
            // Get sample NFTs from collection
            const nftResponse = await fetch(
              `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTsForCollection?contractAddress=${contract}&limit=${Math.ceil(limit / popularContracts.length)}&withMetadata=true`
            );
            
            if (nftResponse.ok) {
              const data = await nftResponse.json() as AlchemyResponse;
              const collectionNfts = data.nfts?.map((nft) => this.transformAlchemyNFT(nft)) ?? [];
              nfts.push(...collectionNfts);
            }
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig - Partial configuration object to merge with existing config
   */
  updateConfig(newConfig: Partial<ArbitrumNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = this.config.rpcUrl !== undefined && this.config.rpcUrl !== null && this.config.rpcUrl !== '';
  }

  /**
   * Test connection to APIs
   * @returns Promise resolving to connection status and available APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
      try {
        const response = await fetch(`${this.alchemyUrl}/${this.config.alchemyApiKey}/isHolderOfCollection?wallet=0x0000000000000000000000000000000000000000&contractAddress=0x0000000000000000000000000000000000000000`);
        if (response.ok) workingApis.push('Alchemy');
      } catch (error) {
        // Alchemy test failed
      }
    }

    if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey !== null && this.config.moralisApiKey !== '') {
      try {
        const response = await fetch(`${this.moralisUrl}/nft?chain=arbitrum&limit=1`, {
          headers: { 'X-API-Key': this.config.moralisApiKey }
        });
        if (response.ok) workingApis.push('Moralis');
      } catch (error) {
        // Moralis test failed
      }
    }

    if (this.config.arbiscanApiKey !== undefined && this.config.arbiscanApiKey !== null && this.config.arbiscanApiKey !== '') {
      try {
        const response = await fetch(
          `${this.arbiscanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.arbiscanApiKey}`
        );
        if (response.ok) workingApis.push('Arbiscan');
      } catch (error) {
        // Arbiscan test failed
      }
    }

    return {
      connected: workingApis.length > 0 || (this.config.rpcUrl !== undefined && this.config.rpcUrl !== null && this.config.rpcUrl !== ''),
      apis: workingApis
    };
  }
}