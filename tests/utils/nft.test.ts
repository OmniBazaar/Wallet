import { describe, it, expect } from 'vitest';
import {
  formatNFTName,
  formatNFTPrice,
  generateNFTThumbnail,
  getFallbackIPFSUrl,
  validateNFTMetadata,
  parseTokenURI,
  extractNFTAttributes,
  calculateRarityScore,
  formatTokenId
} from '../../src/utils/nft';

describe('NFT Utilities', () => {
  describe('formatNFTName', () => {
    it('should use name when provided', () => {
      expect(formatNFTName('Cool NFT', '123')).toBe('Cool NFT');
    });

    it('should truncate long names', () => {
      const longName = 'A'.repeat(60);
      const result = formatNFTName(longName, '123');
      expect(result).toBe('A'.repeat(47) + '...');
    });

    it('should use token ID when name is empty', () => {
      expect(formatNFTName('', '123')).toBe('Token #123');
      expect(formatNFTName(undefined, '456')).toBe('Token #456');
    });

    it('should format long token IDs', () => {
      const longId = '12345678901234567890';
      expect(formatNFTName(undefined, longId)).toBe('Token #123456...7890');
    });
  });

  describe('formatNFTPrice', () => {
    it('should format zero price', () => {
      expect(formatNFTPrice('0', 'ETH')).toBe('0 ETH');
      expect(formatNFTPrice(BigInt(0), 'ETH')).toBe('0 ETH');
    });

    it('should format very small prices', () => {
      const smallPrice = '1000000000000'; // 0.000001 ETH
      expect(formatNFTPrice(smallPrice, 'ETH')).toBe('0.0000 ETH');
    });

    it('should format small prices with proper decimals', () => {
      const price = '500000000000000000'; // 0.5 ETH
      expect(formatNFTPrice(price, 'ETH')).toBe('0.5000 ETH');
    });

    it('should format regular prices', () => {
      const price = '1500000000000000000'; // 1.5 ETH
      expect(formatNFTPrice(price, 'ETH')).toBe('1.50 ETH');
    });

    it('should format large prices with thousands separator', () => {
      const price = '5000000000000000000000'; // 5000 ETH
      expect(formatNFTPrice(price, 'ETH')).toBe('5,000 ETH');
    });

    it('should handle different decimals', () => {
      const price = '1000000'; // 1 USDC (6 decimals)
      expect(formatNFTPrice(price, 'USDC', 6)).toBe('1.00 USDC');
    });

    it('should handle error gracefully', () => {
      expect(formatNFTPrice('invalid', 'ETH')).toBe('invalid ETH');
    });
  });

  describe('generateNFTThumbnail', () => {
    it('should return placeholder for empty URL', () => {
      expect(generateNFTThumbnail('')).toBe('/images/nft-placeholder.png');
    });

    it('should handle IPFS URLs', () => {
      const ipfsUrl = 'ipfs://QmXxx123';
      expect(generateNFTThumbnail(ipfsUrl)).toBe('https://gateway.pinata.cloud/ipfs/QmXxx123');
    });

    it('should handle Arweave URLs', () => {
      const arUrl = 'ar://xxx-yyy-zzz';
      expect(generateNFTThumbnail(arUrl)).toBe('https://arweave.net/xxx-yyy-zzz');
    });

    it('should handle HTTP URLs', () => {
      const httpUrl = 'https://example.com/image.png';
      expect(generateNFTThumbnail(httpUrl)).toBe(httpUrl);
    });

    it('should handle OpenSea thumbnails with size', () => {
      const openSeaUrl = 'https://opensea.io/image.png?w=500';
      expect(generateNFTThumbnail(openSeaUrl, 250)).toBe('https://opensea.io/image.png?w=250');
    });
  });

  describe('getFallbackIPFSUrl', () => {
    it('should return next gateway URL', () => {
      const url = 'https://gateway.pinata.cloud/ipfs/QmXxx123';
      const result = getFallbackIPFSUrl(url, 0);
      expect(result).toBe('https://ipfs.io/ipfs/QmXxx123');
    });

    it('should return null when no more gateways', () => {
      const url = 'https://gateway.ipfs.io/ipfs/QmXxx123';
      expect(getFallbackIPFSUrl(url, 3)).toBeNull();
    });

    it('should handle invalid URLs', () => {
      expect(getFallbackIPFSUrl('invalid-url', 0)).toBeNull();
    });
  });

  describe('validateNFTMetadata', () => {
    it('should validate valid metadata', () => {
      const metadata = {
        name: 'Test NFT',
        description: 'A test NFT',
        image: 'https://example.com/image.png',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Size', value: 10 }
        ]
      };
      expect(validateNFTMetadata(metadata)).toBe(true);
    });

    it('should accept title instead of name', () => {
      const metadata = {
        title: 'Test NFT',
        image: 'https://example.com/image.png'
      };
      expect(validateNFTMetadata(metadata)).toBe(true);
    });

    it('should reject invalid metadata', () => {
      expect(validateNFTMetadata(null)).toBe(false);
      expect(validateNFTMetadata(undefined)).toBe(false);
      expect(validateNFTMetadata(123)).toBe(false);
      expect(validateNFTMetadata({})).toBe(false);
    });

    it('should reject metadata with invalid attributes', () => {
      const metadata = {
        name: 'Test',
        attributes: 'not an array'
      };
      expect(validateNFTMetadata(metadata)).toBe(false);
    });

    it('should reject attributes missing required fields', () => {
      const metadata = {
        name: 'Test',
        attributes: [
          { trait_type: 'Color' }, // Missing value
          { value: 'Blue' } // Missing trait_type
        ]
      };
      expect(validateNFTMetadata(metadata)).toBe(false);
    });
  });

  describe('parseTokenURI', () => {
    it('should throw on empty URI', () => {
      expect(() => parseTokenURI('')).toThrow('Token URI is empty');
    });

    it('should handle data URIs', () => {
      const dataUri = 'data:application/json;base64,eyJuYW1lIjoiVGVzdCJ9';
      expect(parseTokenURI(dataUri)).toBe(dataUri);
    });

    it('should handle IPFS URIs', () => {
      expect(parseTokenURI('ipfs://QmXxx123')).toBe('https://gateway.pinata.cloud/ipfs/QmXxx123');
    });

    it('should handle Arweave URIs', () => {
      expect(parseTokenURI('ar://xxx-yyy')).toBe('https://arweave.net/xxx-yyy');
    });

    it('should handle HTTP(S) URIs', () => {
      const httpUri = 'https://api.example.com/metadata/123';
      expect(parseTokenURI(httpUri)).toBe(httpUri);
    });
  });

  describe('extractNFTAttributes', () => {
    it('should extract valid attributes', () => {
      const metadata = {
        name: 'Test',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Size', value: 10 },
          { trait_type: 'Rarity', value: 'Common' }
        ]
      };
      
      const result = extractNFTAttributes(metadata as any);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ trait_type: 'Color', value: 'Blue' });
    });

    it('should handle missing attributes', () => {
      const metadata = { name: 'Test' };
      expect(extractNFTAttributes(metadata as any)).toEqual([]);
    });

    it('should filter invalid attributes', () => {
      const metadata = {
        name: 'Test',
        attributes: [
          { trait_type: 'Valid', value: 'Yes' },
          { invalid: true },
          null,
          { trait_type: 'Missing value' }
        ]
      };
      
      const result = extractNFTAttributes(metadata as any);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ trait_type: 'Valid', value: 'Yes' });
    });
  });

  describe('calculateRarityScore', () => {
    it('should calculate rarity score correctly', () => {
      const attributes = [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Size', value: 'Large' }
      ];
      
      const collectionStats = new Map([
        ['Color', new Map([['Blue', 10], ['Red', 90]])],
        ['Size', new Map([['Large', 5], ['Small', 95]])]
      ]);
      
      // Blue: 1 - (10/100) = 0.9 rarity
      // Large: 1 - (5/100) = 0.95 rarity
      // Average: (0.9 + 0.95) / 2 = 0.925 = 93%
      const score = calculateRarityScore(attributes, collectionStats);
      expect(score).toBe(93);
    });

    it('should return default score for empty attributes', () => {
      expect(calculateRarityScore([], new Map())).toBe(50);
    });

    it('should handle missing trait types', () => {
      const attributes = [
        { trait_type: 'Unknown', value: 'Value' }
      ];
      const score = calculateRarityScore(attributes, new Map());
      expect(score).toBe(50);
    });
  });

  describe('formatTokenId', () => {
    it('should format short token IDs', () => {
      expect(formatTokenId('123')).toBe('123');
      expect(formatTokenId(456)).toBe('456');
    });

    it('should add commas for readability', () => {
      expect(formatTokenId('1234')).toBe('1,234');
      expect(formatTokenId('1234567')).toBe('1,234,567');
    });

    it('should truncate very long token IDs', () => {
      const longId = '12345678901234567890';
      expect(formatTokenId(longId)).toBe('1234...7890');
    });
  });
});