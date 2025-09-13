/**
 * BridgeService - Cross-chain Bridge Service
 * 
 * Wrapper for core bridge functionality providing
 * cross-chain token transfers and bridge operations.
 */

import { CrossChainBridge } from '../../../Validator/src/services/dex/crosschain/CrossChainBridge';
import { MasterMerkleEngine } from '../../../Validator/src/engines/MasterMerkleEngine';

/** Bridge parameters */
interface BridgeParams {
  /** Source chain */
  fromChain: string;
  /** Destination chain */
  toChain: string;
  /** Token address */
  token: string;
  /** Amount to bridge */
  amount: string;
  /** Recipient address */
  recipient: string;
}

/** Bridge result */
interface BridgeResult {
  /** Transaction hash */
  txHash: string;
  /** Status */
  status: string;
  /** Estimated completion time */
  estimatedTime?: number;
}

/** Chain information */
interface ChainInfo {
  /** Chain ID */
  chainId: string;
  /** Chain name */
  name: string;
  /** Native token symbol */
  nativeToken: string;
}

/** Route information */
interface RouteInfo {
  /** Route ID */
  id: string;
  /** Bridge fee */
  fee?: string;
  /** Gas fee */
  gasFee?: string;
  /** Total fee */
  totalFee?: string;
  /** Estimated time */
  estimatedTime?: number;
}

/** Transaction status */
interface TransactionStatus {
  /** Status */
  status: string;
  /** Number of confirmations */
  confirmations?: number;
  /** Estimated completion time */
  estimatedTime?: number;
}

/**
 * Bridge service wrapper
 */
export class BridgeService {
  private crossChainBridge?: CrossChainBridge;
  private merkleEngine?: MasterMerkleEngine;
  private isInitialized = false;

  /**
   * Creates a new BridgeService instance
   */
  constructor() {}

  /**
   * Initialize the bridge service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Initialize services
      this.merkleEngine = new MasterMerkleEngine();
      this.crossChainBridge = new CrossChainBridge(this.merkleEngine);
      
      // Start the bridge service
      await this.crossChainBridge.start();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize BridgeService:', error);
      throw error;
    }
  }

  /**
   * Bridge tokens between chains
   * @param params - Bridge parameters
   * @returns Bridge result
   */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    if (!this.crossChainBridge) {
      throw new Error('Bridge service not initialized');
    }
    
    try {
      // Initiate cross-chain transfer
      const result = await this.crossChainBridge.initiateTransfer({
        sourceChain: params.fromChain,
        destinationChain: params.toChain,
        token: params.token,
        amount: BigInt(params.amount),
        recipient: params.recipient
      });
      
      return {
        txHash: result.transactionHash,
        status: result.status,
        estimatedTime: result.estimatedTime
      };
    } catch (error) {
      console.error('Bridge transfer failed:', error);
      throw error;
    }
  }

  /**
   * Get supported chains for bridging
   * @returns Array of supported chain information
   */
  async getSupportedChains(): Promise<ChainInfo[]> {
    if (!this.crossChainBridge) {
      throw new Error('Bridge service not initialized');
    }
    
    try {
      const chains = await this.crossChainBridge.getSupportedChains();
      
      return chains.map(chain => ({
        chainId: chain.chainId.toString(),
        name: chain.name,
        nativeToken: chain.nativeToken
      }));
    } catch (error) {
      console.error('Failed to get supported chains:', error);
      return [];
    }
  }

  /**
   * Clear cached bridge data
   */
  async clearCache(): Promise<void> {
    // CrossChainBridge doesn't have a specific clear cache method
    // but we can reset the service if needed
  }

  /**
   * Get available bridge routes
   * @param params - Route query parameters
   * @param params.fromChain - Source chain identifier
   * @param params.toChain - Destination chain identifier
   * @param params.token - Token address to bridge
   * @param params.amount - Amount to bridge
   * @returns Available routes
   */
  async getRoutes(params: {
    fromChain: string;
    toChain: string;
    token: string;
    amount: string;
  }): Promise<RouteInfo[]> {
    if (!this.crossChainBridge) {
      throw new Error('Bridge service not initialized');
    }
    
    try {
      const routes = await this.crossChainBridge.getAvailableRoutes(
        params.fromChain,
        params.toChain,
        params.token
      );
      
      return routes.map(route => ({
        id: route.id,
        fee: route.bridgeFee?.toString(),
        gasFee: route.gasFee?.toString(),
        totalFee: route.totalFee?.toString(),
        estimatedTime: route.estimatedTime
      }));
    } catch (error) {
      console.error('Failed to get bridge routes:', error);
      return [];
    }
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
    if (!this.crossChainBridge) {
      throw new Error('Bridge service not initialized');
    }
    
    try {
      const status = await this.crossChainBridge.getTransferStatus(txHash);
      
      return {
        status: status.status,
        confirmations: status.confirmations,
        estimatedTime: status.estimatedCompletionTime
      };
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      return { status: 'unknown' };
    }
  }

  /**
   * Estimate bridge fees
   * @param params - Fee estimation parameters
   * @param params.fromChain - Source chain identifier
   * @param params.toChain - Destination chain identifier
   * @param params.token - Token address
   * @param params.amount - Amount to estimate fees for
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
    if (routes.length === 0) {
      throw new Error('No bridge routes available');
    }

    const route = routes[0];
    if (route === undefined) {
      throw new Error('No bridge routes available');
    }
    
    const bridgeFee = route.fee ?? '0';
    const gasFee = route.gasFee ?? '0';
    const totalFee = route.totalFee ?? bridgeFee;
    
    return {
      bridgeFee,
      gasFee,
      totalFee
    };
  }

  /**
   * Cleanup bridge service resources
   */
  async cleanup(): Promise<void> {
    if (this.crossChainBridge) {
      await this.crossChainBridge.stop();
    }
    
    this.crossChainBridge = undefined;
    this.merkleEngine = undefined;
    this.isInitialized = false;
  }
}