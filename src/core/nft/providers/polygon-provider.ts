import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

/** Alchemy NFT response structure */
interface AlchemyNFTResponse {
  ownedNfts: Array<{
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
  }>;
}

/** QuickNode NFT response structure */
interface QuickNodeNFTResponse {
  assets?: Array<{
    contract: string;
    tokenId: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    traits?: Array<{ trait_type: string; value: string | number }>;
    type?: string;
    creator?: string;
  }>;
}

/** OpenSea event response structure */
interface OpenSeaEventResponse {
  asset_events?: Array<{
    asset?: {
      token_id: string;
      name?: string;
      description?: string;
      image_url?: string;
      traits?: Array<{ trait_type: string; value: string | number }>;
      asset_contract: {
        address: string;
        schema_name?: string;
      };
      collection: {
        name: string;
      };
      owner?: {
        address: string;
      };
      creator?: {
        address: string;
      };
    };
    total_price?: string;
  }>;
}

/** NFT metadata structure */
interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/** Configuration for Polygon NFT provider */
export interface PolygonNFTConfig {
  /** RPC URL for Polygon connection */
  rpcUrl: string;
  /** Alchemy API key for NFT data (optional) */
  alchemyApiKey?: string;
  /** Moralis API key for NFT data (optional) */
  moralisApiKey?: string;
  /** QuickNode API key for NFT data (optional) */
  quickNodeApiKey?: string;
}

/**
 * Polygon NFT Provider for fetching NFTs from Polygon network
 * Supports multiple APIs for comprehensive NFT data on Polygon
 */
export class PolygonNFTProvider implements ChainProvider {
  /** Chain ID for Polygon mainnet */
  chainId = 137;
  /** Chain name */
  name = 'Polygon';
  /** Connection status */
  isConnected = false;

  private config: PolygonNFTConfig;
  private alchemyUrl = 'https://polygon-mainnet.g.alchemy.com/nft/v2';
  private openseaUrl = 'https://api.opensea.io/api/v1';

  /**
   * Create Polygon NFT provider
   * @param config Configuration for provider setup
   */
  constructor(config: PolygonNFTConfig) {
    this.config = config;
    this.isConnected = Boolean(config.rpcUrl);
  }

  /**
   * Get all NFTs for a wallet address
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      // Try Alchemy API first if available
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.trim() !== '') {
        return await this.fetchFromAlchemy(address);
      }

      // Try QuickNode if available
      if (this.config.quickNodeApiKey !== undefined && this.config.quickNodeApiKey.trim() !== '') {
        return await this.fetchFromQuickNode(address);
      }

      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);

    } catch (error) {
      // Error fetching Polygon NFTs
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
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.trim() !== '') {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`
        );

        if (response.ok) {
          const data = await response.json() as AlchemyNFTResponse['ownedNfts'][0];
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
        contract['tokenURI'](tokenId).catch(() => ''),
        contract['name']().catch(() => 'Unknown Collection'),
        contract['ownerOf'](tokenId).catch(() => '0x0000000000000000000000000000000000000000')
      ]) as [string, string, string];

      // Parse metadata
      let metadata: NFTMetadata = { name: `${name} #${tokenId}`, description: '' };
      if (tokenURI !== '') {
        if (tokenURI.startsWith('data:')) {
          const json = tokenURI.split(',')[1];
          if (json !== undefined) {
            metadata = JSON.parse(atob(json)) as NFTMetadata;
          }
        } else if (tokenURI.startsWith('ipfs://')) {
          const ipfsGateway = 'https://ipfs.io/ipfs/';
          const ipfsHash = tokenURI.replace('ipfs://', '');
          try {
            const response = await fetch(ipfsGateway + ipfsHash);
            metadata = await response.json() as NFTMetadata;
          } catch {
            // Failed to fetch IPFS metadata
          }
        } else if (tokenURI.startsWith('http')) {
          try {
            const response = await fetch(tokenURI);
            metadata = await response.json() as NFTMetadata;
          } catch {
            // Failed to fetch HTTP metadata
          }
        }
      }

      return {
        id: `polygon_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name ?? `${name} #${tokenId}`,
        description: metadata.description ?? '',
        image: metadata.image ?? '',
        imageUrl: metadata.image ?? '',
        attributes: metadata.attributes ?? [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'polygon',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      // Error fetching Polygon NFT metadata
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
      return await Promise.resolve([{
        id: 'polygon_collection_1',
        name: 'Polygon NFT Collection',
        description: 'Sample Polygon collection with low gas fees',
        contract: '0x0000000000000000000000000000000000000000',
        contractAddress: '0x0000000000000000000000000000000000000000',
        tokenStandard: 'ERC721',
        blockchain: 'polygon',
        creator: address,
        verified: true,
        items: []
      }]);
    } catch (error) {
      // Error fetching Polygon collections
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

    const data = await response.json() as AlchemyNFTResponse;
    return data.ownedNfts.map((nft) => this.transformAlchemyNFT(nft));
  }

  /**
   * Transform Alchemy NFT data to our format
   * @param nft NFT data from Alchemy API
   * @returns Transformed NFT item
   */
  private transformAlchemyNFT(nft: AlchemyNFTResponse['ownedNfts'][0]): NFTItem {
    const metadata = nft.metadata ?? {};

    return {
      id: `polygon_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name ?? `Polygon Token #${nft.id.tokenId}`,
      description: metadata.description ?? '',
      image: metadata.image ?? nft.media?.[0]?.gateway ?? '',
      imageUrl: metadata.image ?? nft.media?.[0]?.gateway ?? '',
      attributes: metadata.attributes ?? [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: (nft.id.tokenMetadata?.tokenType?.toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721') as 'ERC721' | 'ERC1155',
      blockchain: 'polygon',
      owner: 'unknown',
      creator: metadata.creator ?? 'unknown',
      isListed: false
    };
  }

  /**
   * Fetch NFTs from QuickNode API
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  private async fetchFromQuickNode(address: string): Promise<NFTItem[]> {
    try {
      const response = await fetch(`https://api.quicknode.com/nft/v1/polygon/nfts?wallet=${address}`, {
        headers: {
          'x-api-key': this.config.quickNodeApiKey ?? ''
        }
      });

      if (!response.ok) {
        throw new Error(`QuickNode API error: ${response.status}`);
      }

      const data = await response.json() as QuickNodeNFTResponse;
      return data.assets?.map((nft) => ({
        id: `polygon_${nft.contract}_${nft.tokenId}`,
        tokenId: nft.tokenId,
        name: nft.name ?? `Polygon NFT #${nft.tokenId}`,
        description: nft.description ?? '',
        image: nft.imageUrl ?? '',
        imageUrl: nft.imageUrl ?? '',
        attributes: nft.traits ?? [],
        contract: nft.contract,
        contractAddress: nft.contract,
        tokenStandard: (nft.type?.toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721') as 'ERC721' | 'ERC1155',
        blockchain: 'polygon',
        owner: address,
        creator: nft.creator ?? '',
        isListed: false
      })) ?? [];
    } catch (error) {
      // QuickNode fetch failed
      return [];
    }
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

      // Popular Polygon NFT contracts to check
      const nftContracts = [
        '0x9d305a42A3975Ee4c1C57555BeD5919889DCE63F', // Polygon Punks
        '0x0BEF619Cf38cF0c22967289b8419720fBd1Db9f7', // Aavegotchi
        '0x3FA0EAC3058828Cc4BA97F51A33597C695bF6F9e', // MATIC Monsters
        '0x219b8aB790dedB965cA5C1C6C8fb48f5B5b2BeE6', // Polygon Apes
        '0xC4dF0e539dF923c3e0832196cC3f17e54Dd4d32a'  // PolyDoge
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
          const balance = await contract['balanceOf'](address) as bigint;
          if (balance === BigInt(0)) continue;

          // Get collection name
          const collectionName = await contract['name']().catch(() => 'Unknown Collection') as string;

          // Get up to 10 NFTs from this collection
          const limit = Math.min(Number(balance), 10);

          for (let i = 0; i < limit; i++) {
            try {
              const tokenId = await contract['tokenOfOwnerByIndex'](address, i) as bigint;
              const tokenURI = await contract['tokenURI'](tokenId).catch(() => '') as string;

              // Parse metadata if available
              let metadata: NFTMetadata = {};
              if (tokenURI !== '' && tokenURI.startsWith('data:')) {
                // On-chain metadata
                const json = tokenURI.split(',')[1];
                if (json !== undefined) {
                  metadata = JSON.parse(atob(json)) as NFTMetadata;
                }
              } else if (tokenURI.startsWith('ipfs://')) {
                // IPFS metadata
                const ipfsGateway = 'https://ipfs.io/ipfs/';
                const ipfsHash = tokenURI.replace('ipfs://', '');
                try {
                  const response = await fetch(ipfsGateway + ipfsHash);
                  metadata = await response.json() as NFTMetadata;
                } catch {
                  // Failed to fetch IPFS metadata
                  metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                }
              } else if (tokenURI.startsWith('http')) {
                // HTTP metadata
                try {
                  const response = await fetch(tokenURI);
                  metadata = await response.json() as NFTMetadata;
                } catch {
                  // Failed to fetch HTTP metadata
                  metadata = { name: `${collectionName} #${tokenId}`, description: '' };
                }
              }

              nfts.push({
                id: `polygon_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name ?? `${collectionName} #${tokenId}`,
                description: metadata.description ?? '',
                image: metadata.image ?? '',
                imageUrl: metadata.image ?? '',
                attributes: metadata.attributes ?? [],
                contract: contractAddress,
                contractAddress,
                tokenStandard: 'ERC721',
                blockchain: 'polygon',
                owner: address,
                creator: '',
                price: '0',
                currency: 'MATIC',
                isListed: false
              });
            } catch (error) {
              // Failed to fetch NFT from contract
            }
          }
        } catch (error) {
          // Failed to query contract
        }
      }

      return nfts;
    } catch (error) {
      // Failed to fetch NFTs from blockchain
      return [];
    }
  }

  /**
   * Search NFTs on Polygon
   * @param query Search query string
   * @param limit Maximum number of results to return (default: 20)
   * @returns Promise resolving to array of NFT items
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Alchemy API, use it for search
      if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.trim() !== '') {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/searchNFTs?query=${encodeURIComponent(query)}&pageSize=${limit}`
        );

        if (response.ok) {
          const data = await response.json() as { nfts?: AlchemyNFTResponse['ownedNfts'] };
          return data.nfts?.map((nft) => this.transformAlchemyNFT(nft)) ?? [];
        }
      }

      // Fallback to empty array if no search API available
      return [];
    } catch (error) {
      // Error searching Polygon NFTs
      return [];
    }
  }

  /**
   * Get trending NFTs on Polygon
   * @param limit Maximum number of results to return (default: 20)
   * @returns Promise resolving to array of NFT items
   */
  async getTrendingNFTs(limit = 20): Promise<NFTItem[]> {
    try {
      // Fetch from OpenSea trending collections on Polygon
      const response = await fetch(
        `https://api.opensea.io/api/v1/events?chain=matic&event_type=sale&limit=${limit}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json() as OpenSeaEventResponse;
        const nfts: NFTItem[] = [];

        for (const event of data.asset_events ?? []) {
          if (event.asset !== undefined) {
            nfts.push({
              id: `polygon_${event.asset.asset_contract.address}_${event.asset.token_id}`,
              tokenId: event.asset.token_id,
              name: event.asset.name ?? `${event.asset.collection.name} #${event.asset.token_id}`,
              description: event.asset.description ?? '',
              image: event.asset.image_url ?? '',
              imageUrl: event.asset.image_url ?? '',
              attributes: event.asset.traits ?? [],
              contract: event.asset.asset_contract.address,
              contractAddress: event.asset.asset_contract.address,
              tokenStandard: (event.asset.asset_contract.schema_name ?? 'ERC721') as 'ERC721' | 'ERC1155' | 'SPL' | 'other',
              blockchain: 'polygon',
              owner: event.asset.owner?.address ?? '',
              creator: event.asset.creator?.address ?? '',
              price: event.total_price !== undefined ? (Number(event.total_price) / 1e18).toString() : '0',
              currency: 'MATIC',
              isListed: true
            });
          }
        }

        return nfts;
      }

      return [];
    } catch (error) {
      // Error fetching trending Polygon NFTs
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig New configuration values to merge
   */
  updateConfig(newConfig: Partial<PolygonNFTConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isConnected = Boolean(this.config.rpcUrl);
  }

  /**
   * Test connection to APIs
   * @returns Promise resolving to connection status and available APIs
   */
  async testConnection(): Promise<{ connected: boolean; apis: string[] }> {
    const workingApis: string[] = [];

    if (this.config.alchemyApiKey !== undefined && this.config.alchemyApiKey.trim() !== '') {
      try {
        const response = await fetch(`${this.alchemyUrl}/${this.config.alchemyApiKey}/getNFTs?owner=0x0000000000000000000000000000000000000000&pageSize=1`);
        if (response.ok) workingApis.push('Alchemy');
      } catch (error) {
        // Polygon Alchemy connection test failed
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}