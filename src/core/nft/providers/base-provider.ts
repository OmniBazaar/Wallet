import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

/** Configuration for Base NFT provider */
export interface BaseNFTConfig {
  /** RPC URL for Base connection */
  rpcUrl: string;
  /** Basescan API key for blockchain data (optional) */
  basescanApiKey?: string;
  /** Alchemy API key for NFT data (optional) */
  alchemyApiKey?: string;
  /** SimpleHash API key for NFT data (optional) */
  simplehashApiKey?: string;
}

/**
 * Base NFT Provider for fetching NFTs from Base mainnet
 * Supports Basescan, Alchemy, and SimpleHash APIs for comprehensive NFT data
 */
export class BaseNFTProvider implements ChainProvider {
  chainId = 8453; // Base mainnet
  name = 'Base';
  isConnected = false;
  
  private config: BaseNFTConfig;
  private basescanUrl = 'https://api.basescan.org/api';
  private alchemyUrl = 'https://base-mainnet.g.alchemy.com/nft/v2';
  private simplehashUrl = 'https://api.simplehash.com/api/v0';

  /**
   * Create Base NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: BaseNFTConfig) {
    this.config = config;
    this.isConnected = config.rpcUrl != null;
  }

  /**
   * Get all NFTs for a wallet address
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.warn(`Fetching Base NFTs for address: ${address}`);
      
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        return await this.fetchFromAlchemy(address);
      }
      
      // Try SimpleHash API if available
      if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey !== null && this.config.simplehashApiKey !== '') {
        return await this.fetchFromSimpleHash(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      console.warn('Error fetching Base NFTs:', error);
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
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`
        );
        
        if (response.ok) {
          const data = await response.json();
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
        this.callContract<string>(contract as unknown, 'tokenURI', tokenId),
        this.callContract<string>(contract as unknown, 'name'),
        this.callContract<string>(contract as unknown, 'ownerOf', tokenId)
      ]);
      
      // Parse metadata
      let metadata: { name: string; description: string; image?: string; attributes?: Array<{ trait_type: string; value: string | number }> } = { name: `${name} #${tokenId}`, description: '' };
      if (tokenURI) {
        if (tokenURI.startsWith('data:')) {
          const json = tokenURI.split(',')[1] ?? '';
          if (json) {
            metadata = JSON.parse(atob(json));
          }
        } else if (tokenURI.startsWith('ipfs://')) {
          const ipfsGateway = 'https://ipfs.io/ipfs/';
          const ipfsHash = tokenURI.replace('ipfs://', '');
          try {
            const response = await fetch(ipfsGateway + ipfsHash);
            metadata = await response.json();
          } catch {}
        } else if (tokenURI.startsWith('http')) {
          try {
            const response = await fetch(tokenURI);
            metadata = await response.json();
          } catch {}
        }
      }
      
      return {
        id: `base_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || '',
        image: metadata.image || '',
        imageUrl: metadata.image || '',
        attributes: metadata.attributes || [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'base',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      console.warn('Error fetching Base NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   * @param address
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      const nfts = await this.getNFTs(address);
      const collectionMap = new Map<string, NFTCollection>();
      
      for (const nft of nfts) {
        if (!collectionMap.has(nft.contractAddress)) {
          collectionMap.set(nft.contractAddress, {
            id: `base_collection_${nft.contractAddress}`,
            name: (nft.name?.split('#')[0] ?? nft.name).toString().trim() || 'Unknown Collection',
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'base',
            creator: nft.creator || address,
            verified: false,
            items: []
          });
        }
        collectionMap.get(nft.contractAddress)!.items.push(nft);
      }
      
      return Array.from(collectionMap.values());
    } catch (error) {
      console.warn('Error fetching Base collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Alchemy API
   * @param address
   */
  private async fetchFromAlchemy(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?owner=${address}&withMetadata=true&pageSize=100`
    );
    
    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.ownedNfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
  }

  /**
   * Fetch NFTs from SimpleHash API
   * @param address
   */
  private async fetchFromSimpleHash(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.simplehashUrl}/nfts/owners?chains=base&wallet_addresses=${address}&limit=100`,
      {
        headers: {
          'X-API-KEY': this.config.simplehashApiKey!
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`SimpleHash API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.nfts?.map((nft: any) => this.transformSimpleHashNFT(nft)) || [];
  }

  /**
   * Transform Alchemy NFT data to our format
   * @param nft
   */
  private transformAlchemyNFT(nft: any): NFTItem {
    const metadata = nft.metadata || {};
    
    return {
      id: `base_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name || nft.title || `Base NFT #${nft.id.tokenId}`,
      description: metadata.description || nft.description || '',
      image: metadata.image || nft.media?.[0]?.gateway || '',
      imageUrl: metadata.image || nft.media?.[0]?.gateway || '',
      attributes: metadata.attributes || [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: ((nft.id.tokenMetadata?.tokenType || 'ERC721') as string).toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721',
      blockchain: 'base',
      owner: '',
      creator: metadata.creator || '',
      isListed: false
    };
  }

  /**
   * Transform SimpleHash NFT data to our format
   * @param nft
   */
  private transformSimpleHashNFT(nft: any): NFTItem {
    return {
      id: `base_${nft.contract_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name || `Base NFT #${nft.token_id}`,
      description: nft.description || '',
      image: nft.image_url || nft.previews?.image_medium_url || '',
      imageUrl: nft.image_url || nft.previews?.image_medium_url || '',
      attributes: nft.extra_metadata?.attributes || [],
      contract: nft.contract_address,
      contractAddress: nft.contract_address,
      tokenStandard: ((nft.contract?.type || 'ERC721') as string).toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721',
      blockchain: 'base',
      owner: nft.owners?.[0]?.owner_address || '',
      creator: nft.contract?.deployed_by || '',
      price: nft.last_sale?.unit_price ? 
        (Number(nft.last_sale.unit_price) / 1e18).toString() : '0',
      currency: 'ETH',
      isListed: Boolean(nft.listings?.length),
      marketplaceUrl: nft.external_url
    };
  }

  /**
   * Fetch NFTs directly from blockchain using ethers
   * @param address
   */
  private async fetchFromBlockchain(address: string): Promise<NFTItem[]> {
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      // Popular Base NFT contracts to check
      const nftContracts = [
        '0xd4307e0acd12cf46fd6cf93bc264f5d5d1598792', // Base, Introduced
        '0xba5e05cb26b78eda3a2f8e3b3814726305dcac83', // BasePaint
        '0x5806485215C8542C448EcF707aB6321b85eB5D18', // Stand with Crypto
        '0x9d6F33d70A90588c70e411aB22d899BAD31C4264', // Base Day One
        '0xfae6aBAEA9e712dCCeCAEDbEd2700aeBd293dd25'  // Base Gods
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
          const balance = await this.callContract<bigint>(contract as any, 'balanceOf', address);
          if (balance === 0n) continue;
          
          // Get collection name
          const collectionName = (await this.callContract<string>(contract as any, 'name')) || 'Unknown Collection';
          
          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);
          
          for (let i = 0; i < limit; i++) {
            try {
              const tokenId = await this.callContract<bigint>(contract as any, 'tokenOfOwnerByIndex', address, i);
              const tokenURI = (await this.callContract<string>(contract as any, 'tokenURI', tokenId)) || '';
              
              // Parse metadata if available
              let metadata: any = {};
              if (tokenURI.startsWith('data:')) {
                // On-chain metadata
                const json = tokenURI.split(',')[1] ?? '';
                if (json) {
                  metadata = JSON.parse(atob(json));
                }
              } else if (tokenURI.startsWith('ipfs://')) {
                // IPFS metadata
                const ipfsGateway = 'https://ipfs.io/ipfs/';
                const ipfsHash = tokenURI.replace('ipfs://', '');
                try {
                  const response = await fetch(ipfsGateway + ipfsHash);
                  metadata = await response.json();
                } catch {
                  metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                }
              } else if (tokenURI.startsWith('http')) {
                // HTTP metadata
                try {
                  const response = await fetch(tokenURI);
                  metadata = await response.json();
                } catch {
                  metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                }
              }
              
              nfts.push({
                id: `base_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'base',
                owner: address,
                creator: '',
                price: '0',
                currency: 'ETH',
                isListed: false
              });
            } catch (error) {
              console.warn(`Failed to fetch NFT ${i} from ${contractAddress}:`, error);
            }
          }
        } catch (error) {
          console.warn(`Failed to query contract ${contractAddress}:`, error);
        }
      }
      
      return nfts;
    } catch (error) {
      console.error('Failed to fetch NFTs from blockchain:', error);
      return [];
    }
  }

  /**
   * Search NFTs on Base
   * @param query
   * @param limit
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Alchemy API, use it for search
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?contractAddresses[]=${query}&withMetadata=true&pageSize=${limit}`
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.ownedNfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
        }
      }
      
      // If we have SimpleHash API, use it for search
      if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey !== null && this.config.simplehashApiKey !== '') {
        const response = await fetch(
          `${this.simplehashUrl}/nfts/collection/${query}?chains=base&limit=${limit}`,
          {
            headers: {
              'X-API-KEY': this.config.simplehashApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.nfts?.map((nft: any) => this.transformSimpleHashNFT(nft)) || [];
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error searching Base NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Base
   * @param limit
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch trending NFTs on Base
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
        // Get NFTs from popular collections
        const popularContracts = [
          '0xd4307e0acd12cf46fd6cf93bc264f5d5d1598792', // Base, Introduced
          '0xba5e05cb26b78eda3a2f8e3b3814726305dcac83', // BasePaint
          '0x5806485215C8542C448EcF707aB6321b85eB5D18'  // Stand with Crypto
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
              const data = await nftResponse.json();
              const collectionNfts = data.nfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
              nfts.push(...collectionNfts);
            }
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      // SimpleHash trending
      if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey !== null && this.config.simplehashApiKey !== '') {
        const response = await fetch(
          `${this.simplehashUrl}/nfts/trending_collections?chains=base&time_period=24h&limit=${limit}`,
          {
            headers: {
              'X-API-KEY': this.config.simplehashApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const nfts: NFTItem[] = [];
          
          // Get sample NFTs from trending collections
          for (const collection of data.collections || []) {
            const nftResponse = await fetch(
              `${this.simplehashUrl}/nfts/collection/${collection.collection_id}?chains=base&limit=5`,
              {
                headers: {
                  'X-API-KEY': this.config.simplehashApiKey
                }
              }
            );
            
            if (nftResponse.ok) {
              const nftData = await nftResponse.json();
              const collectionNfts = nftData.nfts?.map((nft: any) => this.transformSimpleHashNFT(nft)) || [];
              nfts.push(...collectionNfts);
            }
            
            if (nfts.length >= limit) break;
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error fetching trending Base NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig
   */
  updateConfig(newConfig: Partial<BaseNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey !== null && this.config.alchemyApiKey !== '') {
      try {
        const response = await fetch(`${this.alchemyUrl}/${this.config.alchemyApiKey}/isHolderOfCollection?wallet=0x0000000000000000000000000000000000000000&contractAddress=0x0000000000000000000000000000000000000000`);
        if (response.ok) workingApis.push('Alchemy');
      } catch (error) {
        console.warn('Alchemy connection test failed:', error);
      }
    }

    if (this.config.simplehashApiKey !== undefined && this.config.simplehashApiKey !== null && this.config.simplehashApiKey !== '') {
      try {
        const response = await fetch(`${this.simplehashUrl}/nfts/owners?chains=base&wallet_addresses=0x0000000000000000000000000000000000000000&limit=1`, {
          headers: { 'X-API-KEY': this.config.simplehashApiKey }
        });
        if (response.ok) workingApis.push('SimpleHash');
      } catch (error) {
        console.warn('SimpleHash connection test failed:', error);
      }
    }

    if (this.config.basescanApiKey) {
      try {
        const response = await fetch(
          `${this.basescanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.basescanApiKey}`
        );
        if (response.ok) workingApis.push('Basescan');
      } catch (error) {
        console.warn('Basescan connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }

  /**
   * Safely call a contract method with optional presence.
   * @param contract
   * @param method
   * @param {...any} args
   */
  private async callContract<T>(contract: any, method: string, ...args: unknown[]): Promise<T> {
    try {
      const fn = contract?.[method as keyof typeof contract] as unknown;
      if (typeof fn !== 'function') return undefined as unknown as T;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return await (fn as (...a: unknown[]) => Promise<T> | T)(...args);
    } catch {
      return undefined as unknown as T;
    }
  }
}
