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
  params: any;
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
  result?: any;
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
    this.connect();
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
  private async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const endpoint = this.selectValidator();
    console.log(`Connecting to OmniBazaar validator: ${endpoint}`);

    try {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        console.log('Connected to OmniBazaar validator network');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('Validator connection error:', error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from validator');
        this.handleDisconnect();
      };

    } catch (error) {
      console.error('Failed to connect to validator:', error);
      this.handleDisconnect();
    }
  }

  /**
   * Select best validator endpoint
   */
  private selectValidator(): string {
    // Round-robin selection for load balancing
    const validator = this.validators[this.currentValidatorIndex];
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
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error('Connection lost'));
      }
      this.pendingRequests.clear();
    }
  }

  /**
   * Handle an incoming message from the validator WebSocket.
   * @param data Raw JSON stringified OmniResponse
   */
  private handleMessage(data: string): void {
    try {
      const response: OmniResponse = JSON.parse(data);

      const pending = this.pendingRequests.get(response.id);
      if (!pending) {
        console.warn('Received response for unknown request:', response.id);
        return;
      }

      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        // Log if data was cached
        if (response.cached) {
          console.debug(`Response served from cache by ${response.servedBy}`);
        }
        pending.resolve(response.result);
      }

    } catch (error) {
      console.error('Failed to parse validator response:', error);
    }
  }

  /**
   * Create an authenticated request payload for the validator.
   * @param method RPC method name
   * @param params Method parameters
   */
  private createRequest(method: string, params: any): OmniRequest {
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
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    // Ensure connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to validator network');
      }
    }

    const request = this.createRequest(method, params);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });

      // Send request
      this.ws!.send(JSON.stringify(request));

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

  /** Get native balance for an address. */
  async getBalance(address: string, blockTag?: string | number): Promise<bigint> {
    const result = await this.sendRequest('eth_getBalance', [
      address,
      blockTag || 'latest',
      this.network.chainId
    ]);
    return BigInt(result);
  }

  /** Get transaction count (nonce) for an address. */
  async getTransactionCount(address: string, blockTag?: string | number): Promise<number> {
    return await this.sendRequest('eth_getTransactionCount', [
      address,
      blockTag || 'latest',
      this.network.chainId
    ]);
  }

  /** Execute a call against the current chain. */
  async call(transaction: any, blockTag?: string | number): Promise<string> {
    return await this.sendRequest('eth_call', [
      transaction,
      blockTag || 'latest',
      this.network.chainId
    ]);
  }

  /** Estimate gas for a transaction. */
  async estimateGas(transaction: any): Promise<bigint> {
    const result = await this.sendRequest('eth_estimateGas', [
      transaction,
      this.network.chainId
    ]);
    return BigInt(result);
  }

  /** Broadcast a signed raw transaction and return an Ethers response. */
  async broadcastTransaction(signedTransaction: string): Promise<ethers.TransactionResponse> {
    const hash = await this.sendRequest('eth_sendRawTransaction', [
      signedTransaction,
      this.network.chainId
    ]);

    // Create transaction response
    return new ethers.TransactionResponse(
      ethers.Transaction.from(signedTransaction),
      this
    );
  }

  // OmniBazaar-specific methods

  /**
   * Get NFTs for address (uses validator cache)
   * @param address
   * @param chainId
   */
  async getNFTs(address: string, chainId?: number): Promise<any[]> {
    return await this.sendRequest('omni_getNFTs', {
      address,
      chainId: chainId || this.network.chainId
    });
  }

  /**
   * Get NFT metadata (uses validator cache)
   * @param contract
   * @param tokenId
   * @param chainId
   */
  async getNFTMetadata(contract: string, tokenId: string, chainId?: number): Promise<any> {
    return await this.sendRequest('omni_getNFTMetadata', {
      contract,
      tokenId,
      chainId: chainId || this.network.chainId
    });
  }

  /**
   * Get NFT collections (uses validator cache)
   * @param address
   * @param chainId
   */
  async getCollections(address: string, chainId?: number): Promise<any[]> {
    return await this.sendRequest('omni_getCollections', {
      address,
      chainId: chainId || this.network.chainId
    });
  }

  /**
   * Get marketplace listings (from validator network)
   * @param params
   */
  async getMarketplaceListings(params: any): Promise<any[]> {
    return await this.sendRequest('omni_getMarketplaceListings', params);
  }

  /**
   * Get price oracle data (from validator network)
   * @param tokens
   */
  async getPriceOracle(tokens: string[]): Promise<any> {
    return await this.sendRequest('omni_getPriceOracle', { tokens });
  }

  /**
   * Get validator status
   */
  async getValidatorStatus(): Promise<any> {
    return await this.sendRequest('omni_getValidatorStatus', {});
  }

  /**
   * Disconnect from validator network
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Provider disconnected'));
    }
    this.pendingRequests.clear();
  }
}
