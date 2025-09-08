/**
 * Bridge Service Tests
 * Tests cross-chain bridge functionality
 */

import { BridgeService } from '../../../src/core/bridge/BridgeService';
import { BridgeProvider, BridgeRoute, BRIDGE_SUPPORT } from '../../../src/core/bridge/types';
import { TEST_ADDRESSES, MOCK_TOKENS } from '../../setup';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';

// Create a mock provider manager
const mockProviderManager = {
  getProvider: jest.fn().mockReturnValue({
    populateTransaction: jest.fn().mockResolvedValue({
      to: '0x123',
      data: '0x456'
    }),
    sendTransaction: jest.fn().mockResolvedValue({ 
      hash: '0x' + '1'.repeat(64) 
    })
  }),
  sendTransaction: jest.fn().mockResolvedValue('0x' + '1'.repeat(64))
};

describe('BridgeService', () => {
  let bridgeService: BridgeService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create new bridge service instance with mock provider
    bridgeService = new BridgeService(mockProviderManager as any);
    
    // Reset provider manager mocks
    (mockProviderManager.getProvider as jest.Mock).mockReturnValue({
      populateTransaction: jest.fn().mockResolvedValue({
        to: '0x123',
        data: '0x456'
      }),
      sendTransaction: jest.fn().mockResolvedValue({ 
        hash: '0x' + '1'.repeat(64) 
      })
    });
    (mockProviderManager.sendTransaction as jest.Mock).mockResolvedValue('0x' + '1'.repeat(64));
  });

  describe('Quote Discovery', () => {
    it('should get quotes from compatible bridges', async () => {
      const request = {
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: 'USDC',
        amount: '1000000000', // 1000 USDC
        fromAddress: TEST_ADDRESSES.ethereum
      };
      
      const response = await bridgeService.getQuotes(request);
      
      expect(response.routes.length).toBeGreaterThan(0);
      expect(response.bestRoute).toBeTruthy();
      
      // Should include Hop, Stargate, Across, etc.
      const bridges = response.routes.map(r => r.bridge);
      expect(bridges).toContain(BridgeProvider.Hop);
      expect(bridges).toContain(BridgeProvider.Stargate);
    });

    it('should sort routes by best output amount', async () => {
      const request = {
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        fromToken: 'ETH',
        amount: ethers.parseEther('1').toString(),
        fromAddress: TEST_ADDRESSES.ethereum
      };
      
      const response = await bridgeService.getQuotes(request);
      
      // Best route should have highest output
      const outputs = response.routes.map(r => BigNumber.from(r.toAmount));
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i-1].gte(outputs[i])).toBe(true);
      }
    });

    it('should filter bridges by chain support', async () => {
      const request = {
        fromChain: 'ethereum',
        toChain: 'solana',
        fromToken: 'USDC',
        amount: '1000000',
        fromAddress: TEST_ADDRESSES.ethereum
      };
      
      const response = await bridgeService.getQuotes(request);
      
      // Only Wormhole supports Solana
      const bridges = response.routes.map(r => r.bridge);
      expect(bridges).toContain(BridgeProvider.Wormhole);
      expect(bridges).not.toContain(BridgeProvider.Hop); // Hop doesn't support Solana
    });

    it('should handle unsupported routes', async () => {
      const request = {
        fromChain: 'unsupported-chain',
        toChain: 'ethereum',
        fromToken: 'USDC',
        amount: '1000000',
        fromAddress: TEST_ADDRESSES.ethereum
      };
      
      const response = await bridgeService.getQuotes(request);
      
      expect(response.routes).toEqual([]);
      expect(response.bestRoute).toBeNull();
    });
  });

  describe('Bridge Execution', () => {
    const mockRoute: BridgeRoute = {
      id: 'test-route',
      fromChain: 'ethereum',
      toChain: 'polygon',
      fromToken: {
        address: MOCK_TOKENS.ethereum.USDC.address,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 1
      },
      toToken: {
        address: MOCK_TOKENS.polygon.USDC.address,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 137
      },
      fromAmount: '1000000000',
      toAmount: '999000000',
      estimatedTime: 600,
      fee: {
        amount: '1000000',
        token: 'USDC',
        inUSD: '1.00'
      },
      bridge: BridgeProvider.Hop,
      steps: [
        { type: 'approve', description: 'Approve USDC' },
        { type: 'deposit', description: 'Deposit to bridge' },
        { type: 'wait', description: 'Wait for confirmation' }
      ]
    };

    it('should execute bridge transfer', async () => {
      const transferId = await bridgeService.executeBridge(mockRoute);
      
      expect(transferId).toMatch(/^bridge-\d+-[a-z0-9]+$/);
      
      const status = bridgeService.getTransferStatus(transferId);
      expect(status).toBeTruthy();
      expect(status?.status).toBe('pending');
    });

    it('should handle approval step for ERC20', async () => {
      const transferId = await bridgeService.executeBridge(mockRoute);
      
      // Should have called provider for approval
      expect(mockProviderManager.sendTransaction).toHaveBeenCalled();
    });

    it('should skip approval for native tokens', async () => {
      const nativeRoute: BridgeRoute = {
        ...mockRoute,
        fromToken: {
          ...mockRoute.fromToken,
          address: ethers.ZeroAddress
        },
        steps: [
          { type: 'deposit', description: 'Deposit ETH' },
          { type: 'wait', description: 'Wait' }
        ]
      };
      
      await bridgeService.executeBridge(nativeRoute);
      
      // Should go directly to deposit
      expect(mockProviderManager.sendTransaction).toHaveBeenCalled();
    });

    it('should update transfer status on error', async () => {
      (mockProviderManager.sendTransaction as jest.Mock).mockRejectedValueOnce(
        new Error('Transaction failed')
      );
      
      const route = { ...mockRoute };
      
      await expect(
        bridgeService.executeBridge(route)
      ).rejects.toThrow('Transaction failed');
      
      // Check status was updated
      const transfers = Array.from(bridgeService['activeTransfers'].values());
      const failedTransfer = transfers.find(t => t.status === 'failed');
      expect(failedTransfer).toBeTruthy();
      expect(failedTransfer?.message).toContain('Transaction failed');
    });
  });

  describe('Transfer Monitoring', () => {
    it('should track active transfers', async () => {
      const route: BridgeRoute = {
        id: 'test-route',
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromAmount: '1000000',
        toAmount: '999000',
        estimatedTime: 1, // 1 second for testing
        bridge: BridgeProvider.Hop,
        steps: [{ type: 'wait', description: 'Wait' }]
      } as BridgeRoute;
      
      const transferId = await bridgeService.executeBridge(route);
      
      // Initially pending
      let status = bridgeService.getTransferStatus(transferId);
      expect(status?.status).toBe('pending');
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be completed
      status = bridgeService.getTransferStatus(transferId);
      expect(status?.status).toBe('completed');
      expect(status?.toTxHash).toBeTruthy();
    });

    it('should return null for unknown transfer', () => {
      const status = bridgeService.getTransferStatus('unknown-id');
      expect(status).toBeNull();
    });
  });

  describe('Fee Estimation', () => {
    it('should estimate fees for multiple bridges', async () => {
      const fees = await bridgeService.estimateBridgeFees(
        'ethereum',
        'polygon',
        'USDC',
        '1000000000'
      );
      
      expect(fees.length).toBeGreaterThan(0);
      
      fees.forEach(fee => {
        expect(fee.bridge).toBeTruthy();
        expect(fee.fee).toBeTruthy();
        expect(fee.time).toBeGreaterThan(0);
      });
    });

    it('should return fees sorted by bridge', async () => {
      const fees = await bridgeService.estimateBridgeFees(
        'ethereum',
        'arbitrum',
        'ETH',
        ethers.parseEther('1').toString()
      );
      
      // Check that all compatible bridges are included
      const bridges = fees.map(f => f.bridge);
      expect(bridges).toContain(BridgeProvider.Hop);
      expect(bridges).toContain(BridgeProvider.Across);
      expect(bridges).toContain(BridgeProvider.Arbitrum);
    });
  });

  describe('Bridge Compatibility', () => {
    it('should correctly identify compatible bridges', () => {
      const compatible = bridgeService['findCompatibleBridges'](
        'ethereum',
        'polygon',
        'USDC'
      );
      
      expect(compatible).toContain(BridgeProvider.Hop);
      expect(compatible).toContain(BridgeProvider.Stargate);
      expect(compatible).toContain(BridgeProvider.Across);
      expect(compatible).toContain(BridgeProvider.Synapse);
    });

    it('should handle chain-specific bridges', () => {
      const polygonBridge = bridgeService['findCompatibleBridges'](
        'ethereum',
        'polygon',
        'MATIC'
      );
      
      expect(polygonBridge).toContain(BridgeProvider.Polygon);
    });

    it('should handle token-specific filtering', () => {
      const stgBridges = bridgeService['findCompatibleBridges'](
        'ethereum',
        'polygon',
        'STG'
      );
      
      expect(stgBridges).toContain(BridgeProvider.Stargate);
      expect(stgBridges).toContain(BridgeProvider.LayerZero);
    });
  });

  describe('Bridge Steps', () => {
    it('should generate correct steps for ERC20', () => {
      const steps = bridgeService['getBridgeSteps'](
        BridgeProvider.Hop,
        { address: MOCK_TOKENS.ethereum.USDC.address, symbol: 'USDC' }
      );
      
      expect(steps).toHaveLength(3);
      expect(steps[0].type).toBe('approve');
      expect(steps[1].type).toBe('deposit');
      expect(steps[2].type).toBe('wait');
    });

    it('should skip approval for native tokens', () => {
      const steps = bridgeService['getBridgeSteps'](
        BridgeProvider.Hop,
        { address: ethers.ZeroAddress, symbol: 'ETH' }
      );
      
      expect(steps).toHaveLength(2);
      expect(steps[0].type).toBe('deposit');
      expect(steps[1].type).toBe('wait');
    });

    it('should include claim step for specific bridges', () => {
      const steps = bridgeService['getBridgeSteps'](
        BridgeProvider.Across,
        { address: MOCK_TOKENS.ethereum.USDC.address, symbol: 'USDC' }
      );
      
      expect(steps).toHaveLength(4);
      expect(steps[3].type).toBe('claim');
    });
  });

  describe('Bridge Addresses', () => {
    it('should return correct bridge addresses', () => {
      const hopEth = bridgeService['getBridgeAddress'](
        BridgeProvider.Hop,
        'ethereum'
      );
      expect(hopEth).toMatch(/^0x[a-fA-F0-9]{40}$/);
      
      const stargatePolygon = bridgeService['getBridgeAddress'](
        BridgeProvider.Stargate,
        'polygon'
      );
      expect(stargatePolygon).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should return zero address for unknown bridge/chain', () => {
      const unknown = bridgeService['getBridgeAddress'](
        'unknown' as BridgeProvider,
        'ethereum'
      );
      expect(unknown).toBe(ethers.ZeroAddress);
    });
  });

  describe('Error Handling', () => {
    it('should handle quote errors gracefully', async () => {
      // Mock a bridge that always fails
      bridgeService['getQuoteFromBridge'] = jest.fn()
        .mockRejectedValue(new Error('API Error'));
      
      const request = {
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: 'USDC',
        amount: '1000000',
        fromAddress: TEST_ADDRESSES.ethereum
      };
      
      const response = await bridgeService.getQuotes(request);
      
      // Should still return empty routes instead of throwing
      expect(response.routes).toEqual([]);
      expect(response.bestRoute).toBeNull();
    });

    it('should handle execution errors', async () => {
      (mockProviderManager.sendTransaction as jest.Mock)
        .mockRejectedValue(new Error('Insufficient funds'));
      
      const route: BridgeRoute = {
        id: 'test-route-error',
        fromChain: 'ethereum',
        toChain: 'polygon',
        fromToken: {
          address: ethers.ZeroAddress,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          chainId: 1
        },
        toToken: {
          address: ethers.ZeroAddress,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          chainId: 137
        },
        fromAmount: '1000000000000000000',
        toAmount: '999000000000000000',
        estimatedTime: 600,
        fee: {
          amount: '1000000000000000',
          token: 'ETH',
          inUSD: '3.00'
        },
        bridge: BridgeProvider.Hop,
        steps: [{ type: 'deposit', description: 'Deposit ETH' }]
      };
      
      await expect(
        bridgeService.executeBridge(route)
      ).rejects.toThrow('Insufficient funds');
    });
  });

  describe('Bridge Support Matrix', () => {
    it('should have complete support information', () => {
      Object.values(BridgeProvider).forEach(bridge => {
        const support = BRIDGE_SUPPORT[bridge];
        expect(support).toBeTruthy();
        expect(support.chains).toBeInstanceOf(Array);
        expect(support.tokens).toBeInstanceOf(Array);
        expect(support.estimatedTime).toBeGreaterThan(0);
      });
    });

    it('should have realistic time estimates', () => {
      expect(BRIDGE_SUPPORT[BridgeProvider.Across].estimatedTime).toBe(180); // 3 min
      expect(BRIDGE_SUPPORT[BridgeProvider.Hop].estimatedTime).toBe(600); // 10 min
      expect(BRIDGE_SUPPORT[BridgeProvider.Polygon].estimatedTime).toBe(1800); // 30 min
    });
  });
});