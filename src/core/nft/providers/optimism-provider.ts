import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

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
  chainId = 10; // Optimism mainnet
  name = 'Optimism';
  isConnected = false;
  
  private config: OptimismNFTConfig;
  private optimisticEtherscanUrl = 'https://api-optimistic.etherscan.io/api';
  private alchemyUrl = 'https://opt-mainnet.g.alchemy.com/nft/v2';
  private simplehashUrl = 'https://api.simplehash.com/api/v0';

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
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.warn(`Fetching Optimism NFTs for address: ${address}`);
      
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey) {
        return await this.fetchFromAlchemy(address);
      }
      
      // Try SimpleHash API if available
      if (this.config.simplehashApiKey) {
        return await this.fetchFromSimpleHash(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      console.warn('Error fetching Optimism NFTs:', error);
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
      if (this.config.alchemyApiKey) {
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
      
      const c: any = contract;
      const [tokenURI, name, owner] = await Promise.all([
        c?.['tokenURI']?.(tokenId).catch(() => ''),
        c?.['name']?.().catch(() => 'Unknown Collection'),
        c?.['ownerOf']?.(tokenId).catch(() => '0x0000000000000000000000000000000000000000')
      ]);
      
      // Parse metadata
      let metadata: any = { name: `${name} #${tokenId}`, description: '' };
      if (tokenURI) {
        if (tokenURI.startsWith('data:')) {
          const json = tokenURI.split(',')[1];
          metadata = JSON.parse(atob(json));
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
        id: `optimism_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || '',
        image: metadata.image || '',
        imageUrl: metadata.image || '',
        attributes: metadata.attributes || [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'optimism',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      console.warn('Error fetching Optimism NFT metadata:', error);
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
            id: `optimism_collection_${nft.contractAddress}`,
            name: nft.name.split('#')[0].trim() || 'Unknown Collection',
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'optimism',
            creator: nft.creator || address,
            verified: false,
            items: []
          });
        }
        collectionMap.get(nft.contractAddress)!.items.push(nft);
      }
      
      return Array.from(collectionMap.values());
    } catch (error) {
      console.warn('Error fetching Optimism collections:', error);
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
      `${this.simplehashUrl}/nfts/owners?chains=optimism&wallet_addresses=${address}&limit=100`,
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
      id: `optimism_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name || nft.title || `Optimism NFT #${nft.id.tokenId}`,
      description: metadata.description || nft.description || '',
      image: metadata.image || nft.media?.[0]?.gateway || '',
      imageUrl: metadata.image || nft.media?.[0]?.gateway || '',
      attributes: metadata.attributes || [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: nft.id.tokenMetadata?.tokenType || 'ERC721',
      blockchain: 'optimism',
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
      id: `optimism_${nft.contract_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name || `Optimism NFT #${nft.token_id}`,
      description: nft.description || '',
      image: nft.image_url || nft.previews?.image_medium_url || '',
      imageUrl: nft.image_url || nft.previews?.image_medium_url || '',
      attributes: nft.extra_metadata?.attributes || [],
      contract: nft.contract_address,
      contractAddress: nft.contract_address,
      tokenStandard: nft.contract?.type || 'ERC721',
      blockchain: 'optimism',
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
          const balance = await (contract as any)?.['balanceOf']?.(address);
          if (balance === 0n) continue;
          
          // Get collection name
          const collectionName = await (contract as any)?.['name']?.().catch(() => 'Unknown Collection');
          
          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);
          
          for (let i = 0; i < limit; i++) {
            try {
              const tokenId = await (contract as any)?.['tokenOfOwnerByIndex']?.(address, i);
              const tokenURI = await (contract as any)?.['tokenURI']?.(tokenId).catch(() => '');
              
              // Parse metadata if available
              let metadata: any = {};
              if (tokenURI.startsWith('data:')) {
                // On-chain metadata
                const json = tokenURI.split(',')[1];
                metadata = JSON.parse(atob(json));
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
                id: `optimism_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
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
   * Search NFTs on Optimism
   * @param query
   * @param limit
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Alchemy API, use it for search
      if (this.config.alchemyApiKey) {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?contractAddresses[]=${query}&withMetadata=true&pageSize=${limit}`
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.ownedNfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
        }
      }
      
      // If we have SimpleHash API, use it for search
      if (this.config.simplehashApiKey) {
        const response = await fetch(
          `${this.simplehashUrl}/nfts/collection/${query}?chains=optimism&limit=${limit}`,
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
      console.warn('Error searching Optimism NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Optimism
   * @param limit
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from Quixotic or other Optimism NFT marketplaces
      // For now, return NFTs from popular collections
      if (this.config.alchemyApiKey) {
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
              const data = await nftResponse.json();
              const collectionNfts = data.nfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
              nfts.push(...collectionNfts);
            }
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      // SimpleHash trending
      if (this.config.simplehashApiKey) {
        const response = await fetch(
          `${this.simplehashUrl}/nfts/trending_collections?chains=optimism&time_period=24h&limit=${limit}`,
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
              `${this.simplehashUrl}/nfts/collection/${collection.collection_id}?chains=optimism&limit=5`,
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
      console.warn('Error fetching trending Optimism NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig
   */
  updateConfig(newConfig: Partial<OptimismNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.alchemyApiKey) {
      try {
        const response = await fetch(`${this.alchemyUrl}/${this.config.alchemyApiKey}/isHolderOfCollection?wallet=0x0000000000000000000000000000000000000000&contractAddress=0x0000000000000000000000000000000000000000`);
        if (response.ok) workingApis.push('Alchemy');
      } catch (error) {
        console.warn('Alchemy connection test failed:', error);
      }
    }

    if (this.config.simplehashApiKey) {
      try {
        const response = await fetch(`${this.simplehashUrl}/nfts/owners?chains=optimism&wallet_addresses=0x0000000000000000000000000000000000000000&limit=1`, {
          headers: { 'X-API-KEY': this.config.simplehashApiKey }
        });
        if (response.ok) workingApis.push('SimpleHash');
      } catch (error) {
        console.warn('SimpleHash connection test failed:', error);
      }
    }

    if (this.config.optimisticEtherscanApiKey) {
      try {
        const response = await fetch(
          `${this.optimisticEtherscanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.optimisticEtherscanApiKey}`
        );
        if (response.ok) workingApis.push('Optimistic Etherscan');
      } catch (error) {
        console.warn('Optimistic Etherscan connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}
