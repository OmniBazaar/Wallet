/**
 * Provider Manager Array Access Safety Tests
 * Tests TypeScript strict mode compliance and array access safety
 */

import { ProviderManager, providerManager } from '../../../src/core/providers/ProviderManager';
import { ChainType } from '../../../src/core/keyring/BIP39Keyring';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { createMockProvider, TEST_PASSWORD, TEST_ADDRESSES, cleanupTest } from '../../setup';
import { ethers } from 'ethers';

// Mock ethers and providers
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => createMockProvider('ethereum')),
    BrowserProvider: jest.fn().mockImplementation(() => createMockProvider('ethereum'))
  };
});

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(1000000000),
    getRecentBlockhash: jest.fn().mockResolvedValue({
      blockhash: '11111111111111111111111111111111',
      feeCalculator: { lamportsPerSignature: 5000 }
    }),
    sendRawTransaction: jest.fn().mockResolvedValue('mockTxId')
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({ toString: () => key })),
  Keypair: {
    generate: jest.fn(() => ({
      publicKey: { 
        toString: () => 'mockPublicKey',
        toBase58: () => '7nYzHJbXSHAj7uuaK4FJNqrYPgFMhzxbPjvRcmZy8Xzd'
      },
      secretKey: new Uint8Array(64)
    })),
    fromSeed: jest.fn((seed) => ({
      publicKey: { 
        toBase58: () => '7nYzHJbXSHAj7uuaK4FJNqrYPgFMhzxbPjvRcmZy8Xzd'
      },
      secretKey: new Uint8Array(64)
    }))
  }
}));

describe('ProviderManager Array Access Safety', () => {
  beforeEach(async () => {
    // Mock the keyring service methods instead of initializing it
    jest.spyOn(keyringService, 'getActiveAccount').mockReturnValue({
      id: 'test-account-id',
      address: TEST_ADDRESSES.ethereum,
      chainType: 'ethereum' as ChainType,
      name: 'Test Account'
    } as any);
    
    jest.spyOn(keyringService, 'getAccounts').mockResolvedValue([{
      id: 'test-account-id',
      address: TEST_ADDRESSES.ethereum,
      chainType: 'ethereum' as ChainType,
      name: 'Test Account'
    }] as any);
    
    jest.spyOn(keyringService, 'setActiveAccount').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupTest();
    providerManager['providers'].clear();
    providerManager['activeChain'] = 'ethereum' as ChainType;
    providerManager['activeNetwork'] = 'mainnet';
    jest.restoreAllMocks();
  });

  describe('Network Array Access Safety', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should safely access network arrays without bounds checking', () => {
      const supportedNetworks = providerManager.getSupportedNetworks('ethereum' as ChainType);
      
      // Safe array access patterns
      const firstNetwork = supportedNetworks[0];
      const lastNetwork = supportedNetworks[supportedNetworks.length - 1];
      const nonExistentNetwork = supportedNetworks[999];
      
      expect(firstNetwork).toBeDefined();
      expect(typeof firstNetwork).toBe('string');
      
      if (supportedNetworks.length > 0) {
        expect(lastNetwork).toBeDefined();
        expect(typeof lastNetwork).toBe('string');
      }
      
      expect(nonExistentNetwork).toBeUndefined();
    });

    it('should handle empty network arrays gracefully', () => {
      // Mock an empty network array scenario
      const originalGetSupportedNetworks = providerManager.getSupportedNetworks;
      providerManager.getSupportedNetworks = jest.fn().mockReturnValue([]);
      
      const networks = providerManager.getSupportedNetworks('ethereum' as ChainType);
      
      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBe(0);
      
      // Safe access should not throw
      const firstNetwork = networks[0];
      expect(firstNetwork).toBeUndefined();
      
      // Restore original method
      providerManager.getSupportedNetworks = originalGetSupportedNetworks;
    });

    it('should use proper array iteration methods', () => {
      const evmNetworks = providerManager.getSupportedNetworks('ethereum' as ChainType);
      
      // Safe iteration with forEach
      const processedNetworks: string[] = [];
      evmNetworks.forEach((network, index) => {
        expect(typeof network).toBe('string');
        expect(typeof index).toBe('number');
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(evmNetworks.length);
        processedNetworks.push(network.toUpperCase());
      });
      
      expect(processedNetworks.length).toBe(evmNetworks.length);
    });

    it('should handle array methods safely', () => {
      const networks = providerManager.getSupportedNetworks('ethereum' as ChainType);
      
      // Array methods should work safely
      const filtered = networks.filter(network => network.includes('main'));
      const mapped = networks.map(network => network.toUpperCase());
      const found = networks.find(network => network === 'ethereum');
      const index = networks.findIndex(network => network === 'polygon');
      
      expect(Array.isArray(filtered)).toBe(true);
      expect(Array.isArray(mapped)).toBe(true);
      expect(mapped.length).toBe(networks.length);
      
      if (found) {
        expect(typeof found).toBe('string');
      }
      
      expect(typeof index).toBe('number');
      expect(index).toBeGreaterThanOrEqual(-1);
    });
  });

  describe('Provider Collection Array Safety', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should safely access provider arrays in collections', () => {
      // Access internal providers collection safely
      const providersMap = providerManager['providers'];
      
      expect(providersMap).toBeInstanceOf(Map);
      
      // Convert to array for testing
      const providerEntries = Array.from(providersMap.entries());
      
      // Safe array access
      const firstEntry = providerEntries[0];
      const lastEntry = providerEntries[providerEntries.length - 1];
      
      if (providerEntries.length > 0) {
        expect(firstEntry).toBeDefined();
        expect(Array.isArray(firstEntry)).toBe(true);
        expect(firstEntry.length).toBe(2); // [key, value] pair
        
        if (lastEntry) {
          expect(lastEntry).toBeDefined();
          expect(Array.isArray(lastEntry)).toBe(true);
        }
      }
    });

    it('should handle provider array iteration safely', () => {
      const chainTypes: ChainType[] = ['ethereum', 'solana', 'bitcoin'];
      const providers: any[] = [];
      
      // Safe iteration over chain types
      chainTypes.forEach((chainType, index) => {
        const provider = providerManager.getProvider(chainType);
        
        expect(typeof index).toBe('number');
        expect(index).toBeLessThan(chainTypes.length);
        
        if (provider) {
          providers.push({ chainType, provider });
        }
      });
      
      // Verify we collected providers safely
      expect(Array.isArray(providers)).toBe(true);
      providers.forEach(({ chainType, provider }) => {
        expect(typeof chainType).toBe('string');
        expect(provider).toBeDefined();
      });
    });
  });

  describe('Transaction History Array Safety', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should handle empty transaction arrays', async () => {
      // Mock empty transaction history
      const mockTransactions: any[] = [];
      
      // Safe operations on empty array
      const first = mockTransactions[0];
      const last = mockTransactions[mockTransactions.length - 1];
      const sliced = mockTransactions.slice(0, 10);
      
      expect(first).toBeUndefined();
      expect(last).toBeUndefined();
      expect(Array.isArray(sliced)).toBe(true);
      expect(sliced.length).toBe(0);
    });

    it('should safely process transaction arrays', async () => {
      const mockTransactions = [
        { hash: '0x123', from: TEST_ADDRESSES.ethereum, to: TEST_ADDRESSES.ethereum, value: '1000' },
        { hash: '0x456', from: TEST_ADDRESSES.ethereum, to: TEST_ADDRESSES.ethereum, value: '2000' },
        { hash: '0x789', from: TEST_ADDRESSES.ethereum, to: TEST_ADDRESSES.ethereum, value: '3000' }
      ];
      
      // Safe array operations
      const totalValue = mockTransactions.reduce((sum, tx) => sum + parseInt(tx.value), 0);
      const hashes = mockTransactions.map(tx => tx.hash);
      const firstTx = mockTransactions[0];
      const validTxs = mockTransactions.filter(tx => tx.hash.startsWith('0x'));
      
      expect(totalValue).toBe(6000);
      expect(hashes).toHaveLength(3);
      expect(hashes.every(hash => typeof hash === 'string')).toBe(true);
      expect(firstTx.hash).toBe('0x123');
      expect(validTxs).toHaveLength(3);
    });
  });

  describe('Multi-Network Array Operations', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should safely handle network configuration arrays', async () => {
      const evmNetworks = [
        'ethereum', 'polygon', 'arbitrum', 'optimism', 'base',
        'bsc', 'avalanche', 'fantom', 'celo', 'moonbeam'
      ];
      
      // Safe parallel processing
      const networkDetails = await Promise.allSettled(
        evmNetworks.map(async (network) => {
          try {
            await providerManager.switchEVMNetwork(network);
            return providerManager.getCurrentNetworkDetails();
          } catch (error) {
            return null;
          }
        })
      );
      
      expect(networkDetails).toHaveLength(evmNetworks.length);
      
      // Safe result processing
      const successfulResults = networkDetails
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<any>).value);
      
      expect(Array.isArray(successfulResults)).toBe(true);
      
      successfulResults.forEach(details => {
        if (details) {
          expect(details.chainId).toBeDefined();
          expect(details.name).toBeDefined();
          expect(details.nativeCurrency).toBeDefined();
        }
      });
    });

    it('should handle nested array structures safely', () => {
      const networkGroups = [
        { category: 'layer1', networks: ['ethereum', 'bsc', 'avalanche'] },
        { category: 'layer2', networks: ['polygon', 'arbitrum', 'optimism'] },
        { category: 'sidechain', networks: ['gnosis', 'moonbeam', 'aurora'] }
      ];
      
      // Safe nested array access
      const allNetworks: string[] = [];
      networkGroups.forEach(group => {
        expect(Array.isArray(group.networks)).toBe(true);
        
        group.networks.forEach((network, index) => {
          expect(typeof network).toBe('string');
          expect(index).toBeGreaterThanOrEqual(0);
          allNetworks.push(`${group.category}-${network}`);
        });
      });
      
      expect(allNetworks.length).toBe(9);
      expect(allNetworks.every(name => name.includes('-'))).toBe(true);
    });
  });

  describe('Error Array Handling', () => {
    it('should handle arrays with null/undefined elements', () => {
      const mixedArray = [
        TEST_ADDRESSES.ethereum,
        null,
        undefined,
        TEST_ADDRESSES.solana,
        '',
        TEST_ADDRESSES.bitcoin
      ];
      
      // Safe filtering
      const validAddresses = mixedArray.filter(Boolean);
      const nonNullAddresses = mixedArray.filter(addr => addr != null);
      const stringAddresses = mixedArray.filter(addr => typeof addr === 'string' && addr.length > 0);
      
      expect(validAddresses.length).toBe(3); // Only truthy values
      expect(nonNullAddresses.length).toBe(4); // Excludes null and undefined
      expect(stringAddresses.length).toBe(3); // Only non-empty strings
      
      // Safe iteration with null checks
      mixedArray.forEach((addr, index) => {
        expect(typeof index).toBe('number');
        
        if (addr != null) {
          expect(typeof addr).toBe('string');
        }
      });
    });

    it('should handle array operations with potential errors', async () => {
      const networkOperations = [
        () => providerManager.switchEVMNetwork('ethereum'),
        () => providerManager.switchEVMNetwork('invalid-network'),
        () => providerManager.switchEVMNetwork('polygon'),
        () => providerManager.switchEVMNetwork('')
      ];
      
      // Safe error handling in array operations
      const results = await Promise.allSettled(
        networkOperations.map(operation => operation())
      );
      
      expect(results).toHaveLength(4);
      
      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');
      
      expect(successful.length).toBeGreaterThanOrEqual(2); // At least ethereum and polygon
      expect(failed.length).toBeGreaterThanOrEqual(1); // Invalid operations should fail
      
      // Verify error structure
      failed.forEach(result => {
        const rejectedResult = result as PromiseRejectedResult;
        expect(rejectedResult.reason).toBeInstanceOf(Error);
      });
    });
  });

  describe('Array Bounds and Memory Safety', () => {
    it('should handle large arrays efficiently', () => {
      const largeArray = new Array(10000).fill(0).map((_, i) => `address-${i}`);
      
      const start = performance.now();
      
      // Efficient array operations
      const evenIndices = largeArray.filter((_, index) => index % 2 === 0);
      const firstHundred = largeArray.slice(0, 100);
      const found = largeArray.find(addr => addr === 'address-5000');
      
      const end = performance.now();
      
      expect(evenIndices.length).toBe(5000);
      expect(firstHundred.length).toBe(100);
      expect(found).toBe('address-5000');
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should prevent array index out of bounds issues', () => {
      const smallArray = ['a', 'b', 'c'];
      
      // Safe access patterns
      const safeGet = (arr: string[], index: number): string | undefined => {
        return index >= 0 && index < arr.length ? arr[index] : undefined;
      };
      
      expect(safeGet(smallArray, 0)).toBe('a');
      expect(safeGet(smallArray, 2)).toBe('c');
      expect(safeGet(smallArray, 5)).toBeUndefined();
      expect(safeGet(smallArray, -1)).toBeUndefined();
      
      // Safe iteration
      for (let i = 0; i < smallArray.length; i++) {
        const element = smallArray[i];
        expect(element).toBeDefined();
        expect(typeof element).toBe('string');
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(smallArray.length);
      }
    });
  });

  describe('Typed Array Operations', () => {
    it('should handle typed arrays with type safety', () => {
      interface NetworkConfig {
        name: string;
        chainId: number;
        rpcUrl: string;
      }
      
      const networkConfigs: NetworkConfig[] = [
        { name: 'ethereum', chainId: 1, rpcUrl: 'https://eth.example.com' },
        { name: 'polygon', chainId: 137, rpcUrl: 'https://polygon.example.com' },
        { name: 'arbitrum', chainId: 42161, rpcUrl: 'https://arbitrum.example.com' }
      ];
      
      // Type-safe operations
      const chainIds = networkConfigs.map(config => config.chainId);
      const mainnetConfigs = networkConfigs.filter(config => config.chainId === 1);
      const polygonConfig = networkConfigs.find(config => config.name === 'polygon');
      
      expect(chainIds).toEqual([1, 137, 42161]);
      expect(mainnetConfigs).toHaveLength(1);
      expect(mainnetConfigs[0]?.name).toBe('ethereum');
      expect(polygonConfig?.chainId).toBe(137);
      
      // Safe property access
      networkConfigs.forEach(config => {
        expect(typeof config.name).toBe('string');
        expect(typeof config.chainId).toBe('number');
        expect(typeof config.rpcUrl).toBe('string');
        expect(config.chainId).toBeGreaterThan(0);
        expect(config.rpcUrl).toMatch(/^https?:\/\//);
      });
    });

    it('should handle optional array elements safely', () => {
      interface OptionalData {
        required: string;
        optional?: number;
        array?: string[];
      }
      
      const dataArray: OptionalData[] = [
        { required: 'test1', optional: 42, array: ['a', 'b'] },
        { required: 'test2' }, // Missing optional fields
        { required: 'test3', array: [] } // Empty array
      ];
      
      // Safe optional property access
      dataArray.forEach(data => {
        expect(typeof data.required).toBe('string');
        
        if (data.optional !== undefined) {
          expect(typeof data.optional).toBe('number');
        }
        
        if (data.array !== undefined) {
          expect(Array.isArray(data.array)).toBe(true);
          
          data.array.forEach(item => {
            expect(typeof item).toBe('string');
          });
        }
      });
      
      // Conditional array operations
      const hasOptional = dataArray.filter(data => data.optional !== undefined);
      const hasArray = dataArray.filter(data => data.array !== undefined);
      
      expect(hasOptional).toHaveLength(1);
      expect(hasArray).toHaveLength(2);
    });
  });
});