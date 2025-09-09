/**
 * XOMService - OmniCoin (XOM) Token Service
 * 
 * Specialized service for OmniCoin operations including staking,
 * governance, and privacy features.
 */

import { WalletService } from './WalletService';
import { ethers } from 'ethers';

/**
 * XOM-specific service
 */
export class XOMService {
  private walletService: WalletService;
  private isInitialized = false;

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
    
    this.isInitialized = true;
    // console.log('XOMService initialized');
  }

  /**
   * Get XOM balance using the standard method name
   * @param address - Wallet address to check balance for
   * @returns XOM balance in wei
   */
  async getBalance(address: string): Promise<bigint> {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid wallet address');
    }
    
    const wallet = this.walletService.getWallet();
    if (!wallet) throw new Error('Wallet not available');
    
    // For the current wallet address, use the wallet method
    const currentAddress = await wallet.getAddress();
    if (address.toLowerCase() === currentAddress.toLowerCase()) {
      const balance = await wallet.getBalance('OMNI');
      return typeof balance === 'bigint' ? balance : BigInt(balance);
    }
    
    // For other addresses, query the blockchain directly
    // This would typically use the OmniCoin contract or provider
    // For now, return 0 for addresses we don't control
    return BigInt(0);
  }

  /**
   * Get XOM balance for the current wallet
   * @returns XOM balance in wei
   */
  async getXOMBalance(): Promise<bigint> {
    const wallet = this.walletService.getWallet();
    if (!wallet) throw new Error('Wallet not available');
    const balance = await wallet.getBalance('OMNI');
    return typeof balance === 'bigint' ? balance : BigInt(balance);
  }

  /**
   *
   * @param amount
   */
  async stakeXOM(amount: bigint): Promise<any> {
    const wallet = this.walletService.getWallet();
    if (!wallet) throw new Error('Wallet not available');
    return await wallet.stakeOmniCoin(amount);
  }

  /**
   *
   */
  async getStakedBalance(): Promise<bigint> {
    const wallet = this.walletService.getWallet();
    if (!wallet) throw new Error('Wallet not available');
    return await wallet.getStakedBalance();
  }

  /**
   *
   */
  async clearCache(): Promise<void> {
    // console.log('XOMService cache cleared');
  }

  /**
   *
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    // console.log('XOMService cleanup completed');
  }
}