import { OmniCoinMetadata } from '../blockchain/OmniCoin';

/**
 * Metadata for a supported cryptocurrency asset
 */
export interface AssetMetadata {
  /** Full name of the asset (e.g., "OmniCoin") */
  name: string;
  /** Trading symbol of the asset (e.g., "OMNI") */
  symbol: string;
  /** Number of decimal places for the asset */
  decimals: number;
  /** Smart contract address of the asset on the blockchain */
  contractAddress: string;
}

/**
 * Extended OmniCoin metadata with dynamic contract address
 */
export const OmniCoinAsset: AssetMetadata = {
  ...OmniCoinMetadata,
  contractAddress: '', // Contract address is determined dynamically based on network
};

/**
 * Array of supported cryptocurrency assets in the OmniBazaar wallet
 * Contains metadata for all tokens and coins that can be managed
 */
export const SupportedAssets: Readonly<AssetMetadata[]> = [
  OmniCoinAsset,
];
