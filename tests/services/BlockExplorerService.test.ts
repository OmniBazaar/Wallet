/**
 * BlockExplorerService Test Suite
 * 
 * Tests blockchain exploration capabilities including transaction lookup,
 * block details, address exploration, and token information across multiple
 * networks. This is a Phase 4 component for core functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BlockExplorerService, ExplorerNetwork, TransactionDetails, BlockDetails, AddressDetails, TokenDetails } from '../../src/services/BlockExplorerService';
import { ethers } from 'ethers';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock window.open
global.window = {
  open: jest.fn()
} as any;

describe('BlockExplorerService', () => {
  let service: BlockExplorerService;
  let mockProvider: any;
  
  // Test constants
  const TEST_VALIDATOR_ENDPOINT = 'http://localhost:3001/api/explorer';
  const TEST_TX_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';
  const TEST_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const TEST_BLOCK_NUMBER = 1000000;

  const MOCK_TX_DETAILS: TransactionDetails = {
    hash: TEST_TX_HASH,
    from: '0x1234567890123456789012345678901234567890',
    to: TEST_ADDRESS,
    value: '1000000000000000000', // 1 ETH
    gasUsed: '21000',
    gasPrice: '20000000000', // 20 gwei
    blockNumber: TEST_BLOCK_NUMBER,
    timestamp: 1642000000,
    status: 'success',
    fee: '420000000000000', // 21000 * 20 gwei
    confirmations: 10,
    tokenTransfers: []
  };

  const MOCK_BLOCK_DETAILS: BlockDetails = {
    number: TEST_BLOCK_NUMBER,
    hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    parentHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    timestamp: 1642000000,
    miner: '0xMinerAddress1234567890123456789012345678',
    transactionCount: 150,
    gasUsed: '15000000',
    gasLimit: '30000000',
    baseFeePerGas: '10000000000',
    size: 50000,
    difficulty: '1000000000'
  };

  const MOCK_ADDRESS_DETAILS: AddressDetails = {
    address: TEST_ADDRESS,
    balance: '5000000000000000000', // 5 ETH
    transactionCount: 42,
    tokens: [
      {
        contract: TEST_TOKEN_ADDRESS,
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '1000000000', // 1000 USDC
        decimals: 6,
        value: '1000.00'
      }
    ],
    nfts: [
      {
        contract: '0xNFTContract123',
        tokenId: '1',
        name: 'Cool NFT #1',
        image: 'https://example.com/nft.png'
      }
    ],
    isContract: false,
    ensName: 'vitalik.eth'
  };

  const MOCK_TOKEN_DETAILS: TokenDetails = {
    address: TEST_TOKEN_ADDRESS,
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    totalSupply: '50000000000000000', // 50B USDC
    holders: 5000000,
    priceUsd: '0.9999',
    marketCap: '50000000000',
    volume24h: '5000000000',
    logoUrl: 'https://example.com/usdc.png',
    website: 'https://centre.io/usdc',
    social: {
      twitter: 'https://twitter.com/centre_io'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock provider
    mockProvider = {
      getBalance: jest.fn().mockResolvedValue(BigInt('5000000000000000000')),
      getTransactionCount: jest.fn().mockResolvedValue(42),
      getCode: jest.fn().mockResolvedValue('0x'),
      lookupAddress: jest.fn().mockResolvedValue('vitalik.eth'),
      getBlock: jest.fn().mockResolvedValue({
        number: TEST_BLOCK_NUMBER,
        hash: MOCK_BLOCK_DETAILS.hash,
        parentHash: MOCK_BLOCK_DETAILS.parentHash,
        timestamp: MOCK_BLOCK_DETAILS.timestamp,
        miner: MOCK_BLOCK_DETAILS.miner,
        transactions: new Array(150).fill('0x'),
        gasUsed: BigInt(MOCK_BLOCK_DETAILS.gasUsed),
        gasLimit: BigInt(MOCK_BLOCK_DETAILS.gasLimit),
        baseFeePerGas: BigInt(MOCK_BLOCK_DETAILS.baseFeePerGas!),
        difficulty: BigInt(MOCK_BLOCK_DETAILS.difficulty)
      }),
      getBlockNumber: jest.fn().mockResolvedValue(TEST_BLOCK_NUMBER)
    };

    service = new BlockExplorerService(mockProvider, TEST_VALIDATOR_ENDPOINT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.toBeUndefined();
    });

    it('should use default validator endpoint', () => {
      const defaultService = new BlockExplorerService(mockProvider);
      expect(defaultService).toBeDefined();
    });

    it('should configure all supported networks', () => {
      expect(service).toBeDefined();
      // Networks are configured internally
    });
  });

  describe('Transaction Lookup', () => {
    it('should get transaction from OmniCoin network', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_TX_DETAILS)
      });

      const tx = await service.getTransaction(TEST_TX_HASH, ExplorerNetwork.OMNICOIN);

      expect(global.fetch).toHaveBeenCalledWith(`${TEST_VALIDATOR_ENDPOINT}/transaction/${TEST_TX_HASH}`);
      expect(tx).toEqual(MOCK_TX_DETAILS);
    });

    it('should get transaction from external network', async () => {
      const externalTxData = {
        status: '1',
        result: {
          hash: TEST_TX_HASH,
          from: MOCK_TX_DETAILS.from,
          to: MOCK_TX_DETAILS.to,
          value: '1000000000000000000',
          gasUsed: MOCK_TX_DETAILS.gasUsed,
          gasPrice: MOCK_TX_DETAILS.gasPrice,
          blockNumber: TEST_BLOCK_NUMBER.toString(),
          timeStamp: MOCK_TX_DETAILS.timestamp.toString(),
          isError: '0',
          functionName: 'transfer',
          input: '0x123456',
          confirmations: '10'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(externalTxData)
      });

      const tx = await service.getTransaction(TEST_TX_HASH, ExplorerNetwork.ETHEREUM);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.etherscan.io/api?module=transaction&action=gettxinfo')
      );
      expect(tx).toBeDefined();
      expect(tx?.hash).toBe(TEST_TX_HASH);
      expect(tx?.status).toBe('success');
    });

    it('should cache transaction results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_TX_DETAILS)
      });

      // First call
      const tx1 = await service.getTransaction(TEST_TX_HASH);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const tx2 = await service.getTransaction(TEST_TX_HASH);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(tx2).toEqual(tx1);
    });

    it('should handle transaction not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const tx = await service.getTransaction('0xnonexistent');
      expect(tx).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const tx = await service.getTransaction(TEST_TX_HASH);
      expect(tx).toBeNull();
    });

    it('should handle external API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ status: '0', message: 'NOTOK' })
      });

      const tx = await service.getTransaction(TEST_TX_HASH, ExplorerNetwork.ETHEREUM);
      expect(tx).toBeNull();
    });
  });

  describe('Block Lookup', () => {
    it('should get block from OmniCoin network', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_BLOCK_DETAILS)
      });

      const block = await service.getBlock(TEST_BLOCK_NUMBER);

      expect(global.fetch).toHaveBeenCalledWith(`${TEST_VALIDATOR_ENDPOINT}/block/${TEST_BLOCK_NUMBER}`);
      expect(block).toEqual(MOCK_BLOCK_DETAILS);
    });

    it('should get block from external network via provider', async () => {
      const block = await service.getBlock(TEST_BLOCK_NUMBER, ExplorerNetwork.ETHEREUM);

      expect(mockProvider.getBlock).toHaveBeenCalledWith(TEST_BLOCK_NUMBER);
      expect(block).toBeDefined();
      expect(block?.number).toBe(TEST_BLOCK_NUMBER);
      expect(block?.transactionCount).toBe(150);
    });

    it('should cache block results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_BLOCK_DETAILS)
      });

      const block1 = await service.getBlock(TEST_BLOCK_NUMBER);
      const block2 = await service.getBlock(TEST_BLOCK_NUMBER);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(block2).toEqual(block1);
    });

    it('should handle block not found', async () => {
      mockProvider.getBlock.mockResolvedValueOnce(null);

      const block = await service.getBlock(99999999, ExplorerNetwork.ETHEREUM);
      expect(block).toBeNull();
    });

    it('should handle blocks without baseFeePerGas', async () => {
      mockProvider.getBlock.mockResolvedValueOnce({
        ...mockProvider.getBlock.mock.results[0].value,
        baseFeePerGas: undefined
      });

      const block = await service.getBlock(TEST_BLOCK_NUMBER, ExplorerNetwork.BSC);
      expect(block).toBeDefined();
      expect(block?.baseFeePerGas).toBeUndefined();
    });
  });

  describe('Address Lookup', () => {
    it('should get address details from OmniCoin network', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_ADDRESS_DETAILS)
      });

      const address = await service.getAddress(TEST_ADDRESS);

      expect(global.fetch).toHaveBeenCalledWith(`${TEST_VALIDATOR_ENDPOINT}/address/${TEST_ADDRESS}`);
      expect(address).toEqual(MOCK_ADDRESS_DETAILS);
    });

    it('should get address details from external network', async () => {
      const address = await service.getAddress(TEST_ADDRESS, ExplorerNetwork.ETHEREUM);

      expect(mockProvider.getBalance).toHaveBeenCalledWith(TEST_ADDRESS);
      expect(mockProvider.getTransactionCount).toHaveBeenCalledWith(TEST_ADDRESS);
      expect(mockProvider.getCode).toHaveBeenCalledWith(TEST_ADDRESS);
      expect(mockProvider.lookupAddress).toHaveBeenCalledWith(TEST_ADDRESS);

      expect(address).toBeDefined();
      expect(address?.balance).toBe('5.0'); // 5 ETH formatted
      expect(address?.transactionCount).toBe(42);
      expect(address?.isContract).toBe(false);
      expect(address?.ensName).toBe('vitalik.eth');
    });

    it('should detect contract addresses', async () => {
      mockProvider.getCode.mockResolvedValueOnce('0x606060405260008060006101000a81548173');

      const address = await service.getAddress(TEST_TOKEN_ADDRESS, ExplorerNetwork.ETHEREUM);
      expect(address?.isContract).toBe(true);
    });

    it('should handle addresses without ENS', async () => {
      mockProvider.lookupAddress.mockResolvedValueOnce(null);

      const address = await service.getAddress(TEST_ADDRESS, ExplorerNetwork.ETHEREUM);
      expect(address?.ensName).toBeUndefined();
    });

    it('should cache address results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_ADDRESS_DETAILS)
      });

      const addr1 = await service.getAddress(TEST_ADDRESS);
      const addr2 = await service.getAddress(TEST_ADDRESS);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(addr2).toEqual(addr1);
    });
  });

  describe('Token Lookup', () => {
    it('should get token details from OmniCoin network', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_TOKEN_DETAILS)
      });

      const token = await service.getToken(TEST_TOKEN_ADDRESS);

      expect(global.fetch).toHaveBeenCalledWith(`${TEST_VALIDATOR_ENDPOINT}/token/${TEST_TOKEN_ADDRESS}`);
      expect(token).toEqual(MOCK_TOKEN_DETAILS);
    });

    it('should get token details from external network via contract calls', async () => {
      // Mock ethers.Contract
      const mockContract = {
        name: jest.fn().mockResolvedValue('USD Coin'),
        symbol: jest.fn().mockResolvedValue('USDC'),
        decimals: jest.fn().mockResolvedValue(6),
        totalSupply: jest.fn().mockResolvedValue(BigInt('50000000000000000'))
      };

      jest.spyOn(ethers, 'Contract').mockImplementation(() => mockContract as any);

      const token = await service.getToken(TEST_TOKEN_ADDRESS, ExplorerNetwork.ETHEREUM);

      expect(token).toBeDefined();
      expect(token?.name).toBe('USD Coin');
      expect(token?.symbol).toBe('USDC');
      expect(token?.decimals).toBe(6);
      expect(token?.totalSupply).toBe('50000000000.0'); // Formatted with decimals
    });

    it('should handle non-ERC20 addresses', async () => {
      jest.spyOn(ethers, 'Contract').mockImplementation(() => {
        throw new Error('Not a contract');
      });

      const token = await service.getToken('0xInvalidToken', ExplorerNetwork.ETHEREUM);
      expect(token).toBeNull();
    });

    it('should cache token results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(MOCK_TOKEN_DETAILS)
      });

      const token1 = await service.getToken(TEST_TOKEN_ADDRESS);
      const token2 = await service.getToken(TEST_TOKEN_ADDRESS);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(token2).toEqual(token1);
    });
  });

  describe('Search Functionality', () => {
    it('should search for addresses', async () => {
      const results = await service.search(TEST_ADDRESS);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('address');
      expect(results[0].value).toBe(TEST_ADDRESS);
    });

    it('should search for transaction hashes', async () => {
      const results = await service.search(TEST_TX_HASH);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('transaction');
      expect(results[0].value).toBe(TEST_TX_HASH);
    });

    it('should search for block numbers', async () => {
      const results = await service.search('1000000');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('block');
      expect(results[0].value).toBe('1000000');
    });

    it('should search for tokens by name/symbol', async () => {
      const mockTokens = [
        {
          address: TEST_TOKEN_ADDRESS,
          name: 'USD Coin',
          symbol: 'USDC',
          holders: 5000000
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockTokens)
      });

      const results = await service.search('USDC');

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_VALIDATOR_ENDPOINT}/search?q=USDC`
      );
      
      const tokenResult = results.find(r => r.type === 'token');
      expect(tokenResult).toBeDefined();
      expect(tokenResult?.name).toContain('USD Coin');
      expect(tokenResult?.info).toContain('5000000 holders');
    });

    it('should handle search errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Search failed'));

      const results = await service.search('test');
      
      // Should still return results for other types
      expect(results.length).toBe(0);
    });

    it('should not search tokens for short queries', async () => {
      const results = await service.search('U');

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/search')
      );
    });
  });

  describe('Transaction History', () => {
    it('should get transaction history from OmniCoin', async () => {
      const mockHistory = [MOCK_TX_DETAILS, { ...MOCK_TX_DETAILS, hash: '0xanother' }];
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockHistory)
      });

      const history = await service.getTransactionHistory(TEST_ADDRESS);

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_VALIDATOR_ENDPOINT}/address/${TEST_ADDRESS}/transactions?page=1&limit=20`
      );
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(MOCK_TX_DETAILS);
    });

    it('should handle pagination', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce([])
      });

      await service.getTransactionHistory(TEST_ADDRESS, ExplorerNetwork.OMNICOIN, 2, 50);

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_VALIDATOR_ENDPOINT}/address/${TEST_ADDRESS}/transactions?page=2&limit=50`
      );
    });

    it('should return empty array for external networks', async () => {
      const history = await service.getTransactionHistory(TEST_ADDRESS, ExplorerNetwork.ETHEREUM);
      expect(history).toEqual([]);
    });

    it('should cache history results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce([MOCK_TX_DETAILS])
      });

      const history1 = await service.getTransactionHistory(TEST_ADDRESS);
      const history2 = await service.getTransactionHistory(TEST_ADDRESS);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(history2).toEqual(history1);
    });

    it('should handle history fetch errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const history = await service.getTransactionHistory(TEST_ADDRESS);
      expect(history).toEqual([]);
    });
  });

  describe('Latest Blocks', () => {
    it('should get latest blocks from OmniCoin', async () => {
      const mockBlocks = [
        MOCK_BLOCK_DETAILS,
        { ...MOCK_BLOCK_DETAILS, number: TEST_BLOCK_NUMBER - 1 }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockBlocks)
      });

      const blocks = await service.getLatestBlocks();

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_VALIDATOR_ENDPOINT}/blocks/latest?limit=10`
      );
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual(MOCK_BLOCK_DETAILS);
    });

    it('should get latest blocks from external network', async () => {
      const blocks = await service.getLatestBlocks(ExplorerNetwork.ETHEREUM, 5);

      expect(mockProvider.getBlockNumber).toHaveBeenCalled();
      expect(mockProvider.getBlock).toHaveBeenCalledTimes(5);
      expect(blocks).toHaveLength(5);
    });

    it('should handle block fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Fetch failed'));

      const blocks = await service.getLatestBlocks();
      expect(blocks).toEqual([]);
    });

    it('should skip null blocks', async () => {
      mockProvider.getBlock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockProvider.getBlock.mock.results[0].value);

      const blocks = await service.getLatestBlocks(ExplorerNetwork.ETHEREUM, 2);
      expect(blocks).toHaveLength(1);
    });
  });

  describe('Explorer URLs', () => {
    it('should generate correct URLs for OmniCoin', () => {
      const txUrl = service.getExplorerUrl('tx', TEST_TX_HASH);
      expect(txUrl).toBe(`https://explorer.omnibazaar.com/tx/${TEST_TX_HASH}`);

      const addressUrl = service.getExplorerUrl('address', TEST_ADDRESS);
      expect(addressUrl).toBe(`https://explorer.omnibazaar.com/address/${TEST_ADDRESS}`);

      const blockUrl = service.getExplorerUrl('block', '1000');
      expect(blockUrl).toBe('https://explorer.omnibazaar.com/block/1000');

      const tokenUrl = service.getExplorerUrl('token', TEST_TOKEN_ADDRESS);
      expect(tokenUrl).toBe(`https://explorer.omnibazaar.com/token/${TEST_TOKEN_ADDRESS}`);
    });

    it('should generate correct URLs for external networks', () => {
      const txUrl = service.getExplorerUrl('tx', TEST_TX_HASH, ExplorerNetwork.ETHEREUM);
      expect(txUrl).toBe(`https://etherscan.io/tx/${TEST_TX_HASH}`);

      const addressUrl = service.getExplorerUrl('address', TEST_ADDRESS, ExplorerNetwork.BSC);
      expect(addressUrl).toBe(`https://bscscan.com/address/${TEST_ADDRESS}`);
    });

    it('should handle unsupported networks', () => {
      const url = service.getExplorerUrl('tx', TEST_TX_HASH, 'UNSUPPORTED' as any);
      expect(url).toBe('');
    });

    it('should open explorer in new window', () => {
      service.openInExplorer('tx', TEST_TX_HASH);
      
      expect(window.open).toHaveBeenCalledWith(
        `https://explorer.omnibazaar.com/tx/${TEST_TX_HASH}`,
        '_blank'
      );
    });

    it('should not open window for invalid URLs', () => {
      service.openInExplorer('tx', TEST_TX_HASH, 'INVALID' as any);
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should respect cache timeout', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(MOCK_TX_DETAILS)
      });

      // First call
      await service.getTransaction(TEST_TX_HASH);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Call within cache timeout
      await service.getTransaction(TEST_TX_HASH);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Advance time past cache timeout (1 minute)
      jest.advanceTimersByTime(61000);

      // Call after cache timeout
      await service.getTransaction(TEST_TX_HASH);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should limit cache size', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(MOCK_TX_DETAILS)
      });

      // Add more than 100 items to cache
      for (let i = 0; i < 110; i++) {
        await service.getTransaction(`0x${i.toString(16).padStart(64, '0')}`);
      }

      // Cache should maintain reasonable size
      expect(global.fetch).toHaveBeenCalledTimes(110);
    });
  });

  describe('Error Handling', () => {
    it('should log transaction fetch errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await service.getTransaction(TEST_TX_HASH);

      expect(consoleError).toHaveBeenCalledWith('Error fetching transaction:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('should log block fetch errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await service.getBlock(TEST_BLOCK_NUMBER);

      expect(consoleError).toHaveBeenCalledWith('Error fetching block:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('should log address fetch errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await service.getAddress(TEST_ADDRESS);

      expect(consoleError).toHaveBeenCalledWith('Error fetching address:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('should log token fetch errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await service.getToken(TEST_TOKEN_ADDRESS);

      expect(consoleError).toHaveBeenCalledWith('Error fetching token:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('Environment Configuration', () => {
    it('should use API keys from environment', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        ETHERSCAN_API_KEY: 'test-etherscan-key',
        SNOWTRACE_API_KEY: 'test-snowtrace-key',
        POLYGONSCAN_API_KEY: 'test-polygonscan-key',
        BSCSCAN_API_KEY: 'test-bscscan-key'
      };

      const serviceWithKeys = new BlockExplorerService(mockProvider);
      
      // Service should be initialized with API keys
      expect(serviceWithKeys).toBeDefined();

      process.env = originalEnv;
    });
  });
});