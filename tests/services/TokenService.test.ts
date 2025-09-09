/**
 * TokenService Tests
 * Tests for ERC-20 token operations and management
 */

import { TokenService } from '../../src/services/TokenService';
import { WalletService } from '../../src/services/WalletService';
import { providerManager } from '../../src/core/providers/ProviderManager';
import { priceFeedService } from '../../src/services/oracle/PriceFeedService';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../src/services/WalletService');
jest.mock('../../src/core/providers/ProviderManager');
jest.mock('../../src/services/oracle/PriceFeedService');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockWalletService: WalletService;
  let mockWallet: any;
  let mockProvider: any;
  let mockSigner: any;
  let mockContract: any;

  const TEST_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC
  const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
  const TEST_RECIPIENT = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Create mock contract
    mockContract = {
      balanceOf: jest.fn().mockResolvedValue(BigInt('1000000')), // 1 USDC
      transfer: jest.fn().mockResolvedValue({ 
        hash: '0xtx123', 
        wait: jest.fn().mockResolvedValue({}) 
      }),
      approve: jest.fn().mockResolvedValue({ 
        hash: '0xapprove123', 
        wait: jest.fn().mockResolvedValue({}) 
      }),
      allowance: jest.fn().mockResolvedValue(BigInt('500000')),
      symbol: jest.fn().mockResolvedValue('USDC'),
      name: jest.fn().mockResolvedValue('USD Coin'),
      decimals: jest.fn().mockResolvedValue(6),
      totalSupply: jest.fn().mockResolvedValue(BigInt('1000000000000000'))
    };

    // Create mock signer
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue(TEST_WALLET_ADDRESS)
    };

    // Create mock provider
    mockProvider = {
      getSigner: jest.fn().mockResolvedValue(mockSigner),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n, name: 'ethereum' })
    };

    // Create mock wallet
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue(TEST_WALLET_ADDRESS),
      getTokenBalance: jest.fn().mockResolvedValue(BigInt('1000000'))
    };

    // Setup mock WalletService
    mockWalletService = new WalletService();
    (mockWalletService.init as jest.Mock).mockResolvedValue(undefined);
    (mockWalletService.isServiceInitialized as jest.Mock).mockReturnValue(true);
    (mockWalletService.getWallet as jest.Mock).mockReturnValue(mockWallet);

    // Setup provider manager
    (providerManager.getActiveProvider as jest.Mock).mockResolvedValue(mockProvider);

    // Setup price feed service
    (priceFeedService.getPrice as jest.Mock).mockResolvedValue(1.0);

    // Mock ethers Contract constructor
    jest.spyOn(ethers, 'Contract').mockImplementation(() => mockContract as any);

    // Create TokenService instance
    tokenService = new TokenService(mockWalletService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(tokenService.init()).resolves.not.toThrow();
    });

    it('should initialize wallet service if not initialized', async () => {
      (mockWalletService.isServiceInitialized as jest.Mock).mockReturnValue(false);
      
      await tokenService.init();
      
      expect(mockWalletService.init).toHaveBeenCalled();
    });

    it('should load default tokens on init', async () => {
      await tokenService.init();
      
      const tokenInfo = await tokenService.getTokenInfo('0xA0b86a33E6441Cc00C5d8a08E3B7F4a0A6F0D4Ce');
      expect(tokenInfo).toBeDefined();
      expect(tokenInfo?.symbol).toBe('XOM');
    });
  });

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should get token balance', async () => {
      const balance = await tokenService.getTokenBalance(TEST_TOKEN_ADDRESS);
      
      expect(balance).toBe(BigInt('1000000'));
      expect(mockContract.balanceOf).toHaveBeenCalledWith(TEST_WALLET_ADDRESS);
    });

    it('should get token balance for specific address', async () => {
      const otherAddress = '0x9876543210987654321098765432109876543210';
      
      await tokenService.getTokenBalance(TEST_TOKEN_ADDRESS, otherAddress);
      
      expect(mockContract.balanceOf).toHaveBeenCalledWith(otherAddress);
    });

    it('should validate token address', async () => {
      await expect(tokenService.getTokenBalance('invalid-address'))
        .rejects.toThrow('Invalid token address');
    });

    it('should return 0 on contract error', async () => {
      mockContract.balanceOf.mockRejectedValueOnce(new Error('Contract error'));
      
      const balance = await tokenService.getTokenBalance(TEST_TOKEN_ADDRESS);
      
      expect(balance).toBe(BigInt(0));
    });

    it('should throw when wallet not available', async () => {
      (mockWalletService.getWallet as jest.Mock).mockReturnValue(null);
      
      await expect(tokenService.getTokenBalance(TEST_TOKEN_ADDRESS))
        .rejects.toThrow('Wallet not available');
    });
  });

  describe('getTokensByChain', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should get tokens for ethereum chain', async () => {
      const tokens = await tokenService.getTokensByChain(TEST_WALLET_ADDRESS, 'ethereum');
      
      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(tokenBalance => {
        expect(tokenBalance.token.chain).toBe('ethereum');
        expect(tokenBalance.balance).toBeDefined();
        expect(tokenBalance.balanceFormatted).toBeDefined();
        expect(tokenBalance.lastUpdated).toBeDefined();
      });
    });

    it('should include USD values when prices available', async () => {
      const tokens = await tokenService.getTokensByChain(TEST_WALLET_ADDRESS, 'ethereum');
      
      const usdcBalance = tokens.find(t => t.token.symbol === 'USDC');
      expect(usdcBalance?.valueUSD).toBeDefined();
      expect(usdcBalance?.valueUSD).toBe(1.0); // 1 USDC = $1.00
    });

    it('should validate wallet address', async () => {
      await expect(tokenService.getTokensByChain('invalid-address', 'ethereum'))
        .rejects.toThrow('Invalid wallet address');
    });

    it('should handle empty balances', async () => {
      mockContract.balanceOf.mockResolvedValue(BigInt(0));
      
      const tokens = await tokenService.getTokensByChain(TEST_WALLET_ADDRESS, 'ethereum');
      
      expect(tokens).toHaveLength(0);
    });
  });

  describe('transferToken', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should transfer tokens', async () => {
      const amount = BigInt('1000000'); // 1 USDC
      
      const txHash = await tokenService.transferToken(TEST_TOKEN_ADDRESS, TEST_RECIPIENT, amount);
      
      expect(txHash).toBe('0xtx123');
      expect(mockContract.transfer).toHaveBeenCalledWith(TEST_RECIPIENT, amount);
    });

    it('should validate token address', async () => {
      await expect(tokenService.transferToken('invalid', TEST_RECIPIENT, BigInt('1000')))
        .rejects.toThrow('Invalid token address');
    });

    it('should validate recipient address', async () => {
      await expect(tokenService.transferToken(TEST_TOKEN_ADDRESS, 'invalid', BigInt('1000')))
        .rejects.toThrow('Invalid recipient address');
    });

    it('should validate amount', async () => {
      await expect(tokenService.transferToken(TEST_TOKEN_ADDRESS, TEST_RECIPIENT, BigInt('0')))
        .rejects.toThrow('Amount must be greater than 0');
    });

    it('should throw when wallet not available', async () => {
      (mockWalletService.getWallet as jest.Mock).mockReturnValue(null);
      
      await expect(tokenService.transferToken(TEST_TOKEN_ADDRESS, TEST_RECIPIENT, BigInt('1000')))
        .rejects.toThrow('Wallet not available');
    });
  });

  describe('approveToken', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should approve token spending', async () => {
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap Router
      const amount = BigInt('1000000');
      
      const txHash = await tokenService.approveToken(TEST_TOKEN_ADDRESS, spender, amount);
      
      expect(txHash).toBe('0xapprove123');
      expect(mockContract.approve).toHaveBeenCalledWith(spender, amount);
    });

    it('should validate token address', async () => {
      await expect(tokenService.approveToken('invalid', TEST_RECIPIENT, BigInt('1000')))
        .rejects.toThrow('Invalid token address');
    });

    it('should validate spender address', async () => {
      await expect(tokenService.approveToken(TEST_TOKEN_ADDRESS, 'invalid', BigInt('1000')))
        .rejects.toThrow('Invalid spender address');
    });
  });

  describe('getAllowance', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should get token allowance', async () => {
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap Router
      
      const allowance = await tokenService.getAllowance(
        TEST_TOKEN_ADDRESS,
        TEST_WALLET_ADDRESS,
        spender
      );
      
      expect(allowance).toBe(BigInt('500000'));
      expect(mockContract.allowance).toHaveBeenCalledWith(TEST_WALLET_ADDRESS, spender);
    });

    it('should validate addresses', async () => {
      await expect(tokenService.getAllowance('invalid', TEST_WALLET_ADDRESS, TEST_RECIPIENT))
        .rejects.toThrow('Invalid token address');
      
      await expect(tokenService.getAllowance(TEST_TOKEN_ADDRESS, 'invalid', TEST_RECIPIENT))
        .rejects.toThrow('Invalid owner address');
      
      await expect(tokenService.getAllowance(TEST_TOKEN_ADDRESS, TEST_WALLET_ADDRESS, 'invalid'))
        .rejects.toThrow('Invalid spender address');
    });
  });

  describe('addCustomToken', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should add custom token', async () => {
      const customToken = {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        logoURI: 'https://example.com/dai.png'
      };
      
      await tokenService.addCustomToken(customToken);
      
      const tokenInfo = await tokenService.getTokenInfo(customToken.address);
      expect(tokenInfo).toBeDefined();
      expect(tokenInfo?.symbol).toBe('USDC'); // Mock returns USDC
      expect(tokenInfo?.isCustom).toBe(true);
      
      // Verify saved to localStorage
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'customTokens',
        expect.stringContaining(customToken.address)
      );
    });

    it('should validate token address', async () => {
      await expect(tokenService.addCustomToken({ address: 'invalid' }))
        .rejects.toThrow('Invalid token address');
    });

    it('should fetch metadata from chain', async () => {
      const customToken = { address: TEST_TOKEN_ADDRESS };
      
      await tokenService.addCustomToken(customToken);
      
      expect(mockContract.symbol).toHaveBeenCalled();
      expect(mockContract.name).toHaveBeenCalled();
      expect(mockContract.decimals).toHaveBeenCalled();
      expect(mockContract.totalSupply).toHaveBeenCalled();
    });
  });

  describe('getTokenPrices', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should get token prices', async () => {
      const addresses = [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
      ];
      
      const prices = await tokenService.getTokenPrices(addresses);
      
      expect(prices.size).toBeGreaterThan(0);
      expect(priceFeedService.getPrice).toHaveBeenCalled();
    });

    it('should skip unknown tokens', async () => {
      const unknownAddress = '0xUNKNOWN000000000000000000000000000000000';
      
      const prices = await tokenService.getTokenPrices([unknownAddress]);
      
      expect(prices.size).toBe(0);
    });

    it('should handle price fetch errors', async () => {
      (priceFeedService.getPrice as jest.Mock).mockRejectedValueOnce(new Error('Price error'));
      
      const prices = await tokenService.getTokenPrices([TEST_TOKEN_ADDRESS]);
      
      expect(prices.size).toBe(0);
    });
  });

  describe('getPopularTokens', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should get popular tokens for ethereum', async () => {
      const tokens = await tokenService.getPopularTokens('ethereum');
      
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0]).toHaveProperty('symbol');
      expect(tokens[0]).toHaveProperty('address');
      expect(tokens[0].chain).toBe('ethereum');
    });

    it('should get popular tokens for polygon', async () => {
      const tokens = await tokenService.getPopularTokens('polygon');
      
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.every(t => t.chain === 'polygon')).toBe(true);
    });

    it('should return empty array for unknown chain', async () => {
      const tokens = await tokenService.getPopularTokens('unknown-chain');
      
      expect(tokens).toEqual([]);
    });
  });

  describe('getTokenTransactionHistory', () => {
    it('should return empty array (placeholder)', async () => {
      const history = await tokenService.getTokenTransactionHistory(TEST_WALLET_ADDRESS);
      
      expect(history).toEqual([]);
    });
  });

  describe('getDeFiPositions', () => {
    it('should return empty array (placeholder)', async () => {
      const positions = await tokenService.getDeFiPositions(TEST_WALLET_ADDRESS);
      
      expect(positions).toEqual([]);
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await tokenService.init();
    });

    it('should clear balance cache', async () => {
      // Get balances to populate any internal state
      const balances = await tokenService.getTokensByChain(TEST_WALLET_ADDRESS, 'ethereum');
      expect(balances.length).toBeGreaterThan(0);
      
      // Clear cache should not throw
      await expect(tokenService.clearCache()).resolves.not.toThrow();
      
      // Cache should be empty after clear
      const allBalances = await tokenService.getAllTokenBalances();
      expect(allBalances).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await tokenService.init();
      await tokenService.addCustomToken({ address: TEST_TOKEN_ADDRESS });
      
      await tokenService.cleanup();
      
      // Should clear all data
      const tokenInfo = await tokenService.getTokenInfo(TEST_TOKEN_ADDRESS);
      expect(tokenInfo).toBeNull();
      
      const balances = await tokenService.getAllTokenBalances();
      expect(balances).toEqual([]);
    });
  });
});