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
   *
   * @param walletService
   */
  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   *
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.walletService.isServiceInitialized()) {
      await this.walletService.init();
    }
    
    // Load default tokens
    await this.loadDefaultTokens();
    
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
    if (!wallet) throw new Error('Wallet not available');
    
    const address = walletAddress || await wallet.getAddress();
    const provider = await providerManager.getActiveProvider();
    
    if (!provider) {
      throw new Error('No active provider');
    }
    
    try {
      const contract = new Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      return balance;
    } catch (error) {
      // If contract call fails, return 0
      return BigInt(0);
    }
  }

  /**
   *
   * @param tokenAddress
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    return this.supportedTokens.get(tokenAddress.toLowerCase()) || null;
  }

  /**
   *
   */
  async getAllTokenBalances(): Promise<TokenBalance[]> {
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
          const valueUSD = price ? parseFloat(formatted) * price : undefined;
          
          balances.push({
            token: { ...token, chain },
            balance,
            balanceFormatted: formatted,
            valueUSD,
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
    if (!wallet) throw new Error('Wallet not available');
    
    const provider = await providerManager.getActiveProvider();
    if (!provider) throw new Error('No active provider');
    
    const signer = await provider.getSigner();
    const contract = new Contract(tokenAddress, ERC20_ABI, signer);
    
    const tx = await contract.transfer(recipient, amount);
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
    if (!wallet) throw new Error('Wallet not available');
    
    const provider = await providerManager.getActiveProvider();
    if (!provider) throw new Error('No active provider');
    
    const signer = await provider.getSigner();
    const contract = new Contract(tokenAddress, ERC20_ABI, signer);
    
    const tx = await contract.approve(spender, amount);
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
    
    const provider = await providerManager.getActiveProvider();
    if (!provider) throw new Error('No active provider');
    
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await contract.allowance(owner, spender);
    
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
    
    const provider = await providerManager.getActiveProvider();
    if (!provider) throw new Error('No active provider');
    
    const contract = new Contract(token.address, ERC20_ABI, provider);
    
    // Fetch token metadata from chain if not provided
    const [symbol, name, decimals, totalSupply] = await Promise.all([
      token.symbol || contract.symbol(),
      token.name || contract.name(),
      token.decimals || contract.decimals(),
      contract.totalSupply()
    ]);
    
    const network = await provider.getNetwork();
    
    const tokenInfo: TokenInfo = {
      address: token.address,
      symbol,
      name,
      decimals,
      chainId: Number(network.chainId),
      chain: network.name,
      totalSupply,
      isCustom: true,
      logoURI: token.logoURI
    };
    
    this.supportedTokens.set(token.address.toLowerCase(), tokenInfo);
    
    // Save to persistent storage
    const customTokens = this.getCustomTokens();
    customTokens.push(tokenInfo);
    localStorage.setItem('customTokens', JSON.stringify(customTokens));
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
      if (token) {
        try {
          const price = await priceFeedService.getPrice(token.symbol);
          if (price) {
            prices.set(address, price);
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
  async getPopularTokens(chain: string): Promise<TokenInfo[]> {
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
    
    return popularTokensByChain[chain] || [];
  }

  /**
   * Get token transaction history
   * @param walletAddress - Wallet address
   * @param tokenAddress - Token address (optional, all tokens if not provided)
   * @param limit - Number of transactions to return
   * @returns Array of token transactions
   */
  async getTokenTransactionHistory(
    walletAddress: string,
    tokenAddress?: string,
    limit: number = 10
  ): Promise<TokenTransaction[]> {
    // This would typically integrate with a blockchain indexer service
    // For now, return empty array
    return [];
  }

  /**
   * Get DeFi positions
   * @param walletAddress - Wallet address
   * @returns Array of DeFi positions
   */
  async getDeFiPositions(walletAddress: string): Promise<DeFiPosition[]> {
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
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async loadDefaultTokens(): Promise<void> {
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
      const popularTokens = await this.getPopularTokens(chain);
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
   *
   */
  async clearCache(): Promise<void> {
    this.balanceCache.clear();
  }

  /**
   *
   */
  async cleanup(): Promise<void> {
    this.supportedTokens.clear();
    this.balanceCache.clear();
    this.isInitialized = false;
    // console.log('TokenService cleanup completed');
  }
}