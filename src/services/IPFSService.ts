/**
 * IPFSService - IPFS Service
 * 
 * Provides IPFS storage and retrieval operations.
 */

import { OmniValidatorClient, createOmniValidatorClient } from '../../../Validator/dist/client/index';
import { WalletService } from './WalletService';

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
  private validatorClient?: OmniValidatorClient;
  private walletService?: WalletService;

  /**
   * Creates a new IPFSService instance
   * @param walletService - Optional wallet service instance
   */
  constructor(walletService?: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Initialize the IPFS service
   * @returns Promise that resolves when initialized
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize wallet service if needed
      if (this.walletService && !this.walletService.isServiceInitialized()) {
        await this.walletService.init();
      }

      // Initialize validator client
      try {
        this.validatorClient = createOmniValidatorClient({
          validatorEndpoint: process.env.VALIDATOR_ENDPOINT || 'http://localhost:4000',
          wsEndpoint: process.env.VALIDATOR_WS_ENDPOINT || 'ws://localhost:4000/graphql'
        });
        // Note: OmniValidatorClient doesn't have a connect() method - it connects automatically
      } catch (error) {
        console.warn('Failed to connect to validator client, IPFS features may be limited', error);
        // Continue without validator client - some features may be unavailable
      }

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
    // Connection is handled by the validator client
  }

  /**
   * Disconnect from IPFS network
   * @returns Promise that resolves when disconnected
   */
  async disconnect(): Promise<void> {
    if (this.validatorClient) {
      await this.validatorClient.disconnect();
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
    if (!this.isInitialized || !this.validatorClient) {
      throw new Error('IPFS service not initialized');
    }

    // Convert file to base64 for transmission
    let base64Data: string;
    let fileData: ArrayBuffer;

    if (file instanceof File) {
      fileData = await file.arrayBuffer();
    } else if (file instanceof ArrayBuffer) {
      fileData = file;
    } else {
      fileData = new TextEncoder().encode(file).buffer;
    }

    // Convert to base64
    const bytes = new Uint8Array(fileData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64Data = btoa(binary);

    // Upload through validator storage service
    const result = await this.validatorClient.request({
      method: 'storage.upload',
      params: {
        data: base64Data,
        metadata: {
          name: options?.name || 'untitled',
          type: options?.type || 'application/octet-stream',
          ...options?.metadata
        }
      }
    });

    return result.hash;
  }

  /**
   * Upload metadata to IPFS
   * @param metadata - Metadata object to upload
   * @returns IPFS hash
   */
  async uploadMetadata(metadata: Record<string, unknown>): Promise<string> {
    if (!this.isInitialized || !this.validatorClient) {
      throw new Error('IPFS service not initialized');
    }

    // Serialize metadata to JSON
    const jsonData = JSON.stringify(metadata, null, 2);

    // Upload as JSON file
    return this.uploadFile(jsonData, {
      name: 'metadata.json',
      type: 'application/json'
    });
  }

  /**
   * Download file from IPFS
   * @param hash - IPFS hash to download
   * @returns File data
   */
  async downloadFile(hash: string): Promise<IPFSFileData> {
    if (!this.isInitialized || !this.validatorClient) {
      throw new Error('IPFS service not initialized');
    }

    try {
      // Download through validator storage service
      const result = await this.validatorClient.request({
        method: 'storage.download',
        params: { hash }
      });

      // Convert base64 back to ArrayBuffer
      const binary = atob(result.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      return {
        data: bytes.buffer,
        metadata: result.metadata || {}
      };
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    this.validatorClient = undefined;
    this.walletService = undefined;
  }
}