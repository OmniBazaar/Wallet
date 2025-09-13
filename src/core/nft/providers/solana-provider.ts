import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

/** Helius NFT response type */
interface HeliusNFT {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
    };
    links?: { image?: string };
  };
  creators?: Array<{ address: string }>;
  royalty?: { percent: number };
  listings?: Array<Record<string, unknown>>;
}

/** Helius API response */
interface HeliusResponse {
  nfts: HeliusNFT[];
}

/** Magic Eden NFT token type */
interface MagicEdenToken {
  mintAddress: string;
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  collection?: string;
  price?: number;
  listingPrice?: number;
}

/** Magic Eden listing type */
interface MagicEdenListing {
  tokenMint: string;
  name?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  owner?: string;
  seller?: string;
  price?: number;
}

/** Magic Eden collection type */
interface MagicEdenCollection {
  symbol: string;
  name?: string;
  description?: string;
  image?: string;
  creator?: string;
}

/** Magic Eden collection stats */
interface MagicEdenStats {
  floorPrice: number;
}

/** Metaplex metadata type */
interface MetaplexMetadata {
  data: {
    name: string;
    uri: string;
    creators?: Array<{ address: { toString(): string } }>;
  };
}

/** Off-chain metadata type */
interface OffChainMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/** Configuration for Solana NFT provider */
export interface SolanaNFTConfig {
  /** RPC URL for Solana connection */
  rpcUrl: string;
  /** Helius API key for NFT data (optional) */
  heliusApiKey?: string;
  /** Magic Eden API key for marketplace data (optional) */
  magicEdenApiKey?: string;
  /** QuickNode API key for RPC access (optional) */
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

  /**
   * Create Solana NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: SolanaNFTConfig) {
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
      console.warn(`Fetching Solana NFTs for address: ${address}`);
      
      // Try Helius API first if available
      if (this.config.heliusApiKey != null && this.config.heliusApiKey !== '') {
        return await this.fetchFromHelius(address);
      }
      
      // Try Magic Eden API
      if (this.config.magicEdenApiKey != null && this.config.magicEdenApiKey !== '') {
        return await this.fetchFromMagicEden(address);
      }
      
      // Fallback to direct RPC query
      return await this.fetchFromRPC(address);
      
    } catch (error) {
      console.warn('Error fetching Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Get specific NFT metadata
   * @param mintAddress Solana mint address
   * @param _tokenId Token ID (unused in Solana)
   * @returns Promise resolving to NFT item or null
   */
  async getNFTMetadata(mintAddress: string, _tokenId: string): Promise<NFTItem | null> {
    try {
      if (this.config.heliusApiKey != null && this.config.heliusApiKey !== '') {
        const response = await fetch(
          `${this.heliusUrl}/token-metadata?api-key=${this.config.heliusApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mintAccounts: [mintAddress] })
          }
        );
        
        if (response.ok) {
          const data = await response.json() as unknown[];
          return (data != null && data.length > 0) ? this.transformHeliusNFT(data[0] as HeliusNFT, 'unknown') : null;
        }
      }
      
      // Return null if no metadata available
      return null;
    } catch (error) {
      console.warn('Error fetching Solana NFT metadata:', error);
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
      // Return a static collection for now, could be enhanced with actual API calls
      return await Promise.resolve([{
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
      }]);
    } catch (error) {
      console.warn('Error fetching Solana collections:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs from Helius API
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromHelius(address: string): Promise<NFTItem[]> {
    const response = await fetch(
      `${this.heliusUrl}/addresses/${address}/nfts?api-key=${this.config.heliusApiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }
    
    const data = await response.json() as HeliusResponse;
    return data.nfts.map((nft: HeliusNFT) => this.transformHeliusNFT(nft, address));
  }

  /**
   * Fetch NFTs from Magic Eden API
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromMagicEden(address: string): Promise<NFTItem[]> {
    const headers: HeadersInit = {
      'Accept': 'application/json'
    };
    
    if (this.config.magicEdenApiKey != null && this.config.magicEdenApiKey !== '') {
      headers['Authorization'] = `Bearer ${this.config.magicEdenApiKey}`;
    }

    const response = await fetch(
      `${this.magicEdenUrl}/wallets/${address}/tokens?limit=100`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`Magic Eden API error: ${response.status}`);
    }
    
    const data = await response.json() as MagicEdenToken[];
    return data.map((token: MagicEdenToken) => this.transformMagicEdenNFT(token, address));
  }

  /**
   * Transform Helius NFT data to our format
   * @param nft Helius NFT data object
   * @param owner Owner wallet address
   * @returns Transformed NFT item
   */
  private transformHeliusNFT(nft: HeliusNFT, owner: string): NFTItem {
    const metadata = nft.content?.metadata ?? {};
    
    return {
      id: `solana_${nft.id}`,
      tokenId: nft.id,
      name: (metadata.name != null && metadata.name !== '') ? metadata.name : `Solana NFT ${nft.id?.slice(-8)}`,
      description: metadata.description ?? '',
      image: metadata.image ?? nft.content?.links?.image ?? '',
      imageUrl: metadata.image ?? nft.content?.links?.image ?? '',
      attributes: metadata.attributes ?? [],
      contract: nft.id,
      contractAddress: nft.id,
      tokenStandard: 'SPL',
      blockchain: 'solana',
      owner,
      creator: nft.creators?.[0]?.address ?? 'unknown',
      royalties: nft.royalty?.percent ?? 0,
      isListed: Boolean(nft.listings != null && nft.listings.length > 0)
    };
  }

  /**
   * Transform Magic Eden NFT data to our format
   * @param token Magic Eden token data
   * @param owner Owner wallet address
   * @returns Transformed NFT item
   */
  private transformMagicEdenNFT(token: MagicEdenToken, owner: string): NFTItem {
    return {
      id: `solana_${token.mintAddress}`,
      tokenId: token.mintAddress,
      name: (token.name != null && token.name !== '') ? token.name : `Magic Eden NFT`,
      description: token.description ?? '',
      image: token.image ?? '',
      imageUrl: token.image ?? '',
      attributes: token.attributes ?? [],
      contract: token.mintAddress,
      contractAddress: token.mintAddress,
      tokenStandard: 'SPL',
      blockchain: 'solana',
      owner,
      creator: token.collection ?? 'unknown',
      // Convert lamports to SOL and always provide a string
      price: token.price != null ? (token.price / 1e9).toString() : '0',
      currency: 'SOL',
      isListed: token.listingPrice != null && token.listingPrice > 0,
      marketplaceUrl: `https://magiceden.io/item-details/${token.mintAddress}`
    };
  }

  /**
   * Fetch NFTs using Solana RPC
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromRPC(address: string): Promise<NFTItem[]> {
    try {
      // Import Solana web3.js dynamically
      const { Connection, PublicKey } = await import('@solana/web3.js');
      let metaplexModule;
      try {
        metaplexModule = await import('@metaplex-foundation/mpl-token-metadata');
      } catch {
        console.warn('Metaplex library not available, RPC NFT fetching disabled');
        return [];
      }
      
      // Type the Metadata class properly
      interface MetadataClass {
        findByMint: (connection: InstanceType<typeof Connection>, mint: InstanceType<typeof PublicKey>) => Promise<unknown>;
        getPDA: (mint: InstanceType<typeof PublicKey>) => Promise<InstanceType<typeof PublicKey>>;
        deserialize: (data: Buffer) => [MetaplexMetadata, number];
      }
      
      const MetadataExport = metaplexModule as unknown as { Metadata?: MetadataClass; default?: MetadataClass };
      const Metadata = MetadataExport.Metadata ?? MetadataExport.default;
      
      if (Metadata == null) {
        throw new Error('Failed to load Metaplex metadata module');
      }
      
      const connection = new Connection(this.config.rpcUrl, 'confirmed');
      const publicKey = new PublicKey(address);
      
      // Get token accounts owned by the wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });
      
      const nfts: NFTItem[] = [];
      
      for (const tokenAccount of tokenAccounts.value) {
        const accountData = tokenAccount.account.data as {
          parsed: {
            info: {
              tokenAmount: { uiAmount: number; decimals: number };
              mint: string;
            };
          };
        };
        const info = accountData.parsed.info;
        
        // Check if it's an NFT (amount = 1, decimals = 0)
        if (info.tokenAmount.uiAmount === 1 && info.tokenAmount.decimals === 0) {
          const mintAddress = info.mint;
          
          try {
            // Get metadata account for the mint
            const mintPubkey = new PublicKey(mintAddress);
            const metadataPDA = await Metadata.getPDA(mintPubkey);
            const metadataAccount = await connection.getAccountInfo(metadataPDA);
            
            if (metadataAccount != null) {
              const [metadata] = Metadata.deserialize(metadataAccount.data);
              
              // Fetch off-chain metadata if URI exists
              let offChainMetadata: OffChainMetadata = {};
              if (metadata.data.uri != null && metadata.data.uri !== '') {
                try {
                  const response = await fetch(metadata.data.uri);
                  offChainMetadata = await response.json() as OffChainMetadata;
                } catch {
                  // Ignore fetch errors
                }
              }
              
              nfts.push({
                id: `solana_${mintAddress}`,
                tokenId: mintAddress,
                name: (metadata.data.name != null && metadata.data.name !== '') ? metadata.data.name : (offChainMetadata.name ?? 'Unknown NFT'),
                description: offChainMetadata.description ?? '',
                image: offChainMetadata.image ?? '',
                imageUrl: offChainMetadata.image ?? '',
                attributes: offChainMetadata.attributes ?? [],
                contract: mintAddress,
                contractAddress: mintAddress,
                tokenStandard: 'SPL',
                blockchain: 'solana',
                owner: address,
                creator: metadata.data.creators?.[0]?.address.toString() ?? '',
                isListed: false
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch metadata for ${mintAddress}:`, error);
          }
        }
      }
      
      return nfts;
    } catch (error) {
      console.error('Failed to fetch NFTs from Solana RPC:', error);
      return [];
    }
  }

  /**
   * Generate a Solana mint address for testing
   * @returns Generated Solana address string
   */
  private generateSolanaMintAddress(): string {
    // This is only used internally now, not for mock data
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }


  /**
   * Search NFTs on Solana
   * @param query Search query string
   * @param limit Maximum number of results
   * @returns Promise resolving to array of NFT items
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // Search via Magic Eden API if available
      if (this.config.magicEdenApiKey != null && this.config.magicEdenApiKey !== '') {
        const response = await fetch(
          `${this.magicEdenUrl}/collections/search?q=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.magicEdenApiKey}`
            }
          }
        );
        
        if (response.ok) {
          const results = await response.json() as { collections?: MagicEdenCollection[] };
          const nfts: NFTItem[] = [];
          
          // Transform search results to NFT items
          for (const collection of results.collections ?? []) {
            // Fetch sample NFTs from each matching collection
            const collectionResponse = await fetch(
              `${this.magicEdenUrl}/collections/${collection.symbol}/listings?limit=5`
            );
            
            if (collectionResponse.ok) {
              const listings = await collectionResponse.json() as MagicEdenListing[];
              for (const listing of listings) {
                nfts.push({
                  id: `solana_${listing.tokenMint}`,
                  tokenId: listing.tokenMint,
                  name: (listing.name != null && listing.name !== '') ? listing.name : (collection.name ?? ''),
                  description: collection.description ?? '',
                  image: listing.image ?? collection.image ?? '',
                  imageUrl: listing.image ?? collection.image ?? '',
                  attributes: listing.attributes ?? [],
                  contract: listing.tokenMint,
                  contractAddress: listing.tokenMint,
                  tokenStandard: 'SPL',
                  blockchain: 'solana',
                  owner: listing.owner ?? '',
                  creator: collection.creator ?? '',
                  price: listing.price != null ? (listing.price / 1e9).toString() : '0',
                  currency: 'SOL',
                  isListed: true,
                  marketplaceUrl: `https://magiceden.io/item-details/${listing.tokenMint}`
                });
              }
            }
          }
          
          return nfts.slice(0, limit);
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error searching Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Solana
   * @param limit Maximum number of results
   * @returns Promise resolving to array of NFT items
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      if (this.config.magicEdenApiKey != null && this.config.magicEdenApiKey !== '') {
        // Fetch trending collections from Magic Eden
        const response = await fetch(
          `${this.magicEdenUrl}/collections/trending?limit=${Math.ceil(limit / 3)}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.magicEdenApiKey}`
            }
          }
        );
        
        if (response.ok) {
          const collections = await response.json() as MagicEdenCollection[];
          const nfts: NFTItem[] = [];
          
          // Get sample NFTs from trending collections
          for (const collection of collections.slice(0, 5)) {
            const listingsResponse = await fetch(
              `${this.magicEdenUrl}/collections/${collection.symbol}/listings?limit=4`
            );
            
            if (listingsResponse.ok) {
              const listings = await listingsResponse.json() as MagicEdenListing[];
              for (const listing of listings) {
                nfts.push({
                  id: `solana_${listing.tokenMint}`,
                  tokenId: listing.tokenMint,
                  name: (listing.name != null && listing.name !== '') ? listing.name : (collection.name ?? ''),
                  description: collection.description ?? '',
                  image: listing.image ?? collection.image ?? '',
                  imageUrl: listing.image ?? collection.image ?? '',
                  attributes: listing.attributes ?? [],
                  contract: listing.tokenMint,
                  contractAddress: listing.tokenMint,
                  tokenStandard: 'SPL',
                  blockchain: 'solana',
                  owner: listing.seller ?? '',
                  creator: collection.creator ?? '',
                  price: listing.price != null ? (listing.price / 1e9).toString() : '0',
                  currency: 'SOL',
                  isListed: true,
                  marketplaceUrl: `https://magiceden.io/item-details/${listing.tokenMint}`
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
      console.warn('Error fetching trending Solana NFTs:', error);
      return [];
    }
  }

  /**
   * Get floor prices for collections
   * @param collectionSymbols Array of collection symbols
   * @returns Promise resolving to floor prices map
   */
  async getCollectionFloorPrices(collectionSymbols: string[]): Promise<{ [symbol: string]: number }> {
    try {
      const floorPrices: { [symbol: string]: number } = {};
      
      if (this.config.magicEdenApiKey != null && this.config.magicEdenApiKey !== '') {
        for (const symbol of collectionSymbols) {
          try {
            const response = await fetch(`${this.magicEdenUrl}/collections/${symbol}/stats`);
            if (response.ok) {
              const stats = await response.json() as MagicEdenStats;
              floorPrices[symbol] = stats.floorPrice / 1e9; // Convert lamports to SOL
            }
          } catch (error) {
            console.warn(`Error fetching floor price for ${symbol}:`, error);
          }
        }
      }
      
      return floorPrices;
    } catch (error) {
      console.warn('Error fetching collection floor prices:', error);
      return {};
    }
  }

  /**
   * Update configuration
   * @param newConfig Partial configuration to update
   */
  updateConfig(newConfig: Partial<SolanaNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   * @returns Promise resolving to connection status and working APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.heliusApiKey != null && this.config.heliusApiKey !== '') {
      try {
        const response = await fetch(`${this.heliusUrl}/addresses/11111111111111111111111111111112/nfts?api-key=${this.config.heliusApiKey}&limit=1`);
        if (response.ok) workingApis.push('Helius');
      } catch (error) {
        console.warn('Helius connection test failed:', error);
      }
    }

    if (this.config.magicEdenApiKey != null && this.config.magicEdenApiKey !== '') {
      try {
        const response = await fetch(`${this.magicEdenUrl}/collections?limit=1`);
        if (response.ok) workingApis.push('Magic Eden');
      } catch (error) {
        console.warn('Magic Eden connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
} 
