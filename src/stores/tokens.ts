/**
 * Token Store
 * Manages token balances and metadata
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

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
    return tokens.value.reduce((total, token) => total + (token.value || 0), 0);
  });

  const topTokens = computed(() => {
    return [...tokens.value]
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  });

  const tokenCount = computed(() => tokens.value.length);

  // Methods
  /**
   * Fetch tokens for current wallet
   */
  async function fetchTokens(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;

      // In real implementation, fetch from blockchain or indexer
      // Mock data for now
      tokens.value = [
        {
          address: '0xXOM',
          symbol: 'XOM',
          name: 'OmniCoin',
          decimals: 18,
          balance: '100',
          value: 15000,
          priceUSD: 150
        },
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          balance: '1000',
          value: 1000,
          priceUSD: 1
        },
        {
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          balance: '1',
          value: 2000,
          priceUSD: 2000
        }
      ];

    } catch (err) {
      error.value = 'Failed to fetch tokens';
      console.error('Failed to fetch tokens:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add custom token
   */
  async function addToken(tokenAddress: string): Promise<boolean> {
    try {
      // In real implementation, fetch token metadata from blockchain
      // For now, just check if already exists
      const exists = tokens.value.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
      if (exists) {
        error.value = 'Token already added';
        return false;
      }

      // Mock adding token
      tokens.value.push({
        address: tokenAddress,
        symbol: 'CUSTOM',
        name: 'Custom Token',
        decimals: 18,
        balance: '0',
        value: 0
      });

      return true;
    } catch (err) {
      error.value = 'Failed to add token';
      console.error('Failed to add token:', err);
      return false;
    }
  }

  /**
   * Remove token
   */
  function removeToken(tokenAddress: string): void {
    tokens.value = tokens.value.filter(t => t.address.toLowerCase() !== tokenAddress.toLowerCase());
  }

  /**
   * Update token balances
   */
  async function updateBalances(): Promise<void> {
    try {
      isLoading.value = true;
      
      // In real implementation, fetch updated balances
      // For now, just simulate random changes
      tokens.value = tokens.value.map(token => ({
        ...token,
        value: token.value * (0.95 + Math.random() * 0.1)
      }));

    } catch (err) {
      console.error('Failed to update balances:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get token by address
   */
  function getTokenByAddress(address: string): Token | undefined {
    return tokens.value.find(t => t.address.toLowerCase() === address.toLowerCase());
  }

  /**
   * Get token by symbol
   */
  function getTokenBySymbol(symbol: string): Token | undefined {
    return tokens.value.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  }

  /**
   * Clear all tokens
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