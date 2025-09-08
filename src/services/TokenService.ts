/**
 * TokenService - Token Management Service
 * 
 * Provides token operations including balance checking,
 * token transfers, and token metadata management.
 */

import { WalletService } from './WalletService';
import { ethers } from 'ethers';

/** Token information */
export interface TokenInfo {
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
  chainId: number;
  /**
   *
   */
  logoURI?: string;
  /**
   *
   */
  totalSupply?: bigint;
  /**
   *
   */
  isCustom?: boolean;
}

/** Token balance */
export interface TokenBalance {
  /**
   *
   */
  token: TokenInfo;
  /**
   *
   */
  balance: bigint;
  /**
   *
   */
  balanceFormatted: string;
  /**
   *
   */
  valueUSD?: number;
  /**
   *
   */
  lastUpdated: number;
}

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
   *
   * @param tokenAddress
   */
  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    const wallet = this.walletService.getWallet();
    if (!wallet) throw new Error('Wallet not available');
    return await wallet.getTokenBalance(tokenAddress);
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

  private async loadDefaultTokens(): Promise<void> {
    // Mock default tokens
    const defaultToken: TokenInfo = {
      address: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
      symbol: 'OMNI',
      name: 'OmniCoin',
      decimals: 18,
      chainId: 1
    };
    this.supportedTokens.set(defaultToken.address.toLowerCase(), defaultToken);
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