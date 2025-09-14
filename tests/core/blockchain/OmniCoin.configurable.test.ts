/**
 * OmniCoin Integration Test Suite - Configurable Version
 * 
 * Works with both mock and real endpoints based on environment configuration
 * Set USE_REAL_ENDPOINTS=true to test against actual blockchain
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { 
  LiveOmniCoinProvider, 
  OMNICOIN_NETWORKS, 
  createLiveOmniCoinProvider,
  type ValidatorClient,
  type OmniCoinNetwork
} from '../../../src/core/chains/omnicoin/live-provider';
import { OmniCoinMetadata, getOmniCoinBalance } from '../../../src/core/blockchain/OmniCoin';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { testEnv } from '../../config/test-environment';
import { TestProviderFactory, resetAllMocks, type MockProvider } from '../../mocks/provider-factory';

// Conditionally mock based on environment
if (!testEnv.isUsingRealEndpoints()) {
  jest.mock('../../../src/core/keyring/KeyringService', () => ({
    keyringService: {
      getActiveAccount: jest.fn(),
      signMessage: jest.fn(),
      signTransaction: jest.fn(),
      resolveUsername: jest.fn()
    }
  }));
}

describe('OmniCoin Integration (Configurable)', () => {
  let provider: LiveOmniCoinProvider;
  let mockProvider: MockProvider | ethers.JsonRpcProvider;
  let validatorClient: any;
  const testAccounts = testEnv.getTestAccounts();
  const endpoints = testEnv.getEndpoints();
  
  beforeEach(async () => {
    // Reset mocks between tests
    resetAllMocks();
    
    // Create provider based on environment
    if (testEnv.isUsingRealEndpoints()) {
      provider = new LiveOmniCoinProvider('mainnet', {
        rpcUrl: endpoints.omnicoinRpc,
        validatorUrl: endpoints.validatorUrl
      });
    } else {
      // Create mock provider
      mockProvider = TestProviderFactory.createOmniCoinProvider();
      validatorClient = TestProviderFactory.createValidatorClient();
      
      // Mock the provider creation
      jest.spyOn(LiveOmniCoinProvider.prototype as any, 'initializeProvider').mockImplementation(function() {
        (this as any).provider = mockProvider;
      });
      
      jest.spyOn(LiveOmniCoinProvider.prototype as any, 'initializeValidatorClient').mockImplementation(function() {
        (this as any).validatorClient = validatorClient;
      });
      
      provider = new LiveOmniCoinProvider('testnet');
      
      // Set up mock data
      if ('setMockBalance' in mockProvider) {
        mockProvider.setMockBalance(testAccounts.user1.address, ethers.parseEther('100'));
        mockProvider.setMockBalance(testAccounts.user2.address, ethers.parseEther('50'));
        mockProvider.setMockBalance(testAccounts.validator.address, ethers.parseEther('10000'));
      }
    }
  });
  
  afterEach(() => {
    if (!testEnv.isUsingRealEndpoints()) {
      jest.restoreAllMocks();
    }
  });
  
  describe('OmniCoin Metadata', () => {
    it('should have correct token metadata', () => {
      expect(OmniCoinMetadata.name).toBe('OmniCoin');
      expect(OmniCoinMetadata.symbol).toBe('XOM');
      expect(OmniCoinMetadata.decimals).toBe(18);
      expect(OmniCoinMetadata.logo).toBeDefined();
    });
  });
  
  describe('Provider Initialization', () => {
    it('should initialize with testnet by default', () => {
      const network = provider.getNetwork();
      expect(network).toBeDefined();
      expect(network.rpcUrl).toBeDefined();
      
      if (testEnv.isUsingRealEndpoints()) {
        expect(network.rpcUrl).toBe(endpoints.omnicoinRpc);
      }
    });
    
    it('should get provider instance', () => {
      const ethersProvider = provider.getProvider();
      expect(ethersProvider).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(ethersProvider).toBe(mockProvider);
      }
    });
    
    it('should get validator client', () => {
      const client = provider.getValidatorClient();
      expect(client).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(client).toBe(validatorClient);
      }
    });
  });
  
  describe('Balance Operations', () => {
    it('should get XOM balance', async () => {
      const balance = await provider.getBalance(testAccounts.user1.address);
      
      if (testEnv.isUsingRealEndpoints()) {
        // Real balance check
        expect(balance).toBeDefined();
        expect(typeof balance).toBe('bigint');
      } else {
        // Mock balance check
        expect(balance).toBe(ethers.parseEther('100'));
      }
    });
    
    it('should handle getOmniCoinBalance helper', async () => {
      const result = await getOmniCoinBalance(
        testAccounts.user1.address,
        provider.getProvider()
      );
      
      expect(result).toBeDefined();
      expect(result.balance).toBeDefined();
      expect(result.formatted).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(result.balance).toBe(ethers.parseEther('100'));
        expect(result.formatted).toBe('100.0');
      }
    });
  });
  
  describe('Transaction Operations', () => {
    beforeEach(() => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Mock keyring service
        (keyringService.getActiveAccount as jest.Mock).mockReturnValue({
          address: testAccounts.user1.address,
          privateKey: testAccounts.user1.privateKey
        });
        
        (keyringService.signTransaction as jest.Mock).mockResolvedValue('0xSignedTransaction');
      }
    });
    
    it('should broadcast transaction', async () => {
      const tx = {
        to: testAccounts.user2.address,
        value: ethers.parseEther('1'),
        data: '0x'
      };
      
      const result = await provider.broadcastTransaction(tx);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(result.wait).toBeDefined();
        const receipt = await result.wait();
        expect(receipt.status).toBe(1);
      }
    }, testEnv.getTestTimeout());
    
    it('should send private transaction', async () => {
      if (!provider.getNetwork().features.privacy) {
        // Skip if privacy not supported
        return;
      }
      
      provider.setPrivacyMode(true);
      
      const tx = {
        to: testAccounts.user2.address,
        value: ethers.parseEther('1'),
        data: '0x'
      };
      
      const result = await provider.sendPrivateTransaction(tx);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
    }, testEnv.getTestTimeout());
  });
  
  describe('Staking Operations', () => {
    let omniCoinContract: ethers.Contract;
    
    beforeEach(async () => {
      omniCoinContract = await TestProviderFactory.createContract('OmniCoin', provider.getProvider());
    });
    
    it('should stake XOM tokens', async () => {
      const stakeAmount = ethers.parseEther('10');
      
      if (testEnv.isUsingRealEndpoints()) {
        // Check balance first
        const balance = await omniCoinContract.balanceOf(testAccounts.user1.address);
        if (balance < stakeAmount) {
          console.log('Insufficient balance for staking test');
          return;
        }
      }
      
      const stakeTx = await provider.stake(stakeAmount, testAccounts.validator.address);
      expect(stakeTx).toBeDefined();
      expect(stakeTx.hash).toBeDefined();
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(stakeTx.wait).toBeDefined();
      }
    }, testEnv.getTestTimeout());
    
    it('should get staking info', async () => {
      const stakingInfo = await provider.getStakingInfo(testAccounts.user1.address);
      
      expect(stakingInfo).toBeDefined();
      expect(stakingInfo.totalStaked).toBeDefined();
      expect(stakingInfo.validators).toBeDefined();
      expect(Array.isArray(stakingInfo.validators)).toBe(true);
    });
  });
  
  describe('Validator Client Operations', () => {
    it('should get account info from validator', async () => {
      const client = provider.getValidatorClient();
      if (!client) {
        console.log('Validator client not available');
        return;
      }
      
      const accountInfo = await client.getAccount(testAccounts.user1.address);
      
      expect(accountInfo).toBeDefined();
      expect(accountInfo.address).toBe(testAccounts.user1.address);
      expect(accountInfo.balance).toBeDefined();
    });
    
    it('should get user listings', async () => {
      const client = provider.getValidatorClient();
      if (!client) {
        console.log('Validator client not available');
        return;
      }
      
      const listings = await provider.getUserListings(testAccounts.user1.address);
      
      expect(listings).toBeDefined();
      expect(Array.isArray(listings)).toBe(true);
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(listings.length).toBe(2);
        expect(listings[0].seller).toBeDefined();
      }
    });
    
    it('should get reputation score', async () => {
      const client = provider.getValidatorClient();
      if (!client) {
        console.log('Validator client not available');
        return;
      }
      
      const reputation = await provider.getReputation(testAccounts.user1.address);
      
      expect(reputation).toBeDefined();
      expect(typeof reputation).toBe('number');
      
      if (!testEnv.isUsingRealEndpoints()) {
        expect(reputation).toBe(85);
      }
    });
  });
  
  describe('Privacy Features', () => {
    it('should enable privacy mode', () => {
      if (!provider.getNetwork().features.privacy) {
        console.log('Privacy not supported on this network');
        return;
      }
      
      provider.setPrivacyMode(true);
      expect(provider.isPrivacyEnabled()).toBe(true);
    });
    
    it('should disable privacy mode', () => {
      if (!provider.getNetwork().features.privacy) {
        console.log('Privacy not supported on this network');
        return;
      }
      
      provider.setPrivacyMode(true);
      provider.setPrivacyMode(false);
      expect(provider.isPrivacyEnabled()).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Force an error in mock
        (mockProvider.getBalance as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      }
      
      try {
        await provider.getBalance('0xInvalidAddress');
        
        if (!testEnv.isUsingRealEndpoints()) {
          // Should not reach here in mock mode
          expect(true).toBe(false);
        }
      } catch (error) {
        expect(error).toBeDefined();
        if (!testEnv.isUsingRealEndpoints()) {
          expect(error.message).toContain('Network error');
        }
      }
    });
  });
  
  // Skip tests if required and real endpoints not available
  if (testEnv.shouldSkipIfNoRealEndpoints()) {
    it.skip('Skipping tests - real endpoints required but not available', () => {});
  }
});

// Export test utilities for other tests
export { TestProviderFactory, testEnv };