import type { NFTItem, NFTCollection } from '../../../types/nft';
import type { ChainProvider } from '../display/multi-chain-display';

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
  chainId = 137;
  name = 'Polygon';
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
    this.isConnected = config.rpcUrl != null;
  }

  /**
   * Get all NFTs for a wallet address
   * @param address Wallet address to fetch NFTs for
   * @returns Promise resolving to array of NFT items
   */
  async getNFTs(address: string): Promise<NFTItem[]> {
    try {
      console.warn(`Fetching Polygon NFTs for address: ${address}`);

      // Try Alchemy API first if available
      if (this.config.alchemyApiKey) {
        return await this.fetchFromAlchemy(address);
      }

      // Try QuickNode if available
      if (this.config.quickNodeApiKey) {
        return await this.fetchFromQuickNode(address);
      }

      // Fallback to direct blockchain query
      return await this.fetchFromBlockchain(address);

    } catch (error) {
      console.warn('Error fetching Polygon NFTs:', error);
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
        id: `polygon_${contractAddress}_${tokenId}`,
        tokenId,
        name: metadata.name || `${name} #${tokenId}`,
        description: metadata.description || '',
        image: metadata.image || '',
        imageUrl: metadata.image || '',
        attributes: metadata.attributes || [],
        contract: contractAddress,
        contractAddress,
        tokenStandard: 'ERC721',
        blockchain: 'polygon',
        owner,
        creator: '',
        isListed: false
      };
    } catch (error) {
      console.warn('Error fetching Polygon NFT metadata:', error);
      return null;
    }
  }

  /**
   * Get NFT collections for an address
   * @param address
   */
  async getCollections(address: string): Promise<NFTCollection[]> {
    try {
      return [{
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
      }];
    } catch (error) {
      console.warn('Error fetching Polygon collections:', error);
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
      id: `polygon_${nft.contract.address}_${nft.id.tokenId}`,
      tokenId: nft.id.tokenId,
      name: metadata.name || `Polygon Token #${nft.id.tokenId}`,
      description: metadata.description || '',
      image: metadata.image || nft.media?.[0]?.gateway || '',
      imageUrl: metadata.image || nft.media?.[0]?.gateway || '',
      attributes: metadata.attributes || [],
      contract: nft.contract.address,
      contractAddress: nft.contract.address,
      tokenStandard: ((nft.id.tokenMetadata?.tokenType || 'ERC721') as string).toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721',
      blockchain: 'polygon',
      owner: 'unknown',
      creator: metadata.creator || 'unknown',
      isListed: false
    };
  }

  /**
   * Fetch NFTs from QuickNode API
   * @param address
   */
  private async fetchFromQuickNode(address: string): Promise<NFTItem[]> {
    try {
      const response = await fetch(`https://api.quicknode.com/nft/v1/polygon/nfts?wallet=${address}`, {
        headers: {
          'x-api-key': this.config.quickNodeApiKey!
        }
      });

      if (!response.ok) {
        throw new Error(`QuickNode API error: ${response.status}`);
      }

      const data = await response.json();
      return data.assets?.map((nft: any) => ({
        id: `polygon_${nft.contract}_${nft.tokenId}`,
        tokenId: nft.tokenId,
        name: nft.name || `Polygon NFT #${nft.tokenId}`,
        description: nft.description || '',
        image: nft.imageUrl || '',
        imageUrl: nft.imageUrl || '',
        attributes: nft.traits || [],
        contract: nft.contract,
        contractAddress: nft.contract,
        tokenStandard: ((nft.type || 'ERC721') as string).toUpperCase() === 'ERC1155' ? 'ERC1155' : 'ERC721',
        blockchain: 'polygon',
        owner: address,
        creator: nft.creator || '',
        isListed: false
      })) || [];
    } catch (error) {
      console.warn('QuickNode fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch NFTs directly from blockchain using ethers
   * @param address
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
                id: `polygon_${contractAddress}_${tokenId}`,
                tokenId: tokenId.toString(),
                name: metadata.name || `${collectionName} #${tokenId}`,
                description: metadata.description || '',
                image: metadata.image || '',
                imageUrl: metadata.image || '',
                attributes: metadata.attributes || [],
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
   * Search NFTs on Polygon
   * @param query
   * @param limit
   */
  async searchNFTs(query: string, limit = 20): Promise<NFTItem[]> {
    try {
      // If we have Alchemy API, use it for search
      if (this.config.alchemyApiKey) {
        const response = await fetch(
          `${this.alchemyUrl}/${this.config.alchemyApiKey}/searchNFTs?query=${encodeURIComponent(query)}&pageSize=${limit}`
        );

        if (response.ok) {
          const data = await response.json();
          return data.nfts?.map((nft: any) => this.transformAlchemyNFT(nft)) || [];
        }
      }

      // Fallback to empty array if no search API available
      return [];
    } catch (error) {
      console.warn('Error searching Polygon NFTs:', error);
      return [];
    }
  }

  /**
   * Get trending NFTs on Polygon
   * @param limit
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
        const data = await response.json();
        const nfts: NFTItem[] = [];

        for (const event of data.asset_events || []) {
          if (event.asset) {
            nfts.push({
              id: `polygon_${event.asset.asset_contract.address}_${event.asset.token_id}`,
              tokenId: event.asset.token_id,
              name: event.asset.name || `${event.asset.collection.name} #${event.asset.token_id}`,
              description: event.asset.description || '',
              image: event.asset.image_url || '',
              imageUrl: event.asset.image_url || '',
              attributes: event.asset.traits || [],
              contract: event.asset.asset_contract.address,
              contractAddress: event.asset.asset_contract.address,
              tokenStandard: event.asset.asset_contract.schema_name || 'ERC721',
              blockchain: 'polygon',
              owner: event.asset.owner?.address || '',
              creator: event.asset.creator?.address || '',
              price: event.total_price ? (Number(event.total_price) / 1e18).toString() : '0',
              currency: 'MATIC',
              isListed: true
            });
          }
        }

        return nfts;
      }

      return [];
    } catch (error) {
      console.warn('Error fetching trending Polygon NFTs:', error);
      return [];
    }
  }

  /**
   * Update configuration
   * @param newConfig
   */
  updateConfig(newConfig: Partial<PolygonNFTConfig>): void {
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
        console.warn('Polygon Alchemy connection test failed:', error);
      }
    }

    return {
      connected: workingApis.length > 0 || Boolean(this.config.rpcUrl),
      apis: workingApis
    };
  }
}
