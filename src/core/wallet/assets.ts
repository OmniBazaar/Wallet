import { OmniCoinMetadata } from '../blockchain/OmniCoin';

/**
 *
 */
export interface AssetMetadata {
  /**
   *
   */
  name: string;
  /**
   *
   */
  symbol: string;
  /**
   *
   */
  decimals: number;
  /**
   *
   */
  contractAddress: string;
}

/**
 * Array of supported cryptocurrency assets in the OmniBazaar wallet
 * Contains metadata for all tokens and coins that can be managed
 */
export const SupportedAssets: Readonly<AssetMetadata[]> = [
  OmniCoinMetadata,
];
