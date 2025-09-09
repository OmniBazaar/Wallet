/**
 * BridgeService - Cross-chain Bridge Service
 * 
 * Wrapper for core bridge functionality providing
 * cross-chain token transfers and bridge operations.
 */

import { BridgeService as CoreBridgeService } from '../core/bridge/BridgeService';

/**
 * Bridge service wrapper
 */
export class BridgeService {
  private coreService: CoreBridgeService;
  private isInitialized = false;

  /**
   *
   */
  constructor() {
    this.coreService = new CoreBridgeService();
  }

  /**
   *
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    await this.coreService.initialize();
    this.isInitialized = true;
    // console.log('BridgeService initialized');
  }

  /**
   *
   * @param params
   */
  async bridge(params: any): Promise<any> {
    return await this.coreService.bridge(params);
  }

  /**
   *
   */
  async getSupportedChains(): Promise<any[]> {
    return await this.coreService.getSupportedChains();
  }

  /**
   *
   */
  async clearCache(): Promise<void> {
    if ('clearCache' in this.coreService) {
      await (this.coreService as any).clearCache();
    }
  }

  /**
   * Get available bridge routes
   * @param params - Route query parameters
   * @returns Available routes
   */
  async getRoutes(params: {
    fromChain: string;
    toChain: string;
    token: string;
    amount: string;
  }): Promise<any[]> {
    return await this.coreService.getBridgeRoutes(params.fromChain, params.toChain, params.token, params.amount);
  }

  /**
   * Get transaction status
   * @param txHash - Transaction hash
   * @returns Transaction status
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: string;
    confirmations?: number;
    estimatedTime?: number;
  }> {
    return await this.coreService.getBridgeStatus(txHash);
  }

  /**
   * Estimate bridge fees
   * @param params - Fee estimation parameters
   * @returns Fee estimates
   */
  async estimateFees(params: {
    fromChain: string;
    toChain: string;
    token: string;
    amount: string;
  }): Promise<{
    bridgeFee: string;
    gasFee: string;
    totalFee: string;
  }> {
    const routes = await this.getRoutes(params);
    if (!routes || routes.length === 0) {
      throw new Error('No bridge routes available');
    }

    const route = routes[0];
    return {
      bridgeFee: route.fee || '0',
      gasFee: route.gasFee || '0',
      totalFee: route.totalFee || route.fee || '0'
    };
  }

  /**
   *
   */
  async cleanup(): Promise<void> {
    if ('cleanup' in this.coreService) {
      await (this.coreService as any).cleanup();
    }
    this.isInitialized = false;
    // console.log('BridgeService cleanup completed');
  }
}