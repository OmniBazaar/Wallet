import { create, IPFSHTTPClient } from 'ipfs-http-client';

export interface IPFSConfig {
  gateway: string;
  host?: string;
  port?: number;
  protocol?: string;
  apiPath?: string;
}

export interface UploadResult {
  hash: string;
  size: number;
  path: string;
}

export class IPFSService {
  private client: IPFSHTTPClient;
  private config: IPFSConfig;

  constructor(config: IPFSConfig) {
    this.config = config;
    
    // Default to public IPFS gateway if no host specified
    const clientConfig = {
      host: config.host || 'ipfs.infura.io',
      port: config.port || 5001,
      protocol: config.protocol || 'https',
      apiPath: config.apiPath || '/api/v0'
    };

    this.client = create(clientConfig);
  }

  /**
   * Upload a file to IPFS
   */
  async uploadFile(file: File | Blob, filename?: string): Promise<string> {
    try {
      const fileToUpload = {
        path: filename || 'file',
        content: file
      };

      const result = await this.client.add(fileToUpload, {
        pin: true,
        wrapWithDirectory: false
      });

      return result.cid.toString();
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON data to IPFS
   */
  async uploadJSON(data: Record<string, unknown>, filename = 'data.json'): Promise<string> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      return await this.uploadFile(blob, filename);
    } catch (error) {
      throw new Error(`JSON upload to IPFS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pin content to IPFS (ensure it stays available)
   */
  async pinContent(hash: string): Promise<void> {
    try {
      await this.client.pin.add(hash);
    } catch (error) {
      throw new Error(`IPFS pinning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpinContent(hash: string): Promise<void> {
    try {
      await this.client.pin.rm(hash);
    } catch (error) {
      throw new Error(`IPFS unpinning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get content from IPFS
   */
  async getContent(hash: string): Promise<Uint8Array> {
    try {
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
      
      return result;
    } catch (error) {
      throw new Error(`IPFS retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get JSON content from IPFS
   */
  async getJSON(hash: string): Promise<Record<string, unknown>> {
    try {
      const content = await this.getContent(hash);
      const text = new TextDecoder().decode(content);
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON retrieval from IPFS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if content exists on IPFS
   */
  async contentExists(hash: string): Promise<boolean> {
    try {
      // Try to get the first byte
      const iterator = this.client.cat(hash, { length: 1 });
      await iterator.next();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get gateway URL for content
   */
  getGatewayUrl(hash: string): string {
    // Remove ipfs:// protocol if present
    const cleanHash = hash.replace('ipfs://', '');
    return `${this.config.gateway}/${cleanHash}`;
  }

  /**
   * Get content stats
   */
  async getStats(hash: string): Promise<{
    hash: string;
    size: number;
    cumulativeSize: number;
    blocks: number;
    type: string;
  }> {
    try {
      const stats = await this.client.object.stat(hash);
      return {
        hash: stats.Hash,
        size: stats.DataSize,
        cumulativeSize: stats.CumulativeSize,
        blocks: stats.NumLinks,
        type: 'object'
      };
    } catch (error) {
      throw new Error(`IPFS stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List pinned content
   */
  async listPinned(): Promise<string[]> {
    try {
      const pins: string[] = [];
      for await (const pin of this.client.pin.ls()) {
        pins.push(pin.cid.toString());
      }
      return pins;
    } catch (error) {
      throw new Error(`IPFS pin listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload multiple files to IPFS
   */
  async uploadMultipleFiles(files: Array<{ file: File | Blob; filename: string }>): Promise<UploadResult[]> {
    try {
      const results: UploadResult[] = [];
      
      for (const { file, filename } of files) {
        const hash = await this.uploadFile(file, filename);
        results.push({
          hash,
          size: file.size,
          path: filename
        });
      }
      
      return results;
    } catch (error) {
      throw new Error(`Multiple file upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a directory structure on IPFS
   */
  async uploadDirectory(files: Array<{ path: string; content: File | Blob | string }>): Promise<string> {
    try {
      const filesToAdd = files.map(file => ({
        path: file.path,
        content: file.content
      }));

      const results = await this.client.addAll(filesToAdd, {
        pin: true,
        wrapWithDirectory: true
      });

      // Get the directory hash (last result)
      let directoryHash = '';
      for (const result of results) {
        directoryHash = result.cid.toString();
      }

      return directoryHash;
    } catch (error) {
      throw new Error(`Directory upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 