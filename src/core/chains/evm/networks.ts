/**
 * EVM Chain Configurations
 * Consolidated from Enkrypt and DePay sources
 */

export interface EVMNetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  currency: string;
  rpcUrl: string | string[];
  explorer: string;
  icon?: string;
  testnet?: boolean;
}

// Tier 1: Major EVM Chains (Immediate Implementation)
export const TIER1_NETWORKS: Record<string, EVMNetworkConfig> = {
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'arb',
    currency: 'ETH',
    rpcUrl: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-mainnet.infura.io/v3/YOUR-PROJECT-ID',
      'https://arb-mainnet.g.alchemy.com/v2/YOUR-API-KEY'
    ],
    explorer: 'https://arbiscan.io',
    icon: 'arbitrum'
  },
  
  optimism: {
    chainId: 10,
    name: 'Optimism',
    shortName: 'op',
    currency: 'ETH',
    rpcUrl: [
      'https://mainnet.optimism.io',
      'https://opt-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
      'https://optimism-mainnet.infura.io/v3/YOUR-PROJECT-ID'
    ],
    explorer: 'https://optimistic.etherscan.io',
    icon: 'optimism'
  },
  
  base: {
    chainId: 8453,
    name: 'Base',
    shortName: 'base',
    currency: 'ETH',
    rpcUrl: [
      'https://mainnet.base.org',
      'https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
      'https://base.gateway.tenderly.co'
    ],
    explorer: 'https://basescan.org',
    icon: 'base'
  },
  
  polygon: {
    chainId: 137,
    name: 'Polygon',
    shortName: 'matic',
    currency: 'MATIC',
    rpcUrl: [
      'https://polygon-rpc.com',
      'https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
      'https://polygon-mainnet.infura.io/v3/YOUR-PROJECT-ID'
    ],
    explorer: 'https://polygonscan.com',
    icon: 'polygon'
  },
  
  avalanche: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    shortName: 'avax',
    currency: 'AVAX',
    rpcUrl: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche-mainnet.infura.io/v3/YOUR-PROJECT-ID',
      'https://avax-mainnet.gateway.pokt.network/v1/lb/YOUR-ID'
    ],
    explorer: 'https://snowtrace.io',
    icon: 'avalanche'
  }
};

// Tier 2: Popular Secondary Chains
export const TIER2_NETWORKS: Record<string, EVMNetworkConfig> = {
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    shortName: 'bsc',
    currency: 'BNB',
    rpcUrl: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org'
    ],
    explorer: 'https://bscscan.com',
    icon: 'bsc'
  },
  
  fantom: {
    chainId: 250,
    name: 'Fantom',
    shortName: 'ftm',
    currency: 'FTM',
    rpcUrl: [
      'https://rpc.ftm.tools',
      'https://fantom-mainnet.public.blastapi.io',
      'https://rpc.fantom.network'
    ],
    explorer: 'https://ftmscan.com',
    icon: 'fantom'
  },
  
  gnosis: {
    chainId: 100,
    name: 'Gnosis Chain',
    shortName: 'gno',
    currency: 'xDAI',
    rpcUrl: [
      'https://rpc.gnosischain.com',
      'https://gnosis-mainnet.public.blastapi.io',
      'https://xdai.poanetwork.dev'
    ],
    explorer: 'https://gnosisscan.io',
    icon: 'gnosis'
  },
  
  moonbeam: {
    chainId: 1284,
    name: 'Moonbeam',
    shortName: 'glmr',
    currency: 'GLMR',
    rpcUrl: [
      'https://rpc.api.moonbeam.network',
      'https://moonbeam.public.blastapi.io',
      'https://moonbeam-mainnet.gateway.pokt.network/v1/lb/YOUR-ID'
    ],
    explorer: 'https://moonscan.io',
    icon: 'moonbeam'
  },
  
  aurora: {
    chainId: 1313161554,
    name: 'Aurora',
    shortName: 'aurora',
    currency: 'ETH',
    rpcUrl: [
      'https://mainnet.aurora.dev',
      'https://aurora-mainnet.infura.io/v3/YOUR-PROJECT-ID'
    ],
    explorer: 'https://explorer.aurora.dev',
    icon: 'aurora'
  },
  
  celo: {
    chainId: 42220,
    name: 'Celo',
    shortName: 'celo',
    currency: 'CELO',
    rpcUrl: [
      'https://forno.celo.org',
      'https://rpc.ankr.com/celo'
    ],
    explorer: 'https://celoscan.io',
    icon: 'celo'
  },
  
  harmony: {
    chainId: 1666600000,
    name: 'Harmony',
    shortName: 'one',
    currency: 'ONE',
    rpcUrl: [
      'https://api.harmony.one',
      'https://harmony-mainnet.chainstacklabs.com'
    ],
    explorer: 'https://explorer.harmony.one',
    icon: 'harmony'
  },
  
  cronos: {
    chainId: 25,
    name: 'Cronos',
    shortName: 'cro',
    currency: 'CRO',
    rpcUrl: [
      'https://evm.cronos.org',
      'https://cronos-evm.publicnode.com'
    ],
    explorer: 'https://cronoscan.com',
    icon: 'cronos'
  }
};

// Tier 3: Advanced/New Chains
export const TIER3_NETWORKS: Record<string, EVMNetworkConfig> = {
  zkSync: {
    chainId: 324,
    name: 'zkSync Era',
    shortName: 'zksync',
    currency: 'ETH',
    rpcUrl: [
      'https://mainnet.era.zksync.io',
      'https://zksync2-mainnet.zksync.io'
    ],
    explorer: 'https://explorer.zksync.io',
    icon: 'zksync'
  },
  
  linea: {
    chainId: 59144,
    name: 'Linea',
    shortName: 'linea',
    currency: 'ETH',
    rpcUrl: [
      'https://rpc.linea.build',
      'https://linea-mainnet.infura.io/v3/YOUR-PROJECT-ID'
    ],
    explorer: 'https://lineascan.build',
    icon: 'linea'
  },
  
  scroll: {
    chainId: 534352,
    name: 'Scroll',
    shortName: 'scroll',
    currency: 'ETH',
    rpcUrl: [
      'https://rpc.scroll.io',
      'https://scroll-mainnet.chainstacklabs.com'
    ],
    explorer: 'https://scrollscan.com',
    icon: 'scroll'
  },
  
  metis: {
    chainId: 1088,
    name: 'Metis',
    shortName: 'metis',
    currency: 'METIS',
    rpcUrl: [
      'https://andromeda.metis.io/?owner=1088',
      'https://metis-mainnet.public.blastapi.io'
    ],
    explorer: 'https://andromeda-explorer.metis.io',
    icon: 'metis'
  },
  
  worldchain: {
    chainId: 480,
    name: 'World Chain',
    shortName: 'wld',
    currency: 'ETH',
    rpcUrl: 'https://worldchain-mainnet.g.alchemy.com/public',
    explorer: 'https://worldchain-mainnet.explorer.alchemy.com',
    icon: 'worldchain'
  }
};

// Testnet configurations
export const TESTNET_NETWORKS: Record<string, EVMNetworkConfig> = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    shortName: 'sep',
    currency: 'ETH',
    rpcUrl: [
      'https://sepolia.infura.io/v3/YOUR-PROJECT-ID',
      'https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY',
      'https://rpc.sepolia.org'
    ],
    explorer: 'https://sepolia.etherscan.io',
    icon: 'ethereum',
    testnet: true
  },
  
  arbitrumSepolia: {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'arb-sep',
    currency: 'ETH',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    icon: 'arbitrum',
    testnet: true
  },
  
  optimismSepolia: {
    chainId: 11155420,
    name: 'Optimism Sepolia',
    shortName: 'op-sep',
    currency: 'ETH',
    rpcUrl: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    icon: 'optimism',
    testnet: true
  },
  
  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    shortName: 'base-sep',
    currency: 'ETH',
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    icon: 'base',
    testnet: true
  },
  
  polygonMumbai: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    shortName: 'mumbai',
    currency: 'MATIC',
    rpcUrl: [
      'https://rpc-mumbai.maticvigil.com',
      'https://polygon-mumbai.g.alchemy.com/v2/YOUR-API-KEY'
    ],
    explorer: 'https://mumbai.polygonscan.com',
    icon: 'polygon',
    testnet: true
  }
};

// Combine all networks
export const ALL_NETWORKS = {
  ...TIER1_NETWORKS,
  ...TIER2_NETWORKS,
  ...TIER3_NETWORKS,
  ...TESTNET_NETWORKS
};

// Helper function to get network by chainId
export function getNetworkByChainId(chainId: number): EVMNetworkConfig | undefined {
  return Object.values(ALL_NETWORKS).find(network => network.chainId === chainId);
}

// Helper function to get RPC URL (handles array or string)
export function getRpcUrl(network: EVMNetworkConfig): string {
  if (Array.isArray(network.rpcUrl)) {
    return network.rpcUrl[0];
  }
  return network.rpcUrl;
}

// Export default mainnet networks
export default {
  ...TIER1_NETWORKS,
  ...TIER2_NETWORKS
};