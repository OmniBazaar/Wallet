import { ethers } from 'ethers';
import {
  getOmniCoinAddress,
  createOmniCoinContract,
  isSupportedNetwork,
  getOmniCoinContracts
} from '../../src/config/omnicoin-integration';
import { getOmniCoinBalance } from '../../src/core/blockchain/OmniCoin';

describe('OmniCoin Integration', () => {
  let provider: ethers.JsonRpcProvider;
  let signer: ethers.JsonRpcSigner;
  let testAccount: string;

  beforeAll(async () => {
    // Connect to local Hardhat node
    console.log('Connecting to Hardhat node...');
    provider = new ethers.JsonRpcProvider('http://localhost:8545');

    // Wait for provider to be ready
    console.log('Getting network info...');
    const network = await provider.getNetwork();
    console.log('Network info:', network);

    // Get a signer - in ethers v6, we get the signer directly by index
    try {
      console.log('Getting signer...');
      signer = await provider.getSigner(0);
      console.log('Signer obtained:', signer);

      testAccount = await signer.getAddress();
      console.log('Test account:', testAccount);

      // Log network info for debugging
      console.log('Connected to network:', {
        chainId: network.chainId.toString(),
        name: network.name
      });
    } catch (error) {
      console.error('Error getting signer:', error);
      console.error('Error stack:', (error as Error).stack);
      throw new Error('No accounts available. Is Hardhat node running?');
    }
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
      const randomAddress = ethers.Wallet.createRandom().address;
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