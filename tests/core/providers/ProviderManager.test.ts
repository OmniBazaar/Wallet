/**
 * Provider Manager Tests
 * Tests multi-chain provider management and operations
 */

import { providerManager } from '../../../src/core/providers/ProviderManager';
import { ChainType } from '../../../src/core/keyring/BIP39Keyring';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { createMockProvider, TEST_PASSWORD, TEST_ADDRESSES, cleanupTest } from '../../setup';
import { ethers } from 'ethers';

// Mock provider creation
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    providers: {
      ...actual.providers,
      JsonRpcProvider: jest.fn().mockImplementation(() => createMockProvider('ethereum'))
    }
  };
});

// Mock Solana connection
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL
    getRecentBlockhash: jest.fn().mockResolvedValue({
      blockhash: '11111111111111111111111111111111',
      feeCalculator: { lamportsPerSignature: 5000 }
    }),
    sendRawTransaction: jest.fn().mockResolvedValue('mockTxId'),
    confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } })
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({ toString: () => key })),
  Transaction: jest.fn(),
  SystemProgram: {
    transfer: jest.fn()
  },
  LAMPORTS_PER_SOL: 1000000000
}));

describe('ProviderManager', () => {
  beforeEach(async () => {
    await keyringService.createWallet(TEST_PASSWORD);
  });

  afterEach(() => {
    cleanupTest();
    providerManager['providers'].clear();
    providerManager['activeChain'] = ChainType.Ethereum;
    providerManager['activeNetwork'] = 'mainnet';
  });

  describe('Initialization', () => {
    it('should initialize with default network', async () => {
      await providerManager.initialize();
      
      expect(providerManager.getActiveChain()).toBe(ChainType.Ethereum);
      expect(providerManager.getActiveNetwork()).toBe('mainnet');
    });

    it('should initialize with specified network', async () => {
      await providerManager.initialize('polygon');
      
      expect(providerManager.getActiveChain()).toBe(ChainType.Ethereum);
      expect(providerManager.getActiveNetwork()).toBe('polygon');
    });

    it('should create providers for all chain types', async () => {
      await providerManager.initialize();
      
      const ethProvider = providerManager.getProvider(ChainType.Ethereum);
      const btcProvider = providerManager.getProvider(ChainType.Bitcoin);
      const solProvider = providerManager.getProvider(ChainType.Solana);
      const subProvider = providerManager.getProvider(ChainType.Substrate);
      
      expect(ethProvider).toBeTruthy();
      expect(btcProvider).toBeTruthy();
      expect(solProvider).toBeTruthy();
      expect(subProvider).toBeTruthy();
    });
  });

  describe('Chain Management', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should switch active chain', async () => {
      await providerManager.setActiveChain(ChainType.Solana);
      expect(providerManager.getActiveChain()).toBe(ChainType.Solana);
      
      await providerManager.setActiveChain(ChainType.Bitcoin);
      expect(providerManager.getActiveChain()).toBe(ChainType.Bitcoin);
    });

    it('should get supported networks for each chain', () => {
      const evmNetworks = providerManager.getSupportedNetworks(ChainType.Ethereum);
      expect(evmNetworks).toContain('ethereum');
      expect(evmNetworks).toContain('polygon');
      expect(evmNetworks).toContain('arbitrum');
      expect(evmNetworks).toContain('optimism');
      expect(evmNetworks.length).toBeGreaterThan(10);
      
      const btcNetworks = providerManager.getSupportedNetworks(ChainType.Bitcoin);
      expect(btcNetworks).toEqual(['mainnet', 'testnet']);
      
      const solNetworks = providerManager.getSupportedNetworks(ChainType.Solana);
      expect(solNetworks).toEqual(['mainnet-beta', 'testnet', 'devnet']);
      
      const subNetworks = providerManager.getSupportedNetworks(ChainType.Substrate);
      expect(subNetworks).toEqual(['polkadot', 'kusama', 'westend']);
    });

    it('should switch EVM networks', async () => {
      await providerManager.switchEVMNetwork('polygon');
      expect(providerManager.getActiveNetwork()).toBe('polygon');
      
      await providerManager.switchEVMNetwork('arbitrum');
      expect(providerManager.getActiveNetwork()).toBe('arbitrum');
    });

    it('should handle invalid network switch', async () => {
      await expect(
        providerManager.switchEVMNetwork('invalid-network')
      ).rejects.toThrow();
    });
  });

  describe('Balance Operations', () => {
    beforeEach(async () => {
      await providerManager.initialize();
      await keyringService.createAccount('ethereum', 'Test ETH');
      await keyringService.createAccount('solana', 'Test SOL');
    });

    it('should get balance for active account', async () => {
      const balance = await providerManager.getBalance();
      expect(balance).toBe('1000000000000000000'); // 1 ETH in wei
    });

    it('should get formatted balance', async () => {
      const balance = await providerManager.getFormattedBalance();
      expect(balance).toBe('1.0');
    });

    it('should get balance for specific address', async () => {
      const balance = await providerManager.getBalance(TEST_ADDRESSES.ethereum);
      expect(balance).toBe('1000000000000000000');
    });

    it('should get Solana balance', async () => {
      await providerManager.setActiveChain(ChainType.Solana);
      const balance = await providerManager.getBalance();
      expect(balance).toBe('1000000000'); // 1 SOL in lamports
    });

    it('should return zero balance for no active account', async () => {
      // Create a provider without accounts
      providerManager['getActiveAccount'] = jest.fn().mockReturnValue(null);
      
      const balance = await providerManager.getBalance();
      expect(balance).toBe('0');
    });
  });

  describe('Transaction Operations', () => {
    let ethAccount: any;
    let solAccount: any;

    beforeEach(async () => {
      await providerManager.initialize();
      ethAccount = await keyringService.createAccount('ethereum', 'ETH Account');
      solAccount = await keyringService.createAccount('solana', 'SOL Account');
    });

    it('should send Ethereum transaction', async () => {
      const txHash = await providerManager.sendTransaction(
        TEST_ADDRESSES.ethereum,
        '0.1'
      );
      
      expect(txHash).toBe('0x' + '1'.repeat(64));
      expect(createMockProvider('ethereum').sendTransaction).toHaveBeenCalled();
    });

    it('should send transaction with data', async () => {
      const txHash = await providerManager.sendTransaction(
        TEST_ADDRESSES.ethereum,
        '0',
        ChainType.Ethereum,
        '0x123456'
      );
      
      expect(txHash).toBeTruthy();
    });

    it('should send Solana transaction', async () => {
      await providerManager.setActiveChain(ChainType.Solana);
      
      const txHash = await providerManager.sendTransaction(
        TEST_ADDRESSES.solana,
        '0.1'
      );
      
      expect(txHash).toBe('mockTxId');
    });

    it('should estimate gas for Ethereum transaction', async () => {
      const gasEstimate = await providerManager.estimateGas(
        TEST_ADDRESSES.ethereum,
        '0.1'
      );
      
      expect(gasEstimate).toBe('21000');
    });

    it('should get gas price', async () => {
      const gasPrice = await providerManager.getGasPrice();
      expect(gasPrice).toBe('30000000000'); // 30 gwei
    });

    it('should throw error for unsupported chain transaction', async () => {
      await providerManager.setActiveChain(ChainType.Bitcoin);
      
      await expect(
        providerManager.sendTransaction(TEST_ADDRESSES.bitcoin, '0.1')
      ).rejects.toThrow('not implemented');
    });
  });

  describe('Network Information', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should get network details for all EVM networks', () => {
      const networks = [
        'ethereum', 'polygon', 'arbitrum', 'optimism', 'base',
        'bsc', 'avalanche', 'fantom', 'celo', 'moonbeam'
      ];
      
      networks.forEach(network => {
        const details = providerManager.getNetworkDetails(network);
        expect(details).toBeTruthy();
        expect(details.chainId).toBeTruthy();
        expect(details.name).toBeTruthy();
        expect(details.rpcUrl).toBeTruthy();
        expect(details.explorer).toBeTruthy();
        expect(details.nativeCurrency).toBeTruthy();
      });
    });

    it('should get current network details', async () => {
      const details = await providerManager.getCurrentNetworkDetails();
      
      expect(details.chainId).toBe(1);
      expect(details.name).toBe('Ethereum Mainnet');
      expect(details.nativeCurrency.symbol).toBe('ETH');
    });

    it('should get Solana network details', async () => {
      await providerManager.setActiveChain(ChainType.Solana);
      const details = await providerManager.getCurrentNetworkDetails();
      
      expect(details.name).toContain('Solana');
      expect(details.nativeCurrency.symbol).toBe('SOL');
    });
  });

  describe('Provider Events', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should handle provider events', () => {
      const provider = providerManager.getProvider(ChainType.Ethereum);
      const onSpy = jest.spyOn(provider, 'on');
      
      // Re-initialize to attach listeners
      providerManager['setupProviderListeners'](provider as any);
      
      expect(onSpy).toHaveBeenCalledWith('block', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('network', expect.any(Function));
    });

    it('should clean up listeners on provider switch', async () => {
      const provider = providerManager.getProvider(ChainType.Ethereum);
      const removeListenersSpy = jest.spyOn(provider, 'removeAllListeners');
      
      await providerManager.switchEVMNetwork('polygon');
      
      expect(removeListenersSpy).toHaveBeenCalled();
    });
  });

  describe('Multi-Provider Support', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should support all configured EVM chains', () => {
      const evmChains = [
        'ethereum', 'polygon', 'arbitrum', 'optimism', 'base',
        'bsc', 'avalanche', 'fantom', 'celo', 'moonbeam',
        'aurora', 'cronos', 'gnosis', 'klaytn', 'metis',
        'moonriver', 'boba', 'harmony', 'heco', 'okex'
      ];
      
      evmChains.forEach(chain => {
        const details = providerManager.getNetworkDetails(chain);
        expect(details).toBeTruthy();
        expect(details.rpcUrl).toBeTruthy();
      });
    });

    it('should validate chain and network compatibility', () => {
      expect(() => {
        providerManager['validateChainAndNetwork'](ChainType.Ethereum, 'polygon');
      }).not.toThrow();
      
      expect(() => {
        providerManager['validateChainAndNetwork'](ChainType.Solana, 'mainnet-beta');
      }).not.toThrow();
      
      expect(() => {
        providerManager['validateChainAndNetwork'](ChainType.Bitcoin, 'mainnet');
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await providerManager.initialize();
    });

    it('should handle provider connection errors', async () => {
      const provider = providerManager.getProvider(ChainType.Ethereum);
      provider.getBalance = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(
        providerManager.getBalance()
      ).rejects.toThrow('Connection failed');
    });

    it('should handle transaction errors', async () => {
      const provider = providerManager.getProvider(ChainType.Ethereum);
      provider.sendTransaction = jest.fn().mockRejectedValue(new Error('Insufficient funds'));
      
      await expect(
        providerManager.sendTransaction(TEST_ADDRESSES.ethereum, '100')
      ).rejects.toThrow('Insufficient funds');
    });

    it('should handle missing provider', () => {
      providerManager['providers'].clear();
      
      expect(() => {
        providerManager.getProvider(ChainType.Ethereum);
      }).toThrow('Provider not found');
    });
  });
});