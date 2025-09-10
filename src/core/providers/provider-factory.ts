/**
 * Provider Factory - Creates OmniProviders for different chains
 * 
 * All providers connect to OmniBazaar validators instead of external RPCs.
 * This ensures data privacy, eliminates external dependencies, and reduces costs.
 */

import { OmniProvider } from './OmniProvider';
// No direct ethers types needed here; avoid mutating provider internals

/**
 * Factory for creating and managing OmniProvider instances
 * Provides centralized provider management with chain-specific configurations
 */
export class ProviderFactory {
  private static providers = new Map<number, OmniProvider>();
  private static walletId: string | undefined;
  
  /**
   * Initialize factory with wallet ID
   * @param walletId Optional wallet identifier for provider authentication
   */
  static initialize(walletId?: string): void {
    this.walletId = walletId;
  }
  
  /**
   * Get provider for specific chain
   * @param chainId EVM chain ID to get provider for
   * @returns OmniProvider instance for the specified chain
   */
  static getProvider(chainId: number): OmniProvider {
    if (!this.providers.has(chainId)) {
      const provider = new OmniProvider(this.walletId);
      // Track chain id via explicit setter (do not mutate base fields)
      provider.setChainId(chainId);
      this.providers.set(chainId, provider);
    }
    
    const provider = this.providers.get(chainId);
    if (provider === undefined) {
      throw new Error(`Provider not found for chainId: ${chainId}`);
    }
    return provider;
  }
  
  /**
   * Get network configuration
   * @param chainId
   */
  // Network configuration is handled within the validator; no local mutation needed
  
  /**
   * Get all active providers
   * @returns Array of all active provider instances
   */
  static getAllProviders(): OmniProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Disconnect all providers and clear the cache
   */
  static disconnectAll(): void {
    const providers = Array.from(this.providers.values());
    for (const provider of providers) {
      provider.disconnect();
    }
    this.providers.clear();
  }
  
  /**
   * Replace external RPC URL with OmniProvider
   * (For backwards compatibility with existing code)
   * @param rpcUrl RPC URL to analyze for chain detection
   * @returns OmniProvider instance for the detected chain
   */
  static createProvider(rpcUrl: string): OmniProvider {
    // Ignore the RPC URL and return OmniProvider
    // External RPC requested, using OmniBazaar validator network instead
    
    // Try to determine chain from URL
    let chainId = 1; // Default to Ethereum
    
    if (rpcUrl.includes('polygon') || rpcUrl.includes('matic')) chainId = 137;
    else if (rpcUrl.includes('bsc') || rpcUrl.includes('binance')) chainId = 56;
    else if (rpcUrl.includes('avalanche') || rpcUrl.includes('avax')) chainId = 43114;
    else if (rpcUrl.includes('arbitrum')) chainId = 42161;
    else if (rpcUrl.includes('optimism')) chainId = 10;
    else if (rpcUrl.includes('base')) chainId = 8453;
    
    return this.getProvider(chainId);
  }
}
