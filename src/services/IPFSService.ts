/**
 * IPFSService - IPFS Service
 * 
 * Provides IPFS storage and retrieval operations.
 */

import { IPFSStorageNetwork } from '../../../Validator/src/services/storage/IPFSStorageNetwork';
import { IPFSNodeManager } from '../../../Validator/src/services/storage/IPFSNodeManager';
import { HeliaIPFSService } from '../../../Validator/src/services/storage/HeliaIPFSService';

/** File upload options */
export interface FileUploadOptions {
  /** File name */
  name?: string;
  /** File type/MIME type */
  type?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** IPFS upload response */
export interface IPFSUploadResponse {
  /** IPFS hash */
  hash: string;
  /** File size */
  size: number;
  /** Upload timestamp */
  timestamp: number;
}

/** IPFS file data */
export interface IPFSFileData {
  /** File content */
  data: ArrayBuffer | string;
  /** File metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Service for interacting with IPFS network
 */
export class IPFSService {
  private isInitialized = false;
  private ipfsNetwork?: IPFSStorageNetwork;
  private nodeManager?: IPFSNodeManager;
  private heliaService?: HeliaIPFSService;

  /**
   * Creates a new IPFSService instance
   */
  constructor() {}

  /**
   * Initialize the IPFS service
   * @returns Promise that resolves when initialized
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Initialize IPFS services
      const { MasterMerkleEngine } = await import('../../../Validator/src/engines/MasterMerkleEngine');
      const merkleEngine = new MasterMerkleEngine();
      
      // Create IPFS node manager
      this.nodeManager = new IPFSNodeManager(merkleEngine);
      
      // Create IPFS storage network
      this.ipfsNetwork = new IPFSStorageNetwork(merkleEngine, {
        nodeId: 'wallet-node',
        enablePinning: true,
        maxStorage: 1024 * 1024 * 1024, // 1GB
        replicationFactor: 3
      });
      
      // Create Helia IPFS service
      this.heliaService = new HeliaIPFSService();
      await this.heliaService.start();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize IPFSService:', error);
      throw error;
    }
  }

  /**
   * Connect to IPFS network
   * @returns Promise that resolves when connected
   */
  async connect(): Promise<void> {
    await this.init();
    
    if (this.nodeManager) {
      await this.nodeManager.startNode();
    }
    
    if (this.ipfsNetwork) {
      await this.ipfsNetwork.start();
    }
  }

  /**
   * Disconnect from IPFS network
   * @returns Promise that resolves when disconnected
   */
  async disconnect(): Promise<void> {
    if (this.ipfsNetwork) {
      await this.ipfsNetwork.stop();
    }
    
    if (this.nodeManager) {
      await this.nodeManager.stopNode();
    }
    
    if (this.heliaService) {
      await this.heliaService.stop();
    }
    
    this.isInitialized = false;
  }

  /**
   * Upload file to IPFS
   * @param file - File data to upload
   * @param options - Upload options
   * @returns IPFS hash of uploaded file
   */
  async uploadFile(file: File | ArrayBuffer | string, options?: FileUploadOptions): Promise<string> {
    if (!this.heliaService) {
      throw new Error('IPFS service not initialized');
    }
    
    // Convert file to Uint8Array
    let data: Uint8Array;
    if (file instanceof File) {
      const buffer = await file.arrayBuffer();
      data = new Uint8Array(buffer);
    } else if (file instanceof ArrayBuffer) {
      data = new Uint8Array(file);
    } else {
      data = new TextEncoder().encode(file);
    }
    
    // Upload through Helia service
    const cid = await this.heliaService.add(data);
    
    // Store metadata if provided
    if (options?.metadata && this.ipfsNetwork) {
      await this.ipfsNetwork.storeFile({
        content: data,
        metadata: {
          name: options.name || 'untitled',
          type: options.type || 'application/octet-stream',
          ...options.metadata
        }
      });
    }
    
    return cid.toString();
  }

  /**
   * Upload metadata to IPFS
   * @param metadata - Metadata object to upload
   * @returns IPFS hash
   */
  async uploadMetadata(metadata: Record<string, unknown>): Promise<string> {
    if (!this.heliaService) {
      throw new Error('IPFS service not initialized');
    }
    
    // Serialize metadata to JSON
    const jsonData = JSON.stringify(metadata, null, 2);
    const data = new TextEncoder().encode(jsonData);
    
    // Upload through Helia service
    const cid = await this.heliaService.add(data);
    
    return cid.toString();
  }

  /**
   * Download file from IPFS
   * @param hash - IPFS hash to download
   * @returns File data
   */
  async downloadFile(hash: string): Promise<IPFSFileData> {
    if (!this.heliaService) {
      throw new Error('IPFS service not initialized');
    }
    
    try {
      // Get file from IPFS
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.heliaService.cat(hash)) {
        chunks.push(chunk);
      }
      
      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Try to get metadata from storage network
      let metadata: Record<string, unknown> = {};
      if (this.ipfsNetwork) {
        const storedFile = await this.ipfsNetwork.getFile(hash);
        if (storedFile?.metadata) {
          metadata = storedFile.metadata;
        }
      }
      
      return {
        data: combined.buffer,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Clear IPFS cache
   * @returns Promise that resolves when cache is cleared
   */
  clearCache(): Promise<void> {
    // console.log('IPFSService cache cleared');
    return Promise.resolve();
  }

  /**
   * Cleanup service and release resources
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    await this.disconnect();
    this.heliaService = undefined;
    this.ipfsNetwork = undefined;
    this.nodeManager = undefined;
  }
}