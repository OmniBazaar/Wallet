/**
 * WalletService Tests
 * Tests for core wallet functionality including native balance queries
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WalletService } from '../../src/services/WalletService';
import { BrowserProvider } from 'ethers';
import { keyringService } from '../../src/core/keyring/KeyringService';

// Mock dependencies
vi.mock('../../src/core/keyring/KeyringService');
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    BrowserProvider: vi.fn()
  };
});

describe('WalletService', () => {
  let walletService: WalletService;
  let mockProvider: any;

  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
  const INVALID_ADDRESS = 'invalid-address';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock provider
    mockProvider = {
      getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'ethereum' }),
      getSigner: vi.fn(),
      request: vi.fn()
    };

    // Mock BrowserProvider constructor
    (BrowserProvider as unknown as Mock).mockImplementation(() => mockProvider);

    // Mock keyringService
    (keyringService.getAccounts as Mock).mockResolvedValue([
      { address: TEST_ADDRESS, name: 'Test Account' }
    ]);
    (keyringService.init as Mock).mockResolvedValue(undefined);

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
      walletService.switchChain = vi.fn().mockResolvedValue(undefined);
      
      await walletService.getNativeBalance(TEST_ADDRESS, polygonChainId);
      
      expect(walletService.switchChain).toHaveBeenCalledWith(polygonChainId);
    });

    it('should not switch chain if already on target chain', async () => {
      walletService.switchChain = vi.fn();
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
        .rejects.toThrow('Failed to get native balance: Network error');
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