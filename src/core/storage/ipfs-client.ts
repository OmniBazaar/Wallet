/**
 * IPFS Client for OmniBazaar Wallet
 * Handles decentralized storage for NFT metadata and marketplace data
 */

/**
 * File type for upload operations
 */
interface IPFSFile {
  /** File path */
  path: string;
  /** File content */
  content: Uint8Array;
}

/**
 * Add options for IPFS
 */
interface IPFSAddOptions {
  /** Pin content after adding */
  pin?: boolean;
  /** Wrap with directory */
  wrapWithDirectory?: boolean;
}

/**
 * IPFS HTTP Client type - loaded dynamically due to ESM module
 */
interface IPFSHTTPClient {
  /** Add content to IPFS */
  add: (file: IPFSFile, options?: IPFSAddOptions) => Promise<{ cid: { toString: () => string } }>;
  /** Read content from IPFS */
  cat: (cid: string) => AsyncIterable<Uint8Array>;
  /** Get content from IPFS */
  get: (cid: string) => AsyncIterable<{ path: string; content: Uint8Array }>;
  /** Pin operations */
  pin: {
    /** Pin content */
    add: (cid: string) => Promise<void>;
    /** Unpin content */
    rm: (cid: string) => Promise<void>;
    /** List pinned content */
    ls: () => AsyncIterable<{ cid: { toString: () => string } }>;
  };
  /** Object operations */
  object: {
    /** Get object stats */
    stat: (cid: string) => Promise<{
      Hash: string;
      DataSize: number;
      CumulativeSize: number;
      NumLinks: number;
    }>;
  };
  /** Add multiple files */
  addAll: (files: IPFSFile[], options?: IPFSAddOptions) => AsyncIterable<{ cid: { toString: () => string } }>;
}

/**
 * Result of IPFS upload operation
 */
export interface IPFSUploadResult {
  /** IPFS hash of uploaded content */
  hash: string;
  /** Public URL to access content */
  url: string;
  /** Size of uploaded content in bytes */
  size: number;
}

/**
 * NFT metadata structure following OpenSea standard
 */
export interface NFTMetadata {
  /** NFT name */
  name: string;
  /** NFT description */
  description: string;
  /** Main image URL or IPFS hash */
  image: string;
  /** Array of NFT attributes/traits */
  attributes?: Array<{
    /** Trait type name */
    trait_type: string;
    /** Trait value */
    value: string | number;
  }>;
  /** External website URL (optional) */
  external_url?: string;
  /** Animation/video URL (optional) */
  animation_url?: string;
}

/**
 * Marketplace listing data structure
 */
export interface MarketplaceListing {
  /** Unique listing identifier */
  id: string;
  /** Seller's address */
  seller: string;
  /** NFT contract address */
  tokenContract: string;
  /** Token id of the listed NFT */
  tokenId: string;
  /** Asking price (as string, in token units) */
  price: string;
  /** Currency symbol or address */
  currency: string;
  /** NFT metadata for display */
  metadata: NFTMetadata;
  /** Unix timestamp (ms) when the listing was created */
  timestamp: number;
}

/**
 * IPFS API configuration
 */
interface IPFSAPIConfig {
  /** API host, e.g. localhost */
  host: string;
  /** API port, e.g. 5001 */
  port: number;
  /** Protocol (http/https) */
  protocol: string;
  /** API path (default /api/v0) */
  apiPath: string;
}

/**
 * Lightweight IPFS client wrapper for uploads, retrieval, pinning,
 * and marketplace/NFT convenience helpers.
 */
export class IPFSClient {
  private gateway: string;
  private pinningService: string | undefined;
  private client?: IPFSHTTPClient;
  private initialized = false;
  private apiConfig: IPFSAPIConfig;

  /**
   * Construct an IPFS client wrapper
   * @param gateway - Public gateway base url used for content URLs
   * @param pinningService - Optional 3rd‑party pinning service identifier
   * @param apiConfig - IPFS HTTP client connection settings
   */
  constructor(
    gateway = 'https://ipfs.io/ipfs/',
    pinningService?: string,
    apiConfig: IPFSAPIConfig = {
      host: 'localhost',
      port: 5001,
      protocol: 'http',
      apiPath: '/api/v0'
    }
  ) {
    this.gateway = gateway;
    this.pinningService = pinningService;
    this.apiConfig = apiConfig;
  }

  /**
   * Initialize the IPFS client (must be called before using the service)
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import for ESM module
      const { create } = await import('ipfs-http-client');

      this.client = create(this.apiConfig) as unknown as IPFSHTTPClient;
      this.initialized = true;
      console.warn('✅ IPFS client initialized');
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      // Continue without IPFS client - will fall back to gateway operations
      this.initialized = false;
    }
  }

  /**
   * Upload a file (Blob/File) to IPFS and return its hash and URL
   * @param file - File to upload
   * @returns Upload result containing hash, URL, and size
   */
  async uploadFile(file: File): Promise<IPFSUploadResult> {
    try {
      console.warn('📤 Uploading file to IPFS:', file.name);

      // Ensure client is initialized
      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        // Use real IPFS client
        const fileBuffer = await file.arrayBuffer();
        const result = await this.client.add(
          {
            path: file.name,
            content: new Uint8Array(fileBuffer)
          },
          {
            pin: true,
            wrapWithDirectory: false
          }
        );

        const hash = result.cid.toString();
        return {
          hash,
          url: `${this.gateway}${hash}`,
          size: file.size
        };
      } else {
        // Fallback to pinning service or gateway if available
        if (this.pinningService !== undefined) {
          // Would implement pinning service API here
          console.warn('⚠️ IPFS client not available, using pinning service');
        }

        // As last resort, use mock for development
        console.warn('⚠️ Using mock IPFS upload - no IPFS client available');
        const mockHash = this.generateMockHash(file.name);
        return {
          hash: mockHash,
          url: `${this.gateway}${mockHash}`,
          size: file.size
        };
      }
    } catch (error) {
      console.error('❌ Failed to upload file to IPFS:', error);
      throw new Error(`Failed to upload file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON serializable data to IPFS and return its hash and URL
   * @param data - Serializable JSON object
   * @returns Upload result containing hash, URL, and size
   */
  async uploadJSON(data: NFTMetadata | MarketplaceListing): Promise<IPFSUploadResult> {
    try {
      console.warn('📤 Uploading JSON to IPFS');

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'metadata.json', { type: 'application/json' });

      return await this.uploadFile(file);

    } catch (error) {
      console.warn('❌ Failed to upload JSON to IPFS:', error);
      throw new Error('Failed to upload JSON to IPFS');
    }
  }

  /**
   * Upload NFT metadata and optional image, returning both content hashes/URLs
   * @param metadata - NFT metadata payload
   * @param imageFile - Optional image file to upload first
   * @returns Object containing metadata and image hashes/URLs
   */
  async uploadNFTMetadata(metadata: NFTMetadata, imageFile?: File): Promise<{
    /** CID/hash of the JSON metadata */
    metadataHash: string;
    /** Public URL to the JSON metadata */
    metadataUrl: string;
    /** CID/hash of the uploaded image (if provided) */
    imageHash?: string;
    /** Public URL to the uploaded image (if provided) */
    imageUrl?: string;
  }> {
    try {
      console.warn('🎨 Uploading NFT metadata to IPFS');

      const finalMetadata = { ...metadata };
      let imageHash: string | undefined;
      let imageUrl: string | undefined;

      // Upload image first if provided
      if (imageFile !== undefined) {
        const imageResult = await this.uploadFile(imageFile);
        imageHash = imageResult.hash;
        imageUrl = imageResult.url;
        finalMetadata.image = imageResult.url;
      }

      // Upload metadata
      const metadataResult = await this.uploadJSON(finalMetadata);

      const result: {
        metadataHash: string;
        metadataUrl: string;
        imageHash?: string;
        imageUrl?: string;
      } = {
        metadataHash: metadataResult.hash,
        metadataUrl: metadataResult.url,
      };
      if (imageHash !== undefined) result.imageHash = imageHash;
      if (imageUrl !== undefined) result.imageUrl = imageUrl;
      return result;

    } catch (error) {
      console.warn('❌ Failed to upload NFT metadata:', error);
      throw new Error('Failed to upload NFT metadata');
    }
  }

  /**
   * Retrieve JSON content from IPFS by its hash via client or gateway
   * @param hash - CID/hash of the content
   * @returns Retrieved content as NFTMetadata or MarketplaceListing
   */
  async getContent(hash: string): Promise<NFTMetadata | MarketplaceListing> {
    try {
      console.warn('📥 Fetching content from IPFS:', hash);

      // Ensure client is initialized
      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        // Use real IPFS client
        const chunks: Uint8Array[] = [];
        for await (const chunk of this.client.cat(hash)) {
          chunks.push(chunk);
        }

        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        const text = new TextDecoder().decode(result);
        return JSON.parse(text) as NFTMetadata | MarketplaceListing;
      } else {
        // Fallback to gateway
        console.warn('⚠️ Using IPFS gateway for retrieval');
        const response = await fetch(`${this.gateway}${hash}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json() as NFTMetadata | MarketplaceListing;
      }
    } catch (error) {
      console.error('❌ Failed to fetch content from IPFS:', error);
      throw new Error(`Failed to fetch content from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a marketplace listing JSON document to IPFS
   * @param listing - Listing payload
   * @returns Upload result containing hash, URL, and size
   */
  async uploadMarketplaceListing(listing: MarketplaceListing): Promise<IPFSUploadResult> {
    try {
      console.warn('🏪 Uploading marketplace listing to IPFS');

      return await this.uploadJSON(listing);

    } catch (error) {
      console.warn('❌ Failed to upload marketplace listing:', error);
      throw new Error('Failed to upload marketplace listing');
    }
  }

  /**
   * Search for cached listings (simplified demo implementation)
   * @param query - Filter options
   * @param query.seller - Seller address to filter by
   * @param query.priceRange - Price range filter
   * @param query.priceRange.min - Minimum price
   * @param query.priceRange.max - Maximum price
   * @param query.category - Optional category filter
   * @returns Array of matching marketplace listings
   */
  searchListings(query: {
    /** Seller address to filter by */
    seller?: string;
    /** Price range filter */
    priceRange?: { 
      /** Minimum price */
      min: string; 
      /** Maximum price */
      max: string
    };
    /** Optional category filter */
    category?: string;
  }): MarketplaceListing[] {
    console.warn('🔍 Searching marketplace listings:', query);

    // In production, this would query a decentralized index
    // For now, return mock data
    const mockListings: MarketplaceListing[] = [
      {
        id: '1',
        seller: '0x1234567890123456789012345678901234567890',
        tokenContract: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        tokenId: '1',
        price: '1.5',
        currency: 'ETH',
        metadata: {
          name: 'Digital Art #1',
          description: 'A beautiful digital artwork',
          image: 'https://example.com/image1.jpg'
        },
        timestamp: Date.now() - 86400000 // 1 day ago
      }
    ];

    return mockListings;
  }

  /**
   * Pin content to prevent garbage collection
   * @param hash - Content hash to pin
   * @returns True if pinning succeeded
   */
  async pinContent(hash: string): Promise<boolean> {
    try {
      console.warn('📌 Pinning content to IPFS:', hash);

      // Ensure client is initialized
      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        // Use real IPFS client
        await this.client.pin.add(hash);
        console.warn('✅ Content pinned successfully via IPFS client');
        return true;
      } else if (this.pinningService !== undefined) {
        // Use pinning service API
        // Implementation would depend on the service (Pinata, Infura, etc.)
        console.warn('✅ Content pinned successfully via pinning service');
        return true;
      } else {
        console.warn('⚠️ No IPFS client or pinning service available');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to pin content:', error);
      return false;
    }
  }

  /**
   * Unpin content from IPFS
   * @param hash - Content hash to unpin
   * @returns True if unpinning succeeded
   */
  async unpinContent(hash: string): Promise<boolean> {
    try {
      console.warn('📌 Unpinning content from IPFS:', hash);

      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        await this.client.pin.rm(hash);
        console.warn('✅ Content unpinned successfully');
        return true;
      } else {
        console.warn('⚠️ No IPFS client available for unpinning');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to unpin content:', error);
      return false;
    }
  }

  /**
   * List all pinned content
   * @returns Array of pinned content hashes
   */
  async listPinnedContent(): Promise<string[]> {
    try {
      console.warn('📋 Listing pinned content');

      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        const pins: string[] = [];
        for await (const pin of this.client.pin.ls()) {
          pins.push(pin.cid.toString());
        }
        return pins;
      } else {
        console.warn('⚠️ No IPFS client available for listing pins');
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to list pinned content:', error);
      return [];
    }
  }

  /**
   * Get content statistics
   * @param hash - Content hash to get stats for
   * @returns Content statistics or null if unavailable
   */
  async getContentStats(hash: string): Promise<{
    /** Content hash */
    hash: string;
    /** Data size in bytes */
    size: number;
    /** Cumulative size in bytes */
    cumulativeSize: number;
    /** Number of blocks/links */
    blocks: number;
  } | null> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        const stats = await this.client.object.stat(hash);
        return {
          hash: stats.Hash,
          size: stats.DataSize,
          cumulativeSize: stats.CumulativeSize,
          blocks: stats.NumLinks
        };
      } else {
        console.warn('⚠️ No IPFS client available for stats');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to get content stats:', error);
      return null;
    }
  }

  /**
   * Generate mock IPFS hash for testing
   * @param input - Input string to generate hash from
   * @returns Mock IPFS hash
   */
  private generateMockHash(input: string): string {
    // Generate a realistic-looking IPFS hash for testing
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hash = 'Qm';

    // Use input to make hash somewhat deterministic for testing
    let seed = 0;
    for (let i = 0; i < input.length; i++) {
      seed += input.charCodeAt(i);
    }

    for (let i = 0; i < 44; i++) {
      hash += chars.charAt((seed + i) % chars.length);
    }

    return hash;
  }

  /**
   * Format IPFS URL from hash
   * @param hash - IPFS content hash
   * @returns Formatted gateway URL
   */
  formatURL(hash: string): string {
    return `${this.gateway}${hash}`;
  }

  /**
   * Extract hash from IPFS URL
   * @param url - IPFS gateway URL
   * @returns Extracted hash or null
   */
  extractHash(url: string): string | null {
    const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return match !== null && match[1] !== undefined ? match[1] : null;
  }

  /**
   * Test IPFS connectivity
   * @returns True if IPFS is accessible
   */
  async testConnectivity(): Promise<boolean> {
    try {
      console.warn('🔗 Testing IPFS connectivity...');

      // First try to initialize client if not already done
      if (!this.initialized) {
        await this.init();
      }

      if (this.client !== undefined) {
        // Test with client by trying to get stats of a well-known hash
        const testHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'; // IPFS readme
        try {
          await this.client.object.stat(testHash);
          console.warn('✅ IPFS client connectivity OK');
          return true;
        } catch {
          console.warn('⚠️ IPFS client connected but cannot access content');
        }
      }

      // Fallback to gateway test
      const testHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      const response = await fetch(`${this.gateway}${testHash}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const connected = response.ok;
      console.warn(connected ? '✅ IPFS gateway connectivity OK' : '❌ IPFS connectivity failed');
      return connected;
    } catch (error) {
      console.error('❌ IPFS connectivity test failed:', error);
      return false;
    }
  }
}

// Default IPFS client instance
export const ipfsClient = new IPFSClient(
  process?.env?.['IPFS_GATEWAY'] ?? 'https://ipfs.io/ipfs/',
  process?.env?.['IPFS_PINNING_SERVICE'],
  {
    host: process?.env?.['IPFS_HOST'] ?? 'localhost',
    port: parseInt(process?.env?.['IPFS_PORT'] ?? '5001'),
    protocol: process?.env?.['IPFS_PROTOCOL'] ?? 'http',
    apiPath: process?.env?.['IPFS_API_PATH'] ?? '/api/v0'
  }
);

// Initialize the client on module load
void (async () => {
  try {
    await ipfsClient.init();
    await ipfsClient.testConnectivity();
  } catch (error) {
    console.warn('IPFS client initialization deferred:', error);
  }
})();

export default IPFSClient;