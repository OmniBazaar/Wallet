import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';
import { logger } from '../../../utils/logger';

/** Configuration for BSC NFT provider */
export interface BSCNFTConfig {
  /** RPC URL for BSC connection */
  rpcUrl: string;
  /** BSCScan API key for blockchain data (optional) */
  bscscanApiKey?: string;
  /** Moralis API key for NFT data (optional) */
  moralisApiKey?: string;
}

/** Moralis NFT response structure */
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

/** Moralis API response */
interface MoralisResponse {
  result?: MoralisNFT[];
}

/** NFT metadata structure */
interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/**
 * BSC (Binance Smart Chain) NFT Provider for fetching NFTs
 * Supports BSCScan and Moralis APIs for comprehensive NFT data
 */
export class BSCNFTProvider implements ChainProvider {
  /** BSC mainnet chain ID */
  readonly chainId = 56;
  /** Provider name */
  readonly name = 'BSC';
  /** Connection status */
  isConnected = false;
  
  private config: BSCNFTConfig;
  private readonly bscscanUrl = 'https://api.bscscan.com/api';
  private readonly moralisUrl = 'https://deep-index.moralis.io/api/v2';

  /**
   * Create BSC NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: BSCNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
  }

  /**
   * Get all NFTs for a wallet address
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      logger.debug(`Fetching BSC NFTs for address: ${address}`);
      
      // Try Moralis API first if available
      if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey.length > 0) {
        return await this.fetchFromMoralis(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      logger.error('Error fetching BSC NFTs:', error);
      return [];
    }
  }

  /**
   * Get specific NFT metadata
   * @param contractAddress NFT contract address
   * @param tokenId Token ID to fetch metadata for
   * @returns Promise resolving to NFT item or null
   */
  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTItem | null> {
    try {
      if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey.length > 0) {
        const response = await fetch(
          `${this.moralisUrl}/${contractAddress}/${tokenId}?chain=bsc`,
          {
            headers: {
              'X-API-Key': this.config.moralisApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json() as MoralisNFT;
          return this.transformMoralisNFT(data);
        }
      }
      
      // Fallback to direct blockchain query
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      const erc721Abi = [
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function ownerOf(uint256 tokenId) view returns (address)'
      ] as const;
      
      const contract = new ethers.Contract(contractAddress, erc721Abi, provider);
      
      const contractMethods = contract as Record<string, unknown>;
      const tokenURIFn = contractMethods['tokenURI'];
      const nameFn = contractMethods['name'];
      const ownerOfFn = contractMethods['ownerOf'];

      const tokenURIResult = typeof tokenURIFn === 'function' ?
        await Promise.resolve((tokenURIFn as (...args: unknown[]) => Promise<unknown>)(tokenId)).catch(() => '') : '';
      const nameResult = typeof nameFn === 'function' ?
        await Promise.resolve((nameFn as () => Promise<unknown>)()).catch(() => 'Unknown Collection') : 'Unknown Collection';
      const ownerResult = typeof ownerOfFn === 'function' ?
        await Promise.resolve((ownerOfFn as (...args: unknown[]) => Promise<unknown>)(tokenId)).catch(() => '0x0000000000000000000000000000000000000000') : '0x0000000000000000000000000000000000000000';
      
      const tokenURI = tokenURIResult !== undefined && tokenURIResult !== null ? String(tokenURIResult) : '';
      const name = nameResult !== undefined && nameResult !== null ? String(nameResult) : 'Unknown Collection';
      const owner = ownerResult !== undefined && ownerResult !== null ? String(ownerResult) : '0x0000000000000000000000000000000000000000';
      
      // Parse metadata
      let metadata: NFTMetadata = { name: `${name} #${tokenId}`, description: '' };
      if (tokenURI.length > 0) {
        if (tokenURI.startsWith('data:')) {
          const parts = tokenURI.split(',');
          if (parts.length > 1 && parts[1] !== undefined) {
            const json = parts[1];
            if (json !== undefined && json.length > 0) {
              try {
                metadata = JSON.parse(atob(json)) as NFTMetadata;
              } catch (error) {
                logger.debug('Failed to parse data URI metadata:', error);
              }
            }
          }
        } else if (tokenURI.startsWith('ipfs://')) {
          const ipfsGateway = 'https://ipfs.io/ipfs/';
          const ipfsHash = tokenURI.replace('ipfs://', '');
          try {
            const response = await fetch(ipfsGateway + ipfsHash);
            metadata = await response.json() as NFTMetadata;
          } catch (error) {
            logger.debug('Failed to fetch IPFS metadata:', error);
          }
        } else if (tokenURI.startsWith('http')) {
          try {
            const response = await fetch(tokenURI);
            metadata = await response.json() as NFTMetadata;
          } catch (error) {
            logger.debug('Failed to fetch HTTP metadata:', error);
          }
        }
      }
      
      return {
        id: `bsc_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name ?? `${name} #${tokenId}`,
        description: metadata.description ?? '',
        image: metadata.image ?? '',
        imageUrl: metadata.image ?? '',
        attributes: metadata.attributes ?? [],
        contract: contractAddress,
        contractAddress,
        // BSC is EVM compatible; use ERC721
        tokenStandard: 'ERC721',
        blockchain: 'bsc',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      logger.error('Error fetching BSC NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   * @param address Wallet address to fetch collections for
   * @returns Promise resolving to array of NFT collections
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      const nfts = await this.getNFTs(address);
      const collectionMap = new Map<string, NFTCollection>();
      
      for (const nft of nfts) {
        if (!collectionMap.has(nft.contractAddress)) {
          collectionMap.set(nft.contractAddress, {
            id: `bsc_collection_${nft.contractAddress}`,
            name: ((nft.name ?? 'Unknown Collection').split('#')[0] ?? 'Unknown Collection').trim(),
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'bsc',
            creator: nft.creator ?? address,
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
      logger.error('Error fetching BSC collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Moralis API
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromMoralis(address: string): Promise<NFTItem[]> {
    if (this.config.moralisApiKey === undefined || this.config.moralisApiKey.length === 0) {
      throw new Error('Moralis API key not configured');
    }
    
    const response = await fetch(
      `${this.moralisUrl}/${address}/nft?chain=bsc&limit=100`,
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
   * Transform Moralis NFT data to our format
   * @param nft Moralis NFT object to transform
   * @returns Transformed NFT item
   */
  private transformMoralisNFT(nft: MoralisNFT): NFTItem {
    let metadata: NFTMetadata = {};
    if (nft.metadata !== undefined && nft.metadata !== null && nft.metadata.length > 0) {
      try {
        metadata = JSON.parse(nft.metadata) as NFTMetadata;
      } catch {
        metadata = {};
      }
    }
    
    return {
      id: `bsc_${nft.token_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name ?? metadata.name ?? `BSC NFT #${nft.token_id}`,
      description: metadata.description ?? '',
      image: metadata.image ?? nft.token_uri ?? '',
      imageUrl: metadata.image ?? nft.token_uri ?? '',
      attributes: metadata.attributes ?? [],
      contract: nft.token_address,
      contractAddress: nft.token_address,
      tokenStandard: nft.contract_type === 'ERC1155' ? 'ERC1155' : 'ERC721',
      blockchain: 'bsc',
      owner: nft.owner_of ?? '',
      creator: nft.minter_address ?? '',
      isListed: false
    };
  }

  /**
   * Fetch NFTs directly from blockchain using ethers
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromBlockchain(address: string): Promise<NFTItem[]> {
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      // Popular BSC NFT contracts to check
      const nftContracts = [
        '0x5e74094cd416f55179dbd0e45b1a8ed030e396a1', // PancakeSquad
        '0xDf7952B35f24acF7fC0487D01c8d5690a60DBa07', // Bunny Squad
        '0x9adc6Fb78CEFA07E13E9294F150C1E8C1Dd566c0', // Mobox NFT
        '0x17C5b4Ff3325a1Ba056D683b9f5e90cB84fb84a7', // BinaryX
        '0xDF5E93Ef9681fd9e90e4738e1B3B91D02c289a23'  // Dego Finance
      ];
      
      const nfts: NFTItem[] = [];
      
      // ERC721/BEP721 ABI for balanceOf and tokenOfOwnerByIndex
      const erc721Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function symbol() view returns (string)'
      ] as const;
      
      for (const contractAddress of nftContracts) {
        try {
          const contract = new ethers.Contract(contractAddress, erc721Abi, provider);
          
          // Get balance
          const contractMethods = contract as Record<string, unknown>;
          const balanceOfFn = contractMethods['balanceOf'];
          const nameFn = contractMethods['name'];

          const balanceResult = typeof balanceOfFn === 'function' ?
            await (balanceOfFn as (...args: unknown[]) => Promise<unknown>)(address) : BigInt(0);
          const balance = balanceResult as bigint;
          if (balance === BigInt(0)) continue;

          // Get collection name
          const collectionNameResult = typeof nameFn === 'function' ?
            await Promise.resolve((nameFn as () => Promise<unknown>)()).catch(() => 'Unknown Collection') : 'Unknown Collection';
          const collectionName = collectionNameResult !== undefined && collectionNameResult !== null ? String(collectionNameResult) : 'Unknown Collection';
          
          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);
          
          for (let i = 0; i < limit; i++) {
            try {
              const tokenOfOwnerByIndexFn = contractMethods['tokenOfOwnerByIndex'];
              const tokenURIFn = contractMethods['tokenURI'];

              const tokenIdResult = typeof tokenOfOwnerByIndexFn === 'function' ?
                await (tokenOfOwnerByIndexFn as (...args: unknown[]) => Promise<unknown>)(address, i) : '';
              const tokenURIResult = typeof tokenURIFn === 'function' && tokenIdResult !== undefined && tokenIdResult !== null ?
                await Promise.resolve((tokenURIFn as (...args: unknown[]) => Promise<unknown>)(tokenIdResult)).catch(() => '') : '';
              const tokenId = tokenIdResult !== undefined && tokenIdResult !== null ? String(tokenIdResult) : '';
              const tokenURI = tokenURIResult !== undefined && tokenURIResult !== null ? String(tokenURIResult) : '';
              
              // Parse metadata if available
              let metadata: NFTMetadata = { 
                name: `${collectionName} #${tokenId}`, 
                description: '' 
              };
              
              if (tokenURI.length > 0) {
                if (tokenURI.startsWith('data:')) {
                  // On-chain metadata
                  const parts = tokenURI.split(',');
                  if (parts.length > 1 && parts[1] !== undefined && parts[1].length > 0) {
                    const json = parts[1];
                    if (json !== undefined && json.length > 0) {
                      try {
                        metadata = JSON.parse(atob(json)) as NFTMetadata;
                      } catch (error) {
                        logger.debug('Failed to parse data URI metadata:', error);
                      }
                    }
                  }
                } else if (tokenURI.startsWith('ipfs://')) {
                  // IPFS metadata
                  const ipfsGateway = 'https://ipfs.io/ipfs/';
                  const ipfsHash = tokenURI.replace('ipfs://', '');
                  try {
                    const response = await fetch(ipfsGateway + ipfsHash);
                    metadata = await response.json() as NFTMetadata;
                  } catch (error) {
                    logger.debug('Failed to fetch IPFS metadata:', error);
                    metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                  }
                } else if (tokenURI.startsWith('http')) {
                  // HTTP metadata
                  try {
                    const response = await fetch(tokenURI);
                    metadata = await response.json() as NFTMetadata;
                  } catch (error) {
                    logger.debug('Failed to fetch HTTP metadata:', error);
                    metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                  }
                }
              }
              
              nfts.push({
                id: `bsc_${contractAddress}_${tokenId}`,
                tokenId,
                name: metadata.name ?? `${collectionName} #${tokenId}`,
                description: metadata.description ?? '',
                image: metadata.image ?? '',
                imageUrl: metadata.image ?? '',
                attributes: metadata.attributes ?? [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'bsc',
                owner: address,
                creator: '',
                price: '0',
                currency: 'BNB',
                isListed: false
              });
            } catch (error) {
              logger.debug(`Failed to fetch NFT ${i} from ${contractAddress}:`, error);
            }
          }
        } catch (error) {
          logger.debug(`Failed to query contract ${contractAddress}:`, error);
        }
      }
      
      return nfts;
    } catch (error) {
      logger.error('Failed to fetch NFTs from blockchain:', error);
      return [];
    }
  }

  /**
   * Search NFTs on BSC
   * @param query Search query string
   * @param limit Maximum number of results to return
   * @returns Promise resolving to array of NFT items
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Moralis API, use it for search
      if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey.length > 0) {
        const response = await fetch(
          `${this.moralisUrl}/nft/search?chain=bsc&q=${encodeURIComponent(query)}&limit=${limit}`,
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
      logger.error('Error searching BSC NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on BSC
   * @param limit Maximum number of trending NFTs to return
   * @returns Promise resolving to array of trending NFT items
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from NFTrade or other BSC NFT marketplaces
      // For now, return popular collections
      if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey.length > 0) {
        // Get NFTs from popular collections
        const popularContracts = [
          '0x5e74094cd416f55179dbd0e45b1a8ed030e396a1', // PancakeSquad
          '0xDf7952B35f24acF7fC0487D01c8d5690a60DBa07'  // Bunny Squad
        ];
        
        const nfts: NFTItem[] = [];
        
        for (const contract of popularContracts) {
          const response = await fetch(
            `${this.moralisUrl}/nft/${contract}?chain=bsc&limit=${Math.ceil(limit / popularContracts.length)}`,
            {
              headers: {
                'X-API-Key': this.config.moralisApiKey
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json() as MoralisResponse;
            const contractNfts = data.result?.map((nft) => this.transformMoralisNFT(nft)) ?? [];
            nfts.push(...contractNfts);
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching trending BSC NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig Partial configuration to merge with existing config
   */
  updateConfig(newConfig: Partial<BSCNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   * @returns Promise resolving to connection status and list of working APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.moralisApiKey !== undefined && this.config.moralisApiKey !== null && this.config.moralisApiKey.length > 0) {
      try {
        const response = await fetch(`${this.moralisUrl}/nft?chain=bsc&limit=1`, {
          headers: { 'X-API-Key': this.config.moralisApiKey }
        });
        if (response.ok) workingApis.push('Moralis');
      } catch (error) {
        logger.debug('Moralis connection test failed:', error);
      }
    }

    if (this.config.bscscanApiKey !== undefined && this.config.bscscanApiKey !== null && this.config.bscscanApiKey.length > 0) {
      try {
        const response = await fetch(
          `${this.bscscanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.bscscanApiKey}`
        );
        if (response.ok) workingApis.push('BSCScan');
      } catch (error) {
        logger.debug('BSCScan connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}
