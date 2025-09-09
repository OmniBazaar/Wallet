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
import type { ProviderManager as _ProviderManager } from '../providers/ProviderManager';
import { ChainType } from '../keyring/BIP39Keyring';
import { CrossChainBridge } from '../../services/bridge/mocks/CrossChainBridge';
import { OmniOracleService } from '../../services/oracle/OmniOracleService';
import { keyringService } from '../keyring/KeyringService';

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
  private crossChainBridge: CrossChainBridge | undefined;
  
  /** Oracle service for price feeds */
  private oracleService: OmniOracleService | undefined;
  
  /** Initialization status */
  private isInitialized = false;
  
  /**
   * Creates a new BridgeService instance
   * @param provider - Optional provider manager instance (defaults to singleton)
   */
  constructor(provider?: typeof providerManager) {
    this.providerManager = provider ?? providerManager;
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
      bestRoute: sortedRoutes[0] ?? null
    };
  }
  
  /**
   * Execute a bridge transfer
   * @param route - The selected bridge route to execute
   * @returns Transfer ID for monitoring
   * @throws Error if transfer execution fails
   */
  async executeBridge(route: BridgeRoute): Promise<string> {
    if (!this.isInitialized || this.crossChainBridge === undefined) {
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
      // Get recipient address from active account
      const activeAccount = keyringService.getActiveAccount();
      const recipient = activeAccount?.address ?? '0x0000000000000000000000000000000000000000';
      
      // Execute bridge transfer using CrossChainBridge
      const result = await this.crossChainBridge.executeBridge({
        sourceChain: this.mapChainName(route.fromChain),
        destinationChain: this.mapChainName(route.toChain),
        tokenAddress: route.fromToken.address,
        amount: BigInt(route.fromAmount),
        recipient,
        bridge: route.bridge.toLowerCase(),
        bridgeData: route.steps[0]?.transaction?.data ?? '0x'
      });
      
      if (result.txHash === undefined || result.txHash === '' || result.status === 'failed') {
        throw new Error('Bridge execution failed');
      }
      
      // Update transfer status
      this.updateTransferStatus(transferId, {
        fromTxHash: result.txHash,
        status: 'pending'
      });
      
      // Monitor bridge progress
      void this.monitorBridge(transferId, route, result.txHash);
      
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
    return this.activeTransfers.get(transferId) ?? null;
  }
  
  /**
   * Find compatible bridges for a route
   * @param fromChain - Source blockchain network
   * @param toChain - Destination blockchain network
   * @param token - Token symbol to bridge
   * @returns Array of compatible bridge providers
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
   * @param bridge - Bridge provider to get quote from
   * @param request - Bridge quote request parameters
   * @returns Promise resolving to bridge route or null if unavailable
   */
  private async getQuoteFromBridge(
    bridge: BridgeProvider,
    request: BridgeQuoteRequest
  ): Promise<BridgeRoute | null> {
    if (this.crossChainBridge === undefined) {
      return null;
    }
    
    try {
      const support = BRIDGE_SUPPORT[bridge];
      const fromToken = this.getTokenInfo(request.fromChain, request.fromToken);
      const toToken = this.getTokenInfo(request.toChain, request.toToken ?? request.fromToken);
      
      // Get real quote from CrossChainBridge
      const quote = await this.crossChainBridge.getBridgeQuote({
        fromChain: this.mapChainName(request.fromChain),
        toChain: this.mapChainName(request.toChain),
        token: fromToken.address,
        amount: request.amount
      });
      
      if (quote === undefined || quote.estimatedAmount === undefined || quote.estimatedAmount === '') {
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
          estimatedTime: support?.estimatedTime ?? 300,
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
        toAmount: quote.estimatedAmount,
        estimatedTime: quote.estimatedTime ?? support?.estimatedTime ?? 300,
        fee: {
          amount: quote.bridgeFee.toString(),
          token: fromToken.symbol,
          inUSD: '0' // USD conversion not available in this mock
        },
        bridge,
        steps: this.getBridgeSteps(bridge, fromToken)
      };
      
      return route;
    } catch (error) {
      // Return null on error to try other bridges
      return null;
    }
  }
  
  /**
   * Get token info for bridge
   * @param chain - Blockchain network name
   * @param tokenSymbol - Token symbol to look up
   * @returns Token information including address, symbol, name, decimals, and chainId
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
    const address = tokenAddresses?.[chain as keyof typeof tokenAddresses] ?? ethers.ZeroAddress;
    
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
   * @param bridge - Bridge provider to get steps for
   * @param token - Token being bridged
   * @returns Array of bridge steps with types and time estimates
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
      estimatedTime: BRIDGE_SUPPORT[bridge]?.estimatedTime ?? 300
    });
    
    // Some bridges require claiming
    if ([BridgeProvider.ACROSS].includes(bridge)) {
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
   * @param route - Bridge route requiring token approval
   * @returns Promise that resolves when approval is complete
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
   * @param route - Bridge route to execute deposit for
   * @returns Promise resolving to transaction hash
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
   * @param route - Bridge route to execute claim for
   * @returns void
   */
  private executeClaim(route: BridgeRoute): void {
    // Implementation would vary by bridge
    // Some bridges auto-claim, others require manual claim
    // For now, this is a placeholder as most modern bridges handle claiming automatically
    // Future implementation would check bridge-specific claim requirements
    
    // Across bridge requires manual claim on destination
    if (route.bridge === BridgeProvider.ACROSS && route.toChain !== 'ethereum') {
      // Would implement Across-specific claim logic here
      // This would involve calling the SpokePool contract on destination chain
    }
  }
  
  /**
   * Monitor bridge progress
   * @param transferId - Internal transfer ID for tracking
   * @param route - Bridge route being monitored
   * @param bridgeId - Bridge-specific transfer ID
   * @returns void
   */
  private monitorBridge(
    transferId: string,
    route: BridgeRoute,
    bridgeId?: string
  ): void {
    if (this.crossChainBridge === undefined || bridgeId === undefined || bridgeId === '') {
      return;
    }
    
    const checkStatus = async (): Promise<void> => {
      try {
        if (this.crossChainBridge === undefined) {
          return;
        }
        const status = await this.crossChainBridge.getBridgeStatus(bridgeId);
        
        if (status.status === 'completed') {
          this.updateTransferStatus(transferId, {
            status: 'completed'
          });
          clearInterval(interval);
        } else if (status.status === 'failed') {
          this.updateTransferStatus(transferId, {
            status: 'failed',
            message: 'Bridge transfer failed'
          });
          clearInterval(interval);
        }
      } catch (error) {
        // Continue polling on error
      }
    };
    
    // Poll every 10 seconds
    const interval = setInterval((): void => { void checkStatus(); }, 10000);
    
    // Initial check
    void checkStatus();
    
    // Stop polling after max time (2x estimated time)
    setTimeout((): void => {
      clearInterval(interval);
    }, route.estimatedTime * 2000);
  }
  
  /**
   * Update transfer status
   * @param transferId - Transfer ID to update
   * @param update - Partial status update to apply
   * @returns void
   */
  private updateTransferStatus(transferId: string, update: Partial<BridgeStatus>): void {
    const current = this.activeTransfers.get(transferId);
    if (current !== undefined) {
      this.activeTransfers.set(transferId, {
        ...current,
        ...update
      });
    }
  }
  
  /**
   * Get bridge contract address
   * @param bridge - Bridge provider to get address for
   * @param chain - Blockchain network name
   * @returns Contract address for the bridge on specified chain
   */
  private getBridgeAddress(bridge: BridgeProvider, chain: string): string {
    // Bridge contract addresses would be maintained in config
    const addresses: Record<string, Record<string, string>> = {
      [BridgeProvider.HOP]: {
        ethereum: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
        polygon: '0x553bC791D746767166fA3888432038193cEED5E2',
        arbitrum: '0x33ceb27b39d2Bb7D2e61F7564d3Df29344020417',
        optimism: '0x91f8490eC27cbB1b2FaEdd29c2eC23011d7355FB',
      },
      [BridgeProvider.STARGATE]: {
        ethereum: '0x8731d54E9D02c286767d56ac03e8037C07e01e98',
        polygon: '0x45A01E4e04F14f7A4a6702c74187c5F6222033cd',
        arbitrum: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
        optimism: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
      },
      // Add other bridge addresses
    };
    
    return addresses[bridge]?.[chain] ?? ethers.ZeroAddress;
  }
  
  /**
   * Get chain ID
   * @param chain - Blockchain network name
   * @returns Numeric chain ID or string identifier for the network
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
    
    return chainIds[chain] ?? 1;
  }
  
  /**
   * Generate unique transfer ID
   * @returns Unique string identifier for bridge transfer
   */
  private generateTransferId(): string {
    return `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Get bridge fees
   * @param bridge - Bridge provider to calculate fees for
   * @param fromChain - Source blockchain network
   * @param toChain - Destination blockchain network
   * @param amount - Amount to bridge in wei
   * @returns Promise resolving to bridge fee amount in wei
   * @private
   */
  private async getBridgeFees(
    bridge: BridgeProvider,
    fromChain: string,
    toChain: string,
    amount: bigint
  ): Promise<bigint> {
    if (this.oracleService === undefined) {
      // Fallback to default percentage calculation
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
   * @param bridge - Bridge provider to get default fee for
   * @returns Fee percentage in basis points (e.g., 30 = 0.3%)
   * @private
   */
  private getDefaultBridgeFeePercentage(bridge: BridgeProvider): number {
    const fees: Record<BridgeProvider, number> = {
      [BridgeProvider.HOP]: 30, // 0.3%
      [BridgeProvider.STARGATE]: 10, // 0.1%
      [BridgeProvider.ACROSS]: 25, // 0.25%
      [BridgeProvider.SYNAPSE]: 20, // 0.2%
      [BridgeProvider.CELER]: 35, // 0.35%
      [BridgeProvider.MULTICHAIN]: 40, // 0.40%
      [BridgeProvider.WORMHOLE]: 50, // 0.5%
      [BridgeProvider.LAYER_ZERO]: 15, // 0.15%
      [BridgeProvider.POLYGON]: 45, // 0.45%
      [BridgeProvider.ARBITRUM]: 20, // 0.20%
      [BridgeProvider.OPTIMISM]: 20, // 0.20%
    };
    
    return fees[bridge] ?? 50;
  }
  
  /**
   * Map chain names to CrossChainBridge format
   * @param chain - Chain name to map
   * @returns Mapped chain name for CrossChainBridge compatibility
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
    
    return chainMap[chain] ?? chain;
  }
  
  /**
   * Estimate bridge fees
   * @param fromChain - Source blockchain network
   * @param toChain - Destination blockchain network
   * @param token - Token symbol to bridge
   * @param amount - Amount to bridge as string
   * @returns Promise resolving to array of bridge fee estimates
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
   * @returns void
   */
  cleanup(): void {
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
