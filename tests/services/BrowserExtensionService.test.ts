/**
 * BrowserExtensionService Test Suite
 * 
 * Tests browser extension lifecycle management, content script communication,
 * permission handling, and provider request routing. This is a Phase 4 
 * component for core functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BrowserExtensionService, ProviderRequest, ProviderResponse } from '../../src/services/BrowserExtensionService';
import { WalletService } from '../../src/services/WalletService';
import { KeyringService } from '../../src/core/keyring/KeyringService';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../../src/services/WalletService');
jest.mock('../../src/core/keyring/KeyringService');

describe('BrowserExtensionService', () => {
  let service: BrowserExtensionService;
  let mockWalletService: jest.Mocked<WalletService>;
  let mockKeyringService: jest.Mocked<KeyringService>;

  // Test constants
  const TEST_ORIGIN = 'https://dapp.example.com';
  const TEST_UNTRUSTED_ORIGIN = 'https://evil.example.com';
  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';
  const TEST_ADDRESS_2 = '0x1234567890123456789012345678901234567890';
  const TEST_CHAIN_ID = 1;
  const TEST_TX_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const TEST_SIGNATURE = '0xSignature123456789';

  const mockSender = {
    origin: TEST_ORIGIN,
    url: TEST_ORIGIN,
    tab: {
      id: 123,
      url: TEST_ORIGIN,
      title: 'Test DApp'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock wallet service
    mockWalletService = {
      getAccounts: jest.fn().mockResolvedValue([
        { address: TEST_ADDRESS, name: 'Account 1' },
        { address: TEST_ADDRESS_2, name: 'Account 2' }
      ]),
      sendTransaction: jest.fn().mockResolvedValue({ hash: TEST_TX_HASH }),
      signMessage: jest.fn().mockResolvedValue(TEST_SIGNATURE),
      switchChain: jest.fn().mockResolvedValue(undefined),
      getChainId: jest.fn().mockResolvedValue(TEST_CHAIN_ID),
      request: jest.fn().mockResolvedValue('0x123')
    } as any;

    // Setup mock keyring service
    mockKeyringService = {} as any;

    service = new BrowserExtensionService(mockWalletService, mockKeyringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Request Handling', () => {
    it('should handle eth_requestAccounts successfully', async () => {
      const request: ProviderRequest = {
        method: 'eth_requestAccounts',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: [TEST_ADDRESS, TEST_ADDRESS_2],
        jsonrpc: '2.0'
      });
      expect(mockWalletService.getAccounts).toHaveBeenCalled();
      expect(service.getConnectedSites()).toContain(TEST_ORIGIN);
    });

    it('should emit accountChanged event on connection', async () => {
      const accountChangedListener = jest.fn();
      service.on('accountChanged', accountChangedListener);

      const request: ProviderRequest = {
        method: 'eth_requestAccounts',
        id: 1
      };

      await service.handleProviderRequest(request, mockSender);

      expect(accountChangedListener).toHaveBeenCalledWith(TEST_ADDRESS);
    });

    it('should handle eth_accounts for connected sites', async () => {
      // First connect the site
      await service.handleProviderRequest({ method: 'eth_requestAccounts' }, mockSender);

      const request: ProviderRequest = {
        method: 'eth_accounts',
        id: 2
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 2,
        result: [TEST_ADDRESS, TEST_ADDRESS_2],
        jsonrpc: '2.0'
      });
    });

    it('should return empty accounts for unconnected sites', async () => {
      const request: ProviderRequest = {
        method: 'eth_accounts',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: [],
        jsonrpc: '2.0'
      });
    });

    it('should handle eth_sendTransaction', async () => {
      // Grant permission first
      service.grantPermission(TEST_ORIGIN, ['*']);

      const tx = {
        to: '0xRecipient123',
        value: '0x1000',
        data: '0x',
        gas: '0x5208',
        gasPrice: '0x4a817c800'
      };

      const request: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [tx],
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: TEST_TX_HASH,
        jsonrpc: '2.0'
      });
      expect(mockWalletService.sendTransaction).toHaveBeenCalledWith({
        to: tx.to,
        value: BigInt(tx.value),
        data: tx.data,
        gasLimit: BigInt(tx.gas),
        gasPrice: BigInt(tx.gasPrice)
      });
    });

    it('should handle personal_sign', async () => {
      // Grant permission first
      service.grantPermission(TEST_ORIGIN, ['*']);

      const message = 'Hello, OmniBazaar!';
      const request: ProviderRequest = {
        method: 'personal_sign',
        params: [message, TEST_ADDRESS],
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: TEST_SIGNATURE,
        jsonrpc: '2.0'
      });
      expect(mockWalletService.signMessage).toHaveBeenCalledWith(message);
    });

    it('should handle wallet_switchEthereumChain', async () => {
      const networkChangedListener = jest.fn();
      service.on('networkChanged', networkChangedListener);

      const request: ProviderRequest = {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }], // Polygon (137)
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: null,
        jsonrpc: '2.0'
      });
      expect(mockWalletService.switchChain).toHaveBeenCalledWith(137);
      expect(networkChangedListener).toHaveBeenCalledWith(137);
    });

    it('should handle chain switch failures gracefully', async () => {
      mockWalletService.switchChain.mockRejectedValueOnce(new Error('Chain not supported'));

      const request: ProviderRequest = {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        error: 'Failed to switch chain: Chain not supported',
        jsonrpc: '2.0'
      });
    });

    it('should handle eth_chainId', async () => {
      const request: ProviderRequest = {
        method: 'eth_chainId',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: '0x1', // Chain ID 1 in hex
        jsonrpc: '2.0'
      });
    });

    it('should handle net_version', async () => {
      const request: ProviderRequest = {
        method: 'net_version',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: '1',
        jsonrpc: '2.0'
      });
    });

    it('should forward unknown methods to wallet service', async () => {
      mockWalletService.request.mockResolvedValueOnce('0xBlockNumber');

      const request: ProviderRequest = {
        method: 'eth_blockNumber',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        result: '0xBlockNumber',
        jsonrpc: '2.0'
      });
      expect(mockWalletService.request).toHaveBeenCalledWith({
        method: 'eth_blockNumber',
        params: []
      });
    });

    it('should handle errors in provider requests', async () => {
      mockWalletService.getAccounts.mockRejectedValueOnce(new Error('Wallet locked'));

      const request: ProviderRequest = {
        method: 'eth_requestAccounts',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        error: 'Wallet locked',
        jsonrpc: '2.0'
      });
    });
  });

  describe('Permission Management', () => {
    it('should deny restricted methods without permission', async () => {
      const untrustedSender = { ...mockSender, origin: TEST_UNTRUSTED_ORIGIN };

      const request: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [{ to: '0x123' }],
        id: 1
      };

      const response = await service.handleProviderRequest(request, untrustedSender);

      expect(response).toEqual({
        id: 1,
        error: 'Unauthorized',
        jsonrpc: '2.0'
      });
    });

    it('should auto-approve trusted sites', async () => {
      const trustedSender = { ...mockSender, origin: 'https://app.omnibazaar.com' };

      const request: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [{ to: '0x123' }],
        id: 1
      };

      const response = await service.handleProviderRequest(request, trustedSender);

      expect(response.error).toBeUndefined();
      expect(mockWalletService.sendTransaction).toHaveBeenCalled();
    });

    it('should grant permissions correctly', () => {
      service.grantPermission(TEST_ORIGIN, ['eth_sendTransaction', 'personal_sign']);

      const permissions = service.getPermissionedSites();
      expect(permissions.get(TEST_ORIGIN)).toEqual(['eth_sendTransaction', 'personal_sign']);
    });

    it('should revoke permissions correctly', () => {
      service.grantPermission(TEST_ORIGIN, ['*']);
      service.revokePermission(TEST_ORIGIN);

      const permissions = service.getPermissionedSites();
      expect(permissions.has(TEST_ORIGIN)).toBe(false);
    });

    it('should check wildcard permissions', async () => {
      service.grantPermission(TEST_ORIGIN, ['*']);

      const request: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [{ to: '0x123' }],
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response.error).toBeUndefined();
      expect(mockWalletService.sendTransaction).toHaveBeenCalled();
    });

    it('should check specific method permissions', async () => {
      service.grantPermission(TEST_ORIGIN, ['personal_sign']);

      // Should allow personal_sign
      const signRequest: ProviderRequest = {
        method: 'personal_sign',
        params: ['message', TEST_ADDRESS],
        id: 1
      };

      let response = await service.handleProviderRequest(signRequest, mockSender);
      expect(response.error).toBeUndefined();

      // Should deny eth_sendTransaction
      const txRequest: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [{ to: '0x123' }],
        id: 2
      };

      response = await service.handleProviderRequest(txRequest, mockSender);
      expect(response.error).toBe('Unauthorized');
    });
  });

  describe('Site Connection Management', () => {
    it('should track connected sites', async () => {
      expect(service.getConnectedSites()).toEqual([]);

      await service.handleProviderRequest(
        { method: 'eth_requestAccounts' },
        mockSender
      );

      expect(service.getConnectedSites()).toEqual([TEST_ORIGIN]);
    });

    it('should disconnect sites', async () => {
      await service.handleProviderRequest(
        { method: 'eth_requestAccounts' },
        mockSender
      );

      await service.disconnect(TEST_ORIGIN);

      expect(service.getConnectedSites()).not.toContain(TEST_ORIGIN);

      // Should return empty accounts after disconnect
      const response = await service.handleProviderRequest(
        { method: 'eth_accounts' },
        mockSender
      );

      expect(response.result).toEqual([]);
    });

    it('should clear all connections and permissions', () => {
      service.grantPermission(TEST_ORIGIN, ['*']);
      service.grantPermission('https://other.com', ['eth_accounts']);

      service.clearAll();

      expect(service.getConnectedSites()).toEqual([]);
      expect(service.getPermissionedSites().size).toBe(0);
    });

    it('should revoke connection when revoking permission', () => {
      service.grantPermission(TEST_ORIGIN, ['*']);
      service.revokePermission(TEST_ORIGIN);

      expect(service.getConnectedSites()).not.toContain(TEST_ORIGIN);
    });
  });

  describe('Event Handling', () => {
    it('should inherit EventEmitter functionality', () => {
      expect(service).toBeInstanceOf(EventEmitter);
    });

    it('should emit events with correct parameters', async () => {
      const events: any[] = [];
      
      service.on('providerRequest', (...args) => events.push({ event: 'providerRequest', args }));
      service.on('accountChanged', (...args) => events.push({ event: 'accountChanged', args }));
      service.on('networkChanged', (...args) => events.push({ event: 'networkChanged', args }));
      service.on('connectionChanged', (...args) => events.push({ event: 'connectionChanged', args }));

      // Trigger account change
      await service.handleProviderRequest(
        { method: 'eth_requestAccounts' },
        mockSender
      );

      // Trigger network change
      await service.handleProviderRequest(
        { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] },
        mockSender
      );

      expect(events).toContainEqual({ event: 'accountChanged', args: [TEST_ADDRESS] });
      expect(events).toContainEqual({ event: 'networkChanged', args: [137] });
    });
  });

  describe('Transaction Handling', () => {
    beforeEach(() => {
      service.grantPermission(TEST_ORIGIN, ['*']);
    });

    it('should handle transactions with minimal parameters', async () => {
      const request: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [{ to: '0xRecipient' }],
        id: 1
      };

      await service.handleProviderRequest(request, mockSender);

      expect(mockWalletService.sendTransaction).toHaveBeenCalledWith({
        to: '0xRecipient',
        value: undefined,
        data: undefined,
        gasLimit: undefined,
        gasPrice: undefined
      });
    });

    it('should handle transactions with all parameters', async () => {
      const tx = {
        to: '0xRecipient',
        value: '0x1000000000000000', // 1 ETH in wei
        data: '0xabcdef',
        gas: '0x5208',
        gasPrice: '0x4a817c800'
      };

      const request: ProviderRequest = {
        method: 'eth_sendTransaction',
        params: [tx],
        id: 1
      };

      await service.handleProviderRequest(request, mockSender);

      expect(mockWalletService.sendTransaction).toHaveBeenCalledWith({
        to: tx.to,
        value: BigInt(tx.value),
        data: tx.data,
        gasLimit: BigInt(tx.gas),
        gasPrice: BigInt(tx.gasPrice)
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing sender origin', async () => {
      const senderWithoutOrigin = { url: TEST_ORIGIN };

      const request: ProviderRequest = {
        method: 'eth_requestAccounts',
        id: 1
      };

      const response = await service.handleProviderRequest(request, senderWithoutOrigin);

      expect(response.error).toBeUndefined();
      expect(service.getConnectedSites()).toContain(TEST_ORIGIN);
    });

    it('should handle requests without ID', async () => {
      const request: ProviderRequest = {
        method: 'eth_chainId'
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: undefined,
        result: '0x1',
        jsonrpc: '2.0'
      });
    });

    it('should handle empty params array', async () => {
      mockWalletService.request.mockResolvedValueOnce('result');

      const request: ProviderRequest = {
        method: 'custom_method',
        params: undefined,
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(mockWalletService.request).toHaveBeenCalledWith({
        method: 'custom_method',
        params: []
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockWalletService.getAccounts.mockRejectedValueOnce('String error');

      const request: ProviderRequest = {
        method: 'eth_requestAccounts',
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response).toEqual({
        id: 1,
        error: 'Unknown error',
        jsonrpc: '2.0'
      });
    });

    it('should handle chain switch with fallback config', async () => {
      mockWalletService.switchChain.mockRejectedValueOnce(new Error('Not supported'));
      (mockWalletService as any).config = {
        providers: {
          137: { rpcUrl: 'https://polygon-rpc.com' }
        }
      };

      const request: ProviderRequest = {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
        id: 1
      };

      const response = await service.handleProviderRequest(request, mockSender);

      expect(response.error).toBeUndefined();
      expect(response.result).toBe(JSON.stringify(null));
    });
  });

  describe('Restricted Methods', () => {
    const restrictedMethods = [
      'eth_requestAccounts',
      'eth_sendTransaction',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4'
    ];

    restrictedMethods.forEach(method => {
      it(`should recognize ${method} as restricted`, async () => {
        const untrustedSender = { origin: TEST_UNTRUSTED_ORIGIN };

        const request: ProviderRequest = {
          method,
          params: [],
          id: 1
        };

        const response = await service.handleProviderRequest(request, untrustedSender);

        if (method !== 'eth_requestAccounts') {
          // eth_requestAccounts might auto-approve for trusted sites
          expect(response.error).toBe('Unauthorized');
        }
      });
    });
  });

  describe('Request Options', () => {
    it('should handle requests with full options', async () => {
      const requestWithOptions: ProviderRequest = {
        method: 'eth_accounts',
        id: 1,
        provider: 'metamask',
        options: {
          url: 'https://dapp.example.com/page',
          domain: 'dapp.example.com',
          title: 'DApp Title',
          faviconURL: 'https://dapp.example.com/favicon.ico',
          tabId: 456
        }
      };

      const response = await service.handleProviderRequest(requestWithOptions, mockSender);

      expect(response.error).toBeUndefined();
    });
  });
});