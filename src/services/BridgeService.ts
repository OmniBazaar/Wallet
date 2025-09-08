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