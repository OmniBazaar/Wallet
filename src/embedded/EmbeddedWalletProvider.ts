/**
 * Embedded Wallet Provider
 * 
 * Implements an iframe-based wallet provider that works without browser extension.
 * Uses PostMessage API for cross-origin communication between marketplace and wallet.
 * 
 * @module embedded/EmbeddedWalletProvider
 */

import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Message types for PostMessage communication
 */
export enum MessageType {
  // Requests from parent to iframe
  WALLET_REQUEST = 'WALLET_REQUEST',
  CONNECT_WALLET = 'CONNECT_WALLET',
  DISCONNECT_WALLET = 'DISCONNECT_WALLET',
  
  // Responses from iframe to parent
  WALLET_RESPONSE = 'WALLET_RESPONSE',
  WALLET_EVENT = 'WALLET_EVENT',
  WALLET_ERROR = 'WALLET_ERROR',
  
  // Authentication
  AUTH_REQUEST = 'AUTH_REQUEST',
  AUTH_RESPONSE = 'AUTH_RESPONSE',
  
  // Status
  READY = 'READY',
  PING = 'PING',
  PONG = 'PONG'
}

/**
 * RPC methods supported by the embedded wallet
 */
export enum RPCMethod {
  // Standard Ethereum methods
  ETH_ACCOUNTS = 'eth_accounts',
  ETH_REQUEST_ACCOUNTS = 'eth_requestAccounts',
  ETH_CHAIN_ID = 'eth_chainId',
  ETH_SEND_TRANSACTION = 'eth_sendTransaction',
  ETH_SIGN_TRANSACTION = 'eth_signTransaction',
  ETH_SIGN = 'eth_sign',
  PERSONAL_SIGN = 'personal_sign',
  ETH_SIGN_TYPED_DATA = 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V4 = 'eth_signTypedData_v4',
  
  // Wallet methods
  WALLET_SWITCH_ETHEREUM_CHAIN = 'wallet_switchEthereumChain',
  WALLET_ADD_ETHEREUM_CHAIN = 'wallet_addEthereumChain',
  WALLET_WATCH_ASSET = 'wallet_watchAsset',
  
  // OmniBazaar specific
  OMNI_GET_BALANCE = 'omni_getBalance',
  OMNI_GET_USERNAME = 'omni_getUsername',
  OMNI_SIGN_MESSAGE = 'omni_signMessage'
}

/**
 * Wallet message structure
 */
export interface WalletMessage {
  type: MessageType;
  id: string;
  method?: string;
  params?: any[];
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  event?: string;
  data?: any;
}

/**
 * Authentication methods
 */
export interface AuthMethod {
  type: 'email' | 'sms' | 'google' | 'apple' | 'github' | 'passkey' | 'legacy';
  credential?: string;
  token?: string;
}

/**
 * Wallet connection state
 */
export interface WalletState {
  connected: boolean;
  address?: string;
  username?: string;
  chainId?: string;
  authenticated: boolean;
}

/**
 * Configuration options for embedded wallet
 */
export interface EmbeddedWalletConfig {
  walletUrl?: string;
  allowedOrigins?: string[];
  debug?: boolean;
  autoConnect?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Embedded Wallet Provider
 * 
 * Provides wallet functionality through an embedded iframe without requiring
 * a browser extension. Implements EIP-1193 provider interface.
 */
export class EmbeddedWalletProvider {
  private iframe: HTMLIFrameElement | null = null;
  private walletUrl: string;
  private allowedOrigins: Set<string>;
  private debug: boolean;
  private messageHandlers: Map<string, (message: WalletMessage) => void>;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>;
  private eventListeners: Map<string, Set<Function>>;
  private walletState: WalletState;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;
  private readyResolve?: () => void;
  
  constructor(config: EmbeddedWalletConfig = {}) {
    this.walletUrl = config.walletUrl || 'https://wallet.omnibazaar.com/embed';
    this.allowedOrigins = new Set(config.allowedOrigins || [
      'https://wallet.omnibazaar.com',
      'https://marketplace.omnibazaar.com',
      'https://dex.omnibazaar.com'
    ]);
    this.debug = config.debug || false;
    this.messageHandlers = new Map();
    this.pendingRequests = new Map();
    this.eventListeners = new Map();
    this.walletState = {
      connected: false,
      authenticated: false
    };
    
    // Create ready promise
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    
    // Set up message listener
    this.setupMessageListener();
    
    // Auto-connect if configured
    if (config.autoConnect) {
      this.initialize();
    }
  }
  
  /**
   * Initialize the embedded wallet iframe
   */
  async initialize(): Promise<void> {
    if (this.iframe) {
      this.log('Wallet already initialized');
      return this.readyPromise;
    }
    
    // Create iframe element
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'omniwallet-embedded';
    this.iframe.src = this.walletUrl;
    this.iframe.style.display = 'none';
    this.iframe.style.position = 'fixed';
    this.iframe.style.zIndex = '999999';
    
    // Set security attributes
    this.iframe.setAttribute('allow', 'publickey-credentials-get; publickey-credentials-create');
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
    
    // Append to document
    document.body.appendChild(this.iframe);
    
    // Wait for ready signal
    return this.readyPromise;
  }
  
  /**
   * Set up message listener for PostMessage API
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      // Validate origin
      if (!this.allowedOrigins.has(event.origin)) {
        this.log(`Rejected message from unauthorized origin: ${event.origin}`);
        return;
      }
      
      const message = event.data as WalletMessage;
      this.log('Received message:', message);
      
      // Handle different message types
      switch (message.type) {
        case MessageType.READY:
          this.handleReady();
          break;
          
        case MessageType.WALLET_RESPONSE:
          this.handleResponse(message);
          break;
          
        case MessageType.WALLET_EVENT:
          this.handleEvent(message);
          break;
          
        case MessageType.WALLET_ERROR:
          this.handleError(message);
          break;
          
        case MessageType.PONG:
          this.handlePong(message);
          break;
          
        default:
          this.log('Unknown message type:', message.type);
      }
    });
  }
  
  /**
   * Handle wallet ready signal
   */
  private handleReady(): void {
    this.isReady = true;
    this.log('Wallet is ready');
    
    if (this.readyResolve) {
      this.readyResolve();
    }
    
    // Emit connect event
    this.emit('connect', { chainId: this.walletState.chainId });
  }
  
  /**
   * Handle response from wallet
   */
  private handleResponse(message: WalletMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.log('No pending request for response:', message.id);
      return;
    }
    
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);
    
    if (message.error) {
      pending.reject(message.error);
    } else {
      pending.resolve(message.result);
    }
  }
  
  /**
   * Handle wallet events
   */
  private handleEvent(message: WalletMessage): void {
    if (!message.event) return;
    
    // Update wallet state
    if (message.event === 'accountsChanged' && message.data) {
      this.walletState.address = message.data[0];
      this.walletState.connected = !!message.data[0];
    } else if (message.event === 'chainChanged' && message.data) {
      this.walletState.chainId = message.data;
    }
    
    // Emit to listeners
    this.emit(message.event, message.data);
  }
  
  /**
   * Handle error from wallet
   */
  private handleError(message: WalletMessage): void {
    this.log('Wallet error:', message.error);
    
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);
      pending.reject(message.error);
    }
  }
  
  /**
   * Handle pong response for keepalive
   */
  private handlePong(message: WalletMessage): void {
    this.log('Received pong');
  }
  
  /**
   * Send message to wallet iframe
   */
  private sendMessage(message: WalletMessage): void {
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new Error('Wallet iframe not initialized');
    }
    
    this.log('Sending message:', message);
    this.iframe.contentWindow.postMessage(message, this.walletUrl);
  }
  
  /**
   * Send RPC request to wallet
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    // Ensure wallet is initialized
    if (!this.isReady) {
      await this.initialize();
    }
    
    const id = uuidv4();
    const message: WalletMessage = {
      type: MessageType.WALLET_REQUEST,
      id,
      method: args.method,
      params: args.params || []
    };
    
    return new Promise((resolve, reject) => {
      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${args.method}`));
      }, 30000);
      
      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      // Send message
      this.sendMessage(message);
    });
  }
  
  /**
   * Connect wallet with authentication
   */
  async connect(authMethod?: AuthMethod): Promise<string[]> {
    // Send auth request if method provided
    if (authMethod) {
      const authResult = await this.authenticate(authMethod);
      if (!authResult) {
        throw new Error('Authentication failed');
      }
    }
    
    // Request accounts
    const accounts = await this.request({
      method: RPCMethod.ETH_REQUEST_ACCOUNTS
    });
    
    this.walletState.connected = true;
    this.walletState.address = accounts[0];
    
    return accounts;
  }
  
  /**
   * Authenticate with wallet
   */
  async authenticate(authMethod: AuthMethod): Promise<boolean> {
    const id = uuidv4();
    const message: WalletMessage = {
      type: MessageType.AUTH_REQUEST,
      id,
      data: authMethod
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Authentication timeout'));
      }, 60000); // 60 second timeout for auth
      
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout
      });
      
      this.sendMessage(message);
    });
  }
  
  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    const message: WalletMessage = {
      type: MessageType.DISCONNECT_WALLET,
      id: uuidv4()
    };
    
    this.sendMessage(message);
    
    this.walletState.connected = false;
    this.walletState.address = undefined;
    this.walletState.authenticated = false;
    
    this.emit('disconnect');
  }
  
  /**
   * Show wallet UI (for transaction approval, etc)
   */
  showWallet(): void {
    if (!this.iframe) return;
    
    this.iframe.style.display = 'block';
    this.iframe.style.top = '50%';
    this.iframe.style.left = '50%';
    this.iframe.style.transform = 'translate(-50%, -50%)';
    this.iframe.style.width = '400px';
    this.iframe.style.height = '600px';
    this.iframe.style.border = '1px solid #ccc';
    this.iframe.style.borderRadius = '8px';
    this.iframe.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  }
  
  /**
   * Hide wallet UI
   */
  hideWallet(): void {
    if (!this.iframe) return;
    
    this.iframe.style.display = 'none';
  }
  
  /**
   * Add event listener
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }
  
  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  
  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }
  
  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.walletState.connected;
  }
  
  /**
   * Get current wallet state
   */
  getState(): WalletState {
    return { ...this.walletState };
  }
  
  /**
   * Send ping to keep connection alive
   */
  ping(): void {
    const message: WalletMessage = {
      type: MessageType.PING,
      id: uuidv4()
    };
    this.sendMessage(message);
  }
  
  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[EmbeddedWallet]', ...args);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Wallet destroyed'));
    });
    this.pendingRequests.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Remove iframe
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    
    // Reset state
    this.isReady = false;
    this.walletState = {
      connected: false,
      authenticated: false
    };
  }
}

/**
 * Factory function to create embedded wallet provider
 */
export function createEmbeddedWallet(config?: EmbeddedWalletConfig): EmbeddedWalletProvider {
  return new EmbeddedWalletProvider(config);
}

export default EmbeddedWalletProvider;