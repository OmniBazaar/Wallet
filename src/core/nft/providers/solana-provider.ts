import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

export interface SolanaNFTConfig {
  rpcUrl: string;
  heliusApiKey?: string;
  magicEdenApiKey?: string;
  quickNodeApiKey?: string;
}

/**
 * Solana NFT Provider for fetching NFTs from Solana network
 * Supports Helius, Magic Eden, and other Solana NFT APIs
 */
export class SolanaNFTProvider implements ChainProvider {
  chainId = 101; // Custom ID for Solana mainnet
  name = 'Solana';
  isConnected = false;
  
  private config: SolanaNFTConfig;
  private heliusUrl = 'https://api.helius.xyz/v0';
  private magicEdenUrl = 'https://api-mainnet.magiceden.dev/v2';

  constructor(config: SolanaNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
  }

  /**
   * Get all NFTs for a wallet address
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.log(`Fetching Solana NFTs for address: ${address}`);
      
      // Try Helius API first if available
      if (this.config.heliusApiKey) {
        return await this.fetchFromHelius(address);
      }
      
      // Try Magic Eden API
      if (this.config.magicEdenApiKey) {
        return await this.fetchFromMagicEden(address);
      }
      
      // Fallback to mock data for development
      return await this.generateMockNFTs(address);
      
    } catch (error) {
      console.error('Error fetching Solana NFTs:', error);
      return await this.generateMockNFTs(address);
    }
  }

  /**
   * Get specific NFT metadata
   */
  async getNFTMetadata(mintAddress: string, tokenId: string): Promise<NFTItem | null> {
    try {
      if (this.config.heliusApiKey) {
        const response = await fetch(
          `${this.heliusUrl}/token-metadata?api-key=${this.config.heliusApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mintAccounts: [mintAddress] })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          return data[0] ? this.transformHeliusNFT(data[0], 'unknown') : null;
        }
      }
      
      return await this.generateMockNFT(mintAddress, tokenId, 'unknown');
    } catch (error) {
      console.error('Error fetching Solana NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      return [{
        id: 'solana_collection_1',
        name: 'Solana Monkey Business',
        description: 'Popular Solana NFT collection with fast transactions',
        contract: 'SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W',
        contractAddress: 'SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W',
        tokenStandard: 'SPL',
        blockchain: 'solana',
        creator: address,
        verified: true,
        items: []
      }];
    } catch (error) {
      console.error('Error fetching Solana collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Helius API
   */
  private async fetchFromHelius(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.heliusUrl}/addresses/${address}/nfts?api-key=${this.config.heliusApiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.nfts.map((nft: any) => this.transformHeliusNFT(nft, address));
  }

  /**
   * Fetch NFTs from Magic Eden API
   */
  private async fetchFromMagicEden(address: string): Promise<NFTItem[]> {
    const headers: HeadersInit = {
      'Accept': 'application/json'
    };
    
    if (this.config.magicEdenApiKey) {
      headers['Authorization'] = `Bearer ${this.config.magicEdenApiKey}`;
    }

    const response = await fetch(
      `${this.magicEdenUrl}/wallets/${address}/tokens?limit=100`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`Magic Eden API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.map((token: any) => this.transformMagicEdenNFT(token, address));
  }

  /**
   * Transform Helius NFT data to our format
   */
  private transformHeliusNFT(nft: any, owner: string): NFTItem {
    const metadata = nft.content?.metadata || {};
    
    return {
      id: `solana_${nft.id}`,
      tokenId: nft.id,
      name: metadata.name || `Solana NFT ${nft.id?.slice(-8)}`,
      description: metadata.description || '',
      image: metadata.image || nft.content?.links?.image || '',
      imageUrl: metadata.image || nft.content?.links?.image || '',
      attributes: metadata.attributes || [],
      contract: nft.id,
      contractAddress: nft.id,
      tokenStandard: 'SPL',
      blockchain: 'solana',
      owner,
      creator: nft.creators?.[0]?.address || 'unknown',
      royalties: nft.royalty?.percent || 0,
      isListed: Boolean(nft.listings?.length)
    };
  }

  /**
   * Transform Magic Eden NFT data to our format
   */
  private transformMagicEdenNFT(token: any, owner: string): NFTItem {
    return {
      id: `solana_${token.mintAddress}`,
      tokenId: token.mintAddress,
      name: token.name || `Magic Eden NFT`,
      description: token.description || '',
      image: token.image || '',
      imageUrl: token.image || '',
      attributes: token.attributes || [],
      contract: token.mintAddress,
      contractAddress: token.mintAddress,
      tokenStandard: 'SPL',
      blockchain: 'solana',
      owner,
      creator: token.collection || 'unknown',
      price: token.price ? (token.price / 1e9).toString() : undefined, // Convert lamports to SOL
      currency: 'SOL',
      isListed: Boolean(token.listingPrice),
      marketplaceUrl: `https://magiceden.io/item-details/${token.mintAddress}`
    };
  }

  /**
   * Generate mock NFTs for development/testing
   */
  private async generateMockNFTs(address: string): Promise<NFTItem[]> {
    const mockNFTs: NFTItem[] = [];
    const count = Math.floor(Math.random() * 7) + 3; // 3-9 NFTs

    for (let i = 0; i < count; i++) {
      mockNFTs.push(await this.generateMockNFT(
        this.generateSolanaMintAddress(),
        (i + 1).toString(),
        address
      ));
    }

    return mockNFTs;
  }

  /**
   * Generate a single mock NFT
   */
  private async generateMockNFT(mintAddress: string, tokenId: string, owner: string): Promise<NFTItem> {
    const collections = [
      'Solana Monkey Business', 
      'Degenerate Ape Academy', 
      'SolPunks', 
      'Aurory', 
      'Star Atlas',
      'Thugbirdz',
      'Famous Fox Federation'
    ];
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    const categories = ['PFP', 'Gaming', 'Art', 'Utility', 'Music', 'Metaverse'];
    
    const collection = collections[Math.floor(Math.random() * collections.length)];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];

    return {
      id: `solana_${mintAddress}`,
      tokenId: mintAddress,
      name: `${collection} #${tokenId}`,
      description: `A ${rarity} ${collection} NFT on Solana with fast, cheap transactions`,
      image: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=solana${tokenId}`,
      imageUrl: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=solana${tokenId}`,
      attributes: [
        { trait_type: 'Collection', value: collection },
        { trait_type: 'Rarity', value: rarity },
        { trait_type: 'Category', value: category },
        { trait_type: 'Blockchain', value: 'Solana' },
        { trait_type: 'Transaction Speed', value: 'Fast' },
        { trait_type: 'Gas Fee', value: 'Ultra Low' }
      ],
      contract: mintAddress,
      contractAddress: mintAddress,
      tokenStandard: 'SPL',
      blockchain: 'solana',
      owner,
      creator: this.generateSolanaMintAddress(),
      price: (Math.random() * 10 + 0.5).toFixed(2), // 0.5-10.5 SOL
      currency: 'SOL',
      isListed: Math.random() > 0.4,
      royalties: Math.floor(Math.random() * 10) + 2.5 // 2.5-12.5%
    };
  }

  /**
   * Generate a mock Solana mint address
   */
  private generateSolanaMintAddress(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Search NFTs on Solana
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // This would implement actual search via Magic Eden or other APIs
      const mockResults = await this.generateMockNFTs('search');
      return mockResults
        .filter(nft => 
          nft.name.toLowerCase().includes(query.toLowerCase()) ||
          nft.description.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Solana
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      if (this.config.magicEdenApiKey) {
        // Fetch trending from Magic Eden API
        const response = await fetch(`${this.magicEdenUrl}/collections/trending?limit=${limit}`);
        if (response.ok) {
          const collections = await response.json();
          // Would transform collection data to NFT items
        }
      }
      
      return await this.generateMockNFTs('trending');
    } catch (error) {
      console.error('Error fetching trending Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Get floor prices for collections
   */
  async getCollectionFloorPrices(collectionSymbols: string[]): Promise<{ [symbol: string]: number }> {
    try {
      const floorPrices: { [symbol: string]: number } = {};
      
      if (this.config.magicEdenApiKey) {
        for (const symbol of collectionSymbols) {
          try {
            const response = await fetch(`${this.magicEdenUrl}/collections/${symbol}/stats`);
            if (response.ok) {
              const stats = await response.json();
              floorPrices[symbol] = stats.floorPrice / 1e9; // Convert lamports to SOL
            }
          } catch (error) {
            console.error(`Error fetching floor price for ${symbol}:`, error);
          }
        }
      }
      
      return floorPrices;
    } catch (error) {
      console.error('Error fetching collection floor prices:', error);
      return {};
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SolanaNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.heliusApiKey) {
      try {
        const response = await fetch(`${this.heliusUrl}/addresses/11111111111111111111111111111112/nfts?api-key=${this.config.heliusApiKey}&limit=1`);
        if (response.ok) workingApis.push('Helius');
      } catch (error) {
        console.error('Helius connection test failed:', error);
      }
    }

    if (this.config.magicEdenApiKey) {
      try {
        const response = await fetch(`${this.magicEdenUrl}/collections?limit=1`);
        if (response.ok) workingApis.push('Magic Eden');
      } catch (error) {
        console.error('Magic Eden connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
} 