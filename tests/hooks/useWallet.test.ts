/**
 * useWallet Hook Test Suite
 * 
 * Tests wallet connection management, provider interactions,
 * network switching, and event handling in the main wallet hook.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { useWallet } from '../../src/hooks/useWallet';
import { BrowserProvider } from 'ethers';
import * as providers from '../../src/config/providers';
import * as networks from '../../src/core/chains/evm/networks';

// Mock dependencies
jest.mock('ethers', () => ({
  BrowserProvider: jest.fn().mockImplementation((provider) => ({
    provider,
    send: jest.fn(),
    getNetwork: jest.fn()
  }))
}));

jest.mock('../../src/config/providers');
jest.mock('../../src/core/chains/evm/networks');

describe('useWallet', () => {
  let mockProvider: any;
  let mockEthersProvider: any;
  let mockProviderConfig: any;

  // Test constants
  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';
  const TEST_CHAIN_ID = 1;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = {
      request: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn()
    };

    // Setup mock ethers provider
    mockEthersProvider = {
      send: jest.fn().mockResolvedValue([TEST_ADDRESS]),
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(TEST_CHAIN_ID) }),
      provider: mockProvider
    };

    // Mock BrowserProvider constructor
    (BrowserProvider as jest.MockedClass<typeof BrowserProvider>).mockImplementation(() => mockEthersProvider);

    // Setup mock provider config
    mockProviderConfig = {
      id: 'metamask',
      name: 'MetaMask',
      icon: 'metamask-icon',
      getProvider: jest.fn().mockResolvedValue(mockProvider)
    };

    // Setup provider mocks
    (providers.getProvider as jest.Mock).mockReturnValue(mockProviderConfig);
    (providers.getAvailableProviders as jest.Mock).mockReturnValue([
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: 'metamask-icon',
        isInstalled: true
      },
      {
        id: 'walletconnect',
        name: 'WalletConnect',
        icon: 'wc-icon',
        isInstalled: false
      }
    ]);

    // Setup network mocks
    (networks.getNetworkByChainId as jest.Mock).mockReturnValue({
      chainId: TEST_CHAIN_ID,
      name: 'Ethereum',
      currency: 'ETH',
      explorer: 'https://etherscan.io'
    });
    (networks.getRpcUrl as jest.Mock).mockReturnValue('https://eth-mainnet.alchemyapi.io');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have initial disconnected state', () => {
      const { result } = renderHook(() => useWallet());

      expect(result.current.address).toBeNull();
      expect(result.current.chainId).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Wallet Connection', () => {
    it('should connect to wallet successfully', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.address).toBe(TEST_ADDRESS);
      expect(result.current.chainId).toBe(TEST_CHAIN_ID);
      expect(result.current.provider).toBeDefined();
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set isConnecting during connection', async () => {
      const { result } = renderHook(() => useWallet());

      let isConnectingDuringConnect = false;

      // Delay the provider response to check intermediate state
      mockEthersProvider.send.mockImplementationOnce(() => {
        isConnectingDuringConnect = result.current.isConnecting;
        return Promise.resolve([TEST_ADDRESS]);
      });

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(isConnectingDuringConnect).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle missing provider config', async () => {
      (providers.getProvider as jest.Mock).mockReturnValueOnce(null);
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('unknown' as providers.ProviderId);
      });

      expect(result.current.error).toBe('Provider unknown not found');
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.address).toBeNull();
    });

    it('should handle unavailable provider', async () => {
      mockProviderConfig.getProvider.mockResolvedValueOnce(null);
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.error).toBe('Provider not available');
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle connection errors', async () => {
      mockEthersProvider.send.mockRejectedValueOnce(new Error('User rejected'));
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.error).toBe('User rejected');
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.address).toBeNull();
    });

    it('should handle empty accounts array', async () => {
      mockEthersProvider.send.mockResolvedValueOnce([]);
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.address).toBeNull();
      expect(result.current.chainId).toBe(TEST_CHAIN_ID);
    });
  });

  describe('Event Listeners', () => {
    it('should handle account changes', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(mockProvider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
      
      // Simulate account change
      const accountsChangedHandler = mockProvider.on.mock.calls.find(
        call => call[0] === 'accountsChanged'
      )?.[1];

      const newAddress = '0x852d35Cc6634C0532925a3b844Bc9e7595f3e53B';
      
      act(() => {
        accountsChangedHandler?.([newAddress]);
      });

      expect(result.current.address).toBe(newAddress);
    });

    it('should handle chain changes', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      const chainChangedHandler = mockProvider.on.mock.calls.find(
        call => call[0] === 'chainChanged'
      )?.[1];

      act(() => {
        chainChangedHandler?.('0x89'); // Polygon chain ID in hex
      });

      expect(result.current.chainId).toBe(137);
    });

    it('should handle disconnect event', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      const disconnectHandler = mockProvider.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      act(() => {
        disconnectHandler?.();
      });

      expect(result.current.address).toBeNull();
      expect(result.current.chainId).toBeNull();
      expect(result.current.provider).toBeNull();
    });

    it('should handle empty accounts on change', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      const accountsChangedHandler = mockProvider.on.mock.calls.find(
        call => call[0] === 'accountsChanged'
      )?.[1];

      act(() => {
        accountsChangedHandler?.([]);
      });

      expect(result.current.address).toBeNull();
    });
  });

  describe('Wallet Disconnection', () => {
    it('should disconnect and reset state', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.address).toBe(TEST_ADDRESS);

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.address).toBeNull();
      expect(result.current.chainId).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should call provider disconnect if available', async () => {
      mockProvider.disconnect = jest.fn();
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      act(() => {
        result.current.disconnect();
      });

      // Wait for async disconnect
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(mockProvider.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors silently', async () => {
      mockProvider.disconnect = jest.fn().mockRejectedValue(new Error('Disconnect failed'));
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      // Should not throw
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.address).toBeNull();
    });
  });

  describe('Network Switching', () => {
    beforeEach(async () => {
      mockProvider.request = jest.fn().mockResolvedValue(undefined);
    });

    it('should switch network successfully', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      await act(async () => {
        await result.current.switchNetwork(137); // Polygon
      });

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }]
      });

      expect(result.current.chainId).toBe(137);
    });

    it('should add network if not present', async () => {
      mockProvider.request
        .mockRejectedValueOnce({ code: 4902 }) // Chain not added
        .mockResolvedValueOnce(undefined); // Add chain success

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      await act(async () => {
        await result.current.switchNetwork(137);
      });

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x89',
          chainName: 'Ethereum',
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: ['https://eth-mainnet.alchemyapi.io'],
          blockExplorerUrls: ['https://etherscan.io']
        }]
      });
    });

    it('should handle network not supported', async () => {
      (networks.getNetworkByChainId as jest.Mock).mockReturnValueOnce(null);
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      await act(async () => {
        await result.current.switchNetwork(999);
      });

      expect(result.current.error).toBe('Network with chainId 999 not supported');
    });

    it('should handle no provider connected', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.switchNetwork(137);
      });

      expect(result.current.error).toBe('No provider connected');
    });

    it('should handle switch network errors', async () => {
      mockProvider.request.mockRejectedValueOnce(new Error('User rejected'));
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      await act(async () => {
        await result.current.switchNetwork(137);
      });

      expect(result.current.error).toBe('User rejected');
    });

    it('should handle network without explorer', async () => {
      (networks.getNetworkByChainId as jest.Mock).mockReturnValueOnce({
        chainId: 137,
        name: 'Polygon',
        currency: 'MATIC',
        explorer: null
      });

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      mockProvider.request
        .mockRejectedValueOnce({ code: 4902 })
        .mockResolvedValueOnce(undefined);

      await act(async () => {
        await result.current.switchNetwork(137);
      });

      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x89',
          chainName: 'Polygon',
          nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
          },
          rpcUrls: ['https://eth-mainnet.alchemyapi.io'],
          blockExplorerUrls: []
        }]
      });
    });
  });

  describe('Available Wallets', () => {
    it('should return available wallets', () => {
      const { result } = renderHook(() => useWallet());

      const wallets = result.current.getAvailableWallets();

      expect(wallets).toEqual([
        {
          id: 'metamask',
          name: 'MetaMask',
          icon: 'metamask-icon',
          isInstalled: true
        },
        {
          id: 'walletconnect',
          name: 'WalletConnect',
          icon: 'wc-icon',
          isInstalled: false
        }
      ]);
    });

    it('should always return same function reference', () => {
      const { result, rerender } = renderHook(() => useWallet());

      const fn1 = result.current.getAvailableWallets;
      
      rerender();
      
      const fn2 = result.current.getAvailableWallets;

      expect(fn1).toBe(fn2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle provider without event methods', async () => {
      mockProvider.on = undefined;
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.address).toBe(TEST_ADDRESS);
    });

    it('should handle BigInt chain IDs', async () => {
      mockEthersProvider.getNetwork.mockResolvedValueOnce({ 
        chainId: BigInt('18446744073709551615') // Max uint64
      });
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.chainId).toBe(Number(BigInt('18446744073709551615')));
    });

    it('should handle errors without message', async () => {
      mockEthersProvider.send.mockRejectedValueOnce({});
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      expect(result.current.error).toBe('Failed to connect wallet');
    });

    it('should handle network switch errors without message', async () => {
      mockProvider.request.mockRejectedValueOnce({});
      
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.connect('metamask' as providers.ProviderId);
      });

      await act(async () => {
        await result.current.switchNetwork(137);
      });

      expect(result.current.error).toBe('Failed to switch network');
    });

    it('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() => useWallet());

      const connect1 = result.current.connect;
      const disconnect1 = result.current.disconnect;
      const switchNetwork1 = result.current.switchNetwork;

      rerender();

      expect(result.current.connect).toBe(connect1);
      expect(result.current.disconnect).toBe(disconnect1);
      expect(result.current.switchNetwork).toBe(switchNetwork1);
    });
  });
});