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
  /**
   *
   */
  type: ProviderType;
  /**
   *
   */
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

  /**
   *
   * @param toWindow
   * @param _options
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

  /**
   *
   * @param node
   * @param _options
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
  /**
   *
   */
  mintNFT(metadata: { name: string; description: string; image: string }): Promise<string>;
  /**
   *
   */
  transferNFT(tokenId: string, to: string): Promise<string>;
  /**
   *
   */
  getNFTCollection(address: string): Promise<NFTCollection[]>;
  /**
   *
   */
  createMarketplaceListing(tokenId: string, price: string): Promise<string>;
}

/**
 * Interface for payment operations across different blockchains
 */
export interface PaymentProviderInterface {
  /**
   *
   */
  initiatePayment(amount: string, to: string, token?: string): Promise<string>;
  /**
   *
   */
  getPaymentHistory(address: string): Promise<{ hash: string; amount: string; timestamp: number }[]>;
  /**
   *
   */
  estimateGas(transaction: { to: string; value?: string; data?: string }): Promise<string>;
  /**
   *
   */
  swapTokens(fromToken: string, toToken: string, amount: string): Promise<string>;
}

/**
 * Interface for privacy-enhanced transactions using COTI
 */
export interface PrivacyProviderInterface {
  /**
   *
   */
  createPrivateTransaction(params: { to: string; amount: string }): Promise<string>;
  /**
   *
   */
  getPrivateBalance(address: string): Promise<string>;
  /**
   *
   */
  enablePrivacyMode(): Promise<void>;
  /**
   *
   */
  disablePrivacyMode(): Promise<void>;
}

/**
 * Main provider interface for OmniBazaar marketplace functionality
 * Extends base provider with marketplace-specific methods
 */
export interface OmniBazaarProviderInterface extends BackgroundProviderInterface {
  /**
   *
   */
  nftProvider: NFTProviderInterface;
  /**
   *
   */
  paymentProvider: PaymentProviderInterface;
  /**
   *
   */
  privacyProvider?: PrivacyProviderInterface;

  // Marketplace methods
  /**
   *
   */
  createListing(nftData: { tokenId: string; contractAddress: string }, price: string): Promise<string>;
  /**
   *
   */
  purchaseItem(listingId: string): Promise<string>;
  /**
   *
   */
  searchMarketplace(query: string): Promise<{ id: string; name: string; price: string }[]>;

  // Node discovery methods
  /**
   *
   */
  discoverNodes(): Promise<string[]>;
  /**
   *
   */
  connectToNode(nodeUrl: string): Promise<boolean>;

  // IPFS methods
  /**
   *
   */
  uploadToIPFS(data: Record<string, unknown>): Promise<string>;
  /**
   *
   */
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
  /**
   *
   */
  chainId: string;
  /**
   *
   */
  networkVersion: string;
  /**
   *
   */
  selectedAddress: string | null;
}

/**
 * Bitcoin-specific provider interface
 */
export interface BitcoinProviderInterface extends BackgroundProviderInterface {
  /**
   *
   */
  network: 'mainnet' | 'testnet';
  /**
   *
   */
  addressType: 'legacy' | 'segwit' | 'native_segwit';
}

/**
 * Solana-specific provider interface
 */
export interface SolanaProviderInterface extends BackgroundProviderInterface {
  /**
   *
   */
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  /**
   *
   */
  publicKey: string | null;
}

/**
 * Polkadot-specific provider interface
 */
export interface PolkadotProviderInterface extends BackgroundProviderInterface {
  /**
   *
   */
  accounts: string[];
  /**
   *
   */
  metadata: Record<string, unknown>;
}

/**
 * COTI-specific provider interface with privacy features
 */
export interface COTIProviderInterface extends BackgroundProviderInterface {
  /**
   *
   */
  privacyEnabled: boolean;
  /**
   *
   */
  mpcEnabled: boolean;
}
