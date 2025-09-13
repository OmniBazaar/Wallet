/**
 * WalletService Tests
 * Tests for core wallet functionality including native balance queries
 */

import { WalletService } from '../../src/services/WalletService';
import { BrowserProvider } from 'ethers';
import { keyringService } from '../../src/core/keyring/KeyringService';

// Mock dependencies
jest.mock('../../src/core/keyring/KeyringService', () => ({
  keyringService: {
    getAccounts: jest.fn(),
    init: jest.fn(),
    getState: jest.fn()
  },
  KeyringService: {
    getInstance: jest.fn().mockReturnValue({
      getAccounts: jest.fn(),
      init: jest.fn(),
      getState: jest.fn()
    })
  }
}));
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    BrowserProvider: jest.fn()
  };
});

describe('WalletService', () => {
  let walletService: WalletService;
  let mockProvider: any;

  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
  const INVALID_ADDRESS = 'invalid-address';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock provider
    mockProvider = {
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n, name: 'ethereum' }),
      getSigner: jest.fn(),
      request: jest.fn()
    };

    // Mock BrowserProvider constructor
    (BrowserProvider as unknown as jest.Mock).mockImplementation(() => mockProvider);

    // Mock keyringService
    (keyringService.getAccounts as jest.Mock).mockResolvedValue([
      { address: TEST_ADDRESS, name: 'Test Account' }
    ]);
    (keyringService.init as jest.Mock).mockResolvedValue(undefined);

    // Create WalletService instance
    walletService = new WalletService();
  });

  describe('getNativeBalance', () => {
    beforeEach(async () => {
      await walletService.init();
    });

    it('should get native balance for valid address', async () => {
      const balance = await walletService.getNativeBalance(TEST_ADDRESS);
      
      expect(balance).toBe(BigInt('1000000000000000000'));
      expect(mockProvider.getBalance).toHaveBeenCalledWith(TEST_ADDRESS);
    });

    it('should validate address format', async () => {
      await expect(walletService.getNativeBalance(INVALID_ADDRESS))
        .rejects.toThrow('Invalid wallet address');
    });

    it('should handle different chains', async () => {
      const polygonChainId = 137;
      
      // Test that it can handle different chain IDs
      const balance = await walletService.getNativeBalance(TEST_ADDRESS, polygonChainId);
      
      // Should still work and return balance
      expect(balance).toBe(BigInt('1000000000000000000'));
      expect(mockProvider.getBalance).toHaveBeenCalledWith(TEST_ADDRESS);
    });

    it('should not switch chain if already on target chain', async () => {
      walletService.switchChain = jest.fn();
      const currentChainId = await walletService.getChainId();
      
      await walletService.getNativeBalance(TEST_ADDRESS, currentChainId);
      
      expect(walletService.switchChain).not.toHaveBeenCalled();
    });

    it('should throw error when provider not available', async () => {
      // Create a new instance without provider
      const serviceWithoutProvider = new WalletService();
      
      await expect(serviceWithoutProvider.getNativeBalance(TEST_ADDRESS))
        .rejects.toThrow('No provider available');
    });

    it('should handle provider errors', async () => {
      mockProvider.getBalance.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(walletService.getNativeBalance(TEST_ADDRESS))
        .rejects.toThrow('Failed to get balance: Network error');
    });

    it('should return zero balance', async () => {
      mockProvider.getBalance.mockResolvedValueOnce(BigInt(0));
      
      const balance = await walletService.getNativeBalance(TEST_ADDRESS);
      
      expect(balance).toBe(BigInt(0));
    });

    it('should handle large balances', async () => {
      const largeBalance = BigInt('999999999999999999999999999');
      mockProvider.getBalance.mockResolvedValueOnce(largeBalance);
      
      const balance = await walletService.getNativeBalance(TEST_ADDRESS);
      
      expect(balance).toBe(largeBalance);
    });
  });
});