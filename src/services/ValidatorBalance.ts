/**
 * Validator Balance Service Integration
 * 
 * Manages balance queries and tracking through the Validator network
 */

import { ValidatorClient } from '../../Validator/src/client/ValidatorClient';
import { OmniCoinBlockchain } from '../../Validator/src/services/blockchain/OmniCoinBlockchain';
import { IPFSStorageNetwork } from '../../Validator/src/services/storage/IPFSStorageNetwork';
import { ethers } from 'ethers';
import { ref, Ref } from 'vue';

/**
 *
 */
export interface ValidatorBalanceConfig {
  /**
   *
   */
  validatorEndpoint: string;
  /**
   *
   */
  networkId: string;
  /**
   *
   */
  userId: string;
  /**
   *
   */
  enableCaching: boolean;
  /**
   *
   */
  cacheTimeout: number;
  /**
   *
   */
  enableHistoryTracking: boolean;
}

/**
 *
 */
export interface TokenBalance {
  /**
   *
   */
  address: string;
  /**
   *
   */
  symbol: string;
  /**
   *
   */
  name: string;
  /**
   *
   */
  decimals: number;
  /**
   *
   */
  balance: string;
  /**
   *
   */
  balanceFormatted: string;
  /**
   *
   */
  priceUSD?: string;
  /**
   *
   */
  valueUSD?: string;
  /**
   *
   */
  lastUpdated: number;
}

/**
 *
 */
export interface AccountBalance {
  /**
   *
   */
  address: string;
  /**
   *
   */
  nativeBalance: string;
  /**
   *
   */
  nativeBalanceFormatted: string;
  /**
   *
   */
  tokens: TokenBalance[];
  /**
   *
   */
  totalValueUSD?: string;
  /**
   *
   */
  lastUpdated: number;
}

/**
 *
 */
export interface BalanceHistory {
  /**
   *
   */
  address: string;
  /**
   *
   */
  timestamp: number;
  /**
   *
   */
  balance: string;
  /**
   *
   */
  blockNumber: number;
  /**
   *
   */
  transactionHash?: string;
}

/**
 *
 */
export interface BalanceCache {
  [address: string]: {
    /**
     *
     */
    balance: AccountBalance;
    /**
     *
     */
    timestamp: number;
  };
}

/**
 *
 */
export interface PriceData {
  /**
   *
   */
  symbol: string;
  /**
   *
   */
  price: string;
  /**
   *
   */
  change24h: string;
  /**
   *
   */
  lastUpdated: number;
}

/**
 *
 */
export class ValidatorBalanceService {
  private validatorClient: ValidatorClient;
  private blockchain: OmniCoinBlockchain;
  private ipfsStorage: IPFSStorageNetwork;
  private config: ValidatorBalanceConfig;
  private balanceCache: BalanceCache = {};
  private priceCache: Map<string, PriceData> = new Map();
  private balanceHistory: Map<string, BalanceHistory[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Reactive references for Vue integration
  public balancesRef: Ref<Record<string, AccountBalance>> = ref({});
  public pricesRef: Ref<Record<string, PriceData>> = ref({});
  public historyRef: Ref<Record<string, BalanceHistory[]>> = ref({});
  public isLoadingRef: Ref<boolean> = ref(false);

  /**
   *
   * @param config
   */
  constructor(config: ValidatorBalanceConfig) {
    this.config = config;
    this.validatorClient = new ValidatorClient(config.validatorEndpoint);
    this.blockchain = this.validatorClient.getBlockchain();
    this.ipfsStorage = this.validatorClient.getStorage();
  }

  /**
   * Initialize balance service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize validator client
      await this.validatorClient.initialize();
      
      // Load cached data
      if (this.config.enableCaching) {
        await this.loadCachedData();
      }
      
      // Load balance history
      if (this.config.enableHistoryTracking) {
        await this.loadBalanceHistory();
      }
      
      // Start price updates
      this.startPriceUpdates();
      
      console.warn('Validator Balance Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Validator Balance Service:', error);
      throw new Error(`Balance service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account balance
   * @param address
   * @param useCache
   */
  async getBalance(address: string, useCache = true): Promise<AccountBalance> {
    try {
      this.isLoadingRef.value = true;
      
      // Check cache first
      if (useCache && this.config.enableCaching) {
        const cached = this.balanceCache[address];
        if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
          this.isLoadingRef.value = false;
          return cached.balance;
        }
      }

      // Get native balance
      const nativeBalance = await this.blockchain.getBalance(address);
      const nativeBalanceFormatted = ethers.formatEther(nativeBalance);

      // Get token balances
      const tokens = await this.getTokenBalances(address);

      // Calculate total USD value
      let totalValueUSD = '0';
      if (tokens.length > 0) {
        const totalValue = tokens.reduce((sum, token) => {
          const value = parseFloat(token.valueUSD || '0');
          return sum + value;
        }, 0);
        totalValueUSD = totalValue.toFixed(2);
      }

      const accountBalance: AccountBalance = {
        address,
        nativeBalance: nativeBalance.toString(),
        nativeBalanceFormatted,
        tokens,
        totalValueUSD,
        lastUpdated: Date.now()
      };

      // Update cache
      if (this.config.enableCaching) {
        this.balanceCache[address] = {
          balance: accountBalance,
          timestamp: Date.now()
        };
        await this.saveCachedData();
      }

      // Update reactive reference
      this.balancesRef.value = {
        ...this.balancesRef.value,
        [address]: accountBalance
      };

      // Track balance history
      if (this.config.enableHistoryTracking) {
        await this.trackBalanceHistory(address, nativeBalance.toString());
      }

      this.isLoadingRef.value = false;
      return accountBalance;
    } catch (error) {
      console.error('Error getting balance:', error);
      this.isLoadingRef.value = false;
      throw error;
    }
  }

  /**
   * Get token balances for an address
   * @param address
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      // Get token list from blockchain
      const tokenList = await this.blockchain.getTokenList();
      
      if (!tokenList || tokenList.length === 0) {
        return [];
      }

      const tokenBalances: TokenBalance[] = [];

      // Get balance for each token
      for (const token of tokenList) {
        try {
          const balance = await this.blockchain.getTokenBalance(address, token.address);
          
          if (balance > 0) {
            const balanceFormatted = ethers.formatUnits(balance, token.decimals);
            
            // Get price data
            const priceData = await this.getTokenPrice(token.symbol);
            const priceUSD = priceData?.price || '0';
            const valueUSD = (parseFloat(balanceFormatted) * parseFloat(priceUSD)).toFixed(2);

            tokenBalances.push({
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              balance: balance.toString(),
              balanceFormatted,
              priceUSD,
              valueUSD,
              lastUpdated: Date.now()
            });
          }
        } catch (error) {
          console.error(`Error getting balance for token ${token.symbol}:`, error);
        }
      }

      return tokenBalances.sort((a, b) => 
        parseFloat(b.valueUSD || '0') - parseFloat(a.valueUSD || '0')
      );
    } catch (error) {
      console.error('Error getting token balances:', error);
      return [];
    }
  }

  /**
   * Get multiple account balances
   * @param addresses
   */
  async getMultipleBalances(addresses: string[]): Promise<Record<string, AccountBalance>> {
    try {
      this.isLoadingRef.value = true;
      
      const balances: Record<string, AccountBalance> = {};
      
      // Process balances in batches to avoid overwhelming the network
      const batchSize = 5;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        
        const batchPromises = batch.map(address => 
          this.getBalance(address).catch(error => {
            console.error(`Error getting balance for ${address}:`, error);
            return null;
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result) {
            balances[batch[index]] = result;
          }
        });
      }
      
      this.isLoadingRef.value = false;
      return balances;
    } catch (error) {
      console.error('Error getting multiple balances:', error);
      this.isLoadingRef.value = false;
      return {};
    }
  }

  /**
   * Get token price
   * @param symbol
   */
  async getTokenPrice(symbol: string): Promise<PriceData | null> {
    try {
      // Check cache first
      const cached = this.priceCache.get(symbol);
      if (cached && (Date.now() - cached.lastUpdated) < 60000) { // 1 minute cache
        return cached;
      }

      // Get price from blockchain oracle or external source
      const priceInfo = await this.blockchain.getTokenPrice(symbol);
      
      if (!priceInfo) {
        return null;
      }

      const priceData: PriceData = {
        symbol,
        price: priceInfo.price,
        change24h: priceInfo.change24h || '0',
        lastUpdated: Date.now()
      };

      // Update cache
      this.priceCache.set(symbol, priceData);
      
      // Update reactive reference
      this.pricesRef.value = {
        ...this.pricesRef.value,
        [symbol]: priceData
      };

      return priceData;
    } catch (error) {
      console.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Start automatic balance updates
   * @param addresses
   * @param interval
   */
  startBalanceUpdates(addresses: string[], interval = 30000): void {
    addresses.forEach(address => {
      // Clear existing interval if any
      this.stopBalanceUpdates(address);
      
      // Start new interval
      const intervalId = setInterval(() => {
        this.getBalance(address, false).catch(error => {
          console.error(`Error updating balance for ${address}:`, error);
        });
      }, interval);
      
      this.updateIntervals.set(address, intervalId);
    });
  }

  /**
   * Stop automatic balance updates
   * @param address
   */
  stopBalanceUpdates(address?: string): void {
    if (address) {
      const intervalId = this.updateIntervals.get(address);
      if (intervalId) {
        clearInterval(intervalId);
        this.updateIntervals.delete(address);
      }
    } else {
      // Stop all updates
      for (const intervalId of this.updateIntervals.values()) {
        clearInterval(intervalId);
      }
      this.updateIntervals.clear();
    }
  }

  /**
   * Get balance history for an address
   * @param address
   * @param limit
   */
  getBalanceHistory(address: string, limit = 100): BalanceHistory[] {
    const history = this.balanceHistory.get(address) || [];
    return history.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Track balance history
   * @param address
   * @param balance
   */
  private async trackBalanceHistory(address: string, balance: string): Promise<void> {
    try {
      if (!this.config.enableHistoryTracking) {
        return;
      }

      const history = this.balanceHistory.get(address) || [];
      const currentBlock = await this.blockchain.getBlockNumber();
      
      // Only add if balance has changed
      const lastEntry = history[history.length - 1];
      if (!lastEntry || lastEntry.balance !== balance) {
        const entry: BalanceHistory = {
          address,
          timestamp: Date.now(),
          balance,
          blockNumber: currentBlock
        };
        
        history.push(entry);
        
        // Keep only last 1000 entries
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }
        
        this.balanceHistory.set(address, history);
        
        // Update reactive reference
        this.historyRef.value = {
          ...this.historyRef.value,
          [address]: history
        };
        
        // Save to storage
        await this.saveBalanceHistory(address, history);
      }
    } catch (error) {
      console.error('Error tracking balance history:', error);
    }
  }

  /**
   * Clear balance cache
   */
  clearCache(): void {
    this.balanceCache = {};
    this.priceCache.clear();
    this.balancesRef.value = {};
    this.pricesRef.value = {};
    
    if (this.config.enableCaching) {
      this.saveCachedData();
    }
  }

  /**
   * Export balance data
   * @param format
   */
  exportBalanceData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      balances: this.balancesRef.value,
      prices: this.pricesRef.value,
      history: this.historyRef.value,
      exportedAt: new Date().toISOString()
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      const headers = ['Address', 'Native Balance', 'Total Value USD', 'Last Updated'];
      const rows = Object.entries(this.balancesRef.value).map(([address, balance]) => [
        address,
        balance.nativeBalanceFormatted,
        balance.totalValueUSD || '0',
        new Date(balance.lastUpdated).toISOString()
      ]);
      
      return [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
    }
    
    throw new Error('Unsupported export format');
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary(): {
    /**
     *
     */
    totalAccounts: number;
    /**
     *
     */
    totalValueUSD: string;
    /**
     *
     */
    topTokens: TokenBalance[];
    /**
     *
     */
    lastUpdated: number;
  } {
    const balances = Object.values(this.balancesRef.value);
    
    const totalValueUSD = balances.reduce((sum, balance) => {
      return sum + parseFloat(balance.totalValueUSD || '0');
    }, 0);
    
    // Aggregate tokens across all accounts
    const tokenMap = new Map<string, TokenBalance>();
    balances.forEach(balance => {
      balance.tokens.forEach(token => {
        const existing = tokenMap.get(token.symbol);
        if (existing) {
          const totalBalance = parseFloat(existing.balanceFormatted) + parseFloat(token.balanceFormatted);
          const totalValue = parseFloat(existing.valueUSD || '0') + parseFloat(token.valueUSD || '0');
          
          tokenMap.set(token.symbol, {
            ...existing,
            balanceFormatted: totalBalance.toString(),
            valueUSD: totalValue.toFixed(2)
          });
        } else {
          tokenMap.set(token.symbol, token);
        }
      });
    });
    
    const topTokens = Array.from(tokenMap.values())
      .sort((a, b) => parseFloat(b.valueUSD || '0') - parseFloat(a.valueUSD || '0'))
      .slice(0, 10);
    
    return {
      totalAccounts: balances.length,
      totalValueUSD: totalValueUSD.toFixed(2),
      topTokens,
      lastUpdated: Math.max(...balances.map(b => b.lastUpdated), 0)
    };
  }

  /**
   * Disconnect from Validator services
   */
  async disconnect(): Promise<void> {
    try {
      // Stop all balance updates
      this.stopBalanceUpdates();
      
      // Save cached data
      if (this.config.enableCaching) {
        await this.saveCachedData();
      }
      
      // Save balance history
      if (this.config.enableHistoryTracking) {
        await this.saveAllBalanceHistory();
      }
      
      // Disconnect from validator client
      await this.validatorClient.disconnect();
      
      console.warn('Validator Balance Service disconnected');
    } catch (error) {
      console.error('Error disconnecting balance service:', error);
    }
  }

  // Private helper methods
  private async loadCachedData(): Promise<void> {
    try {
      const cached = localStorage.getItem(`balance_cache_${this.config.userId}`);
      if (cached) {
        this.balanceCache = JSON.parse(cached);
        
        // Update reactive reference
        const balances: Record<string, AccountBalance> = {};
        Object.entries(this.balanceCache).forEach(([address, cached]) => {
          balances[address] = cached.balance;
        });
        this.balancesRef.value = balances;
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }

  private async saveCachedData(): Promise<void> {
    try {
      localStorage.setItem(
        `balance_cache_${this.config.userId}`,
        JSON.stringify(this.balanceCache)
      );
    } catch (error) {
      console.error('Error saving cached data:', error);
    }
  }

  private async loadBalanceHistory(): Promise<void> {
    try {
      const stored = localStorage.getItem(`balance_history_${this.config.userId}`);
      if (stored) {
        const historyData = JSON.parse(stored);
        Object.entries(historyData).forEach(([address, history]) => {
          this.balanceHistory.set(address, history as BalanceHistory[]);
        });
        
        // Update reactive reference
        this.historyRef.value = historyData;
      }
    } catch (error) {
      console.error('Error loading balance history:', error);
    }
  }

  private async saveBalanceHistory(_address: string, _history: BalanceHistory[]): Promise<void> {
    try {
      const allHistory = Object.fromEntries(this.balanceHistory.entries());
      localStorage.setItem(
        `balance_history_${this.config.userId}`,
        JSON.stringify(allHistory)
      );
    } catch (error) {
      console.error('Error saving balance history:', error);
    }
  }

  private async saveAllBalanceHistory(): Promise<void> {
    try {
      const allHistory = Object.fromEntries(this.balanceHistory.entries());
      localStorage.setItem(
        `balance_history_${this.config.userId}`,
        JSON.stringify(allHistory)
      );
    } catch (error) {
      console.error('Error saving all balance history:', error);
    }
  }

  private startPriceUpdates(): void {
    // Update prices every 5 minutes
    setInterval(() => {
      this.updateAllPrices().catch(error => {
        console.error('Error updating prices:', error);
      });
    }, 5 * 60 * 1000);
  }

  private async updateAllPrices(): Promise<void> {
    try {
      const symbols = new Set<string>();
      
      // Collect all unique token symbols
      Object.values(this.balancesRef.value).forEach(balance => {
        balance.tokens.forEach(token => {
          symbols.add(token.symbol);
        });
      });
      
      // Update prices for all symbols
      const pricePromises = Array.from(symbols).map(symbol => 
        this.getTokenPrice(symbol).catch(error => {
          console.error(`Error updating price for ${symbol}:`, error);
          return null;
        })
      );
      
      await Promise.all(pricePromises);
    } catch (error) {
      console.error('Error updating all prices:', error);
    }
  }
}

// Export configured instance
export const validatorBalance = new ValidatorBalanceService({
  validatorEndpoint: import.meta.env.VITE_VALIDATOR_ENDPOINT || 'localhost:3000',
  networkId: import.meta.env.VITE_NETWORK_ID || 'omnibazaar-mainnet',
  userId: '', // Will be set when user logs in
  enableCaching: true,
  cacheTimeout: 30000, // 30 seconds
  enableHistoryTracking: true
});

export default ValidatorBalanceService;