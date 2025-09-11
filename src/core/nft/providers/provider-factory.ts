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
 * Configuration for NFT providers
 */
export interface ProviderConfig {
  /**
   * Whether to use OmniBazaar validators as primary providers
   */
  useOmniProvider?: boolean;
  /**
   * Custom validator URL to use instead of default
   */
  validatorUrl?: string;
  /**
   * API keys for various NFT data providers
   */
  apiKeys?: {
    /**
     * Alchemy API key for enhanced NFT metadata
     */
    alchemy?: string;
    /**
     * Moralis API key for cross-chain NFT data
     */
    moralis?: string;
    /**
     * OpenSea API key for marketplace data
     */
    opensea?: string;
    /**
     * QuickNode API key for fast RPC access
     */
    quicknode?: string;
    /**
     * Infura API key for reliable blockchain access
     */
    infura?: string;
  };
}

/**
 * Create NFT provider for a specific chain
 * @param chainId - The blockchain chain ID
 * @param config - Provider configuration options
 * @returns Configured NFT provider or null if chain not supported
 */
export function createNFTProvider(
  chainId: number,
  config: ProviderConfig = {}
): ChainProvider | null {
  // Default to using OmniProvider
  const useOmniProvider = config.useOmniProvider !== false;
  const envValidatorUrl = process.env?.['VALIDATOR_URL'];
  const validatorUrl = config.validatorUrl ?? envValidatorUrl ?? 'wss://validator.omnibazaar.com';
  
  // Base configuration for all providers
  const apiKeyProps = {
    ...(config.apiKeys?.alchemy !== undefined && config.apiKeys.alchemy.length > 0 ? { alchemyApiKey: config.apiKeys.alchemy } : {}),
    ...(config.apiKeys?.moralis !== undefined && config.apiKeys.moralis.length > 0 ? { moralisApiKey: config.apiKeys.moralis } : {}),
    ...(config.apiKeys?.opensea !== undefined && config.apiKeys.opensea.length > 0 ? { openseaApiKey: config.apiKeys.opensea } : {}),
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
        ...(config.apiKeys?.moralis !== undefined && config.apiKeys.moralis.length > 0 ? { moralisApiKey: config.apiKeys.moralis } : {}),
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
      // Use logger instead of console.warn
      // console.warn(`No NFT provider available for chain ${chainId}`);
      return null;
  }
}

/**
 * Create all NFT providers
 * @param config - Provider configuration options
 * @returns Map of chain IDs to configured providers
 */
export function createAllNFTProviders(config: ProviderConfig = {}): Map<number, ChainProvider> {
  const providers = new Map<number, ChainProvider>();
  const chainIds = [1, 137, 56, 43114, 42161, 10, 8453];
  
  for (const chainId of chainIds) {
    const provider = createNFTProvider(chainId, config);
    if (provider !== null) {
      providers.set(chainId, provider);
    }
  }
  
  return providers;
}

/**
 * Get chain name from chain ID
 * @param chainId - The blockchain chain ID
 * @returns Human-readable chain name
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
  
  return chainNames[chainId] ?? `Chain ${chainId}`;
}

/**
 * Check if OmniProvider is available
 * @param validatorUrl - Optional custom validator URL to check
 * @returns Promise resolving to true if provider is available
 */
export async function checkOmniProviderAvailability(
  validatorUrl: string = ''
): Promise<boolean> {
  try {
    const envUrl = process.env?.['VALIDATOR_URL'];
    const url = validatorUrl.length > 0 ? validatorUrl : (envUrl ?? 'wss://validator.omnibazaar.com');
    
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
