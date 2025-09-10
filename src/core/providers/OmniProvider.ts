/**
 * OmniProvider - Custom provider for OmniBazaar wallets
 *
 * Connects exclusively to OmniBazaar validators instead of external RPC providers.
 * Features built-in authentication to ensure only our wallets can use our network.
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';

/** Request structure for OmniBazaar validator communication */
interface OmniRequest {
  id: string;
  method: string;
  params: unknown;
  auth: {
    walletId: string;
    signature: string;
    timestamp: number;
    version: string;
  };
}

/** Response structure from OmniBazaar validators */
interface OmniResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  cached?: boolean;
  servedBy?: string;
}

/** Custom provider that connects exclusively to OmniBazaar validators */
export class OmniProvider extends ethers.JsonRpcProvider {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, {
    /** Promise resolve function */
    resolve: (result: unknown) => void;
    /** Promise reject function */
    reject: (error: unknown) => void;
  }>();

  private readonly walletId: string;
  private readonly walletSecret = 'omnibazaar-wallet-v1'; // Must match validator
  private readonly version = '1.0.0';
  private validators: string[] = [];
  private currentValidatorIndex = 0;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  // Track active chain id without mutating base provider internals
  private chainId: number = 1;

  /**
   * Create OmniProvider instance
   * @param walletId Unique wallet identifier (optional)
   */
  constructor(walletId?: string) {
    // Initialize with dummy URL (we override all methods)
    super('http://localhost:8545');

    // Generate or use provided wallet ID
    this.walletId = walletId ?? this.generateWalletId();

    // Load validator endpoints
    this.loadValidatorEndpoints();

    // Connect to validator network
    void this.connect();
  }

  /**
   * Set the active chain id used for validator RPC calls.
   * @param chainId EVM chain id
   */
  setChainId(chainId: number): void {
    this.chainId = chainId;
  }

  /**
   * Generate unique wallet ID
   * @returns Generated wallet ID string
   */
  private generateWalletId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `omni_${timestamp}_${random}`;
  }

  /**
   * Load validator endpoints (would come from discovery service)
   * In production these would be discovered dynamically
   */
  private loadValidatorEndpoints(): void {
    // In production, these would be discovered dynamically
    // For now, use configuration
    this.validators = [
      'wss://validator1.omnibazaar.com:8546',
      'wss://validator2.omnibazaar.com:8546',
      'wss://validator3.omnibazaar.com:8546',
      // Fallback to localhost for development
      'ws://localhost:8546'
    ];
  }

  /**
   * Connect to validator network
   */
  private connect(): void {
    if (this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const endpoint = this.selectValidator();
    
    try {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleMessage(event.data);
        }
      };

      this.ws.onerror = () => {
        // WebSocket error occurred
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

    } catch (error) {
      this.handleDisconnect();
    }
  }

  /**
   * Select best validator endpoint
   * @returns Selected validator endpoint URL
   */
  private selectValidator(): string {
    // Round-robin selection for load balancing
    const validator = this.validators[this.currentValidatorIndex] ?? 'ws://localhost:8546';
    this.currentValidatorIndex = (this.currentValidatorIndex + 1) % this.validators.length;
    return validator;
  }

  /**
   * Handle disconnection and reconnect
   */
  private handleDisconnect(): void {
    this.ws = null;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      setTimeout(() => {
        void this.connect();
      }, delay);
    } else {
      // Reject all pending requests
      this.pendingRequests.forEach((pending) => {
        pending.reject(new Error('Connection lost'));
      });
      this.pendingRequests.clear();
    }
  }

  /**
   * Handle an incoming message from the validator WebSocket.
   * @param data Raw JSON stringified OmniResponse
   */
  private handleMessage(data: string): void {
    try {
      const response = JSON.parse(data) as OmniResponse;

      const pending = this.pendingRequests.get(response.id);
      if (pending === undefined) {
        return;
      }

      this.pendingRequests.delete(response.id);

      if (response.error !== undefined) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }

    } catch (error) {
      // Failed to parse response - ignore invalid messages
    }
  }

  /**
   * Create an authenticated request payload for the validator.
   * @param method RPC method name
   * @param params Method parameters
   * @returns Authenticated request object
   */
  private createRequest(method: string, params: unknown): OmniRequest {
    const id = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    // Create signature for authentication
    const message = `${this.walletId}:${method}:${timestamp}:${this.walletSecret}`;
    const signature = crypto
      .createHmac('sha256', this.walletSecret)
      .update(message)
      .digest('hex');

    return {
      id,
      method,
      params,
      auth: {
        walletId: this.walletId,
        signature,
        timestamp,
        version: this.version
      }
    };
  }

  /**
   * Send a request to a validator and return the parsed result.
   * Handles connection bootstrapping and a 30s timeout for safety.
   * @param method RPC method name
   * @param params Parameters to include in the request
   * @returns Promise resolving to the response result
   */
  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    // Ensure connected
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to validator network');
      }
    }

    const request = this.createRequest(method, params);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });

      // Send request - we know ws is not null at this point
      if (this.ws !== null) {
        this.ws.send(JSON.stringify(request));
      } else {
        reject(new Error('WebSocket connection lost'));
        return;
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // Override ethers.js methods to use our validator network

  /**
   * Get native balance for an address.
   * @param address Wallet address to check balance for
   * @param blockTag Block tag to query (defaults to 'latest')
   * @returns Promise resolving to balance in wei as bigint
   */
  override async getBalance(address: string, blockTag?: string | number): Promise<bigint> {
    const result = await this.sendRequest('eth_getBalance', [
      address,
      (blockTag !== undefined && blockTag !== null) ? blockTag : 'latest',
      this.chainId
    ]);
    return BigInt(result as string | number | bigint | boolean);
  }

  /**
   * Get transaction count (nonce) for an address.
   * @param address Wallet address to get nonce for
   * @param blockTag Block tag to query (defaults to 'latest')
   * @returns Promise resolving to transaction count
   */
  override async getTransactionCount(address: string, blockTag?: string | number): Promise<number> {
    const result = await this.sendRequest('eth_getTransactionCount', [
      address,
      (blockTag !== undefined && blockTag !== null) ? blockTag : 'latest',
      this.chainId
    ]);
    return result as number;
  }

  /**
   * Execute a call against the current chain.
   * @param transaction Transaction object to execute
   * @param blockTag Block tag to query (defaults to 'latest')
   * @returns Promise resolving to call result
   */
  override async call(transaction: unknown, blockTag?: string | number): Promise<string> {
    const result = await this.sendRequest('eth_call', [
      transaction,
      (blockTag !== undefined && blockTag !== null) ? blockTag : 'latest',
      this.chainId
    ]);
    return result as string;
  }

  /**
   * Estimate gas for a transaction.
   * @param transaction Transaction object to estimate gas for
   * @returns Promise resolving to estimated gas amount
   */
  override async estimateGas(transaction: unknown): Promise<bigint> {
    const result = await this.sendRequest('eth_estimateGas', [
      transaction,
      this.chainId
    ]);
    return BigInt(result as string | number | bigint | boolean);
  }

  /**
   * Broadcast a signed raw transaction and return an Ethers response.
   * @param signedTransaction Signed transaction hex string
   * @returns Promise resolving to transaction response
   */
  override async broadcastTransaction(signedTransaction: string): Promise<ethers.TransactionResponse> {
    // Delegate to base implementation to construct a proper TransactionResponse
    return super.broadcastTransaction(signedTransaction);
  }

  // OmniBazaar-specific methods

  /**
   * Get NFTs for address (uses validator cache)
   * @param address Wallet address to get NFTs for
   * @param chainId Chain ID to query (optional)
   * @returns Promise resolving to array of NFT data
   */
  async getNFTs(address: string, chainId?: number): Promise<unknown[]> {
    const result = await this.sendRequest('omni_getNFTs', {
      address,
      chainId: chainId ?? this.chainId
    });
    return Array.isArray(result) ? result as unknown[] : [];
  }

  /**
   * Get NFT metadata (uses validator cache)
   * @param contract NFT contract address
   * @param tokenId Token ID to get metadata for
   * @param chainId Chain ID to query (optional)
   * @returns Promise resolving to NFT metadata
   */
  async getNFTMetadata(contract: string, tokenId: string, chainId?: number): Promise<unknown> {
    return await this.sendRequest('omni_getNFTMetadata', {
      contract,
      tokenId,
      chainId: chainId ?? this.chainId
    });
  }

  /**
   * Get NFT collections (uses validator cache)
   * @param address Wallet address to get collections for
   * @param chainId Chain ID to query (optional)
   * @returns Promise resolving to array of collection data
   */
  async getCollections(address: string, chainId?: number): Promise<unknown[]> {
    const result = await this.sendRequest('omni_getCollections', {
      address,
      chainId: chainId ?? this.chainId
    });
    return Array.isArray(result) ? result as unknown[] : [];
  }

  /**
   * Get marketplace listings (from validator network)
   * @param params Query parameters for filtering listings
   * @returns Promise resolving to array of marketplace listings
   */
  async getMarketplaceListings(params: unknown): Promise<unknown[]> {
    const result = await this.sendRequest('omni_getMarketplaceListings', params);
    return Array.isArray(result) ? result as unknown[] : [];
  }

  /**
   * Get price oracle data (from validator network)
   * @param tokens Array of token addresses to get prices for
   * @returns Promise resolving to price oracle data
   */
  async getPriceOracle(tokens: string[]): Promise<unknown> {
    return await this.sendRequest('omni_getPriceOracle', { tokens });
  }

  /**
   * Get validator status
   * @returns Promise resolving to validator status information
   */
  async getValidatorStatus(): Promise<unknown> {
    return await this.sendRequest('omni_getValidatorStatus', {});
  }

  /**
   * Send a raw JSON-RPC request to the provider.
   * This method is exposed to allow custom RPC calls.
   * @param method The RPC method to call
   * @param params The parameters for the RPC method
   * @returns Promise resolving to the result of the RPC call
   */
  async send(method: string, params: unknown[] | Record<string, unknown>): Promise<unknown> {
    // For OmniBazaar-specific methods, use our authenticated sendRequest
    if (method.startsWith('omni_')) {
      return await this.sendRequest(method, params);
    }
    // For standard Ethereum methods, delegate to parent class
    return await super.send(method, params) as unknown;
  }

  /**
   * Disconnect from validator network
   */
  disconnect(): void {
    if (this.ws !== null) {
      this.ws.close();
      this.ws = null;
    }

    // Clear pending requests
    this.pendingRequests.forEach((pending) => {
      pending.reject(new Error('Provider disconnected'));
    });
    this.pendingRequests.clear();
  }
}
