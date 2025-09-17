/**
 * Swap Store
 * Manages token swap functionality and state
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BigNumberish } from 'ethers';
import { SwapService } from '../services/SwapService';
import { TokenService } from '../services/TokenService';
import { WalletService } from '../services/WalletService';
import { useWalletStore } from './wallet';

// Create wallet service instance
const walletService = new WalletService();

// Create service instances
const swapService = new SwapService(walletService);
const tokenService = new TokenService(walletService);

/**
 * Token interface for swap operations
 */
export interface SwapToken {
  /** Token contract address */
  address: string;
  /** Token symbol (e.g., ETH, USDC) */
  symbol: string;
  /** Number of decimal places for the token */
  decimals: number;
  /** Full token name */
  name?: string;
  /** Token logo URI */
  logoURI?: string;
}

/**
 * Swap quote interface
 */
export interface SwapQuote {
  /** Expected output amount in wei */
  amountOut?: bigint;
  /** Price impact percentage (0-100) */
  priceImpact?: number;
  /** Token addresses in the swap route */
  route?: string[];
  /** Exchange rate */
  rate?: number;
  /** Estimated gas cost in wei */
  estimatedGas?: bigint;
}

/**
 * Gas estimate interface
 */
export interface GasEstimate {
  /** Maximum gas units that can be consumed */
  gasLimit: string;
  /** Price per gas unit in gwei */
  gasPrice: string;
  /** Total transaction cost in ETH */
  totalCost: string;
  /** Total transaction cost in USD */
  totalCostUSD: string;
}

/**
 * Recent swap interface
 */
export interface RecentSwap {
  /** Unique swap identifier */
  id: string;
  /** Input token address */
  tokenIn: string;
  /** Output token address */
  tokenOut: string;
  /** Input amount in wei */
  amountIn: string;
  /** Output amount in wei */
  amountOut: string;
  /** Timestamp of the swap */
  timestamp: number;
  /** Transaction hash */
  txHash?: string;
}

/**
 * Swap parameters interface
 */
export interface SwapParams {
  /** Input token address */
  tokenIn: string;
  /** Output token address */
  tokenOut: string;
  /** Input amount */
  amountIn: BigNumberish;
  /** Slippage tolerance percentage */
  slippage?: number;
  /** Transaction deadline in minutes */
  deadline?: number;
}

/**
 * Swap result interface
 */
interface SwapResult {
  /** Transaction hash */
  hash: string;
  /** Success status */
  success: boolean;
}

export const useSwapStore = defineStore('swap', () => {
  // State
  const availableTokens = ref<SwapToken[]>([]);
  const balances = ref<Record<string, string>>({});
  const quote = ref<SwapQuote | null>(null);
  const slippage = ref(0.5);
  const deadline = ref(20);
  const expertMode = ref(false);
  const needsApproval = ref(false);
  const transactionStatus = ref<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const transactionHash = ref<string>('');
  const error = ref<string>('');
  const recentSwaps = ref<RecentSwap[]>([]);
  const gasEstimate = ref<GasEstimate | null>(null);

  // Methods
  /**
   * Fetch available tokens for swapping
   */
  const fetchAvailableTokens = (): void => {
    try {
      // Get chain ID from wallet - hardcoded for now
      const walletStore = useWalletStore();
      const chainId = walletStore.currentNetwork === 'ethereum' ? 1 : 1;
      
      // Get supported tokens from SwapService
      const tokens = swapService.getSupportedTokens(chainId);
      
      // Map to SwapToken format
      availableTokens.value = tokens.map(token => ({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name,
        ...(token.logoURI !== undefined && { logoURI: token.logoURI })
      }));
      
      // Also add popular tokens from TokenService
      const popularTokens = tokenService.getPopularTokens('ethereum');
      for (const token of popularTokens) {
        if (!availableTokens.value.some(t => t.address.toLowerCase() === token.address.toLowerCase())) {
          availableTokens.value.push({
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            name: token.name,
            ...(token.logoURI !== undefined && { logoURI: token.logoURI })
          });
        }
      }
    } catch (err) {
      error.value = 'Failed to fetch tokens';
      throw err;
    }
  };

  /**
   * Get swap quote
   * @param params - Swap parameters including tokens and amounts
   * @returns Promise that resolves to a swap quote or null if failed
   */
  const getQuote = async (params: SwapParams): Promise<SwapQuote | null> => {
    try {
      error.value = '';
      
      // Get quote from SwapService
      const route = await swapService.getQuote({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: BigInt(params.amountIn),
        ...(params.slippage !== undefined && { slippage: params.slippage })
      });
      
      // Calculate rate
      const rate = Number(route.amountOut) / Number(params.amountIn);
      
      const swapQuote: SwapQuote = {
        amountOut: route.amountOut,
        priceImpact: route.priceImpact,
        route: route.path,
        rate: rate,
        estimatedGas: route.gasEstimate
      };
      
      quote.value = swapQuote;
      
      // Check if approval needed
      needsApproval.value = await checkApproval(params.tokenIn, params.amountIn);
      
      return swapQuote;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get quote';
      return null;
    }
  };

  /**
   * Check if token approval is needed
   * @param tokenAddress - Token contract address
   * @param amount - Amount to be approved
   * @returns Promise that resolves to true if approval is needed
   */
  const checkApproval = async (tokenAddress: string, amount: BigNumberish): Promise<boolean> => {
    // Native tokens don't need approval
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return false;
    }
    
    try {
      // Get current wallet address
      const walletStore = useWalletStore();
      const address = walletStore.address;
      if (address === '') return false;
      
      // Get chain ID
      const chainId = walletStore.currentNetwork === 'ethereum' ? 1 : 1;
      
      // Get router address for current chain
      const routers: Record<number, string> = {
        1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
        137: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
        56: '0x10ED43C718714eb63d5aA57B78B54704E256024E' // PancakeSwap
      };
      const routerAddress = routers[chainId];
      if (routerAddress === undefined) return false;
      
      // Check allowance
      const allowance = await tokenService.getAllowance(tokenAddress, address, routerAddress);
      return allowance < BigInt(amount);
    } catch (_err) {
      // If check fails, assume approval is needed
      return true;
    }
  };

  /**
   * Approve token for spending
   * @param tokenAddress - Token contract address
   * @returns Promise that resolves to true if approval succeeds
   */
  const approveToken = async (tokenAddress: string): Promise<boolean> => {
    try {
      transactionStatus.value = 'pending';
      error.value = '';
      
      // Get wallet and chain info
      const walletStore = useWalletStore();
      const chainId = walletStore.currentNetwork === 'ethereum' ? 1 : 1;
      
      // Get router address
      const routers: Record<number, string> = {
        1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        137: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        56: '0x10ED43C718714eb63d5aA57B78B54704E256024E'
      };
      const routerAddress = routers[chainId];
      if (routerAddress === undefined) {
        throw new Error('No router for chain');
      }
      
      // Approve max amount
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const txHash = await tokenService.approveToken(tokenAddress, routerAddress, maxAmount);
      transactionHash.value = txHash;
      
      needsApproval.value = false;
      transactionStatus.value = 'success';
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Approval failed';
      transactionStatus.value = 'failed';
      return false;
    }
  };

  /**
   * Execute swap
   * @param params - Swap parameters
   * @returns Promise that resolves to transaction result or null if failed
   */
  const executeSwap = async (params: SwapParams): Promise<SwapResult | null> => {
    try {
      transactionStatus.value = 'pending';
      error.value = '';
      
      // Get current wallet address
      const walletStore = useWalletStore();
      const address = walletStore.address;
      if (address === '') {
        throw new Error('No wallet connected');
      }
      
      // Execute swap through SwapService
      const result = await swapService.executeSwap({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: BigInt(params.amountIn),
        amountOutMin: quote.value?.amountOut !== undefined ?
          quote.value.amountOut - (quote.value.amountOut * BigInt(params.slippage ?? 50)) / BigInt(10000) :
          BigInt(0),
        slippage: params.slippage ?? 50,
        to: address,
        deadline: params.deadline ?? Math.floor(Date.now() / 1000) + 1200
      });
      
      if (!result.success) {
        throw new Error(result.error ?? 'Swap failed');
      }
      
      transactionHash.value = result.txHash ?? '';
      
      // Add to recent swaps
      const swap: RecentSwap = {
        id: Date.now().toString(),
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn.toString(),
        amountOut: result.amountOut?.toString() ?? quote.value?.amountOut?.toString() ?? '0',
        timestamp: Date.now(),
        ...(result.txHash !== undefined && { txHash: result.txHash })
      };
      
      recentSwaps.value.unshift(swap);
      if (recentSwaps.value.length > 10) {
        recentSwaps.value.pop();
      }
      
      transactionStatus.value = 'success';
      return { hash: result.txHash ?? '', success: true };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Swap failed';
      transactionStatus.value = 'failed';
      return null;
    }
  };

  /**
   * Update token balances
   * @param tokens - Array of token addresses to update balances for
   * @returns Promise that resolves when balances are updated
   */
  const updateBalances = async (tokens: string[]): Promise<void> => {
    try {
      // Get current wallet address
      const walletStore = useWalletStore();
      const address = walletStore.address;
      if (address === '') {
        balances.value = {};
        return;
      }
      
      // Fetch real balances from TokenService
      const tokenBalances: Record<string, string> = {};
      
      for (const tokenAddress of tokens) {
        try {
          const balance = await tokenService.getTokenBalance(tokenAddress, address);
          tokenBalances[tokenAddress] = balance.toString();
        } catch (_err) {
          // If balance fetch fails, set to 0
          tokenBalances[tokenAddress] = '0';
        }
      }
      
      balances.value = tokenBalances;
    } catch (err) {
      error.value = 'Failed to update balances';
    }
  };

  /**
   * Estimate gas for swap
   * @param params - Swap parameters
   * @returns Promise that resolves when gas estimate is complete
   */
  const estimateGas = async (params: SwapParams): Promise<void> => {
    try {
      // Get quote first to get gas estimate
      const route = await swapService.getQuote({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: BigInt(params.amountIn),
        ...(params.slippage !== undefined && { slippage: params.slippage })
      });
      
      // Convert gas estimate to readable format
      const gasLimit = route.gasEstimate.toString();
      const gasPrice = '30'; // Default gas price in gwei
      const gasCostWei = route.gasEstimate * BigInt(gasPrice) * BigInt('1000000000');
      const totalCostEth = Number(gasCostWei) / 1e18;
      
      // Estimate USD cost (assuming ETH price of $2000)
      const ethPrice = 2000; // In production, get from price oracle
      const totalCostUSD = totalCostEth * ethPrice;
      
      gasEstimate.value = {
        gasLimit,
        gasPrice,
        totalCost: totalCostEth.toFixed(6),
        totalCostUSD: totalCostUSD.toFixed(2)
      };
    } catch (err) {
      error.value = 'Failed to estimate gas';
    }
  };

  /**
   * Clear swap data
   * @returns void
   */
  const clearSwap = (): void => {
    quote.value = null;
    error.value = '';
    transactionStatus.value = 'idle';
    transactionHash.value = '';
    needsApproval.value = false;
    gasEstimate.value = null;
  };

  return {
    // State
    availableTokens,
    balances,
    quote,
    slippage,
    deadline,
    expertMode,
    needsApproval,
    transactionStatus,
    transactionHash,
    error,
    recentSwaps,
    gasEstimate,
    
    // Methods
    fetchAvailableTokens,
    getQuote,
    checkApproval,
    approveToken,
    executeSwap,
    updateBalances,
    estimateGas,
    clearSwap
  };
});