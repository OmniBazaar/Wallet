import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';
import type { Logger } from '../../../utils/logger';
import { createLogger } from '../../../utils/logger';

/** Configuration for Avalanche NFT provider */
export interface AvalancheNFTConfig {
  /** RPC URL for Avalanche connection */
  rpcUrl: string;
  /** Snowtrace API key for blockchain data (optional) */
  snowtraceApiKey?: string;
  /** Joepegs API key for NFT marketplace data (optional) */
  joepegsApiKey?: string;
}

/** Response from Joepegs API for tokens */
interface JoepegsTokenResponse {
  tokenId: string;
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  collectionAddress: string;
  creator?: string;
  owner?: string;
  currentAskPrice?: string;
}

/** Response from Joepegs API */
interface JoepegsApiResponse {
  tokens?: JoepegsTokenResponse[];
  collections?: Array<{
    address: string;
    name: string;
    description?: string;
    image?: string;
    creator?: string;
  }>;
}

/** NFT metadata structure */
interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number | boolean | null }>;
}

/**
 * Avalanche NFT Provider for fetching NFTs from Avalanche C-Chain.
 * Supports Snowtrace and Joepegs APIs for comprehensive NFT data.
 * @implements {ChainProvider}
 */
export class AvalancheNFTProvider implements ChainProvider {
  /** Chain ID for Avalanche C-Chain mainnet */
  chainId = 43114;
  /** Display name for the blockchain */
  name = 'Avalanche';
  /** Connection status indicator */
  isConnected = false;
  
  private config: AvalancheNFTConfig;
  private snowtraceUrl = 'https://api.snowtrace.io/api';
  private joepegsUrl = 'https://api.joepegs.dev/v2';
  private logger: Logger;

  /**
   * Create Avalanche NFT provider
   * @param config - Configuration for provider setup
   */
  constructor(config: AvalancheNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
    this.logger = createLogger('AvalancheNFTProvider');
  }

  /**
   * Get all NFTs for a wallet address
   * @param address - Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      this.logger.debug(`Fetching Avalanche NFTs for address: ${address}`);
      
      // Try Joepegs API first if available
      const nftsApiKey = this.config.joepegsApiKey;
      if (nftsApiKey !== undefined && nftsApiKey !== '') {
        return await this.fetchFromJoepegs(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      this.logger.error('Error fetching Avalanche NFTs:', error);
      return [];
    }
  }

  /**
   * Get specific NFT metadata
   * @param contractAddress - NFT contract address
   * @param tokenId - Token ID to fetch metadata for
   * @returns Promise resolving to NFT item or null if not found
   */
  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTItem | null> {
    try {
      // Fallback to direct blockchain query
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      const erc721Abi = [
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function ownerOf(uint256 tokenId) view returns (address)'
      ];
      
      const contract = new ethers.Contract(contractAddress, erc721Abi, provider);
      
      const [tokenURI, name, owner] = await Promise.all([
        this.safeCallContract(contract, 'tokenURI', [tokenId], ''),
        this.safeCallContract(contract, 'name', [], 'Unknown Collection'),
        this.safeCallContract(contract, 'ownerOf', [tokenId], '0x0000000000000000000000000000000000000000')
      ]);
      
      // Parse metadata
      const tokenURIStr = String(tokenURI ?? '');
      const nameStr = String(name ?? 'Unknown Collection');
      const metadata = await this.parseTokenMetadata(tokenURIStr, nameStr, tokenId);
      
      return {
        id: `avalanche_${contractAddress}_${tokenId}`,
        tokenId,
        name: (metadata.name !== undefined && metadata.name !== '') ? metadata.name : `${nameStr} #${tokenId}`,
        description: metadata.description ?? '',
        image: metadata.image ?? '',
        imageUrl: metadata.image ?? '',
        attributes: this.parseAttributes(metadata.attributes),
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'avalanche',
        owner: String(owner ?? '0x0000000000000000000000000000000000000000'),
        creator: '',
        isListed: false
      };
    } catch (error) {
      this.logger.error('Error fetching Avalanche NFT metadata:', error);
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
          collectionMap.set(nft.contractAddress, {
            id: `avalanche_collection_${nft.contractAddress}`,
            name: (() => {
              const baseName = nft.name ?? 'Unknown Collection';
              const parts = baseName.split('#');
              const firstPart = parts[0] ?? '';
              const trimmed = firstPart.trim();
              return trimmed !== '' ? trimmed : 'Unknown Collection';
            })(),
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'avalanche',
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
      this.logger.error('Error fetching Avalanche collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Joepegs API
   * @param address - Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromJoepegs(address: string): Promise<NFTItem[]> {
    try {
      const apiKey = this.config.joepegsApiKey;
      if (apiKey === undefined || apiKey === '') {
        throw new Error('Joepegs API key not configured');
      }
      
      const response = await fetch(
        `${this.joepegsUrl}/users/${address}/tokens`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Joepegs API error: ${response.status}`);
      }
      
      const data = await response.json() as JoepegsApiResponse;
      return this.mapJoepegsTokensToNFTs(data.tokens ?? [], address);
    } catch (error) {
      this.logger.warn('Joepegs fetch failed:', error);
      return [];
    }
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
      
      // Popular Avalanche NFT contracts to check
      const nftContracts = [
        '0xed2Aa7B6D36c695A0223b5047CF0992Bd43d0a78', // Avalanche Party Animals
        '0x880Fe52C6bc4FFFfb92D6C03858C97807a900691', // Chikn
        '0x5498bb86ebba0d4b915d1a7170f84cb6b334d23f', // Cool Cats
        '0x4245a1bD84eB5f3EBc115c2Edf57E50667F98b0b', // Smol Joes
        '0xDC58B44c92de122d17bB6dB4276fD3e85028dF58'  // Avalanche Monkeys
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
        const contractNfts = await this.fetchNFTsFromContract(
          contractAddress,
          address,
          provider,
          erc721Abi
        );
        nfts.push(...contractNfts);
      }
      
      return nfts;
    } catch (error) {
      this.logger.error('Failed to fetch NFTs from blockchain:', error);
      return [];
    }
  }

  /**
   * Search NFTs on Avalanche
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Promise resolving to array of NFT items
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Joepegs API, use it for search
      const searchApiKey = this.config.joepegsApiKey;
      if (searchApiKey !== undefined && searchApiKey !== '') {
        const response = await fetch(
          `${this.joepegsUrl}/collections/search?name=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              'x-api-key': searchApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json() as JoepegsApiResponse;
          const nfts: NFTItem[] = [];
          
          // Get sample NFTs from matching collections
          for (const collection of data.collections ?? []) {
            const collectionNfts = await this.fetchCollectionSampleNFTs(
              collection.address,
              collection.name ?? '',
              collection.description,
              collection.image,
              collection.creator
            );
            nfts.push(...collectionNfts);
            
            if (nfts.length >= limit) break;
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      this.logger.warn('Error searching Avalanche NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Avalanche
   * @param limit - Maximum number of results to return
   * @returns Promise resolving to array of trending NFT items
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch trending from Joepegs
      const trendingApiKey = this.config.joepegsApiKey;
      if (trendingApiKey !== undefined && trendingApiKey !== '') {
        const response = await fetch(
          `${this.joepegsUrl}/collections/trending?limit=${Math.ceil(limit / 5)}`,
          {
            headers: {
              'x-api-key': trendingApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json() as JoepegsApiResponse;
          const nfts: NFTItem[] = [];
          
          // Get sample NFTs from trending collections
          for (const collection of data.collections ?? []) {
            const collectionNfts = await this.fetchCollectionSampleNFTs(
              collection.address,
              collection.name ?? '',
              collection.description,
              collection.image,
              collection.creator
            );
            
            for (const nft of collectionNfts) {
              nfts.push({
                ...nft,
                marketplaceUrl: `https://joepegs.com/item/${nft.contractAddress}/${nft.tokenId}`
              });
            }
            
            if (nfts.length >= limit) break;
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      this.logger.warn('Error fetching trending Avalanche NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<AvalancheNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   * @returns Promise resolving to connection status and working APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    const testApiKey = this.config.joepegsApiKey;
    if (testApiKey !== undefined && testApiKey !== '') {
      try {
        const response = await fetch(`${this.joepegsUrl}/collections`, {
          headers: { 'x-api-key': testApiKey }
        });
        if (response.ok) workingApis.push('Joepegs');
      } catch (error) {
        this.logger.warn('Joepegs connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }

  /**
   * Safely call a contract method with error handling
   * @param contract - Ethers contract instance
   * @param methodName - Name of the method to call
   * @param args - Arguments to pass to the method
   * @param defaultValue - Default value to return on error
   * @returns Promise resolving to method result or default value
   */
  private async safeCallContract(
    contract: unknown,
    methodName: string,
    args: unknown[],
    defaultValue: unknown
  ): Promise<unknown> {
    try {
      const contractObj = contract as Record<string, unknown>;
      const method = contractObj[methodName];
      if (typeof method === 'function') {
        return await (method as (...args: unknown[]) => Promise<unknown>)(...args);
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Parse token metadata from various sources
   * @param tokenURI - Token URI to parse
   * @param collectionName - Name of the collection
   * @param tokenId - Token ID
   * @returns Promise resolving to parsed metadata
   */
  private async parseTokenMetadata(
    tokenURI: string,
    collectionName: string,
    tokenId: string
  ): Promise<NFTMetadata> {
    const defaultMetadata: NFTMetadata = {
      name: `${collectionName} #${tokenId}`,
      description: ''
    };

    if (tokenURI === '') {
      return defaultMetadata;
    }

    try {
      if (tokenURI.startsWith('data:')) {
        // On-chain metadata
        const json = tokenURI.split(',')[1];
        if (json === undefined || json === '') return defaultMetadata;
        return JSON.parse(atob(json)) as NFTMetadata;
      } else if (tokenURI.startsWith('ipfs://')) {
        // IPFS metadata
        const ipfsGateway = 'https://ipfs.io/ipfs/';
        const ipfsHash = tokenURI.replace('ipfs://', '');
        const response = await fetch(ipfsGateway + ipfsHash);
        return await response.json() as NFTMetadata;
      } else if (tokenURI.startsWith('http')) {
        // HTTP metadata
        const response = await fetch(tokenURI);
        return await response.json() as NFTMetadata;
      }
    } catch (error) {
      this.logger.debug('Failed to parse token metadata:', error);
    }

    return defaultMetadata;
  }

  /**
   * Parse NFT attributes into a consistent format
   * @param attributes - Raw attributes array
   * @returns Parsed attributes array
   */
  private parseAttributes(
    attributes?: Array<{ trait_type?: string; value?: string | number | boolean | null }>
  ): Array<{ trait_type: string; value: string | number }> {
    if (attributes === undefined || attributes === null || !Array.isArray(attributes)) {
      return [];
    }

    return attributes
      .filter(attr => attr !== null && attr !== undefined && typeof attr === 'object')
      .map(attr => ({
        trait_type: String(attr.trait_type !== undefined && attr.trait_type !== null ? attr.trait_type : 'Unknown'),
        value: typeof attr.value === 'string' || typeof attr.value === 'number'
          ? attr.value
          : String(attr.value !== undefined && attr.value !== null ? attr.value : '')
      }));
  }

  /**
   * Map Joepegs tokens to NFT items
   * @param tokens - Array of Joepegs token responses
   * @param owner - Owner address
   * @returns Array of NFT items
   */
  private mapJoepegsTokensToNFTs(
    tokens: JoepegsTokenResponse[],
    owner: string
  ): NFTItem[] {
    return tokens.map(token => ({
      id: `avalanche_${token.collectionAddress}_${token.tokenId}`,
      tokenId: token.tokenId,
      name: token.name !== undefined && token.name !== '' ? token.name : `Avalanche NFT #${token.tokenId}`,
      description: token.description ?? '',
      image: token.image ?? '',
      imageUrl: token.image ?? '',
      attributes: this.parseAttributes(token.attributes),
      contract: token.collectionAddress,
      contractAddress: token.collectionAddress,
      tokenStandard: 'ERC721',
      blockchain: 'avalanche',
      owner,
      creator: token.creator ?? '',
      price: token.currentAskPrice !== undefined && token.currentAskPrice !== ''
        ? (Number(token.currentAskPrice) / 1e18).toString() 
        : '0',
      currency: 'AVAX',
      isListed: Boolean(token.currentAskPrice),
      ...(token.tokenId !== undefined && token.tokenId !== '' && {
        marketplaceUrl: `https://joepegs.com/item/${token.collectionAddress}/${token.tokenId}`
      })
    }));
  }

  /**
   * Fetch NFTs from a specific contract
   * @param contractAddress - Contract address
   * @param ownerAddress - Owner address
   * @param provider - Ethers provider
   * @param abi - Contract ABI
   * @returns Promise resolving to array of NFT items
   */
  private async fetchNFTsFromContract(
    contractAddress: string,
    ownerAddress: string,
    provider: import('ethers').Provider,
    abi: string[]
  ): Promise<NFTItem[]> {
    const nfts: NFTItem[] = [];

    try {
      const { ethers } = await import('ethers');
      const contract = new ethers.Contract(
        contractAddress,
        abi,
        provider
      );

      // Get balance
      const balance = await this.safeCallContract(
        contract,
        'balanceOf',
        [ownerAddress],
        BigInt(0)
      ) as bigint;

      if (balance === BigInt(0)) return nfts;

      // Get collection name
      const collectionName = await this.safeCallContract(
        contract,
        'name',
        [],
        'Unknown Collection'
      ) as string;

      // Get up to 10 NFTs from this collection
      const limit = Math.min(Number(balance), 10);

      for (let i = 0; i < limit; i++) {
        try {
          const tokenId = await this.safeCallContract(
            contract,
            'tokenOfOwnerByIndex',
            [ownerAddress, i],
            null
          );

          if (tokenId === null || tokenId === undefined) continue;

          const tokenURI = await this.safeCallContract(
            contract,
            'tokenURI',
            [tokenId],
            ''
          ) as string;

          const metadata = await this.parseTokenMetadata(
            tokenURI,
            collectionName,
            String(tokenId)
          );

          nfts.push({
            id: `avalanche_${contractAddress}_${String(tokenId)}`,
            tokenId: String(tokenId),
            name: (metadata.name !== undefined && metadata.name !== '') ? metadata.name : `${collectionName} #${String(tokenId)}`,
            description: metadata.description ?? '',
            image: metadata.image ?? '',
            imageUrl: metadata.image ?? '',
            attributes: this.parseAttributes(metadata.attributes),
            contract: contractAddress,
            contractAddress,
            tokenStandard: 'ERC721',
            blockchain: 'avalanche',
            owner: ownerAddress,
            creator: '',
            price: '0',
            currency: 'AVAX',
            isListed: false
          });
        } catch (error) {
          this.logger.debug(`Failed to fetch NFT ${i} from ${contractAddress}:`, error);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to query contract ${contractAddress}:`, error);
    }

    return nfts;
  }

  /**
   * Fetch sample NFTs from a collection
   * @param collectionAddress - Collection contract address
   * @param collectionName - Collection name
   * @param collectionDescription - Collection description
   * @param collectionImage - Collection image
   * @param collectionCreator - Collection creator
   * @returns Promise resolving to array of NFT items
   */
  private async fetchCollectionSampleNFTs(
    collectionAddress: string,
    collectionName: string,
    collectionDescription?: string,
    collectionImage?: string,
    collectionCreator?: string
  ): Promise<NFTItem[]> {
    const sampleApiKey = this.config.joepegsApiKey;
    if (sampleApiKey === undefined || sampleApiKey === '') {
      return [];
    }

    try {
      const tokensResponse = await fetch(
        `${this.joepegsUrl}/collections/${collectionAddress}/tokens?limit=5`,
        {
          headers: {
            'x-api-key': sampleApiKey
          }
        }
      );

      if (!tokensResponse.ok) {
        return [];
      }

      const tokensData = await tokensResponse.json() as JoepegsApiResponse;
      return (tokensData.tokens ?? []).map(token => ({
        id: `avalanche_${token.collectionAddress}_${token.tokenId}`,
        tokenId: token.tokenId,
        name: token.name !== undefined && token.name !== '' ? token.name : collectionName,
        description: token.description ?? collectionDescription ?? '',
        image: token.image ?? collectionImage ?? '',
        imageUrl: token.image ?? collectionImage ?? '',
        attributes: this.parseAttributes(token.attributes),
        contract: token.collectionAddress,
        contractAddress: token.collectionAddress,
        tokenStandard: 'ERC721',
        blockchain: 'avalanche',
        owner: token.owner ?? '',
        creator: collectionCreator ?? '',
        price: token.currentAskPrice !== undefined && token.currentAskPrice !== ''
          ? (Number(token.currentAskPrice) / 1e18).toString()
          : '0',
        currency: 'AVAX',
        isListed: Boolean(token.currentAskPrice)
      }));
    } catch (error) {
      this.logger.debug('Failed to fetch collection sample NFTs:', error);
      return [];
    }
  }
}
