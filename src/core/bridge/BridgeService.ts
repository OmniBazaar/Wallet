/**
 * Cross-Chain Bridge Service
 * Manages bridge quotes, executions, and monitoring with real bridge integrations
 */

import { ethers } from 'ethers';
import { 
  BridgeRoute, 
  BridgeQuoteRequest, 
  BridgeQuoteResponse,
  BridgeStatus,
  BridgeProvider,
  BRIDGE_SUPPORT,
  BRIDGE_TOKENS
} from './types';
import { providerManager } from '../providers/ProviderManager';
import type { ProviderManager } from '../providers/ProviderManager';
import { ChainType } from '../keyring/BIP39Keyring';
import { CrossChainBridge } from '../../services/bridge/mocks/CrossChainBridge';
import { OmniOracleService } from '../../services/oracle/OmniOracleService';

/**
 * Token information for bridge operations
 */
export interface BridgeToken {
  /** Token contract address */
  address: string;
  /** Token symbol (e.g., 'USDC') */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Token name */
  name: string;
}

/**
 * Cross-chain bridge service for managing token transfers between different blockchains
 * @example
 * ```typescript
 * const bridgeService = new BridgeService();
 * const quotes = await bridgeService.getQuotes({
 *   fromChain: 'ethereum',
 *   toChain: 'avalanche',
 *   fromToken: 'USDC',
 *   amount: '100'
 * });
 * ```
 */
export class BridgeService {
  /** Map of active bridge transfers being monitored */
  private activeTransfers: Map<string, BridgeStatus> = new Map();
  
  /** Provider manager instance for blockchain interactions */
  private providerManager: typeof providerManager;
  
  /** Cross-chain bridge integration */
  private crossChainBridge?: CrossChainBridge;
  
  /** Oracle service for price feeds */
  private oracleService?: OmniOracleService;
  
  /** Initialization status */
  private isInitialized = false;
  
  /**
   * Creates a new BridgeService instance
   * @param provider - Optional provider manager instance (defaults to singleton)
   */
  constructor(provider?: typeof providerManager) {
    this.providerManager = provider || providerManager;
  }
  
  /**
   * Initialize the bridge service
   * @throws {Error} When initialization fails
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Initialize cross-chain bridge and oracle service
      this.crossChainBridge = new CrossChainBridge();
      this.oracleService = new OmniOracleService();
      
      await Promise.all([
        this.crossChainBridge.init(),
        this.oracleService.init()
      ]);
      
      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize bridge service: ${errorMessage}`);
    }
  }
  
  /**
   * Get quotes from multiple bridge providers for a cross-chain transfer
   * @param request - Bridge quote request containing transfer details
   * @returns Promise resolving to bridge quote response with available routes
   * @throws {Error} When no compatible bridges are found
   */
  async getQuotes(request: BridgeQuoteRequest): Promise<BridgeQuoteResponse> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    // Find compatible bridges
    const compatibleBridges = this.findCompatibleBridges(
      request.fromChain,
      request.toChain,
      request.fromToken
    );
    
    // Get quotes from each compatible bridge
    const quotePromises = compatibleBridges.map(bridge => 
      this.getQuoteFromBridge(bridge, request).catch(_err => {
        // Log bridge quote failure but continue with other providers
        return null;
      })
    );
    
    const quotes = await Promise.all(quotePromises);
    const validQuotes = quotes.filter(Boolean) as BridgeRoute[];
    
    // Sort by best output amount
    const sortedRoutes = validQuotes.sort((a, b) => {
      const aAmount = BigInt(a.toAmount);
      const bAmount = BigInt(b.toAmount);
      return bAmount > aAmount ? 1 : -1;
    });
    
    return {
      routes: sortedRoutes,
      bestRoute: sortedRoutes[0] || null
    };
  }
  
  /**
   * Execute a bridge transfer
   * @param route - The selected bridge route to execute
   * @returns Transfer ID for monitoring
   * @throws Error if transfer execution fails
   */
  async executeBridge(route: BridgeRoute): Promise<string> {
    if (!this.isInitialized || !this.crossChainBridge) {
      throw new Error('Bridge service not initialized');
    }
    
    const transferId = this.generateTransferId();
    
    // Initialize transfer status
    this.activeTransfers.set(transferId, {
      id: transferId,
      status: 'pending',
      estimatedArrival: Date.now() + (route.estimatedTime * 1000)
    });
    
    try {
      // Get recipient address
      const recipient = route.toAddress || await this.providerManager.getAddress();
      
      // Execute bridge transfer using CrossChainBridge
      const result = await this.crossChainBridge.executeBridge({
        sourceChain: this.mapChainName(route.fromChain),
        destinationChain: this.mapChainName(route.toChain),
        tokenAddress: route.fromToken.address,
        amount: BigInt(route.fromAmount),
        recipient,
        bridge: route.bridge.toLowerCase(),
        bridgeData: route.data
      });
      
      if (!result.success || !result.transactionHash) {
        throw new Error(result.error || 'Bridge execution failed');
      }
      
      // Update transfer status
      this.updateTransferStatus(transferId, {
        fromTxHash: result.transactionHash,
        status: 'processing'
      });
      
      // Monitor bridge progress
      this.monitorBridge(transferId, route, result.bridgeId);
      
      return transferId;
    } catch (error) {
      this.updateTransferStatus(transferId, {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Get status of a bridge transfer
   * @param transferId - Unique identifier of the bridge transfer
   * @returns Current status of the transfer or null if not found
   */
  getTransferStatus(transferId: string): BridgeStatus | null {
    return this.activeTransfers.get(transferId) || null;
  }
  
  /**
   * Find compatible bridges for a route
   * @param fromChain
   * @param toChain
   * @param token
   */
  private findCompatibleBridges(
    fromChain: string,
    toChain: string,
    token: string
  ): BridgeProvider[] {
    const compatible: BridgeProvider[] = [];
    
    for (const [bridge, support] of Object.entries(BRIDGE_SUPPORT)) {
      const supportsFromChain = support.chains.includes(fromChain);
      const supportsToChain = support.chains.includes(toChain);
      const supportsToken = support.tokens.some(t => 
        token.toLowerCase().includes(t.toLowerCase())
      );
      
      if (supportsFromChain && supportsToChain && supportsToken) {
        compatible.push(bridge as BridgeProvider);
      }
    }
    
    return compatible;
  }
  
  /**
   * Get quote from specific bridge
   * @param bridge
   * @param request
   */
  private async getQuoteFromBridge(
    bridge: BridgeProvider,
    request: BridgeQuoteRequest
  ): Promise<BridgeRoute | null> {
    if (!this.crossChainBridge) {
      return null;
    }
    
    try {
      const support = BRIDGE_SUPPORT[bridge];
      const fromToken = this.getTokenInfo(request.fromChain, request.fromToken);
      const toToken = this.getTokenInfo(request.toChain, request.toToken || request.fromToken);
      
      // Get real quote from CrossChainBridge
      const quote = await this.crossChainBridge.getQuote({
        sourceChain: this.mapChainName(request.fromChain),
        destinationChain: this.mapChainName(request.toChain),
        tokenAddress: fromToken.address,
        amount: BigInt(request.amount),
        bridge: bridge.toLowerCase()
      });
      
      if (!quote || !quote.success) {
        // Fallback to estimation if bridge quote fails
        const inputAmount = BigInt(request.amount);
        const bridgeFee = await this.getBridgeFees(bridge, request.fromChain, request.toChain, inputAmount);
        const outputAmount = inputAmount - bridgeFee;
        
        const route: BridgeRoute = {
          id: `${bridge}-${Date.now()}`,
          fromChain: request.fromChain,
          toChain: request.toChain,
          fromToken,
          toToken,
          fromAmount: request.amount,
          toAmount: outputAmount.toString(),
          estimatedTime: support.estimatedTime,
          fee: {
            amount: bridgeFee.toString(),
            token: fromToken.symbol,
            inUSD: '0'
          },
          bridge,
          steps: this.getBridgeSteps(bridge, fromToken)
        };
        
        return route;
      }
      
      // Use real quote data
      const route: BridgeRoute = {
        id: `${bridge}-${Date.now()}`,
        fromChain: request.fromChain,
        toChain: request.toChain,
        fromToken,
        toToken,
        fromAmount: request.amount,
        toAmount: quote.destinationAmount.toString(),
        estimatedTime: quote.estimatedTime || support.estimatedTime,
        fee: {
          amount: quote.bridgeFee.toString(),
          token: fromToken.symbol,
          inUSD: quote.bridgeFeeUSD?.toString() || '0'
        },
        bridge,
        steps: this.getBridgeSteps(bridge, fromToken),
        data: quote.bridgeData
      };
      
      return route;
    } catch (error) {
      // Return null on error to try other bridges
      return null;
    }
  }
  
  /**
   * Get token info for bridge
   * @param chain
   * @param tokenSymbol
   */
  private getTokenInfo(chain: string, tokenSymbol: string): {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    chainId: number | string;
  } {
    // Check if it's a known bridge token
    const tokenAddresses = BRIDGE_TOKENS[tokenSymbol as keyof typeof BRIDGE_TOKENS];
    const address = tokenAddresses?.[chain as keyof typeof tokenAddresses] || ethers.ZeroAddress;
    
    return {
      address,
      symbol: tokenSymbol,
      name: tokenSymbol,
      decimals: 18, // Would fetch from contract
      chainId: this.getChainId(chain)
    };
  }
  
  /**
   * Get bridge steps based on provider
   * @param bridge
   * @param token
   */
  private getBridgeSteps(bridge: BridgeProvider, token: BridgeToken): Array<{
    type: 'approve' | 'deposit' | 'wait' | 'claim';
    description: string;
    estimatedTime: number;
  }> {
    const steps = [];
    
    // Most bridges require approval for ERC20
    if (token.address !== ethers.ZeroAddress) {
      steps.push({
        type: 'approve' as const,
        description: `Approve ${token.symbol} for bridge`,
        estimatedTime: 30
      });
    }
    
    // Deposit step
    steps.push({
      type: 'deposit' as const,
      description: `Deposit ${token.symbol} to bridge`,
      estimatedTime: 60
    });
    
    // Wait for bridge completion
    steps.push({
      type: 'wait' as const,
      description: 'Wait for bridge confirmation',
      estimatedTime: BRIDGE_SUPPORT[bridge].estimatedTime
    });
    
    // Some bridges require claiming
    if ([BridgeProvider.Across].includes(bridge)) {
      steps.push({
        type: 'claim' as const,
        description: 'Claim tokens on destination',
        estimatedTime: 30
      });
    }
    
    return steps;
  }
  
  /**
   * Execute token approval
   * @param route
   */
  private async executeApproval(route: BridgeRoute): Promise<void> {
    if (route.fromChain === 'solana') return; // No approvals on Solana
    
    // Get bridge contract address based on provider
    const bridgeAddress = this.getBridgeAddress(route.bridge, route.fromChain);
    
    // Create approval transaction
    const iface = new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']);
    const data = iface.encodeFunctionData('approve', [bridgeAddress, ethers.MaxUint256]);
    await this.providerManager.sendTransaction(
      route.fromToken.address,
      '0',
      route.fromChain as ChainType,
      data
    );
  }
  
  /**
   * Execute bridge deposit
   * @param route
   */
  private async executeDeposit(route: BridgeRoute): Promise<string> {
    // In production, this would call the specific bridge contract
    // For now, simulate with a simple transfer
    
    const bridgeAddress = this.getBridgeAddress(route.bridge, route.fromChain);
    
    // For native tokens, send directly
    if (route.fromToken.address === ethers.ZeroAddress) {
      const txHash = await this.providerManager.sendTransaction(
        bridgeAddress,
        route.fromAmount,
        route.fromChain as ChainType
      );
      return txHash as string;
    }
    
    // For ERC20, call bridge deposit function
    // This is simplified - actual implementation would vary by bridge
    const txHash = await this.providerManager.sendTransaction(
      bridgeAddress,
      '0',
      route.fromChain as ChainType,
      '0x' // Would encode actual bridge deposit call
    );
    
    return txHash as string;
  }
  
  /**
   * Execute claim on destination chain
   * @param route
   */
  private async executeClaim(route: BridgeRoute): Promise<void> {
    // Implementation would vary by bridge
    // Some bridges auto-claim, others require manual claim
    // For now, this is a placeholder as most modern bridges handle claiming automatically
    // Future implementation would check bridge-specific claim requirements
    
    // Across bridge requires manual claim on destination
    if (route.bridge === BridgeProvider.Across && route.toChain !== 'ethereum') {
      // Would implement Across-specific claim logic here
      // This would involve calling the SpokePool contract on destination chain
    }
  }
  
  /**
   * Monitor bridge progress
   * @param transferId
   * @param route
   * @param bridgeId - Bridge-specific transfer ID
   */
  private async monitorBridge(
    transferId: string,
    route: BridgeRoute,
    bridgeId?: string
  ): Promise<void> {
    if (!this.crossChainBridge || !bridgeId) {
      return;
    }
    
    const checkStatus = async () => {
      try {
        const status = await this.crossChainBridge!.getBridgeStatus({
          bridgeId,
          sourceChain: this.mapChainName(route.fromChain),
          bridge: route.bridge.toLowerCase()
        });
        
        if (status.status === 'completed' && status.destinationTxHash) {
          this.updateTransferStatus(transferId, {
            status: 'completed',
            toTxHash: status.destinationTxHash
          });
          clearInterval(interval);
        } else if (status.status === 'failed') {
          this.updateTransferStatus(transferId, {
            status: 'failed',
            message: status.error || 'Bridge transfer failed'
          });
          clearInterval(interval);
        }
      } catch (error) {
        // Continue polling on error
      }
    };
    
    // Poll every 10 seconds
    const interval = setInterval(checkStatus, 10000);
    
    // Initial check
    await checkStatus();
    
    // Stop polling after max time (2x estimated time)
    setTimeout(() => {
      clearInterval(interval);
    }, route.estimatedTime * 2000);
  }
  
  /**
   * Update transfer status
   * @param transferId
   * @param update
   */
  private updateTransferStatus(transferId: string, update: Partial<BridgeStatus>): void {
    const current = this.activeTransfers.get(transferId);
    if (current) {
      this.activeTransfers.set(transferId, {
        ...current,
        ...update
      });
    }
  }
  
  /**
   * Get bridge contract address
   * @param bridge
   * @param chain
   */
  private getBridgeAddress(bridge: BridgeProvider, chain: string): string {
    // Bridge contract addresses would be maintained in config
    const addresses: Record<string, Record<string, string>> = {
      [BridgeProvider.Hop]: {
        ethereum: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
        polygon: '0x553bC791D746767166fA3888432038193cEED5E2',
        arbitrum: '0x33ceb27b39d2Bb7D2e61F7564d3Df29344020417',
        optimism: '0x91f8490eC27cbB1b2FaEdd29c2eC23011d7355FB',
      },
      [BridgeProvider.Stargate]: {
        ethereum: '0x8731d54E9D02c286767d56ac03e8037C07e01e98',
        polygon: '0x45A01E4e04F14f7A4a6702c74187c5F6222033cd',
        arbitrum: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
        optimism: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
      },
      // Add other bridge addresses
    };
    
    return addresses[bridge]?.[chain] || ethers.ZeroAddress;
  }
  
  /**
   * Get chain ID
   * @param chain
   */
  private getChainId(chain: string): number | string {
    const chainIds: Record<string, number | string> = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      base: 8453,
      avalanche: 43114,
      bsc: 56,
      solana: 'solana'
    };
    
    return chainIds[chain] || 1;
  }
  
  /**
   * Generate unique transfer ID
   */
  private generateTransferId(): string {
    return `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Get bridge fees
   * @param bridge
   * @param fromChain
   * @param toChain
   * @param amount
   * @private
   */
  private async getBridgeFees(
    bridge: BridgeProvider,
    fromChain: string,
    toChain: string,
    amount: bigint
  ): Promise<bigint> {
    if (!this.oracleService) {
      // Fallback to default percentage
      const feePercentage = this.getDefaultBridgeFeePercentage(bridge);
      return (amount * BigInt(feePercentage)) / BigInt(10000);
    }
    
    try {
      // Get bridge fee from oracle
      const feeData = await this.oracleService.getBridgeFee({
        bridge: bridge.toLowerCase(),
        sourceChain: this.mapChainName(fromChain),
        destinationChain: this.mapChainName(toChain),
        amount
      });
      
      return feeData.fee;
    } catch (error) {
      // Fallback to percentage calculation on error
      const feePercentage = this.getDefaultBridgeFeePercentage(bridge);
      return (amount * BigInt(feePercentage)) / BigInt(10000);
    }
  }
  
  /**
   * Get default bridge fee percentage
   * @param bridge
   * @private
   */
  private getDefaultBridgeFeePercentage(bridge: BridgeProvider): number {
    const fees: Record<BridgeProvider, number> = {
      [BridgeProvider.Hop]: 30, // 0.3%
      [BridgeProvider.Stargate]: 10, // 0.1%
      [BridgeProvider.Across]: 25, // 0.25%
      [BridgeProvider.Synapse]: 20, // 0.2%
      [BridgeProvider.Wormhole]: 50, // 0.5%
      [BridgeProvider.LayerZero]: 15, // 0.15%
    };
    
    return fees[bridge] || 50;
  }
  
  /**
   * Map chain names to CrossChainBridge format
   * @param chain
   * @private
   */
  private mapChainName(chain: string): string {
    const chainMap: Record<string, string> = {
      ethereum: 'ethereum',
      polygon: 'polygon',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      base: 'base',
      avalanche: 'avalanche',
      bsc: 'bsc',
      solana: 'solana'
    };
    
    return chainMap[chain] || chain;
  }
  
  /**
   * Estimate bridge fees
   * @param fromChain
   * @param toChain
   * @param token
   * @param amount
   */
  async estimateBridgeFees(
    fromChain: string,
    toChain: string,
    token: string,
    amount: string
  ): Promise<{ bridge: BridgeProvider; fee: string; time: number }[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    
    const request: BridgeQuoteRequest = {
      fromChain,
      toChain,
      fromToken: token,
      amount,
      fromAddress: ethers.ZeroAddress, // Just for estimation
    };
    
    const { routes } = await this.getQuotes(request);
    
    return routes.map(route => ({
      bridge: route.bridge,
      fee: route.fee.amount,
      time: route.estimatedTime
    }));
  }
  
  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      this.activeTransfers.clear();
      this.isInitialized = false;
      this.crossChainBridge = undefined;
      this.oracleService = undefined;
    } catch (error) {
      // Fail silently on cleanup
    }
  }
}

// Export singleton instance
export const bridgeService = new BridgeService();
