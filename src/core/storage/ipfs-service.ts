/**
 * IPFS Service for distributed storage
 * IPFS client type - will be loaded dynamically due to ESM module
 */
interface IPFSHTTPClient {
  add: (file: any, options?: any) => Promise<{ cid: { toString: () => string } }>;
  cat: (cid: string) => AsyncIterable<Uint8Array>;
  get: (cid: string) => AsyncIterable<any>;
  pin: {
    add: (cid: string) => Promise<void>;
    rm: (cid: string) => Promise<void>;
  };
}

/** IPFS configuration options */
export interface IPFSConfig {
  /** IPFS gateway URL */
  gateway: string;
  /** IPFS host (optional) */
  host?: string;
  /** IPFS port (optional) */
  port?: number;
  /** Protocol (http/https) (optional) */
  protocol?: string;
  /** API path (optional) */
  apiPath?: string;
}

/** Result of IPFS upload operation */
export interface UploadResult {
  /** IPFS hash/CID */
  hash: string;
  /** File size in bytes */
  size: number;
  /** IPFS path */
  path: string;
}

/** Service for IPFS operations */
export class IPFSService {
  private client?: IPFSHTTPClient;
  private config: IPFSConfig;
  private initialized = false;

  /**
   * Create IPFS service
   * @param config IPFS configuration
   */
  constructor(config: IPFSConfig) {
    this.config = config;
  }

  /**
   * Initialize the IPFS client (must be called before using the service)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import for ESM module
      const { create } = await import('ipfs-http-client');

      // Default to public IPFS gateway if no host specified
      const clientConfig = {
        host: this.config.host ?? 'ipfs.infura.io',
        port: this.config.port ?? 5001,
        protocol: this.config.protocol ?? 'https',
        apiPath: this.config.apiPath ?? '/api/v0'
      };

      this.client = create(clientConfig) as unknown as IPFSHTTPClient;
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      throw error;
    }
  }

  /**
   * Upload a file/blob to IPFS and return its CID string.
   * @param file File or Blob to upload
   * @param filename Optional filename/path used in IPFS
   */
  async uploadFile(file: File | Blob, filename?: string): Promise<string> {
    if (!this.client) {
      await this.init();
    }

    try {
      const fileToUpload = {
        path: filename || 'file',
        content: file
      };

      const result = await this.client!.add(fileToUpload, {
        pin: true,
        wrapWithDirectory: false
      });

      return result.cid.toString();
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a JSON serializable object to IPFS and return CID.
   * @param data JSON-serializable object
   * @param filename Optional filename for the JSON blob
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

  /** Pin content to IPFS to ensure availability. @param hash CID */
  async pinContent(hash: string): Promise<void> {
    try {
      await this.client.pin.add(hash);
    } catch (error) {
      throw new Error(`IPFS pinning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Unpin content from IPFS. @param hash CID */
  async unpinContent(hash: string): Promise<void> {
    try {
      await this.client.pin.rm(hash);
    } catch (error) {
      throw new Error(`IPFS unpinning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Retrieve raw content bytes from IPFS. @param hash CID */
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

  /** Retrieve JSON content from IPFS, decoding UTF‑8. @param hash CID */
  async getJSON(hash: string): Promise<Record<string, unknown>> {
    try {
      const content = await this.getContent(hash);
      const text = new TextDecoder().decode(content);
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON retrieval from IPFS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Check if content exists on IPFS by probing a byte. @param hash CID */
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

  /** Build a public gateway URL for a CID. @param hash CID or ipfs:// URL */
  getGatewayUrl(hash: string): string {
    // Remove ipfs:// protocol if present
    const cleanHash = hash.replace('ipfs://', '');
    return `${this.config.gateway}/${cleanHash}`;
  }

  /** Get content stats from IPFS object API. @param hash CID */
  async getStats(hash: string): Promise<{
    /**
     *
     */
    hash: string;
    /**
     *
     */
    size: number;
    /**
     *
     */
    cumulativeSize: number;
    /**
     *
     */
    blocks: number;
    /**
     *
     */
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

  /** List currently pinned CIDs. */
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
   * Upload multiple files to IPFS and return their CIDs and paths.
   * @param files Array of { file, filename }
   */
  async uploadMultipleFiles(files: Array<{ /**
                                            *
                                            */
    file: File | Blob; /**
                      *
                      */
    filename: string
  }>): Promise<UploadResult[]> {
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
   * Create a directory with multiple paths and contents on IPFS.
   * @param files Array of { path, content }
   * @returns CID of the created directory
   */
  async uploadDirectory(files: Array<{ /**
                                        *
                                        */
    path: string; /**
                 *
                 */
    content: File | Blob | string
  }>): Promise<string> {
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
