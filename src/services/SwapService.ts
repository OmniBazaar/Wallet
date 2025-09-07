/**
 * Swap Service
 *
 * Handles token swaps across multiple DEXs and chains.
 * Finds best routes and executes swaps with minimal slippage.
 *
 * @module services/SwapService
 */

import { ethers } from 'ethers';
import { OmniProvider } from '../core/providers/OmniProvider';

/**
 * Swap route information
 */
export interface SwapRoute {
  /** Source token address */
  fromToken: string;
  /** Destination token address */
  toToken: string;
  /** Input amount in wei */
  inputAmount: string;
  /** Expected output amount in wei */
  outputAmount: string;
  /** Estimated slippage percentage */
  estimatedSlippage: number;
  /** Swap path through intermediary tokens */
  path: string[];
  /** DEX protocol name */
  dex: string;
  /** Estimated gas cost */
  gasEstimate: string;
}

/**
 * Swap execution options
 */
export interface SwapOptions {
  /** Skip user confirmation prompts if true */
  skipConfirmation?: boolean;
  /** Maximum allowed slippage in percent */
  maxSlippage?: number;
  /** Deadline timestamp (seconds) after which the swap is invalid */
  deadline?: number;
  /** Recipient address (defaults to sender) */
  recipient?: string;
}

/**
 * DEX configuration
 */
interface DexConfig {
  name: string;
  router: string;
  factory: string;
  chainId: number;
}

/**
 * Swap Service
 */
export class SwapService {
  private provider: OmniProvider;
  private dexConfigs: Map<string, DexConfig>;

  /**
   * Initialize SwapService with an OmniProvider for quotes and execution.
   * @param provider OmniProvider connected to validator network
   */
  constructor(provider: OmniProvider) {
    this.provider = provider;
    this.dexConfigs = new Map();
    this.initializeDexConfigs();
  }

  /**
   * Initialize DEX configurations
   */
  private initializeDexConfigs(): void {
    // OmniBazaar DEX
    this.dexConfigs.set('omnidex', {
      name: 'OmniDEX',
      router: '0x0000000000000000000000000000000000000003',
      factory: '0x0000000000000000000000000000000000000004',
      chainId: 43114 // Avalanche
    });

    // Uniswap V3
    this.dexConfigs.set('uniswap', {
      name: 'Uniswap V3',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      chainId: 1 // Ethereum
    });

    // Trader Joe (Avalanche)
    this.dexConfigs.set('traderjoe', {
      name: 'Trader Joe',
      router: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
      factory: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
      chainId: 43114 // Avalanche
    });
  }

  /**
   * Get the best available swap route across supported DEXes.
   * @param fromToken Input token address
   * @param toToken Output token address
   * @param amount Input amount (wei)
   */
  public async getBestRoute(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapRoute | null> {
    try {
      // Query multiple DEXs for quotes
      const routes = await Promise.all([
        this.getOmniDexRoute(fromToken, toToken, amount),
        this.getUniswapRoute(fromToken, toToken, amount),
        this.getTraderJoeRoute(fromToken, toToken, amount)
      ]);

      // Filter out null routes
      const validRoutes = routes.filter(r => r !== null);

      if (validRoutes.length === 0) {
        return null;
      }

      // Find route with best output amount
      return validRoutes.reduce((best, current) => {
        const bestOutput = parseFloat(best.outputAmount);
        const currentOutput = parseFloat(current.outputAmount);
        return currentOutput > bestOutput ? current : best;
      });
    } catch (error) {
      console.error('Error finding swap route:', error);
      return null;
    }
  }

  /** Query OmniDEX for a quoted route. */
  private async getOmniDexRoute(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapRoute | null> {
    try {
      const config = this.dexConfigs.get('omnidex')!;

      // Query OmniDEX through validator
      const route = await this.provider.send('omni_getSwapQuote', [{
        dex: 'omnidex',
        fromToken,
        toToken,
        amount
      }]);

      if (!route) return null;

      return {
        fromToken,
        toToken,
        inputAmount: amount,
        outputAmount: route.outputAmount,
        estimatedSlippage: route.slippage,
        path: route.path,
        dex: 'omnidex',
        gasEstimate: route.gasEstimate
      };
    } catch (error) {
      console.error('OmniDEX route error:', error);
      return null;
    }
  }

  /** Query Uniswap for a quoted route (if on the correct chain). */
  private async getUniswapRoute(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapRoute | null> {
    try {
      const config = this.dexConfigs.get('uniswap')!;

      // Check if on Ethereum mainnet
      const chainId = await this.provider.getNetwork().then(n => Number(n.chainId));
      if (chainId !== config.chainId) {
        return null;
      }

      // Query Uniswap quoter
      const quoterAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
      const quoterABI = [
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
      ];

      const quoter = new ethers.Contract(quoterAddress, quoterABI, this.provider) as ethers.Contract & {
        quoteExactInputSingle: {
          staticCall: (tokenIn: string, tokenOut: string, fee: number, amountIn: bigint, sqrtPriceLimitX96: bigint) => Promise<bigint>;
        };
      };
      const amountIn = ethers.parseEther(amount);

      // Try different fee tiers
      const fees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
      let bestOutput = 0n;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let bestFee = 0;

      for (const fee of fees) {
        try {
          const output = await quoter.quoteExactInputSingle.staticCall(
            fromToken,
            toToken,
            fee,
            amountIn,
            0n
          );

          if (output > bestOutput) {
            bestOutput = output;
            bestFee = fee;
          }
        } catch {
          // This fee tier doesn't have a pool
        }
      }

      if (bestOutput === 0n) {
        return null;
      }

      // Calculate slippage
      const expectedOutput = bestOutput;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const worstOutput = (expectedOutput * 995n) / 1000n; // 0.5% slippage
      const slippage = 0.5;

      return {
        fromToken,
        toToken,
        inputAmount: amount,
        outputAmount: ethers.formatEther(bestOutput),
        estimatedSlippage: slippage,
        path: [fromToken, toToken],
        dex: 'uniswap',
        gasEstimate: '200000'
      };
    } catch (error) {
      console.error('Uniswap route error:', error);
      return null;
    }
  }

  /**
   * Get Trader Joe route
   * @param fromToken
   * @param toToken
   * @param amount
   */
  private async getTraderJoeRoute(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapRoute | null> {
    try {
      const config = this.dexConfigs.get('traderjoe')!;

      // Check if on Avalanche
      const chainId = await this.provider.getNetwork().then(n => Number(n.chainId));
      if (chainId !== config.chainId) {
        return null;
      }

      // Query Trader Joe router
      const routerABI = [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
      ];

      const router = new ethers.Contract(config.router, routerABI, this.provider);
      const amountIn = ethers.parseEther(amount);

      // Try direct path
      const path = [fromToken, toToken];
      const amounts = await router.getAmountsOut(amountIn, path);

      if (amounts.length < 2) {
        return null;
      }

      const outputAmount = amounts[amounts.length - 1];

      // Calculate slippage
      const slippage = 0.5; // Default 0.5%

      return {
        fromToken,
        toToken,
        inputAmount: amount,
        outputAmount: ethers.formatEther(outputAmount),
        estimatedSlippage: slippage,
        path,
        dex: 'traderjoe',
        gasEstimate: '250000'
      };
    } catch (error) {
      console.error('Trader Joe route error:', error);
      return null;
    }
  }

  /**
   * Execute swap
   * @param route
   * @param options
   */
  public async executeSwap(
    route: SwapRoute,
    options: SwapOptions = {}
  ): Promise<ethers.ContractTransaction> {
    const {
      skipConfirmation = false,
      maxSlippage = 0.5,
      deadline = Math.floor(Date.now() / 1000) + 300, // 5 minutes
      recipient
    } = options;

    // Validate slippage
    if (route.estimatedSlippage > maxSlippage) {
      throw new Error(`Slippage too high: ${route.estimatedSlippage}% > ${maxSlippage}%`);
    }

    const signer = await this.provider.getSigner();
    const address = await signer.getAddress();
    const to = recipient || address;

    // Execute based on DEX
    switch (route.dex) {
      case 'omnidex':
        return await this.executeOmniDexSwap(route, to, deadline, skipConfirmation);

      case 'uniswap':
        return await this.executeUniswapSwap(route, to, deadline, maxSlippage, skipConfirmation);

      case 'traderjoe':
        return await this.executeTraderJoeSwap(route, to, deadline, maxSlippage, skipConfirmation);

      default:
        throw new Error(`Unsupported DEX: ${route.dex}`);
    }
  }

  /**
   * Execute OmniDEX swap
   * @param route
   * @param recipient
   * @param deadline
   * @param skipConfirmation
   */
  private async executeOmniDexSwap(
    route: SwapRoute,
    recipient: string,
    deadline: number,
    skipConfirmation: boolean
  ): Promise<ethers.ContractTransaction> {
    const signer = await this.provider.getSigner();
    const config = this.dexConfigs.get('omnidex')!;

    const routerABI = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(config.router, routerABI, signer);

    const amountIn = ethers.parseEther(route.inputAmount);
    const amountOutMin = (ethers.parseEther(route.outputAmount) * 995n) / 1000n; // 0.5% slippage

    // Approve router if needed
    await this.approveTokenIfNeeded(route.fromToken, config.router, amountIn);

    // Execute swap
    if (skipConfirmation) {
      // Direct execution without popup
      return await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        route.path,
        recipient,
        deadline,
        { gasLimit: 300000 }
      );
    } else {
      // Would show confirmation
      throw new Error('Swap confirmations not yet implemented');
    }
  }

  /**
   * Execute Uniswap swap
   * @param route
   * @param recipient
   * @param deadline
   * @param maxSlippage
   * @param skipConfirmation
   */
  private async executeUniswapSwap(
    route: SwapRoute,
    recipient: string,
    deadline: number,
    maxSlippage: number,
    skipConfirmation: boolean
  ): Promise<ethers.ContractTransaction> {
    const signer = await this.provider.getSigner();
    const config = this.dexConfigs.get('uniswap')!;

    const routerABI = [
      'function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160) calldata params) external payable returns (uint256 amountOut)'
    ];

    const router = new ethers.Contract(config.router, routerABI, signer);

    const amountIn = ethers.parseEther(route.inputAmount);
    const amountOutMin = (ethers.parseEther(route.outputAmount) * BigInt(1000 - maxSlippage * 10)) / 1000n;

    // Approve router if needed
    await this.approveTokenIfNeeded(route.fromToken, config.router, amountIn);

    const params = {
      tokenIn: route.fromToken,
      tokenOut: route.toToken,
      fee: 3000, // 0.3% fee tier
      recipient,
      deadline,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0
    };

    if (skipConfirmation) {
      return await router.exactInputSingle(params, { gasLimit: 300000 });
    } else {
      throw new Error('Swap confirmations not yet implemented');
    }
  }

  /**
   * Execute Trader Joe swap
   * @param route
   * @param recipient
   * @param deadline
   * @param maxSlippage
   * @param skipConfirmation
   */
  private async executeTraderJoeSwap(
    route: SwapRoute,
    recipient: string,
    deadline: number,
    maxSlippage: number,
    skipConfirmation: boolean
  ): Promise<ethers.ContractTransaction> {
    const signer = await this.provider.getSigner();
    const config = this.dexConfigs.get('traderjoe')!;

    const routerABI = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(config.router, routerABI, signer);

    const amountIn = ethers.parseEther(route.inputAmount);
    const amountOutMin = (ethers.parseEther(route.outputAmount) * BigInt(1000 - maxSlippage * 10)) / 1000n;

    // Approve router if needed
    await this.approveTokenIfNeeded(route.fromToken, config.router, amountIn);

    if (skipConfirmation) {
      return await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        route.path,
        recipient,
        deadline,
        { gasLimit: 300000 }
      );
    } else {
      throw new Error('Swap confirmations not yet implemented');
    }
  }

  /**
   * Approve token if needed
   * @param token
   * @param spender
   * @param amount
   */
  private async approveTokenIfNeeded(
    token: string,
    spender: string,
    amount: bigint
  ): Promise<void> {
    const signer = await this.provider.getSigner();
    const address = await signer.getAddress();

    const tokenABI = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ];

    const tokenContract = new ethers.Contract(token, tokenABI, signer);

    // Check current allowance
    const allowance = await tokenContract['allowance'](address, spender);

    // Approve if needed
    if (allowance < amount) {
      const tx = await tokenContract['approve'](spender, ethers.MaxUint256);
      await tx.wait();
    }
  }

  /**
   * Get token price in USD
   * @param token
   */
  public async getTokenPrice(token: string): Promise<number> {
    try {
      // Query price from validator oracle
      const price = await this.provider.send('omni_getPriceOracle', [{
        token,
        quote: 'USD'
      }]);

      return price.aggregatedPrice;
    } catch (error) {
      console.error('Error getting token price:', error);
      return 0;
    }
  }

  /**
   * Estimate gas for swap
   * @param route
   */
  public async estimateGas(route: SwapRoute): Promise<string> {
    try {
      // Use route's gas estimate if available
      if (route.gasEstimate) {
        return route.gasEstimate;
      }

      // Default estimates by DEX
      switch (route.dex) {
        case 'omnidex':
          return '200000';
        case 'uniswap':
          return '250000';
        case 'traderjoe':
          return '250000';
        default:
          return '300000';
      }
    } catch (error) {
      console.error('Error estimating gas:', error);
      return '300000';
    }
  }
}
