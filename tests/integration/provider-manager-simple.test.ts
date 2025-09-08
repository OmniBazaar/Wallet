/**
 * Simple ProviderManager Test
 * Focus on testing the core functionality without complex dependencies
 */

import { providerManager, ChainType } from '../../src/core/providers/ProviderManager';

describe('ProviderManager Core Functionality', () => {
  beforeAll(async () => {
    // Initialize the provider manager
    await providerManager.initialize('testnet');
  });

  describe('Method Availability', () => {
    it('should have setActiveChain method', () => {
      expect(typeof providerManager.setActiveChain).toBe('function');
    });

    it('should have getActiveChain method', () => {
      expect(typeof providerManager.getActiveChain).toBe('function');
    });

    it('should have getActiveProvider method', () => {
      expect(typeof providerManager.getActiveProvider).toBe('function');
    });

    it('should have getCurrentNetworkDetails method', () => {
      expect(typeof providerManager.getCurrentNetworkDetails).toBe('function');
    });

    it('should have getFormattedBalance method', () => {
      expect(typeof providerManager.getFormattedBalance).toBe('function');
    });

    it('should have estimateGas method', () => {
      expect(typeof providerManager.estimateGas).toBe('function');
    });
  });

  describe('Chain Switching', () => {
    it('should switch chains using ChainType constants', async () => {
      // Test switching to different chains
      await providerManager.setActiveChain(ChainType.Ethereum);
      expect(providerManager.getActiveChain()).toBe(ChainType.Ethereum);

      await providerManager.setActiveChain(ChainType.Solana);
      expect(providerManager.getActiveChain()).toBe(ChainType.Solana);

      await providerManager.setActiveChain(ChainType.Bitcoin);
      expect(providerManager.getActiveChain()).toBe(ChainType.Bitcoin);
    });

    it('should get active provider after chain switch', async () => {
      await providerManager.setActiveChain(ChainType.Ethereum);
      const provider = providerManager.getActiveProvider();
      expect(provider).not.toBeNull();
    });
  });

  describe('Network Details', () => {
    it('should get network details', async () => {
      await providerManager.setActiveChain(ChainType.Ethereum);
      const networkDetails = await providerManager.getCurrentNetworkDetails();
      
      expect(networkDetails).toBeDefined();
      expect(networkDetails.name).toBeDefined();
      expect(networkDetails.chainId).toBeDefined();
      expect(networkDetails.nativeCurrency).toBeDefined();
      expect(networkDetails.nativeCurrency.name).toBeDefined();
      expect(networkDetails.nativeCurrency.symbol).toBeDefined();
      expect(networkDetails.nativeCurrency.decimals).toBeDefined();
    });
  });

  describe('Balance Operations', () => {
    it('should get formatted balance', async () => {
      await providerManager.setActiveChain(ChainType.Ethereum);
      const balance = await providerManager.getFormattedBalance();
      
      expect(typeof balance).toBe('string');
      expect(balance.length).toBeGreaterThan(0);
    });

    it('should get balance for different chains', async () => {
      const chains = [ChainType.Ethereum, ChainType.Solana, ChainType.Bitcoin];
      
      for (const chain of chains) {
        await providerManager.setActiveChain(chain);
        const balance = await providerManager.getBalance();
        expect(typeof balance).toBe('string');
        expect(balance.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Gas Estimation', () => {
    it('should estimate gas for transactions', async () => {
      await providerManager.setActiveChain(ChainType.Ethereum);
      const gasEstimate = await providerManager.estimateGas(
        '0x1234567890123456789012345678901234567890',
        '1.0'
      );
      
      expect(typeof gasEstimate).toBe('string');
      expect(parseInt(gasEstimate)).toBeGreaterThan(0);
    });
  });

  describe('EVM Network Switching', () => {
    it('should switch EVM networks', async () => {
      const networks = ['ethereum', 'polygon', 'arbitrum'];
      
      for (const network of networks) {
        await providerManager.switchEVMNetwork(network);
        expect(providerManager.getActiveNetwork()).toBe(network);
      }
    });

    it('should get available EVM networks', () => {
      const networks = providerManager.getAvailableEVMNetworks();
      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBeGreaterThan(0);
    });
  });

  describe('Chain Support', () => {
    it('should get supported chains', () => {
      const supportedChains = providerManager.getSupportedChains();
      expect(Array.isArray(supportedChains)).toBe(true);
      expect(supportedChains).toContain(ChainType.Ethereum);
      expect(supportedChains).toContain(ChainType.Bitcoin);
      expect(supportedChains).toContain(ChainType.Solana);
    });

    it('should get chain configuration', () => {
      const ethConfig = providerManager.getChainConfig(ChainType.Ethereum);
      expect(ethConfig).toBeDefined();
      expect(ethConfig?.chainType).toBe(ChainType.Ethereum);
      expect(ethConfig?.name).toBeDefined();
    });
  });
});