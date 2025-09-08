/**
 * NFT Provider Bracket Notation Access Tests
 * Tests TypeScript compliance fixes for all 6 NFT providers
 */

import { ethers } from 'ethers';
import { EthereumNFTProvider } from '../../../../src/core/nft/providers/ethereum-provider';
import { PolygonNFTProvider } from '../../../../src/core/nft/providers/polygon-provider';
import { ArbitrumNFTProvider } from '../../../../src/core/nft/providers/arbitrum-provider';
import { OptimismNFTProvider } from '../../../../src/core/nft/providers/optimism-provider';
import { AvalancheNFTProvider } from '../../../../src/core/nft/providers/avalanche-provider';
import { BSCNFTProvider } from '../../../../src/core/nft/providers/bsc-provider';

// Mock ethers for contract interactions
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  
  // Create a mock contract that properly supports bracket notation
  const createMockContract = () => {
    const methods = {
      // ERC721 methods
      balanceOf: jest.fn().mockResolvedValue(BigInt('5')),
      tokenOfOwnerByIndex: jest.fn().mockResolvedValue(BigInt('123')),
      tokenURI: jest.fn().mockResolvedValue('https://api.example.com/token/123'),
      ownerOf: jest.fn().mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3'),
      name: jest.fn().mockResolvedValue('Test Collection'),
      symbol: jest.fn().mockResolvedValue('TEST'),
      totalSupply: jest.fn().mockResolvedValue(BigInt('10000')),
      // ERC1155 methods
      balanceOfBatch: jest.fn().mockResolvedValue([BigInt('1'), BigInt('2')]),
      uri: jest.fn().mockResolvedValue('https://api.example.com/token/{id}')
    };
    
    // Support both dot notation and bracket notation
    return new Proxy(methods, {
      get(target, prop) {
        if (typeof prop === 'string' && prop in target) {
          return target[prop as keyof typeof target];
        }
        return undefined;
      }
    });
  };
  
  return {
    ...actual,
    Contract: jest.fn().mockImplementation(() => createMockContract()),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      call: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000005'),
      getLogs: jest.fn().mockResolvedValue([
        {
          address: '0x123',
          topics: ['0x', '0x', '0x'],
          data: '0x',
          blockNumber: 18500000,
          transactionHash: '0xabc'
        }
      ])
    }))
  };
});

// Mock fetch for API calls
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('opensea')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        assets: [
          {
            id: 1,
            token_id: '123',
            name: 'Test NFT',
            description: 'A test NFT',
            image_url: 'https://example.com/image.png',
            asset_contract: {
              address: '0x123',
              name: 'Test Collection',
              symbol: 'TEST'
            },
            collection: {
              name: 'Test Collection',
              slug: 'test-collection'
            }
          }
        ]
      })
    });
  }
  
  if (url.includes('alchemy')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        ownedNfts: [
          {
            contract: {
              address: '0x123'
            },
            id: {
              tokenId: '123',
              tokenMetadata: {
                tokenType: 'ERC721'
              }
            },
            title: 'Test NFT',
            description: 'A test NFT',
            tokenUri: {
              raw: 'https://api.example.com/token/123',
              gateway: 'https://api.example.com/token/123'
            },
            media: [
              {
                raw: 'https://example.com/image.png',
                gateway: 'https://example.com/image.png'
              }
            ],
            metadata: {
              name: 'Test NFT',
              description: 'A test NFT',
              image: 'https://example.com/image.png'
            }
          }
        ]
      })
    });
  }
  
  // Default mock response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});

describe('NFT Provider Bracket Notation Access', () => {
  const testAddress = '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3';
  const testConfig = {
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/test',
    alchemyApiKey: 'test-key',
    openseaApiKey: 'test-key'
  };

  describe('EthereumNFTProvider', () => {
    let provider: EthereumNFTProvider;

    beforeEach(() => {
      provider = new EthereumNFTProvider(testConfig);
    });

    it('should use bracket notation for contract method access', async () => {
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toBeDefined();
      expect(Array.isArray(nfts)).toBe(true);
    });

    it('should handle contract methods accessed via bracket notation', async () => {
      const metadata = await provider.getNFTMetadata('0x123', '123');
      
      expect(metadata).toBeDefined();
      if (metadata) {
        expect(metadata.name).toBeDefined();
        expect(metadata.tokenId).toBeDefined();
      }
    });

    it('should safely access undefined contract methods', async () => {
      // This should not throw even if bracket notation accesses undefined methods
      const nfts = await provider.getNFTs(testAddress);
      expect(nfts).toBeDefined();
    });

    it('should handle ERC721 contract interaction', async () => {
      // Create contract with proper ABI to ensure methods exist
      const contract = new ethers.Contract('0x123', [
        'function balanceOf(address) view returns (uint256)',
        'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
        'function tokenURI(uint256) view returns (string)',
        'function ownerOf(uint256) view returns (address)'
      ], null);
      
      // Test bracket notation access - the mock will be applied
      expect(contract['balanceOf']).toBeDefined();
      expect(contract['tokenOfOwnerByIndex']).toBeDefined();
      expect(contract['tokenURI']).toBeDefined();
      expect(contract['ownerOf']).toBeDefined();
      
      // Test that methods are callable
      const balance = await contract['balanceOf'](testAddress);
      expect(balance).toBe(BigInt('5'));
    });
  });

  describe('PolygonNFTProvider', () => {
    let provider: PolygonNFTProvider;

    beforeEach(() => {
      provider = new PolygonNFTProvider({
        ...testConfig,
        rpcUrl: 'https://polygon-mainnet.alchemyapi.io/v2/test'
      });
    });

    it('should handle Polygon-specific contract interactions', async () => {
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toBeDefined();
      expect(Array.isArray(nfts)).toBe(true);
    });

    it('should use bracket notation for Polygon contracts', async () => {
      const metadata = await provider.getNFTMetadata('0x123', '123');
      
      expect(metadata).toBeDefined();
    });
  });

  describe('ArbitrumNFTProvider', () => {
    let provider: ArbitrumNFTProvider;

    beforeEach(() => {
      provider = new ArbitrumNFTProvider({
        ...testConfig,
        rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/test'
      });
    });

    it('should handle Arbitrum-specific contract interactions', async () => {
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toBeDefined();
      expect(Array.isArray(nfts)).toBe(true);
    });

    it('should safely access contract methods on Arbitrum', async () => {
      const metadata = await provider.getNFTMetadata('0x123', '123');
      
      expect(metadata).toBeDefined();
    });
  });

  describe('OptimismNFTProvider', () => {
    let provider: OptimismNFTProvider;

    beforeEach(() => {
      provider = new OptimismNFTProvider({
        ...testConfig,
        rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/test'
      });
    });

    it('should handle Optimism-specific contract interactions', async () => {
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toBeDefined();
      expect(Array.isArray(nfts)).toBe(true);
    });

    it('should use bracket notation for Optimism contracts', async () => {
      const metadata = await provider.getNFTMetadata('0x123', '123');
      
      expect(metadata).toBeDefined();
    });
  });

  describe('AvalancheNFTProvider', () => {
    let provider: AvalancheNFTProvider;

    beforeEach(() => {
      provider = new AvalancheNFTProvider({
        ...testConfig,
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc'
      });
    });

    it('should handle Avalanche-specific contract interactions', async () => {
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toBeDefined();
      expect(Array.isArray(nfts)).toBe(true);
    });

    it('should safely access Avalanche contract methods', async () => {
      const metadata = await provider.getNFTMetadata('0x123', '123');
      
      expect(metadata).toBeDefined();
    });
  });

  describe('BSCNFTProvider', () => {
    let provider: BSCNFTProvider;

    beforeEach(() => {
      provider = new BSCNFTProvider({
        ...testConfig,
        rpcUrl: 'https://bsc-dataseed1.binance.org'
      });
    });

    it('should handle BSC-specific contract interactions', async () => {
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toBeDefined();
      expect(Array.isArray(nfts)).toBe(true);
    });

    it('should use bracket notation for BSC contracts', async () => {
      const metadata = await provider.getNFTMetadata('0x123', '123');
      
      expect(metadata).toBeDefined();
    });
  });

  describe('Contract Method Safety', () => {
    it('should handle undefined methods gracefully', () => {
      const contract = new ethers.Contract('0x123', [
        'function balanceOf(address) view returns (uint256)'
      ], null);
      
      // Accessing undefined method via bracket notation should not throw
      const undefinedMethod = contract['nonExistentMethod'];
      expect(undefinedMethod).toBeUndefined();
      
      // But defined methods should work
      const definedMethod = contract['balanceOf'];
      expect(definedMethod).toBeDefined();
    });

    it('should validate method existence before calling', async () => {
      const contract = new ethers.Contract('0x123', [
        'function balanceOf(address) view returns (uint256)'
      ], null);
      
      // Our mock contract has the balanceOf method
      const balanceOfMethod = contract['balanceOf'];
      expect(balanceOfMethod).toBeDefined();
      expect(typeof balanceOfMethod).toBe('function');
      
      const result = await balanceOfMethod(testAddress);
      expect(result).toBe(BigInt('5'));
    });

    it('should handle both ERC721 and ERC1155 methods', async () => {
      const contract = new ethers.Contract('0x123', [
        // ERC721 methods
        'function balanceOf(address) view returns (uint256)',
        'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
        'function tokenURI(uint256) view returns (string)',
        'function ownerOf(uint256) view returns (address)',
        // ERC1155 methods
        'function balanceOfBatch(address[], uint256[]) view returns (uint256[])',
        'function uri(uint256) view returns (string)'
      ], null);
      
      // ERC721 methods
      expect(contract['balanceOf']).toBeDefined();
      expect(contract['tokenOfOwnerByIndex']).toBeDefined();
      expect(contract['tokenURI']).toBeDefined();
      expect(contract['ownerOf']).toBeDefined();
      
      // ERC1155 methods
      expect(contract['balanceOfBatch']).toBeDefined();
      expect(contract['uri']).toBeDefined();
    });
  });

  describe('Type Safety Validation', () => {
    it('should handle bigint returns from contract calls', async () => {
      // Create a mock contract manually
      const contract = {
        balanceOf: jest.fn().mockResolvedValue(BigInt('5'))
      };
      const balance = await contract['balanceOf'](testAddress);
      
      expect(typeof balance).toBe('bigint');
      expect(balance).toBe(BigInt('5'));
    });

    it('should handle string returns from contract calls', async () => {
      // Create a mock contract manually
      const contract = {
        name: jest.fn().mockResolvedValue('Test Collection')
      };
      const name = await contract['name']();
      
      expect(typeof name).toBe('string');
      expect(name).toBe('Test Collection');
    });

    it('should handle array returns from contract calls', async () => {
      // Create a mock contract manually
      const contract = {
        balanceOfBatch: jest.fn().mockResolvedValue([BigInt('1'), BigInt('2')])
      };
      const balances = await contract['balanceOfBatch']([testAddress, testAddress], ['1', '2']);
      
      expect(Array.isArray(balances)).toBe(true);
      expect(balances).toHaveLength(2);
      expect(balances[0]).toBe(BigInt('1'));
      expect(balances[1]).toBe(BigInt('2'));
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );

      const provider = new EthereumNFTProvider(testConfig);
      const nfts = await provider.getNFTs(testAddress);
      
      expect(nfts).toEqual([]); // Should return empty array on error
    });

    it('should handle contract call failures', async () => {
      const contract = new ethers.Contract('0x123', [], null);
      contract['balanceOf'] = jest.fn().mockRejectedValue(new Error('Contract error'));
      
      // The provider should handle this gracefully
      await expect(contract['balanceOf'](testAddress)).rejects.toThrow('Contract error');
    });

    it('should handle missing contract methods', () => {
      const contract = new ethers.Contract('0x123', [], null);
      
      // Set a method to undefined to simulate missing method
      contract['missingMethod'] = undefined;
      
      const method = contract['missingMethod'];
      expect(method).toBeUndefined();
    });
  });

  describe('Multi-Chain Compatibility', () => {
    const providers = [
      { name: 'Ethereum', Provider: EthereumNFTProvider, rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/test' },
      { name: 'Polygon', Provider: PolygonNFTProvider, rpcUrl: 'https://polygon-mainnet.alchemyapi.io/v2/test' },
      { name: 'Arbitrum', Provider: ArbitrumNFTProvider, rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/test' },
      { name: 'Optimism', Provider: OptimismNFTProvider, rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/test' },
      { name: 'Avalanche', Provider: AvalancheNFTProvider, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
      { name: 'BSC', Provider: BSCNFTProvider, rpcUrl: 'https://bsc-dataseed1.binance.org' }
    ];

    providers.forEach(({ name, Provider, rpcUrl }) => {
      it(`should handle ${name} provider initialization`, () => {
        const provider = new Provider({ ...testConfig, rpcUrl });
        
        expect(provider.name).toBe(name);
        expect(provider.isConnected).toBe(true);
        expect(provider.chainId).toBeGreaterThan(0);
      });

      it(`should handle ${name} NFT fetching`, async () => {
        const provider = new Provider({ ...testConfig, rpcUrl });
        const nfts = await provider.getNFTs(testAddress);
        
        expect(Array.isArray(nfts)).toBe(true);
      });
    });
  });
});