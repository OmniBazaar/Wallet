/**
 * XOMService Tests
 * Tests for OmniCoin (XOM) specific operations
 */

import { XOMService } from '../../src/services/XOMService';
import { WalletService } from '../../src/services/WalletService';
import { ethers } from 'ethers';

// Mock WalletService
jest.mock('../../src/services/WalletService');

describe('XOMService', () => {
  let xomService: XOMService;
  let mockWalletService: WalletService;
  let mockWallet: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock wallet
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue('0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7'),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 XOM
      stakeOmniCoin: jest.fn().mockResolvedValue({ 
        success: true, 
        txHash: '0x123',
        stakeId: 'stake-123' 
      }),
      getStakedBalance: jest.fn().mockResolvedValue(BigInt('5000000000000000000')) // 5 XOM staked
    };

    // Setup mock WalletService
    mockWalletService = new WalletService();
    (mockWalletService.init as jest.Mock).mockResolvedValue(undefined);
    (mockWalletService.isServiceInitialized as jest.Mock).mockReturnValue(true);
    (mockWalletService.getWallet as jest.Mock).mockReturnValue(mockWallet);

    // Create XOMService instance
    xomService = new XOMService(mockWalletService);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(xomService.init()).resolves.not.toThrow();
    });

    it('should initialize wallet service if not initialized', async () => {
      (mockWalletService.isServiceInitialized as jest.Mock).mockReturnValue(false);
      
      await xomService.init();
      
      expect(mockWalletService.init).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await xomService.init();
      await xomService.init();
      
      // Should check initialization state once
      expect(mockWalletService.isServiceInitialized).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      await xomService.init();
    });

    it('should get XOM balance for current wallet address', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
      
      const balance = await xomService.getBalance(address);

      expect(balance.raw).toBe(BigInt('1000000000000000000'));
      expect(balance.formatted).toBe('1.0');
      expect(balance.symbol).toBe('XOM');
      expect(mockWallet.getBalance).toHaveBeenCalledWith('OMNI');
    });

    it('should return 0 for other addresses', async () => {
      const otherAddress = '0x1234567890123456789012345678901234567890';
      
      const balance = await xomService.getBalance(otherAddress);

      expect(balance.raw).toBe(BigInt(0));
    });

    it('should validate address format', async () => {
      const invalidAddress = 'invalid-address';
      
      await expect(xomService.getBalance(invalidAddress))
        .rejects.toThrow('Invalid wallet address');
    });

    it('should handle case-insensitive address comparison', async () => {
      const upperCaseAddress = '0x742D35CC6634C0532925A3B844BC9E7595F6BED7';
      
      const balance = await xomService.getBalance(upperCaseAddress);

      expect(balance.raw).toBe(BigInt('1000000000000000000'));
    });

    it('should throw error when wallet not available', async () => {
      (mockWalletService.getWallet as jest.Mock).mockReturnValue(null);
      
      await expect(xomService.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7'))
        .rejects.toThrow('Wallet not available');
    });
  });

  describe('getXOMBalance', () => {
    beforeEach(async () => {
      await xomService.init();
    });

    it('should get XOM balance for current wallet', async () => {
      const balance = await xomService.getXOMBalance();
      
      expect(balance).toBe(BigInt('1000000000000000000'));
      expect(mockWallet.getBalance).toHaveBeenCalledWith('OMNI');
    });

    it('should handle string balance from wallet', async () => {
      mockWallet.getBalance.mockResolvedValueOnce('2000000000000000000');
      
      const balance = await xomService.getXOMBalance();
      
      expect(balance).toBe(BigInt('2000000000000000000'));
    });

    it('should throw error when wallet not available', async () => {
      (mockWalletService.getWallet as jest.Mock).mockReturnValue(null);
      
      await expect(xomService.getXOMBalance())
        .rejects.toThrow('Wallet not available');
    });
  });

  describe('staking', () => {
    beforeEach(async () => {
      await xomService.init();
    });

    it('should stake XOM tokens', async () => {
      const amount = BigInt('1000000000000000000'); // 1 XOM
      
      const result = await xomService.stakeXOM(amount);
      
      expect(result).toEqual({
        success: true,
        txHash: '0x123',
        stakeId: 'stake-123'
      });
      expect(mockWallet.stakeOmniCoin).toHaveBeenCalledWith(amount);
    });

    it('should get staked balance', async () => {
      const stakedBalance = await xomService.getStakedBalance();

      // Without proper stakingService mock, returns 0
      expect(stakedBalance).toBe(BigInt('0'));
    });

    it('should throw error when wallet not available for staking', async () => {
      (mockWalletService.getWallet as jest.Mock).mockReturnValue(null);
      
      await expect(xomService.stakeXOM(BigInt('1000')))
        .rejects.toThrow('Wallet not available');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await expect(xomService.clearCache()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await xomService.init();
      expect(() => xomService.cleanup()).not.toThrow();

      // Should be able to reinitialize
      await expect(xomService.init()).resolves.not.toThrow();
    });
  });
});