/**
 * LiquidityService - Liquidity Pool Management Service
 * 
 * Provides liquidity pool operations including adding/removing liquidity,
 * pool information, and yield farming capabilities.
 */

import { WalletService } from './WalletService';
import { ethers } from 'ethers';

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

/** Liquidity position information */
export interface LiquidityPosition {
  /** Position ID */
  id: string;
  /** Pool information */
  pool: LiquidityPool;
  /** LP token balance */
  lpTokenBalance: bigint;
  /** Position value in USD */
  valueUSD: number;
  /** Token amounts in the position */
  tokenAmounts: {
    tokenA: bigint;
    tokenB: bigint;
  };
  /** Earned fees */
  earnedFees: {
    tokenA: bigint;
    tokenB: bigint;
  };
  /** Position creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/** Add liquidity parameters */
export interface AddLiquidityParams {
  /** Token A address */
  tokenA: string;
  /** Token B address */
  tokenB: string;
  /** Amount of token A */
  amountA: bigint;
  /** Amount of token B */
  amountB: bigint;
  /** Minimum amount of token A (slippage protection) */
  amountAMin: bigint;
  /** Minimum amount of token B (slippage protection) */
  amountBMin: bigint;
  /** Recipient address */
  to: string;
  /** Deadline timestamp */
  deadline: number;
}

/** Remove liquidity parameters */
export interface RemoveLiquidityParams {
  /** Token A address */
  tokenA: string;
  /** Token B address */
  tokenB: string;
  /** LP token amount to remove */
  liquidity: bigint;
  /** Minimum amount of token A to receive */
  amountAMin: bigint;
  /** Minimum amount of token B to receive */
  amountBMin: bigint;
  /** Recipient address */
  to: string;
  /** Deadline timestamp */
  deadline: number;
}

/** Liquidity operation result */
export interface LiquidityResult {
  /** Success status */
  success: boolean;
  /** Transaction hash */
  txHash?: string;
  /** LP tokens received/burned */
  lpTokens?: bigint;
  /** Token amounts involved */
  tokenAmounts?: {
    tokenA: bigint;
    tokenB: bigint;
  };
  /** Error message */
  error?: string;
  /** Gas used */
  gasUsed?: bigint;
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
 * Liquidity management service
 */
export class LiquidityService {
  private walletService: WalletService;
  private config: LiquidityConfig;
  private isInitialized = false;
  private positions: Map<string, LiquidityPosition> = new Map();
  private poolCache: Map<string, LiquidityPool> = new Map();

  /**
   * Creates a new LiquidityService instance
   * @param walletService - Wallet service instance
   * @param config - Liquidity configuration (optional)
   */
  constructor(walletService: WalletService, config?: LiquidityConfig) {
    this.walletService = walletService;
    this.config = config || {
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

      // Ensure wallet service is initialized
      if (!this.walletService.isServiceInitialized()) {
        await this.walletService.init();
      }

      // Load supported pools
      await this.loadPools();

      // Load user positions
      await this.loadUserPositions();

      this.isInitialized = true;
      // console.log('LiquidityService initialized');
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
      return this.config.supportedPools[chainId] || [];
    }

    const currentChainId = await this.walletService.getChainId();
    return this.config.supportedPools[currentChainId] || [];
  }

  /**
   * Get pool information by token pair
   * @param tokenA - Token A address
   * @param tokenB - Token B address
   * @param chainId - Chain ID (optional)
   * @returns Pool information or null if not found
   */
  async getPool(tokenA: string, tokenB: string, chainId?: number): Promise<LiquidityPool | null> {
    const targetChainId = chainId || await this.walletService.getChainId();
    const pools = this.config.supportedPools[targetChainId] || [];
    
    return pools.find(pool => 
      (pool.tokenA.toLowerCase() === tokenA.toLowerCase() && pool.tokenB.toLowerCase() === tokenB.toLowerCase()) ||
      (pool.tokenA.toLowerCase() === tokenB.toLowerCase() && pool.tokenB.toLowerCase() === tokenA.toLowerCase())
    ) || null;
  }

  /**
   * Add liquidity to a pool
   * @param params - Add liquidity parameters
   * @returns Liquidity operation result
   * @throws {Error} When operation fails
   */
  async addLiquidity(params: AddLiquidityParams): Promise<LiquidityResult> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      const wallet = this.walletService.getWallet();
      if (!wallet) {
        throw new Error('Wallet not available');
      }

      // Check token allowances
      const routerAddress = this.config.routers[await this.walletService.getChainId()];
      await this.ensureAllowance(params.tokenA, routerAddress, params.amountA);
      await this.ensureAllowance(params.tokenB, routerAddress, params.amountB);

      // Mock liquidity addition - in production would call router contract
      // console.log('Adding liquidity:', params);
      
      const txHash = '0x' + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const lpTokens = (params.amountA + params.amountB) / BigInt(2); // Mock calculation

      const result: LiquidityResult = {
        success: true,
        txHash,
        lpTokens,
        tokenAmounts: {
          tokenA: params.amountA,
          tokenB: params.amountB
        },
        gasUsed: BigInt(200000)
      };

      // Update positions
      await this.updateUserPositions();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Add liquidity failed: ${errorMessage}`
      };
    }
  }

  /**
   * Remove liquidity from a pool
   * @param params - Remove liquidity parameters
   * @returns Liquidity operation result
   * @throws {Error} When operation fails
   */
  async removeLiquidity(params: RemoveLiquidityParams): Promise<LiquidityResult> {
    if (!this.isInitialized) {
      throw new Error('Liquidity service not initialized');
    }

    try {
      const wallet = this.walletService.getWallet();
      if (!wallet) {
        throw new Error('Wallet not available');
      }

      // Mock liquidity removal - in production would call router contract
      // console.log('Removing liquidity:', params);
      
      const txHash = '0x' + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const result: LiquidityResult = {
        success: true,
        txHash,
        lpTokens: params.liquidity,
        tokenAmounts: {
          tokenA: params.amountAMin + BigInt(Math.floor(Math.random() * 1000)),
          tokenB: params.amountBMin + BigInt(Math.floor(Math.random() * 1000))
        },
        gasUsed: BigInt(180000)
      };

      // Update positions
      await this.updateUserPositions();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Remove liquidity failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get user's liquidity positions
   * @returns Array of liquidity positions
   */
  async getUserPositions(): Promise<LiquidityPosition[]> {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by ID
   * @param positionId - Position ID
   * @returns Liquidity position or null if not found
   */
  async getPosition(positionId: string): Promise<LiquidityPosition | null> {
    return this.positions.get(positionId) || null;
  }

  /**
   * Calculate optimal amounts for adding liquidity
   * @param tokenA - Token A address
   * @param tokenB - Token B address
   * @param amountA - Desired amount of token A
   * @returns Optimal amounts for both tokens
   */
  async calculateOptimalAmounts(tokenA: string, tokenB: string, amountA: bigint): Promise<{
    amountA: bigint;
    amountB: bigint;
    priceRatio: number;
  }> {
    const pool = await this.getPool(tokenA, tokenB);
    if (!pool) {
      throw new Error('Pool not found');
    }

    // Mock calculation - in production would use actual reserves
    const priceRatio = Number(pool.reserves.tokenB) / Number(pool.reserves.tokenA);
    const amountB = (amountA * BigInt(Math.floor(priceRatio * 1000))) / BigInt(1000);

    return {
      amountA,
      amountB,
      priceRatio
    };
  }

  /**
   * Load supported pools from chain
   * @private
   */
  private async loadPools(): Promise<void> {
    try {
      const chainId = await this.walletService.getChainId();
      
      // Mock pool data - in production would query from chain
      const mockPool: LiquidityPool = {
        address: '0x1234567890123456789012345678901234567890',
        tokenA: '0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce',
        tokenB: '0x4Fcc7d9Ca9d22E21FCF25CF9a2E48D3A0c1a5A3E',
        symbolA: 'OMNI',
        symbolB: 'USDC',
        feeTier: 300, // 0.3%
        tvl: ethers.parseEther('1000000'),
        apy: 15.5,
        reserves: {
          tokenA: ethers.parseEther('500000'),
          tokenB: ethers.parseUnits('500000', 6)
        },
        lpToken: '0x2345678901234567890123456789012345678901',
        version: 'V2'
      };

      if (!this.config.supportedPools[chainId]) {
        this.config.supportedPools[chainId] = [];
      }
      this.config.supportedPools[chainId].push(mockPool);
      this.poolCache.set(`${chainId}-${mockPool.tokenA}-${mockPool.tokenB}`, mockPool);
    } catch (error) {
      console.warn('Error loading pools:', error);
    }
  }

  /**
   * Load user positions from blockchain
   * @private
   */
  private async loadUserPositions(): Promise<void> {
    // Mock user positions - in production would query from blockchain
    this.positions.clear();
  }

  /**
   * Update user positions after operation
   * @private
   */
  private async updateUserPositions(): Promise<void> {
    // Reload positions after operations
    await this.loadUserPositions();
  }

  /**
   * Ensure token allowance for spending
   * @param tokenAddress
   * @param spender
   * @param amount
   * @private
   */
  private async ensureAllowance(tokenAddress: string, spender: string, amount: bigint): Promise<void> {
    const wallet = this.walletService.getWallet();
    if (!wallet) {
      throw new Error('Wallet not available');
    }

    // Check current allowance and approve if needed
    try {
      const currentBalance = await wallet.getTokenBalance(tokenAddress);
      if (currentBalance >= amount) {
        await wallet.approveToken(tokenAddress, spender, amount);
      }
    } catch (error) {
      console.warn('Error checking/setting allowance:', error);
    }
  }

  /**
   * Clear cache and reset data
   */
  async clearCache(): Promise<void> {
    this.poolCache.clear();
    // console.log('LiquidityService cache cleared');
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      this.positions.clear();
      this.poolCache.clear();
      this.isInitialized = false;
      // console.log('LiquidityService cleanup completed');
    } catch (error) {
      console.error('Error during LiquidityService cleanup:', error);
    }
  }
}