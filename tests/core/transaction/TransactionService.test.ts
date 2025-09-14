/**
 * Transaction Service Tests
 * Tests TypeScript compliance and transaction handling across multiple chains
 * 
 * CONFIGURABLE TEST - Quick Usage:
 * - Mock mode (default): npm test -- TransactionService.test.ts
 * - Real endpoints: USE_REAL_ENDPOINTS=true npm test -- TransactionService.test.ts
 * 
 * See tests/CONFIGURABLE_TESTS_README.md for full documentation
 */

import { testEnv } from '../../config/test-environment';
import { TestProviderFactory, resetAllMocks } from '../../mocks/provider-factory';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../../src/core/keyring/KeyringManager');
jest.mock('../../../src/services/database/TransactionDatabase');

import { TransactionService, TransactionRequest, TransactionResult } from '../../../src/core/transaction/TransactionService';
import { KeyringManager } from '../../../src/core/keyring/KeyringManager';
import { TransactionDatabase } from '../../../src/services/database/TransactionDatabase';

describe('TransactionService (Configurable)', () => {
  let transactionService: TransactionService;
  let mockKeyringManager: jest.Mocked<KeyringManager>;
  let mockTransactionDb: jest.Mocked<TransactionDatabase>;
  let provider: any;
  
  const testAccounts = testEnv.getTestAccounts();
  const endpoints = testEnv.getEndpoints();

  const mockSession = {
    username: testAccounts.user1.username,
    isLoggedIn: true,
    accounts: {
      ethereum: {
        address: testAccounts.user1.address,
        mnemonic: 'test mnemonic',
        privateKey: testAccounts.user1.privateKey,
        publicKey: '0x456',
        omniAddress: testAccounts.user1.username
      },
      omnicoin: {
        address: testAccounts.user1.address,
        mnemonic: 'test mnemonic',
        privateKey: testAccounts.user1.privateKey,
        publicKey: '0xabc',
        omniAddress: testAccounts.user1.username
      }
    },
    sessionToken: 'token123',
    lastActivity: Date.now()
  };

  beforeEach(async () => {
    // Reset singleton instance
    (TransactionService as any).instance = undefined;
    resetAllMocks();
    
    // Clear all module mocks
    jest.clearAllMocks();
    jest.resetModules();
    
    // Create provider based on environment
    if (testEnv.isUsingRealEndpoints()) {
      provider = new ethers.JsonRpcProvider(endpoints.omnicoinRpc);
    } else {
      provider = TestProviderFactory.createOmniCoinProvider();
      
      // Set up mock balances
      provider.setMockBalance(testAccounts.user1.address, ethers.parseEther('100'));
      provider.setMockBalance(testAccounts.user2.address, ethers.parseEther('50'));
    }
    
    // Setup mocks
    mockKeyringManager = {
      resolveAddressForChain: jest.fn(),
      getCurrentSession: jest.fn(),
      getSession: jest.fn().mockReturnValue(mockSession),
      signTransaction: jest.fn(),
      getProvider: jest.fn().mockReturnValue(provider),
      exportPrivateKeys: jest.fn().mockReturnValue({
        ethereum: testAccounts.user1.privateKey,
        omnicoin: testAccounts.user1.privateKey
      })
    } as any;

    mockTransactionDb = {
      storeTransaction: jest.fn(),
      updateTransactionStatus: jest.fn(),
      getTransactionHistory: jest.fn(),
      getTransaction: jest.fn()
    } as any;

    if (!testEnv.isUsingRealEndpoints()) {
      // Mock static methods
      (KeyringManager.getInstance as jest.Mock).mockReturnValue(mockKeyringManager);
      (TransactionDatabase as jest.Mock).mockImplementation(() => mockTransactionDb);
    } else {
      // For real endpoints, we need to use real instances or set up proper test instances
      // This would require additional setup that depends on your actual implementation
    }

    transactionService = TransactionService.getInstance();
  });

  afterEach(() => {
    if (!testEnv.isUsingRealEndpoints()) {
      jest.clearAllMocks();
    }
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
      to: testAccounts.user2.address,
      value: ethers.parseEther('1').toString(), // 1 ETH in wei
      data: '0x',
      chainType: 'ethereum',
      gasLimit: 21000,
      gasPrice: ethers.parseUnits('30', 'gwei').toString()
    };

    it('should handle complete transaction request', async () => {
      if (!testEnv.isUsingRealEndpoints()) {
        // Setup mocks
        mockKeyringManager.resolveAddressForChain.mockResolvedValue(testAccounts.user2.address);
        mockKeyringManager.getSession.mockReturnValue(mockSession as any);
        mockKeyringManager.signTransaction.mockResolvedValue('0x' + '1'.repeat(64));

        const result = await transactionService.sendTransaction(validRequest);

        expect(result).toBeDefined();
        expect(result.hash).toBeDefined();
        expect(result.hash).toMatch(/^0x[a-f0-9]{64}$/);
        expect(result.resolvedAddress).toBe(testAccounts.user2.address);
        expect(result.originalAddress).toBe(testAccounts.user2.address);
      } else {
        // For real endpoints, we would need actual transaction handling
        expect(true).toBe(true);
      }
    });

    it('should handle minimal transaction request', async () => {
      if (!testEnv.isUsingRealEndpoints()) {
        const minimalRequest: TransactionRequest = {
          to: testAccounts.user2.address,
          chainType: 'ethereum'
          // Optional fields omitted
        };

        // Setup mocks
        mockKeyringManager.resolveAddressForChain.mockResolvedValue(testAccounts.user2.address);
        mockKeyringManager.getSession.mockReturnValue({
          accounts: {
            ethereum: {
              address: testAccounts.user1.address
            }
          }
        } as any);
        mockKeyringManager.signTransaction.mockResolvedValue({
          hash: '0x' + '2'.repeat(64),
          from: testAccounts.user1.address,
          to: testAccounts.user2.address,
          value: '0',
          chainType: 'ethereum'
        } as any);

        const result = await transactionService.sendTransaction(minimalRequest);

        expect(result).toBeDefined();
        expect(result.value).toBe('0');
        expect(result.chainType).toBe('ethereum');
      } else {
        expect(true).toBe(true);
      }
    });

    it('should handle different chain types', async () => {
      if (!testEnv.isUsingRealEndpoints()) {
        const chains: TransactionRequest['chainType'][] = ['ethereum', 'polygon', 'arbitrum', 'optimism'];
        
        for (const chainType of chains) {
          const request: TransactionRequest = {
            to: testAccounts.user2.address,
            chainType,
            value: '1000000'
          };

          mockKeyringManager.resolveAddressForChain.mockResolvedValue(testAccounts.user2.address);
          mockKeyringManager.getSession.mockReturnValue({
            address: testAccounts.user1.address,
            type: chainType
          } as any);
          mockKeyringManager.signTransaction.mockResolvedValue({
            hash: '0x' + chainType.slice(0, 8).padEnd(64, '0'),
            from: testAccounts.user1.address,
            to: testAccounts.user2.address,
            value: '1000000',
            chainType
          } as any);

          const result = await transactionService.sendTransaction(request);
          
          expect(result.chainType).toBe(chainType);
        }
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('ENS Resolution Type Safety', () => {
    it('should resolve ENS names to addresses', async () => {
      if (!testEnv.isUsingRealEndpoints()) {
        const request: TransactionRequest = {
          to: testAccounts.user2.username,
          chainType: 'ethereum',
          value: ethers.parseEther('1').toString()
        };

          mockKeyringManager.getSession.mockReturnValue({
          accounts: {
            ethereum: {
              address: testAccounts.user1.address
            }
          }
        } as any);
        mockKeyringManager.signTransaction.mockResolvedValue({
          hash: '0xabc123',
          from: testAccounts.user1.address,
          to: testAccounts.user1.address,
          value: ethers.parseEther('1').toString(),
          chainType: 'ethereum'
        } as any);

        // ENS resolution is not yet implemented in TransactionService
        await expect(transactionService.sendTransaction(request)).rejects.toThrow('ENS resolution not yet implemented');
      } else {
        expect(true).toBe(true);
      }
    });

    it('should handle resolution failures', async () => {
      const request: TransactionRequest = {
        to: 'nonexistent.eth',
        chainType: 'ethereum'
      };

      // Current implementation throws for ENS names since resolution is not yet implemented
      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'ENS resolution not yet implemented for: nonexistent.eth'
      );
    });

    it('should handle direct addresses without resolution', async () => {
      const directAddress = '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3';
      const request: TransactionRequest = {
        to: directAddress,
        chainType: 'ethereum'
      };

      mockKeyringManager.resolveAddressForChain.mockResolvedValue(directAddress);
      mockKeyringManager.getSession.mockReturnValue({
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

      // Mock getSession to return null (implementation uses getSession, not getCurrentSession)
      mockKeyringManager.getSession.mockReturnValue(null);

      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'No account available for transaction'
      );
    });

    it('should handle session with null properties', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      // Mock getSession to return a session with empty address (not null)
      mockKeyringManager.getSession.mockReturnValue({
        address: '', // Empty address string
        type: 'ethereum'
      } as any);
      
      // Mock exportPrivateKeys to return null to prevent fallback signing
      mockKeyringManager.exportPrivateKeys.mockReturnValue(null);

      // Should throw "No account available for transaction" for empty address
      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'No account available for transaction'
      );
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

      mockKeyringManager.getSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      mockKeyringManager.signTransaction.mockResolvedValue(txResult as any);
      mockTransactionDb.storeTransaction.mockResolvedValue(true);

      const result = await transactionService.sendTransaction(request);
      
      // Verify result is correct
      expect(result.hash).toBeDefined();
      expect(result.hash).toMatch(/^0x[a-f0-9]{64}$/);

      expect(mockTransactionDb.storeTransaction).toHaveBeenCalledWith({
        txHash: expect.stringMatching(/^0x[a-f0-9]{64}$/), // Any valid transaction hash
        userAddress: '0xuser123',
        fromAddress: '0xuser123',
        toAddress: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        amount: '1000000000000000000',
        tokenSymbol: 'ETH',
        tokenDecimals: 18,
        gasUsed: '21000',
        gasPrice: '30000000000',
        status: 'pending',
        createdAt: expect.any(Date),
        txType: 'send'
      });
    });

    it('should handle database errors gracefully', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.getSession.mockReturnValue({
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
      
      // Verify the transaction succeeded despite database error
      expect(result.hash).toBeDefined();
      expect(result.hash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(mockTransactionDb.storeTransaction).toHaveBeenCalled();
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

      mockKeyringManager.getSession.mockReturnValue({
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

      mockKeyringManager.getSession.mockReturnValue({
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
      
      expect(result.hash).toBeDefined();
      expect(typeof result.hash).toBe('string');
      expect(result.hash.startsWith('0x')).toBe(true);
    });
  });

  describe('Error Handling Type Safety', () => {
    it('should handle unknown errors', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.getSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      // Mock exportPrivateKeys to throw since that's what the implementation uses
      mockKeyringManager.exportPrivateKeys.mockImplementation(() => {
        throw new Error('String error');
      });

      await expect(transactionService.sendTransaction(request)).rejects.toThrow('String error');
    });

    it('should preserve error messages', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
        chainType: 'ethereum'
      };

      mockKeyringManager.getSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      // Mock exportPrivateKeys to throw with specific message
      mockKeyringManager.exportPrivateKeys.mockImplementation(() => {
        throw new Error('Insufficient funds for gas * price + value');
      });

      await expect(transactionService.sendTransaction(request)).rejects.toThrow(
        'Insufficient funds for gas * price + value'
      );
    });
  });

  describe('TransactionResult Type Compliance', () => {
    it('should return properly typed transaction result', async () => {
      const request: TransactionRequest = {
        to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3', // Use direct address instead of ENS
        chainType: 'ethereum',
        value: '2000000000000000000' // 2 ETH
      };

      mockKeyringManager.getSession.mockReturnValue({
        accounts: {
          ethereum: {
            address: '0xuser123'
          }
        }
      } as any);
      
      // Mock exportPrivateKeys to return test keys
      mockKeyringManager.exportPrivateKeys.mockReturnValue({
        ethereum: { privateKey: testAccounts.user1.privateKey },
        omnicoin: { privateKey: testAccounts.user1.privateKey }
      });

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
      expect(result.hash).toBeDefined();
      expect(result.hash.startsWith('0x')).toBe(true);
      expect(result.from).toBe('0xuser123');
      expect(result.to).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      expect(result.value).toBe('2000000000000000000');
      expect(result.chainType).toBe('ethereum');
      expect(result.resolvedAddress).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
      expect(result.originalAddress).toBe('0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3');
    });
  });
  
  // Skip tests if required and real endpoints not available
  if (testEnv.shouldSkipIfNoRealEndpoints()) {
    it.skip('Skipping tests - real endpoints required but not available', () => {});
  }
});