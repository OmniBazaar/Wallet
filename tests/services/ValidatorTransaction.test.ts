/**
 * Tests for ValidatorTransaction Service
 * 
 * Tests the critical transaction processing functionality including
 * transaction submission, monitoring, batch operations, and gas estimation.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ValidatorTransaction } from '../../src/services/ValidatorTransaction';
import type { 
  Transaction, 
  TransactionStatus,
  TransactionReceipt,
  GasEstimate,
  FeeData
} from '../../src/services/ValidatorTransaction';
import type { TransactionRequest } from '@ethersproject/abstract-provider';

// Mock dependencies
jest.mock('../../src/services/AvalancheValidatorClient');
jest.mock('../../src/utils/logger');

const mockAvalancheClient = {
  sendTransaction: jest.fn(),
  getTransaction: jest.fn(),
  getTransactionReceipt: jest.fn(),
  estimateGas: jest.fn(),
  getFeeData: jest.fn(),
  getTransactionCount: jest.fn(),
  getBalance: jest.fn(),
  getBlock: jest.fn(),
  sendBatch: jest.fn(),
  waitForTransaction: jest.fn()
};

// Mock ethers utilities
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  utils: {
    ...jest.requireActual('ethers').utils,
    parseEther: jest.fn((value) => ({ toString: () => (parseFloat(value) * 1e18).toString() })),
    formatEther: jest.fn((value) => (BigInt(value) / BigInt(1e18)).toString()),
    parseUnits: jest.fn((value, decimals) => ({ toString: () => (parseFloat(value) * Math.pow(10, decimals)).toString() })),
    formatUnits: jest.fn((value, decimals) => (BigInt(value) / BigInt(Math.pow(10, decimals))).toString()),
    hexlify: jest.fn((value) => '0x' + value.toString(16)),
    hexValue: jest.fn((value) => '0x' + parseInt(value).toString(16)),
    id: jest.fn((text) => '0x' + Array(64).fill('0').join('')),
    keccak256: jest.fn(() => '0x' + Array(64).fill('a').join('')),
    toUtf8Bytes: jest.fn((str) => new Uint8Array(Buffer.from(str, 'utf8'))),
    isAddress: jest.fn((addr) => /^0x[a-fA-F0-9]{40}$/.test(addr))
  },
  providers: {
    TransactionReceipt: class {},
    TransactionResponse: class {}
  },
  BigNumber: {
    from: jest.fn((value) => ({ 
      toString: () => value.toString(),
      toHexString: () => '0x' + parseInt(value).toString(16),
      mul: jest.fn((other) => ({ toString: () => (BigInt(value) * BigInt(other)).toString() })),
      div: jest.fn((other) => ({ toString: () => (BigInt(value) / BigInt(other)).toString() })),
      add: jest.fn((other) => ({ toString: () => (BigInt(value) + BigInt(other)).toString() })),
      sub: jest.fn((other) => ({ toString: () => (BigInt(value) - BigInt(other)).toString() })),
      gt: jest.fn((other) => BigInt(value) > BigInt(other)),
      lt: jest.fn((other) => BigInt(value) < BigInt(other)),
      gte: jest.fn((other) => BigInt(value) >= BigInt(other)),
      lte: jest.fn((other) => BigInt(value) <= BigInt(other)),
      eq: jest.fn((other) => BigInt(value) === BigInt(other))
    }))
  }
}));

describe('ValidatorTransaction', () => {
  let service: ValidatorTransaction;
  let mockDate: number;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Date.now()
    mockDate = 1234567890000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);
    
    // Mock crypto.randomUUID
    const mockUUID = jest.fn(() => 'mock-uuid-1234');
    Object.defineProperty(global, 'crypto', {
      value: { randomUUID: mockUUID },
      writable: true
    });

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

    // Mock AvalancheValidatorClient
    jest.mock('../../src/services/AvalancheValidatorClient', () => ({
      AvalancheValidatorClient: jest.fn().mockImplementation(() => mockAvalancheClient)
    }));

    service = new ValidatorTransaction();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize service successfully', async () => {
      await service.init();
      expect(service.isInitialized()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockAvalancheClient.getBlock.mockRejectedValue(new Error('Network error'));
      
      await expect(service.init()).rejects.toThrow('Failed to initialize transaction service');
      expect(service.isInitialized()).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      await service.init();
      const getBlockCalls = mockAvalancheClient.getBlock.mock.calls.length;
      
      await service.init();
      expect(mockAvalancheClient.getBlock.mock.calls.length).toBe(getBlockCalls);
    });
  });

  describe('Send Transaction', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should send a basic transaction successfully', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';
      
      const mockTxResponse = {
        hash: '0x' + 'a'.repeat(64),
        from,
        to,
        value: { toString: () => '1000000000000000000' },
        nonce: 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      const tx = await service.sendTransaction(from, to, value);

      expect(tx).toEqual({
        id: expect.any(String),
        hash: mockTxResponse.hash,
        from,
        to,
        value: '1000000000000000000',
        data: '0x',
        nonce: 1,
        gasLimit: '21000',
        gasPrice: '20000000000',
        status: 'pending',
        timestamp: mockDate,
        confirmations: 0
      });

      expect(mockAvalancheClient.sendTransaction).toHaveBeenCalledWith({
        from,
        to,
        value: { toString: expect.any(Function) },
        data: '0x',
        nonce: 1,
        gasLimit: '21000',
        gasPrice: '20000000000'
      });
    });

    it('should send transaction with custom gas settings', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';
      const options = {
        gasLimit: '50000',
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '2000000000'
      };

      const mockTxResponse = {
        hash: '0x' + 'b'.repeat(64),
        from,
        to,
        value: { toString: () => '1000000000000000000' },
        nonce: 2,
        gasLimit: { toString: () => options.gasLimit },
        maxFeePerGas: { toString: () => options.maxFeePerGas },
        maxPriorityFeePerGas: { toString: () => options.maxPriorityFeePerGas },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(2);

      const tx = await service.sendTransaction(from, to, value, undefined, options);

      expect(tx.gasLimit).toBe(options.gasLimit);
      expect(tx.maxFeePerGas).toBe(options.maxFeePerGas);
      expect(tx.maxPriorityFeePerGas).toBe(options.maxPriorityFeePerGas);
    });

    it('should send transaction with data', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '0';
      const data = '0x' + 'deadbeef'.repeat(8);

      const mockTxResponse = {
        hash: '0x' + 'c'.repeat(64),
        from,
        to,
        value: { toString: () => '0' },
        nonce: 3,
        gasLimit: { toString: () => '100000' },
        gasPrice: { toString: () => '20000000000' },
        data,
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(3);

      const tx = await service.sendTransaction(from, to, value, data);

      expect(tx.data).toBe(data);
      expect(mockAvalancheClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ data })
      );
    });

    it('should handle transaction errors', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';

      mockAvalancheClient.sendTransaction.mockRejectedValue(new Error('Insufficient funds'));

      await expect(service.sendTransaction(from, to, value))
        .rejects.toThrow('Transaction failed: Insufficient funds');
    });

    it('should validate addresses', async () => {
      await expect(service.sendTransaction('invalid', '0xabcd', '1.0'))
        .rejects.toThrow('Invalid from address');

      await expect(service.sendTransaction('0x1234567890123456789012345678901234567890', 'invalid', '1.0'))
        .rejects.toThrow('Invalid to address');
    });
  });

  describe('Batch Transactions', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should send batch transactions successfully', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const transactions = [
        {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          value: '1.0',
          data: '0x'
        },
        {
          to: '0xbcdefabcdefabcdefabcdefabcdefabcdefabcde',
          value: '2.0',
          data: '0xdeadbeef'
        }
      ];

      const mockResponses = transactions.map((tx, index) => ({
        hash: '0x' + (index + 1).toString().repeat(64),
        from,
        to: tx.to,
        value: { toString: () => (parseFloat(tx.value) * 1e18).toString() },
        nonce: index + 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: tx.data,
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      }));

      mockAvalancheClient.sendBatch.mockResolvedValue(mockResponses);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      const results = await service.sendBatchTransactions(from, transactions);

      expect(results).toHaveLength(2);
      expect(results[0].to).toBe(transactions[0].to);
      expect(results[1].to).toBe(transactions[1].to);
      expect(mockAvalancheClient.sendBatch).toHaveBeenCalled();
    });

    it('should handle partial batch failures', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const transactions = [
        {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          value: '1.0'
        },
        {
          to: '0xbcdefabcdefabcdefabcdefabcdefabcdefabcde',
          value: '2.0'
        }
      ];

      mockAvalancheClient.sendBatch.mockRejectedValue(new Error('Batch processing failed'));

      await expect(service.sendBatchTransactions(from, transactions))
        .rejects.toThrow('Batch transaction failed');
    });

    it('should validate batch transaction limit', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const transactions = Array(101).fill({
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: '1.0'
      });

      await expect(service.sendBatchTransactions(from, transactions))
        .rejects.toThrow('Too many transactions in batch');
    });
  });

  describe('Gas Estimation', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should estimate gas for transaction', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';

      mockAvalancheClient.estimateGas.mockResolvedValue({ toString: () => '21000' });
      mockAvalancheClient.getFeeData.mockResolvedValue({
        gasPrice: { toString: () => '20000000000' },
        maxFeePerGas: { toString: () => '30000000000' },
        maxPriorityFeePerGas: { toString: () => '2000000000' }
      });

      const estimate = await service.estimateGas(from, to, value);

      expect(estimate).toEqual({
        gasLimit: '21000',
        gasPrice: '20000000000',
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '2000000000',
        estimatedCost: expect.any(String)
      });

      expect(mockAvalancheClient.estimateGas).toHaveBeenCalledWith({
        from,
        to,
        value: { toString: expect.any(Function) },
        data: '0x'
      });
    });

    it('should estimate gas for contract call', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '0';
      const data = '0x' + 'deadbeef'.repeat(32);

      mockAvalancheClient.estimateGas.mockResolvedValue({ toString: () => '150000' });
      mockAvalancheClient.getFeeData.mockResolvedValue({
        gasPrice: { toString: () => '20000000000' },
        maxFeePerGas: { toString: () => '30000000000' },
        maxPriorityFeePerGas: { toString: () => '2000000000' }
      });

      const estimate = await service.estimateGas(from, to, value, data);

      expect(estimate.gasLimit).toBe('150000');
      expect(mockAvalancheClient.estimateGas).toHaveBeenCalledWith({
        from,
        to,
        value: { toString: expect.any(Function) },
        data
      });
    });

    it('should handle gas estimation errors', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';

      mockAvalancheClient.estimateGas.mockRejectedValue(new Error('Execution reverted'));

      await expect(service.estimateGas(from, to, value))
        .rejects.toThrow('Gas estimation failed');
    });
  });

  describe('Transaction Monitoring', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should watch transaction until confirmed', async () => {
      const txHash = '0x' + 'a'.repeat(64);
      
      const mockReceipt = {
        transactionHash: txHash,
        blockNumber: 12345,
        blockHash: '0x' + 'b'.repeat(64),
        status: 1,
        gasUsed: { toString: () => '21000' },
        effectiveGasPrice: { toString: () => '20000000000' },
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        logs: [],
        confirmations: 12
      };

      mockAvalancheClient.waitForTransaction.mockResolvedValue(mockReceipt);

      const receipt = await service.watchTransaction(txHash);

      expect(receipt).toEqual({
        transactionHash: txHash,
        blockNumber: 12345,
        blockHash: mockReceipt.blockHash,
        status: 'confirmed',
        gasUsed: '21000',
        effectiveGasPrice: '20000000000',
        logs: []
      });

      expect(mockAvalancheClient.waitForTransaction).toHaveBeenCalledWith(txHash, 12);
    });

    it('should handle failed transactions', async () => {
      const txHash = '0x' + 'c'.repeat(64);
      
      const mockReceipt = {
        transactionHash: txHash,
        blockNumber: 12346,
        blockHash: '0x' + 'd'.repeat(64),
        status: 0,
        gasUsed: { toString: () => '21000' },
        effectiveGasPrice: { toString: () => '20000000000' },
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        logs: [],
        confirmations: 12
      };

      mockAvalancheClient.waitForTransaction.mockResolvedValue(mockReceipt);

      const receipt = await service.watchTransaction(txHash);

      expect(receipt.status).toBe('failed');
    });

    it('should watch with custom confirmations', async () => {
      const txHash = '0x' + 'e'.repeat(64);
      const confirmations = 6;
      
      const mockReceipt = {
        transactionHash: txHash,
        blockNumber: 12347,
        blockHash: '0x' + 'f'.repeat(64),
        status: 1,
        gasUsed: { toString: () => '21000' },
        effectiveGasPrice: { toString: () => '20000000000' },
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        logs: [],
        confirmations: 6
      };

      mockAvalancheClient.waitForTransaction.mockResolvedValue(mockReceipt);

      await service.watchTransaction(txHash, confirmations);

      expect(mockAvalancheClient.waitForTransaction).toHaveBeenCalledWith(txHash, confirmations);
    });

    it('should handle watch timeout', async () => {
      const txHash = '0x' + 'g'.repeat(64);
      
      mockAvalancheClient.waitForTransaction.mockRejectedValue(new Error('Timeout waiting for transaction'));

      await expect(service.watchTransaction(txHash))
        .rejects.toThrow('Transaction monitoring failed');
    });
  });

  describe('Transaction Status', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should get transaction status for pending tx', async () => {
      const txHash = '0x' + 'a'.repeat(64);
      
      const mockTx = {
        hash: txHash,
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: { toString: () => '1000000000000000000' },
        nonce: 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        confirmations: 0
      };

      mockAvalancheClient.getTransaction.mockResolvedValue(mockTx);
      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(null);

      const status = await service.getTransactionStatus(txHash);

      expect(status).toBe('pending');
    });

    it('should get transaction status for confirmed tx', async () => {
      const txHash = '0x' + 'b'.repeat(64);
      
      const mockReceipt = {
        transactionHash: txHash,
        status: 1,
        confirmations: 12
      };

      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const status = await service.getTransactionStatus(txHash);

      expect(status).toBe('confirmed');
    });

    it('should get transaction status for failed tx', async () => {
      const txHash = '0x' + 'c'.repeat(64);
      
      const mockReceipt = {
        transactionHash: txHash,
        status: 0,
        confirmations: 12
      };

      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const status = await service.getTransactionStatus(txHash);

      expect(status).toBe('failed');
    });

    it('should handle non-existent transaction', async () => {
      const txHash = '0x' + 'd'.repeat(64);
      
      mockAvalancheClient.getTransaction.mockResolvedValue(null);
      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(null);

      await expect(service.getTransactionStatus(txHash))
        .rejects.toThrow('Transaction not found');
    });
  });

  describe('Cancel/Speed Up Transaction', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should cancel transaction by sending 0 value to self', async () => {
      const txHash = '0x' + 'a'.repeat(64);
      const from = '0x1234567890123456789012345678901234567890';
      
      const mockTx = {
        hash: txHash,
        from,
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: { toString: () => '1000000000000000000' },
        nonce: 5,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        confirmations: 0
      };

      const cancelTxResponse = {
        hash: '0x' + 'cancel'.repeat(10) + 'a'.repeat(4),
        from,
        to: from,
        value: { toString: () => '0' },
        nonce: 5,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '40000000000' },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.getTransaction.mockResolvedValue(mockTx);
      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(null);
      mockAvalancheClient.sendTransaction.mockResolvedValue(cancelTxResponse);

      const cancelTx = await service.cancelTransaction(txHash);

      expect(cancelTx.hash).toBe(cancelTxResponse.hash);
      expect(cancelTx.to).toBe(from); // Sending to self
      expect(cancelTx.value).toBe('0');
      expect(cancelTx.nonce).toBe(5); // Same nonce
      expect(parseInt(cancelTx.gasPrice!)).toBeGreaterThan(parseInt(mockTx.gasPrice.toString()));
    });

    it('should speed up transaction by increasing gas price', async () => {
      const txHash = '0x' + 'b'.repeat(64);
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      
      const mockTx = {
        hash: txHash,
        from,
        to,
        value: { toString: () => '1000000000000000000' },
        nonce: 6,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0xdeadbeef',
        confirmations: 0
      };

      const speedUpTxResponse = {
        hash: '0x' + 'speedup'.repeat(9) + 'b'.repeat(2),
        from,
        to,
        value: { toString: () => '1000000000000000000' },
        nonce: 6,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '30000000000' },
        data: '0xdeadbeef',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.getTransaction.mockResolvedValue(mockTx);
      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(null);
      mockAvalancheClient.sendTransaction.mockResolvedValue(speedUpTxResponse);

      const speedUpTx = await service.speedUpTransaction(txHash, 1.5);

      expect(speedUpTx.hash).toBe(speedUpTxResponse.hash);
      expect(speedUpTx.to).toBe(to); // Same recipient
      expect(speedUpTx.value).toBe('1000000000000000000'); // Same value
      expect(speedUpTx.data).toBe('0xdeadbeef'); // Same data
      expect(speedUpTx.nonce).toBe(6); // Same nonce
      expect(parseInt(speedUpTx.gasPrice!)).toBe(30000000000); // 1.5x gas price
    });

    it('should not cancel already confirmed transaction', async () => {
      const txHash = '0x' + 'c'.repeat(64);
      
      const mockReceipt = {
        transactionHash: txHash,
        status: 1,
        confirmations: 12
      };

      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(mockReceipt);

      await expect(service.cancelTransaction(txHash))
        .rejects.toThrow('Transaction already confirmed');
    });

    it('should handle speed up with EIP-1559 transaction', async () => {
      const txHash = '0x' + 'd'.repeat(64);
      const from = '0x1234567890123456789012345678901234567890';
      
      const mockTx = {
        hash: txHash,
        from,
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: { toString: () => '1000000000000000000' },
        nonce: 7,
        gasLimit: { toString: () => '21000' },
        maxFeePerGas: { toString: () => '30000000000' },
        maxPriorityFeePerGas: { toString: () => '2000000000' },
        type: 2,
        data: '0x',
        confirmations: 0
      };

      const speedUpTxResponse = {
        hash: '0x' + 'eip1559'.repeat(8) + 'd'.repeat(8),
        from,
        to: mockTx.to,
        value: { toString: () => '1000000000000000000' },
        nonce: 7,
        gasLimit: { toString: () => '21000' },
        maxFeePerGas: { toString: () => '45000000000' },
        maxPriorityFeePerGas: { toString: () => '3000000000' },
        type: 2,
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.getTransaction.mockResolvedValue(mockTx);
      mockAvalancheClient.getTransactionReceipt.mockResolvedValue(null);
      mockAvalancheClient.sendTransaction.mockResolvedValue(speedUpTxResponse);

      const speedUpTx = await service.speedUpTransaction(txHash, 1.5);

      expect(speedUpTx.maxFeePerGas).toBe('45000000000'); // 1.5x max fee
      expect(speedUpTx.maxPriorityFeePerGas).toBe('3000000000'); // 1.5x priority fee
    });
  });

  describe('Transaction History', () => {
    beforeEach(async () => {
      await service.init();
      
      // Clear storage
      localStorage.clear();
    });

    it('should get empty transaction history', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      const history = await service.getTransactionHistory(address);
      
      expect(history).toEqual([]);
    });

    it('should track sent transactions in history', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';
      
      const mockTxResponse = {
        hash: '0x' + 'hist1'.repeat(12) + 'a'.repeat(4),
        from,
        to,
        value: { toString: () => '1000000000000000000' },
        nonce: 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      await service.sendTransaction(from, to, value);
      
      const history = await service.getTransactionHistory(from);
      
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        hash: mockTxResponse.hash,
        from,
        to,
        value: '1000000000000000000',
        status: 'pending'
      });
    });

    it('should limit transaction history to recent items', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      // Mock localStorage with many transactions
      const manyTxs = Array(150).fill(null).map((_, i) => ({
        id: `tx-${i}`,
        hash: '0x' + i.toString(16).padStart(64, '0'),
        from: address,
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: '1000000000000000000',
        status: 'confirmed',
        timestamp: mockDate - (i * 1000)
      }));
      
      localStorage.setItem('validator-tx-history', JSON.stringify(manyTxs));
      
      const history = await service.getTransactionHistory(address);
      
      expect(history).toHaveLength(100); // Limited to 100 most recent
      expect(history[0].id).toBe('tx-0'); // Most recent first
    });

    it('should filter history by address', async () => {
      const address1 = '0x1234567890123456789012345678901234567890';
      const address2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      
      // Mock localStorage with mixed transactions
      const mixedTxs = [
        {
          id: 'tx-1',
          hash: '0x' + '1'.repeat(64),
          from: address1,
          to: address2,
          value: '1000000000000000000',
          status: 'confirmed',
          timestamp: mockDate
        },
        {
          id: 'tx-2',
          hash: '0x' + '2'.repeat(64),
          from: address2,
          to: address1,
          value: '2000000000000000000',
          status: 'confirmed',
          timestamp: mockDate - 1000
        },
        {
          id: 'tx-3',
          hash: '0x' + '3'.repeat(64),
          from: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          to: address2,
          value: '3000000000000000000',
          status: 'confirmed',
          timestamp: mockDate - 2000
        }
      ];
      
      localStorage.setItem('validator-tx-history', JSON.stringify(mixedTxs));
      
      const history1 = await service.getTransactionHistory(address1);
      expect(history1).toHaveLength(2); // tx-1 (from) and tx-2 (to)
      
      const history2 = await service.getTransactionHistory(address2);
      expect(history2).toHaveLength(3); // All 3 transactions involve address2
    });
  });

  describe('Fee Data', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should get current fee data', async () => {
      const mockFeeData = {
        gasPrice: { toString: () => '20000000000' },
        maxFeePerGas: { toString: () => '30000000000' },
        maxPriorityFeePerGas: { toString: () => '2000000000' }
      };

      mockAvalancheClient.getFeeData.mockResolvedValue(mockFeeData);

      const feeData = await service.getFeeData();

      expect(feeData).toEqual({
        gasPrice: '20000000000',
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '2000000000'
      });
    });

    it('should handle fee data errors', async () => {
      mockAvalancheClient.getFeeData.mockRejectedValue(new Error('Network error'));

      await expect(service.getFeeData())
        .rejects.toThrow('Failed to get fee data');
    });
  });

  describe('Nonce Management', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should get next nonce for address', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      mockAvalancheClient.getTransactionCount.mockResolvedValue(5);

      const nonce = await service.getNextNonce(address);

      expect(nonce).toBe(5);
      expect(mockAvalancheClient.getTransactionCount).toHaveBeenCalledWith(address, 'pending');
    });

    it('should handle nonce errors', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      mockAvalancheClient.getTransactionCount.mockRejectedValue(new Error('Network error'));

      await expect(service.getNextNonce(address))
        .rejects.toThrow('Failed to get nonce');
    });
  });

  describe('Service Cleanup', () => {
    it('should cleanup service resources', async () => {
      await service.init();
      
      // Send a transaction to populate history
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1.0';
      
      const mockTxResponse = {
        hash: '0x' + 'cleanup'.repeat(8),
        from,
        to,
        value: { toString: () => '1000000000000000000' },
        nonce: 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      await service.sendTransaction(from, to, value);
      
      // Verify history exists
      expect(localStorage.getItem('validator-tx-history')).toBeTruthy();
      
      // Cleanup
      await service.cleanup();
      
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should handle very small transaction values', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '0.000000000000000001'; // 1 wei
      
      const mockTxResponse = {
        hash: '0x' + 'small'.repeat(12) + 'a'.repeat(4),
        from,
        to,
        value: { toString: () => '1' },
        nonce: 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      const tx = await service.sendTransaction(from, to, value);

      expect(tx.value).toBe('1');
    });

    it('should handle very large transaction values', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '1000000.0'; // 1 million ETH
      
      const mockTxResponse = {
        hash: '0x' + 'large'.repeat(12) + 'a'.repeat(4),
        from,
        to,
        value: { toString: () => '1000000000000000000000000' },
        nonce: 1,
        gasLimit: { toString: () => '21000' },
        gasPrice: { toString: () => '20000000000' },
        data: '0x',
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      const tx = await service.sendTransaction(from, to, value);

      expect(tx.value).toBe('1000000000000000000000000');
    });

    it('should handle transaction with maximum gas limit', async () => {
      const from = '0x1234567890123456789012345678901234567890';
      const to = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const value = '0';
      const data = '0x' + 'maxgas'.repeat(100);
      const options = {
        gasLimit: '10000000' // 10 million gas
      };

      const mockTxResponse = {
        hash: '0x' + 'maxgas'.repeat(10) + 'a'.repeat(4),
        from,
        to,
        value: { toString: () => '0' },
        nonce: 1,
        gasLimit: { toString: () => '10000000' },
        gasPrice: { toString: () => '20000000000' },
        data,
        chainId: 1,
        confirmations: 0,
        wait: jest.fn()
      };

      mockAvalancheClient.sendTransaction.mockResolvedValue(mockTxResponse);
      mockAvalancheClient.getTransactionCount.mockResolvedValue(1);

      const tx = await service.sendTransaction(from, to, value, data, options);

      expect(tx.gasLimit).toBe('10000000');
    });
  });
});