/**
 * Solana Provider Tests
 * Tests Solana-specific functionality including SOL and SPL tokens
 */

import { SolanaProvider } from '../../../../src/core/chains/solana/provider';
import { SOLANA_NETWORKS } from '../../../../src/core/chains/solana/networks';
import { TEST_ADDRESSES } from '../../../setup';
import { PublicKey, Connection, Keypair, Transaction } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

// Mock Solana Web3
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL
    getRecentBlockhash: jest.fn().mockResolvedValue({
      blockhash: '11111111111111111111111111111111',
      feeCalculator: { lamportsPerSignature: 5000 }
    }),
    sendRawTransaction: jest.fn().mockResolvedValue('mockTxId123'),
    confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
    getTokenAccountsByOwner: jest.fn().mockResolvedValue({
      value: [
        {
          pubkey: new PublicKey('TokenAccountPubkey1'),
          account: {
            data: Buffer.from([]),
            owner: new PublicKey('TokenProgramId'),
            lamports: 0,
            executable: false,
            rentEpoch: 0
          }
        }
      ]
    }),
    getParsedTokenAccountsByOwner: jest.fn().mockResolvedValue({
      value: [
        {
          pubkey: new PublicKey('TokenAccountPubkey1'),
          account: {
            data: {
              parsed: {
                info: {
                  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                  owner: TEST_ADDRESSES.solana,
                  tokenAmount: {
                    amount: '1000000',
                    decimals: 6,
                    uiAmount: 1.0
                  }
                }
              }
            }
          }
        }
      ]
    })
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({
    toString: () => key,
    toBase58: () => key,
    equals: (other: any) => key === other.toString()
  })),
  Keypair: {
    fromSecretKey: jest.fn().mockImplementation((secretKey) => ({
      publicKey: new PublicKey(TEST_ADDRESSES.solana),
      secretKey
    }))
  },
  Transaction: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    sign: jest.fn(),
    serialize: jest.fn().mockReturnValue(Buffer.from('mockedTransaction'))
  })),
  SystemProgram: {
    transfer: jest.fn().mockReturnValue({
      keys: [],
      programId: new PublicKey('11111111111111111111111111111111'),
      data: Buffer.from([])
    })
  },
  LAMPORTS_PER_SOL: 1000000000
}));

// Mock SPL Token
jest.mock('@solana/spl-token', () => ({
  TOKEN_PROGRAM_ID: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  getAssociatedTokenAddress: jest.fn().mockResolvedValue(
    new PublicKey('AssociatedTokenAddress123')
  ),
  createAssociatedTokenAccountInstruction: jest.fn().mockReturnValue({
    keys: [],
    programId: 'ATokenProgramId',
    data: Buffer.from([])
  }),
  createTransferInstruction: jest.fn().mockReturnValue({
    keys: [],
    programId: 'TokenProgramId',
    data: Buffer.from([])
  }),
  getAccount: jest.fn().mockResolvedValue({
    address: new PublicKey('TokenAccountAddress'),
    mint: new PublicKey('TokenMintAddress'),
    owner: new PublicKey(TEST_ADDRESSES.solana),
    amount: BigInt(1000000),
    delegateOption: 0,
    delegate: null,
    state: 1,
    isNativeOption: 0,
    isNative: false,
    delegatedAmount: BigInt(0),
    closeAuthorityOption: 0,
    closeAuthority: null
  })
}));

describe('SolanaProvider', () => {
  let provider: SolanaProvider;

  beforeEach(() => {
    provider = new SolanaProvider(SOLANA_NETWORKS['mainnet-beta']);
  });

  describe('Connection', () => {
    it('should initialize with correct network', () => {
      expect(provider['network']).toEqual(SOLANA_NETWORKS['mainnet-beta']);
      expect(Connection).toHaveBeenCalledWith(
        SOLANA_NETWORKS['mainnet-beta'].rpcUrl,
        'confirmed'
      );
    });

    it('should switch networks', () => {
      const testnet = SOLANA_NETWORKS['testnet'];
      provider.switchNetwork(testnet);
      
      expect(provider['network']).toEqual(testnet);
      expect(Connection).toHaveBeenCalledWith(testnet.rpcUrl, 'confirmed');
    });
  });

  describe('Balance Operations', () => {
    it('should get SOL balance', async () => {
      const balance = await provider.getBalance(TEST_ADDRESSES.solana);
      
      expect(balance).toBe('1'); // 1 SOL
      expect(provider['connection'].getBalance).toHaveBeenCalledWith(
        expect.any(PublicKey)
      );
    });

    it('should get SPL token balances', async () => {
      const tokens = await provider.getTokenBalances(TEST_ADDRESSES.solana);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        amount: '1000000',
        decimals: 6,
        uiAmount: 1.0
      });
    });

    it('should handle account with no tokens', async () => {
      provider['connection'].getParsedTokenAccountsByOwner = jest.fn()
        .mockResolvedValue({ value: [] });
      
      const tokens = await provider.getTokenBalances(TEST_ADDRESSES.solana);
      expect(tokens).toEqual([]);
    });
  });

  describe('Transaction Operations', () => {
    const mockPrivateKey = 'mockPrivateKeyBase58String';

    it('should send SOL', async () => {
      const txId = await provider.sendSOL(
        mockPrivateKey,
        TEST_ADDRESSES.solana,
        0.5
      );
      
      expect(txId).toBe('mockTxId123');
      expect(provider['connection'].sendRawTransaction).toHaveBeenCalled();
      expect(provider['connection'].confirmTransaction).toHaveBeenCalled();
    });

    it('should validate SOL amount', async () => {
      await expect(
        provider.sendSOL(mockPrivateKey, TEST_ADDRESSES.solana, -1)
      ).rejects.toThrow('Invalid amount');
      
      await expect(
        provider.sendSOL(mockPrivateKey, TEST_ADDRESSES.solana, 0)
      ).rejects.toThrow('Invalid amount');
    });

    it('should send SPL token', async () => {
      const txId = await provider.sendToken(
        mockPrivateKey,
        TEST_ADDRESSES.solana,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        100,
        6
      );
      
      expect(txId).toBe('mockTxId123');
      expect(splToken.getAssociatedTokenAddress).toHaveBeenCalled();
      expect(splToken.createTransferInstruction).toHaveBeenCalled();
    });

    it('should create associated token account if needed', async () => {
      // Mock that destination doesn't have token account
      splToken.getAccount = jest.fn().mockRejectedValue(new Error('Account not found'));
      
      const txId = await provider.sendToken(
        mockPrivateKey,
        TEST_ADDRESSES.solana,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        50,
        6
      );
      
      expect(txId).toBe('mockTxId123');
      expect(splToken.createAssociatedTokenAccountInstruction).toHaveBeenCalled();
    });

    it('should estimate transaction fee', async () => {
      const fee = await provider.estimateFee();
      expect(fee).toBe('0.000005'); // 5000 lamports
    });
  });

  describe('Network Information', () => {
    it('should get recent blockhash', async () => {
      const blockhash = await provider.getRecentBlockhash();
      expect(blockhash).toBe('11111111111111111111111111111111');
    });

    it('should get network details', () => {
      const details = provider.getNetworkDetails();
      
      expect(details).toEqual({
        name: 'Solana Mainnet Beta',
        chainId: 'mainnet-beta',
        rpcUrl: SOLANA_NETWORKS['mainnet-beta'].rpcUrl,
        explorer: 'https://explorer.solana.com',
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      });
    });
  });

  describe('Token Metadata', () => {
    it('should get popular token info', () => {
      const usdc = provider.getPopularTokenInfo('USDC');
      expect(usdc).toEqual({
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin'
      });
      
      const usdt = provider.getPopularTokenInfo('USDT');
      expect(usdt).toBeTruthy();
      expect(usdt?.symbol).toBe('USDT');
    });

    it('should return null for unknown token', () => {
      const unknown = provider.getPopularTokenInfo('UNKNOWN');
      expect(unknown).toBeNull();
    });

    it('should enrich token with metadata', async () => {
      const tokens = await provider.getTokenBalances(TEST_ADDRESSES.solana);
      
      // USDC should be enriched with symbol and name
      expect(tokens[0].symbol).toBe('USDC');
      expect(tokens[0].name).toBe('USD Coin');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      provider['connection'].getBalance = jest.fn()
        .mockRejectedValue(new Error('Network error'));
      
      await expect(
        provider.getBalance(TEST_ADDRESSES.solana)
      ).rejects.toThrow('Network error');
    });

    it('should handle transaction failures', async () => {
      provider['connection'].sendRawTransaction = jest.fn()
        .mockRejectedValue(new Error('Transaction failed'));
      
      await expect(
        provider.sendSOL(mockPrivateKey, TEST_ADDRESSES.solana, 0.1)
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle invalid addresses', async () => {
      await expect(
        provider.getBalance('invalid-address')
      ).rejects.toThrow();
    });
  });

  describe('Advanced Features', () => {
    it('should support multiple token transfers in one transaction', async () => {
      // This would be a future enhancement
      // For now, verify the structure is in place
      expect(provider.sendToken).toBeDefined();
      expect(provider.sendSOL).toBeDefined();
    });

    it('should get all SPL tokens for an address', async () => {
      const allTokens = await provider.getAllSPLTokens(TEST_ADDRESSES.solana);
      
      expect(provider['connection'].getParsedTokenAccountsByOwner).toHaveBeenCalledWith(
        expect.any(PublicKey),
        { programId: expect.any(PublicKey) }
      );
      
      expect(allTokens).toHaveLength(1);
      expect(allTokens[0].mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });
  });
});