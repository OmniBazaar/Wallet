/**
 * Solana Provider Unit Tests
 * Tests core functionality without network calls
 */

import { SolanaProvider, SolanaNetworkConfig } from '../../../../src/core/chains/solana/provider';
import { SOLANA_NETWORKS, POPULAR_SPL_TOKENS } from '../../../../src/core/chains/solana/networks';

// Test configuration
const TEST_CONFIG: SolanaNetworkConfig = {
  name: 'Test Network',
  chainId: 'test-chain',
  currency: 'SOL',
  rpcUrl: 'https://test.example.com',
  wsUrl: 'wss://test.example.com',
  commitment: 'confirmed',
  blockExplorerUrls: ['https://explorer.test.com']
};

describe('SolanaProvider Unit Tests', () => {
  describe('Provider Configuration', () => {
    it('should create provider with config', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const config = provider.getConfig();
      
      expect(config.name).toBe('Test Network');
      expect(config.chainId).toBe('test-chain');
      expect(config.currency).toBe('SOL');
      expect(config.rpcUrl).toBe('https://test.example.com');
    });

    it('should handle config without optional fields', () => {
      const minimalConfig: SolanaNetworkConfig = {
        name: 'Minimal',
        chainId: 'minimal',
        currency: 'SOL',
        rpcUrl: 'https://minimal.example.com'
      };
      
      const provider = new SolanaProvider(minimalConfig);
      expect(provider.getConfig()).toEqual(minimalConfig);
    });

    it('should switch networks', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const newConfig = SOLANA_NETWORKS['devnet'];
      
      provider.switchNetwork(newConfig);
      
      expect(provider.getConfig()).toEqual(newConfig);
      expect(provider.getName()).toBe('Solana Devnet');
    });
  });

  describe('Network Information', () => {
    it('should get network details', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const details = provider.getNetworkDetails();
      
      expect(details).toEqual({
        name: 'Test Network',
        chainId: 'test-chain',
        rpcUrl: 'https://test.example.com',
        explorer: 'https://explorer.test.com',
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      });
    });

    it('should provide default explorer URL', () => {
      const configNoExplorer: SolanaNetworkConfig = {
        ...TEST_CONFIG,
        blockExplorerUrls: undefined
      };
      
      const provider = new SolanaProvider(configNoExplorer);
      const details = provider.getNetworkDetails();
      
      expect(details.explorer).toBe('https://explorer.solana.com');
    });

    it('should get currency symbol', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      expect(provider.getCurrency()).toBe('SOL');
    });

    it('should get RPC URL', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      expect(provider.getRpcUrl()).toBe('https://test.example.com');
    });
  });

  describe('Token Metadata', () => {
    it('should get popular token info for USDC', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const usdc = provider.getPopularTokenInfo('USDC');
      
      expect(usdc).toBeDefined();
      expect(usdc?.symbol).toBe('USDC');
      expect(usdc?.name).toBe('USD Coin');
      expect(usdc?.mint).toBe(POPULAR_SPL_TOKENS.USDC.mint);
      expect(usdc?.decimals).toBe(6);
    });

    it('should get popular token info for multiple tokens', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const tokens = ['USDT', 'RAY', 'BONK', 'JTO', 'PYTH', 'JUP', 'WIF'];
      
      tokens.forEach(symbol => {
        const token = provider.getPopularTokenInfo(symbol);
        expect(token).toBeDefined();
        expect(token?.symbol).toBe(symbol);
        expect(token?.decimals).toBeGreaterThanOrEqual(5);
        expect(token?.decimals).toBeLessThanOrEqual(9);
      });
    });

    it('should return null for unknown token', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const unknown = provider.getPopularTokenInfo('UNKNOWN_TOKEN_XYZ');
      expect(unknown).toBeNull();
    });

    it('should handle case-sensitive token symbols', () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      
      // These should work (exact case)
      expect(provider.getPopularTokenInfo('USDC')).toBeDefined();
      
      // These should not work (wrong case)
      expect(provider.getPopularTokenInfo('usdc')).toBeNull();
      expect(provider.getPopularTokenInfo('Usdc')).toBeNull();
    });
  });

  describe('Input Validation', () => {
    it('should validate SOL transfer amounts', async () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const mockPrivateKey = 'mock-private-key';
      const mockAddress = '11111111111111111111111111111111';
      
      // Should reject negative amounts
      await expect(
        provider.sendSOL(mockPrivateKey, mockAddress, -1)
      ).rejects.toThrow('Invalid amount');
      
      // Should reject zero amounts
      await expect(
        provider.sendSOL(mockPrivateKey, mockAddress, 0)
      ).rejects.toThrow('Invalid amount');
      
      // Should reject NaN
      await expect(
        provider.sendSOL(mockPrivateKey, mockAddress, NaN)
      ).rejects.toThrow('Invalid amount');
    });

    it('should validate token transfer amounts', async () => {
      const provider = new SolanaProvider(TEST_CONFIG);
      const mockPrivateKey = 'mock-private-key';
      const mockAddress = '11111111111111111111111111111111';
      const mockMint = POPULAR_SPL_TOKENS.USDC.mint;
      
      // Should reject negative amounts
      await expect(
        provider.sendToken(mockPrivateKey, mockAddress, mockMint, -1, 6)
      ).rejects.toThrow('Invalid amount');
      
      // Should reject zero amounts
      await expect(
        provider.sendToken(mockPrivateKey, mockAddress, mockMint, 0, 6)
      ).rejects.toThrow('Invalid amount');
    });
  });

  describe('Real Networks', () => {
    it('should have proper mainnet configuration', () => {
      const mainnet = SOLANA_NETWORKS['mainnet-beta'];
      const provider = new SolanaProvider(mainnet);
      
      expect(provider.getName()).toBe('Solana Mainnet');
      expect(provider.getRpcUrl()).toContain('mainnet');
      expect(provider.getConfig().commitment).toBe('confirmed');
    });

    it('should have proper devnet configuration', () => {
      const devnet = SOLANA_NETWORKS['devnet'];
      const provider = new SolanaProvider(devnet);
      
      expect(provider.getName()).toBe('Solana Devnet');
      expect(provider.getRpcUrl()).toContain('devnet');
      expect(provider.getConfig().wsUrl).toContain('wss://');
    });

    it('should have proper testnet configuration', () => {
      const testnet = SOLANA_NETWORKS['testnet'];
      const provider = new SolanaProvider(testnet);
      
      expect(provider.getName()).toBe('Solana Testnet');
      expect(provider.getRpcUrl()).toContain('testnet');
      expect(provider.getConfig().blockExplorerUrls).toBeDefined();
      expect(provider.getConfig().blockExplorerUrls?.[0]).toContain('solscan.io');
    });
  });
});