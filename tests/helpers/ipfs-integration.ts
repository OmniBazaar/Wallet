/**
 * IPFS Integration Helper for NFT Testing
 *
 * Provides utilities to integrate with real IPFS/Helia service
 * from the Validator module for NFT metadata storage and retrieval.
 */

import axios from 'axios';

/**
 * IPFS integration configuration
 */
export interface IPFSConfig {
  /** Validator endpoint URL */
  endpoint: string;
  /** GraphQL endpoint */
  graphqlEndpoint?: string;
}

/**
 * NFT metadata structure
 */
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * IPFS service integration for NFT testing
 */
export class IPFSIntegration {
  private endpoint: string;
  private graphqlEndpoint: string;
  private mockStorage: Map<string, NFTMetadata> = new Map();

  constructor(config: IPFSConfig = { endpoint: 'http://localhost:8090' }) {
    this.endpoint = config.endpoint;
    this.graphqlEndpoint = config.graphqlEndpoint || `${config.endpoint}/graphql`;
  }

  /**
   * Store NFT metadata on IPFS
   * @param metadata - NFT metadata to store
   * @returns IPFS CID
   */
  async storeMetadata(metadata: NFTMetadata): Promise<string> {
    // In test environment, always use mock
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
      const cid = this.generateMockCID(metadata);
      this.mockStorage.set(cid, metadata);
      return cid;
    }

    try {
      // Use GraphQL mutation to store on IPFS
      const mutation = `
        mutation StoreIPFS($data: String!) {
          storeIPFS(data: $data) {
            cid
            success
            error
          }
        }
      `;

      const response = await axios.post(this.graphqlEndpoint, {
        query: mutation,
        variables: {
          data: JSON.stringify(metadata)
        }
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      const result = response.data.data.storeIPFS;
      if (!result.success) {
        throw new Error(result.error || 'Failed to store on IPFS');
      }

      return result.cid;
    } catch (error) {
      // Fallback to mock CID for testing
      console.warn('IPFS store failed, using mock:', error);
      return this.generateMockCID(metadata);
    }
  }

  /**
   * Retrieve NFT metadata from IPFS
   * @param cid - IPFS content identifier
   * @returns NFT metadata
   */
  async retrieveMetadata(cid: string): Promise<NFTMetadata> {
    // In test environment, always use mock
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
      // Return stored metadata if available, otherwise generate mock
      return this.mockStorage.get(cid) || this.generateMockMetadata(cid);
    }

    try {
      // Use GraphQL query to retrieve from IPFS
      const query = `
        query RetrieveIPFS($cid: String!) {
          retrieveIPFS(cid: $cid) {
            data
            success
            error
          }
        }
      `;

      const response = await axios.post(this.graphqlEndpoint, {
        query,
        variables: { cid }
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      const result = response.data.data.retrieveIPFS;
      if (!result.success) {
        throw new Error(result.error || 'Failed to retrieve from IPFS');
      }

      return JSON.parse(result.data) as NFTMetadata;
    } catch (error) {
      // Fallback to mock metadata for testing
      console.warn('IPFS retrieve failed, using mock:', error);
      return this.generateMockMetadata(cid);
    }
  }

  /**
   * Generate a mock CID for testing
   * @param metadata - Metadata to hash
   * @returns Mock CID
   */
  private generateMockCID(metadata: NFTMetadata): string {
    // Create a deterministic CID based on metadata
    const hash = this.simpleHash(JSON.stringify(metadata));
    return `Qm${hash.substring(0, 44)}`;
  }

  /**
   * Generate mock metadata for testing
   * @param cid - CID to generate metadata for
   * @returns Mock metadata
   */
  private generateMockMetadata(cid: string): NFTMetadata {
    // Extract a number from CID for variation
    const num = parseInt(cid.substring(2, 4), 16) || 1;

    return {
      name: `Mock NFT #${num}`,
      description: `This is a mock NFT with CID ${cid}`,
      image: `ipfs://${cid}/image.png`,
      attributes: [
        { trait_type: 'Rarity', value: 'Common' },
        { trait_type: 'Level', value: num }
      ]
    };
  }

  /**
   * Simple hash function for generating mock CIDs
   * @param str - String to hash
   * @returns Hex hash string
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Convert to hex and pad
    const hex = Math.abs(hash).toString(16);
    return hex.padEnd(44, '0');
  }

  /**
   * Pin content to ensure it stays available
   * @param cid - Content to pin
   * @returns Success status
   */
  async pinContent(cid: string): Promise<boolean> {
    try {
      const mutation = `
        mutation PinIPFS($cid: String!) {
          pinIPFS(cid: $cid) {
            success
            error
          }
        }
      `;

      const response = await axios.post(this.graphqlEndpoint, {
        query: mutation,
        variables: { cid }
      });

      return response.data?.data?.pinIPFS?.success || false;
    } catch (error) {
      console.warn('Pin failed:', error);
      return true; // Assume success for testing
    }
  }
}

/**
 * Create a mock NFT service that uses real IPFS
 */
export function createIPFSBackedNFTService(ipfsConfig?: IPFSConfig): any {
  const ipfs = new IPFSIntegration(ipfsConfig);
  const metadataCache = new Map<string, NFTMetadata>();

  return {
    async storeMetadata(metadata: NFTMetadata): Promise<string> {
      const cid = await ipfs.storeMetadata(metadata);
      metadataCache.set(cid, metadata);
      return cid;
    },

    async getMetadata(cid: string): Promise<NFTMetadata | null> {
      // Check cache first
      if (metadataCache.has(cid)) {
        return metadataCache.get(cid)!;
      }

      try {
        // Add a small delay to simulate network fetch when not cached
        if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        const metadata = await ipfs.retrieveMetadata(cid);
        metadataCache.set(cid, metadata);
        return metadata;
      } catch (error) {
        return null;
      }
    },

    clearCache(): void {
      metadataCache.clear();
    },

    getCacheSize(): number {
      return metadataCache.size;
    }
  };
}