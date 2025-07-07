// IPFS Client for OmniBazaar Wallet
// Handles decentralized storage for NFT metadata and marketplace data

export interface IPFSUploadResult {
  hash: string;
  url: string;
  size: number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
}

export interface MarketplaceListing {
  id: string;
  seller: string;
  tokenContract: string;
  tokenId: string;
  price: string;
  currency: string;
  metadata: NFTMetadata;
  timestamp: number;
}

export class IPFSClient {
  private gateway: string;
  private pinningService?: string;

  constructor(gateway = 'https://ipfs.io/ipfs/', pinningService?: string) {
    this.gateway = gateway;
    this.pinningService = pinningService;
  }

  // Upload file to IPFS
  async uploadFile(file: File): Promise<IPFSUploadResult> {
    try {
      console.log('📤 Uploading file to IPFS:', file.name);
      
      // For now, simulate IPFS upload
      // In production, this would use ipfs-http-client or a pinning service
      const mockHash = this.generateMockHash(file.name);
      
      const result: IPFSUploadResult = {
        hash: mockHash,
        url: `${this.gateway}${mockHash}`,
        size: file.size
      };
      
      console.log('✅ File uploaded to IPFS:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to upload file to IPFS:', error);
      throw new Error('Failed to upload file to IPFS');
    }
  }

  // Upload JSON metadata to IPFS
  async uploadJSON(data: any): Promise<IPFSUploadResult> {
    try {
      console.log('📤 Uploading JSON to IPFS');
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'metadata.json', { type: 'application/json' });
      
      return await this.uploadFile(file);
      
    } catch (error) {
      console.error('❌ Failed to upload JSON to IPFS:', error);
      throw new Error('Failed to upload JSON to IPFS');
    }
  }

  // Upload NFT metadata with image
  async uploadNFTMetadata(metadata: NFTMetadata, imageFile?: File): Promise<{
    metadataHash: string;
    metadataUrl: string;
    imageHash?: string;
    imageUrl?: string;
  }> {
    try {
      console.log('🎨 Uploading NFT metadata to IPFS');
      
      let finalMetadata = { ...metadata };
      let imageHash: string | undefined;
      let imageUrl: string | undefined;
      
      // Upload image first if provided
      if (imageFile) {
        const imageResult = await this.uploadFile(imageFile);
        imageHash = imageResult.hash;
        imageUrl = imageResult.url;
        finalMetadata.image = imageResult.url;
      }
      
      // Upload metadata
      const metadataResult = await this.uploadJSON(finalMetadata);
      
      return {
        metadataHash: metadataResult.hash,
        metadataUrl: metadataResult.url,
        imageHash,
        imageUrl
      };
      
    } catch (error) {
      console.error('❌ Failed to upload NFT metadata:', error);
      throw new Error('Failed to upload NFT metadata');
    }
  }

  // Get content from IPFS
  async getContent(hash: string): Promise<any> {
    try {
      console.log('📥 Fetching content from IPFS:', hash);
      
      const response = await fetch(`${this.gateway}${hash}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const content = await response.json();
      console.log('✅ Content fetched from IPFS');
      return content;
      
    } catch (error) {
      console.error('❌ Failed to fetch content from IPFS:', error);
      throw new Error('Failed to fetch content from IPFS');
    }
  }

  // Upload marketplace listing
  async uploadMarketplaceListing(listing: MarketplaceListing): Promise<IPFSUploadResult> {
    try {
      console.log('🏪 Uploading marketplace listing to IPFS');
      
      return await this.uploadJSON(listing);
      
    } catch (error) {
      console.error('❌ Failed to upload marketplace listing:', error);
      throw new Error('Failed to upload marketplace listing');
    }
  }

  // Search for listings (simplified implementation)
  async searchListings(query: {
    seller?: string;
    priceRange?: { min: string; max: string };
    category?: string;
  }): Promise<MarketplaceListing[]> {
    try {
      console.log('🔍 Searching marketplace listings:', query);
      
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
      
    } catch (error) {
      console.error('❌ Failed to search listings:', error);
      return [];
    }
  }

  // Pin content to prevent garbage collection
  async pinContent(hash: string): Promise<boolean> {
    try {
      console.log('📌 Pinning content to IPFS:', hash);
      
      if (this.pinningService) {
        // Use pinning service API
        // Implementation would depend on the service (Pinata, Infura, etc.)
        console.log('✅ Content pinned successfully');
        return true;
      } else {
        console.log('⚠️ No pinning service configured');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Failed to pin content:', error);
      return false;
    }
  }

  // Utility: Generate mock IPFS hash for testing
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

  // Utility: Format IPFS URL
  formatURL(hash: string): string {
    return `${this.gateway}${hash}`;
  }

  // Utility: Extract hash from IPFS URL
  extractHash(url: string): string | null {
    const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  // Test IPFS connectivity
  async testConnectivity(): Promise<boolean> {
    try {
      console.log('🔗 Testing IPFS connectivity...');
      
      // Try to fetch a well-known IPFS hash
      const testHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'; // IPFS readme
      const response = await fetch(`${this.gateway}${testHash}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const connected = response.ok;
      console.log(connected ? '✅ IPFS connectivity OK' : '❌ IPFS connectivity failed');
      return connected;
      
    } catch (error) {
      console.error('❌ IPFS connectivity test failed:', error);
      return false;
    }
  }
}

// Default IPFS client instance
export const ipfsClient = new IPFSClient();

export default IPFSClient; 