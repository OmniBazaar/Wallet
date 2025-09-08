/**
 * Cross-Chain Bridge Types
 */

/**
 * Represents a cross-chain bridge route with all necessary details
 */
export interface BridgeRoute {
  /** Unique identifier for this route */
  id: string;
  /** Source blockchain network */
  fromChain: string;
  /** Destination blockchain network */
  toChain: string;
  /** Token information on source chain */
  fromToken: TokenInfo;
  /** Token information on destination chain */
  toToken: TokenInfo;
  /** Amount to send (in smallest unit) */
  fromAmount: string;
  /** Estimated amount to receive (in smallest unit) */
  toAmount: string;
  /** Estimated time for bridge completion in seconds */
  estimatedTime: number; // in seconds
  /** Bridge fee information */
  fee: BridgeFee;
  /** Bridge provider handling this route */
  bridge: BridgeProvider;
  /** Steps required to complete the bridge transfer */
  steps: BridgeStep[];
}

/**
 * Token information for bridge operations
 */
export interface TokenInfo {
  /** Token contract address (0x0 for native tokens) */
  address: string;
  /** Token symbol (e.g., 'USDC', 'ETH') */
  symbol: string;
  /** Full token name */
  name: string;
  /** Number of decimals */
  decimals: number;
  /** Chain ID where this token exists */
  chainId: number | string;
}

/**
 * Bridge fee structure
 */
export interface BridgeFee {
  /** Fee amount in token units */
  amount: string;
  /** Token symbol for fee payment */
  token: string;
  /** Equivalent fee value in USD */
  inUSD?: string;
}

/**
 * Individual step in a bridge transfer process
 */
export interface BridgeStep {
  /** Type of action required for this step */
  type: 'approve' | 'deposit' | 'wait' | 'claim';
  /** Human-readable description of the step */
  description: string;
  /** Estimated time for this step in seconds */
  estimatedTime?: number;
  /** Transaction details if this step requires on-chain interaction */
  transaction?: {
    /** Contract address to interact with */
    to: string;
    /** Encoded transaction data */
    data: string;
    /** Value to send in wei */
    value: string;
    /** Gas limit for transaction */
    gasLimit?: string;
  };
}

/**
 * Available bridge providers
 */
export enum BridgeProvider {
  Hop = 'hop',
  Stargate = 'stargate',
  Across = 'across',
  Synapse = 'synapse',
  Celer = 'celer',
  Multichain = 'multichain',
  Wormhole = 'wormhole',
  LayerZero = 'layerzero',
  Polygon = 'polygon',
  Arbitrum = 'arbitrum',
  Optimism = 'optimism',
}

/**
 * Request parameters for getting bridge quotes
 */
export interface BridgeQuoteRequest {
  /** Source blockchain network */
  fromChain: string;
  /** Destination blockchain network */
  toChain: string;
  /** Token symbol on source chain */
  fromToken: string;
  /** Token symbol on destination chain (defaults to fromToken) */
  toToken?: string;
  /** Amount to bridge in smallest unit */
  amount: string;
  /** Sender address on source chain */
  fromAddress: string;
  /** Receiver address on destination chain (defaults to fromAddress) */
  toAddress?: string;
  /** Maximum acceptable slippage percentage (0-100) */
  slippage?: number;
}

/**
 * Response containing available bridge routes
 */
export interface BridgeQuoteResponse {
  /** All available routes sorted by output amount */
  routes: BridgeRoute[];
  /** Recommended route with best output */
  bestRoute: BridgeRoute | null;
}

/**
 * Transaction parameters for bridge operations
 */
export interface BridgeTransaction {
  /** Target contract address */
  to: string;
  /** Encoded transaction data */
  data: string;
  /** Transaction value in wei */
  value: string;
  /** Chain ID for the transaction */
  chainId: number;
  /** Gas limit override */
  gasLimit?: string;
}

/**
 * Status tracking for active bridge transfers
 */
export interface BridgeStatus {
  /** Unique transfer identifier */
  id: string;
  /** Current status of the transfer */
  status: 'pending' | 'completed' | 'failed';
  /** Transaction hash on source chain */
  fromTxHash?: string;
  /** Transaction hash on destination chain */
  toTxHash?: string;
  /** Estimated completion timestamp */
  estimatedArrival?: number;
  /** Status message or error details */
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
export const BRIDGE_SUPPORT: Record<string, {
  /** Supported blockchain networks */
  chains: string[];
  /** Supported token symbols */
  tokens: string[];
  /** Average bridge completion time in seconds */
  estimatedTime: number;
}> = {
  [BridgeProvider.Hop]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    tokens: ['USDC', 'USDT', 'DAI', 'ETH', 'MATIC'],
    estimatedTime: 600, // 10 minutes
  },
  [BridgeProvider.Stargate]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom'],
    tokens: ['USDC', 'USDT', 'STG'],
    estimatedTime: 300, // 5 minutes
  },
  [BridgeProvider.Across]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    tokens: ['USDC', 'ETH', 'WETH', 'DAI', 'WBTC'],
    estimatedTime: 180, // 3 minutes
  },
  [BridgeProvider.Synapse]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom', 'base'],
    tokens: ['USDC', 'USDT', 'DAI', 'nUSD', 'ETH'],
    estimatedTime: 600, // 10 minutes
  },
  [BridgeProvider.Celer]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom'],
    tokens: ['USDC', 'USDT', 'ETH', 'WBTC', 'CELR'],
    estimatedTime: 1200, // 20 minutes
  },
  [BridgeProvider.Multichain]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc', 'fantom'],
    tokens: ['USDC', 'USDT', 'MULTI', 'anyToken'],
    estimatedTime: 1800, // 30 minutes
  },
  [BridgeProvider.Wormhole]: {
    chains: ['ethereum', 'polygon', 'avalanche', 'bsc', 'solana', 'terra'],
    tokens: ['USDC', 'USDT', 'ETH', 'SOL'],
    estimatedTime: 900, // 15 minutes
  },
  [BridgeProvider.LayerZero]: {
    chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc'],
    tokens: ['STG', 'USDC', 'USDT'],
    estimatedTime: 600, // 10 minutes
  },
  [BridgeProvider.Polygon]: {
    chains: ['ethereum', 'polygon'],
    tokens: ['ETH', 'USDC', 'USDT', 'DAI', 'MATIC'],
    estimatedTime: 1800, // 30 minutes (PoS bridge)
  },
  [BridgeProvider.Arbitrum]: {
    chains: ['ethereum', 'arbitrum'],
    tokens: ['ETH', 'USDC', 'USDT', 'DAI'],
    estimatedTime: 600, // 10 minutes (fast withdrawal)
  },
  [BridgeProvider.Optimism]: {
    chains: ['ethereum', 'optimism'],
    tokens: ['ETH', 'USDC', 'USDT', 'DAI'],
    estimatedTime: 300, // 5 minutes (fast withdrawal)
  },
};