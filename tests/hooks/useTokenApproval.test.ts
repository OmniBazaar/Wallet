/**
 * useTokenApproval Hook Test Suite
 * 
 * Tests ERC-20 token approval functionality including allowance checking,
 * approval transactions, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { useTokenApproval } from '../../src/hooks/useTokenApproval';
import { ethers } from 'ethers';
import * as useWalletModule from '../../src/hooks/useWallet';

// Mock dependencies
jest.mock('../../src/hooks/useWallet');
jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers') as any;
  return {
    ...actualEthers,
    Contract: jest.fn(),
    MaxUint256: actualEthers.MaxUint256
  };
});

describe('useTokenApproval', () => {
  let mockProvider: any;
  let mockSigner: any;
  let mockContract: any;
  let mockWalletHook: any;

  // Test constants
  const TEST_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const TEST_SPENDER_ADDRESS = '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57';
  const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';
  const TEST_ALLOWANCE = '1000000'; // 1 USDC (6 decimals)

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock signer
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue(TEST_WALLET_ADDRESS)
    };

    // Setup mock provider
    mockProvider = {
      getSigner: jest.fn().mockResolvedValue(mockSigner)
    };

    // Setup mock contract
    mockContract = {
      allowance: jest.fn().mockResolvedValue(BigInt(TEST_ALLOWANCE)),
      approve: jest.fn().mockResolvedValue({
        hash: '0x123',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      })
    };

    // Mock ethers.Contract
    (ethers.Contract as jest.Mock).mockImplementation(() => mockContract);

    // Setup wallet hook mock
    mockWalletHook = {
      provider: mockProvider,
      address: TEST_WALLET_ADDRESS,
      chainId: 1
    };

    // Mock useWallet
    jest.spyOn(useWalletModule, 'useWallet').mockReturnValue(mockWalletHook as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have initial state', () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      expect(result.current.isApproving).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.allowance).toBe('0');
    });
  });

  describe('Check Allowance', () => {
    it('should check allowance successfully', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(ethers.Contract).toHaveBeenCalledWith(
        TEST_TOKEN_ADDRESS,
        expect.any(Array),
        mockProvider
      );
      expect(mockContract.allowance).toHaveBeenCalledWith(
        TEST_WALLET_ADDRESS,
        TEST_SPENDER_ADDRESS
      );
      expect(result.current.allowance).toBe(TEST_ALLOWANCE);
    });

    it('should handle missing provider', async () => {
      mockWalletHook.provider = null;
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(mockContract.allowance).not.toHaveBeenCalled();
      expect(result.current.allowance).toBe('0');
    });

    it('should handle missing address', async () => {
      mockWalletHook.address = null;
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(mockContract.allowance).not.toHaveBeenCalled();
    });

    it('should handle null token address', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(null as any, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(mockContract.allowance).not.toHaveBeenCalled();
    });

    it('should handle null spender address', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, null as any)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(mockContract.allowance).not.toHaveBeenCalled();
    });

    it('should handle contract without allowance method', async () => {
      mockContract.allowance = undefined;
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(result.current.error).toBe('Failed to check token allowance');
    });

    it('should handle allowance check errors', async () => {
      mockContract.allowance.mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(result.current.error).toBe('Failed to check token allowance');
      expect(result.current.allowance).toBe('0');
    });

    it('should handle large allowance values', async () => {
      const largeAllowance = ethers.MaxUint256;
      mockContract.allowance.mockResolvedValueOnce(largeAllowance);
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(result.current.allowance).toBe(largeAllowance.toString());
    });
  });

  describe('Token Approval', () => {
    it('should approve tokens successfully', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      const approveAmount = '5000000'; // 5 USDC
      let tx: any;

      await act(async () => {
        tx = await result.current.approve(approveAmount);
      });

      expect(ethers.Contract).toHaveBeenCalledWith(
        TEST_TOKEN_ADDRESS,
        expect.any(Array),
        mockSigner
      );
      expect(mockContract.approve).toHaveBeenCalledWith(
        TEST_SPENDER_ADDRESS,
        approveAmount
      );
      expect(tx.hash).toBe('0x123');
      expect(result.current.isApproving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set isApproving during approval', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      let isApprovingDuringTx = false;

      mockContract.approve.mockImplementationOnce(async () => {
        isApprovingDuringTx = result.current.isApproving;
        return {
          hash: '0x123',
          wait: jest.fn().mockResolvedValue({ status: 1 })
        };
      });

      await act(async () => {
        await result.current.approve('1000000');
      });

      expect(isApprovingDuringTx).toBe(true);
      expect(result.current.isApproving).toBe(false);
    });

    it('should update allowance after approval', async () => {
      const newAllowance = '5000000';
      mockContract.allowance.mockResolvedValueOnce(BigInt(newAllowance));
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.approve(newAllowance);
      });

      expect(result.current.allowance).toBe(newAllowance);
    });

    it('should handle missing provider for approval', async () => {
      mockWalletHook.provider = null;
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approve('1000000');
      })).rejects.toThrow('Missing required parameters for approval');

      expect(result.current.isApproving).toBe(false);
    });

    it('should handle missing address for approval', async () => {
      mockWalletHook.address = null;
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approve('1000000');
      })).rejects.toThrow('Missing required parameters for approval');
    });

    it('should handle contract without approve method', async () => {
      mockContract.approve = undefined;
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approve('1000000');
      })).rejects.toThrow('Contract does not have approve method');

      expect(result.current.error).toBe('Contract does not have approve method');
      expect(result.current.isApproving).toBe(false);
    });

    it('should handle approval transaction errors', async () => {
      mockContract.approve.mockRejectedValueOnce(new Error('User rejected'));
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approve('1000000');
      })).rejects.toThrow('User rejected');

      expect(result.current.error).toBe('User rejected');
      expect(result.current.isApproving).toBe(false);
    });

    it('should handle transaction wait errors', async () => {
      mockContract.approve.mockResolvedValueOnce({
        hash: '0x123',
        wait: jest.fn().mockRejectedValue(new Error('Transaction failed'))
      });
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approve('1000000');
      })).rejects.toThrow('Transaction failed');

      expect(result.current.isApproving).toBe(false);
    });

    it('should handle errors without message', async () => {
      mockContract.approve.mockRejectedValueOnce({});
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approve('1000000');
      })).rejects.toThrow();

      expect(result.current.error).toBe('Failed to approve token');
    });
  });

  describe('Max Approval', () => {
    it('should approve max amount', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.approveMax();
      });

      expect(mockContract.approve).toHaveBeenCalledWith(
        TEST_SPENDER_ADDRESS,
        ethers.MaxUint256.toString()
      );
    });

    it('should handle max approval errors', async () => {
      mockContract.approve.mockRejectedValueOnce(new Error('Max approval failed'));
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await expect(act(async () => {
        await result.current.approveMax();
      })).rejects.toThrow('Max approval failed');
    });
  });

  describe('Hook Lifecycle', () => {
    it('should update when token address changes', () => {
      const { result, rerender } = renderHook(
        ({ token, spender }) => useTokenApproval(token, spender),
        {
          initialProps: {
            token: TEST_TOKEN_ADDRESS,
            spender: TEST_SPENDER_ADDRESS
          }
        }
      );

      const checkAllowance1 = result.current.checkAllowance;

      rerender({
        token: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        spender: TEST_SPENDER_ADDRESS
      });

      expect(result.current.checkAllowance).not.toBe(checkAllowance1);
    });

    it('should update when spender address changes', () => {
      const { result, rerender } = renderHook(
        ({ token, spender }) => useTokenApproval(token, spender),
        {
          initialProps: {
            token: TEST_TOKEN_ADDRESS,
            spender: TEST_SPENDER_ADDRESS
          }
        }
      );

      const approve1 = result.current.approve;

      rerender({
        token: TEST_TOKEN_ADDRESS,
        spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' // Different spender
      });

      expect(result.current.approve).not.toBe(approve1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero approval amount', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.approve('0');
      });

      expect(mockContract.approve).toHaveBeenCalledWith(TEST_SPENDER_ADDRESS, '0');
    });

    it('should handle very large approval amounts', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      const largeAmount = '999999999999999999999999999999999999';

      await act(async () => {
        await result.current.approve(largeAmount);
      });

      expect(mockContract.approve).toHaveBeenCalledWith(TEST_SPENDER_ADDRESS, largeAmount);
    });

    it('should handle consecutive approvals', async () => {
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.approve('1000000');
      });

      await act(async () => {
        await result.current.approve('2000000');
      });

      expect(mockContract.approve).toHaveBeenCalledTimes(2);
    });

    it('should handle wallet disconnect during approval', async () => {
      const { result, rerender } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      // Start approval
      const approvalPromise = act(async () => {
        await result.current.approve('1000000');
      });

      // Disconnect wallet
      mockWalletHook.provider = null;
      mockWalletHook.address = null;
      rerender();

      await approvalPromise;

      // Should complete the ongoing approval
      expect(mockContract.approve).toHaveBeenCalled();
    });
  });

  describe('Console Logging', () => {
    it('should log allowance check errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockContract.allowance.mockRejectedValueOnce(new Error('Test error'));
      
      const { result } = renderHook(() => 
        useTokenApproval(TEST_TOKEN_ADDRESS, TEST_SPENDER_ADDRESS)
      );

      await act(async () => {
        await result.current.checkAllowance();
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Error checking allowance:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });
});