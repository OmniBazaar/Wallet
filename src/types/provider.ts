// OmniBazaar Wallet Provider Types
// Adapted from Enkrypt provider interfaces for our hybrid architecture

import EventEmitter from 'eventemitter3';
import { BaseNetwork } from './base-network';
import { NFTCollection } from './nft';

export enum ProviderName {
  OMNIBAZAAR = 'omnibazaar',
  ETHEREUM = 'ethereum',
  BITCOIN = 'bitcoin',
  POLKADOT = 'polkadot',
  SOLANA = 'solana',
  COTI = 'coti',
}

export enum ProviderType {
  EVM,
  SUBSTRATE,
  BITCOIN,
  SOLANA,
  COTI,
}

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

export type StorageNamespace = ProviderName | InternalStorageNamespace;

export interface ProviderRPCRequest {
  id: string | number;
  method: string;
  params?: unknown[];
  options?: {
    url: string;
    domain: string;
    faviconURL: string;
    title: string;
    tabId: number;
  };
}

export interface OnMessageResponse {
  result?: string;
  error?: string;
}

export interface ProviderOptions {
  name: ProviderName;
  type: ProviderType;
  sendMessageHandler: SendMessageHandler;
}

export type SendMessageHandler = (
  provider: ProviderName,
  message: string,
) => Promise<unknown>;

export interface MiddlewareFunction {
  (request: ProviderRPCRequest): Promise<ProviderRPCRequest>;
}

// Abstract base provider interface
export abstract class BackgroundProviderInterface extends EventEmitter {
  abstract namespace: string;
  abstract toWindow: (message: string) => void;
  middlewares: MiddlewareFunction[] = [];

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

// Provider API interface for chain interactions
export abstract class ProviderAPIInterface {
  abstract node: string;
  
  constructor(node: string, _options?: unknown) {
    this.node = node;
  }
  
  abstract init(): Promise<void>;
  abstract getBalance(address: string): Promise<string>;
  abstract getTransactionStatus(hash: string): Promise<{ status: string; confirmations: number }>;
}

// NFT Provider interface for marketplace integration
export interface NFTProviderInterface {
  mintNFT(metadata: { name: string; description: string; image: string }): Promise<string>;
  transferNFT(tokenId: string, to: string): Promise<string>;
  getNFTCollection(address: string): Promise<NFTCollection[]>;
  createMarketplaceListing(tokenId: string, price: string): Promise<string>;
}

// Payment Provider interface for cross-chain payments
export interface PaymentProviderInterface {
  initiatePayment(amount: string, to: string, token?: string): Promise<string>;
  getPaymentHistory(address: string): Promise<{ hash: string; amount: string; timestamp: number }[]>;
  estimateGas(transaction: { to: string; value?: string; data?: string }): Promise<string>;
  swapTokens(fromToken: string, toToken: string, amount: string): Promise<string>;
}

// Privacy Provider interface for COTI integration
export interface PrivacyProviderInterface {
  createPrivateTransaction(params: { to: string; amount: string }): Promise<string>;
  getPrivateBalance(address: string): Promise<string>;
  enablePrivacyMode(): Promise<void>;
  disablePrivacyMode(): Promise<void>;
}

// OmniBazaar-specific provider interface
export interface OmniBazaarProviderInterface extends BackgroundProviderInterface {
  nftProvider: NFTProviderInterface;
  paymentProvider: PaymentProviderInterface;
  privacyProvider?: PrivacyProviderInterface;
  
  // Marketplace methods
  createListing(nftData: { tokenId: string; contractAddress: string }, price: string): Promise<string>;
  purchaseItem(listingId: string): Promise<string>;
  searchMarketplace(query: string): Promise<{ id: string; name: string; price: string }[]>;
  
  // Node discovery methods
  discoverNodes(): Promise<string[]>;
  connectToNode(nodeUrl: string): Promise<boolean>;
  
  // IPFS methods
  uploadToIPFS(data: Record<string, unknown>): Promise<string>;
  getFromIPFS(hash: string): Promise<Record<string, unknown>>;
}

// Chain-specific provider exports
export type Provider = 
  | EthereumProviderInterface 
  | BitcoinProviderInterface 
  | SolanaProviderInterface 
  | PolkadotProviderInterface
  | COTIProviderInterface;

export interface EthereumProviderInterface extends BackgroundProviderInterface {
  chainId: string;
  networkVersion: string;
  selectedAddress: string | null;
}

export interface BitcoinProviderInterface extends BackgroundProviderInterface {
  network: 'mainnet' | 'testnet';
  addressType: 'legacy' | 'segwit' | 'native_segwit';
}

export interface SolanaProviderInterface extends BackgroundProviderInterface {
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  publicKey: string | null;
}

export interface PolkadotProviderInterface extends BackgroundProviderInterface {
  accounts: string[];
  metadata: Record<string, unknown>;
}

export interface COTIProviderInterface extends BackgroundProviderInterface {
  privacyEnabled: boolean;
  mpcEnabled: boolean;
} 