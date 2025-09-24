/**
 * Validator Balance Service Integration
 * 
 * Manages balance queries and tracking through the Validator network
 */

import { ethers } from 'ethers';
import { ref, Ref } from 'vue';
import { DebugLogger } from '../core/utils/debug-logger';
import { OmniWalletService } from '../../../Validator/src/services/OmniWalletService';
import { PriceOracleService } from '../../../Validator/src/services/PriceOracleService';
import { CacheService } from '../../../Validator/src/services/CacheService';
import { MasterMerkleEngine } from '../../../Validator/src/engines/MasterMerkleEngine';

/**
 * Balance data returned by wallet service
 */
interface BalanceData {
  /** Raw balance value */
  balance: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name?: string;
  /** Number of decimals */
  decimals: number;
  /** Formatted balance with decimals applied */
  formattedBalance: string;
}

// Create logger for this service
const logger = new DebugLogger('services:validator-balance');

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
 * Service for managing and tracking cryptocurrency balances through the Validator network.
 * Provides caching, history tracking, and reactive state management for wallet balances.
 */
export class ValidatorBalanceService {
  /** Wallet service instance for balance operations */
  private walletService?: OmniWalletService;
  /** Price oracle service for token pricing */
  private priceOracle?: PriceOracleService;
  /** Cache service for distributed caching */
  private cacheService?: CacheService;
  /** Master merkle engine for state management */
  private merkleEngine?: MasterMerkleEngine;
  /** Service configuration */
  private config: ValidatorBalanceConfig;
  /** In-memory balance cache */
  private balanceCache: BalanceCache = {};
  /** In-memory price cache */
  private priceCache: Map<string, PriceData> = new Map();
  /** Balance history tracking */
  private balanceHistory: Map<string, BalanceHistory[]> = new Map();
  /** Update interval timers */
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
  }

  /**
   * Update the user identifier used by this service.
   * @param userId - The new user identifier to set
   */
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  /**
   * Expose a readonly view of the current configuration.
   * @returns The current service configuration
   */
  public getConfig(): Readonly<ValidatorBalanceConfig> {
    return this.config;
  }

  /**
   * Initialize the balance service (validator client, caches, history).
   * @throws {Error} If initialization fails
   */
  initialize(): void {
    try {
      // Initialize services
      this.merkleEngine = new MasterMerkleEngine();
      // TODO: Fix OmniWalletService constructor to accept MasterMerkleEngine
      // this.walletService = new OmniWalletService(this.merkleEngine);
      // this.priceOracle = new PriceOracleService(this.merkleEngine);
      // this.cacheService = new CacheService(this.merkleEngine);

      // Start services
      // TODO: Implement start methods in services
      // await this.walletService.start();
      // await this.priceOracle.start();
      // await this.cacheService.start();
      
      // Load cached data
      if (this.config.enableCaching) {
        this.loadCachedData();
      }
      
      // Load balance history
      if (this.config.enableHistoryTracking) {
        this.loadBalanceHistory();
      }
      
      // Start price updates
      this.startPriceUpdates();
      
      logger.info('Validator Balance Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Validator Balance Service:', error);
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
        if (cached !== undefined && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
          this.isLoadingRef.value = false;
          return cached.balance;
        }
      }

      // Await to maintain async behavior for future GraphQL integration
      await Promise.resolve();

      // Get native balance from wallet service
      let nativeBalance = BigInt(0);
      // Get balance directly from provider
      try {
        const provider = new ethers.JsonRpcProvider(this.config.validatorEndpoint);
        nativeBalance = await provider.getBalance(address);
      } catch (error) {
        logger.error('Failed to get native balance:', error);
      }
      const nativeBalanceFormatted = ethers.formatEther(nativeBalance);

      // Get token balances
      const tokens = this.getTokenBalances(address);

      // Calculate total USD value
      let totalValueUSD = '0';
      if (tokens.length > 0) {
        const totalValue = tokens.reduce((sum, token) => {
          const valueStr = token.valueUSD;
          const value = valueStr !== undefined ? parseFloat(valueStr) : 0;
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
        this.saveCachedData();
      }

      // Update reactive reference
      this.balancesRef.value = {
        ...this.balancesRef.value,
        [address]: accountBalance
      };

      // Track balance history
      if (this.config.enableHistoryTracking) {
        this.trackBalanceHistory(address, nativeBalance.toString());
      }

      this.isLoadingRef.value = false;
      return accountBalance;
    } catch (error) {
      logger.error('Error getting balance:', error);
      this.isLoadingRef.value = false;
      throw error;
    }
  }

  /**
   * Get token balances for an address by iterating the validator token list.
   *
   * @param _address - Account address
   * @returns Array of token balances with USD values when available
   */
  getTokenBalances(_address: string): TokenBalance[] {
    try {
      if (this.walletService === undefined) {
        return [];
      }
      
      // Get token list from wallet service
      // Get token list from wallet service
      const balances: Record<string, BalanceData> = {} as Record<string, BalanceData>; // TODO: Implement getAllBalances in OmniWalletService
      const tokenBalances: TokenBalance[] = [];

      // Process each token balance
      for (const [_tokenAddress, _balanceData] of Object.entries(balances)) {
        if (_tokenAddress === 'native' || _tokenAddress === 'XOM') {
          continue; // Skip native balance
        }

        try {
          const balance = BigInt(_balanceData.balance);

          if (BigInt(balance) > BigInt(0)) {
            const _balanceFormatted = ethers.formatUnits(balance, _balanceData.decimals);

            // Get price data
            const priceData = this.getTokenPrice(_balanceData.symbol);
            const priceUSD = priceData?.price ?? '0';
            const valueUSD = (parseFloat(_balanceData.formattedBalance) * parseFloat(priceUSD)).toFixed(2);

            tokenBalances.push({
              address: _tokenAddress,
              symbol: _balanceData.symbol,
              name: _balanceData.name ?? _balanceData.symbol,
              decimals: _balanceData.decimals,
              balance: balance.toString(),
              balanceFormatted: _balanceData.formattedBalance,
              priceUSD,
              valueUSD,
              lastUpdated: Date.now()
            });
          }
        } catch (error) {
          logger.error(`Error getting balance for token ${_tokenAddress}:`, error);
        }
      }

      return tokenBalances.sort((a, b) => {
        const aValueStr = a.valueUSD;
        const bValueStr = b.valueUSD;
        const aValue = aValueStr !== undefined ? parseFloat(aValueStr) : 0;
        const bValue = bValueStr !== undefined ? parseFloat(bValueStr) : 0;
        return bValue - aValue;
      });
    } catch (error) {
      logger.error('Error getting token balances:', error);
      return [];
    }
  }

  /**
   * Get multiple account balances
   * @param addresses - Array of addresses to query
   * @returns Record of addresses to account balances
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
            logger.error(`Error getting balance for ${address}:`, error);
            return null;
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result !== null) {
            const tokenAddress = batch[index];
            if (tokenAddress) {
              balances[tokenAddress] = result;
            }
          }
        });
      }
      
      this.isLoadingRef.value = false;
      return balances;
    } catch (error) {
      logger.error('Error getting multiple balances:', error);
      this.isLoadingRef.value = false;
      return {};
    }
  }

  /**
   * Get token price
   * @param symbol - Token symbol to get price for
   * @returns Price data or null if not available
   */
  getTokenPrice(symbol: string): PriceData | null {
    try {
      // Check cache first
      const cached = this.priceCache.get(symbol);
      if (cached !== undefined && (Date.now() - cached.lastUpdated) < 60000) { // 1 minute cache
        return cached;
      }

      // Get price from price oracle
      if (this.priceOracle === undefined) {
        return null;
      }
      
      const price = 0; // TODO: Implement getPrice in PriceOracleService
      const change24h = 0; // TODO: Implement get24hChange in PriceOracleService
      
      if (price === 0) {
        return null;
      }

      const priceData: PriceData = {
        symbol,
        price: String(price),
        change24h: String(change24h),
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
      logger.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Start automatic balance updates
   * @param addresses - Array of addresses to monitor
   * @param interval - Update interval in milliseconds (default: 30000)
   */
  startBalanceUpdates(addresses: string[], interval = 30000): void {
    addresses.forEach(address => {
      // Clear existing interval if any
      this.stopBalanceUpdates(address);
      
      // Start new interval
      const intervalId = setInterval(() => {
        void this.getBalance(address, false).catch(error => {
          logger.error(`Error updating balance for ${address}:`, error);
        });
      }, interval);
      
      this.updateIntervals.set(address, intervalId);
    });
  }

  /**
   * Stop automatic balance updates
   * @param address - Optional address to stop updates for. If not provided, stops all updates
   */
  stopBalanceUpdates(address?: string): void {
    if (address !== undefined) {
      const intervalId = this.updateIntervals.get(address);
      if (intervalId !== undefined) {
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
   * @param address - Address to get history for
   * @param limit - Maximum number of history entries to return (default: 100)
   * @returns Array of balance history entries, most recent first
   */
  getBalanceHistory(address: string, limit = 100): BalanceHistory[] {
    const history = this.balanceHistory.get(address) ?? [];
    return history.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Track balance history
   * @param address - Address to track history for
   * @param balance - Current balance value
   */
  private trackBalanceHistory(address: string, balance: string): void {
    try {
      if (!this.config.enableHistoryTracking) {
        return;
      }

      const history = this.balanceHistory.get(address) ?? [];
      
      // Get current block number from wallet service
      let currentBlock = 0;
      if (this.walletService !== undefined) {
        try {
          // TODO: Implement getCurrentBlockNumber in OmniWalletService
          currentBlock = 0;
        } catch (error) {
          logger.error('Failed to get current block number:', error);
        }
      }
      
      // Only add if balance has changed
      const lastEntry = history[history.length - 1];
      if (lastEntry === undefined || lastEntry.balance !== balance) {
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
        this.saveBalanceHistory(address, history);
      }
    } catch (error) {
      logger.error('Error tracking balance history:', error);
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
      void this.saveCachedData();
    }
  }

  /**
   * Export balance data
   * @param format - Export format, either 'json' or 'csv' (default: 'json')
   * @returns Exported data as string in the requested format
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
        balance.totalValueUSD ?? '0',
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
      const valueStr = balance.totalValueUSD;
      return sum + (valueStr !== undefined ? parseFloat(valueStr) : 0);
    }, 0);
    
    // Aggregate tokens across all accounts
    const tokenMap = new Map<string, TokenBalance>();
    balances.forEach(balance => {
      balance.tokens.forEach(token => {
        const existing = tokenMap.get(token.symbol);
        if (existing !== undefined) {
          const totalBalance = parseFloat(existing.balanceFormatted) + parseFloat(token.balanceFormatted);
          const existingValue = existing.valueUSD !== undefined ? parseFloat(existing.valueUSD) : 0;
          const tokenValue = token.valueUSD !== undefined ? parseFloat(token.valueUSD) : 0;
          const totalValue = existingValue + tokenValue;
          
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
      .sort((a, b) => {
        const bValue = b.valueUSD !== undefined ? parseFloat(b.valueUSD) : 0;
        const aValue = a.valueUSD !== undefined ? parseFloat(a.valueUSD) : 0;
        return bValue - aValue;
      })
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
  disconnect(): void {
    try {
      // Stop all balance updates
      this.stopBalanceUpdates();
      
      // Save cached data
      if (this.config.enableCaching) {
        this.saveCachedData();
      }
      
      // Save balance history
      if (this.config.enableHistoryTracking) {
        this.saveAllBalanceHistory();
      }
      
      // Stop services
      if (this.walletService !== undefined) {
        // TODO: Implement stop method in OmniWalletService
        // await this.walletService.stop();
      }
      if (this.priceOracle !== undefined) {
        // TODO: Implement stop method in PriceOracleService
        // await this.priceOracle.stop();
      }
      if (this.cacheService !== undefined) {
        // TODO: Implement stop method in CacheService
        // await this.cacheService.stop();
      }
      
      logger.info('Validator Balance Service disconnected');
    } catch (error) {
      logger.error('Error disconnecting balance service:', error);
    }
  }

  /**
   * Cleanup resources and stop services
   */
  cleanup(): void {
    this.disconnect();
    
    // Clear all data
    this.balanceCache = {};
    this.priceCache.clear();
    this.balanceHistory.clear();
    this.updateIntervals.clear();
    
    // Clear reactive references
    this.balancesRef.value = {};
    this.pricesRef.value = {};
    this.historyRef.value = {};
    
    // Clear service references
    delete this.walletService;
    delete this.priceOracle;
    delete this.cacheService;
    delete this.merkleEngine;
  }

  // Private helper methods
  /**
   * Load cached balance data from localStorage
   */
  private loadCachedData(): void {
    try {
      const cached = localStorage.getItem(`balance_cache_${this.config.userId}`);
      if (cached !== null) {
        const parsedCache = JSON.parse(cached) as unknown;
        if (typeof parsedCache === 'object' && parsedCache !== null) {
          this.balanceCache = parsedCache as BalanceCache;
        }

        // Update reactive reference
        const balances: Record<string, AccountBalance> = {};
        Object.entries(this.balanceCache).forEach(([address, cached]) => {
          balances[address] = cached.balance;
        });
        this.balancesRef.value = balances;
      }
    } catch (error) {
      logger.error('Error loading cached data:', error);
    }
  }

  /**
   * Save cache data to localStorage
   */
  private saveCachedData(): void {
    try {
      localStorage.setItem(
        `balance_cache_${this.config.userId}`,
        JSON.stringify(this.balanceCache)
      );
    } catch (error) {
      logger.error('Error saving cached data:', error);
    }
  }

  /**
   * Load balance history from localStorage
   */
  private loadBalanceHistory(): void {
    try {
      const stored = localStorage.getItem(`balance_history_${this.config.userId}`);
      if (stored !== null) {
        const historyData = JSON.parse(stored) as unknown;
        if (typeof historyData === 'object' && historyData !== null) {
          Object.entries(historyData as Record<string, unknown>).forEach(([address, history]) => {
            if (Array.isArray(history)) {
              this.balanceHistory.set(address, history as BalanceHistory[]);
            }
          });
          
          // Update reactive reference
          this.historyRef.value = historyData as Record<string, BalanceHistory[]>;
        }
      }
    } catch (error) {
      logger.error('Error loading balance history:', error);
    }
  }

  /**
   * Save balance history for a specific address
   * @param _address - Address to save history for
   * @param _history - History entries to save
   */
  private saveBalanceHistory(_address: string, _history: BalanceHistory[]): void {
    try {
      const allHistory = Object.fromEntries(this.balanceHistory.entries());
      localStorage.setItem(
        `balance_history_${this.config.userId}`,
        JSON.stringify(allHistory)
      );
    } catch (error) {
      logger.error('Error saving balance history:', error);
    }
  }

  /**
   * Save all balance history to localStorage
   */
  private saveAllBalanceHistory(): void {
    try {
      const allHistory = Object.fromEntries(this.balanceHistory.entries());
      localStorage.setItem(
        `balance_history_${this.config.userId}`,
        JSON.stringify(allHistory)
      );
    } catch (error) {
      logger.error('Error saving all balance history:', error);
    }
  }

  /**
   * Start periodic price updates
   */
  private startPriceUpdates(): void {
    // Update prices every 5 minutes
    setInterval(() => {
      try {
        this.updateAllPrices();
      } catch (error) {
        logger.error('Error updating prices:', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Update prices for all tracked tokens
   */
  private updateAllPrices(): void {
    try {
      const symbols = new Set<string>();

      // Collect all unique token symbols
      Object.values(this.balancesRef.value).forEach(balance => {
        balance.tokens.forEach(token => {
          symbols.add(token.symbol);
        });
      });

      // Update prices for all symbols
      Array.from(symbols).forEach(symbol => {
        try {
          this.getTokenPrice(symbol);
        } catch (error) {
          logger.error(`Error updating price for ${symbol}:`, error);
        }
      });
    } catch (error) {
      logger.error('Error updating all prices:', error);
    }
  }
}

/**
 * Pre-configured instance of ValidatorBalanceService for use throughout the application.
 * This singleton instance is initialized with default configuration from environment variables.
 * The userId should be set when a user logs in using validatorBalance.setUserId(userId).
 */
export const validatorBalance = new ValidatorBalanceService({
  validatorEndpoint: process.env['VITE_VALIDATOR_ENDPOINT'] ?? 'localhost:3000',
  networkId: process.env['VITE_NETWORK_ID'] ?? 'omnibazaar-mainnet',
  userId: '', // Will be set when user logs in
  enableCaching: true,
  cacheTimeout: 30000, // 30 seconds
  enableHistoryTracking: true
});

export default ValidatorBalanceService;
