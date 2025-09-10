/**
 * Payment Routing Service
 * Inspired by DePay's payment routing system
 * Finds optimal payment paths across chains and exchanges
 */

import { formatUnits, parseUnits, ZeroAddress, isAddress } from 'ethers';
import { ChainType } from '../keyring/BIP39Keyring';
import { providerManager } from '../providers/ProviderManager';
import { bridgeService } from '../bridge';

/** Payment route with cross-chain and exchange details */
export interface PaymentRoute {
  /** Target blockchain */
  blockchain: string;
  /** Sender address */
  fromAddress: string;
  /** Source token information */
  fromToken: TokenInfo;
  /** Source amount to send */
  fromAmount: string;
  /** Source token decimals */
  fromDecimals: number;
  /** Destination token information */
  toToken: TokenInfo;
  /** Expected output amount */
  toAmount: string;
  /** Destination token decimals */
  toDecimals: number;
  /** Recipient address */
  toAddress: string;
  /** Exchange routes for swaps */
  exchangeRoutes: ExchangeRoute[];
  /** Estimated gas cost (optional) */
  estimatedGas?: string;
  /** Estimated transaction fee (optional) */
  estimatedFee?: string;
  /** Whether token approval is required */
  approvalRequired?: boolean;
  /** Route execution steps */
  steps: RouteStep[];
}

/** Token information for routing */
export interface TokenInfo {
  /** Token contract address */
  address: string;
  /** Token symbol (e.g., 'ETH', 'USDC') */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimal places */
  decimals: number;
  /** Chain ID where token exists */
  chainId: number | string;
}

/** Exchange route details for token swaps */
export interface ExchangeRoute {
  /** DEX name (e.g., 'uniswap_v3', 'sushiswap') */
  exchange: string;
  /** Token swap path (addresses) */
  path: string[];
  /** Expected output amount */
  expectedOutput: string;
  /** Minimum acceptable output (with slippage) */
  minimumOutput: string;
  /** Estimated price impact percentage */
  priceImpact: number;
}

/** Individual step in payment route execution */
export interface RouteStep {
  /** Type of action to perform */
  type: 'approve' | 'swap' | 'bridge' | 'transfer' | 'deposit' | 'wait' | 'claim';
  /** Human-readable description */
  description: string;
  /** Additional data needed for this step */
  data?: Record<string, unknown>;
}

/** Payment request parameters for route finding */
export interface PaymentRequest {
  /** List of sender addresses to check */
  from: string[];
  /** Recipient address */
  to: string;
  /** Amount to send (in token units) */
  amount?: string;
  /** Token symbol to send */
  token?: string;
  /** Target blockchain network */
  blockchain?: string;
  /** Accepted payment methods */
  accept?: AcceptedPayment[];
}

/** Accepted payment configuration */
export interface AcceptedPayment {
  /** Blockchain network for payment */
  blockchain: string;
  /** Token symbol accepted */
  token: string;
  /** Required amount (optional) */
  amount?: string;
  /** Override receiver address */
  receiver?: string;
  /** Fee configuration */
  fee?: string | {
    /** Fee amount */
    amount: string;
    /** Fee receiver address */
    receiver: string
  };
}

/**
 * Payment routing service for finding optimal payment paths
 * across multiple blockchains and DEXes
 */
export class PaymentRoutingService {
  private supportedExchanges = {
    ethereum: ['uniswap_v3', 'uniswap_v2', 'sushiswap', '1inch'],
    polygon: ['quickswap', 'sushiswap', '1inch'],
    arbitrum: ['uniswap_v3', 'sushiswap', 'camelot'],
    optimism: ['uniswap_v3', 'velodrome'],
    base: ['uniswap_v3', 'aerodrome'],
    bsc: ['pancakeswap', '1inch'],
    avalanche: ['traderjoe', 'pangolin'],
    solana: ['orca', 'raydium', 'jupiter'],
  };

  private nativeTokens: Record<string, TokenInfo> = {
    ethereum: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 1,
    },
    polygon: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      chainId: 137,
    },
    arbitrum: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 42161,
    },
    optimism: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 10,
    },
    base: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 8453,
    },
    bsc: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      chainId: 56,
    },
    avalanche: {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'AVAX',
      name: 'Avalanche',
      decimals: 18,
      chainId: 43114,
    },
    solana: {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      chainId: 'solana',
    },
  };

  /**
   * Find best payment route
   * @param request - Payment request parameters
   * @returns Promise resolving to the best payment route or null
   */
  async findBestRoute(request: PaymentRequest): Promise<PaymentRoute | null> {
    if (request === null || request === undefined) return null;
    
    const routes = await this.findAllRoutes(request);
    if (routes.length === 0) return null;

    // Sort routes by efficiency (least gas, best exchange rate)
    const sortedRoutes = routes.sort((a, b) => {
      // Prefer routes without approval
      if (a.approvalRequired === true && b.approvalRequired !== true) return 1;
      if (a.approvalRequired !== true && b.approvalRequired === true) return -1;

      // Prefer direct transfers over swaps
      if (a.exchangeRoutes.length === 0 && b.exchangeRoutes.length > 0) return -1;
      if (a.exchangeRoutes.length > 0 && b.exchangeRoutes.length === 0) return 1;

      // Compare by output amount
      const aOutput = parseFloat(a.toAmount);
      const bOutput = parseFloat(b.toAmount);
      return bOutput - aOutput;
    });
    
    return sortedRoutes[0] ?? null;
  }

  /**
   * Find all possible payment routes
   * @param request - Payment request parameters
   * @returns Promise resolving to array of payment routes
   */
  async findAllRoutes(request: PaymentRequest): Promise<PaymentRoute[]> {
    const routes: PaymentRoute[] = [];
    if (request === null || request === undefined) return routes;
    
    const { from, to, amount, token, blockchain, accept } = request;

    // If specific blockchain is requested
    if (blockchain !== null && blockchain !== undefined && blockchain !== '') {
      const blockchainRoutes = await this.findRoutesForBlockchain(
        blockchain,
        from,
        to,
        amount,
        token,
        accept
      );
      routes.push(...blockchainRoutes);
    } else {
      // Find routes across all supported blockchains
      const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana'];

      for (const chain of supportedChains) {
        const chainRoutes = await this.findRoutesForBlockchain(
          chain,
          from,
          to,
          amount,
          token,
          accept
        );
        routes.push(...chainRoutes);
      }
    }

    return routes;
  }

  /**
   * Find routes for a specific blockchain
   * @param blockchain - Target blockchain
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Amount to send
   * @param token
   * @param accept
   */
  private async findRoutesForBlockchain(
    blockchain: string,
    from: string[],
    to: string,
    amount?: string,
    token?: string,
    accept?: AcceptedPayment[]
  ): Promise<PaymentRoute[]> {
    const routes: PaymentRoute[] = [];

    // Check if we have a valid from address for this blockchain
    const fromAddress = from.find(addr => this.isValidAddress(addr, blockchain));
    if (!fromAddress) return routes;

    // Get accepted tokens for this blockchain
    const acceptedTokens = accept?.filter(a => a.blockchain === blockchain) || [];
    if (acceptedTokens.length === 0 && token) {
      // If no specific acceptance criteria, create one from the token
      acceptedTokens.push({
        blockchain,
        token,
        ...(amount && { amount }),
        receiver: to,
      });
    }

    // For each accepted token, find a route
    for (const accepted of acceptedTokens) {
      const route = await this.findSingleRoute(
        blockchain,
        fromAddress,
        accepted.receiver || to,
        accepted.amount || amount,
        accepted.token
      );

      if (route) {
        routes.push(route);
      }
    }

    return routes;
  }

  /**
   * Find a single route
   * @param blockchain
   * @param from
   * @param to
   * @param amount
   * @param tokenAddress
   */
  private async findSingleRoute(
    blockchain: string,
    from: string,
    to: string,
    amount?: string,
    tokenAddress?: string
  ): Promise<PaymentRoute | null> {
    try {
      const token = tokenAddress
        ? await this.getTokenInfo(blockchain, tokenAddress)
        : this.nativeTokens[blockchain];

      if (!token) return null;

      // Check if direct transfer is possible
      const balance = await this.getTokenBalance(blockchain, from, token.address);
      if (!amount || parseFloat(balance) >= parseFloat(amount)) {
        // Direct transfer route
        return {
          blockchain,
          fromAddress: from,
          fromToken: token,
          fromAmount: amount || balance,
          fromDecimals: token.decimals,
          toToken: token,
          toAmount: amount || balance,
          toDecimals: token.decimals,
          toAddress: to,
          exchangeRoutes: [],
          steps: [
            {
              type: 'transfer',
              description: `Transfer ${token.symbol} to ${to}`,
            },
          ],
        };
      }

      // Try to find swap routes using DEX aggregators
      const swapRoute = await this.findSwapRoute(
        blockchain,
        from,
        to,
        amount,
        token.address
      );

      if (swapRoute) {
        return swapRoute;
      }

      // Try cross-chain routes if different blockchain is acceptable
      const bridgeRoute = await this.findBridgeRoute(
        blockchain,
        from,
        to,
        amount,
        token.address
      );

      return bridgeRoute;
    } catch (error) {
      console.warn('Error finding route:', error);
      return null;
    }
  }

  /**
   * Get token information
   * @param blockchain
   * @param tokenAddress
   */
  private async getTokenInfo(blockchain: string, tokenAddress: string): Promise<TokenInfo | null> {
    // Check if it's native token
    if (tokenAddress.toLowerCase() === this.nativeTokens[blockchain]?.address.toLowerCase()) {
      return this.nativeTokens[blockchain];
    }

    // Return placeholder token info for unknown tokens
    // In production, this would query the blockchain for token metadata
    return {
      address: tokenAddress,
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
      chainId: this.getChainId(blockchain),
    };
  }

  /**
   * Get token balance
   * @param blockchain
   * @param address
   * @param tokenAddress
   */
  private async getTokenBalance(
    blockchain: string,
    address: string,
    tokenAddress: string
  ): Promise<string> {
    try {
      // Native token balance
      if (tokenAddress.toLowerCase() === this.nativeTokens[blockchain]?.address.toLowerCase()) {
        const provider = providerManager.getProvider(blockchain as ChainType);
        if (provider) {
          const balance = await provider.getBalance(address);
          // Handle different balance formats (simple bigint vs privacy-enabled complex object)
          const balanceValue = typeof balance === 'object' && balance !== null && 'public' in balance 
            ? balance.public 
            : balance;
          return formatUnits(balanceValue, this.nativeTokens[blockchain].decimals);
        }
      }

      // ERC20 balance checking would require contract calls
      // This would be implemented with provider.getERC20Balance or similar
      return '0';
    } catch (error) {
      console.warn('Error getting balance:', error);
      return '0';
    }
  }

  /**
   * Validate address for blockchain
   * @param address
   * @param blockchain
   */
  private isValidAddress(address: string, blockchain: string): boolean {
    try {
      if (blockchain === 'solana') {
        // Basic Solana address validation
        return address.length >= 32 && address.length <= 44;
      } else {
        // EVM address validation
        return isAddress(address);
      }
    } catch {
      return false;
    }
  }

  /**
   * Get chain ID for blockchain
   * @param blockchain
   */
  private getChainId(blockchain: string): number | string {
    const chainIds: Record<string, number | string> = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      base: 8453,
      bsc: 56,
      avalanche: 43114,
      solana: 'solana',
    };

    return chainIds[blockchain] || 1;
  }

  /**
   * Find swap route using DEX aggregators
   * @param blockchain
   * @param from
   * @param to
   * @param amount
   * @param tokenAddress
   */
  private async findSwapRoute(
    blockchain: string,
    from: string,
    to: string,
    amount?: string,
    tokenAddress?: string
  ): Promise<PaymentRoute | null> {
    try {
      // Get available DEXes for this blockchain
      const exchanges = this.supportedExchanges[blockchain as keyof typeof this.supportedExchanges];
      if (!exchanges || exchanges.length === 0) return null;

      // Integration point for DEX aggregators (1inch, 0x, etc.)
      // This implementation returns a mock swap route for testing
      const nativeToken = this.nativeTokens[blockchain];
      const targetToken = tokenAddress
        ? await this.getTokenInfo(blockchain, tokenAddress)
        : nativeToken;

      if (!targetToken || !nativeToken || nativeToken.address === targetToken.address) return null;

      // Mock swap calculation (would use 1inch, 0x API, etc.)
      const swapRate = 1500; // Mock: 1 ETH = 1500 USDC
      const inputAmount = parseUnits(amount || '1', nativeToken.decimals);
      const outputAmount = inputAmount * BigInt(Math.floor(swapRate * 1000)) / BigInt(1000);

      return {
        blockchain,
        fromAddress: from,
        fromToken: nativeToken,
        fromAmount: inputAmount.toString(),
        fromDecimals: nativeToken.decimals,
        toToken: targetToken,
        toAmount: outputAmount.toString(),
        toDecimals: targetToken.decimals,
        toAddress: to || '0x0000000000000000000000000000000000000000',
        exchangeRoutes: [{
          exchange: exchanges[0] || 'Unknown',
          path: [nativeToken.address, targetToken.address],
          expectedOutput: outputAmount.toString(),
          minimumOutput: (outputAmount * BigInt(99) / BigInt(100)).toString(), // 1% slippage
          priceImpact: 0.1
        }],
        approvalRequired: false, // Native token doesn't need approval
        steps: [
          {
            type: 'swap',
            description: `Swap ${nativeToken.symbol} to ${targetToken.symbol} via ${exchanges[0] ?? 'Unknown'}`,
            data: {
              dex: exchanges[0] ?? 'Unknown',
              path: [nativeToken.address, targetToken.address]
            }
          },
          {
            type: 'transfer',
            description: `Transfer ${targetToken.symbol} to ${to}`
          }
        ]
      };
    } catch (error) {
      console.warn('Error finding swap route:', error);
      return null;
    }
  }

  /**
   * Find bridge route for cross-chain transfers
   * @param blockchain
   * @param from
   * @param to
   * @param amount
   * @param tokenAddress
   */
  private async findBridgeRoute(
    blockchain: string,
    from: string,
    to: string,
    amount?: string,
    tokenAddress?: string
  ): Promise<PaymentRoute | null> {
    try {
      // Check if we have balances on other chains
      const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];

      for (const otherChain of supportedChains) {
        if (otherChain === blockchain) continue;

        // Check balance on other chain
        const nativeTokenForOtherChain = this.nativeTokens[otherChain];
        if (!nativeTokenForOtherChain) continue;
        
        const otherBalance = await this.getTokenBalance(
          otherChain,
          from,
          tokenAddress || nativeTokenForOtherChain.address
        );

        if (parseFloat(otherBalance) > 0) {
          // We have balance on another chain, get bridge quote
          const bridgeQuote = await bridgeService.getQuotes({
            fromChain: otherChain,
            toChain: blockchain,
            fromToken: tokenAddress || nativeTokenForOtherChain.symbol,
            amount: parseUnits(
              amount || otherBalance,
              nativeTokenForOtherChain.decimals
            ).toString(),
            fromAddress: from,
            toAddress: to
          });

          if (bridgeQuote.bestRoute) {
            const route = bridgeQuote.bestRoute;

            return {
              blockchain: otherChain, // Start from the other chain
              fromAddress: from,
              fromToken: route.fromToken,
              fromAmount: route.fromAmount,
              fromDecimals: route.fromToken.decimals,
              toToken: route.toToken,
              toAmount: route.toAmount,
              toDecimals: route.toToken.decimals,
              toAddress: to,
              exchangeRoutes: [],
              approvalRequired: route.fromToken.address !== ZeroAddress,
              steps: [
                ...route.steps.map(step => ({
                  type: step.type,
                  description: step.description,
                  data: { bridgeRoute: route }
                }))
              ]
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Error finding bridge route:', error);
      return null;
    }
  }

  /**
   * Execute payment route
   * @param route
   */
  async executeRoute(route: PaymentRoute): Promise<string> {
    // Switch to the correct chain
    if (route.blockchain !== 'solana') {
      await providerManager.switchEVMNetwork(route.blockchain);
    } else {
      await providerManager.setActiveChain(ChainType.SOLANA);
    }

    // Execute each step
    for (const step of route.steps) {
      switch (step.type) {
        case 'approve':
          // Token approval implementation would call ERC20 approve method
          // This is handled by the provider's approveToken method
          console.log('Token approval required for:', route.fromToken.symbol);
          break;

        case 'transfer':
          // Execute transfer
          return await providerManager.sendTransaction(
            route.toAddress,
            route.fromAmount,
            route.blockchain as ChainType
          ) as string;

        case 'swap':
          // Swap execution would integrate with DEX protocols
          // This would call the appropriate DEX router contract
          console.log('Executing swap via:', step.data?.['dex']);
          break;

        case 'bridge':
          // Execute bridge transfer
          if (step.data?.['bridgeRoute']) {
            const bridgeId = await bridgeService.executeBridge(step.data['bridgeRoute'] as any);
            return bridgeId; // Return bridge transfer ID
          }
          break;
      }
    }

    throw new Error('Route execution failed');
  }
}

// Export singleton instance
export const paymentRouter = new PaymentRoutingService();
