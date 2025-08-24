import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

/**
 *
 */
export interface ArbitrumNFTConfig {
  /**
   *
   */
  rpcUrl: string;
  /**
   *
   */
  arbiscanApiKey?: string;
  /**
   *
   */
  alchemyApiKey?: string;
  /**
   *
   */
  moralisApiKey?: string;
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
   *
   * @param config
   */
  constructor(config: ArbitrumNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
  }

  /**
   * Get all NFTs for a wallet address
   * @param address
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.warn(`Fetching Arbitrum NFTs for address: ${address}`);
      
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey) {
        return await this.fetchFromAlchemy(address);
      }
      
      // Try Moralis API if available
      if (this.config.moralisApiKey) {
        return await this.fetchFromMoralis(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      console.warn('Error fetching Arbitrum NFTs:', error);
      return [];
    }
  }

  /**
   * Get specific NFT metadata
   * @param contractAddress
   * @param tokenId
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
      
      const [tokenURI, name, owner] = await Promise.all([
        contract.tokenURI(tokenId).catch(() => ''),
        contract.name().catch(() => 'Unknown Collection'),
        contract.ownerOf(tokenId).catch(() => '0x0000000000000000000000000000000000000000')
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
        id: `arbitrum_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || '',
        image: metadata.image || '',
        imageUrl: metadata.image || '',
        attributes: metadata.attributes || [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'arbitrum',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      console.warn('Error fetching Arbitrum NFT metadata:', error);
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
            id: `arbitrum_collection_${nft.contractAddress}`,
            name: nft.name.split('#')[0].trim() || 'Unknown Collection',
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'arbitrum',
            creator: nft.creator || address,
            verified: false,
            items: []
          });
        }
        collectionMap.get(nft.contractAddress)!.items.push(nft);
      }
      
      return Array.from(collectionMap.values());
    } catch (error) {
      console.warn('Error fetching Arbitrum collections:', error);
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
   * Fetch NFTs from Moralis API
   * @param address
   */
  private async fetchFromMoralis(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.moralisUrl}/${address}/nft?chain=arbitrum&limit=100`,
      {
        headers: {
          'X-API-Key': this.config.moralisApiKey!
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.result?.map((nft: any) => this.transformMoralisNFT(nft)) || [];
  }

  /**
   * Transform Alchemy NFT data to our format
   * @param nft
   */
  private transformAlchemyNFT(nft: any): NFTItem {
    const metadata = nft.metadata || {};
    
    return {
      id: `arbitrum_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name || nft.title || `Arbitrum NFT #${nft.id.tokenId}`,
      description: metadata.description || nft.description || '',
      image: metadata.image || nft.media?.[0]?.gateway || '',
      imageUrl: metadata.image || nft.media?.[0]?.gateway || '',
      attributes: metadata.attributes || [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: nft.id.tokenMetadata?.tokenType || 'ERC721',
      blockchain: 'arbitrum',
      owner: '',
      creator: metadata.creator || '',
      isListed: false
    };
  }

  /**
   * Transform Moralis NFT data to our format
   * @param nft
   */
  private transformMoralisNFT(nft: any): NFTItem {
    const metadata = nft.metadata ? JSON.parse(nft.metadata) : {};
    
    return {
      id: `arbitrum_${nft.token_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name || metadata.name || `Arbitrum NFT #${nft.token_id}`,
      description: metadata.description || '',
      image: metadata.image || nft.token_uri || '',
      imageUrl: metadata.image || nft.token_uri || '',
      attributes: metadata.attributes || [],
      contract: nft.token_address,
      contractAddress: nft.token_address,
      tokenStandard: nft.contract_type || 'ERC721',
      blockchain: 'arbitrum',
      owner: nft.owner_of || '',
      creator: nft.minter_address || '',
      isListed: false
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
          
          // Get balance
          const balance = await contract.balanceOf(address);
          if (balance === 0n) continue;
          
          // Get collection name
          const collectionName = await contract.name().catch(() => 'Unknown Collection');
          
          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);
          
          for (let i = 0; i < limit; i++) {
            try {
              const tokenId = await contract.tokenOfOwnerByIndex(address, i);
              const tokenURI = await contract.tokenURI(tokenId).catch(() => '');
              
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
                id: `arbitrum_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
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
   * Search NFTs on Arbitrum
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
      
      // If we have Moralis API, use it for search
      if (this.config.moralisApiKey) {
        const response = await fetch(
          `${this.moralisUrl}/nft/search?chain=arbitrum&q=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              'X-API-Key': this.config.moralisApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.result?.map((nft: any) => this.transformMoralisNFT(nft)) || [];
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error searching Arbitrum NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Arbitrum
   * @param limit
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from Treasure Marketplace or other Arbitrum NFT marketplaces
      // For now, return NFTs from popular collections
      if (this.config.alchemyApiKey) {
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
              const data = await nftResponse.json();
              const collectionNfts = data.nfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
              nfts.push(...collectionNfts);
            }
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      return [];
    } catch (error) {
      console.warn('Error fetching trending Arbitrum NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig
   */
  updateConfig(newConfig: Partial<ArbitrumNFTConfig>): void {
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

    if (this.config.moralisApiKey) {
      try {
        const response = await fetch(`${this.moralisUrl}/nft?chain=arbitrum&limit=1`, {
          headers: { 'X-API-Key': this.config.moralisApiKey }
        });
        if (response.ok) workingApis.push('Moralis');
      } catch (error) {
        console.warn('Moralis connection test failed:', error);
      }
    }

    if (this.config.arbiscanApiKey) {
      try {
        const response = await fetch(
          `${this.arbiscanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.arbiscanApiKey}`
        );
        if (response.ok) workingApis.push('Arbiscan');
      } catch (error) {
        console.warn('Arbiscan connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}