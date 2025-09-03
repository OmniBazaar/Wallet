/**
 * Provider Factory - Creates OmniProviders for different chains
 * 
 * All providers connect to OmniBazaar validators instead of external RPCs.
 * This ensures data privacy, eliminates external dependencies, and reduces costs.
 */

import { OmniProvider } from './OmniProvider';
// No direct ethers types needed here; avoid mutating provider internals

/**
 *
 */
export class ProviderFactory {
  private static providers = new Map<number, OmniProvider>();
  private static walletId: string | undefined;
  
  /**
   * Initialize factory with wallet ID
   * @param walletId
   */
  static initialize(walletId?: string): void {
    this.walletId = walletId;
  }
  
  /**
   * Get provider for specific chain
   * @param chainId
   */
  static getProvider(chainId: number): OmniProvider {
    if (!this.providers.has(chainId)) {
      const provider = new OmniProvider(this.walletId);
      // Track chain id via explicit setter (do not mutate base fields)
      provider.setChainId(chainId);
      this.providers.set(chainId, provider);
    }
    
    return this.providers.get(chainId)!;
  }
  
  /**
   * Get network configuration
   * @param chainId
   */
  // Network configuration is handled within the validator; no local mutation needed
  
  /**
   * Get all active providers
   */
  static getAllProviders(): OmniProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Disconnect all providers
   */
  static disconnectAll(): void {
    for (const provider of this.providers.values()) {
      provider.disconnect();
    }
    this.providers.clear();
  }
  
  /**
   * Replace external RPC URL with OmniProvider
   * (For backwards compatibility with existing code)
   * @param rpcUrl
   */
  static createProvider(rpcUrl: string): OmniProvider {
    // Ignore the RPC URL and return OmniProvider
    console.log('External RPC requested, using OmniBazaar validator network instead');
    
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
