// OmniBazaar Wallet Base Network Types
// Adapted from Enkrypt base network interfaces

import { ProviderName } from './provider';

/**
 * Base network configuration interface for all blockchain networks
 */
export interface BaseNetwork {
  /**
   *
   */
  name: string;
  /**
   *
   */
  name_long: string;
  /**
   *
   */
  homePage: string;
  /**
   *
   */
  blockExplorerTX: string;
  /**
   *
   */
  blockExplorerAddr: string;
  /**
   *
   */
  isTestNetwork: boolean;
  /**
   *
   */
  currencyName: string;
  /**
   *
   */
  icon: string;
  /**
   *
   */
  node: string;
  /**
   *
   */
  chainID?: string;
  /**
   *
   */
  coingeckoID?: string;
  /**
   *
   */
  provider: ProviderName;
  /**
   *
   */
  displayAddress: (address: string) => string;
  /**
   *
   */
  identicon: (address: string, options?: { size?: number; background?: string }) => string;
  /**
   *
   */
  basePath: string;
}

/**
 * Ethereum-specific network configuration
 */
export interface EthereumNetwork extends BaseNetwork {
  /**
   *
   */
  chainID: string;
  /**
   *
   */
  slip44: number;
  /**
   *
   */
  ensResolver?: string;
  /**
   *
   */
  multicall?: string;
}

/**
 * Bitcoin-specific network configuration
 */
export interface BitcoinNetwork extends BaseNetwork {
  /**
   *
   */
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