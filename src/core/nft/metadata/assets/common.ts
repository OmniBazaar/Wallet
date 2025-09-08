/**
 * NFT Assets Common Module
 * 
 * This module is temporarily disabled as it was copied from Rainbow wallet
 * and needs to be refactored to work with OmniBazaar's architecture.
 * 
 * TODO: Implement common NFT functionality using:
 * - OmniBazaar's NFTManager and NFTService
 * - Proper TypeScript types from our codebase
 * - Integration with our provider system
 */

// Placeholder exports to prevent import errors
/**
 *
 * @param assets
 */
export const parseUserAssets = (assets: unknown[]): unknown[] => {
  // TODO: Implement proper asset parsing
  return assets;
};

export const userAssetsQueryKey = 'userAssets';

/**
 *
 * @param asset
 */
export const getAssetBalance = (asset: unknown): string => {
  // TODO: Implement proper balance calculation
  return '0';
};

/**
 *
 * @param amount
 * @param decimals
 */
export const formatAssetAmount = (amount: string, decimals = 18): string => {
  // TODO: Implement proper amount formatting
  return amount;
};

export const COMMON_PLACEHOLDER = {};