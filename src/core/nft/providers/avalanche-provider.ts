import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

export interface AvalancheNFTConfig {
  rpcUrl: string;
  snowtraceApiKey?: string;
  joepegsApiKey?: string;
}

/**
 * Avalanche NFT Provider for fetching NFTs from Avalanche C-Chain
 * Supports Snowtrace and Joepegs APIs for comprehensive NFT data
 */
export class AvalancheNFTProvider implements ChainProvider {
  chainId = 43114; // Avalanche C-Chain mainnet
  name = 'Avalanche';
  isConnected = false;
  
  private config: AvalancheNFTConfig;
  private snowtraceUrl = 'https://api.snowtrace.io/api';
  private joepegsUrl = 'https://api.joepegs.dev/v2';

  constructor(config: AvalancheNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
  }

  /**
   * Get all NFTs for a wallet address
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.warn(`Fetching Avalanche NFTs for address: ${address}`);
      
      // Try Joepegs API first if available
      if (this.config.joepegsApiKey) {
        return await this.fetchFromJoepegs(address);
      }
      
      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);
      
    } catch (error) {
      console.warn('Error fetching Avalanche NFTs:', error);
      return [];
    }
  }

  /**
   * Get specific NFT metadata
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
        id: `avalanche_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || '',
        image: metadata.image || '',
        imageUrl: metadata.image || '',
        attributes: metadata.attributes || [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'avalanche',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      console.warn('Error fetching Avalanche NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      const nfts = await this.getNFTs(address);
      const collectionMap = new Map<string, NFTCollection>();
      
      for (const nft of nfts) {
        if (!collectionMap.has(nft.contractAddress)) {
          collectionMap.set(nft.contractAddress, {
            id: `avalanche_collection_${nft.contractAddress}`,
            name: nft.name.split('#')[0].trim() || 'Unknown Collection',
            description: '',
            contract: nft.contractAddress,
            contractAddress: nft.contractAddress,
            tokenStandard: nft.tokenStandard,
            blockchain: 'avalanche',
            creator: nft.creator || address,
            verified: false,
            items: []
          });
        }
        collectionMap.get(nft.contractAddress)!.items.push(nft);
      }
      
      return Array.from(collectionMap.values());
    } catch (error) {
      console.warn('Error fetching Avalanche collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Joepegs API
   */
  private async fetchFromJoepegs(address: string): Promise<NFTItem[]> {
    try {
      const response = await fetch(
        `${this.joepegsUrl}/users/${address}/tokens`,
        {
          headers: {
            'x-api-key': this.config.joepegsApiKey!
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Joepegs API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.tokens?.map((token: any) => ({
        id: `avalanche_${token.collectionAddress}_${token.tokenId}`,
        tokenId: token.tokenId,
        name: token.name || `Avalanche NFT #${token.tokenId}`,
        description: token.description || '',
        image: token.image || '',
        imageUrl: token.image || '',
        attributes: token.attributes || [],
        contract: token.collectionAddress,
        contractAddress: token.collectionAddress,
        tokenStandard: 'ERC721',
        blockchain: 'avalanche',
        owner: address,
        creator: token.creator || '',
        price: token.currentAskPrice ? (Number(token.currentAskPrice) / 1e18).toString() : '0',
        currency: 'AVAX',
        isListed: Boolean(token.currentAskPrice),
        marketplaceUrl: token.tokenId ? `https://joepegs.com/item/${token.collectionAddress}/${token.tokenId}` : undefined
      })) || [];
    } catch (error) {
      console.warn('Joepegs fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs directly from blockchain using ethers
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
                id: `avalanche_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'avalanche',
                owner: address,
                creator: '',
                price: '0',
                currency: 'AVAX',
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
   * Search NFTs on Avalanche
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Joepegs API, use it for search
      if (this.config.joepegsApiKey) {
        const response = await fetch(
          `${this.joepegsUrl}/collections/search?name=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              'x-api-key': this.config.joepegsApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const nfts: NFTItem[] = [];
          
          // Get sample NFTs from matching collections
          for (const collection of data.collections || []) {
            const tokensResponse = await fetch(
              `${this.joepegsUrl}/collections/${collection.address}/tokens?limit=5`,
              {
                headers: {
                  'x-api-key': this.config.joepegsApiKey!
                }
              }
            );
            
            if (tokensResponse.ok) {
              const tokensData = await tokensResponse.json();
              for (const token of tokensData.tokens || []) {
                nfts.push({
                  id: `avalanche_${token.collectionAddress}_${token.tokenId}`,
                  tokenId: token.tokenId,
                  name: token.name || collection.name,
                  description: token.description || collection.description || '',
                  image: token.image || collection.image || '',
                  imageUrl: token.image || collection.image || '',
                  attributes: token.attributes || [],
                  contract: token.collectionAddress,
                  contractAddress: token.collectionAddress,
                  tokenStandard: 'ERC721',
                  blockchain: 'avalanche',
                  owner: token.owner || '',
                  creator: collection.creator || '',
                  price: token.currentAskPrice ? (Number(token.currentAskPrice) / 1e18).toString() : '0',
                  currency: 'AVAX',
                  isListed: Boolean(token.currentAskPrice)
                });
              }
            }
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error searching Avalanche NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Avalanche
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch trending from Joepegs
      if (this.config.joepegsApiKey) {
        const response = await fetch(
          `${this.joepegsUrl}/collections/trending?limit=${Math.ceil(limit / 5)}`,
          {
            headers: {
              'x-api-key': this.config.joepegsApiKey
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const nfts: NFTItem[] = [];
          
          // Get sample NFTs from trending collections
          for (const collection of data.collections || []) {
            const tokensResponse = await fetch(
              `${this.joepegsUrl}/collections/${collection.address}/tokens?limit=5`,
              {
                headers: {
                  'x-api-key': this.config.joepegsApiKey!
                }
              }
            );
            
            if (tokensResponse.ok) {
              const tokensData = await tokensResponse.json();
              for (const token of tokensData.tokens || []) {
                nfts.push({
                  id: `avalanche_${token.collectionAddress}_${token.tokenId}`,
                  tokenId: token.tokenId,
                  name: token.name || collection.name,
                  description: token.description || collection.description || '',
                  image: token.image || collection.image || '',
                  imageUrl: token.image || collection.image || '',
                  attributes: token.attributes || [],
                  contract: token.collectionAddress,
                  contractAddress: token.collectionAddress,
                  tokenStandard: 'ERC721',
                  blockchain: 'avalanche',
                  owner: token.owner || '',
                  creator: collection.creator || '',
                  price: token.currentAskPrice ? (Number(token.currentAskPrice) / 1e18).toString() : '0',
                  currency: 'AVAX',
                  isListed: Boolean(token.currentAskPrice),
                  marketplaceUrl: `https://joepegs.com/item/${token.collectionAddress}/${token.tokenId}`
                });
              }
            }
            
            if (nfts.length >= limit) break;
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error fetching trending Avalanche NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AvalancheNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.joepegsApiKey) {
      try {
        const response = await fetch(`${this.joepegsUrl}/collections`, {
          headers: { 'x-api-key': this.config.joepegsApiKey }
        });
        if (response.ok) workingApis.push('Joepegs');
      } catch (error) {
        console.warn('Joepegs connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}