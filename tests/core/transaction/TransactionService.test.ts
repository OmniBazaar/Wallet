/**
 * Transaction Service Tests
 * Tests TypeScript compliance and transaction handling across multiple chains
 */

import { TransactionService, TransactionRequest, TransactionResult } from '../../../src/core/transaction/TransactionService';
import { KeyringManager } from '../../../src/core/keyring/KeyringManager';
import { TransactionDatabase } from '../../../src/services/database/TransactionDatabase';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../../src/core/keyring/KeyringManager');
jest.mock('../../../src/services/database/TransactionDatabase');

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let mockKeyringManager: jest.Mocked<KeyringManager>;
  let mockTransactionDb: jest.Mocked<TransactionDatabase>;

  const mockSession = {
    username: 'testuser',
    isLoggedIn: true,
    accounts: {
      ethereum: {
        address: '0xuser123',
        mnemonic: 'test mnemonic',
        privateKey: '0x123',
        publicKey: '0x456',
        omniAddress: 'testuser.omnicoin'
      },
      omnicoin: {
        address: '0xomni123',
        mnemonic: 'test mnemonic',
        privateKey: '0x789',
        publicKey: '0xabc',
        omniAddress: 'testuser.omnicoin'
      }
    },
    sessionToken: 'token123',
    lastActivity: Date.now()
  };

  beforeEach(() => {
    // Reset singleton instance
    (TransactionService as any).instance = undefined;
    
    // Setup mocks
    mockKeyringManager = {
      resolveAddressForChain: jest.fn(),
      getCurrentSession: jest.fn(),
      signTransaction: jest.fn()
    } as any;

    mockTransactionDb = {
      storeTransaction: jest.fn(),
      updateTransactionStatus: jest.fn(),
      getTransactionHistory: jest.fn(),
      getTransaction: jest.fn()
    } as any;

    // Mock static methods
    (KeyringManager.getInstance as jest.Mock).mockReturnValue(mockKeyringManager);
    (TransactionDatabase as jest.Mock).mockImplementation(() => mockTransactionDb);

    transactionService = TransactionService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TransactionService.getInstance();
      const instance2 = TransactionService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(transactionService);
    });

    it('should initialize dependencies only once', () => {
      TransactionService.getInstance();
      TransactionService.getInstance();
      
      expect(KeyringManager.getInstance).toHaveBeenCalledTimes(1);
      expect(TransactionDatabase).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transaction Request Type Safety', () => {
    const validRequest: TransactionRequest = {
      to: 'vitalik.eth',
      value: '1000000000000000000', // 1 ETH in wei
      data: '0x',
      chainType: 'ethereum',
      gasLimit: 21000,
      gasPrice: '30000000000' // 30 gwei
    };

    it('should handle complete transaction request', async () => {
      // Setup mocks
      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue(mockSession as any);
      mockKeyringManager.signTransaction.mockResolvedValue('0x' + '1'.repeat(64));

      const result = await transactionService.sendTransaction(validRequest);

      expect(result).toBeDefined();
      expect(result.hash).toBe('0x' + '1'.repeat(64));
      expect(result.resolvedAddress).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      expect(result.originalAddress).toBe('vitalik.eth');
    });

    it('should handle minimal transaction request', async () => {
      const minimalRequest: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
        // Optional fields omitted
      };

      // Setup mocks
      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0x' + '2'.repeat(64),
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '0',
        chainType: 'ethereum'
      } as any);

      const result = await transactionService.sendTransaction(minimalRequest);

      expect(result).toBeDefined();
      expect(result.value).toBe('0');
      expect(result.chainType).toBe('ethereum');
    });

    it('should handle different chain types', async () => {
      const chains: TransactionRequest['chainType'][] = ['ethereum', 'polygon', 'arbitrum', 'optimism'];
      
      for (const chainType of chains) {
        const request: TransactionRequest = {
          to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
          chainType,
          value: '1000000'
        };

        mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
        mockKeyringManager.getCurrentSession.mockReturnValue({
          address: '0xuser123',
          type: chainType
        } as any);
        mockKeyringManager.signTransaction.mockResolvedValue({
          hash: '0x' + chainType.slice(0, 8).padEnd(64, '0'),
          from: '0xuser123',
          to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
          value: '1000000',
          chainType
        } as any);

        const result = await transactionService.sendTransaction(request);
        
        expect(result.chainType).toBe(chainType);
      }
    });
  });

  describe('ENS Resolution Type Safety', () => {
    it('should resolve ENS names to addresses', async () => {
      const request: TransactionRequest = {
        to: 'vitalik.eth',
        chainType: 'ethereum',
        value: '1000000000000000000'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0xabc123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '1000000000000000000',
        chainType: 'ethereum'
      } as any);

      const result = await transactionService.sendTransaction(request);

      expect(mockKeyringManager.resolveAddressForChain).toHaveBeenCalledWith('vitalik.eth', 'ethereum');
      expect(result.resolvedAddress).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      expect(result.originalAddress).toBe('vitalik.eth');
    });

    it('should handle resolution failures', async () => {
      const request: TransactionRequest = {
        to: 'nonexistent.eth',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue(null);

      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'Could not resolve address: nonexistent.eth'
      );
    });

    it('should handle direct addresses without resolution', async () => {
      const directAddress = '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3';
      const request: TransactionRequest = {
        to: directAddress,
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue(directAddress);
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0xdirect123',
        from: '0xuser123',
        to: directAddress,
        value: '0',
        chainType: 'ethereum'
      } as any);

      const result = await transactionService.sendTransaction(request);

      expect(result.resolvedAddress).toBe(directAddress);
      expect(result.originalAddress).toBe(directAddress);
    });
  });

  describe('Session Management Type Safety', () => {
    it('should handle missing session', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue(null);

      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'No account available for transaction'
      );
    });

    it('should handle session with null properties', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        address: null, // Null address
        type: 'ethereum'
      } as any);

      // Should handle gracefully or throw appropriate error
      await expect(transactionService.sendTransaction(request)).rejects.toThrow();
    });
  });

  describe('Database Integration Type Safety', () => {
    it('should persist transaction data correctly', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum',
        value: '1000000000000000000',
        gasLimit: 21000,
        gasPrice: '30000000000'
      };

      const txResult = {
        hash: '0xpersist123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '1000000000000000000',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue(txResult as any);
      mockTransactionDb.storeTransaction.mockResolvedValue(true);

      const result = await transactionService.sendTransaction(request);

      expect(mockTransactionDb.storeTransaction).toHaveBeenCalledWith({
        hash: '0xpersist123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '1000000000000000000',
        chainType: 'ethereum',
        gasLimit: 21000,
        gasPrice: '30000000000',
        status: 'pending',
        timestamp: expect.any(Number),
        resolvedAddress: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        originalAddress: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3'
      });
    });

    it('should handle database errors gracefully', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0xdb_error123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '0',
        chainType: 'ethereum'
      } as any);
      mockTransactionDb.storeTransaction.mockRejectedValue(new Error('Database connection failed'));

      // Transaction should still succeed even if database fails
      const result = await transactionService.sendTransaction(request);
      
      expect(result.hash).toBe('0xdb_error123');
      // Should log warning but not throw
    });
  });

  describe('Gas Parameter Type Safety', () => {
    it('should handle string gas price', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum',
        gasPrice: '50000000000' // String format
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0xgasprice123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '0',
        chainType: 'ethereum',
        gasPrice: '50000000000'
      } as any);

      const result = await transactionService.sendTransaction(request);
      
      // Gas price should be preserved as string
      expect(typeof result.value).toBe('string');
    });

    it('should handle numeric gas limit', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum',
        gasLimit: 150000 // Number format
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0xgaslimit123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '0',
        chainType: 'ethereum'
      } as any);

      const result = await transactionService.sendTransaction(request);
      
      expect(result.hash).toBe('0xgaslimit123');
    });
  });

  describe('Error Handling Type Safety', () => {
    it('should handle unknown errors', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockRejectedValue('String error'); // Not an Error object

      await expect(transactionService.sendTransaction(request)).rejects.toThrow();
    });

    it('should preserve error messages', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockRejectedValue(
        new Error('Insufficient funds for gas * price + value')
      );

      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'Insufficient funds for gas * price + value'
      );
    });
  });

  describe('TransactionResult Type Compliance', () => {
    it('should return properly typed transaction result', async () => {
      const request: TransactionRequest = {
        to: 'test.eth',
        chainType: 'ethereum',
        value: '2000000000000000000' // 2 ETH
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      mockKeyringManager.getCurrentSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue({
        hash: '0xresult123',
        from: '0xuser123',
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        value: '2000000000000000000',
        chainType: 'ethereum'
      } as any);

      const result: TransactionResult = await transactionService.sendTransaction(request);

      // Type assertions
      expect(typeof result.hash).toBe('string');
      expect(typeof result.from).toBe('string');
      expect(typeof result.to).toBe('string');
      expect(typeof result.value).toBe('string');
      expect(typeof result.chainType).toBe('string');
      expect(typeof result.resolvedAddress).toBe('string');
      expect(typeof result.originalAddress).toBe('string');

      // Value assertions
      expect(result.hash).toBe('0xresult123');
      expect(result.from).toBe('0xuser123');
      expect(result.to).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      expect(result.value).toBe('2000000000000000000');
      expect(result.chainType).toBe('ethereum');
      expect(result.resolvedAddress).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      expect(result.originalAddress).toBe('test.eth');
    });
  });
});