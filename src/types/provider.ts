/**
 * OmniBazaar Wallet Provider Types
 * Adapted from Enkrypt provider interfaces for our hybrid architecture
 */

import EventEmitter from 'eventemitter3';
import { BaseNetwork } from './base-network';
import { NFTCollection } from './nft';

/**
 * Supported blockchain provider names
 */
export enum ProviderName {
  OMNIBAZAAR = 'omnibazaar',
  ETHEREUM = 'ethereum',
  BITCOIN = 'bitcoin',
  POLKADOT = 'polkadot',
  SOLANA = 'solana',
  COTI = 'coti',
}

/**
 * Categories of blockchain providers by consensus mechanism
 */
export enum ProviderType {
  EVM,
  SUBSTRATE,
  BITCOIN,
  SOLANA,
  COTI,
}

/**
 * Internal storage namespaces for wallet data segregation
 */
export enum InternalStorageNamespace {
  KEYRING = 'KeyRing',
  ACCOUNTS = 'Accounts',
  NFT_STATE = 'NFTState',
  NETWORKS_STATE = 'NetworksState',
  SETTINGS_STATE = 'SettingsState',
  TOKENS_STATE = 'TokensState',
  MARKETPLACE_STATE = 'MarketplaceState',
  PRIVACY_STATE = 'PrivacyState',
  PAYMENT_STATE = 'PaymentState',
}

/**
 * Union type for all supported storage namespaces
 */
export type StorageNamespace = ProviderName | InternalStorageNamespace;

/**
 * Standard RPC request format for provider communication
 */
export interface ProviderRPCRequest {
  /** Request identifier */
  id: string | number;
  /** RPC method name */
  method: string;
  /** Method parameters */
  params?: unknown[];
  /** Request options including tab info */
  options?: {
    url: string;
    domain: string;
    faviconURL: string;
    title: string;
    tabId: number;
  };
}

/**
 * Standard response format for provider messages
 */
export interface OnMessageResponse {
  /** Response result data */
  result?: string;
  /** Error message if request failed */
  error?: string;
}

/**
 * Configuration options for provider initialization
 */
export interface ProviderOptions {
  /** Provider name identifier */
  name: ProviderName;
  /** Provider type classification */
  type: ProviderType;
  /** Message handler for provider communication */
  sendMessageHandler: SendMessageHandler;
}

/**
 * Function type for sending messages between providers
 * @param provider - Target provider name
 * @param message - Message payload to send
 * @returns Promise resolving to the response
 */
export type SendMessageHandler = (
  provider: ProviderName,
  message: string,
) => Promise<unknown>;

/**
 * Middleware function for processing RPC requests
 * @param request - The RPC request to process
 * @returns Promise resolving to the processed request
 */
export interface MiddlewareFunction {
  (request: ProviderRPCRequest): Promise<ProviderRPCRequest>;
}

/**
 * Abstract base class for blockchain providers running in background
 * Handles RPC communication and event management
 */
export abstract class BackgroundProviderInterface extends EventEmitter {
  abstract namespace: string;
  // Not abstract to allow assignment in base constructor
  toWindow: (message: string) => void;
  middlewares: MiddlewareFunction[] = [];

  /** Create a new background provider instance
   * @param toWindow - Function to send messages to window
   * @param _options - Optional configuration
   */
  constructor(toWindow: (message: string) => void, _options?: unknown) {
    super();
    this.toWindow = toWindow;
  }

  abstract setRequestProvider(network: BaseNetwork): void;
  abstract request(request: ProviderRPCRequest): Promise<OnMessageResponse>;
  abstract getUIPath(page: string): string;
  abstract isPersistentEvent(request: ProviderRPCRequest): Promise<boolean>;
  abstract sendNotification(notif: string): Promise<void>;
}

/**
 * Abstract base class for chain-specific API interactions
 * Provides core blockchain functionality
 */
export abstract class ProviderAPIInterface {
  // Not abstract to allow assignment in base constructor
  node: string;

  /** Create a new provider API instance
   * @param node - Node URL to connect to
   * @param _options - Optional configuration
   */
  constructor(node: string, _options?: unknown) {
    this.node = node;
  }

  abstract init(): Promise<void>;
  abstract getBalance(address: string): Promise<string>;
  abstract getTransactionStatus(hash: string): Promise<{ status: string; confirmations: number }>;
}

/**
 * Interface for NFT-related operations in the marketplace
 */
export interface NFTProviderInterface {
  /** Mint a new NFT with metadata */
  mintNFT(metadata: { name: string; description: string; image: string }): Promise<string>;
  /** Transfer NFT to another address */
  transferNFT(tokenId: string, to: string): Promise<string>;
  /** Get NFT collections for an address */
  getNFTCollection(address: string): Promise<NFTCollection[]>;
  /** Create a marketplace listing for an NFT */
  createMarketplaceListing(tokenId: string, price: string): Promise<string>;
}

/**
 * Interface for payment operations across different blockchains
 */
export interface PaymentProviderInterface {
  /** Initiate a payment transaction */
  initiatePayment(amount: string, to: string, token?: string): Promise<string>;
  /** Get payment history for an address */
  getPaymentHistory(address: string): Promise<{ hash: string; amount: string; timestamp: number }[]>;
  /** Estimate gas cost for a transaction */
  estimateGas(transaction: { to: string; value?: string; data?: string }): Promise<string>;
  /** Swap tokens through DEX integration */
  swapTokens(fromToken: string, toToken: string, amount: string): Promise<string>;
}

/**
 * Interface for privacy-enhanced transactions using COTI
 */
export interface PrivacyProviderInterface {
  /** Create a privacy-enhanced transaction */
  createPrivateTransaction(params: { to: string; amount: string }): Promise<string>;
  /** Get private balance using COTI privacy features */
  getPrivateBalance(address: string): Promise<string>;
  /** Enable privacy mode for transactions */
  enablePrivacyMode(): Promise<void>;
  /** Disable privacy mode */
  disablePrivacyMode(): Promise<void>;
}

/**
 * Main provider interface for OmniBazaar marketplace functionality
 * Extends base provider with marketplace-specific methods
 */
export interface OmniBazaarProviderInterface extends BackgroundProviderInterface {
  /** NFT operations provider */
  nftProvider: NFTProviderInterface;
  /** Payment operations provider */
  paymentProvider: PaymentProviderInterface;
  /** Optional privacy operations provider */
  privacyProvider?: PrivacyProviderInterface;

  // Marketplace methods
  /** Create a new marketplace listing */
  createListing(nftData: { tokenId: string; contractAddress: string }, price: string): Promise<string>;
  /** Purchase an item from the marketplace */
  purchaseItem(listingId: string): Promise<string>;
  /** Search marketplace listings */
  searchMarketplace(query: string): Promise<{ id: string; name: string; price: string }[]>;

  // Node discovery methods
  /** Discover available listing nodes */
  discoverNodes(): Promise<string[]>;
  /** Connect to a specific listing node */
  connectToNode(nodeUrl: string): Promise<boolean>;

  // IPFS methods
  /** Upload data to IPFS */
  uploadToIPFS(data: Record<string, unknown>): Promise<string>;
  /** Retrieve data from IPFS */
  getFromIPFS(hash: string): Promise<Record<string, unknown>>;
}

/**
 * Union type for all supported blockchain providers
 */
export type Provider =
  | EthereumProviderInterface
  | BitcoinProviderInterface
  | SolanaProviderInterface
  | PolkadotProviderInterface
  | COTIProviderInterface;

/**
 * Ethereum-specific provider interface
 */
export interface EthereumProviderInterface extends BackgroundProviderInterface {
  /** Current Ethereum chain ID */
  chainId: string;
  /** Network version string */
  networkVersion: string;
  /** Currently selected wallet address */
  selectedAddress: string | null;
}

/**
 * Bitcoin-specific provider interface
 */
export interface BitcoinProviderInterface extends BackgroundProviderInterface {
  /** Bitcoin network type */
  network: 'mainnet' | 'testnet';
  /** Bitcoin address format */
  addressType: 'legacy' | 'segwit' | 'native_segwit';
}

/**
 * Solana-specific provider interface
 */
export interface SolanaProviderInterface extends BackgroundProviderInterface {
  /** Solana cluster endpoint */
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  /** Current public key */
  publicKey: string | null;
}

/**
 * Polkadot-specific provider interface
 */
export interface PolkadotProviderInterface extends BackgroundProviderInterface {
  /** Available Polkadot accounts */
  accounts: string[];
  /** Chain metadata */
  metadata: Record<string, unknown>;
}

/**
 * COTI-specific provider interface with privacy features
 */
export interface COTIProviderInterface extends BackgroundProviderInterface {
  /** Whether privacy features are enabled */
  privacyEnabled: boolean;
  /** Whether MPC (Multi-Party Computation) is enabled */
  mpcEnabled: boolean;
}
