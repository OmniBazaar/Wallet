/**
 * OmniBazaar Wallet Base Network Types
 * Adapted from Enkrypt base network interfaces
 */

import { ProviderName } from './provider';

/**
 * Base network configuration interface for all blockchain networks
 */
export interface BaseNetwork {
  /** Network identifier */
  name: string;
  /** Full network name */
  name_long: string;
  /** Network homepage URL */
  homePage: string;
  /** Block explorer transaction URL template */
  blockExplorerTX: string;
  /** Block explorer address URL template */
  blockExplorerAddr: string;
  /** Whether this is a test network */
  isTestNetwork: boolean;
  /** Native currency name */
  currencyName: string;
  /** Network icon identifier */
  icon: string;
  /** RPC node URL */
  node: string;
  /** Chain ID (optional) */
  chainID?: string;
  /** CoinGecko ID for price data (optional) */
  coingeckoID?: string;
  /** Provider type */
  provider: ProviderName;
  /** Function to format addresses for display */
  displayAddress: (address: string) => string;
  /** Function to generate identicon URLs */
  identicon: (address: string, options?: { size?: number; background?: string }) => string;
  /** Base derivation path for HD wallets */
  basePath: string;
}

/**
 * Ethereum-specific network configuration
 */
export interface EthereumNetwork extends BaseNetwork {
  /** Ethereum chain ID */
  chainID: string;
  /** SLIP-44 coin type */
  slip44: number;
  /** ENS resolver contract address (optional) */
  ensResolver?: string;
  /** Multicall contract address (optional) */
  multicall?: string;
}

/**
 * Bitcoin-specific network configuration
 */
export interface BitcoinNetwork extends BaseNetwork {
  /** Bitcoin network type */
  networkType: 'mainnet' | 'testnet';
  /**
   *
   */
  bech32: string;
  /**
   *
   */
  pubKeyHash: number;
  /**
   *
   */
  scriptHash: number;
  /**
   *
   */
  wif: number;
}

/**
 * Solana-specific network configuration
 */
export interface SolanaNetwork extends BaseNetwork {
  /**
   *
   */
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  /**
   *
   */
  programId?: string;
}

/**
 * Polkadot-specific network configuration
 */
export interface PolkadotNetwork extends BaseNetwork {
  /**
   *
   */
  genesisHash: string;
  /**
   *
   */
  prefix: number;
  /**
   *
   */
  decimals: number;
  /**
   *
   */
  unit: string;
}

/**
 * COTI-specific network configuration with privacy features
 */
export interface COTINetwork extends BaseNetwork {
  /**
   *
   */
  privacyEnabled: boolean;
  /**
   *
   */
  mpcProtocol: string;
  /**
   *
   */
  garbledCircuits: boolean;
}
