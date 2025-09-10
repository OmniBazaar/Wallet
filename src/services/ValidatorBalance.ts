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
 * Configuration for the Validator Balance Service integration.
 * Controls endpoints, caching and history tracking behavior.
 */
export interface ValidatorBalanceConfig {
  /** HTTP endpoint for the validator gateway */
  validatorEndpoint: string;
  /** Logical network identifier (e.g., omnicoin-testnet) */
  networkId: string;
  /** Current user identifier used for namespacing */
  userId: string;
  /** Enable in-memory + persisted caching of balances */
  enableCaching: boolean;
  /** Cache TTL in milliseconds for balance entries */
  cacheTimeout: number;
  /** Enable periodic balance history tracking */
  enableHistoryTracking: boolean;
}

/**
 * Describes a token balance and its derived values.
 */
export interface TokenBalance {
  /** Token contract address */
  address: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Number of decimals */
  decimals: number;
  /** Raw on-chain balance (wei/units) */
  balance: string;
  /** Human-readable balance formatted with decimals */
  balanceFormatted: string;
  /** Latest price in USD (optional if unknown) */
  priceUSD?: string;
  /** Latest USD value for this holding */
  valueUSD?: string;
  /** Timestamp when this balance was updated (ms) */
  lastUpdated: number;
}

/**
 * Aggregated account snapshot with native and token balances.
 */
export interface AccountBalance {
  /** Account address */
  address: string;
  /** Native balance (raw) */
  nativeBalance: string;
  /** Native balance (formatted) */
  nativeBalanceFormatted: string;
  /** Token balances */
  tokens: TokenBalance[];
  /** Total account value in USD (if prices available) */
  totalValueUSD?: string;
  /** Snapshot timestamp (ms) */
  lastUpdated: number;
}

/**
 * Historical balance point for an account.
 */
export interface BalanceHistory {
  /** Account address */
  address: string;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Native balance at this point (raw) */
  balance: string;
  /** Block number corresponding to this point */
  blockNumber: number;
  /** Optional transaction hash associated with change */
  transactionHash?: string;
}

/**
 * Cache structure keyed by address with balance snapshot and timestamp.
 */
export interface BalanceCache {
  [address: string]: {
    /** Cached balance snapshot */
    balance: AccountBalance;
    /** Time when snapshot was stored (ms) */
    timestamp: number;
  };
}

/**
 * Price information used to compute USD values for tokens.
 */
export interface PriceData {
  /** Token symbol */
  symbol: string;
  /** Last price in USD */
  price: string;
  /** 24h percentage change in USD as string */
  change24h: string;
  /** Timestamp when price was updated (ms) */
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
   * Construct the balance service with the given configuration.
   *
   * @param config ValidatorBalanceService configuration options
   */
  constructor(config: ValidatorBalanceConfig) {
    this.config = config;
    this.validatorClient = new ValidatorClient(config.validatorEndpoint);
    this.blockchain = this.validatorClient.getBlockchain();
    this.ipfsStorage = this.validatorClient.getStorage();
  }

  /**
   * Update the user identifier used by this service.
   * @param userId
   */
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /** Expose a readonly view of the current configuration. */
  public getConfig(): Readonly<ValidatorBalanceConfig> {
    return this.config;
  }

  /** Initialize the balance service (validator client, caches, history). */
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
   * Get a full account balance snapshot for an address.
   *
   * @param address Account address to query
   * @param useCache Whether to use cached results when fresh
   * @returns Aggregated balance snapshot
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
   * Get token balances for an address by iterating the validator token list.
   *
   * @param address Account address
   * @returns Array of token balances with USD values when available
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      // Get token list from blockchain
      const tokenList = await this.blockchain.getTokenList(address);
      
      if (!tokenList || tokenList.length === 0) {
        return [];
      }

      const tokenBalances: TokenBalance[] = [];

      // Get balance for each token
      for (const token of tokenList) {
        try {
          const balance = await this.blockchain.getTokenBalance(address, token.address);
          
          if (BigInt(balance) > BigInt(0)) {
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
        price: typeof priceInfo === 'string' ? priceInfo : (priceInfo as any).price,
        change24h: typeof priceInfo === 'string' ? '0' : ((priceInfo as any).change24h || '0'),
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
      Array.from(this.updateIntervals.values()).forEach(intervalId => {
        clearInterval(intervalId);
      });
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
   * Compute a portfolio summary across all tracked accounts.
   * @returns Totals, top tokens, and last updated timestamp
   */
  getPortfolioSummary(): {
    /** Number of accounts included */
    totalAccounts: number;
    /** Cumulative USD value across all accounts */
    totalValueUSD: string;
    /** Top tokens aggregated across accounts */
    topTokens: TokenBalance[];
    /** Most recent update timestamp among included balances */
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
  validatorEndpoint: process.env.VITE_VALIDATOR_ENDPOINT || 'localhost:3000',
  networkId: process.env.VITE_NETWORK_ID || 'omnibazaar-mainnet',
  userId: '', // Will be set when user logs in
  enableCaching: true,
  cacheTimeout: 30000, // 30 seconds
  enableHistoryTracking: true
});

export default ValidatorBalanceService;
