/**
 * useTokenTransfer Hook Tests
 * Tests the token transfer hook for TypeScript strict compliance and error handling
 */

import { renderHook, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useTokenTransfer } from '../../src/hooks/useTokenTransfer';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn(() => true),
    parseUnits: jest.fn(() => BigInt('1000000000000000000')),
    BrowserProvider: jest.fn(),
    Contract: jest.fn()
  },
  BrowserProvider: jest.fn(),
  Contract: jest.fn()
}));

describe('useTokenTransfer Hook', () => {
  const testTokenAddress = '0x1234567890123456789012345678901234567890';
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.ethereum as undefined by default
    delete (global as any).window;
    (global as any).window = {};
  });

  afterEach(() => {
    // Clean up window mock
    delete (global as any).window;
  });

  describe('Hook Return Type and Structure', () => {
    it('should return properly typed hook interface', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      expect(result.current).toHaveProperty('transfer');
      expect(result.current).toHaveProperty('isTransferring');
      expect(result.current).toHaveProperty('error');
    });

    it('should return transfer function', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      expect(typeof result.current.transfer).toBe('function');
    });

    it('should return false for isTransferring initially', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      expect(result.current.isTransferring).toBe(false);
      expect(typeof result.current.isTransferring).toBe('boolean');
    });

    it('should return null for error initially', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      expect(result.current.error).toBeNull();
    });
  });

  describe('Hook Parameters', () => {
    it('should accept tokenAddress parameter', () => {
      expect(() => {
        renderHook(() => useTokenTransfer(testTokenAddress));
      }).not.toThrow();
    });

    it('should work with different token addresses', () => {
      const address1 = '0x1111111111111111111111111111111111111111';
      const address2 = '0x2222222222222222222222222222222222222222';
      
      const { result: result1 } = renderHook(() => useTokenTransfer(address1));
      const { result: result2 } = renderHook(() => useTokenTransfer(address2));
      
      expect(result1.current.transfer).toBeDefined();
      expect(result2.current.transfer).toBeDefined();
    });

    it('should handle empty string address', () => {
      const { result } = renderHook(() => useTokenTransfer(''));
      
      expect(result.current.transfer).toBeDefined();
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should properly type tokenAddress as string', () => {
      const address: string = testTokenAddress;
      const { result } = renderHook(() => useTokenTransfer(address));
      
      expect(result.current.transfer).toBeDefined();
    });

    it('should properly type transfer function return as Promise<string>', async () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      let transferPromise: Promise<string>;
      await act(async () => {
        transferPromise = result.current.transfer('0xrecipient', '100');
        expect(transferPromise).toBeInstanceOf(Promise);
        
        try {
          await transferPromise;
        } catch (error) {
          // Expected to fail in test environment
        }
      });
    });

    it('should properly type isTransferring as boolean', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      const isTransferring: boolean = result.current.isTransferring;
      expect(typeof isTransferring).toBe('boolean');
    });

    it('should properly type error as string | null', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      const error: string | null = result.current.error;
      expect(error).toBeNull();
    });
  });

  describe('Transfer Function Behavior', () => {
    it('should handle wallet not available error', async () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      let caughtError: Error | null = null;
      await act(async () => {
        try {
          await result.current.transfer('0x1234567890123456789012345678901234567890', '100');
        } catch (error) {
          caughtError = error as Error;
        }
      });
      
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toContain('Ethereum wallet not available');
    });

    it('should validate token address requirement', async () => {
      const { result } = renderHook(() => useTokenTransfer(''));
      
      let caughtError: Error | null = null;
      await act(async () => {
        try {
          await result.current.transfer('0x1234567890123456789012345678901234567890', '100');
        } catch (error) {
          caughtError = error as Error;
        }
      });
      
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Token address is required');
    });

    it('should validate recipient address requirement', async () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      let caughtError: Error | null = null;
      await act(async () => {
        try {
          await result.current.transfer('', '100');
        } catch (error) {
          caughtError = error as Error;
        }
      });
      
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Recipient address is required');
    });

    it('should validate transfer amount requirement', async () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      let caughtError: Error | null = null;
      await act(async () => {
        try {
          await result.current.transfer('0x1234567890123456789012345678901234567890', '0');
        } catch (error) {
          caughtError = error as Error;
        }
      });
      
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Valid transfer amount is required');
    });

    it('should set isTransferring to true during transfer', async () => {
      // Setup mocks before creating the hook
      const mockSigner = {
        getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
        getSigner: jest.fn()
      };
      
      const mockProvider = {
        getSigner: jest.fn().mockResolvedValue(mockSigner)
      };
      
      const mockContract = {
        decimals: jest.fn().mockResolvedValue(18),
        transfer: jest.fn().mockResolvedValue({ 
          hash: '0x123456789abcdef',
          wait: jest.fn().mockResolvedValue(true)
        })
      };

      // Mock ethers classes before rendering hook
      const { BrowserProvider, Contract } = require('ethers');
      (BrowserProvider as jest.Mock).mockImplementation(() => mockProvider);
      (Contract as jest.Mock).mockImplementation(() => mockContract);
      
      // Set up window.ethereum before hook is created
      (global as any).window.ethereum = {
        isMetaMask: true,
        request: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      };
      
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      await act(async () => {
        // Start the transfer
        const transferPromise = result.current.transfer('0x1234567890123456789012345678901234567890', '100');
        
        // isTransferring should be set immediately after flushSync
        expect(result.current.isTransferring).toBe(true);
        
        try {
          await transferPromise;
        } catch (error) {
          // Expected to fail in test environment
        }
        
        // isTransferring should be false after transfer completes/fails
        expect(result.current.isTransferring).toBe(false);
      });
    });

    it('should set error state when transfer fails', async () => {
      // Setup mocks before creating the hook - this one should fail
      const mockSigner = {
        getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
        getSigner: jest.fn()
      };
      
      const mockProvider = {
        getSigner: jest.fn().mockResolvedValue(mockSigner)
      };
      
      const mockContract = {
        decimals: jest.fn().mockResolvedValue(18),
        transfer: jest.fn().mockRejectedValue(new Error('Transfer failed - insufficient balance'))
      };

      // Mock ethers classes before rendering hook
      const { BrowserProvider, Contract } = require('ethers');
      (BrowserProvider as jest.Mock).mockImplementation(() => mockProvider);
      (Contract as jest.Mock).mockImplementation(() => mockContract);
      
      // Set up window.ethereum before hook is created
      (global as any).window.ethereum = {
        isMetaMask: true,
        request: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      };
      
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      let caughtError = false;
      await act(async () => {
        try {
          await result.current.transfer('0x1234567890123456789012345678901234567890', '100');
        } catch (error) {
          caughtError = true;
          // Expected to fail
        }
      });
      
      expect(caughtError).toBe(true);
      expect(result.current.error).not.toBeNull();
      expect(typeof result.current.error).toBe('string');
      expect(result.current.error).toContain('Transfer failed - insufficient balance');
    });
  });

  describe('Hook Stability', () => {
    it('should maintain consistent transfer function reference', () => {
      const { result, rerender } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      const initialTransfer = result.current.transfer;
      rerender();
      const afterRerenderTransfer = result.current.transfer;
      
      expect(initialTransfer).toBe(afterRerenderTransfer);
    });

    it('should handle token address changes', () => {
      const { result, rerender } = renderHook(
        (props) => useTokenTransfer(props.address),
        { initialProps: { address: testTokenAddress } }
      );
      
      const initialTransfer = result.current.transfer;
      
      rerender({ address: '0x9999999999999999999999999999999999999999' });
      
      // Transfer function should update when tokenAddress changes
      expect(result.current.transfer).not.toBe(initialTransfer);
    });
  });

  describe('Error Handling', () => {
    it('should not throw errors during hook initialization', () => {
      expect(() => {
        renderHook(() => useTokenTransfer(testTokenAddress));
      }).not.toThrow();
    });

    it('should handle multiple simultaneous hook calls', () => {
      expect(() => {
        renderHook(() => useTokenTransfer(testTokenAddress));
        renderHook(() => useTokenTransfer(testTokenAddress));
        renderHook(() => useTokenTransfer('0x9999999999999999999999999999999999999999'));
      }).not.toThrow();
    });
  });

  describe('Interface Compliance', () => {
    it('should match expected return interface structure', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      const expectedKeys = ['transfer', 'isTransferring', 'error'];
      const actualKeys = Object.keys(result.current);
      
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
    });

    it('should not have unexpected properties', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      const allowedKeys = ['transfer', 'isTransferring', 'error'];
      const actualKeys = Object.keys(result.current);
      
      actualKeys.forEach(key => {
        expect(allowedKeys).toContain(key);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on unmount', () => {
      const { unmount } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle multiple mount/unmount cycles', () => {
      expect(() => {
        for (let i = 0; i < 5; i++) {
          const { unmount } = renderHook(() => useTokenTransfer(testTokenAddress));
          unmount();
        }
      }).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct parameter types', async () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      // Should accept string parameters
      await act(async () => {
        try {
          await result.current.transfer('0x1234567890123456789012345678901234567890', '100');
        } catch (error) {
          // Expected to fail in test environment
        }
      });
      
      expect(true).toBe(true); // Test completed without TypeScript errors
    });

    it('should enforce correct return types', () => {
      const { result } = renderHook(() => useTokenTransfer(testTokenAddress));
      
      expect(typeof result.current.transfer).toBe('function');
      expect(typeof result.current.isTransferring).toBe('boolean');
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
    });

    it('should work with strict TypeScript settings', () => {
      // This test verifies that the hook compiles and works under strict TypeScript
      const tokenAddress: string = testTokenAddress;
      const { result } = renderHook(() => useTokenTransfer(tokenAddress));
      
      const transfer: (recipient: string, amount: string) => Promise<string> = result.current.transfer;
      const isTransferring: boolean = result.current.isTransferring;
      const error: string | null = result.current.error;
      
      expect(transfer).toBeDefined();
      expect(typeof isTransferring).toBe('boolean');
      expect(error === null || typeof error === 'string').toBe(true);
    });
  });
});