/**
 * Provider Manager Mock Setup
 * This file sets up the ProviderManager mock before any imports
 */

// Create mock provider function
const createMockProvider = () => ({
  getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
  sendTransaction: jest.fn().mockResolvedValue('0x123'),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getNetwork: jest.fn().mockResolvedValue({ name: 'ethereum', chainId: 1 })
});

// Create providers map - must be defined outside of mock for access in tests
export const mockProviders = new Map();
export const mockEvmProviders = new Map();

// Add providers for all chains
['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana'].forEach(chain => {
  mockProviders.set(chain, createMockProvider());
});

// Also add EVM providers
['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].forEach(chain => {
  mockEvmProviders.set(chain, createMockProvider());
});

// Create a mock instance that will be shared
export let mockProviderManager: any = {
  providers: mockProviders,
  evmProviders: mockEvmProviders,
  mockProviders: mockProviders, // For test access
  activeChain: 'ethereum',
  activeNetwork: 'ethereum',
  getProvider: jest.fn().mockImplementation((chainType) => {
    return mockProviders.get(chainType) || null;
  }),
  getActiveProvider: jest.fn().mockImplementation(function() {
    // Simply return the ethereum provider for testing
    return mockProviders.get('ethereum');
  }),
  switchEVMNetwork: jest.fn().mockResolvedValue(undefined),
  getEVMProvider: jest.fn().mockImplementation((networkKey) => {
    return mockEvmProviders.get(networkKey) || null;
  }),
  initialize: jest.fn().mockResolvedValue(undefined),
  getActiveChain: jest.fn().mockReturnValue('ethereum'),
  getActiveNetwork: jest.fn().mockReturnValue('ethereum'),
  getActiveAccount: jest.fn().mockReturnValue({
    address: '0x742d35Cc6634C4532E3F4b7c5b4E6b41c2b14BD3',
    chainType: 'ethereum'
  })
};

// Mock ProviderManager module
jest.mock('../../../src/core/providers/ProviderManager', () => ({
  providerManager: mockProviderManager,
  ProviderManager: {
    getInstance: jest.fn().mockReturnValue(mockProviderManager)
  }
}));