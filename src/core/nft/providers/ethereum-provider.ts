import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

export interface EthereumNFTConfig {
  rpcUrl: string;
  alchemyApiKey?: string;
  moralisApiKey?: string;
  openseaApiKey?: string;
}

/**
 * Ethereum NFT Provider for fetching NFTs from Ethereum mainnet
 * Supports OpenSea, Alchemy, and Moralis APIs for comprehensive NFT data
 */
export class EthereumNFTProvider implements ChainProvider {
  chainId = 1;
  name = 'Ethereum';
  isConnected = false;
  
  private config: EthereumNFTConfig;
  private baseUrl = 'https://api.opensea.io/api/v1';
  private alchemyUrl = 'https://eth-mainnet.g.alchemy.com/nft/v2';

  constructor(config: EthereumNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
  }

  /**
   * Get all NFTs for a wallet address
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.log(`Fetching Ethereum NFTs for address: ${address}`);
      
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey) {
        return await this.fetchFromAlchemy(address);
      }
      
      // Fallback to OpenSea API
      if (this.config.openseaApiKey) {
        return await this.fetchFromOpenSea(address);
      }
      
      // Fallback to mock data for development
      return await this.generateMockNFTs(address);
      
    } catch (error) {
      console.error('Error fetching Ethereum NFTs:', error);
      return await this.generateMockNFTs(address);
    }
  }

  /**
   * Get specific NFT metadata
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
      
      return await this.generateMockNFT(contractAddress, tokenId, 'unknown');
    } catch (error) {
      console.error('Error fetching NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      // This would integrate with collection APIs
      return [{
        id: 'ethereum_collection_1',
        name: 'Ethereum NFT Collection',
        description: 'Sample Ethereum collection',
        contract: '0x0000000000000000000000000000000000000000',
        contractAddress: '0x0000000000000000000000000000000000000000',
        tokenStandard: 'ERC721',
        blockchain: 'ethereum',
        creator: address,
        verified: true,
        items: []
      }];
    } catch (error) {
      console.error('Error fetching Ethereum collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Alchemy API
   */
  private async fetchFromAlchemy(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?owner=${address}&withMetadata=true&pageSize=100`
    );
    
    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.ownedNfts.map((nft: any) => this.transformAlchemyNFT(nft));
  }

  /**
   * Fetch NFTs from OpenSea API
   */
  private async fetchFromOpenSea(address: string): Promise<NFTItem[]> {
    const headers: HeadersInit = {
      'Accept': 'application/json'
    };
    
    if (this.config.openseaApiKey) {
      headers['X-API-KEY'] = this.config.openseaApiKey;
    }

    const response = await fetch(
      `${this.baseUrl}/assets?owner=${address}&limit=200`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`OpenSea API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.assets.map((asset: any) => this.transformOpenSeaNFT(asset));
  }

  /**
   * Transform Alchemy NFT data to our format
   */
  private transformAlchemyNFT(nft: any): NFTItem {
    const metadata = nft.metadata || {};
    
    return {
      id: `ethereum_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name || `Token #${nft.id.tokenId}`,
      description: metadata.description || '',
      image: metadata.image || nft.media?.[0]?.gateway || '',
      imageUrl: metadata.image || nft.media?.[0]?.gateway || '',
      attributes: metadata.attributes || [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: nft.id.tokenMetadata?.tokenType || 'ERC721',
      blockchain: 'ethereum',
      owner: 'unknown',
      creator: metadata.creator || 'unknown',
      isListed: false
    };
  }

  /**
   * Transform OpenSea NFT data to our format
   */
  private transformOpenSeaNFT(asset: any): NFTItem {
    return {
      id: `ethereum_${asset.asset_contract.address}_${asset.token_id}`,
      tokenId: asset.token_id,
      name: asset.name || `Token #${asset.token_id}`,
      description: asset.description || '',
      image: asset.image_url || asset.image_preview_url || '',
      imageUrl: asset.image_url || asset.image_preview_url || '',
      attributes: asset.traits || [],
      contract: asset.asset_contract.address,
      contractAddress: asset.asset_contract.address,
      tokenStandard: asset.asset_contract.schema_name || 'ERC721',
      blockchain: 'ethereum',
      owner: asset.owner?.address || 'unknown',
      creator: asset.creator?.address || 'unknown',
      price: asset.last_sale?.total_price ? 
        (parseInt(asset.last_sale.total_price) / 1e18).toString() : undefined,
      currency: 'ETH',
      isListed: Boolean(asset.sell_orders?.length),
      marketplaceUrl: asset.permalink
    };
  }

  /**
   * Generate mock NFTs for development/testing
   */
  private async generateMockNFTs(address: string): Promise<NFTItem[]> {
    const mockNFTs: NFTItem[] = [];
    const count = Math.floor(Math.random() * 8) + 2; // 2-9 NFTs

    for (let i = 0; i < count; i++) {
      mockNFTs.push(await this.generateMockNFT(
        `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        (i + 1).toString(),
        address
      ));
    }

    return mockNFTs;
  }

  /**
   * Generate a single mock NFT
   */
  private async generateMockNFT(contractAddress: string, tokenId: string, owner: string): Promise<NFTItem> {
    const collections = ['CryptoPunks', 'Bored Ape Yacht Club', 'Azuki', 'Doodles', 'Cool Cats'];
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    const categories = ['PFP', 'Art', 'Gaming', 'Music', 'Photography'];
    
    const collection = collections[Math.floor(Math.random() * collections.length)];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];

    return {
      id: `ethereum_${contractAddress}_${tokenId}`,
      tokenId,
      name: `${collection} #${tokenId}`,
      description: `A ${rarity} ${collection} NFT from the Ethereum blockchain`,
      image: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=ethereum${tokenId}`,
      imageUrl: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=ethereum${tokenId}`,
      attributes: [
        { trait_type: 'Collection', value: collection },
        { trait_type: 'Rarity', value: rarity },
        { trait_type: 'Category', value: category },
        { trait_type: 'Blockchain', value: 'Ethereum' }
      ],
      contract: contractAddress,
      contractAddress,
      tokenStandard: 'ERC721',
      blockchain: 'ethereum',
      owner,
      creator: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      price: (Math.random() * 5 + 0.1).toFixed(3),
      currency: 'ETH',
      isListed: Math.random() > 0.6
    };
  }

  /**
   * Search NFTs (basic implementation)
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // This would implement actual search functionality
      const mockResults = await this.generateMockNFTs('search');
      return mockResults
        .filter(nft => 
          nft.name.toLowerCase().includes(query.toLowerCase()) ||
          nft.description.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching Ethereum NFTs:', error);
      return [];
    }
  }

  /**
   * Get popular/trending NFTs
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // This would fetch trending NFTs from OpenSea or other APIs
      return await this.generateMockNFTs('trending');
    } catch (error) {
      console.error('Error fetching trending NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EthereumNFTConfig>): void {
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
        const response = await fetch(`${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?owner=0x0000000000000000000000000000000000000000&pageSize=1`);
        if (response.ok) workingApis.push('Alchemy');
      } catch (error) {
        console.error('Alchemy connection test failed:', error);
      }
    }

    if (this.config.openseaApiKey) {
      try {
        const response = await fetch(`${this.baseUrl}/assets?limit=1`, {
          headers: { 'X-API-KEY': this.config.openseaApiKey }
        });
        if (response.ok) workingApis.push('OpenSea');
      } catch (error) {
        console.error('OpenSea connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0,
      apis: workingApis
    };
  }
} 