import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';
import { OmniProvider } from '../../providers/OmniProvider';

/** Configuration for Ethereum NFT provider */
export interface EthereumNFTConfig {
  /** RPC URL for Ethereum connection */
  rpcUrl: string;
  /** Alchemy API key for NFT data (optional) */
  alchemyApiKey?: string;
  /** Moralis API key for NFT data (optional) */
  moralisApiKey?: string;
  /** OpenSea API key for NFT data (optional) */
  openseaApiKey?: string;
  /** Use OmniBazaar validators instead of external RPCs (optional) */
  useOmniProvider?: boolean;
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
  private omniProvider?: OmniProvider;

  /**
   * Create Ethereum NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: EthereumNFTConfig) {
    this.config = config;
    this.isConnected = config.rpcUrl != null;

    // Initialize OmniProvider if configured
    if (config.useOmniProvider) {
      this.omniProvider = new OmniProvider(1, {
        validatorUrl: process.env.VALIDATOR_URL || 'wss://validator.omnibazaar.com',
        walletId: 'ethereum-nft-provider',
        authKey: process.env.OMNI_AUTH_KEY
      });
    }
  }

  /**
   * Get all NFTs for a wallet address
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.warn(`Fetching Ethereum NFTs for address: ${address}`);

      // Try OmniProvider first if available
      if (this.omniProvider) {
        try {
          const nfts = await this.omniProvider.send('omni_getNFTs', [address]);
          if (nfts != null && nfts.length > 0) {
            return nfts;
          }
        } catch (error) {
          console.warn('OmniProvider failed, falling back to external APIs:', error);
        }
      }

      // Try Alchemy API if available
      if (this.config.alchemyApiKey) {
        return await this.fetchFromAlchemy(address);
      }

      // Fallback to OpenSea API
      if (this.config.openseaApiKey) {
        return await this.fetchFromOpenSea(address);
      }

      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);

    } catch (error) {
      console.warn('Error fetching Ethereum NFTs:', error);
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

      return null;
    } catch (error) {
      console.warn('Error fetching NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   * @param address
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
      console.warn('Error fetching Ethereum collections:', error);
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
    return data.ownedNfts.map((nft: {
      contract: { address: string };
      id: { tokenId: string; tokenMetadata?: { tokenType?: string } };
      metadata?: {
        name?: string;
        description?: string;
        image?: string;
        attributes?: Array<{ trait_type: string; value: string | number }>;
        creator?: string;
      };
      media?: Array<{ gateway?: string }>;
    }) => this.transformAlchemyNFT(nft));
  }

  /**
   * Fetch NFTs from OpenSea API
   * @param address
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
    return data.assets.map((asset: {
      asset_contract: { address: string; schema_name?: string };
      token_id: string;
      name?: string;
      description?: string;
      image_url?: string;
      image_preview_url?: string;
      traits?: Array<{ trait_type: string; value: string | number }>;
      owner?: { address: string };
      creator?: { address: string };
      last_sale?: { total_price: string };
      sell_orders?: Array<Record<string, unknown>>;
      permalink?: string;
    }) => this.transformOpenSeaNFT(asset));
  }

  /**
   * Transform Alchemy NFT data to our format
   * @param nft
   * @param nft.contract
   * @param nft.contract.address
   * @param nft.id
   * @param nft.id.tokenId
   * @param nft.id.tokenMetadata
   * @param nft.id.tokenMetadata.tokenType
   * @param nft.metadata
   * @param nft.metadata.name
   * @param nft.metadata.description
   * @param nft.metadata.image
   * @param nft.metadata.attributes
   * @param nft.metadata.creator
   * @param nft.media
   */
  private transformAlchemyNFT(nft: {
    contract: { address: string };
    id: { tokenId: string; tokenMetadata?: { tokenType?: string } };
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
      creator?: string;
    };
    media?: Array<{ gateway?: string }>;
  }): NFTItem {
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
   * @param asset
   * @param asset.asset_contract
   * @param asset.asset_contract.address
   * @param asset.asset_contract.schema_name
   * @param asset.token_id
   * @param asset.name
   * @param asset.description
   * @param asset.image_url
   * @param asset.image_preview_url
   * @param asset.traits
   * @param asset.owner
   * @param asset.owner.address
   * @param asset.creator
   * @param asset.creator.address
   * @param asset.last_sale
   * @param asset.last_sale.total_price
   * @param asset.sell_orders
   * @param asset.permalink
   */
  private transformOpenSeaNFT(asset: {
    asset_contract: { address: string; schema_name?: string };
    token_id: string;
    name?: string;
    description?: string;
    image_url?: string;
    image_preview_url?: string;
    traits?: Array<{ trait_type: string; value: string | number }>;
    owner?: { address: string };
    creator?: { address: string };
    last_sale?: { total_price: string };
    sell_orders?: Array<Record<string, unknown>>;
    permalink?: string;
  }): NFTItem {
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
   * Fetch NFTs directly from blockchain using ethers
   * @param address
   */
  private async fetchFromBlockchain(address: string): Promise<NFTItem[]> {
    try {
      // Use OmniProvider instead of external RPC
      const { ProviderFactory } = await import('../../providers/provider-factory');
      const provider = ProviderFactory.getProvider(1); // Ethereum chainId = 1

      // Try OmniBazaar's cached NFT data first
      try {
        const cachedNFTs = await provider.getNFTs(address, 1);
        if (cachedNFTs && cachedNFTs.length > 0) {
          console.log('NFTs served from OmniBazaar validator cache');
          return cachedNFTs;
        }
      } catch (error) {
        console.warn('Failed to get cached NFTs, falling back to direct query');
      }

      // Common NFT contracts to check
      const nftContracts = [
        '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // BAYC
        '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB', // CryptoPunks
        '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', // MAYC
        '0xED5AF388653567Af2F388E6224dC7C4b3241C544', // Azuki
        '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e'  // Doodles
      ];

      const nfts: NFTItem[] = [];

      // ERC721 ABI for balanceOf and tokenOfOwnerByIndex
      const erc721Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
        'function tokenURI(uint256 tokenId) view returns (string)',
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function ownerOf(uint256 tokenId) view returns (address)'
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
                // IPFS metadata - fetch if gateway available
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
                id: `ethereum_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'ethereum',
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
   * Search NFTs (basic implementation)
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

      // Return empty array if no search API available
      return [];
    } catch (error) {
      console.warn('Error searching Ethereum NFTs:', error);
      return [];
    }
  }

  /**
   * Get popular/trending NFTs
   * @param _limit
   */
  async getTrendingNFTs(_limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch trending NFTs from OpenSea API if available
      if (this.config.openseaApiKey) {
        const response = await fetch(`${this.baseUrl}/events?event_type=sale&limit=20`, {
          headers: {
            'X-API-KEY': this.config.openseaApiKey
          }
        });

        if (response.ok) {
          const data = await response.json();
          const nfts: NFTItem[] = [];

          for (const event of data.asset_events || []) {
            if (event.asset) {
              nfts.push({
                id: `ethereum_${event.asset.asset_contract.address}_${event.asset.token_id}`,
                tokenId: event.asset.token_id,
                name: event.asset.name || `${event.asset.collection.name} #${event.asset.token_id}`,
                description: event.asset.description || '',
                image: event.asset.image_url || '',
                imageUrl: event.asset.image_url || '',
                attributes: event.asset.traits || [],
                contract: event.asset.asset_contract.address,
                contractAddress: event.asset.asset_contract.address,
                tokenStandard: event.asset.asset_contract.schema_name || 'ERC721',
                blockchain: 'ethereum',
                owner: event.asset.owner?.address || '',
                creator: event.asset.creator?.address || '',
                price: event.total_price ? (Number(event.total_price) / 1e18).toString() : '0',
                currency: 'ETH',
                isListed: true
              });
            }
          }

          return nfts;
        }
      }

      // Fallback to empty array if no API available
      return [];
    } catch (error) {
      console.warn('Error fetching trending NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig
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
        console.warn('Alchemy connection test failed:', error);
      }
    }

    if (this.config.openseaApiKey) {
      try {
        const response = await fetch(`${this.baseUrl}/assets?limit=1`, {
          headers: { 'X-API-KEY': this.config.openseaApiKey }
        });
        if (response.ok) workingApis.push('OpenSea');
      } catch (error) {
        console.warn('OpenSea connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0,
      apis: workingApis
    };
  }
}
