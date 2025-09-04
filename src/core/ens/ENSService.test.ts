/**
 * Test suite for ENS Service
 */

import { ENSService } from './ENSService';
import { ContractManager } from '../contracts/ContractConfig';

// Mock the contract manager
jest.mock('../contracts/ContractConfig', () => ({
  ContractManager: {
    getInstance: jest.fn().mockReturnValue({
      getResolverContract: jest.fn().mockReturnValue({
        resolve: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
      }),
      getEthereumProvider: jest.fn().mockReturnValue({
        // Mock provider
      })
    })
  },
  ENS_CONFIG: {
    domain: 'omnibazaar.eth',
    subdomain: 'omnicoin.omnibazaar.eth',
    registryAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    resolverAddress: '0x1234567890123456789012345678901234567890'
  }
}));

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn((addr: string) => addr.startsWith('0x') && addr.length === 42),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    namehash: jest.fn((name: string) => '0x' + '1'.repeat(64)), // Mock namehash
    Contract: jest.fn().mockImplementation(() => ({
      resolver: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      addr: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890')
    }))
  }
}));

describe('ENSService', () => {
  let ensService: ENSService;

  beforeEach(() => {
    ensService = ENSService.getInstance();
  });

  describe('Address Resolution', () => {
    it('should resolve .omnicoin addresses', async () => {
      const address = await ensService.resolveAddress('alice.omnicoin');
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should resolve .eth addresses', async () => {
      const address = await ensService.resolveAddress('alice.eth');
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should return valid addresses unchanged', async () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      const address = await ensService.resolveAddress(validAddress);
      expect(address).toBe(validAddress);
    });

    it('should return null for invalid names', async () => {
      const address = await ensService.resolveAddress('invalid-name');
      expect(address).toBeNull();
    });
  });

  describe('Multi-chain Support', () => {
    it('should resolve addresses for different coin types', async () => {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 60); // ETH
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should resolve addresses for Polygon', async () => {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 966); // POL
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should resolve addresses for Arbitrum', async () => {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 60); // ARB uses ETH format
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should resolve addresses for Optimism', async () => {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 60); // OPT uses ETH format
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('Validation', () => {
    it('should validate ENS names correctly', () => {
      expect(ensService.isValidENSName('alice.eth')).toBe(true);
      expect(ensService.isValidENSName('alice.omnicoin')).toBe(true);
      expect(ensService.isValidENSName('alice.com')).toBe(false);
      expect(ensService.isValidENSName('alice')).toBe(false);
    });
  });

  describe('Format Address for Coin Type', () => {
    it('should format addresses correctly for EVM chains', () => {
      const service = ensService as any;
      const formatted = service.formatAddressForCoinType('0x1234567890123456789012345678901234567890', 60);
      expect(formatted).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should handle encoded addresses', () => {
      const service = ensService as any;
      const encoded = '0x000000000000000000000000' + '1234567890123456789012345678901234567890';
      const formatted = service.formatAddressForCoinType(encoded, 60);
      expect(formatted).toBe('0x1234567890123456789012345678901234567890');
    });
  });
});
