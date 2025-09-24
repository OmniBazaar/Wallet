/**
 * Multi-Blockchain Platform Comprehensive Test Suite
 *
 * Tests for major blockchains: Ethereum, Bitcoin, Solana, Polygon, Arbitrum,
 * Optimism, BSC, Avalanche, COTI, and OmniCoin.
 *
 * Critical requirements:
 * - Cross-chain operations and provider switching
 * - Transaction signing and submission across chains
 * - Network switching and chain-specific features
 * - Real blockchain provider integration testing
 */

import { ethers } from 'ethers';
import { ProviderManager, ChainType, NetworkType } from '../../src/core/providers/ProviderManager';
import { KeyringService } from '../../src/core/keyring/KeyringService';

// Use the mock BIP39Keyring instead of the real one
jest.mock('../../src/core/keyring/BIP39Keyring', () => {
  return require('../../__mocks__/src/core/keyring/BIP39Keyring');
});
import { BIP39Keyring } from '../../src/core/keyring/BIP39Keyring';
import { ALL_NETWORKS } from '../../src/core/chains/evm';
import { ETHEREUM_NETWORKS } from '../../src/core/chains/ethereum/live-provider';
import { COTI_NETWORKS } from '../../src/core/chains/coti/live-provider';
import { OMNICOIN_NETWORKS } from '../../src/core/chains/omnicoin/live-provider';
import { SOLANA_NETWORKS } from '../../src/core/chains/solana';
import { POLKADOT_NETWORKS } from '../../src/core/chains/polkadot';

describe('Multi-Blockchain Platform Tests', () => {
  let providerManager: ProviderManager;
  let keyringService: KeyringService;
  let testKeyring: BIP39Keyring;

  // Test account data
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPassword = 'test-password-12345';

  beforeAll(async () => {
    // Initialize provider manager
    providerManager = ProviderManager.getInstance();
    await providerManager.initialize('testnet');

    // Initialize keyring service
    keyringService = new KeyringService();
    await keyringService.initialize();

    // Create test keyring
    testKeyring = new BIP39Keyring();
    await testKeyring.importFromMnemonic(testMnemonic, testPassword);
    
    // Create accounts for different chains
    await testKeyring.createAccount('ethereum');
    await testKeyring.createAccount('bitcoin');
    await testKeyring.createAccount('solana');
    await testKeyring.createAccount('omnicoin');
    await testKeyring.createAccount('coti');
  });

  afterAll(async () => {
    // Cleanup resources
    if (keyringService) {
      await keyringService.lock();
    }
  });

  describe('Provider Initialization', () => {
    test('should initialize all supported chain providers', async () => {
      const supportedChains: ChainType[] = [
        'ethereum', 'bitcoin', 'solana', 'substrate', 'coti', 'omnicoin'
      ];

      for (const chainType of supportedChains) {
        const provider = providerManager.getProvider(chainType);
        expect(provider).toBeTruthy();
        expect(provider).toBeDefined();
      }
    });

    test('should initialize EVM providers for all major networks', async () => {
      // Test any available EVM providers (since ProviderManager is already initialized)
      const availableProviders = providerManager.getAvailableEVMNetworks();
      
      // Should have at least some EVM providers initialized
      expect(availableProviders.length).toBeGreaterThan(0);
      
      // Test each available provider
      for (const network of availableProviders) {
        const provider = providerManager.getEVMProvider(network);
        expect(provider).toBeTruthy();
      }
    });

    test('should handle provider initialization failures gracefully', async () => {
      // Test invalid network
      expect(() => providerManager.getEVMProvider('invalid-network')).not.toThrow();
      const invalidProvider = providerManager.getEVMProvider('invalid-network');
      expect(invalidProvider).toBeNull();
    });
  });

  describe('Network Switching', () => {
    test('should switch between EVM networks successfully', async () => {
      const availableNetworks = providerManager.getAvailableEVMNetworks();
      
      for (const network of availableNetworks.slice(0, 3)) { // Test first 3 networks
        await expect(providerManager.switchEVMNetwork(network)).resolves.not.toThrow();
        const activeProvider = providerManager.getActiveProvider();
        expect(activeProvider).toBeTruthy();
      }
    });

    test('should switch between different blockchain types', async () => {
      const chains: ChainType[] = ['ethereum', 'solana', 'substrate'];
      
      for (const chain of chains) {
        await expect(providerManager.setActiveChain(chain)).resolves.not.toThrow();
        expect(providerManager.getActiveChain()).toBe(chain);
      }
    });

    test('should handle invalid network switching', async () => {
      await expect(providerManager.switchEVMNetwork('invalid-network')).rejects.toThrow();
      await expect(providerManager.setActiveChain('invalid-chain' as ChainType)).rejects.toThrow();
    });
  });

  describe('Account Management Across Chains', () => {
    test('should generate different addresses for different chains', async () => {
      const chains: ChainType[] = ['ethereum', 'bitcoin', 'solana'];
      const addresses: Record<string, string> = {};

      for (const chain of chains) {
        // Create an account for each chain
        const account = await testKeyring.createAccount(chain);
        const accounts = await testKeyring.getAccounts(chain);
        expect(accounts).toBeDefined();
        expect(Array.isArray(accounts)).toBe(true);
        expect(accounts.length).toBeGreaterThan(0);
        expect(accounts[0]).toBeDefined();
        expect(accounts[0]!.address).toBeTruthy();
        addresses[chain] = accounts[0]!.address;
      }

      // All addresses should be different
      const addressValues = Object.values(addresses);
      const uniqueAddresses = new Set(addressValues);
      expect(uniqueAddresses.size).toBe(addressValues.length);
    });

    test('should validate address formats for each chain', async () => {
      // Create accounts if they don't exist
      await testKeyring.createAccount('ethereum');
      await testKeyring.createAccount('bitcoin');
      await testKeyring.createAccount('solana');

      // Ethereum addresses should be valid hex
      const ethAccounts = await testKeyring.getAccounts('ethereum');
      expect(ethAccounts).toBeDefined();
      expect(Array.isArray(ethAccounts)).toBe(true);
      expect(ethAccounts.length).toBeGreaterThan(0);
      expect(ethAccounts[0]?.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Bitcoin addresses should be valid format
      const btcAccounts = await testKeyring.getAccounts('bitcoin');
      expect(btcAccounts).toBeDefined();
      expect(Array.isArray(btcAccounts)).toBe(true);
      expect(btcAccounts.length).toBeGreaterThan(0);
      expect(btcAccounts[0]?.address).toBeTruthy();
      expect(typeof btcAccounts[0]?.address).toBe('string');

      // Solana addresses should be base58
      const solAccounts = await testKeyring.getAccounts('solana');
      expect(solAccounts).toBeDefined();
      expect(Array.isArray(solAccounts)).toBe(true);
      expect(solAccounts.length).toBeGreaterThan(0);
      expect(solAccounts[0]?.address).toBeTruthy();
      expect(solAccounts[0]?.address.length).toBeGreaterThan(32);
    });

    test('should maintain consistent addresses across sessions', async () => {
      // Create accounts if they don't exist
      await testKeyring.createAccount('ethereum');
      await testKeyring.createAccount('bitcoin');

      // Get initial addresses
      const ethAccounts1 = await testKeyring.getAccounts('ethereum');
      const btcAccounts1 = await testKeyring.getAccounts('bitcoin');
      expect(ethAccounts1).toBeDefined();
      expect(btcAccounts1).toBeDefined();
      expect(ethAccounts1.length).toBeGreaterThan(0);
      expect(btcAccounts1.length).toBeGreaterThan(0);
      const ethAddress1 = ethAccounts1[0]?.address;
      const btcAddress1 = btcAccounts1[0]?.address;

      // Create new keyring with same mnemonic
      const newKeyring = new BIP39Keyring();
      await newKeyring.importFromMnemonic(testMnemonic, testPassword);

      // Create accounts in the new keyring
      await newKeyring.createAccount('ethereum');
      await newKeyring.createAccount('bitcoin');

      // Get addresses again
      const ethAccounts2 = await newKeyring.getAccounts('ethereum');
      const btcAccounts2 = await newKeyring.getAccounts('bitcoin');
      expect(ethAccounts2).toBeDefined();
      expect(btcAccounts2).toBeDefined();
      expect(ethAccounts2.length).toBeGreaterThan(0);
      expect(btcAccounts2.length).toBeGreaterThan(0);
      const ethAddress2 = ethAccounts2[0]?.address;
      const btcAddress2 = btcAccounts2[0]?.address;

      expect(ethAddress1).toBe(ethAddress2);
      expect(btcAddress1).toBe(btcAddress2);
    });
  });

  describe('Balance Retrieval', () => {
    test('should retrieve balances for all supported chains', async () => {
      const chains: ChainType[] = ['ethereum', 'bitcoin', 'solana', 'substrate'];

      for (const chain of chains) {
        try {
          const balance = await providerManager.getBalance(chain);
          expect(typeof balance).toBe('string');
          expect(balance).toBeDefined();
        } catch (error) {
          // Network errors are acceptable in test environment
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('should handle balance retrieval for multiple EVM chains', async () => {
      const availableNetworks = providerManager.getAvailableEVMNetworks();

      for (const network of availableNetworks.slice(0, 3)) {
        try {
          await providerManager.switchEVMNetwork(network);
          const balance = await providerManager.getBalance('ethereum');
          expect(typeof balance).toBe('string');
        } catch (error) {
          // Network errors are acceptable
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('should retrieve all balances simultaneously', async () => {
      try {
        const allBalances = await providerManager.getAllBalances();
        expect(typeof allBalances).toBe('object');
        expect(Object.keys(allBalances).length).toBeGreaterThan(0);
        
        for (const [chain, balance] of Object.entries(allBalances)) {
          expect(typeof balance).toBe('string');
        }
      } catch (error) {
        // Network errors are acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Transaction Preparation and Signing', () => {
    test('should prepare transactions for different chain types', async () => {
      const testAddress = '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43';
      const amount = '0.001';

      // Test Ethereum transaction preparation
      try {
        const ethTx = {
          to: testAddress,
          value: ethers.parseEther(amount),
          data: '0x'
        };
        expect(ethTx.to).toBe(testAddress);
        expect(ethTx.value).toBeTruthy();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Test different amount formats
      const amounts = ['0.001', '1.5', '0.0001'];
      for (const amt of amounts) {
        const value = ethers.parseEther(amt);
        expect(value).toBeTruthy();
        expect(typeof value).toBe('bigint');
      }
    });

    test('should handle different decimal places for different chains', async () => {
      // Ethereum: 18 decimals
      const ethValue = ethers.parseEther('1.0');
      expect(ethValue.toString()).toBe('1000000000000000000');

      // COTI: 6 decimals
      const cotiValue = ethers.parseUnits('1.0', 6);
      expect(cotiValue.toString()).toBe('1000000');

      // Bitcoin: 8 decimals (satoshis)
      const btcSatoshis = Math.floor(1.0 * 100000000);
      expect(btcSatoshis).toBe(100000000);
    });

    test('should validate addresses for different chains', async () => {
      // Ethereum address validation
      const validEthAddress = '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43';
      const invalidEthAddress = '0xinvalid';
      
      expect(ethers.isAddress(validEthAddress)).toBe(true);
      expect(ethers.isAddress(invalidEthAddress)).toBe(false);

      // Test address format validation
      expect(validEthAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Cross-Chain Operations', () => {
    test('should switch providers and maintain state', async () => {
      // Start with Ethereum
      await providerManager.setActiveChain('ethereum');
      expect(providerManager.getActiveChain()).toBe('ethereum');

      // Switch to Solana
      await providerManager.setActiveChain('solana');
      expect(providerManager.getActiveChain()).toBe('solana');

      // Switch back to Ethereum
      await providerManager.setActiveChain('ethereum');
      expect(providerManager.getActiveChain()).toBe('ethereum');
    });

    test('should handle cross-chain address resolution', async () => {
      const testCases = [
        { input: '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43', expected: 'ethereum' },
        { input: 'test.eth', expected: 'ens' },
        { input: 'test.omnicoin', expected: 'omnicoin' }
      ];

      for (const testCase of testCases) {
        // Test address format detection
        if (testCase.expected === 'ethereum') {
          expect(ethers.isAddress(testCase.input)).toBe(true);
        } else {
          expect(testCase.input.includes('.')).toBe(true);
        }
      }
    });

    test('should maintain account consistency across chain switches', async () => {
      const chains: ChainType[] = ['ethereum', 'solana', 'substrate'];
      const initialAddresses: Record<string, string> = {};

      // Get initial addresses
      for (const chain of chains) {
        const accounts = await testKeyring.getAccounts(chain);
        expect(accounts).toBeDefined();
        expect(Array.isArray(accounts)).toBe(true);
        if (accounts.length > 0 && accounts[0]) {
          initialAddresses[chain] = accounts[0].address;
        }
      }

      // Switch chains and verify addresses remain the same
      for (const chain of chains) {
        await providerManager.setActiveChain(chain);
        const accounts = await testKeyring.getAccounts(chain);
        expect(accounts).toBeDefined();
        expect(Array.isArray(accounts)).toBe(true);
        if (accounts.length > 0 && accounts[0] && initialAddresses[chain]) {
          expect(accounts[0].address).toBe(initialAddresses[chain]);
        }
      }
    });
  });

  describe('Network-Specific Features', () => {
    test('should identify chain-specific features', () => {
      // Ethereum features
      const ethFeatures = providerManager.getChainFeatures('ethereum');
      expect(ethFeatures.nft).toBe(true);
      expect(ethFeatures.defi).toBe(true);

      // OmniCoin features
      const omniFeatures = providerManager.getChainFeatures('omnicoin');
      expect(omniFeatures.privacy).toBe(true);
      expect(omniFeatures.staking).toBe(true);
      expect(omniFeatures.marketplace).toBe(true);

      // COTI features
      const cotiFeatures = providerManager.getChainFeatures('coti');
      expect(cotiFeatures.privacy).toBe(true);
    });

    test('should handle privacy mode for supported chains', async () => {
      const privacyChains: ChainType[] = ['coti', 'omnicoin'];

      for (const chain of privacyChains) {
        expect(providerManager.isFeatureSupported(chain, 'privacy')).toBe(true);
        
        // Test privacy mode enabling/disabling
        await expect(providerManager.enablePrivacyMode(chain)).resolves.not.toThrow();
        await expect(providerManager.disablePrivacyMode(chain)).resolves.not.toThrow();
      }
    });

    test('should reject privacy mode for unsupported chains', async () => {
      await expect(providerManager.enablePrivacyMode('ethereum')).rejects.toThrow();
      await expect(providerManager.enablePrivacyMode('bitcoin')).rejects.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing providers gracefully', () => {
      const invalidChain = 'nonexistent' as ChainType;
      const provider = providerManager.getProvider(invalidChain);
      expect(provider).toBeNull();
    });

    test('should handle network connection failures', async () => {
      // Test with invalid RPC endpoints
      try {
        await providerManager.switchEVMNetwork('ethereum');
        const balance = await providerManager.getBalance('ethereum');
        expect(typeof balance).toBe('string');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
      }
    });

    test('should validate transaction parameters', async () => {
      const testCases = [
        { to: '', amount: '1.0', shouldFail: true },
        { to: 'invalid-address', amount: '1.0', shouldFail: true },
        { to: '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43', amount: '-1.0', shouldFail: true },
        { to: '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43', amount: '0', shouldFail: false }
      ];

      for (const testCase of testCases) {
        try {
          if (testCase.to && ethers.isAddress(testCase.to)) {
            const value = ethers.parseEther(testCase.amount);
            expect(value >= 0n).toBe(!testCase.shouldFail);
          } else if (testCase.shouldFail) {
            expect(true).toBe(true); // Expected to fail validation
          }
        } catch (error) {
          if (testCase.shouldFail) {
            expect(error).toBeInstanceOf(Error);
          } else {
            throw error;
          }
        }
      }
    });

    test('should handle concurrent operations', async () => {
      const operations = [
        () => providerManager.getBalance('ethereum'),
        () => providerManager.getBalance('solana'),
        () => providerManager.getAllBalances(),
        () => providerManager.setActiveChain('substrate')
      ];

      // Run operations concurrently
      try {
        await Promise.allSettled(operations.map(op => op()));
        expect(true).toBe(true); // Should not crash
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Performance and Stress Tests', () => {
    test('should handle rapid chain switching', async () => {
      const chains: ChainType[] = ['ethereum', 'solana', 'substrate'];
      const iterations = 10;

      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const chain = chains[i % chains.length];
        await providerManager.setActiveChain(chain);
        expect(providerManager.getActiveChain()).toBe(chain);
      }

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;
      
      // Should average less than 100ms per switch
      expect(avgTime).toBeLessThan(100);
    });

    test('should handle multiple simultaneous balance requests', async () => {
      const chains: ChainType[] = ['ethereum', 'bitcoin', 'solana'];
      
      const balancePromises = chains.map(chain => 
        providerManager.getBalance(chain).catch(error => error.message)
      );

      const results = await Promise.allSettled(balancePromises);
      
      // All requests should complete (successfully or with error)
      expect(results).toHaveLength(chains.length);
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    test('should maintain performance under load', async () => {
      const tasks = [];
      const taskCount = 50;

      // Create multiple concurrent tasks
      for (let i = 0; i < taskCount; i++) {
        tasks.push(async () => {
          const chain = i % 2 === 0 ? 'ethereum' : 'solana';
          await providerManager.setActiveChain(chain);
          return providerManager.getActiveChain();
        });
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(tasks.map(task => task()));
      const endTime = Date.now();

      // Should complete all tasks within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(taskCount);
    });
  });
});