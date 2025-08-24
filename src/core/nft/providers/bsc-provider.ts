import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

/** Configuration for BSC NFT provider */
export interface BSCNFTConfig {
  /** RPC URL for BSC connection */
  rpcUrl: string;
  /** BSCScan API key for blockchain data (optional) */
  bscscanApiKey?: string;
  /** Moralis API key for NFT data (optional) */
  moralisApiKey?: string;
}

/**
 * BSC (Binance Smart Chain) NFT Provider for fetching NFTs
 * Supports BSCScan and Moralis APIs for comprehensive NFT data
 */
export class BSCNFTProvider implements ChainProvider {
  chainId = 56; // BSC mainnet
  name = 'BSC';
  isConnected = false;
  
  private config: BSCNFTConfig;
  private bscscanUrl = 'https://api.bscscan.com/api';
  private moralisUrl = 'https://deep-index.moralis.io/api/v2';

  /**
   * Create BSC NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: BSCNFTConfig) {
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
      console.warn(`Fetching BSC NFTs for address: ${address}`);
      
      // Try Moralis API first if available
      if (this.config.moralisApiKey) {
        return await this.fetchFromMoralis(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      console.warn('Error fetching BSC NFTs:', error);
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
      if (this.config.moralisApiKey) {
        const response = await fetch(
          `${this.moralisUrl}/${contractAddress}/${tokenId}?chain=bsc`,
          {
            headers: {
              'X-API-Key': this.config.moralisApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
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
        id: `bsc_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || '',
        image: metadata.image || '',
        imageUrl: metadata.image || '',
        attributes: metadata.attributes || [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'BEP721',
        blockchain: 'bsc',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      console.warn('Error fetching BSC NFT metadata:', error);
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
            id: `bsc_collection_${nft.contractAddress}`,
            name: nft.name.split('#')[0].trim() || 'Unknown Collection',
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'bsc',
            creator: nft.creator || address,
            verified: false,
            items: []
          });
        }
        collectionMap.get(nft.contractAddress)!.items.push(nft);
      }
      
      return Array.from(collectionMap.values());
    } catch (error) {
      console.warn('Error fetching BSC collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Moralis API
   * @param address
   */
  private async fetchFromMoralis(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.moralisUrl}/${address}/nft?chain=bsc&limit=100`,
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
   * Transform Moralis NFT data to our format
   * @param nft
   */
  private transformMoralisNFT(nft: any): NFTItem {
    const metadata = nft.metadata ? JSON.parse(nft.metadata) : {};
    
    return {
      id: `bsc_${nft.token_address}_${nft.token_id}`,
      tokenId: nft.token_id,
      name: nft.name || metadata.name || `BSC NFT #${nft.token_id}`,
      description: metadata.description || '',
      image: metadata.image || nft.token_uri || '',
      imageUrl: metadata.image || nft.token_uri || '',
      attributes: metadata.attributes || [],
      contract: nft.token_address,
      contractAddress: nft.token_address,
      tokenStandard: nft.contract_type || 'BEP721',
      blockchain: 'bsc',
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
                id: `bsc_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'BEP721',
                blockchain: 'bsc',
                owner: address,
                creator: '',
                price: '0',
                currency: 'BNB',
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
   * Search NFTs on BSC
   * @param query
   * @param limit
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Moralis API, use it for search
      if (this.config.moralisApiKey) {
        const response = await fetch(
          `${this.moralisUrl}/nft/search?chain=bsc&q=${encodeURIComponent(query)}&limit=${limit}`,
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
      console.warn('Error searching BSC NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on BSC
   * @param limit
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from NFTrade or other BSC NFT marketplaces
      // For now, return popular collections
      if (this.config.moralisApiKey) {
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
            const data = await response.json();
            const contractNfts = data.result?.map((nft: any) => this.transformMoralisNFT(nft)) || [];
            nfts.push(...contractNfts);
          }
        }
        
        return nfts.slice(0, limit);
      }
      
      return [];
    } catch (error) {
      console.warn('Error fetching trending BSC NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig
   */
  updateConfig(newConfig: Partial<BSCNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.moralisApiKey) {
      try {
        const response = await fetch(`${this.moralisUrl}/nft?chain=bsc&limit=1`, {
          headers: { 'X-API-Key': this.config.moralisApiKey }
        });
        if (response.ok) workingApis.push('Moralis');
      } catch (error) {
        console.warn('Moralis connection test failed:', error);
      }
    }

    if (this.config.bscscanApiKey) {
      try {
        const response = await fetch(
          `${this.bscscanUrl}?module=account&action=tokennfttx&address=0x0000000000000000000000000000000000000000&apikey=${this.config.bscscanApiKey}`
        );
        if (response.ok) workingApis.push('BSCScan');
      } catch (error) {
        console.warn('BSCScan connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}