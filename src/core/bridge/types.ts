/**
 * Cross-Chain Bridge Types
 */

/**
 *
 */
export interface BridgeRoute {
  /**
   *
   */
  id: string;
  /**
   *
   */
  fromChain: string;
  /**
   *
   */
  toChain: string;
  /**
   *
   */
  fromToken: TokenInfo;
  /**
   *
   */
  toToken: TokenInfo;
  /**
   *
   */
  fromAmount: string;
  /**
   *
   */
  toAmount: string;
  /**
   *
   */
  estimatedTime: number; // in seconds
  /**
   *
   */
  fee: BridgeFee;
  /**
   *
   */
  bridge: BridgeProvider;
  /**
   *
   */
  steps: BridgeStep[];
}

/**
 *
 */
export interface TokenInfo {
  /**
   *
   */
  address: string;
  /**
   *
   */
  symbol: string;
  /**
   *
   */
  name: string;
  /**
   *
   */
  decimals: number;
  /**
   *
   */
  chainId: number | string;
}

/**
 *
 */
export interface BridgeFee {
  /**
   *
   */
  amount: string;
  /**
   *
   */
  token: string;
  /**
   *
   */
  inUSD?: string;
}

/**
 *
 */
export interface BridgeStep {
  /**
   *
   */
  type: 'approve' | 'deposit' | 'wait' | 'claim';
  /**
   *
   */
  description: string;
  /**
   *
   */
  estimatedTime?: number;
  /**
   *
   */
  transaction?: {
    /**
     *
     */
    to: string;
    /**
     *
     */
    data: string;
    /**
     *
     */
    value: string;
    /**
     *
     */
    gasLimit?: string;
  };
}

/**
 *
 */
export enum BridgeProvider {
  HOP = 'hop',
  STARGATE = 'stargate',
  ACROSS = 'across',
  SYNAPSE = 'synapse',
  CELER = 'celer',
  MULTICHAIN = 'multichain',
  WORMHOLE = 'wormhole',
  LAYER_ZERO = 'layerzero',
  POLYGON = 'polygon',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
}

/**
 *
 */
export interface BridgeQuoteRequest {
  /**
   *
   */
  fromChain: string;
  /**
   *
   */
  toChain: string;
  /**
   *
   */
  fromToken: string;
  /**
   *
   */
  toToken?: string;
  /**
   *
   */
  amount: string;
  /**
   *
   */
  fromAddress: string;
  /**
   *
   */
  toAddress?: string;
  /**
   *
   */
  slippage?: number;
}

/**
 *
 */
export interface BridgeQuoteResponse {
  /**
   *
   */
  routes: BridgeRoute[];
  /**
   *
   */
  bestRoute: BridgeRoute | null;
}

/**
 *
 */
export interface BridgeTransaction {
  /**
   *
   */
  to: string;
  /**
   *
   */
  data: string;
  /**
   *
   */
  value: string;
  /**
   *
   */
  chainId: number;
  /**
   *
   */
  gasLimit?: string;
}

/**
 *
 */
export interface BridgeStatus {
  /**
   *
   */
  id: string;
  /**
   *
   */
  status: 'pending' | 'completed' | 'failed';
  /**
   *
   */
  fromTxHash?: string;
  /**
   *
   */
  toTxHash?: string;
  /**
   *
   */
  estimatedArrival?: number;
  /**
   *
   */
  message?: string;
}

// Popular bridge tokens
export const BRIDGE_TOKENS = {
  USDC: {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    optimism: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    base: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  USDT: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    bsc: '0x55d398326f99059fF775485246999027B3197955',
  },
  WETH: {
    ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    polygon: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    optimism: '0x4200000000000000000000000000000000000006',
    base: '0x4200000000000000000000000000000000000006',
    avalanche: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  },
} as const;

// Bridge support matrix
export const BRIDGE_SUPPORT: Record<BridgeProvider, {
  /**
   *
   */
  chains: string[];
  /**
   *
   */
  tokens: string[];
  /**
   *
   */
  estimatedTime: number;
}> = {
  [BridgeProvider.HOP]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    tokens: ['USDC', 'USDT', 'DAI', 'ETH', 'MATIC'],
    estimatedTime: 600, // 10 minutes
  },
  [BridgeProvider.STARGATE]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom'],
    tokens: ['USDC', 'USDT', 'STG'],
    estimatedTime: 300, // 5 minutes
  },
  [BridgeProvider.ACROSS]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    tokens: ['USDC', 'ETH', 'WETH', 'DAI', 'WBTC'],
    estimatedTime: 180, // 3 minutes
  },
  [BridgeProvider.SYNAPSE]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom', 'base'],
    tokens: ['USDC', 'USDT', 'DAI', 'nUSD', 'ETH'],
    estimatedTime: 600, // 10 minutes
  },
  [BridgeProvider.CELER]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom'],
    tokens: ['USDC', 'USDT', 'ETH', 'WBTC', 'CELR'],
    estimatedTime: 1200, // 20 minutes
  },
  [BridgeProvider.MULTICHAIN]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom'],
    tokens: ['USDC', 'USDT', 'MULTI', 'anyToken'],
    estimatedTime: 1800, // 30 minutes
  },
  [BridgeProvider.WORMHOLE]: {
    chains: ['ethereum', 'polygon', 'avalanche', 'bsc', 'solana', 'terra'],
    tokens: ['USDC', 'USDT', 'ETH', 'SOL'],
    estimatedTime: 900, // 15 minutes
  },
  [BridgeProvider.LAYER_ZERO]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc'],
    tokens: ['STG', 'USDC', 'USDT'],
    estimatedTime: 600, // 10 minutes
  },
  [BridgeProvider.POLYGON]: {
    chains: ['ethereum', 'polygon'],
    tokens: ['ETH', 'USDC', 'USDT', 'DAI', 'MATIC'],
    estimatedTime: 1800, // 30 minutes (PoS bridge)
  },
  [BridgeProvider.ARBITRUM]: {
    chains: ['ethereum', 'arbitrum'],
    tokens: ['ETH', 'USDC', 'USDT', 'DAI'],
    estimatedTime: 600, // 10 minutes (fast withdrawal)
  },
  [BridgeProvider.OPTIMISM]: {
    chains: ['ethereum', 'optimism'],
    tokens: ['ETH', 'USDC', 'USDT', 'DAI'],
    estimatedTime: 300, // 5 minutes (fast withdrawal)
  },
};