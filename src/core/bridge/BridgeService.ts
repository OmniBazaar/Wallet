/**
 * Cross-Chain Bridge Service
 * Manages bridge quotes, executions, and monitoring
 */

import { ethers } from 'ethers';
import { 
  BridgeRoute, 
  BridgeQuoteRequest, 
  BridgeQuoteResponse,
  BridgeTransaction,
  BridgeStatus,
  BridgeProvider,
  BRIDGE_SUPPORT,
  BRIDGE_TOKENS
} from './types';
import { providerManager } from '../providers/ProviderManager';
import { ChainType } from '../keyring/BIP39Keyring';

export class BridgeService {
  private activeTransfers: Map<string, BridgeStatus> = new Map();
  
  /**
   * Get quotes from multiple bridge providers
   */
  async getQuotes(request: BridgeQuoteRequest): Promise<BridgeQuoteResponse> {
    const routes: BridgeRoute[] = [];
    
    // Find compatible bridges
    const compatibleBridges = this.findCompatibleBridges(
      request.fromChain,
      request.toChain,
      request.fromToken
    );
    
    // Get quotes from each compatible bridge
    const quotePromises = compatibleBridges.map(bridge => 
      this.getQuoteFromBridge(bridge, request).catch(err => {
        console.error(`Failed to get quote from ${bridge}:`, err);
        return null;
      })
    );
    
    const quotes = await Promise.all(quotePromises);
    const validQuotes = quotes.filter(Boolean) as BridgeRoute[];
    
    // Sort by best output amount
    const sortedRoutes = validQuotes.sort((a, b) => {
      const aAmount = ethers.BigNumber.from(a.toAmount);
      const bAmount = ethers.BigNumber.from(b.toAmount);
      return bAmount.gt(aAmount) ? 1 : -1;
    });
    
    return {
      routes: sortedRoutes,
      bestRoute: sortedRoutes[0] || null
    };
  }
  
  /**
   * Execute a bridge transfer
   */
  async executeBridge(route: BridgeRoute): Promise<string> {
    const transferId = this.generateTransferId();
    
    // Initialize transfer status
    this.activeTransfers.set(transferId, {
      id: transferId,
      status: 'pending',
      estimatedArrival: Date.now() + (route.estimatedTime * 1000)
    });
    
    try {
      // Execute each step
      for (const step of route.steps) {
        switch (step.type) {
          case 'approve':
            await this.executeApproval(route);
            break;
            
          case 'deposit':
            const txHash = await this.executeDeposit(route);
            this.updateTransferStatus(transferId, {
              fromTxHash: txHash
            });
            break;
            
          case 'wait':
            // Monitoring happens in background
            this.monitorBridge(transferId, route);
            break;
            
          case 'claim':
            // Some bridges require manual claim
            await this.executeClaim(route);
            break;
        }
      }
      
      return transferId;
    } catch (error) {
      this.updateTransferStatus(transferId, {
        status: 'failed',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get status of a bridge transfer
   */
  getTransferStatus(transferId: string): BridgeStatus | null {
    return this.activeTransfers.get(transferId) || null;
  }
  
  /**
   * Find compatible bridges for a route
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
   */
  private async getQuoteFromBridge(
    bridge: BridgeProvider,
    request: BridgeQuoteRequest
  ): Promise<BridgeRoute | null> {
    // In production, these would call actual bridge APIs
    // For now, return mock quotes based on bridge characteristics
    
    const support = BRIDGE_SUPPORT[bridge];
    const fromToken = this.getTokenInfo(request.fromChain, request.fromToken);
    const toToken = this.getTokenInfo(request.toChain, request.toToken || request.fromToken);
    
    // Calculate estimated output (mock calculation)
    const inputAmount = ethers.BigNumber.from(request.amount);
    const bridgeFee = inputAmount.mul(10).div(10000); // 0.1% fee
    const outputAmount = inputAmount.sub(bridgeFee);
    
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
        inUSD: '0' // Would calculate from price feed
      },
      bridge,
      steps: this.getBridgeSteps(bridge, fromToken)
    };
    
    return route;
  }
  
  /**
   * Get token info for bridge
   */
  private getTokenInfo(chain: string, tokenSymbol: string) {
    // Check if it's a known bridge token
    const tokenAddresses = BRIDGE_TOKENS[tokenSymbol];
    const address = tokenAddresses?.[chain] || ethers.constants.AddressZero;
    
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
   */
  private getBridgeSteps(bridge: BridgeProvider, token: any) {
    const steps = [];
    
    // Most bridges require approval for ERC20
    if (token.address !== ethers.constants.AddressZero) {
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
    if ([BridgeProvider.Hop, BridgeProvider.Across].includes(bridge)) {
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
   */
  private async executeApproval(route: BridgeRoute): Promise<void> {
    if (route.fromChain === 'solana') return; // No approvals on Solana
    
    const provider = providerManager.getProvider(route.fromChain as ChainType);
    if (!provider) throw new Error('Provider not available');
    
    // Get bridge contract address based on provider
    const bridgeAddress = this.getBridgeAddress(route.bridge, route.fromChain);
    
    // Create approval transaction
    const tokenContract = new ethers.Contract(
      route.fromToken.address,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      provider
    );
    
    const tx = await tokenContract.populateTransaction.approve(
      bridgeAddress,
      ethers.constants.MaxUint256
    );
    
    // Execute through provider manager
    await providerManager.sendTransaction(
      tx.to!,
      '0',
      route.fromChain as ChainType,
      tx.data
    );
  }
  
  /**
   * Execute bridge deposit
   */
  private async executeDeposit(route: BridgeRoute): Promise<string> {
    // In production, this would call the specific bridge contract
    // For now, simulate with a simple transfer
    
    const provider = providerManager.getProvider(route.fromChain as ChainType);
    if (!provider) throw new Error('Provider not available');
    
    const bridgeAddress = this.getBridgeAddress(route.bridge, route.fromChain);
    
    // For native tokens, send directly
    if (route.fromToken.address === ethers.constants.AddressZero) {
      const txHash = await providerManager.sendTransaction(
        bridgeAddress,
        ethers.utils.formatUnits(route.fromAmount, route.fromToken.decimals),
        route.fromChain as ChainType
      );
      return txHash as string;
    }
    
    // For ERC20, call bridge deposit function
    // This is simplified - actual implementation would vary by bridge
    const txHash = await providerManager.sendTransaction(
      bridgeAddress,
      '0',
      route.fromChain as ChainType,
      '0x' // Would encode actual bridge deposit call
    );
    
    return txHash as string;
  }
  
  /**
   * Execute claim on destination chain
   */
  private async executeClaim(route: BridgeRoute): Promise<void> {
    // Implementation would vary by bridge
    // Some bridges auto-claim, others require manual claim
    console.log('Claim would be executed for', route.id);
  }
  
  /**
   * Monitor bridge progress
   */
  private async monitorBridge(transferId: string, route: BridgeRoute) {
    // In production, this would poll bridge APIs or listen to events
    // For now, simulate completion after estimated time
    
    setTimeout(() => {
      this.updateTransferStatus(transferId, {
        status: 'completed',
        toTxHash: '0x' + Math.random().toString(16).slice(2)
      });
    }, route.estimatedTime * 1000);
  }
  
  /**
   * Update transfer status
   */
  private updateTransferStatus(transferId: string, update: Partial<BridgeStatus>) {
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
    
    return addresses[bridge]?.[chain] || ethers.constants.AddressZero;
  }
  
  /**
   * Get chain ID
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
   * Estimate bridge fees
   */
  async estimateBridgeFees(
    fromChain: string,
    toChain: string,
    token: string,
    amount: string
  ): Promise<{ bridge: BridgeProvider; fee: string; time: number }[]> {
    const request: BridgeQuoteRequest = {
      fromChain,
      toChain,
      fromToken: token,
      amount,
      fromAddress: ethers.constants.AddressZero, // Just for estimation
    };
    
    const { routes } = await this.getQuotes(request);
    
    return routes.map(route => ({
      bridge: route.bridge,
      fee: route.fee.amount,
      time: route.estimatedTime
    }));
  }
}

// Export singleton instance
export const bridgeService = new BridgeService();