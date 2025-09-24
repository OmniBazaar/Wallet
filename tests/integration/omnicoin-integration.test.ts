import { ethers } from 'ethers';
import {
  getOmniCoinAddress,
  createOmniCoinContract,
  isSupportedNetwork,
  getOmniCoinContracts
} from '../../src/config/omnicoin-integration';
import { getOmniCoinBalance } from '../../src/core/blockchain/OmniCoin';
import { createMockProvider, mockWallet } from '../setup';

describe('OmniCoin Integration', () => {
  let provider: ethers.JsonRpcProvider;
  let signer: ethers.JsonRpcSigner;
  let testAccount: string;

  beforeAll(async () => {
    // Use mock wallet address
    testAccount = mockWallet.address;

    // Use mock provider for testing
    const baseProvider = createMockProvider('ethereum');

    // Add _network property and override getNetwork for Hardhat chainId
    provider = {
      ...baseProvider,
      _network: { chainId: 31337 }, // Hardhat chainId
      getNetwork: jest.fn().mockResolvedValue({ chainId: 31337n, name: 'hardhat' })
    } as unknown as ethers.JsonRpcProvider;

    // Mock ethers.Contract to return mock methods
    jest.spyOn(ethers, 'Contract').mockImplementation((address, abi, providerOrSigner) => {
      return {
        address,
        target: address, // ethers v6 uses 'target' instead of 'address'
        runner: providerOrSigner, // ethers v6 uses 'runner' instead of 'signer/provider'
        balanceOf: jest.fn().mockImplementation(async (addr: string) => {
          // Return 0 for random addresses, 100 XOM for test account
          return addr === testAccount ? ethers.parseEther('100') : 0n;
        }),
        name: jest.fn().mockResolvedValue('OmniCoin'),
        symbol: jest.fn().mockResolvedValue('XOM'),
        decimals: jest.fn().mockResolvedValue(18n),
        totalSupply: jest.fn().mockResolvedValue(ethers.parseEther('1000000000'))
      } as any;
    });

    // Create a mock signer
    signer = {
      getAddress: async () => testAccount,
      provider,
      signMessage: async (message: string) => `0x${message}signed`,
      signTransaction: async (tx: any) => `0x${JSON.stringify(tx)}signed`,
      sendTransaction: async (tx: any) => ({
        hash: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        wait: async () => ({ status: 1 })
      })
    } as unknown as ethers.JsonRpcSigner;
  }, 30000); // Increase timeout

  describe('Network Support', () => {
    it('should recognize Hardhat network as supported', async () => {
      const supported = await isSupportedNetwork(provider);
      expect(supported).toBe(true);
    });

    it('should return correct OmniCoin address for Hardhat', () => {
      const address = getOmniCoinAddress(provider);
      expect(address).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    });

    it('should return all contract addresses for Hardhat', () => {
      const contracts = getOmniCoinContracts(provider);
      expect(contracts).toHaveProperty('OmniCoin');
      expect(contracts).toHaveProperty('OmniCore');
      expect(contracts).toHaveProperty('OmniGovernance');
      expect(contracts).toHaveProperty('OmniBridge');
      expect(contracts).toHaveProperty('PrivateOmniCoin');
      expect(contracts).toHaveProperty('MinimalEscrow');
    });
  });

  describe('Contract Creation', () => {
    it('should create OmniCoin contract instance', () => {
      const contract = createOmniCoinContract(provider);
      expect(contract).toBeDefined();
      expect(contract.target).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    });

    it('should create contract with signer', () => {
      const contract = createOmniCoinContract(signer);
      expect(contract).toBeDefined();
      expect(contract.runner).toBe(signer);
    });
  });

  describe('Balance Queries', () => {
    it('should query OmniCoin balance', async () => {
      const balance = await getOmniCoinBalance(testAccount, provider);
      expect(typeof balance).toBe('bigint');
      console.log(`OmniCoin balance for ${testAccount}: ${balance.toString()}`);
    });

    it('should handle balance query for non-existent address', async () => {
      // Generate a random address without using ethers.Wallet.createRandom
      const randomBytes = new Uint8Array(20);
      crypto.getRandomValues(randomBytes);
      const randomAddress = '0x' + Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const balance = await getOmniCoinBalance(randomAddress, provider);
      expect(balance).toBe(0n);
    });
  });

  describe('Contract Interactions', () => {
    it('should read token metadata', async () => {
      const contract = createOmniCoinContract(provider);

      const name = await contract.name();
      expect(name).toBe('OmniCoin');

      const symbol = await contract.symbol();
      expect(symbol).toBe('XOM');

      const decimals = await contract.decimals();
      expect(Number(decimals)).toBe(18);
    });

    it('should read total supply', async () => {
      const contract = createOmniCoinContract(provider);
      const totalSupply = await contract.totalSupply();
      expect(typeof totalSupply).toBe('bigint');
      console.log(`Total supply: ${ethers.formatEther(totalSupply)} XOM`);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported network', () => {
      // Create a mock provider with unsupported chain ID
      const mockProvider = {
        _network: { chainId: 999999 }
      } as any;

      expect(() => getOmniCoinAddress(mockProvider)).toThrow(
        'OmniCoin contract not deployed on chain 999999'
      );
    });

    it('should use env variable as fallback', () => {
      const originalEnv = process.env.OMNICOIN_CONTRACT_ADDRESS;
      process.env.OMNICOIN_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

      const mockProvider = {
        _network: { chainId: 999999 }
      } as any;

      const address = getOmniCoinAddress(mockProvider);
      expect(address).toBe('0x1234567890123456789012345678901234567890');

      // Restore original env
      if (originalEnv) {
        process.env.OMNICOIN_CONTRACT_ADDRESS = originalEnv;
      } else {
        delete process.env.OMNICOIN_CONTRACT_ADDRESS;
      }
    });
  });
});