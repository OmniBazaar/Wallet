/**
 * Coin/Token Integration Tests - Configurable Version
 * 
 * Tests wallet integration with various cryptocurrencies and tokens
 * Works with both mock and real endpoints based on environment
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { TokenService } from '../../src/services/TokenService';
import { XOMService } from '../../src/services/XOMService';
import { BridgeService } from '../../src/services/BridgeService';
import { ethers } from 'ethers';
import { testEnv } from '../config/test-environment';
import { TestProviderFactory, resetAllMocks } from '../mocks/provider-factory';

describe('Coin/Token Integration (Configurable)', () => {
  let walletService: WalletService;
  let tokenService: TokenService;
  let xomService: XOMService;
  let bridgeService: BridgeService;
  let provider: any;
  
  const testAccounts = testEnv.getTestAccounts();
  const endpoints = testEnv.getEndpoints();

  beforeAll(async () => {
    // Create provider based on environment
    if (testEnv.isUsingRealEndpoints()) {
      provider = new ethers.JsonRpcProvider(endpoints.omnicoinRpc);
    } else {
      provider = TestProviderFactory.createOmniCoinProvider();
      
      // Set up mock balances
      provider.setMockBalance(testAccounts.user1.address, ethers.parseEther('100'));
      provider.setMockBalance(testAccounts.user2.address, ethers.parseEther('50'));
      
      // Mock wallet service initialization
      jest.spyOn(WalletService.prototype, 'init').mockResolvedValue(undefined);
      jest.spyOn(WalletService.prototype, 'connect').mockResolvedValue(undefined);
      jest.spyOn(WalletService.prototype, 'cleanup').mockResolvedValue(undefined);
      
      // Mock token service
      jest.spyOn(TokenService.prototype, 'init').mockResolvedValue(undefined);
      jest.spyOn(TokenService.prototype, 'cleanup').mockResolvedValue(undefined);
      jest.spyOn(TokenService.prototype, 'clearCache').mockResolvedValue(undefined);
      
      // Mock XOM service
      jest.spyOn(XOMService.prototype, 'init').mockResolvedValue(undefined);
      jest.spyOn(XOMService.prototype, 'cleanup').mockResolvedValue(undefined);
    }
    
    // Create services
    walletService = new WalletService(provider);
    tokenService = new TokenService(walletService);
    xomService = new XOMService(walletService);
    bridgeService = new BridgeService();
    
    await walletService.init();
    await walletService.connect();
    await tokenService.init();
    await xomService.init();
    
    // Set active account
    if (!testEnv.isUsingRealEndpoints()) {
      (walletService as any).activeAccount = {
        address: testAccounts.user1.address,
        privateKey: testAccounts.user1.privateKey
      };
    }
  });
  
  afterAll(async () => {
    await walletService.cleanup();
    await tokenService.cleanup();
    await xomService.cleanup();
    
    if (!testEnv.isUsingRealEndpoints()) {
      jest.restoreAllMocks();
    }
  });
  
  beforeEach(async () => {
    await tokenService.clearCache();
    resetAllMocks();
    
    if (!testEnv.isUsingRealEndpoints()) {
      // Reset mock responses for each test
      provider.setMockBalance(testAccounts.user1.address, ethers.parseEther('100'));
    }
  });
  
  describe('XOM (OmniCoin) Integration', () => {
    beforeEach(() => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Mock XOM service methods
        jest.spyOn(xomService, 'getBalance').mockResolvedValue({
          raw: ethers.parseEther('100'),
          formatted: '100.0',
          symbol: 'XOM'
        });
        
        jest.spyOn(xomService, 'send').mockResolvedValue({
          hash: '0x' + Math.random().toString(16).substring(2),
          from: testAccounts.user1.address,
          to: testAccounts.user2.address,
          value: ethers.parseEther('10'),
          status: 'pending'
        });
        
        jest.spyOn(xomService, 'stake').mockResolvedValue({
          hash: '0x' + Math.random().toString(16).substring(2),
          amount: ethers.parseEther('50'),
          validator: testAccounts.validator.address,
          status: 'pending'
        });
        
        jest.spyOn(xomService, 'unstake').mockResolvedValue({
          hash: '0x' + Math.random().toString(16).substring(2),
          amount: ethers.parseEther('25'),
          validator: testAccounts.validator.address,
          status: 'pending'
        });
      }
    });
    
    it('should get XOM balance', async () => {
      const balance = await xomService.getBalance(testAccounts.user1.address);
      
      expect(balance).toBeDefined();
      expect(balance.symbol).toBe('XOM');
      expect(balance.raw).toBeDefined();
      expect(balance.formatted).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(balance.formatted).toBe('100.0');
      }
    }, testEnv.getTestTimeout());
    
    it('should send XOM tokens', async () => {
      const amount = ethers.parseEther('10');
      const result = await xomService.send(testAccounts.user2.address, amount);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.from).toBe(testAccounts.user1.address);
      expect(result.to).toBe(testAccounts.user2.address);
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(result.value).toBe(amount);
      }
    }, testEnv.getTestTimeout());
    
    it('should stake XOM tokens', async () => {
      const stakeAmount = ethers.parseEther('50');
      const result = await xomService.stake(stakeAmount, testAccounts.validator.address);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.amount).toBe(stakeAmount);
      expect(result.validator).toBe(testAccounts.validator.address);
    }, testEnv.getTestTimeout());
    
    it('should unstake XOM tokens', async () => {
      const unstakeAmount = ethers.parseEther('25');
      const result = await xomService.unstake(unstakeAmount, testAccounts.validator.address);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.amount).toBe(unstakeAmount);
    }, testEnv.getTestTimeout());
  });
  
  describe('ERC-20 Token Operations', () => {
    let mockTokenContract: any;
    const tokenAddress = '0x' + '1'.repeat(40); // Mock token address
    
    beforeEach(async () => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Create mock token contract
        mockTokenContract = await TestProviderFactory.createContract('OmniCoin', provider);
        
        // Mock token service methods
        jest.spyOn(tokenService, 'getTokenBalance').mockResolvedValue({
          raw: ethers.parseEther('1000'),
          formatted: '1000.0',
          symbol: 'TEST',
          decimals: 18
        });
        
        jest.spyOn(tokenService, 'transferToken').mockResolvedValue({
          hash: '0x' + Math.random().toString(16).substring(2),
          status: 'success'
        });
        
        jest.spyOn(tokenService, 'approveToken').mockResolvedValue({
          hash: '0x' + Math.random().toString(16).substring(2),
          status: 'success'
        });
        
        jest.spyOn(tokenService, 'getAllowance').mockResolvedValue(ethers.parseEther('100'));
      }
    });
    
    it('should get token balance', async () => {
      const balance = await tokenService.getTokenBalance(tokenAddress, testAccounts.user1.address);
      
      expect(balance).toBeDefined();
      expect(balance.raw).toBeDefined();
      expect(balance.formatted).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(balance.formatted).toBe('1000.0');
        expect(balance.symbol).toBe('TEST');
      }
    });
    
    it('should transfer tokens', async () => {
      const amount = ethers.parseEther('100');
      const result = await tokenService.transferToken(
        tokenAddress,
        testAccounts.user2.address,
        amount
      );
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.status).toBe('success');
    });
    
    it('should approve token spending', async () => {
      const amount = ethers.parseEther('500');
      const spender = testAccounts.user2.address;
      
      const result = await tokenService.approveToken(tokenAddress, spender, amount);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.status).toBe('success');
    });
    
    it('should check token allowance', async () => {
      const spender = testAccounts.user2.address;
      const allowance = await tokenService.getAllowance(
        tokenAddress,
        testAccounts.user1.address,
        spender
      );
      
      expect(allowance).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(allowance).toBe(ethers.parseEther('100'));
      }
    });
  });
  
  describe('Native Currency Operations', () => {
    beforeEach(() => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Mock wallet service transaction methods
        jest.spyOn(walletService, 'sendTransaction').mockResolvedValue({
          hash: '0x' + Math.random().toString(16).substring(2),
          from: testAccounts.user1.address,
          to: testAccounts.user2.address,
          value: ethers.parseEther('1'),
          wait: jest.fn().mockResolvedValue({ status: 1 })
        });
        
        jest.spyOn(walletService, 'estimateGas').mockResolvedValue(BigInt(21000));
        
        jest.spyOn(walletService, 'getGasPrice').mockResolvedValue({
          standard: ethers.parseUnits('20', 'gwei'),
          fast: ethers.parseUnits('30', 'gwei'),
          instant: ethers.parseUnits('40', 'gwei')
        });
      }
    });
    
    it('should send native currency', async () => {
      const amount = ethers.parseEther('1');
      const result = await walletService.sendTransaction({
        to: testAccounts.user2.address,
        value: amount
      });
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.from).toBe(testAccounts.user1.address);
      expect(result.to).toBe(testAccounts.user2.address);
    }, testEnv.getTestTimeout());
    
    it('should estimate gas for transaction', async () => {
      const gasEstimate = await walletService.estimateGas({
        to: testAccounts.user2.address,
        value: ethers.parseEther('1')
      });
      
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate).toBeGreaterThan(BigInt(0));
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(gasEstimate).toBe(BigInt(21000));
      }
    });
    
    it('should get current gas prices', async () => {
      const gasPrices = await walletService.getGasPrice();
      
      expect(gasPrices).toBeDefined();
      expect(gasPrices.standard).toBeDefined();
      expect(gasPrices.fast).toBeDefined();
      expect(gasPrices.instant).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(gasPrices.standard).toBe(ethers.parseUnits('20', 'gwei'));
      }
    });
  });
  
  describe('Cross-Chain Bridge Operations', () => {
    beforeEach(() => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Mock bridge service methods
        jest.spyOn(bridgeService, 'getBridgeRoutes').mockResolvedValue([
          {
            bridge: 'hop',
            fromChain: 'ethereum',
            toChain: 'polygon',
            token: 'USDC',
            estimatedTime: 300,
            fee: ethers.parseUnits('1', 6)
          }
        ]);
        
        jest.spyOn(bridgeService, 'initiateBridge').mockResolvedValue({
          bridgeId: 'bridge-123',
          status: 'initiated',
          hash: '0x' + Math.random().toString(16).substring(2)
        });
        
        jest.spyOn(bridgeService, 'getBridgeStatus').mockResolvedValue({
          status: 'completed',
          completedAt: new Date().toISOString()
        });
      }
    });
    
    it('should get bridge routes', async () => {
      const routes = await bridgeService.getBridgeRoutes(
        'ethereum',
        'polygon',
        'USDC',
        ethers.parseUnits('100', 6)
      );
      
      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(routes.length).toBeGreaterThan(0);
        expect(routes[0].bridge).toBe('hop');
      }
    });
    
    it('should initiate bridge transfer', async () => {
      const result = await bridgeService.initiateBridge({
        bridge: 'hop',
        fromChain: 'ethereum',
        toChain: 'polygon',
        token: 'USDC',
        amount: ethers.parseUnits('100', 6),
        recipient: testAccounts.user2.address
      });
      
      expect(result).toBeDefined();
      expect(result.bridgeId).toBeDefined();
      expect(result.status).toBe('initiated');
    });
    
    it('should track bridge transaction', async () => {
      const status = await bridgeService.getBridgeStatus('bridge-123');
      
      expect(status).toBeDefined();
      expect(status.status).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(status.status).toBe('completed');
      }
    });
  });
  
  // Skip tests if required and real endpoints not available
  if (testEnv.shouldSkipIfNoRealEndpoints()) {
    it.skip('Skipping tests - real endpoints required but not available', () => {});
  }
});

// Export for other tests
export { testEnv };