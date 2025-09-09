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
 * Array of supported cryptocurrency assets in the OmniBazaar wallet
 * Contains metadata for all tokens and coins that can be managed
 */
export const SupportedAssets: Readonly<AssetMetadata[]> = [
  OmniCoinMetadata,
];
