/**
 * TokenService - Token Management Service
 * 
 * Provides token operations including balance checking,
 * token transfers, and token metadata management.
 */

import { WalletService } from './WalletService';
import { ethers, Contract } from 'ethers';
import { providerManager } from '../core/providers/ProviderManager';
import { priceFeedService } from './oracle/PriceFeedService';

/** Token information */
export interface TokenInfo {
  /** Token contract address */
  address: string;
  /** Token symbol (e.g., USDC, DAI) */
  symbol: string;
  /** Token full name */
  name: string;
  /** Number of decimals */
  decimals: number;
  /** Chain ID where token exists */
  chainId: number;
  /** Token logo URL */
  logoURI?: string;
  /** Total supply of token */
  totalSupply?: bigint;
  /** Whether this is a custom added token */
  isCustom?: boolean;
  /** Chain name for multi-chain support */
  chain?: string;
}

/** Token balance */
export interface TokenBalance {
  /** Token information */
  token: TokenInfo;
  /** Raw balance in smallest unit */
  balance: bigint;
  /** Human-readable formatted balance */
  balanceFormatted: string;
  /** USD value of the balance */
  valueUSD?: number;
  /** Last update timestamp */
  lastUpdated: number;
}

/** DeFi position */
export interface DeFiPosition {
  /** Protocol name */
  protocol: string;
  /** Position type (lending, borrowing, LP, etc.) */
  type: string;
  /** Assets in position */
  assets: TokenInfo[];
  /** Position value in USD */
  valueUSD: number;
  /** APY if applicable */
  apy?: number;
}

/** Token transaction */
export interface TokenTransaction {
  /** Transaction hash */
  hash: string;
  /** From address */
  from: string;
  /** To address */
  to: string;
  /** Token transferred */
  token: TokenInfo;
  /** Amount transferred */
  amount: bigint;
  /** Timestamp */
  timestamp: number;
  /** Transaction status */
  status: 'pending' | 'success' | 'failed';
}

/** ERC20 ABI for basic operations */
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)'
];

/**
 * Token management service
 */
export class TokenService {
  private walletService: WalletService;
  private isInitialized = false;
  private supportedTokens: Map<string, TokenInfo> = new Map();
  private balanceCache: Map<string, TokenBalance> = new Map();

  /**
   * Creates a new TokenService instance
   * @param walletService - WalletService instance
   */
  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Initialize the token service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.walletService.isServiceInitialized()) {
      await this.walletService.init();
    }
    
    // Load default tokens
    this.loadDefaultTokens();
    
    this.isInitialized = true;
    // console.log('TokenService initialized');
  }

  /**
   * Get token balance for a specific token
   * @param tokenAddress - Token contract address
   * @param walletAddress - Optional wallet address (defaults to current wallet)
   * @returns Token balance in smallest unit
   */
  async getTokenBalance(tokenAddress: string, walletAddress?: string): Promise<bigint> {
    if (!ethers.isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    
    const wallet = this.walletService.getWallet();
    if (wallet === null) throw new Error('Wallet not available');
    
    const address = walletAddress ?? await wallet.getAddress();
    const provider = providerManager.getActiveProvider();
    
    if (provider === null) {
      throw new Error('No active provider');
    }
    
    try {
      // Check if provider is EVM-compatible
      if ('getProvider' in provider && typeof provider.getProvider === 'function') {
        const ethersProvider = provider.getProvider();
        const contract = new Contract(tokenAddress, ERC20_ABI, ethersProvider);
        const balance = await contract.balanceOf(address) as bigint;
        return balance;
      } else {
        throw new Error('Provider does not support ERC20 operations');
      }
    } catch (error) {
      // If contract call fails, return 0
      return BigInt(0);
    }
  }

  /**
   * Get token information by address
   * @param tokenAddress - Token contract address
   * @returns Token information or null if not found
   */
  getTokenInfo(tokenAddress: string): TokenInfo | null {
    return this.supportedTokens.get(tokenAddress.toLowerCase()) ?? null;
  }

  /**
   * Get all cached token balances
   * @returns Array of token balances from cache
   */
  getAllTokenBalances(): TokenBalance[] {
    return Array.from(this.balanceCache.values());
  }

  /**
   * Get tokens by chain
   * @param walletAddress - Wallet address to check balances for
   * @param chain - Chain name (ethereum, polygon, etc.)
   * @returns Array of token balances
   */
  async getTokensByChain(walletAddress: string, chain: string): Promise<TokenBalance[]> {
    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address');
    }
    
    // Get chain-specific tokens from our token list
    const chainTokens = Array.from(this.supportedTokens.values())
      .filter(token => token.chain === chain);
    
    // Fetch balances for each token
    const balances: TokenBalance[] = [];
    
    for (const token of chainTokens) {
      try {
        const balance = await this.getTokenBalance(token.address, walletAddress);
        if (balance > BigInt(0)) {
          const formatted = ethers.formatUnits(balance, token.decimals);
          const price = await priceFeedService.getPrice(token.symbol);
          const valueUSD = price?.priceUSD !== undefined ? parseFloat(formatted) * price.priceUSD : undefined;
          
          balances.push({
            token: { ...token, chain },
            balance,
            balanceFormatted: formatted,
            ...(valueUSD !== undefined && { valueUSD }),
            lastUpdated: Date.now()
          });
        }
      } catch (error) {
        // Skip tokens that fail to load
        continue;
      }
    }
    
    return balances;
  }

  /**
   * Transfer tokens
   * @param tokenAddress - Token contract address
   * @param recipient - Recipient address
   * @param amount - Amount to transfer in smallest unit
   * @returns Transaction hash
   */
  async transferToken(tokenAddress: string, recipient: string, amount: bigint): Promise<string> {
    if (!ethers.isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!ethers.isAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }
    
    const wallet = this.walletService.getWallet();
    if (wallet === null) throw new Error('Wallet not available');
    
    const provider = providerManager.getActiveProvider();
    if (provider === null) throw new Error('No active provider');
    
    // Check if provider has getSigner method
    if (!('getSigner' in provider) || typeof provider.getSigner !== 'function') {
      throw new Error('Provider does not support signing transactions');
    }
    const signer = await provider.getSigner();
    const contract = new Contract(tokenAddress, ERC20_ABI, signer);
    
    const tx = await contract.transfer(recipient, amount) as ethers.TransactionResponse;
    await tx.wait();
    
    return tx.hash;
  }

  /**
   * Approve token spending
   * @param tokenAddress - Token contract address  
   * @param spender - Spender address
   * @param amount - Amount to approve
   * @returns Transaction hash
   */
  async approveToken(tokenAddress: string, spender: string, amount: bigint): Promise<string> {
    if (!ethers.isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!ethers.isAddress(spender)) {
      throw new Error('Invalid spender address');
    }
    
    const wallet = this.walletService.getWallet();
    if (wallet === null) throw new Error('Wallet not available');
    
    const provider = providerManager.getActiveProvider();
    if (provider === null) throw new Error('No active provider');
    
    // Check if provider has getSigner method
    if (!('getSigner' in provider) || typeof provider.getSigner !== 'function') {
      throw new Error('Provider does not support signing transactions');
    }
    const signer = await provider.getSigner();
    const contract = new Contract(tokenAddress, ERC20_ABI, signer);
    
    const tx = await contract.approve(spender, amount) as ethers.TransactionResponse;
    await tx.wait();
    
    return tx.hash;
  }

  /**
   * Get token allowance
   * @param tokenAddress - Token contract address
   * @param owner - Owner address
   * @param spender - Spender address
   * @returns Allowance amount
   */
  async getAllowance(tokenAddress: string, owner: string, spender: string): Promise<bigint> {
    if (!ethers.isAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }
    if (!ethers.isAddress(owner)) {
      throw new Error('Invalid owner address');
    }
    if (!ethers.isAddress(spender)) {
      throw new Error('Invalid spender address');
    }
    
    const provider = providerManager.getActiveProvider();
    if (provider === null) throw new Error('No active provider');
    
    // Get appropriate provider for contract calls
    let contractRunner: ethers.ContractRunner;
    if ('getProvider' in provider && typeof provider.getProvider === 'function') {
      contractRunner = provider.getProvider();
    } else {
      throw new Error('Provider does not support contract calls');
    }
    
    const contract = new Contract(tokenAddress, ERC20_ABI, contractRunner);
    const allowance = await contract.allowance(owner, spender) as bigint;
    
    return allowance;
  }

  /**
   * Add custom token
   * @param token - Token information
   */
  async addCustomToken(token: Partial<TokenInfo> & { address: string }): Promise<void> {
    if (!ethers.isAddress(token.address)) {
      throw new Error('Invalid token address');
    }
    
    const provider = providerManager.getActiveProvider();
    if (provider === null) throw new Error('No active provider');
    
    // Get appropriate provider for contract calls
    let contractRunner: ethers.ContractRunner;
    if ('getProvider' in provider && typeof provider.getProvider === 'function') {
      contractRunner = provider.getProvider();
    } else {
      throw new Error('Provider does not support contract calls');
    }
    
    const contract = new Contract(token.address, ERC20_ABI, contractRunner);
    
    // Fetch token metadata from chain if not provided
    const [symbol, name, decimals, totalSupply] = await Promise.all([
      token.symbol ?? contract.symbol() as Promise<string>,
      token.name ?? contract.name() as Promise<string>,
      token.decimals ?? contract.decimals() as Promise<number>,
      contract.totalSupply() as Promise<bigint>
    ]);
    
    // Get network from provider
    let network;
    if ('getProvider' in provider && typeof provider.getProvider === 'function') {
      const ethersProvider = provider.getProvider();
      network = await ethersProvider.getNetwork();
    } else {
      throw new Error('Provider does not support network detection');
    }
    
    const tokenInfo: TokenInfo = {
      address: token.address,
      symbol,
      name,
      decimals,
      chainId: Number(network.chainId),
      chain: network.name,
      totalSupply,
      isCustom: true,
      ...(token.logoURI !== undefined && { logoURI: token.logoURI })
    };
    
    this.supportedTokens.set(token.address.toLowerCase(), tokenInfo);
    
    // Save to persistent storage
    const customTokens = this.getCustomTokens();
    customTokens.push(tokenInfo);
    // Convert BigInt to string for JSON serialization
    const serializable = customTokens.map(token => ({
      ...token,
      totalSupply: token.totalSupply?.toString()
    }));
    localStorage.setItem('customTokens', JSON.stringify(serializable));
  }

  /**
   * Get token prices
   * @param tokenAddresses - Array of token addresses
   * @returns Map of token address to price in USD
   */
  async getTokenPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    for (const address of tokenAddresses) {
      const token = this.supportedTokens.get(address.toLowerCase());
      if (token !== undefined) {
        try {
          const priceData = await priceFeedService.getPrice(token.symbol);
          if (priceData !== null && priceData.priceUSD !== undefined) {
            prices.set(address, priceData.priceUSD);
          }
        } catch (error) {
          // Skip tokens that fail to get price
          continue;
        }
      }
    }
    
    return prices;
  }

  /**
   * Get popular tokens for a chain
   * @param chain - Chain name
   * @returns Array of popular tokens
   */
  getPopularTokens(chain: string): TokenInfo[] {
    // Define popular tokens by chain
    const popularTokensByChain: Record<string, TokenInfo[]> = {
      ethereum: [
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          chainId: 1,
          chain: 'ethereum'
        },
        {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          decimals: 18,
          chainId: 1,
          chain: 'ethereum'
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          chainId: 1,
          chain: 'ethereum'
        }
      ],
      polygon: [
        {
          address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          chainId: 137,
          chain: 'polygon'
        },
        {
          address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          chainId: 137,
          chain: 'polygon'
        }
      ],
      avalanche: [
        {
          address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          chainId: 43114,
          chain: 'avalanche'
        }
      ]
    };
    
    return popularTokensByChain[chain] ?? [];
  }

  /**
   * Get token transaction history
   * @param _walletAddress - Wallet address
   * @param _tokenAddress - Token address (optional, all tokens if not provided)
   * @param _limit - Number of transactions to return
   * @returns Array of token transactions
   */
  getTokenTransactionHistory(
    _walletAddress: string,
    _tokenAddress?: string,
    _limit: number = 10
  ): TokenTransaction[] {
    // This would typically integrate with a blockchain indexer service
    // For now, return empty array
    return [];
  }

  /**
   * Get DeFi positions
   * @param _walletAddress - Wallet address
   * @returns Array of DeFi positions
   */
  getDeFiPositions(_walletAddress: string): DeFiPosition[] {
    // This would integrate with DeFi protocols
    // For now, return empty array
    return [];
  }

  /**
   * Get custom tokens from storage
   * @returns Array of custom tokens
   */
  private getCustomTokens(): TokenInfo[] {
    try {
      const stored = localStorage.getItem('customTokens');
      if (stored === null) return [];
      
      // Parse and convert string totalSupply back to BigInt
      const parsed = JSON.parse(stored) as Array<TokenInfo & { totalSupply?: string }>;
      return parsed.map((token) => {
        const result: TokenInfo = {
          ...token,
          ...(token.totalSupply !== undefined && { totalSupply: BigInt(token.totalSupply) })
        };
        return result;
      });
    } catch {
      return [];
    }
  }

  private loadDefaultTokens(): void {
    // Load default OmniCoin
    const defaultToken: TokenInfo = {
      address: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
      symbol: 'XOM',
      name: 'OmniCoin',
      decimals: 18,
      chainId: 1,
      chain: 'ethereum'
    };
    this.supportedTokens.set(defaultToken.address.toLowerCase(), defaultToken);
    
    // Load popular tokens for major chains
    const chains = ['ethereum', 'polygon', 'avalanche'];
    for (const chain of chains) {
      const popularTokens = this.getPopularTokens(chain);
      for (const token of popularTokens) {
        this.supportedTokens.set(token.address.toLowerCase(), token);
      }
    }
    
    // Load custom tokens from storage
    const customTokens = this.getCustomTokens();
    for (const token of customTokens) {
      this.supportedTokens.set(token.address.toLowerCase(), token);
    }
  }

  /**
   * Clear the token balance cache
   */
  clearCache(): void {
    this.balanceCache.clear();
  }

  /**
   * Clean up service resources
   */
  cleanup(): void {
    this.supportedTokens.clear();
    this.balanceCache.clear();
    this.isInitialized = false;
    // console.log('TokenService cleanup completed');
  }

  /**
   * Get all tokens across all chains
   * @param walletAddress - Wallet address
   * @returns Array of all token balances
   */
  async getAllTokens(walletAddress: string): Promise<TokenBalance[]> {
    const chains = ['ethereum', 'avalanche', 'polygon', 'bsc', 'arbitrum', 'optimism'];
    const allTokens: TokenBalance[] = [];
    
    for (const chain of chains) {
      try {
        const tokens = await this.getTokensByChain(walletAddress, chain);
        allTokens.push(...tokens);
      } catch (_error) {
        // Continue with other chains if one fails
        // Silently skip failed chains
      }
    }
    
    return allTokens;
  }

  /**
   * Get price history for a token
   * @param tokenAddress - Token contract address
   * @param _chain - Chain name
   * @param period - Time period (e.g., '7d', '30d')
   * @returns Array of price points
   */
  async getPriceHistory(tokenAddress: string, _chain: string, period: string): Promise<Array<{ timestamp: number; price: number }>> {
    try {
      // Get token info to find symbol
      const tokenInfo = this.supportedTokens.get(tokenAddress.toLowerCase());
      if (!tokenInfo) {
        return [];
      }
      
      // Calculate time range
      const now = Date.now();
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '1d' ? 1 : 7;
      const from = now - (days * 24 * 60 * 60 * 1000);
      
      // Get historical prices from price feed service
      const historicalData = await priceFeedService.getHistoricalPrices({
        symbol: tokenInfo.symbol,
        from,
        to: now,
        interval: period === '1d' ? '1h' : '1d'
      });
      
      return historicalData.map(point => ({
        timestamp: point.timestamp,
        price: point.price
      }));
    } catch (error) {
      console.error('Failed to get price history:', error);
      return [];
    }
  }

  /**
   * Convert token amounts between different tokens
   * @param params - Conversion parameters
   * @param params.fromToken - Address of the token to convert from
   * @param params.toToken - Address of the token to convert to
   * @param params.amount - Amount to convert in smallest unit
   * @param params.chain - Blockchain chain name
   * @returns Converted amount and exchange rate
   */
  async convertToken(params: {
    fromToken: string;
    toToken: string;
    amount: bigint;
    chain: string;
  }): Promise<{ amount: bigint; rate: number }> {
    // Get prices for both tokens
    const prices = await this.getTokenPrices([params.fromToken, params.toToken]);
    const fromPrice = prices.get(params.fromToken) ?? 1;
    const toPrice = prices.get(params.toToken) ?? 1;
    
    // Calculate conversion rate
    const rate = fromPrice / toPrice;
    
    // Convert amount (simplified - in reality would need decimal handling)
    const convertedAmount = BigInt(Math.floor(Number(params.amount) * rate));
    
    return {
      amount: convertedAmount,
      rate
    };
  }

  /**
   * Search for tokens by name or symbol
   * @param query - Search query
   * @returns Array of matching tokens
   */
  searchTokens(query: string): TokenInfo[] {
    const allTokens: TokenInfo[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Search through supported tokens
    for (const token of this.supportedTokens.values()) {
      if (token.symbol.toLowerCase().includes(lowerQuery) || 
          token.name.toLowerCase().includes(lowerQuery)) {
        allTokens.push(token);
      }
    }
    
    return allTokens;
  }

  /**
   * Check if a contract address is a valid token
   * @param address - Contract address
   * @param _chain - Chain name
   * @returns True if valid token
   */
  isValidToken(address: string, _chain: string): boolean {
    if (!ethers.isAddress(address)) return false;
    
    try {
      // Try to get token info
      const info = this.getTokenInfo(address);
      return info !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed token metadata
   * @param address - Token address
   * @param _chain - Chain name
   * @returns Token metadata
   */
  getTokenMetadata(address: string, _chain: string): {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply?: bigint;
    logoUri?: string;
  } | null {
    const info = this.getTokenInfo(address);
    if (info === null) return null;
    
    return {
      name: info.name,
      symbol: info.symbol,
      decimals: info.decimals,
      ...(info.totalSupply !== undefined && { totalSupply: info.totalSupply }),
      ...(info.logoURI !== undefined && { logoUri: info.logoURI })
    };
  }

  /**
   * Get transactions filtered by type
   * @param walletAddress - Wallet address
   * @param type - Transaction type ('sent' | 'received' | 'all')
   * @returns Filtered transactions
   */
  getTransactionsByType(walletAddress: string, type: 'sent' | 'received' | 'all'): TokenTransaction[] {
    const history = this.getTokenTransactionHistory(walletAddress);
    
    if (type === 'all') return history;
    if (type === 'sent') return history.filter(tx => tx.from?.toLowerCase() === walletAddress.toLowerCase());
    if (type === 'received') return history.filter(tx => tx.to?.toLowerCase() === walletAddress.toLowerCase());
    
    return [];
  }

  /**
   * Calculate yield for DeFi positions
   * @param params - Yield calculation parameters
   * @param params.protocol - DeFi protocol name
   * @param params.token - Token address
   * @param params.amount - Amount staked/deposited
   * @param params.duration - Duration in days
   * @returns Yield information with APY and estimated rewards
   */
  calculateYield(params: {
    protocol: string;
    token: string;
    amount: bigint;
    duration: number;
  }): {
    apy: number;
    estimatedRewards: bigint;
    protocol: string;
  } {
    // Mock yield calculation
    const apyRates: Record<string, number> = {
      'aave': 5.2,
      'compound': 4.8,
      'yearn': 8.5,
      'curve': 6.3
    };
    
    const apy = apyRates[params.protocol] ?? 5.0;
    const dailyRate = apy / 365 / 100;
    const estimatedRewards = BigInt(Math.floor(Number(params.amount) * dailyRate * params.duration));
    
    return {
      apy,
      estimatedRewards,
      protocol: params.protocol
    };
  }
}