/**
 * Mock ProviderManager for tests
 */

// Create mock provider function
/**
 * Creates a mock provider object for testing
 * @returns Mock provider with common methods
 */
const createMockProvider = (): Record<string, unknown> => ({
  getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
  sendTransaction: jest.fn().mockResolvedValue('0x123'),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getNetwork: jest.fn().mockResolvedValue({ name: 'ethereum', chainId: 1 })
});

// Create providers map
const mockProviders = new Map();
const mockEvmProviders = new Map();

// Add providers for all chains
['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana'].forEach(chain => {
  mockProviders.set(chain, createMockProvider());
});

// Also add EVM providers
['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].forEach(chain => {
  mockEvmProviders.set(chain, createMockProvider());
});

// Create a proper mock class for ProviderManager
/**
 * Mock implementation of ProviderManager for testing
 */
class MockProviderManager {
  providers = mockProviders;
  evmProviders = mockEvmProviders;
  activeChain = 'ethereum';
  activeNetwork = 'ethereum';

  getProvider = jest.fn().mockImplementation((chainType: string) => {
    // Always return a valid provider for tests
    const provider = mockProviders.get(chainType) as Record<string, unknown> | undefined;
    if (provider !== null && provider !== undefined) return provider;
    // Return a default mock provider to avoid "Provider not found" error
    return createMockProvider();
  });

  getActiveProvider = jest.fn().mockImplementation(() => {
    const provider = mockProviders.get(this.activeChain) as Record<string, unknown> | undefined;
    return provider !== null && provider !== undefined ? provider : createMockProvider();
  });

  switchEVMNetwork = jest.fn().mockResolvedValue(undefined);
  
  getEVMProvider = jest.fn().mockImplementation((networkKey: string) => {
    const provider = mockEvmProviders.get(networkKey) as Record<string, unknown> | undefined;
    return provider !== null && provider !== undefined ? provider : createMockProvider();
  });

  initialize = jest.fn().mockResolvedValue(undefined);
  getActiveChain = jest.fn().mockReturnValue('ethereum');
  getActiveNetwork = jest.fn().mockReturnValue('ethereum');
  
  getActiveAccount = jest.fn().mockReturnValue({
    address: '0x742d35Cc6634C4532E3F4b7c5b4E6b41c2b14BD3',
    chainType: 'ethereum'
  });
}

// Create singleton instance
const mockProviderManager = new MockProviderManager();

// Export mocks
export const providerManager = mockProviderManager;
export const ProviderManager = MockProviderManager;

// Also export the providers for test access
export { mockProviders, mockEvmProviders, createMockProvider };