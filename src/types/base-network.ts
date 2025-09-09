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
  /** Bech32 address prefix for segwit addresses */
  bech32: string;
  /** Public key hash version byte for P2PKH addresses */
  pubKeyHash: number;
  /** Script hash version byte for P2SH addresses */
  scriptHash: number;
  /** Wallet Import Format version byte for private keys */
  wif: number;
}

/**
 * Solana-specific network configuration
 */
export interface SolanaNetwork extends BaseNetwork {
  /** Solana cluster identifier */
  cluster: 'mainnet-beta' | 'testnet' | 'devnet';
  /** Optional program ID for custom deployments */
  programId?: string;
}

/**
 * Polkadot-specific network configuration
 */
export interface PolkadotNetwork extends BaseNetwork {
  /** Genesis block hash for network identification */
  genesisHash: string;
  /** SS58 address format prefix */
  prefix: number;
  /** Number of decimal places for the native token */
  decimals: number;
  /** Symbol for the native token unit */
  unit: string;
}

/**
 * COTI-specific network configuration with privacy features
 */
export interface COTINetwork extends BaseNetwork {
  /** Whether privacy features are enabled on this network */
  privacyEnabled: boolean;
  /** Multi-party computation protocol identifier */
  mpcProtocol: string;
  /** Whether garbled circuits are supported for enhanced privacy */
  garbledCircuits: boolean;
}
