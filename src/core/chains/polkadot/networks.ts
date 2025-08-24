/**
 * Polkadot/Substrate Network Configurations
 * Extracted from Enkrypt
 */

import { PolkadotNetworkConfig } from './provider';

export const POLKADOT_NETWORKS: Record<string, PolkadotNetworkConfig> = {
  polkadot: {
    name: 'Polkadot',
    chainId: 'polkadot',
    currency: 'DOT',
    rpcUrl: 'wss://rpc.polkadot.io',
    decimals: 10,
    prefix: 0,
    genesisHash: '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3',
    existentialDeposit: '10000000000', // 1 DOT
    blockExplorerUrls: ['https://polkadot.subscan.io']
  },
  
  kusama: {
    name: 'Kusama',
    chainId: 'kusama',
    currency: 'KSM',
    rpcUrl: 'wss://kusama-rpc.polkadot.io',
    decimals: 12,
    prefix: 2,
    genesisHash: '0xb0a8d493285c2df73290dfb7e61f870f17b41801197a149ca93654499ea3dafe',
    existentialDeposit: '333333333', // 0.000333333333 KSM
    blockExplorerUrls: ['https://kusama.subscan.io']
  },
  
  acala: {
    name: 'Acala',
    chainId: 'acala',
    currency: 'ACA',
    rpcUrl: 'wss://acala-rpc-0.aca-api.network',
    decimals: 12,
    prefix: 10,
    genesisHash: '0xfc41b9bd8ef8fe53d58c7ea67c794c7ec9a73daf05e6d54b14ff6342c99ba64c',
    existentialDeposit: '100000000000', // 0.1 ACA
    blockExplorerUrls: ['https://acala.subscan.io']
  },
  
  karura: {
    name: 'Karura',
    chainId: 'karura',
    currency: 'KAR',
    rpcUrl: 'wss://karura-rpc-0.aca-api.network',
    decimals: 12,
    prefix: 8,
    genesisHash: '0xbaf5aabe40646d11f0ee8abbdc64f4a4b7674925cba08e4a05ff9ebed6e2126b',
    existentialDeposit: '100000000000', // 0.1 KAR
    blockExplorerUrls: ['https://karura.subscan.io']
  },
  
  astar: {
    name: 'Astar',
    chainId: 'astar',
    currency: 'ASTR',
    rpcUrl: 'wss://rpc.astar.network',
    decimals: 18,
    prefix: 5,
    genesisHash: '0x9eb76c5184c4ab8679d2d5d819fdf90b9c001403e9e17da2e14b6d8aec4029c6',
    existentialDeposit: '1000000', // 0.000001 ASTR
    blockExplorerUrls: ['https://astar.subscan.io']
  },
  
  shiden: {
    name: 'Shiden',
    chainId: 'shiden',
    currency: 'SDN',
    rpcUrl: 'wss://rpc.shiden.astar.network',
    decimals: 18,
    prefix: 5,
    genesisHash: '0xf1cf9022c7ebb34b162d5b5e34e705a5a740b2d0ecc1009fb89023e62a488108',
    existentialDeposit: '1000000', // 0.000001 SDN
    blockExplorerUrls: ['https://shiden.subscan.io']
  },
  
  bifrost: {
    name: 'Bifrost',
    chainId: 'bifrost',
    currency: 'BNC',
    rpcUrl: 'wss://bifrost-rpc.liebi.com/ws',
    decimals: 12,
    prefix: 6,
    genesisHash: '0x9f28c6a68e0fc9646eff64935684f6eeeece527e37bbe1f213d22caa1d9d6bed',
    existentialDeposit: '10000000000', // 0.01 BNC
    blockExplorerUrls: ['https://bifrost.subscan.io']
  },
  
  edgeware: {
    name: 'Edgeware',
    chainId: 'edgeware',
    currency: 'EDG',
    rpcUrl: 'wss://mainnet.edgewa.re',
    decimals: 18,
    prefix: 7,
    genesisHash: '0x742a2ca70c2fda6cee4f8df98d64c4c670a052d9568058982dad9d5a7a135c5b',
    existentialDeposit: '1000000000000000000', // 1 EDG
    blockExplorerUrls: ['https://edgeware.subscan.io']
  },
  
  moonbeam: {
    name: 'Moonbeam',
    chainId: 'moonbeam',
    currency: 'GLMR',
    rpcUrl: 'wss://wss.api.moonbeam.network',
    decimals: 18,
    prefix: 1284,
    genesisHash: '0xfe58ea77779b7abda7da4ec526d14db9b1e9cd40a217c34892af80a9b332b76d',
    existentialDeposit: '0', // No existential deposit (EVM compatible)
    blockExplorerUrls: ['https://moonscan.io']
  },
  
  unique: {
    name: 'Unique',
    chainId: 'unique',
    currency: 'UNQ',
    rpcUrl: 'wss://ws.unique.network',
    decimals: 18,
    prefix: 7391,
    genesisHash: '0x84322d9cddbf35088f1e54e9a85c967a41a56a4f43445768125e61af166c7d31',
    existentialDeposit: '0', // No existential deposit
    blockExplorerUrls: ['https://unique.subscan.io']
  },
  
  pendulum: {
    name: 'Pendulum',
    chainId: 'pendulum',
    currency: 'PEN',
    rpcUrl: 'wss://rpc-pendulum.prd.pendulumchain.tech',
    decimals: 12,
    prefix: 56,
    genesisHash: '0x5d3c298622d5634ed019bf61ea4b71655030015bde9beb0d6a24743fe39e25a4',
    existentialDeposit: '1000000000000', // 1 PEN
    blockExplorerUrls: ['https://pendulum.subscan.io']
  },
  
  vara: {
    name: 'Vara',
    chainId: 'vara',
    currency: 'VARA',
    rpcUrl: 'wss://rpc.vara-network.io',
    decimals: 12,
    prefix: 137,
    genesisHash: '0xfe1b4c55fd4d668101126434206571a7838a8b6b93a6d1b95d607e78e6c53763',
    existentialDeposit: '10000000000', // 0.01 VARA
    blockExplorerUrls: ['https://vara.subscan.io']
  },

  // Testnets
  westend: {
    name: 'Westend',
    chainId: 'westend',
    currency: 'WND',
    rpcUrl: 'wss://westend-rpc.polkadot.io',
    decimals: 12,
    prefix: 42,
    genesisHash: '0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e',
    existentialDeposit: '1000000000', // 0.001 WND
    blockExplorerUrls: ['https://westend.subscan.io']
  },
  
  rococo: {
    name: 'Rococo',
    chainId: 'rococo',
    currency: 'ROC',
    rpcUrl: 'wss://rococo-rpc.polkadot.io',
    decimals: 12,
    prefix: 42,
    genesisHash: '0x6408de7737c59c238890533af25896a2c20608d8b380bb01029acb392781063e',
    existentialDeposit: '333333333', // 0.000333333333 ROC
    blockExplorerUrls: ['https://rococo.subscan.io']
  }
};

// Helper to get all mainnet networks
/**
 *
 */
export function getMainnetPolkadotNetworks(): PolkadotNetworkConfig[] {
  return Object.values(POLKADOT_NETWORKS).filter(
    network => !['westend', 'rococo'].includes(network.chainId as string)
  );
}

// Helper to get testnet networks
/**
 *
 */
export function getTestnetPolkadotNetworks(): PolkadotNetworkConfig[] {
  return Object.values(POLKADOT_NETWORKS).filter(
    network => ['westend', 'rococo'].includes(network.chainId as string)
  );
}

export default POLKADOT_NETWORKS;