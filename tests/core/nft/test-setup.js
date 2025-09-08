// Mock all problematic providers that require initialization
jest.mock('../../../src/core/chains/bitcoin/provider', () => ({
  BitcoinProvider: jest.fn(),
  UTXO: jest.fn()
}));

jest.mock('../../../src/core/chains/bitcoin/live-provider', () => ({
  LiveBitcoinProvider: jest.fn().mockImplementation(() => ({
    getFormattedBalance: jest.fn().mockResolvedValue('0.001 BTC'),
    sendBitcoin: jest.fn().mockRejectedValue(new Error('Bitcoin transactions not implemented'))
  }))
}));

// Skip mocking ProviderManager here - it's mocked manually in the test files
/* jest.mock('../../../src/core/providers/ProviderManager', () => {
  const createMockProvider = () => ({
    getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
    sendTransaction: jest.fn().mockResolvedValue('0x123'),
    getActiveProvider: jest.fn().mockReturnValue({
      sendTransaction: jest.fn().mockResolvedValue('0x123')
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getNetwork: jest.fn().mockResolvedValue({ name: 'ethereum', chainId: 1 })
  });

  // Store providers to simulate proper behavior
  const providers = new Map();
  providers.set('ethereum', createMockProvider());
  providers.set('bitcoin', createMockProvider());
  providers.set('solana', createMockProvider());

  const providerManager = {
    getProvider: jest.fn().mockImplementation((chainType) => {
      // Ensure provider exists for the requested chain type
      if (!providers.has(chainType)) {
        const newProvider = createMockProvider();
        providers.set(chainType, newProvider);
      }
      return providers.get(chainType);
    }),
    getActiveProvider: jest.fn().mockImplementation(() => {
      // Always return a valid mock provider
      const activeChain = 'ethereum';
      if (!providers.has(activeChain)) {
        providers.set(activeChain, createMockProvider());
      }
      return providers.get(activeChain);
    }),
    switchEVMNetwork: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockImplementation(async () => {
      // Simulate initialization
      providers.set('ethereum', createMockProvider());
      providers.set('bitcoin', createMockProvider());
      providers.set('solana', createMockProvider());
    }),
    getActiveChain: jest.fn().mockReturnValue('ethereum'),
    getActiveAccount: jest.fn().mockReturnValue({
      address: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
      chainType: 'ethereum'
    })
  };
  
  // Initialize providers on creation
  providers.set('ethereum', createMockProvider());
  providers.set('bitcoin', createMockProvider());
  providers.set('solana', createMockProvider());

  return {
    providerManager,
    ProviderManager: {
      getInstance: jest.fn().mockReturnValue(providerManager)
    }
  };
}); */

// Mock keyring service with all required methods
jest.mock('../../../src/core/keyring/KeyringService', () => {
  // Store state outside to persist between calls
  const state = {
    mockAccounts: new Map(),
    activeAccount: null
  };

  const keyringService = {
    createWallet: jest.fn().mockResolvedValue(undefined),
    createAccount: jest.fn().mockImplementation((chainType, name) => {
      const address = chainType === 'ethereum' 
        ? '0xF4C9aa764684C74595213384d32E2e57798Fd2F9'
        : '7nYzHJbXSHAj7uuaK4FJNqrYPgFMhzxbPjvRcmZy8Xzd';
      
      const account = { address, chainType, name };
      state.mockAccounts.set(address, account);
      
      if (!state.activeAccount) {
        state.activeAccount = account;
      }
      
      return Promise.resolve(account);
    }),
    setActiveAccount: jest.fn().mockImplementation((address) => {
      if (address === undefined) {
        state.activeAccount = null;
      } else {
        // Handle both string address and full account object
        const targetAddress = typeof address === 'string' ? address : address?.address;
        state.activeAccount = state.mockAccounts.get(targetAddress) || { address: targetAddress, chainType: 'ethereum', name: 'Test' };
      }
    }),
    getActiveAccount: jest.fn().mockImplementation(() => state.activeAccount),
    initializeProviders: jest.fn().mockResolvedValue(undefined),
    lock: jest.fn().mockResolvedValue(undefined),
    unlock: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockImplementation(() => ({
      isInitialized: true,
      isUnlocked: true,
      accounts: Array.from(state.mockAccounts.values())
    }))
  };

  return { keyringService };
});