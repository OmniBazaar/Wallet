/**
 * Wallet Test Environment Setup
 * Configures global test utilities and mocks for all wallet tests
 */

import { jest } from '@jest/globals';
import { ethers } from 'ethers';
import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';

// Mock environment setup
process.env.NODE_ENV = 'test';
process.env.TEST_MNEMONIC = 'test test test test test test test test test test test junk';

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Global test utilities
export const TEST_MNEMONIC = 'test test test test test test test test test test test junk';
export const TEST_PASSWORD = 'testPassword123!';

// Test addresses for different chains
export const TEST_ADDRESSES = {
  ethereum: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7',
  bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  solana: '7nYzHJbXSHAj7uuaK4FJNqrYPgFMhzxbPjvRcmZy8Xzd',
  substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
};

// Mock tokens
export const MOCK_TOKENS = {
  ethereum: {
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      decimals: 6
    }
  },
  polygon: {
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      decimals: 6
    }
  }
};

// Mock NFTs
export const MOCK_NFTS = [
  {
    id: 'mock-nft-1',
    contract_address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    token_id: '1234',
    name: 'Bored Ape #1234',
    collection: {
      name: 'Bored Ape Yacht Club',
      symbol: 'BAYC'
    },
    chain: 'ethereum'
  },
  {
    id: 'mock-nft-2',
    contract_address: 'DRmEK4sNGW2c4hRdEpN6Ld5tKnZwPMTLJLBvCKJvVPku',
    token_id: '5678',
    name: 'DeGod #5678',
    collection: {
      name: 'DeGods',
      symbol: 'DGOD'
    },
    chain: 'solana'
  }
];

// Mock API responses
export const mockApiResponse = (data: any, delay = 0) => {
  return jest.fn().mockImplementation(() => 
    new Promise(resolve => {
      setTimeout(() => resolve(data), delay);
    })
  );
};

// Mock blockchain providers
export const createMockProvider = (chainType: string) => {
  const provider = {
    getBalance: jest.fn().mockResolvedValue(ethers.utils.parseEther('1.0')),
    getBlockNumber: jest.fn().mockResolvedValue(1000000),
    getGasPrice: jest.fn().mockResolvedValue(ethers.utils.parseUnits('30', 'gwei')),
    sendTransaction: jest.fn().mockResolvedValue({ hash: '0x' + '1'.repeat(64) }),
    waitForTransaction: jest.fn().mockResolvedValue({ status: 1 }),
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1, name: 'homestead' }),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  };

  if (chainType === 'ethereum') {
    // Add EVM-specific methods
    Object.assign(provider, {
      getCode: jest.fn().mockResolvedValue('0x'),
      call: jest.fn().mockResolvedValue('0x'),
      estimateGas: jest.fn().mockResolvedValue(ethers.BigNumber.from('21000'))
    });
  }

  return provider;
};

// Mock fetch for API calls
global.fetch = jest.fn().mockImplementation((url: string) => {
  // Mock SimpleHash API
  if (url.includes('api.simplehash.com')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        nfts: MOCK_NFTS
      })
    });
  }
  
  // Mock bridge API
  if (url.includes('bridge')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        routes: [{
          bridge: 'hop',
          fee: '1000000',
          estimatedTime: 600
        }]
      })
    });
  }
  
  // Default response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
}) as jest.Mock;

// Test timeout helper
export const withTimeout = (fn: () => Promise<any>, timeout = 5000) => {
  return Promise.race([
    fn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    )
  ]);
};

// Chain test data
export const CHAIN_TEST_DATA = {
  ethereum: {
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    chainId: 1,
    nativeCurrency: 'ETH',
    decimals: 18
  },
  polygon: {
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    nativeCurrency: 'MATIC',
    decimals: 18
  },
  arbitrum: {
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    nativeCurrency: 'ETH',
    decimals: 18
  },
  optimism: {
    rpcUrl: 'https://mainnet.optimism.io',
    chainId: 10,
    nativeCurrency: 'ETH',
    decimals: 18
  },
  base: {
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    nativeCurrency: 'ETH',
    decimals: 18
  },
  bsc: {
    rpcUrl: 'https://bsc-dataseed.binance.org',
    chainId: 56,
    nativeCurrency: 'BNB',
    decimals: 18
  },
  avalanche: {
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    nativeCurrency: 'AVAX',
    decimals: 18
  },
  fantom: {
    rpcUrl: 'https://rpc.ftm.tools',
    chainId: 250,
    nativeCurrency: 'FTM',
    decimals: 18
  },
  celo: {
    rpcUrl: 'https://forno.celo.org',
    chainId: 42220,
    nativeCurrency: 'CELO',
    decimals: 18
  },
  moonbeam: {
    rpcUrl: 'https://rpc.api.moonbeam.network',
    chainId: 1284,
    nativeCurrency: 'GLMR',
    decimals: 18
  },
  aurora: {
    rpcUrl: 'https://mainnet.aurora.dev',
    chainId: 1313161554,
    nativeCurrency: 'ETH',
    decimals: 18
  },
  cronos: {
    rpcUrl: 'https://node.cronosmainnet.org',
    chainId: 25,
    nativeCurrency: 'CRO',
    decimals: 18
  },
  gnosis: {
    rpcUrl: 'https://rpc.gnosischain.com',
    chainId: 100,
    nativeCurrency: 'xDAI',
    decimals: 18
  },
  bitcoin: {
    network: 'mainnet',
    nativeCurrency: 'BTC',
    decimals: 8
  },
  solana: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    nativeCurrency: 'SOL',
    decimals: 9
  },
  substrate: {
    rpcUrl: 'wss://rpc.polkadot.io',
    nativeCurrency: 'DOT',
    decimals: 10
  }
};

// Cleanup function for tests
export const cleanupTest = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
};