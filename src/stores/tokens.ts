/**
 * Token Store
 * Manages token balances and metadata
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { tokenService } from '../services/TokenService';
import { useWalletStore } from './wallet';

/**
 * Token information interface
 */
export interface Token {
  /** Token contract address */
  address: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** Token balance */
  balance: string;
  /** Token value in USD */
  value: number;
  /** Token logo URL */
  logoURI?: string;
  /** Price per token in USD */
  priceUSD?: number;
}

export const useTokenStore = defineStore('tokens', () => {
  // State
  const tokens = ref<Token[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const totalValue = computed(() => {
    return tokens.value.reduce((total, token) => total + (token.value ?? 0), 0);
  });

  const topTokens = computed(() => {
    return [...tokens.value]
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 5);
  });

  const tokenCount = computed(() => tokens.value.length);

  // Methods
  /**
   * Fetch tokens for current wallet
   * @returns Promise that resolves when tokens are loaded
   */
  async function fetchTokens(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;

      // Get current wallet address
      const walletStore = useWalletStore();
      const address = walletStore.address;

      if (address === '') {
        tokens.value = [];
        return;
      }

      // Fetch real token balances from TokenService
      const tokenBalances = await tokenService.getAllTokens(address);

      // Convert TokenBalance to Token format
      tokens.value = tokenBalances.map(tb => ({
        address: tb.token.address,
        symbol: tb.token.symbol,
        name: tb.token.name,
        decimals: tb.token.decimals,
        balance: tb.balanceFormatted,
        value: tb.valueUSD ?? 0,
        priceUSD: tb.valueUSD !== undefined && parseFloat(tb.balanceFormatted) > 0 
          ? tb.valueUSD / parseFloat(tb.balanceFormatted)
          : undefined,
        logoURI: tb.token.logoURI
      }));

    } catch (err) {
      error.value = 'Failed to fetch tokens';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add custom token
   * @param tokenAddress - The contract address of the token to add
   * @returns Promise that resolves to true if successful, false otherwise
   */
  async function addToken(tokenAddress: string): Promise<boolean> {
    try {
      // Check if already exists
      const exists = tokens.value.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
      if (exists) {
        error.value = 'Token already added';
        return false;
      }

      // Add custom token through TokenService
      await tokenService.addCustomToken({ address: tokenAddress });
      
      // Refresh token list to include the new token
      await fetchTokens();

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add token';
      return false;
    }
  }

  /**
   * Remove token
   * @param tokenAddress - The contract address of the token to remove
   * @returns void
   */
  function removeToken(tokenAddress: string): void {
    tokens.value = tokens.value.filter(t => t.address.toLowerCase() !== tokenAddress.toLowerCase());
  }

  /**
   * Update token balances
   * @returns Promise that resolves when balances are updated
   */
  async function updateBalances(): Promise<void> {
    try {
      isLoading.value = true;
      
      // Refresh all token balances from blockchain
      await fetchTokens();

    } catch (err) {
      error.value = 'Failed to update balances';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get token by address
   * @param address - The contract address to search for
   * @returns The token if found, undefined otherwise
   */
  function getTokenByAddress(address: string): Token | undefined {
    return tokens.value.find(t => t.address.toLowerCase() === address.toLowerCase());
  }

  /**
   * Get token by symbol
   * @param symbol - The token symbol to search for
   * @returns The token if found, undefined otherwise
   */
  function getTokenBySymbol(symbol: string): Token | undefined {
    return tokens.value.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  }

  /**
   * Clear all tokens
   * @returns void
   */
  function clearTokens(): void {
    tokens.value = [];
    error.value = null;
  }

  return {
    // State
    tokens,
    isLoading,
    error,

    // Computed
    totalValue,
    topTokens,
    tokenCount,

    // Methods
    fetchTokens,
    addToken,
    removeToken,
    updateBalances,
    getTokenByAddress,
    getTokenBySymbol,
    clearTokens
  };
});