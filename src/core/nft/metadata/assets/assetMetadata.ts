import { isValidAddress } from '@ethereumjs/util';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Address, isAddress } from 'viem';

import {
  QueryConfig,
  QueryFunctionArgs,
  QueryFunctionResult,
  createQueryKey,
} from '~/core/react-query';
import { AddressOrEth } from '~/core/types/assets';
import { SearchAsset } from '~/core/types/search';
import { getAssetMetadata, getCustomChainIconUrl } from '~/core/utils/assets';
import { isNativeAsset } from '~/core/utils/chains';
import { useUserChains } from '~/entries/popup/hooks/useUserChains';

// ///////////////////////////////////////////////
// Query Types

type AssetMetadataArgs = {
  assetAddress?: Address;
  chainId: number;
};

type AssetMetadataAllNetworksArgs = {
  assetAddress?: Address;
};

// ///////////////////////////////////////////////
// Query Key

/**
 *
 * @param root0
 * @param root0.assetAddress
 * @param root0.chainId
 */
export const assetMetadataQueryKey = ({
  assetAddress,
  chainId,
}: AssetMetadataArgs): readonly [string, { /**
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}} *
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}} */
assetAddress: string; /**
aaaaaaaaaaaaaaaaaaaaaa *
aaaaaaaaaaaaaaaaaaaaaa */
chainId: number }, { /**
ccccccccccccccccccccc *
ccccccccccccccccccccc */
persisterVersion: number }] =>
  createQueryKey(
    'assetMetadata',
    { assetAddress, chainId },
    { persisterVersion: 1 },
  );

type AssetMetadataQueryKey = ReturnType<typeof assetMetadataQueryKey>;

/**
 *
 * @param root0
 * @param root0.assetAddress
 * @param root0.chainId
 */
export const assetSearchMetadataQueryKey = ({
  assetAddress,
  chainId,
}: AssetMetadataArgs): readonly [string, { /**
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}} *
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}} */
assetAddress: string; /**
aaaaaaaaaaaaaaaaaaaaaa *
aaaaaaaaaaaaaaaaaaaaaa */
chainId: number }, { /**
ccccccccccccccccccccc *
ccccccccccccccccccccc */
persisterVersion: number }] =>
  createQueryKey(
    'assetSearchMetadata',
    { assetAddress, chainId },
    { persisterVersion: 1 },
  );

type AssetSearchMetadataQueryKey = ReturnType<
  typeof assetSearchMetadataQueryKey
>;

// ///////////////////////////////////////////////
// Query Function

async function assetMetadataQueryFunction({
  queryKey: [{ assetAddress, chainId }],
}: QueryFunctionArgs<typeof assetMetadataQueryKey>): Promise<{ address: string; chainId: number; name?: string; symbol?: string; decimals?: number; logoURI?: string } | null> {
  if (assetAddress && isValidAddress(assetAddress)) {
    const metadata = await getAssetMetadata({
      address: assetAddress,
      chainId: Number(chainId),
    });
    return {
      address: assetAddress,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      name: metadata.name,
    };
  }
}

async function assetSearchMetadataQueryFunction({
  queryKey: [{ assetAddress, chainId }],
}: QueryFunctionArgs<typeof assetSearchMetadataQueryKey>): Promise<{ address: string; chainId: number; name?: string; symbol?: string; decimals?: number; logoURI?: string } | null> {
  if (assetAddress && isAddress(assetAddress)) {
    const metadata = await getAssetMetadata({
      address: assetAddress,
      chainId: Number(chainId),
    });

    const { decimals, symbol, name } = metadata || {};

    if (decimals && symbol && name) {
      return parseSearchAssetMetadata({
        address: assetAddress,
        decimals,
        symbol,
        name,
        chainId,
      });
    }
  }

  return null;
}

/**
 *
 */
export type AssetMetadataResult = QueryFunctionResult<
  typeof assetMetadataQueryFunction
>;

type AssetSearchMetadataResult = QueryFunctionResult<
  typeof assetSearchMetadataQueryFunction
>;

/**
 *
 * @param root0
 * @param root0.address
 * @param root0.symbol
 * @param root0.decimals
 * @param root0.name
 * @param root0.chainId
 */
export function parseSearchAssetMetadata({
  address,
  symbol,
  decimals,
  name,
  chainId,
}: {
  /**
   *
   */
  address: AddressOrEth;
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
  name: string;
  /**
   *
   */
  chainId: number;
}): SearchAsset {
  return {
    address,
    name,
    networks: {},
    chainId,
    symbol,
    decimals,
    highLiquidity: false,
    isVerified: false,
    isNativeAsset: isNativeAsset(address, chainId),
    mainnetAddress: address,
    uniqueId: `${address}_${chainId}`,
    icon_url: getCustomChainIconUrl(chainId, address),
  };
}

// ///////////////////////////////////////////////
// Query Hook

/**
 *
 * @param root0
 * @param root0.assetAddress
 * @param root0.chainId
 * @param config
 */
export function useAssetMetadata(
  { assetAddress, chainId }: AssetMetadataArgs,
  config: QueryConfig<
    AssetMetadataResult,
    Error,
    AssetMetadataResult,
    AssetMetadataQueryKey
  > = {},
): { /**
))))) *
))))) */
data?: AssetMetadataResult; /**
dddddddddddddddddddddddddddd *
dddddddddddddddddddddddddddd */
isLoading: boolean; /**
iiiiiiiiiiiiiiiiiiii *
iiiiiiiiiiiiiiiiiiii */
error?: Error } {
  return useQuery({
    queryKey: assetMetadataQueryKey({
      assetAddress,
      chainId,
    }),
    queryFn: assetMetadataQueryFunction,
    ...config,
  });
}

/**
 *
 * @param root0
 * @param root0.assetAddress
 * @param root0.chainId
 * @param config
 */
export function useAssetSearchMetadata(
  { assetAddress, chainId }: AssetMetadataArgs,
  config: QueryConfig<
    AssetSearchMetadataResult,
    Error,
    AssetSearchMetadataResult,
    AssetSearchMetadataQueryKey
  > = {},
): { /**
))))) *
))))) */
data?: AssetSearchMetadataResult; /**
dddddddddddddddddddddddddddddddddd *
dddddddddddddddddddddddddddddddddd */
isLoading: boolean; /**
iiiiiiiiiiiiiiiiiiii *
iiiiiiiiiiiiiiiiiiii */
error?: Error } {
  return useQuery({
    queryKey: assetSearchMetadataQueryKey({
      assetAddress,
      chainId,
    }),
    queryFn: assetSearchMetadataQueryFunction,
    ...config,
  });
}

/**
 *
 * @param root0
 * @param root0.assetAddress
 * @param config
 */
export function useAssetSearchMetadataAllNetworks(
  { assetAddress }: AssetMetadataAllNetworksArgs,
  config: QueryConfig<
    AssetSearchMetadataResult,
    Error,
    AssetSearchMetadataResult,
    AssetSearchMetadataQueryKey
  > = {},
): { /**
))))) *
))))) */
data?: AssetSearchMetadataResult[]; /**
dddddddddddddddddddddddddddddddddddd *
dddddddddddddddddddddddddddddddddddd */
isLoading: boolean; /**
iiiiiiiiiiiiiiiiiiii *
iiiiiiiiiiiiiiiiiiii */
error?: Error } {
  const { chains: userChains } = useUserChains();

  const queries = useQueries({
    queries: userChains.map((chain) => ({
      queryKey: assetSearchMetadataQueryKey({
        assetAddress,
        chainId: chain.id,
      }),
      queryFn: assetSearchMetadataQueryFunction,
      ...config,
    })),
  });

  return {
    data: queries.map(({ data: asset }) => asset).filter(Boolean),
    isFetching: queries.some(({ isFetching }) => isFetching),
  };
}
