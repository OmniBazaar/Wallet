/**
 * Solana Network Configurations
 */

import { SolanaNetworkConfig } from './provider';

export const SOLANA_NETWORKS: Record<string, SolanaNetworkConfig> = {
  'mainnet-beta': {
    name: 'Solana Mainnet',
    chainId: 'solana-mainnet',
    currency: 'SOL',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    wsUrl: 'wss://api.mainnet-beta.solana.com',
    commitment: 'confirmed',
    blockExplorerUrls: ['https://solscan.io', 'https://explorer.solana.com']
  },
  
  devnet: {
    name: 'Solana Devnet',
    chainId: 'solana-devnet',
    currency: 'SOL',
    rpcUrl: 'https://api.devnet.solana.com',
    wsUrl: 'wss://api.devnet.solana.com',
    commitment: 'confirmed',
    blockExplorerUrls: ['https://solscan.io?cluster=devnet', 'https://explorer.solana.com?cluster=devnet']
  },
  
  testnet: {
    name: 'Solana Testnet',
    chainId: 'solana-testnet',
    currency: 'SOL',
    rpcUrl: 'https://api.testnet.solana.com',
    wsUrl: 'wss://api.testnet.solana.com',
    commitment: 'confirmed',
    blockExplorerUrls: ['https://solscan.io?cluster=testnet', 'https://explorer.solana.com?cluster=testnet']
  }
};

// Popular Solana SPL tokens
export const POPULAR_SPL_TOKENS = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'
  },
  SRM: {
    symbol: 'SRM',
    name: 'Serum',
    mint: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png'
  },
  BONK: {
    symbol: 'BONK',
    name: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
  },
  JTO: {
    symbol: 'JTO',
    name: 'Jito',
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    decimals: 9,
    logoURI: 'https://metadata.jito.network/token/jto/image'
  },
  PYTH: {
    symbol: 'PYTH',
    name: 'Pyth Network',
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    decimals: 6,
    logoURI: 'https://pyth.network/token.svg'
  },
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png'
  },
  WIF: {
    symbol: 'WIF',
    name: 'dogwifhat',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    decimals: 6,
    logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link'
  }
};

// Solana NFT marketplaces
export const SOLANA_NFT_MARKETPLACES = {
  MagicEden: {
    name: 'Magic Eden',
    url: 'https://magiceden.io',
    api: 'https://api-mainnet.magiceden.dev/v2'
  },
  Solanart: {
    name: 'Solanart',
    url: 'https://solanart.io',
    api: 'https://api.solanart.io'
  },
  DigitalEyes: {
    name: 'DigitalEyes',
    url: 'https://digitaleyes.market',
    api: 'https://api.digitaleyes.market'
  },
  Hyperspace: {
    name: 'Hyperspace',
    url: 'https://hyperspace.xyz',
    api: 'https://api.hyperspace.xyz'
  },
  Tensor: {
    name: 'Tensor',
    url: 'https://tensor.trade',
    api: 'https://api.tensor.trade'
  }
};

// Metaplex program IDs
export const METAPLEX_PROGRAMS = {
  TOKEN_METADATA_PROGRAM: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  CANDY_MACHINE_V3: 'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR',
  AUCTION_HOUSE: 'hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk',
  BUBBLEGUM: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY',
} as const;

// Common Solana token standards
export const SOLANA_TOKEN_STANDARDS = {
  SPL: 'spl-token',
  SPL_2022: 'spl-token-2022',
  METAPLEX: 'metaplex-nft',
  COMPRESSED_NFT: 'compressed-nft',
} as const;

export default SOLANA_NETWORKS;