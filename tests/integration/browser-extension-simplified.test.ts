/**
 * Simplified Browser Extension Integration Tests
 * 
 * Tests the browser extension service functionality directly
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { jest } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { KeyringService } from '../../src/core/keyring/KeyringService';
import { BrowserExtensionService } from '../../src/services/BrowserExtensionService';
import { ethers } from 'ethers';
const { toUtf8Bytes, hexlify } = ethers;
import {
  TEST_MNEMONIC,
  TEST_ADDRESSES,
  createMockProvider,
  cleanupTest
} from '../setup';

describe('Browser Extension Service Integration Tests', () => {
  let walletService: WalletService;
  let keyringService: KeyringService;
  let browserExtensionService: BrowserExtensionService;
  let mockProvider: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
  });

  beforeEach(async () => {
    // Configure multi-chain support
    const multiChainConfig = {
      defaultChainId: 1,
      providers: {
        1: {
          chainId: 1,
          network: 'mainnet',
          rpcUrl: 'https://mainnet.infura.io/v3/test',
          nativeSymbol: 'ETH',
          nativeDecimals: 18
        },
        137: {
          chainId: 137,
          network: 'polygon',
          rpcUrl: 'https://polygon-rpc.com',
          nativeSymbol: 'MATIC',
          nativeDecimals: 18
        }
      }
    };
    
    walletService = new WalletService(mockProvider, multiChainConfig);
    await walletService.init();

    // Get the keyring service from wallet service (it's a singleton)
    keyringService = (walletService as any).keyringService;
    if (!keyringService) {
      keyringService = new KeyringService();
      await keyringService.initialize();
      (walletService as any).keyringService = keyringService;
    }

    await walletService.addAccountFromSeed(TEST_MNEMONIC, 'Test Wallet');
    await walletService.connect();

    // Initialize browser extension service with the same keyring
    browserExtensionService = new BrowserExtensionService(walletService, keyringService);

    // Mock transaction service to avoid real transactions
    if (walletService.getTransactionService()) {
      jest.spyOn(walletService.getTransactionService()!, 'sendTransaction').mockResolvedValue({
        hash: '0x' + '1234567890abcdef'.repeat(4),
        from: TEST_ADDRESSES.ethereum,
        to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
        value: '0x16345785d8a0000',
        gasLimit: '21000',
        gasPrice: '1000000000',
        nonce: 0,
        data: '0x'
      } as any);
    }

    // Mock keyring service sign method
    jest.spyOn(keyringService, 'signMessage').mockResolvedValue(
      '0x' + 'abcdef1234567890'.repeat(8) + '1c'
    );
  });

  afterEach(async () => {
    await walletService.cleanup();
    await keyringService.cleanup();
    browserExtensionService.clearAll();
    cleanupTest();
    jest.restoreAllMocks();
  });

  describe('Provider Request Handling', () => {
    it('should handle eth_requestAccounts', async () => {
      const request = {
        method: 'eth_requestAccounts',
        params: [],
        id: 1
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const accounts = response.result;
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      // Should return ethereum addresses (3 accounts created)
      expect(accounts).toContain('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(response.id).toBe(1);
    });

    it('should handle eth_accounts for connected sites', async () => {
      // First connect the site
      const connectRequest = {
        method: 'eth_requestAccounts',
        params: [],
        id: 1
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      await browserExtensionService.handleProviderRequest(connectRequest, mockSender);

      // Now request accounts again
      const accountsRequest = {
        method: 'eth_accounts',
        params: [],
        id: 2
      };

      const response = await browserExtensionService.handleProviderRequest(
        accountsRequest,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const accounts = response.result;
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts).toContain('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should handle eth_accounts for unconnected sites', async () => {
      const request = {
        method: 'eth_accounts',
        params: [],
        id: 1
      };

      const mockSender = {
        tab: { id: 1, url: 'https://unknown-site.com' },
        origin: 'https://unknown-site.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const accounts = response.result;
      expect(accounts).toEqual([]);
    });

    it('should handle eth_sendTransaction', async () => {
      // Grant permission first
      browserExtensionService.grantPermission('https://dapp.example.com', ['*']);
      
      const request = {
        method: 'eth_sendTransaction',
        params: [{
          from: TEST_ADDRESSES.ethereum,
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: '0x16345785d8a0000', // 0.1 ETH
          gas: '0x5208' // 21000
        }],
        id: 2
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const txHash = response.result;
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(response.id).toBe(2);
    });

    it('should handle personal_sign', async () => {
      // Grant permission first
      browserExtensionService.grantPermission('https://dapp.example.com', ['*']);
      
      const request = {
        method: 'personal_sign',
        params: [
          hexlify(toUtf8Bytes('Hello OmniBazaar!')),
          TEST_ADDRESSES.ethereum
        ],
        id: 3
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const signature = response.result;
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
      expect(response.id).toBe(3);
    });

    it('should handle wallet_switchEthereumChain', async () => {
      const request = {
        method: 'wallet_switchEthereumChain',
        params: [{
          chainId: '0x89' // Polygon mainnet
        }],
        id: 4
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      // wallet_switchEthereumChain returns null
      expect(response.result).toBe(null);
      expect(response.id).toBe(4);

      // Verify chain was switched
      const currentChainId = await walletService.getChainId();
      expect(currentChainId).toBe(137);
    });

    it('should handle eth_chainId', async () => {
      const request = {
        method: 'eth_chainId',
        params: [],
        id: 5
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const chainId = response.result;
      expect(chainId).toBe('0x1');
      expect(response.id).toBe(5);
    });

    it('should handle net_version', async () => {
      const request = {
        method: 'net_version',
        params: [],
        id: 6
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('result');
      const netVersion = response.result;
      expect(netVersion).toBe('1');
      expect(response.id).toBe(6);
    });
  });

  describe('Permission Management', () => {
    it('should deny restricted methods without permission', async () => {
      const request = {
        method: 'eth_sendTransaction',
        params: [{
          from: TEST_ADDRESSES.ethereum,
          to: '0x742d35Cc6634C0532925a3b8D5C1e1B3c5b5B5b5',
          value: '0x16345785d8a0000'
        }],
        id: 1
      };

      const mockSender = {
        tab: { id: 1, url: 'https://malicious-site.com' },
        origin: 'https://malicious-site.com'
      };

      const response = await browserExtensionService.handleProviderRequest(
        request,
        mockSender
      );

      expect(response).toHaveProperty('error', 'Unauthorized');
    });

    it('should manage connected sites', () => {
      // Connect a site
      browserExtensionService.grantPermission('https://site1.com', ['eth_accounts']);
      browserExtensionService.grantPermission('https://site2.com', ['*']);

      // Get permissioned sites
      const permissions = browserExtensionService.getPermissionedSites();
      expect(permissions.get('https://site1.com')).toEqual(['eth_accounts']);
      expect(permissions.get('https://site2.com')).toEqual(['*']);

      // Revoke permission
      browserExtensionService.revokePermission('https://site1.com');
      const updatedPermissions = browserExtensionService.getPermissionedSites();
      expect(updatedPermissions.has('https://site1.com')).toBe(false);
      expect(updatedPermissions.has('https://site2.com')).toBe(true);
    });

    it('should clear all permissions', () => {
      // Add some permissions
      browserExtensionService.grantPermission('https://site1.com', ['*']);
      browserExtensionService.grantPermission('https://site2.com', ['*']);

      // Clear all
      browserExtensionService.clearAll();

      // Verify all cleared
      const permissions = browserExtensionService.getPermissionedSites();
      expect(permissions.size).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit events on account change', async () => {
      const accountChangedHandler = jest.fn();
      browserExtensionService.on('accountChanged', accountChangedHandler);

      const request = {
        method: 'eth_requestAccounts',
        params: [],
        id: 1
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      await browserExtensionService.handleProviderRequest(request, mockSender);

      // The actual account created has this address
      expect(accountChangedHandler).toHaveBeenCalledWith('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should emit events on network change', async () => {
      const networkChangedHandler = jest.fn();
      browserExtensionService.on('networkChanged', networkChangedHandler);

      const request = {
        method: 'wallet_switchEthereumChain',
        params: [{
          chainId: '0x89' // Polygon
        }],
        id: 1
      };

      const mockSender = {
        tab: { id: 1, url: 'https://dapp.example.com' },
        origin: 'https://dapp.example.com'
      };

      await browserExtensionService.handleProviderRequest(request, mockSender);

      expect(networkChangedHandler).toHaveBeenCalledWith(137);
    });
  });
});