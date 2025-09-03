/**
 * NFT Provider Factory
 * 
 * Creates NFT providers configured to use OmniBazaar validators by default,
 * with fallback to external APIs when needed.
 */

import { EthereumNFTProvider } from './ethereum-provider';
import { PolygonNFTProvider } from './polygon-provider';
import { BSCNFTProvider } from './bsc-provider';
import { AvalancheNFTProvider } from './avalanche-provider';
import { ArbitrumNFTProvider } from './arbitrum-provider';
import { OptimismNFTProvider } from './optimism-provider';
import { BaseNFTProvider } from './base-provider';
import type { ChainProvider } from '../display/multi-chain-display';

/**
 *
 */
export interface ProviderConfig {
  /**
   *
   */
  useOmniProvider?: boolean;
  /**
   *
   */
  validatorUrl?: string;
  /**
   *
   */
  apiKeys?: {
    /**
     *
     */
    alchemy?: string;
    /**
     *
     */
    moralis?: string;
    /**
     *
     */
    opensea?: string;
    /**
     *
     */
    quicknode?: string;
    /**
     *
     */
    infura?: string;
  };
}

/**
 * Create NFT provider for a specific chain
 * @param chainId
 * @param config
 */
export function createNFTProvider(
  chainId: number,
  config: ProviderConfig = {}
): ChainProvider | null {
  // Default to using OmniProvider
  const useOmniProvider = config.useOmniProvider !== false;
  const validatorUrl = config.validatorUrl || (process.env?.VALIDATOR_URL ?? 'wss://validator.omnibazaar.com');
  
  // Base configuration for all providers
  const apiKeyProps = {
    ...(config.apiKeys?.alchemy ? { alchemyApiKey: config.apiKeys.alchemy } : {}),
    ...(config.apiKeys?.moralis ? { moralisApiKey: config.apiKeys.moralis } : {}),
    ...(config.apiKeys?.opensea ? { openseaApiKey: config.apiKeys.opensea } : {}),
  } as const;
  
  switch (chainId) {
    case 1: // Ethereum
      return new EthereumNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://ethereum.publicnode.com',
        useOmniProvider,
        ...apiKeyProps,
      });
      
    case 137: // Polygon
      return new PolygonNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://polygon.publicnode.com',
        ...apiKeyProps,
      });
      
    case 56: // Binance Smart Chain
      return new BSCNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://bsc.publicnode.com',
        ...(config.apiKeys?.moralis ? { moralisApiKey: config.apiKeys.moralis } : {}),
      });
      
    case 43114: // Avalanche
      return new AvalancheNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://avalanche.publicnode.com'
      });
      
    case 42161: // Arbitrum
      return new ArbitrumNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://arbitrum.publicnode.com',
        ...apiKeyProps,
      });
      
    case 10: // Optimism
      return new OptimismNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://optimism.publicnode.com',
        ...apiKeyProps,
      });
      
    case 8453: // Base
      return new BaseNFTProvider({
        rpcUrl: useOmniProvider ? validatorUrl : 'https://base.publicnode.com',
        ...apiKeyProps,
      });
      
    default:
      console.warn(`No NFT provider available for chain ${chainId}`);
      return null;
  }
}

/**
 * Create all NFT providers
 * @param config
 */
export function createAllNFTProviders(config: ProviderConfig = {}): Map<number, ChainProvider> {
  const providers = new Map<number, ChainProvider>();
  const chainIds = [1, 137, 56, 43114, 42161, 10, 8453];
  
  for (const chainId of chainIds) {
    const provider = createNFTProvider(chainId, config);
    if (provider) {
      providers.set(chainId, provider);
    }
  }
  
  return providers;
}

/**
 * Get chain name from chain ID
 * @param chainId
 */
export function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    137: 'Polygon',
    56: 'Binance Smart Chain',
    43114: 'Avalanche',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base'
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
}

/**
 * Check if OmniProvider is available
 * @param validatorUrl
 */
export async function checkOmniProviderAvailability(
  validatorUrl?: string
): Promise<boolean> {
  try {
    const url = validatorUrl || process.env?.VALIDATOR_URL || 'wss://validator.omnibazaar.com';
    
    // Try to connect with WebSocket
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });
  } catch (error) {
    console.warn('Failed to check OmniProvider availability:', error);
    return false;
  }
}
