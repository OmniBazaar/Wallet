/**
 * Provider Manager Tests with Real Implementations
 * Tests multi-chain provider management without mocks
 */

// Clear all mocks before importing modules to get real implementations
jest.unmock('ethers');
jest.unmock('../../../src/core/chains/ethereum/live-provider');
jest.unmock('../../../src/core/chains/solana/live-provider');
jest.unmock('../../../src/core/chains/bitcoin/live-provider');
jest.unmock('../../../src/core/chains/polkadot/live-provider');
jest.unmock('../../../src/core/chains/coti/live-provider');
jest.unmock('../../../src/core/chains/omnicoin/live-provider');
jest.unmock('../../../src/core/chains/evm/index');
jest.unmock('@solana/web3.js');

import { ProviderManager } from '../../../src/core/providers/ProviderManager';
import { ChainType } from '../../../src/core/keyring/BIP39Keyring';
import { keyringService } from '../../../src/core/keyring/KeyringService';
import { TEST_PASSWORD, TEST_MNEMONIC, TEST_ADDRESSES, cleanupTest } from '../../setup';
import { ethers } from 'ethers';

// Create a new instance for testing with real providers
const providerManager = ProviderManager.getInstance();

describe('ProviderManager - Real Implementation', () => {
  beforeAll(async () => {
    // Initialize keyring with test mnemonic
    await keyringService.restoreWallet(TEST_MNEMONIC, TEST_PASSWORD);
  });

  afterAll(() => {
    cleanupTest();
  });

  describe('Real Provider Initialization', () => {
    it('should initialize with real providers for all chains', async () => {
      // Initialize provider manager
      providerManager.initialize('mainnet');

      // Check that providers are created for all chains
      const ethProvider = providerManager.getProvider(ChainType.ETHEREUM);
      const btcProvider = providerManager.getProvider(ChainType.BITCOIN);
      const solProvider = providerManager.getProvider(ChainType.SOLANA);
      const subProvider = providerManager.getProvider(ChainType.SUBSTRATE);
      const cotiProvider = providerManager.getProvider(ChainType.COTI);
      const omniProvider = providerManager.getProvider(ChainType.OMNICOIN);

      expect(ethProvider).toBeTruthy();
      expect(btcProvider).toBeTruthy();
      expect(solProvider).toBeTruthy();
      expect(subProvider).toBeTruthy();
      expect(cotiProvider).toBeTruthy();
      expect(omniProvider).toBeTruthy();

      // Verify they are real provider instances, not mocks
      expect(ethProvider?.constructor.name).toBe('LiveEthereumProvider');
      expect(btcProvider?.constructor.name).toBe('LiveBitcoinProvider');
      expect(solProvider?.constructor.name).toBe('LiveSolanaProvider');
      expect(subProvider?.constructor.name).toBe('LivePolkadotProvider');
      expect(cotiProvider?.constructor.name).toBe('LiveCOTIProvider');
      expect(omniProvider?.constructor.name).toBe('LiveOmniCoinProvider');
    });

    it('should initialize EVM providers for all supported networks', () => {
      // Check that all EVM networks have providers
      const evmNetworks = providerManager.getSupportedNetworks(ChainType.ETHEREUM);
      expect(evmNetworks.length).toBeGreaterThan(20); // We support 20+ EVM networks

      // Check specific major networks
      const majorNetworks = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];
      majorNetworks.forEach(network => {
        const provider = providerManager.getEVMProvider(network);
        expect(provider).toBeTruthy();
        expect(provider?.constructor.name).toBe('MultiChainEVMProvider');
      });
    });
  });

  describe('Real Network Details', () => {
    it('should return correct network details for all EVM networks', () => {
      const networks = [
        { key: 'ethereum', chainId: 1, currency: 'ETH' },
        { key: 'polygon', chainId: 137, currency: 'MATIC' },
        { key: 'arbitrum', chainId: 42161, currency: 'ETH' },
        { key: 'optimism', chainId: 10, currency: 'ETH' },
        { key: 'base', chainId: 8453, currency: 'ETH' },
        { key: 'bsc', chainId: 56, currency: 'BNB' },
        { key: 'avalanche', chainId: 43114, currency: 'AVAX' },
        { key: 'fantom', chainId: 250, currency: 'FTM' },
        { key: 'gnosis', chainId: 100, currency: 'xDAI' },
        { key: 'celo', chainId: 42220, currency: 'CELO' },
        { key: 'moonbeam', chainId: 1284, currency: 'GLMR' },
        { key: 'aurora', chainId: 1313161554, currency: 'ETH' },
        { key: 'cronos', chainId: 25, currency: 'CRO' },
        { key: 'metis', chainId: 1088, currency: 'METIS' },
        { key: 'harmony', chainId: 1666600000, currency: 'ONE' },
      ];

      networks.forEach(({ key, chainId, currency }) => {
        const details = providerManager.getNetworkDetails(key);
        expect(details).toBeTruthy();
        expect(details.chainId).toBe(chainId);
        expect(details.currency).toBe(currency);
        expect(details.rpcUrl).toBeTruthy();
        expect(details.explorer).toBeTruthy();
      });
    });

    it('should return correct chain configurations', () => {
      const chains = [
        ChainType.ETHEREUM,
        ChainType.BITCOIN,
        ChainType.SOLANA,
        ChainType.SUBSTRATE,
        ChainType.COTI,
        ChainType.OMNICOIN
      ];

      chains.forEach(chain => {
        const config = providerManager.getChainConfig(chain);
        expect(config).toBeTruthy();
        expect(config?.chainType).toBe(chain);
        expect(config?.name).toBeTruthy();
        expect(config?.networks.length).toBeGreaterThan(0);
        expect(config?.defaultNetwork).toBeTruthy();
      });
    });
  });

  describe('Real Provider Switching', () => {
    it('should switch between EVM networks correctly', async () => {
      // Start with Ethereum
      expect(providerManager.getActiveNetwork()).toBe('mainnet');

      // Switch to Polygon
      providerManager.switchEVMNetwork('polygon');
      expect(providerManager.getActiveNetwork()).toBe('polygon');
      let details = providerManager.getNetworkDetails('polygon');
      expect(details.chainId).toBe(137);
      expect(details.currency).toBe('MATIC');

      // Switch to Arbitrum
      providerManager.switchEVMNetwork('arbitrum');
      expect(providerManager.getActiveNetwork()).toBe('arbitrum');
      details = providerManager.getNetworkDetails('arbitrum');
      expect(details.chainId).toBe(42161);
      expect(details.currency).toBe('ETH');

      // Switch to BSC
      providerManager.switchEVMNetwork('bsc');
      expect(providerManager.getActiveNetwork()).toBe('bsc');
      details = providerManager.getNetworkDetails('bsc');
      expect(details.chainId).toBe(56);
      expect(details.currency).toBe('BNB');
    });

    it('should switch between different chain types', async () => {
      // Switch to Solana
      await providerManager.setActiveChain(ChainType.SOLANA);
      expect(providerManager.getActiveChain()).toBe(ChainType.SOLANA);

      // Switch to Bitcoin
      await providerManager.setActiveChain(ChainType.BITCOIN);
      expect(providerManager.getActiveChain()).toBe(ChainType.BITCOIN);

      // Switch back to Ethereum
      await providerManager.setActiveChain(ChainType.ETHEREUM);
      expect(providerManager.getActiveChain()).toBe(ChainType.ETHEREUM);
    });
  });

  describe('Real Network Connectivity', () => {
    it('should get correct network details from active provider', async () => {
      // Set to Ethereum mainnet
      await providerManager.setActiveChain(ChainType.ETHEREUM);
      providerManager.switchEVMNetwork('ethereum');

      const details = await providerManager.getCurrentNetworkDetails();
      expect(details.name).toBe('Ethereum Mainnet');
      expect(details.chainId).toBe(1);
      expect(details.nativeCurrency.symbol).toBe('ETH');
      expect(details.nativeCurrency.decimals).toBe(18);
    });

    it('should handle Solana network details', async () => {
      await providerManager.setActiveChain(ChainType.SOLANA);
      const details = await providerManager.getCurrentNetworkDetails();

      expect(details.name).toContain('Solana');
      expect(details.nativeCurrency.symbol).toBe('SOL');
      expect(details.nativeCurrency.decimals).toBe(9);
    });

    it('should handle Bitcoin network details', async () => {
      await providerManager.setActiveChain(ChainType.BITCOIN);
      const details = await providerManager.getCurrentNetworkDetails();

      expect(details.name).toContain('Bitcoin');
      expect(details.nativeCurrency.symbol).toBe('BTC');
      expect(details.nativeCurrency.decimals).toBe(8);
    });
  });

  describe('Real Balance Operations', () => {
    it('should handle balance queries for different chains', async () => {
      // Note: These will return 0 for addresses without real balances
      // This tests the real provider connectivity

      // Ethereum balance
      await providerManager.setActiveChain(ChainType.ETHEREUM);
      const ethBalance = await providerManager.getBalance();
      expect(ethBalance).toBeDefined();
      expect(typeof ethBalance).toBe('string');

      // Solana balance
      await providerManager.setActiveChain(ChainType.SOLANA);
      const solBalance = await providerManager.getBalance();
      expect(solBalance).toBeDefined();
      expect(typeof solBalance).toBe('string');
    });

    it('should format balances correctly', async () => {
      await providerManager.setActiveChain(ChainType.ETHEREUM);
      const formattedBalance = await providerManager.getFormattedBalance();
      expect(formattedBalance).toBeDefined();
      expect(typeof formattedBalance).toBe('string');
      // Even with 0 balance, should return "0" or "0.0"
      expect(formattedBalance).toMatch(/^\d+(\.\d+)?$/);
    });
  });

  describe('Real Transaction Handling', () => {
    it('should estimate gas for Ethereum transactions', async () => {
      await providerManager.setActiveChain(ChainType.ETHEREUM);

      // Simple transfer estimation
      const gasEstimate = await providerManager.estimateGas(
        '0x0000000000000000000000000000000000000000', // Null address
        '0.1'
      );

      expect(gasEstimate).toBeDefined();
      expect(typeof gasEstimate).toBe('string');
      expect(BigInt(gasEstimate)).toBeGreaterThan(0n);
    });

    it('should get gas price', async () => {
      await providerManager.setActiveChain(ChainType.ETHEREUM);

      const gasPrice = await providerManager.getGasPrice();
      expect(gasPrice).toBeDefined();
      expect(typeof gasPrice).toBe('string');
      expect(BigInt(gasPrice)).toBeGreaterThan(0n);
    });

    it('should handle transaction errors gracefully', async () => {
      await providerManager.setActiveChain(ChainType.BITCOIN);

      await expect(
        providerManager.sendTransaction(TEST_ADDRESSES.bitcoin, '0.1')
      ).rejects.toThrow('Bitcoin transactions not implemented');
    });
  });

  describe('Real Feature Support', () => {
    it('should correctly identify supported features', () => {
      // Check privacy support
      expect(providerManager.isFeatureSupported(ChainType.COTI, 'privacy')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.OMNICOIN, 'privacy')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.ETHEREUM, 'privacy')).toBe(false);

      // Check staking support
      expect(providerManager.isFeatureSupported(ChainType.OMNICOIN, 'staking')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.SUBSTRATE, 'staking')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.BITCOIN, 'staking')).toBe(false);

      // Check NFT support
      expect(providerManager.isFeatureSupported(ChainType.ETHEREUM, 'nft')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.SOLANA, 'nft')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.BITCOIN, 'nft')).toBe(false);

      // Check marketplace support
      expect(providerManager.isFeatureSupported(ChainType.OMNICOIN, 'marketplace')).toBe(true);
      expect(providerManager.isFeatureSupported(ChainType.ETHEREUM, 'marketplace')).toBe(false);
    });
  });

  describe('Real Provider Instance Management', () => {
    it('should reuse provider instances for same network', () => {
      const provider1 = providerManager.getEVMProvider('polygon');
      const provider2 = providerManager.getEVMProvider('polygon');

      // Should be the same instance
      expect(provider1).toBe(provider2);
    });

    it('should create different instances for different networks', () => {
      const polygonProvider = providerManager.getEVMProvider('polygon');
      const arbitrumProvider = providerManager.getEVMProvider('arbitrum');

      // Should be different instances
      expect(polygonProvider).not.toBe(arbitrumProvider);

      // But both should be MultiChainEVMProvider
      expect(polygonProvider?.constructor.name).toBe('MultiChainEVMProvider');
      expect(arbitrumProvider?.constructor.name).toBe('MultiChainEVMProvider');
    });
  });

  describe('Real Error Handling', () => {
    it('should handle invalid network names', () => {
      expect(() => {
        providerManager.switchEVMNetwork('invalid-network-name');
      }).toThrow('Unknown EVM network');
    });

    it('should handle invalid chain types', () => {
      expect(() => {
        providerManager.setActiveChain('invalid-chain' as ChainType);
      }).toThrow('Unsupported chain');
    });

    it('should handle missing providers gracefully', () => {
      const provider = providerManager.getEVMProvider('non-existent-network');
      expect(provider).toBeNull();
    });
  });

  describe('Network Type Switching', () => {
    it('should switch between mainnet and testnet', () => {
      // Start with mainnet
      expect(providerManager.getNetworkType()).toBe('mainnet');

      // Switch to testnet
      providerManager.switchNetworkType('testnet');
      expect(providerManager.getNetworkType()).toBe('testnet');

      // Switch back to mainnet
      providerManager.switchNetworkType('mainnet');
      expect(providerManager.getNetworkType()).toBe('mainnet');
    });
  });
});