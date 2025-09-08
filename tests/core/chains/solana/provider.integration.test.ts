/**
 * Solana Provider Integration Tests
 * Tests real Solana functionality without mocks
 */

import { SolanaProvider } from '../../../../src/core/chains/solana/provider';
import { SOLANA_NETWORKS, POPULAR_SPL_TOKENS } from '../../../../src/core/chains/solana/networks';
import { TEST_ADDRESSES } from '../../../setup';

// Skip these tests if not running integration tests
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === 'true';

// Use testnet for integration tests
const TESTNET_CONFIG = SOLANA_NETWORKS['testnet'];

describe('SolanaProvider Integration', () => {
  let provider: SolanaProvider;

  beforeEach(() => {
    provider = new SolanaProvider(TESTNET_CONFIG);
  });

  describe('Provider Setup', () => {
    it('should initialize with correct network', () => {
      expect(provider.getConfig()).toEqual(TESTNET_CONFIG);
      expect(provider.getConfig().name).toBe('Solana Testnet');
      expect(provider.getConfig().chainId).toBe('solana-testnet');
    });

    it('should switch networks', () => {
      const devnet = SOLANA_NETWORKS['devnet'];
      provider.switchNetwork(devnet);
      
      expect(provider.getConfig()).toEqual(devnet);
      expect(provider.getConfig().name).toBe('Solana Devnet');
    });
  });

  describe('Network Methods', () => {
    it('should get network details', () => {
      const details = provider.getNetworkDetails();
      
      expect(details).toEqual({
        name: 'Solana Testnet',
        chainId: 'solana-testnet',
        rpcUrl: TESTNET_CONFIG.rpcUrl,
        explorer: 'https://solscan.io?cluster=testnet',
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      });
    });

    it('should validate amount inputs', async () => {
      const mockPrivateKey = '5KJvsngHeMpm884wtkJNzHGaCKk4hF6pBCHpMBQ8u4AUE3N5s8RAbtfLLRhCqQ7rKNMx5D6bJjvMfPg5bnxv3jqD';
      
      await expect(
        provider.sendSOL(mockPrivateKey, TEST_ADDRESSES.solana, -1)
      ).rejects.toThrow('Invalid amount');
      
      await expect(
        provider.sendSOL(mockPrivateKey, TEST_ADDRESSES.solana, 0)
      ).rejects.toThrow('Invalid amount');
    });
  });

  describe('Token Metadata', () => {
    it('should get popular token info', () => {
      const usdc = provider.getPopularTokenInfo('USDC');
      expect(usdc).toEqual({
        mint: POPULAR_SPL_TOKENS.USDC.mint,
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin'
      });
      
      const usdt = provider.getPopularTokenInfo('USDT');
      expect(usdt).toBeTruthy();
      expect(usdt?.symbol).toBe('USDT');
    });

    it('should return null for unknown token', () => {
      const unknown = provider.getPopularTokenInfo('UNKNOWN_TOKEN_XYZ');
      expect(unknown).toBeNull();
    });
  });

  // Skip network-dependent tests in CI or when offline
  describe.skip('Network Operations', () => {
    it('should get recent blockhash', async () => {
      const blockhash = await provider.getRecentBlockhash();
      expect(blockhash).toBeDefined();
      expect(typeof blockhash).toBe('string');
      expect(blockhash.length).toBeGreaterThan(0);
    }, 10000);

    it('should estimate transaction fee', async () => {
      const fee = await provider.estimateFee();
      expect(fee).toBeDefined();
      expect(typeof fee).toBe('string');
      const feeNum = parseFloat(fee);
      expect(feeNum).toBeGreaterThan(0);
      expect(feeNum).toBeLessThan(0.1); // Fee should be less than 0.1 SOL
    }, 10000);

    it('should get SOL balance', async () => {
      // Use a well-known testnet address
      const testAddress = 'So11111111111111111111111111111111111111112';
      
      const balance = await provider.getBalance(testAddress);
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    }, 10000);
  });
});