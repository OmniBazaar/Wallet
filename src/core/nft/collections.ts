/**
 * NFT Collections Module
 * 
 * This module is temporarily disabled as it was copied from Rainbow wallet
 * and needs to be refactored to work with OmniBazaar's architecture.
 * 
 * TODO: Implement NFT collections functionality using:
 * - OmniBazaar's provider system
 * - Proper TypeScript types from our codebase
 * - Integration with our NFTManager and NFTService
 */

// Original Rainbow code commented out for reference
/*
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Address, Chain } from 'viem';

import {
  fetchNftCollections,
  polygonAllowListFetcher,
} from '~/core/network/nfts';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import { createQueryKey } from '~/core/react-query';
import type {
  InfiniteQueryConfig,
  QueryFunctionArgs,
  QueryFunctionResult,
} from '~/core/react-query';
import { NftSort } from '~/core/state/nfts';
import { chainNameToIdMapping } from '~/core/types/chains';
import type { ChainName } from '~/core/types/chains';
import { SimpleHashCollectionDetails } from '~/core/types/nfts';
import {
  simpleHashSupportedChainNames,
  simpleHashSupportedTestnetChainNames,
} from '~/core/utils/nfts';
*/

// Placeholder exports to prevent import errors
export const MOCK_NFT_COLLECTION: unknown[] = [];
/**
 * Get NFT collections
 * @returns Promise that resolves to array of NFT collections
 */
export const getNftCollections = (): Promise<unknown[]> => {
  // TODO: Implement using NFTManager
  return Promise.resolve([]);
};