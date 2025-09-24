import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';
import type { Contract } from 'ethers';

/** Configuration for Optimism NFT provider */
export interface OptimismNFTConfig {
  /** RPC URL for Optimism connection */
  rpcUrl: string;
  /** Optimistic Etherscan API key for blockchain data (optional) */
  optimisticEtherscanApiKey?: string;
  /** Alchemy API key for NFT data (optional) */
  alchemyApiKey?: string;
  /** SimpleHash API key for NFT data (optional) */
  simplehashApiKey?: string;
}

/**
 * Optimism NFT Provider for fetching NFTs from Optimism mainnet
 * Supports Optimistic Etherscan, Alchemy, and SimpleHash APIs for comprehensive NFT data
 */
export class OptimismNFTProvider implements ChainProvider {
  public readonly chainId = 10; // Optimism mainnet
  public readonly name = 'Optimism';
  public isConnected = false;
  
  private config: OptimismNFTConfig;
  private readonly optimisticEtherscanUrl = 'https://api-optimistic.etherscan.io/api';
  private readonly alchemyUrl = 'https://opt-mainnet.g.alchemy.com/nft/v2';
  private readonly simplehashUrl = 'https://api.simplehash.com/api/v0';

  /**
   * Create Optimism NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: OptimismNFTConfig) {
    this.config = config;
    this.isConnected = config.rpcUrl != null;
  }

  /**
   * Get all NFTs for a wallet address
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  public async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.length > 0) {
        return await this.fetchFromAlchemy(address);
      }
      
      // Try SimpleHash API if available
      if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey.length > 0) {
        return await this.fetchFromSimpleHash(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      // Silent fail, return empty array
      return [];
    }
  }

  /**
   * Get specific NFT metadata
   * @param contractAddress NFT contract address
   * @param tokenId Token ID to fetch metadata for
   * @returns Promise resolving to NFT item or null
   */
  public async getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTItem | null> {
    try {
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.length > 0) {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`
        );
        
        if (response.ok) {
          const data: unknown = await response.json();
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
      
      const [tokenURI, name, owner] = await Promise.all([
        this.safeCallContract(contract, 'tokenURI', [tokenId], ''),
        this.safeCallContract(contract, 'name', [], 'Unknown Collection'),
        this.safeCallContract(contract, 'ownerOf', [tokenId], '0x0000000000000000000000000000000000000000')
      ]);

      // Parse metadata
      interface NFTMetadata {
        name?: string;
        description?: string;
        image?: string;
        attributes?: Array<{ trait_type: string; value: string | number }>;
      }

      const nameStr = String(name);
      let metadata: NFTMetadata = { name: `${nameStr} #${tokenId}`, description: '' };
      if (typeof tokenURI === 'string' && tokenURI.length > 0) {
        metadata = await this.parseTokenURI(tokenURI, nameStr, tokenId);
      }

      return {
        id: `optimism_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name ?? `${nameStr} #${tokenId}`,
        description: metadata.description ?? '',
        image: metadata.image ?? '',
        imageUrl: metadata.image ?? '',
        attributes: metadata.attributes ?? [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'optimism',
        owner: String(owner),
        creator: '',
        isListed: false
      };
    } catch (error) {
      // Silent fail
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   * @param address Wallet address to fetch collections for
   * @returns Promise resolving to array of NFT collections
   */
  public async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      const nfts = await this.getNFTs(address);
      const collectionMap = new Map<string, NFTCollection>();
      
      for (const nft of nfts) {
        if (!collectionMap.has(nft.contractAddress)) {
          collectionMap.set(nft.contractAddress, {
            id: `optimism_collection_${nft.contractAddress}`,
            name: ((nft.name ?? 'Unknown Collection').split('#')[0])?.trim() ?? 'Unknown Collection',
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'optimism',
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
      // Silent fail
      return [];
    }
  }

  /**
   * Fetch NFTs from Alchemy API
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromAlchemy(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?owner=${address}&withMetadata=true&pageSize=100`
    );
    
    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }
    
    const data: unknown = await response.json();
    if (!this.isAlchemyResponse(data)) {
      return [];
    }
    return data.ownedNfts.map((nft) => this.transformAlchemyNFT(nft));
  }

  /**
   * Fetch NFTs from SimpleHash API
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromSimpleHash(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.simplehashUrl}/nfts/owners?chains=optimism&wallet_addresses=${address}&limit=100`,
      {
        headers: {
          'X-API-KEY': this.config.simplehashApiKey ?? ''
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`SimpleHash API error: ${response.status}`);
    }
    
    const data: unknown = await response.json();
    if (!this.isSimpleHashResponse(data)) {
      return [];
    }
    return data.nfts.map((nft) => this.transformSimpleHashNFT(nft));
  }

  /**
   * Transform Alchemy NFT data to our format
   * @param nft Raw NFT data from Alchemy API
   * @returns Transformed NFT item
   */
  private transformAlchemyNFT(nft: unknown): NFTItem {
    if (!this.isAlchemyNFT(nft)) {
      throw new Error('Invalid Alchemy NFT data');
    }
    
    const metadata = nft.metadata ?? {};
    const metadataObj = metadata as Record<string, unknown>;

    return {
      id: `optimism_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: (typeof metadataObj['name'] === 'string' ? metadataObj['name'] : undefined) ?? nft.title ?? `Optimism NFT #${nft.id.tokenId}`,
      description: (typeof metadataObj['description'] === 'string' ? metadataObj['description'] : undefined) ?? nft.description ?? '',
      image: (typeof metadataObj['image'] === 'string' ? metadataObj['image'] : undefined) ?? nft.media?.[0]?.gateway ?? '',
      imageUrl: (typeof metadataObj['image'] === 'string' ? metadataObj['image'] : undefined) ?? nft.media?.[0]?.gateway ?? '',
      attributes: (Array.isArray(metadataObj['attributes']) ? metadataObj['attributes'] as Array<{ trait_type: string; value: string | number }> : undefined) ?? [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: (nft.id.tokenMetadata?.tokenType === 'ERC721' || nft.id.tokenMetadata?.tokenType === 'ERC1155') ? nft.id.tokenMetadata.tokenType : 'ERC721',
      blockchain: 'optimism',
      owner: '',
      creator: (typeof metadataObj['creator'] === 'string' ? metadataObj['creator'] : undefined) ?? '',
      isListed: false
    };
  }

  /**
   * Transform SimpleHash NFT data to our format
   * @param nft Raw NFT data from SimpleHash API
   * @returns Transformed NFT item
   */
  private transformSimpleHashNFT(nft: unknown): NFTItem {
    if (!this.isSimpleHashNFT(nft)) {
      throw new Error('Invalid SimpleHash NFT data');
    }
    
    return {
      id: `optimism_${nft.contract_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name ?? `Optimism NFT #${nft.token_id}`,
      description: nft.description ?? '',
      image: nft.image_url ?? nft.previews?.image_medium_url ?? '',
      imageUrl: nft.image_url ?? nft.previews?.image_medium_url ?? '',
      attributes: nft.extra_metadata?.attributes ?? [],
      contract: nft.contract_address,
      contractAddress: nft.contract_address,
      tokenStandard: (nft.contract?.type === 'ERC721' || nft.contract?.type === 'ERC1155') ? nft.contract.type : 'ERC721',
      blockchain: 'optimism',
      owner: nft.owners?.[0]?.owner_address ?? '',
      creator: nft.contract?.deployed_by ?? '',
      price: (nft.last_sale?.unit_price !== undefined && nft.last_sale.unit_price !== null) ? 
        (Number(nft.last_sale.unit_price) / 1e18).toString() : '0',
      currency: 'ETH',
      isListed: Boolean(nft.listings?.length),
      ...(nft.external_url !== undefined && { marketplaceUrl: nft.external_url })
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
      
      // Popular Optimism NFT contracts to check
      const nftContracts = [
        '0x52782699900dF91b58eCd618E77847C5774dcaBe', // Optimism Quests
        '0x10CDCB5a80e888EC9e9154439e86B911F684dA7b', // Mirror Writing NFTs
        '0x998EF16Ea4111094EB5eE72fC2c6f4e6E8647666', // Quixotic NFTs
        '0x81b30ff521D1feB67EDE32db726D95714eb00637', // OptimisticLoogies
        '0x96Ee03FDa9F056dC3FE37A8D9CE4350Fe7ac04f6'  // Apetimism
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
          
          // Get balance
          const balance = await this.safeCallContract(contract, 'balanceOf', [address], BigInt(0));
          if (typeof balance === 'bigint' && balance === BigInt(0)) continue;
          
          // Get collection name
          const collectionName = await this.safeCallContract(contract, 'name', [], 'Unknown Collection');
          
          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);
          
          for (let i = 0; i < limit; i++) {
            try {
              const tokenId = await this.safeCallContract(contract, 'tokenOfOwnerByIndex', [address, i], BigInt(0));
              const tokenURI = await this.safeCallContract(contract, 'tokenURI', [tokenId], '');
              
              // Parse metadata if available
              const metadata = await this.parseTokenURI(
                String(tokenURI), 
                String(collectionName), 
                String(tokenId)
              );
              
              nfts.push({
                id: `optimism_${contractAddress}_${tokenId}`,
                tokenId: String(tokenId),
                name: metadata.name ?? `${collectionName} #${tokenId}`,
                description: metadata.description ?? '',
                image: metadata.image ?? '',
                imageUrl: metadata.image ?? '',
                attributes: metadata.attributes ?? [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'optimism',
                owner: address,
                creator: '',
                price: '0',
                currency: 'ETH',
                isListed: false
              });
            } catch (error) {
              // Skip failed NFT
            }
          }
        } catch (error) {
          // Skip failed contract
        }
      }
      
      return nfts;
    } catch (error) {
      // Silent fail
      return [];
    }
  }

  /**
   * Search NFTs on Optimism
   * @param query Search query string
   * @param limit Maximum number of results to return
   * @returns Promise resolving to array of NFT items
   */
  public async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Alchemy API, use it for search
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.length > 0) {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?contractAddresses[]=${query}&withMetadata=true&pageSize=${limit}`
        );
        
        if (response.ok) {
          const data: unknown = await response.json();
          if (this.isAlchemyResponse(data)) {
            return data.ownedNfts.map((nft) => this.transformAlchemyNFT(nft));
          }
          return [];
        }
      }
      
      // If we have SimpleHash API, use it for search
      if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey.length > 0) {
        const response = await fetch(
          `${this.simplehashUrl}/nfts/collection/${query}?chains=optimism&limit=${limit}`,
          {
            headers: {
              'X-API-KEY': this.config.simplehashApiKey ?? ''
            }
          }
        );
        
        if (response.ok) {
          const data: unknown = await response.json();
          if (this.isSimpleHashResponse(data)) {
            return data.nfts.map((nft) => this.transformSimpleHashNFT(nft));
          }
          return [];
        }
      }
      
      return [];
    } catch (error) {
      // Silent fail
      return [];
    }
  }

  /**
   * Get trending NFTs on Optimism
   * @param limit Maximum number of results to return
   * @returns Promise resolving to array of NFT items
   */
  public async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from Quixotic or other Optimism NFT marketplaces
      // For now, return NFTs from popular collections
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.length > 0) {
        // Get NFTs from popular collections
        const popularContracts = [
          '0x52782699900dF91b58eCd618E77847C5774dcaBe', // Optimism Quests
          '0x81b30ff521D1feB67EDE32db726D95714eb00637'  // OptimisticLoogies
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
              const data: unknown = await nftResponse.json();
              if (this.isAlchemyCollectionResponse(data)) {
                const collectionNfts = data.nfts.map((nft) => this.transformAlchemyNFT(nft));
                nfts.push(...collectionNfts);
              }
            }
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      // SimpleHash trending
      if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey.length > 0) {
        const response = await fetch(
          `${this.simplehashUrl}/nfts/trending_collections?chains=optimism&time_period=24h&limit=${limit}`,
          {
            headers: {
              'X-API-KEY': this.config.simplehashApiKey ?? ''
            }
          }
        );
        
        if (response.ok) {
          const data: unknown = await response.json();
          const nfts: NFTItem[] = [];
          
          if (!this.isTrendingCollectionsResponse(data)) {
            return [];
          }
          
          // Get sample NFTs from trending collections
          for (const collection of data.collections) {
            const nftResponse = await fetch(
              `${this.simplehashUrl}/nfts/collection/${collection.collection_id}?chains=optimism&limit=5`,
              {
                headers: {
                  'X-API-KEY': this.config.simplehashApiKey ?? ''
                }
              }
            );
            
            if (nftResponse.ok) {
              const nftData: unknown = await nftResponse.json();
              if (this.isSimpleHashResponse(nftData)) {
                const collectionNfts = nftData.nfts.map((nft) => this.transformSimpleHashNFT(nft));
                nfts.push(...collectionNfts);
              }
            }
            
            if (nfts.length >= limit) break;
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      // Silent fail
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig Partial configuration to merge with existing config
   */
  public updateConfig(newConfig: Partial<OptimismNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   * @returns Promise resolving to connection status and list of working APIs
   */
  public async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.length > 0) {
      try {
        const response = await fetch(`${this.alchemyUrl}/${this.config.alchemyApiKey}/isHolderOfCollection?wallet=0x0000000000000000000000000000000000000000&contractAddress=0x0000000000000000000000000000000000000000`);
        if (response.ok) workingApis.push('Alchemy');
      } catch (error) {
        // Connection test failed
      }
    }

    if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey.length > 0) {
      try {
        const response = await fetch(`${this.simplehashUrl}/nfts/owners?chains=optimism&wallet_addresses=0x0000000000000000000000000000000000000000&limit=1`, {
          headers: { 'X-API-KEY': this.config.simplehashApiKey }
        });
        if (response.ok) workingApis.push('SimpleHash');
      } catch (error) {
        // Connection test failed
      }
    }

    if (this.config.optimisticEtherscanApiKey !== undefined && this.config.optimisticEtherscanApiKey.length > 0) {
      try {
        const response = await fetch(
          `${this.optimisticEtherscanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.optimisticEtherscanApiKey}`
        );
        if (response.ok) workingApis.push('Optimistic Etherscan');
      } catch (error) {
        // Connection test failed
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }

  /**
   * Safely call a contract method with error handling
   * @param contract Ethers contract instance
   * @param method Method name to call
   * @param args Arguments to pass to the method
   * @param defaultValue Default value to return on error
   * @returns Promise resolving to the result or default value
   */
  private async safeCallContract<T>(
    contract: Contract,
    method: string,
    args: unknown[],
    defaultValue: T
  ): Promise<T> {
    try {
      // Check if method exists on contract
      if (!(method in contract)) {
        return defaultValue;
      }
      
      // Get the method function using bracket notation for index signature
      const contractMethods = contract as Record<string, unknown>;
      const fn = contractMethods[method];
      if (typeof fn !== 'function') {
        return defaultValue;
      }

      // Call the method
      const result: unknown = await fn(...args);
      return result as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Parse token URI to extract metadata
   * @param tokenURI Token URI to parse
   * @param collectionName Fallback collection name
   * @param tokenId Token ID for fallback name
   * @returns Promise resolving to NFT metadata
   */
  private async parseTokenURI(
    tokenURI: string,
    collectionName: string,
    tokenId: string
  ): Promise<{
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  }> {
    try {
      if (tokenURI.startsWith('data:')) {
        // On-chain metadata
        const json = tokenURI.split(',')[1];
        if (json === undefined || json.length === 0) {
          return { name: `${collectionName} #${tokenId}`, description: '' };
        }
        
        const decoded = atob(json);
        const parsed: unknown = JSON.parse(decoded);
        
        if (this.isNFTMetadata(parsed)) {
          return parsed;
        }
      } else if (tokenURI.startsWith('ipfs://')) {
        // IPFS metadata
        const ipfsGateway = 'https://ipfs.io/ipfs/';
        const ipfsHash = tokenURI.replace('ipfs://', '');
        
        try {
          const response = await fetch(ipfsGateway + ipfsHash);
          const metadata: unknown = await response.json();
          
          if (this.isNFTMetadata(metadata)) {
            return metadata;
          }
        } catch {
          // Failed to fetch IPFS metadata
        }
      } else if (tokenURI.startsWith('http')) {
        // HTTP metadata
        try {
          const response = await fetch(tokenURI);
          const metadata: unknown = await response.json();
          
          if (this.isNFTMetadata(metadata)) {
            return metadata;
          }
        } catch {
          // Failed to fetch HTTP metadata
        }
      }
    } catch {
      // Failed to parse metadata
    }
    
    return { name: `${collectionName} #${tokenId}`, description: '' };
  }

  /**
   * Type guard for NFT metadata
   * @param data Unknown data to check
   * @returns True if data matches NFT metadata structure
   */
  private isNFTMetadata(data: unknown): data is {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const obj = data as Record<string, unknown>;

    // Check optional fields
    if ('name' in obj && typeof obj['name'] !== 'string') {
      return false;
    }

    if ('description' in obj && typeof obj['description'] !== 'string') {
      return false;
    }

    if ('image' in obj && typeof obj['image'] !== 'string') {
      return false;
    }

    if ('attributes' in obj && !Array.isArray(obj['attributes'])) {
      return false;
    }
    
    return true;
  }

  /**
   * Type guard for Alchemy NFT response
   * @param data Unknown data to check
   * @returns True if data matches Alchemy response structure
   */
  private isAlchemyResponse(data: unknown): data is {
    ownedNfts: Array<{
      id: { tokenId: string; tokenMetadata?: { tokenType?: string } };
      title?: string;
      description?: string;
      contract: { address: string };
      metadata?: {
        name?: string;
        description?: string;
        image?: string;
        attributes?: Array<{ trait_type: string; value: string | number }>;
        creator?: string;
      };
      media?: Array<{ gateway: string }>;
    }>;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    if (!('ownedNfts' in obj) || !Array.isArray(obj['ownedNfts'])) {
      return false;
    }
    
    return true;
  }

  /**
   * Type guard for Alchemy collection response
   * @param data Unknown data to check
   * @returns True if data matches Alchemy collection response structure
   */
  private isAlchemyCollectionResponse(data: unknown): data is {
    nfts: Array<{
      id: { tokenId: string; tokenMetadata?: { tokenType?: string } };
      title?: string;
      description?: string;
      contract: { address: string };
      metadata?: {
        name?: string;
        description?: string;
        image?: string;
        attributes?: Array<{ trait_type: string; value: string | number }>;
        creator?: string;
      };
      media?: Array<{ gateway: string }>;
    }>;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    if (!('nfts' in obj) || !Array.isArray(obj['nfts'])) {
      return false;
    }
    
    return true;
  }

  /**
   * Type guard for Alchemy NFT data
   * @param data Unknown data to check
   * @returns True if data matches Alchemy NFT structure
   */
  private isAlchemyNFT(data: unknown): data is {
    id: { tokenId: string; tokenMetadata?: { tokenType?: string } };
    title?: string;
    description?: string;
    contract: { address: string };
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
      creator?: string;
    };
    media?: Array<{ gateway: string }>;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const obj = data as Record<string, unknown>;
    
    // Required fields
    if (!('id' in obj) || typeof obj['id'] !== 'object' || obj['id'] === null) {
      return false;
    }

    const id = obj['id'] as Record<string, unknown>;
    if (!('tokenId' in id) || typeof id['tokenId'] !== 'string') {
      return false;
    }

    if (!('contract' in obj) || typeof obj['contract'] !== 'object' || obj['contract'] === null) {
      return false;
    }

    const contract = obj['contract'] as Record<string, unknown>;
    if (!('address' in contract) || typeof contract['address'] !== 'string') {
      return false;
    }
    
    return true;
  }

  /**
   * Type guard for SimpleHash NFT response
   * @param data Unknown data to check
   * @returns True if data matches SimpleHash response structure
   */
  private isSimpleHashResponse(data: unknown): data is {
    nfts: Array<{
      token_id: string;
      name?: string;
      description?: string;
      image_url?: string;
      contract_address: string;
      previews?: { image_medium_url?: string };
      extra_metadata?: { attributes?: Array<{ trait_type: string; value: string | number }> };
      contract?: { type?: string; deployed_by?: string };
      owners?: Array<{ owner_address: string }>;
      last_sale?: { unit_price?: string };
      listings?: unknown[];
      external_url?: string;
    }>;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    if (!('nfts' in obj) || !Array.isArray(obj['nfts'])) {
      return false;
    }
    
    return true;
  }

  /**
   * Type guard for SimpleHash NFT data
   * @param data Unknown data to check
   * @returns True if data matches SimpleHash NFT structure
   */
  private isSimpleHashNFT(data: unknown): data is {
    token_id: string;
    name?: string;
    description?: string;
    image_url?: string;
    contract_address: string;
    previews?: { image_medium_url?: string };
    extra_metadata?: { attributes?: Array<{ trait_type: string; value: string | number }> };
    contract?: { type?: string; deployed_by?: string };
    owners?: Array<{ owner_address: string }>;
    last_sale?: { unit_price?: string };
    listings?: unknown[];
    external_url?: string;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const obj = data as Record<string, unknown>;

    // Required fields
    if (!('token_id' in obj) || typeof obj['token_id'] !== 'string') {
      return false;
    }

    if (!('contract_address' in obj) || typeof obj['contract_address'] !== 'string') {
      return false;
    }
    
    return true;
  }

  /**
   * Type guard for trending collections response
   * @param data Unknown data to check
   * @returns True if data matches trending collections structure
   */
  private isTrendingCollectionsResponse(data: unknown): data is {
    collections: Array<{ collection_id: string }>;
  } {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const obj = data as Record<string, unknown>;

    if (!('collections' in obj) || !Array.isArray(obj['collections'])) {
      return false;
    }
    
    return true;
  }
}
