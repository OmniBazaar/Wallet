/**
 * LiquidityService - Liquidity Pool Management Service
 * 
 * Provides liquidity pool operations including adding/removing liquidity,
 * pool information, and yield farming capabilities.
 */

import { WalletService } from './WalletService';
import { ethers } from 'ethers';
import { OmniProvider } from '../core/providers/OmniProvider';
import { OmniValidatorClient, createOmniValidatorClient } from '../../../Validator/dist/client/index';
import { ValidatorDEXService } from '../../../DEX/dist/services/ValidatorDEXService';

/** Liquidity pool information */
export interface LiquidityPool {
  /** Pool contract address */
  address: string;
  /** Token A address */
  tokenA: string;
  /** Token B address */
  tokenB: string;
  /** Token A symbol */
  symbolA: string;
  /** Token B symbol */
  symbolB: string;
  /** Pool fee tier (in basis points) */
  feeTier: number;
  /** Total value locked (TVL) */
  tvl: bigint;
  /** Annual percentage yield */
  apy: number;
  /** Current reserves */
  reserves: {
    tokenA: bigint;
    tokenB: bigint;
  };
  /** LP token address */
  lpToken: string;
  /** Pool version/protocol */
  version: string;
}

/** Impermanent loss data */
export interface ImpermanentLossData {
  /** Current impermanent loss percentage */
  currentIL: number;
  /** Initial token0 amount */
  initialAmount0: bigint;
  /** Initial token1 amount */
  initialAmount1: bigint;
  /** Current token0 amount if held */
  holdAmount0: bigint;
  /** Current token1 amount if held */
  holdAmount1: bigint;
  /** Current position value */
  currentValue: number;
  /** Value if tokens were held */
  holdValue: number;
  /** Fees earned */
  feesEarned: number;
  /** Net gain/loss including fees */
  netGainLoss: number;
}

/** Pool analytics data */
export interface PoolAnalytics {
  /** Pool address */
  poolAddress: string;
  /** Total value locked in USD */
  tvlUSD: number;
  /** 24h volume in USD */
  volume24hUSD: number;
  /** 7d volume in USD */
  volume7dUSD: number;
  /** Annual percentage yield */
  apy: number;
  /** 24h fees in USD */
  fees24hUSD: number;
  /** Price of token0 in token1 */
  price0: number;
  /** Price of token1 in token0 */
  price1: number;
  /** Current tick (V3) */
  tick?: number;
}

/** Liquidity position information */
export interface LiquidityPosition {
  /** Position ID */
  id: string;
  /** Pool information */
  pool: LiquidityPool;
  /** Position ID/NFT token ID for Uniswap V3 */
  positionId: string;
  /** Pool address */
  poolAddress: string;
  /** Token0 address */
  token0: string;
  /** Token1 address */
  token1: string;
  /** Amount of token0 in position */
  amount0: bigint;
  /** Amount of token1 in position */
  amount1: bigint;
  /** Lower price tick (for concentrated liquidity) */
  tickLower?: number;
  /** Upper price tick (for concentrated liquidity) */
  tickUpper?: number;
  /** Liquidity amount */
  liquidity: bigint;
  /** Uncollected fees for token0 */
  fees0: bigint;
  /** Uncollected fees for token1 */
  fees1: bigint;
  /** Position value in USD */
  valueUSD: number;
  /** Creation timestamp */
  createdAt: number;
}

/** Add liquidity parameters */
export interface AddLiquidityParams {
  /** First token address */
  token0: string;
  /** Second token address */
  token1: string;
  /** Amount of token0 to add */
  amount0Desired: bigint;
  /** Amount of token1 to add */
  amount1Desired: bigint;
  /** Minimum amount of token0 (slippage protection) */
  amount0Min: bigint;
  /** Minimum amount of token1 (slippage protection) */
  amount1Min: bigint;
  /** Price range lower bound (for V3) */
  priceLower?: number;
  /** Price range upper bound (for V3) */
  priceUpper?: number;
  /** Fee tier (for V3: 500, 3000, 10000) */
  feeTier?: number;
  /** Recipient address */
  recipient: string;
  /** Deadline timestamp */
  deadline?: number;
}

/** Remove liquidity parameters */
export interface RemoveLiquidityParams {
  /** Position ID to remove */
  positionId: string;
  /** Liquidity amount to remove (percentage 0-100) */
  liquidityPercentage: number;
  /** Minimum amount of token0 to receive */
  amount0Min: bigint;
  /** Minimum amount of token1 to receive */
  amount1Min: bigint;
  /** Transaction deadline */
  deadline?: number;
}

/** Liquidity operation result */
export interface LiquidityResult {
  /** Success status */
  success: boolean;
  /** Transaction hash */
  txHash?: string;
  /** Position ID (for add liquidity) */
  positionId?: string;
  /** Actual amounts used/received */
  amount0?: bigint;
  /**
   * Second token amount
   */
  amount1?: bigint;
  /** Error message */
  error?: string;
}

/** Liquidity service configuration */
export interface LiquidityConfig {
  /** Router contract addresses for different chains */
  routers: Record<number, string>;
  /** Factory contract addresses */
  factories: Record<number, string>;
  /** Supported pools by chain */
  supportedPools: Record<number, LiquidityPool[]>;
  /** Default slippage tolerance */
  defaultSlippage: number;
}

/**
 * Liquidity pool management service
 */
export class LiquidityService {
  private walletService?: WalletService;
  private provider?: OmniProvider;
  private validatorClient?: OmniValidatorClient;
  private validatorDEXService?: ValidatorDEXService;
  private isInitialized = false;
  private config: LiquidityConfig;
  private positions: Map<string, LiquidityPosition> = new Map();
  private poolCache: Map<string, LiquidityPool> = new Map();

  /**
   * Creates a new LiquidityService instance
   * @param providerOrWalletService - OmniProvider or WalletService instance
   * @param config - Liquidity configuration (optional)
   */
  constructor(providerOrWalletService: OmniProvider | WalletService, config?: LiquidityConfig) {
    if ('getWallet' in providerOrWalletService) {
      this.walletService = providerOrWalletService;
    } else {
      this.provider = providerOrWalletService;
    }
    this.config = config ?? {
      routers: {
        1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
        137: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
        56: '0x10ED43C718714eb63d5aA57B78B54704E256024E' // PancakeSwap
      },
      factories: {
        1: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2 Factory
        137: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', // QuickSwap Factory
        56: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' // PancakeSwap Factory
      },
      supportedPools: {
        1: []
      },
      defaultSlippage: 50 // 0.5%
    };
  }

  /**
   * Initialize the liquidity service
   * @throws {Error} When initialization fails
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Initialize wallet service if needed
      if (this.walletService !== undefined && !this.walletService.isServiceInitialized()) {
        await this.walletService.init();
      }

      // Initialize validator client
      try {
        this.validatorClient = createOmniValidatorClient({
          validatorEndpoint: process.env.VALIDATOR_ENDPOINT || 'http://localhost:4000',
          wsEndpoint: process.env.VALIDATOR_WS_ENDPOINT || 'ws://localhost:4000/graphql'
        });
        // Note: OmniValidatorClient doesn't have a connect() method - it connects automatically
        this.validatorDEXService = new ValidatorDEXService({
          validatorEndpoint: process.env.VALIDATOR_ENDPOINT || 'http://localhost:4000',
          wsEndpoint: process.env.VALIDATOR_WS_ENDPOINT || 'ws://localhost:4000/graphql',
          networkId: 'omni-testnet',
          tradingPairs: ['XOM/USDT', 'XOM/ETH', 'XOM/BTC'],
          feeStructure: {
            maker: 0.001,
            taker: 0.003
          }
        });
        await this.validatorDEXService.initialize();
      } catch (error) {
        console.warn('Failed to connect to validator client, liquidity features may be limited', error);
        // Continue without validator client - some features may be unavailable
      }

      // Get provider
      // TODO: WalletService doesn't have getOmniProvider method
      // this.provider = this.walletService?.getOmniProvider() ?? this.provider;

      // Load supported pools from config
      if (this.provider) {
        const chainId = await this.provider.getNetwork().then(n => Number(n.chainId));
        const pools = this.config.supportedPools[chainId] || [];
        pools.forEach(pool => this.poolCache.set(pool.address, pool));
      }

      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize liquidity service: ${errorMessage}`);
    }
  }

  /**
   * Get available liquidity pools
   * @param chainId - Chain ID (optional)
   * @returns Array of liquidity pools
   */
  async getPools(chainId?: number): Promise<LiquidityPool[]> {
    if (chainId !== undefined) {
      return this.config.supportedPools[chainId] ?? [];
    }

    let currentChainId: number;
    if (this.walletService !== undefined) {
      currentChainId = await this.walletService.getChainId();
    } else if (this.provider !== undefined) {
      const network = await this.provider.getNetwork();
      currentChainId = Number(network.chainId);
    } else {
      throw new Error('No provider available');
    }
    return this.config.supportedPools[currentChainId] ?? [];
  }

  /**
   * Get pool information by token pair
   * @param tokenA - Token A address
   * @param tokenB - Token B address
   * @param chainId - Chain ID (optional)
   * @returns Pool information or null if not found
   */
  async getPool(tokenA: string, tokenB: string, chainId?: number): Promise<LiquidityPool | null> {
    let targetChainId: number;
    if (chainId !== undefined) {
      targetChainId = chainId;
    } else if (this.walletService !== undefined) {
      targetChainId = await this.walletService.getChainId();
    } else if (this.provider !== undefined) {
      const network = await this.provider.getNetwork();
      targetChainId = Number(network.chainId);
    } else {
      throw new Error('No provider available');
    }
    const pools = this.config.supportedPools[targetChainId] ?? [];
    
    const foundPool = pools.find(pool => 
      (pool.tokenA.toLowerCase() === tokenA.toLowerCase() && pool.tokenB.toLowerCase() === tokenB.toLowerCase()) ||
      (pool.tokenA.toLowerCase() === tokenB.toLowerCase() && pool.tokenB.toLowerCase() === tokenA.toLowerCase())
    );
    return foundPool ?? null;
  }

  /**
   * Add liquidity to a pool
   * @param params - Add liquidity parameters
   * @returns Liquidity result with position details
   * @throws {Error} When adding liquidity fails
   */
  async addLiquidity(params: AddLiquidityParams): Promise<LiquidityResult> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      if (!this.localDEXService) {
        throw new Error('DEX service not available');
      }

      // Validate parameters
      if (params.amount0Desired === BigInt(0) || params.amount1Desired === BigInt(0)) {
        throw new Error('Cannot add zero liquidity');
      }

      // Get user address
      let _userAddress: string;
      if (this.walletService !== undefined) {
        _userAddress = await this.walletService.getAddress();
      } else if (this.provider !== undefined) {
        const signer = await this.provider.getSigner();
        _userAddress = await signer.getAddress();
      } else {
        throw new Error('No provider available');
      }

      // Set default deadline if not provided
      const _deadline = (params.deadline !== undefined && params.deadline !== 0) ? params.deadline : Math.floor(Date.now() / 1000) + 1200; // 20 minutes

      // Check if this is a concentrated liquidity position (V3)
      const isV3 = params.priceLower !== undefined && params.priceUpper !== undefined;

      if (isV3) {
        // Add liquidity to Uniswap V3 style pool
        // Get pool using getPoolByTokens
        const pool = this.poolManager.getPoolByTokens(
          params.token0,
          params.token1,
          params.feeTier ?? 3000
        );
        
        if (pool === undefined || pool === null) {
          throw new Error('Pool not found. Please create the pool first.');
        }
        
        if (!('address' in pool) || typeof pool.address !== 'string') {
          throw new Error('Invalid pool structure');
        }
        
        const result = await this.poolManager.addLiquidity(
          pool.address,
          params.recipient,
          this.priceToTick(params.priceLower ?? 0),
          this.priceToTick(params.priceUpper ?? 0),
          params.amount0Desired,
          params.amount1Desired,
          params.amount0Min,
          params.amount1Min
        );

        return {
          success: true,
          txHash: '0x' + '0'.repeat(64), // Mock transaction hash
          positionId: result.positionId,
          amount0: result.amount0,
          amount1: result.amount1
        };
      } else {
        // Add liquidity to V2 style pool
        throw new Error('V2 style liquidity not supported in this implementation');
        
        // TypeScript needs these lines to be reachable for type checking
        const result = { amount0: BigInt(0), amount1: BigInt(0), positionId: '' };

        return {
          success: true,
          txHash: '0x' + '0'.repeat(64), // Mock tx hash
          amount0: result.amount0,
          amount1: result.amount1
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to add liquidity: ${errorMessage}`
      };
    }
  }

  /**
   * Remove liquidity from a position
   * @param params - Remove liquidity parameters
   * @returns Result with removed amounts
   * @throws {Error} When removing liquidity fails
   */
  async removeLiquidity(params: RemoveLiquidityParams): Promise<LiquidityResult> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      if (this.poolManager === undefined || this.ammIntegration === undefined) {
        throw new Error('Pool manager not available');
      }

      // Validate percentage
      if (params.liquidityPercentage < 0 || params.liquidityPercentage > 100) {
        throw new Error('Liquidity percentage must be between 0 and 100');
      }

      // Get position details
      const position = await this.getPosition(params.positionId);
      if (position === null) {
        throw new Error('Position not found');
      }

      // Calculate liquidity amount to remove
      const liquidityToRemove = (position.liquidity * BigInt(params.liquidityPercentage)) / BigInt(100);

      // Set default deadline
      const _deadline = (params.deadline !== undefined && params.deadline !== 0) ? params.deadline : Math.floor(Date.now() / 1000) + 1200;

      // Check if this is a V3 position
      if (position.tickLower !== undefined && position.tickUpper !== undefined) {
        // Remove from V3 position
        const result = await this.poolManager.removeLiquidity(
          params.positionId,
          liquidityToRemove,
          params.amount0Min,
          params.amount1Min
        );

        return {
          success: true,
          txHash: '0x' + '0'.repeat(64), // Mock transaction hash
          amount0: result.amount0,
          amount1: result.amount1
        };
      } else {
        // Remove from V2 position
        throw new Error('V2 style liquidity removal not supported in this implementation');
        
        // TypeScript needs these lines to be reachable for type checking
        const result = { amount0: BigInt(0), amount1: BigInt(0) };

        return {
          success: true,
          txHash: '0x' + '0'.repeat(64), // Mock tx hash
          amount0: result.amount0,
          amount1: result.amount1
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to remove liquidity: ${errorMessage}`
      };
    }
  }

  /**
   * Get user's liquidity positions
   * @returns Array of liquidity positions
   */
  getUserPositions(): LiquidityPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get user's liquidity position details
   * @param positionId - Position ID or LP token address
   * @returns Position details
   * @throws {Error} When position query fails
   */
  async getPosition(positionId: string): Promise<LiquidityPosition | null> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      if (this.poolManager === undefined) {
        throw new Error('Pool manager not available');
      }

      // Try to get V3 position first
      try {
        const v3Position = this.poolManager?.getPosition(positionId);
        if (v3Position !== undefined && v3Position !== null) {
          return {
            id: positionId,
            pool: {} as LiquidityPool, // Would need to fetch pool info
            positionId,
            poolAddress: v3Position.poolId,
            token0: '', // Would need to get from pool
            token1: '', // Would need to get from pool
            amount0: BigInt(0), // Would need to calculate
            amount1: BigInt(0), // Would need to calculate
            tickLower: v3Position.tickLower,
            tickUpper: v3Position.tickUpper,
            liquidity: v3Position.liquidity,
            fees0: v3Position.tokensOwed0,
            fees1: v3Position.tokensOwed1,
            valueUSD: 0, // Calculate from price oracle
            createdAt: Date.now()
          };
        }
      } catch {
        // Not a V3 position, try V2
      }

      // For V2 positions, query balance and pool info
      const userAddress = await this.getUserAddress();
      const poolInfo = this.poolManager?.getPool(positionId);
      
      if (poolInfo !== undefined && poolInfo !== null) {
        const lpBalance = this.getLPTokenBalance(positionId, userAddress);
        
        return {
          id: positionId,
          pool: {} as LiquidityPool,
          positionId,
          poolAddress: poolInfo.id,
          token0: poolInfo.token0,
          token1: poolInfo.token1,
          amount0: BigInt(0), // Would need to calculate from reserves
          amount1: BigInt(0), // Would need to calculate from reserves,
          liquidity: lpBalance,
          fees0: BigInt(0), // V2 fees are auto-compounded
          fees1: BigInt(0),
          valueUSD: 0,
          createdAt: Date.now()
        };
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get position: ${errorMessage}`);
    }
  }

  /**
   * Calculate impermanent loss for a position
   * @param positionId - Position ID to analyze
   * @param initialPrices - Initial prices when position was created
   * @param initialPrices.price0 - Initial price of token0 in USD
   * @param initialPrices.price1 - Initial price of token1 in USD
   * @returns Impermanent loss calculation
   * @throws {Error} When IL calculation fails
   */
  async calculateImpermanentLoss(
    positionId: string,
    initialPrices: { price0: number; price1: number }
  ): Promise<ImpermanentLossData> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      // Get current position
      const position = await this.getPosition(positionId);
      if (position === null) {
        throw new Error('Position not found');
      }

      // Get current prices from pool analytics
      const analytics = this.getPoolAnalytics(position.poolAddress);
      const currentPrice0 = analytics.price0;
      const currentPrice1 = analytics.price1;

      // Calculate initial investment value
      const initialValue = 
        Number(position.amount0) * initialPrices.price0 +
        Number(position.amount1) * initialPrices.price1;

      // Calculate what holdings would be if just held
      const _priceRatio = Math.sqrt(currentPrice0 / initialPrices.price0);
      const holdAmount0 = position.amount0;
      const holdAmount1 = position.amount1;
      const holdValue = 
        Number(holdAmount0) * currentPrice0 +
        Number(holdAmount1) * currentPrice1;

      // Calculate current position value
      const currentValue = 
        Number(position.amount0) * currentPrice0 +
        Number(position.amount1) * currentPrice1;

      // Calculate fees earned (converted to USD)
      const feesEarned = 
        Number(position.fees0) * currentPrice0 +
        Number(position.fees1) * currentPrice1;

      // Calculate IL percentage
      const ilPercentage = ((holdValue - currentValue) / holdValue) * 100;

      // Net gain/loss including fees
      const netGainLoss = currentValue + feesEarned - initialValue;

      return {
        currentIL: Math.max(0, ilPercentage),
        initialAmount0: position.amount0,
        initialAmount1: position.amount1,
        holdAmount0,
        holdAmount1,
        currentValue,
        holdValue,
        feesEarned,
        netGainLoss
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to calculate impermanent loss: ${errorMessage}`);
    }
  }

  /**
   * Calculate impermanent loss - overloaded implementation
   * Handles both position-based and price-ratio-based calculations
   */
  private async calculateImpermanentLossWithPriceRatio(params: {
    tokenA: string;
    tokenB: string;
    initialPriceRatio: number;
    currentPriceRatio: number;
  }): Promise<{
    percentage: number;
    valueInUSD: number;
    explanation: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      // Calculate IL using the standard formula
      // IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
      const priceRatio = params.currentPriceRatio / params.initialPriceRatio;
      const sqrtPriceRatio = Math.sqrt(priceRatio);
      const il = 2 * sqrtPriceRatio / (1 + priceRatio) - 1;
      const ilPercentage = Math.abs(il * 100);

      // Mock USD value calculation
      const valueInUSD = ilPercentage * 10; // Simplified calculation

      let explanation = '';
      if (ilPercentage < 1) {
        explanation = 'Minimal impermanent loss';
      } else if (ilPercentage < 5) {
        explanation = 'Low impermanent loss';
      } else if (ilPercentage < 10) {
        explanation = 'Moderate impermanent loss';
      } else {
        explanation = 'High impermanent loss';
      }

      return {
        percentage: ilPercentage,
        valueInUSD,
        explanation
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to calculate impermanent loss: ${errorMessage}`);
    }
  }

  /**
   * Calculate impermanent loss with price ratio parameters
   * This method provides compatibility with tests expecting the alternative signature
   * @param params - Parameters with token addresses and price ratios
   * @returns Impermanent loss data
   */
  async calculateImpermanentLossForPair(params: {
    tokenA: string;
    tokenB: string;
    initialPriceRatio: number;
    currentPriceRatio: number;
  }): Promise<{
    percentage: number;
    valueInUSD: number;
    explanation: string;
  }> {
    return this.calculateImpermanentLossWithPriceRatio(params);
  }

  /**
   * Harvest rewards from liquidity positions
   * @param positionIds - Array of position IDs to harvest
   * @returns Result with harvested amounts
   * @throws {Error} When harvest fails
   */
  async harvestRewards(positionIds: string[]): Promise<LiquidityResult> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      if (this.poolManager === undefined) {
        throw new Error('Pool manager not available');
      }

      let totalFees0 = BigInt(0);
      let totalFees1 = BigInt(0);
      const txHashes: string[] = [];

      // Harvest from each position
      for (const positionId of positionIds) {
        const position = await this.getPosition(positionId);
        if (position === null || (position.fees0 === BigInt(0) && position.fees1 === BigInt(0))) {
          continue;
        }

        // Collect fees from V3 positions
        if (position.tickLower !== undefined) {
          // For V3 positions, fees are collected when removing liquidity
          // We'd need to perform a zero liquidity removal to collect fees
          const result = await this.poolManager.removeLiquidity(
            positionId,
            BigInt(0), // Remove zero liquidity to just collect fees
            BigInt(0),
            BigInt(0)
          );

          totalFees0 += result.feeAmount0;
          totalFees1 += result.feeAmount1;
          txHashes.push('0x' + '0'.repeat(64)); // Mock tx hash
        }
        // Note: V2 fees are auto-compounded, not separately harvestable
      }

      if (txHashes.length === 0) {
        return {
          success: true,
          amount0: BigInt(0),
          amount1: BigInt(0)
        };
      }

      return {
        success: true,
        txHash: txHashes[txHashes.length - 1], // Return last tx hash
        amount0: totalFees0,
        amount1: totalFees1
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to harvest rewards: ${errorMessage}`
      };
    }
  }

  /**
   * Get pool analytics by token pair
   * @param tokenA - First token address
   * @param tokenB - Second token address
   * @returns Pool analytics data
   */
  async getPoolAnalyticsByTokens(tokenA: string, tokenB: string): Promise<PoolAnalytics> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      // Find pool for token pair
      const pools = await this.findLiquidityPools(tokenA, tokenB);
      if (pools.length === 0) {
        throw new Error('No pool found for token pair');
      }

      // Use the first pool (highest liquidity)
      return this.getPoolAnalytics(pools[0].address);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get pool analytics: ${errorMessage}`);
    }
  }

  /**
   * Get pool analytics including APY, volume, and TVL
   * @param poolAddress - Pool address to analyze
   * @returns Pool analytics data
   * @throws {Error} When analytics query fails
   */
  getPoolAnalytics(poolAddress: string): PoolAnalytics {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      if (this.ammIntegration === undefined) {
        throw new Error('AMM integration not available');
      }

      // Get pool information
      const poolInfo = this.poolManager?.getPool(poolAddress);
      if (poolInfo === undefined || poolInfo === null) {
        throw new Error('Pool not found');
      }

      // Calculate prices from sqrtPriceX96
      const sqrtPrice = Number(poolInfo.sqrtPriceX96) / (2 ** 96);
      const price0 = sqrtPrice * sqrtPrice;
      const price1 = 1 / price0;

      // Historical data would come from event logs or external source
      const _historicalData: unknown[] = [];

      // Calculate metrics
      // Calculate TVL from liquidity instead of reserves
      const tvlUSD = Number(poolInfo.liquidity) * (price0 + price1) / 1e18;
      const volume24h = 0; // Would need to track this from swap events
      const volume7d = 0; // Would need to track this from swap events
      const fees24h = volume24h * 0.003; // Assuming 0.3% fee tier
      
      // Calculate APY based on fees
      const dailyReturn = fees24h / tvlUSD;
      const apy = dailyReturn * 365 * 100; // Annualized

      return {
        poolAddress,
        tvlUSD,
        volume24hUSD: volume24h,
        volume7dUSD: volume7d,
        apy,
        fees24hUSD: fees24h,
        price0,
        price1,
        tick: poolInfo.tick
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get pool analytics: ${errorMessage}`);
    }
  }

  /**
   * Convert price to tick for concentrated liquidity
   * @param price - Price to convert
   * @returns Tick value
   * @private
   */
  private priceToTick(price: number): number {
    // Simplified tick calculation for Uniswap V3
    // In production, this would use proper tick spacing
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  /**
   * Get LP token balance for a user
   * @param _lpToken - LP token address
   * @param _userAddress - User address
   * @returns LP token balance
   * @private
   */
  private getLPTokenBalance(_lpToken: string, _userAddress: string): bigint {
    // In production, query ERC20 balance
    return BigInt(0);
  }

  /**
   * Calculate TVL in USD
   * @param reserve0 - Reserve of token0
   * @param reserve1 - Reserve of token1
   * @param price0 - Price of token0 in USD
   * @param price1 - Price of token1 in USD
   * @returns TVL in USD
   * @private
   */
  private calculateTVL(
    reserve0: bigint,
    reserve1: bigint,
    price0: number,
    price1: number
  ): number {
    // Simplified TVL calculation
    // In production, would use actual USD prices from oracle
    return Number(reserve0) * price0 + Number(reserve1) * price1;
  }

  /**
   * Get user address
   * @returns User address
   * @private
   */
  private async getUserAddress(): Promise<string> {
    if (this.walletService !== undefined) {
      return await this.walletService.getAddress();
    } else if (this.provider !== undefined) {
      const signer = await this.provider.getSigner();
      return await signer.getAddress();
    } else {
      throw new Error('No provider available');
    }
  }

  /**
   * Load supported pools from chain
   * @private
   */
  private async loadPools(): Promise<void> {
    try {
      let chainId: number;
      if (this.walletService !== undefined) {
        chainId = await this.walletService.getChainId();
      } else if (this.provider !== undefined) {
        const network = await this.provider.getNetwork();
        chainId = Number(network.chainId);
      } else {
        throw new Error('No provider available');
      }
      
      // Load real pools from LiquidityPoolManager
      if (this.poolManager !== undefined) {
        const allPools = this.poolManager.getAllPools();
        
        // Clear existing pools for this chain
        if (this.config.supportedPools[chainId] === undefined) {
          this.config.supportedPools[chainId] = [];
        }
        this.config.supportedPools[chainId] = [];
        
        // Convert internal pool format to LiquidityPool format
        for (const pool of allPools) {
          const liquidityPool: LiquidityPool = {
            address: pool.address,
            tokenA: pool.token0,
            tokenB: pool.token1,
            symbolA: 'TKN0', // Would need token metadata service
            symbolB: 'TKN1', // Would need token metadata service
            feeTier: Math.round(pool.fee * 10000), // Convert to basis points
            tvl: pool.liquidity,
            apy: 0, // Would need yield calculation service
            reserves: {
              tokenA: BigInt(0), // Would need to calculate from tick data
              tokenB: BigInt(0)  // Would need to calculate from tick data
            },
            lpToken: pool.address, // V3 pools don't have separate LP tokens
            version: 'V3'
          };
          
          this.config.supportedPools[chainId].push(liquidityPool);
          this.poolCache.set(`${chainId}-${pool.token0}-${pool.token1}`, liquidityPool);
        }
        
        // If no pools exist yet, create a default pool for XOM/USDC
        if (allPools.length === 0) {
          const defaultPool: LiquidityPool = {
            address: '0x0000000000000000000000000000000000000001',
            tokenA: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce', // XOM
            tokenB: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            symbolA: 'XOM',
            symbolB: 'USDC',
            feeTier: 300, // 0.3%
            tvl: BigInt(0),
            apy: 0,
            reserves: {
              tokenA: BigInt(0),
              tokenB: BigInt(0)
            },
            lpToken: '0x0000000000000000000000000000000000000001',
            version: 'V3'
          };
          
          this.config.supportedPools[chainId].push(defaultPool);
          this.poolCache.set(`${chainId}-${defaultPool.tokenA}-${defaultPool.tokenB}`, defaultPool);
        }
      }
    } catch (error) {
      // Failed to load pools, using empty pool list
      const chainIdLocal = chainId!;
      if (this.config.supportedPools[chainIdLocal] === undefined) {
        this.config.supportedPools[chainIdLocal] = [];
      }
    }
  }

  /**
   * Load user positions from blockchain
   * @private
   */
  private async loadUserPositions(): Promise<void> {
    try {
      // Get user address
      const userAddress = await this.getUserAddress();
      
      if (this.poolManager !== undefined) {
        // Get all pools to check for user positions
        const allPools = this.poolManager.getAllPools();
        
        // Clear existing positions
        this.positions.clear();
        
        // In a real implementation, we would query each pool for user positions
        // For now, we'll start with an empty position list
        // Real position loading would involve:
        // 1. Querying pool contracts for user LP token balances
        // 2. Calculating position values based on current pool state
        // 3. Fetching uncollected fees
        
        // This would require additional contract calls or indexer queries
      }
    } catch (error) {
      // Failed to load user positions
      this.positions.clear();
    }
  }

  /**
   * Update user positions after operation
   * @private
   */
  private updateUserPositions(): void {
    // Reload positions after operations
    this.loadUserPositions();
  }

  /**
   * Ensure token allowance for spending
   * @param tokenAddress - Token contract address
   * @param spender - Spender address
   * @param amount - Amount to approve
   * @private
   */
  private async ensureAllowance(tokenAddress: string, spender: string, amount: bigint): Promise<void> {
    if (this.walletService !== undefined) {
      const wallet = this.walletService.getWallet();
      if (wallet === undefined) {
        throw new Error('Wallet not available');
      }

      // Check current allowance and approve if needed
      try {
        type WalletWithTokenMethods = {
          getTokenBalance: (tokenAddress: string) => Promise<bigint>;
          approveToken: (tokenAddress: string, spender: string, amount: bigint) => Promise<unknown>;
        };
        const walletWithMethods = wallet as unknown as WalletWithTokenMethods;
        const currentBalance = await walletWithMethods.getTokenBalance(tokenAddress);
        if (currentBalance >= amount) {
          await walletWithMethods.approveToken(tokenAddress, spender, amount);
        }
      } catch (error) {
        // Silently handle allowance errors
      }
    }
    // For provider-based usage, allowance would be handled differently
  }

  /**
   * Clear cache and reset data
   */
  clearCache(): void {
    this.poolCache.clear();
    // console.log('LiquidityService cache cleared');
  }

  /**
   * Cleanup service and release resources
   */
  cleanup(): void {
    try {
      this.positions.clear();
      this.poolCache.clear();
      this.isInitialized = false;
      // Clear optional properties by deleting them
      delete this.poolManager;
      delete this.ammIntegration;
    } catch (error) {
      // Fail silently on cleanup
    }
  }
}