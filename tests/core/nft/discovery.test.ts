/**
 * NFT Discovery Service Tests
 * Tests multi-chain NFT discovery functionality
 */

import { NFTDiscoveryService } from '../../../src/core/nft/discovery';
import { Chain, NFTType } from '../../../src/core/nft/types';
import { TEST_ADDRESSES, MOCK_NFTS } from '../../setup';

// Mock fetch
global.fetch = jest.fn();

describe('NFTDiscoveryService', () => {
  let discoveryService: NFTDiscoveryService;

  beforeEach(() => {
    discoveryService = new NFTDiscoveryService();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('SimpleHash Integration', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nfts: [
            {
              nft_id: 'ethereum.0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D.1234',
              chain: 'ethereum',
              contract_address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
              token_id: '1234',
              name: 'Bored Ape #1234',
              description: 'A bored ape',
              image_url: 'https://example.com/image.png',
              collection: {
                name: 'Bored Ape Yacht Club',
                symbol: 'BAYC',
                description: 'BAYC Collection',
                image_url: 'https://example.com/collection.png',
                floor_prices: [
                  { value: 50.5, payment_token: { symbol: 'ETH' } }
                ]
              },
              owners: [{ owner_address: TEST_ADDRESSES.ethereum }],
              contract: { type: 'ERC721' },
              extra_metadata: {
                attributes: [
                  { trait_type: 'Background', value: 'Blue' },
                  { trait_type: 'Eyes', value: 'Laser' }
                ]
              }
            }
          ],
          next: null
        })
      });
    });

    it('should discover NFTs from SimpleHash', async () => {
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      
      expect(result.nfts).toHaveLength(1);
      expect(result.nfts[0].name).toBe('Bored Ape #1234');
      expect(result.nfts[0].collection?.name).toBe('Bored Ape Yacht Club');
      expect(result.nfts[0].contract?.type).toBe(NFTType.ERC721);
    });

    it('should include chain filter', async () => {
      await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum, {
        chains: ['ethereum', 'polygon']
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('chains=ethereum%2Cpolygon'),
        expect.any(Object)
      );
    });

    it('should handle pagination', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          nfts: MOCK_NFTS,
          next: 'cursor123'
        })
      });
      
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      
      expect(result.nextCursor).toBe('cursor123');
    });

    it('should include spam filter', async () => {
      await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum, {
        includeSpam: false
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('spam_score__lte=50'),
        expect.any(Object)
      );
    });

    it('should handle limit parameter', async () => {
      await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum, {
        limit: 100
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      );
    });

    it('should process NFT attributes', async () => {
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      
      expect(result.nfts[0].attributes).toHaveLength(2);
      expect(result.nfts[0].attributes![0]).toEqual({
        trait_type: 'Background',
        value: 'Blue'
      });
    });

    it('should include floor price', async () => {
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      
      expect(result.nfts[0].floor_price).toBe(50.5);
    });
  });

  describe('Solana NFT Discovery', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('helius')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              items: [
                {
                  id: 'DRmEK4sNGW2c4hRdEpN6Ld5tKnZwPMTLJLBvCKJvVPku',
                  content: {
                    metadata: {
                      name: 'DeGod #5678',
                      symbol: 'DGOD',
                      description: 'DeGods NFT'
                    },
                    links: {
                      image: 'https://example.com/degod.png'
                    }
                  },
                  grouping: [{
                    group_key: 'collection',
                    group_value: 'DeGods_Collection_Address'
                  }],
                  ownership: {
                    owner: TEST_ADDRESSES.solana
                  },
                  compression: {
                    compressed: false
                  }
                }
              ]
            })
          });
        }
        // Default SimpleHash response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ nfts: [], next: null })
        });
      });
    });

    it('should discover Solana NFTs from Helius', async () => {
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.solana, {
        chains: ['solana']
      });
      
      expect(result.nfts).toHaveLength(1);
      expect(result.nfts[0].name).toBe('DeGod #5678');
      expect(result.nfts[0].chain).toBe('solana');
    });

    it('should handle compressed Solana NFTs', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('helius')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              items: [{
                id: 'CompressedNFT123',
                content: {
                  metadata: { name: 'Compressed NFT' }
                },
                compression: { compressed: true }
              }]
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ nfts: [] })
        });
      });
      
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.solana, {
        chains: ['solana']
      });
      
      expect(result.nfts[0].contract?.type).toBe(NFTType.SolanaBGUM);
    });
  });

  describe('Multi-Chain Discovery', () => {
    it('should discover NFTs from multiple chains', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nfts: [
            { ...MOCK_NFTS[0], chain: 'ethereum' },
            { ...MOCK_NFTS[0], chain: 'polygon' },
            { ...MOCK_NFTS[0], chain: 'arbitrum' }
          ]
        })
      });
      
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum, {
        chains: ['ethereum', 'polygon', 'arbitrum']
      });
      
      expect(result.nfts).toHaveLength(3);
      const chains = result.nfts.map(n => n.chain);
      expect(chains).toContain('ethereum');
      expect(chains).toContain('polygon');
      expect(chains).toContain('arbitrum');
    });

    it('should merge results from multiple sources', async () => {
      const ethAddress = TEST_ADDRESSES.ethereum;
      const solAddress = TEST_ADDRESSES.solana;
      
      // Mock for addresses on different chains
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('wallet_addresses=' + ethAddress)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              nfts: [MOCK_NFTS[0]]
            })
          });
        }
        if (url.includes('helius')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              items: [{
                id: 'SolanaNFT',
                content: {
                  metadata: { name: 'Solana NFT' }
                }
              }]
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ nfts: [] })
        });
      });
      
      // Discover with mixed chain addresses
      const result = await discoveryService.discoverNFTs(ethAddress, {
        chains: ['ethereum', 'solana']
      });
      
      expect(result.nfts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(
        discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('Network error');
    });

    it('should handle non-OK responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });
      
      await expect(
        discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum)
      ).rejects.toThrow('SimpleHash API error: 429');
    });

    it('should handle malformed responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });
      
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      expect(result.nfts).toEqual([]);
    });
  });

  describe('Chain Support', () => {
    it('should support all advertised chains', () => {
      const supportedChains: Chain[] = [
        'ethereum', 'polygon', 'arbitrum', 'optimism', 'base',
        'avalanche', 'bsc', 'fantom', 'gnosis', 'klaytn',
        'moonbeam', 'moonriver', 'palm', 'celo', 'scroll',
        'linea', 'lukso', 'manta', 'mantle', 'solana'
      ];
      
      supportedChains.forEach(chain => {
        expect(() => {
          discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum, {
            chains: [chain]
          });
        }).not.toThrow();
      });
    });
  });

  describe('NFT Type Detection', () => {
    it('should detect ERC721 NFTs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nfts: [{
            ...MOCK_NFTS[0],
            contract: { type: 'ERC721' }
          }]
        })
      });
      
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      expect(result.nfts[0].contract?.type).toBe(NFTType.ERC721);
    });

    it('should detect ERC1155 NFTs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nfts: [{
            ...MOCK_NFTS[0],
            contract: { type: 'ERC1155' }
          }]
        })
      });
      
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      expect(result.nfts[0].contract?.type).toBe(NFTType.ERC1155);
    });
  });

  describe('Performance', () => {
    it('should handle large NFT collections', async () => {
      const largeCollection = Array(1000).fill(null).map((_, i) => ({
        ...MOCK_NFTS[0],
        token_id: i.toString(),
        name: `NFT #${i}`
      }));
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nfts: largeCollection
        })
      });
      
      const startTime = Date.now();
      const result = await discoveryService.discoverNFTs(TEST_ADDRESSES.ethereum);
      const endTime = Date.now();
      
      expect(result.nfts).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should process in under 1 second
    });
  });
});