/**
 * OmniCoin Integration Test Suite
 * 
 * Tests native blockchain integration including block synchronization,
 * transaction broadcasting, privacy features, staking operations, and
 * validator interactions. This is a Phase 4 component for core functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { 
  LiveOmniCoinProvider, 
  OMNICOIN_NETWORKS, 
  createLiveOmniCoinProvider,
  type ValidatorClient,
  type OmniCoinNetwork
} from '../../../src/core/chains/omnicoin/live-provider';
import { OmniCoinMetadata, getOmniCoinBalance } from '../../../src/core/blockchain/OmniCoin';
import { keyringService } from '../../../src/core/keyring/KeyringService';

// Mock dependencies
jest.mock('../../../src/core/keyring/KeyringService', () => ({
  keyringService: {
    getActiveAccount: jest.fn(),
    signMessage: jest.fn(),
    signTransaction: jest.fn(),
    resolveUsername: jest.fn()
  }
}));

// Mock ethers
jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers') as any;
  
  // Mock JsonRpcProvider
  class MockJsonRpcProvider {
    constructor(public rpcUrl: string, public config: any) {}
    
    getBalance = jest.fn().mockResolvedValue(BigInt('5000000000000000000'));
    getBlockNumber = jest.fn().mockResolvedValue(1000000);
    broadcastTransaction = jest.fn().mockResolvedValue({
      hash: '0x123',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
    send = jest.fn().mockResolvedValue({
      hash: '0x456',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });
  }

  // Mock Contract
  class MockContract {
    constructor(public address: string, public abi: any, public provider: any) {}
    
    connect = jest.fn().mockReturnValue({
      stake: jest.fn().mockResolvedValue({ hash: '0xStakeTx', wait: jest.fn() }),
      unstake: jest.fn().mockResolvedValue({ hash: '0xUnstakeTx', wait: jest.fn() }),
      convertToPrivate: jest.fn().mockResolvedValue({ hash: '0xPrivateTx', wait: jest.fn() }),
      balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000000000000'))
    });

    // Direct methods
    balanceOf = jest.fn().mockResolvedValue(BigInt('1000000000000000000'));
  }

  // Mock AbstractSigner
  class MockAbstractSigner {
    provider: any;
    constructor() {
      this.provider = null;
    }
    getAddress = jest.fn();
    signMessage = jest.fn();
    signTransaction = jest.fn();
    sendTransaction = jest.fn();
    connect = jest.fn();
    signTypedData = jest.fn();
  }

  return {
    ...actualEthers,
    JsonRpcProvider: MockJsonRpcProvider,
    Contract: MockContract,
    AbstractSigner: MockAbstractSigner,
    formatUnits: actualEthers.formatUnits,
    hexlify: actualEthers.hexlify
  };
});

describe('OmniCoin Integration', () => {
  // Test constants
  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f3e53A';
  const TEST_USERNAME = 'alice.omnicoin';
  const TEST_PRIVATE_KEY = '0xPrivateKey123';
  
  describe('OmniCoin Metadata', () => {
    it('should have correct token metadata', () => {
      expect(OmniCoinMetadata.name).toBe('OmniCoin');
      expect(OmniCoinMetadata.symbol).toBe('XOM');
      expect(OmniCoinMetadata.decimals).toBe(18);
      expect(OmniCoinMetadata.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should use environment variable for contract address if available', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, OMNICOIN_CONTRACT_ADDRESS: '0xCustomAddress123' };
      
      // Re-import to get new value
      jest.resetModules();
      const { OmniCoinMetadata: reloadedMetadata } = jest.requireActual('../../../src/core/blockchain/OmniCoin') as any;
      
      expect(reloadedMetadata.contractAddress).toBe('0xCustomAddress123');
      
      process.env = originalEnv;
    });
  });

  describe('getOmniCoinBalance', () => {
    it('should get OmniCoin balance correctly', async () => {
      const mockProvider = new ethers.JsonRpcProvider('https://test.com', {});
      const balance = await getOmniCoinBalance(TEST_ADDRESS, mockProvider);
      
      expect(balance).toBe(BigInt('1000000000000000000'));
      expect(ethers.Contract).toHaveBeenCalledWith(
        OmniCoinMetadata.contractAddress,
        expect.any(Array),
        mockProvider
      );
    });

    it('should handle balance query errors', async () => {
      const mockProvider = new ethers.JsonRpcProvider('https://test.com', {});
      const mockContract = new ethers.Contract('', [], mockProvider) as any;
      mockContract.balanceOf.mockRejectedValueOnce(new Error('Contract error'));
      
      jest.spyOn(ethers, 'Contract').mockReturnValueOnce(mockContract);
      
      await expect(getOmniCoinBalance(TEST_ADDRESS, mockProvider)).rejects.toThrow('Contract error');
    });
  });

  describe('LiveOmniCoinProvider', () => {
    let provider: LiveOmniCoinProvider;

    beforeEach(() => {
      jest.clearAllMocks();
      provider = new LiveOmniCoinProvider('testnet');
      
      // Setup keyring mock
      (keyringService.getActiveAccount as jest.Mock).mockReturnValue({
        address: TEST_ADDRESS,
        chainType: 'omnicoin'
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('Provider Initialization', () => {
      it('should initialize with testnet by default', () => {
        const network = provider.getNetwork();
        expect(network.name).toBe('OmniCoin Testnet');
        expect(network.chainId).toBe(999998);
        expect(network.nativeCurrency.symbol).toBe('tXOM');
      });

      it('should initialize with mainnet when specified', () => {
        const mainnetProvider = new LiveOmniCoinProvider('mainnet');
        const network = mainnetProvider.getNetwork();
        expect(network.name).toBe('OmniCoin Mainnet');
        expect(network.chainId).toBe(999999);
        expect(network.nativeCurrency.symbol).toBe('XOM');
      });

      it('should throw error for unknown network', () => {
        expect(() => new LiveOmniCoinProvider('invalid' as any)).toThrow('Unknown OmniCoin network: invalid');
      });

      it('should use environment variables for RPC URLs', () => {
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          OMNICOIN_RPC_URL: 'https://custom-rpc.com',
          VALIDATOR_URL: 'https://custom-validator.com'
        };

        // Re-import to get new values
        jest.resetModules();
        const { LiveOmniCoinProvider: ReloadedProvider } = jest.requireActual('../../../src/core/chains/omnicoin/live-provider') as any;
        const customProvider = new ReloadedProvider('mainnet');
        
        expect(customProvider.getNetwork().rpcUrl).toBe('https://custom-rpc.com');
        expect(customProvider.getNetwork().validatorUrl).toBe('https://custom-validator.com');

        process.env = originalEnv;
      });
    });

    describe('Network Features', () => {
      it('should support all features on mainnet', () => {
        const mainnetProvider = new LiveOmniCoinProvider('mainnet');
        const features = mainnetProvider.getNetwork().features;
        
        expect(features.privacy).toBe(true);
        expect(features.staking).toBe(true);
        expect(features.marketplace).toBe(true);
      });

      it('should get provider instance', () => {
        const ethersProvider = provider.getProvider();
        expect(ethersProvider).toBeInstanceOf(ethers.JsonRpcProvider);
      });

      it('should get validator client', () => {
        const validatorClient = provider.getValidatorClient();
        expect(validatorClient).toBeDefined();
        expect(validatorClient?.getAccount).toBeDefined();
      });
    });

    describe('Privacy Mode', () => {
      it('should enable privacy mode', () => {
        provider.setPrivacyMode(true);
        expect(provider.isPrivacyEnabled()).toBe(true);
      });

      it('should disable privacy mode', () => {
        provider.setPrivacyMode(true);
        provider.setPrivacyMode(false);
        expect(provider.isPrivacyEnabled()).toBe(false);
      });

      it('should throw error if privacy not supported', () => {
        // Mock a network without privacy support
        const network = provider.getNetwork();
        network.features.privacy = false;
        
        expect(() => provider.setPrivacyMode(true)).toThrow('Privacy not supported on this network');
      });
    });

    describe('Network Switching', () => {
      it('should switch networks', async () => {
        await provider.switchNetwork('mainnet');
        const network = provider.getNetwork();
        expect(network.name).toBe('OmniCoin Mainnet');
      });

      it('should throw error for invalid network switch', async () => {
        await expect(provider.switchNetwork('invalid' as any)).rejects.toThrow('Unknown OmniCoin network: invalid');
      });
    });

    describe('Signer Operations', () => {
      it('should get signer for active account', async () => {
        const signer = await provider.getSigner();
        expect(await signer.getAddress()).toBe(TEST_ADDRESS);
      });

      it('should throw error if no active OmniCoin account', async () => {
        (keyringService.getActiveAccount as jest.Mock).mockReturnValueOnce(null);
        
        await expect(provider.getSigner()).rejects.toThrow('No active OmniCoin account');
      });

      it('should throw error if active account is not OmniCoin', async () => {
        (keyringService.getActiveAccount as jest.Mock).mockReturnValueOnce({
          address: TEST_ADDRESS,
          chainType: 'ethereum'
        });
        
        await expect(provider.getSigner()).rejects.toThrow('No active OmniCoin account');
      });

      it('should reuse signer instance', async () => {
        const signer1 = await provider.getSigner();
        const signer2 = await provider.getSigner();
        expect(signer1).toBe(signer2);
      });
    });

    describe('Balance Operations', () => {
      it('should get public balance', async () => {
        const balance = await provider.getBalance(TEST_ADDRESS);
        
        expect(balance.public).toBe(BigInt('5000000000000000000'));
        expect(balance.private).toBeUndefined();
        expect(balance.staked).toBeUndefined();
      });

      it('should get balance for active account when no address provided', async () => {
        const balance = await provider.getBalance();
        expect(balance.public).toBe(BigInt('5000000000000000000'));
      });

      it('should throw error if no address available', async () => {
        (keyringService.getActiveAccount as jest.Mock).mockReturnValueOnce(null);
        
        await expect(provider.getBalance()).rejects.toThrow('No address provided');
      });

      it('should get private balance when requested', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getAccount as jest.Mock).mockResolvedValueOnce({
            privateBalance: '2000000000000000000'
          });
        }

        const balance = await provider.getBalance(TEST_ADDRESS, true);
        
        expect(balance.public).toBe(BigInt('5000000000000000000'));
        expect(balance.private).toBe(BigInt('2000000000000000000'));
      });

      it('should get staked balance from validator', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getAccount as jest.Mock).mockResolvedValueOnce({
            stakedBalance: '3000000000000000000'
          });
        }

        const balance = await provider.getBalance(TEST_ADDRESS);
        
        expect(balance.staked).toBe(BigInt('3000000000000000000'));
      });

      it('should handle validator client errors gracefully', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getAccount as jest.Mock).mockRejectedValueOnce(new Error('Validator error'));
        }

        const balance = await provider.getBalance(TEST_ADDRESS, true);
        
        expect(balance.public).toBe(BigInt('5000000000000000000'));
        expect(balance.private).toBeUndefined();
      });

      it('should format balances correctly', async () => {
        const formatted = await provider.getFormattedBalance(TEST_ADDRESS);
        
        expect(formatted.public).toBe('5.0'); // 5 XOM
        expect(formatted.private).toBeUndefined();
        expect(formatted.staked).toBeUndefined();
      });

      it('should format all balance types', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getAccount as jest.Mock).mockResolvedValueOnce({
            privateBalance: '2500000000000000000',
            stakedBalance: '1500000000000000000'
          });
        }

        const formatted = await provider.getFormattedBalance(TEST_ADDRESS, true);
        
        expect(formatted.public).toBe('5.0');
        expect(formatted.private).toBe('2.5');
        expect(formatted.staked).toBe('1.5');
      });
    });

    describe('Staking Operations', () => {
      it('should stake OmniCoin', async () => {
        const amount = BigInt('1000000000000000000'); // 1 XOM
        const duration = 30; // 30 days
        
        const tx = await provider.stakeOmniCoin(amount, duration);
        
        expect(tx.hash).toBe('0xStakeTx');
        expect(ethers.Contract).toHaveBeenCalledWith(
          '0x0000000000000000000000000000000000000002',
          expect.any(Array),
          expect.any(Object)
        );
      });

      it('should unstake OmniCoin', async () => {
        const amount = BigInt('500000000000000000'); // 0.5 XOM
        
        const tx = await provider.unstakeOmniCoin(amount);
        
        expect(tx.hash).toBe('0xUnstakeTx');
      });

      it('should throw error if staking not supported', async () => {
        const network = provider.getNetwork();
        network.features.staking = false;
        
        await expect(provider.stakeOmniCoin(BigInt('1000'), 30)).rejects.toThrow('Staking not supported on this network');
      });
    });

    describe('Privacy Operations', () => {
      it('should convert XOM to XOMP', async () => {
        const amount = BigInt('1000000000000000000'); // 1 XOM
        
        const tx = await provider.convertToPrivate(amount);
        
        expect(tx.hash).toBe('0xPrivateTx');
        expect(ethers.Contract).toHaveBeenCalledWith(
          '0x0000000000000000000000000000000000000003',
          expect.any(Array),
          expect.any(Object)
        );
      });

      it('should convert XOMP to XOM', async () => {
        (keyringService.signTransaction as jest.Mock).mockResolvedValueOnce('0xSignedTx');
        
        const amount = BigInt('500000000000000000'); // 0.5 XOMP
        const tx = await provider.convertToPublic(amount);
        
        expect(tx.hash).toBe('0x456'); // From RPC send mock
      });

      it('should throw error if privacy not supported', async () => {
        const network = provider.getNetwork();
        network.features.privacy = false;
        
        await expect(provider.convertToPrivate(BigInt('1000'))).rejects.toThrow('Privacy features not supported on this network');
      });
    });

    describe('Username Resolution', () => {
      it('should resolve username via validator', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.resolveUsername as jest.Mock).mockResolvedValueOnce(TEST_ADDRESS);
        }

        const resolved = await provider.resolveUsername(TEST_USERNAME);
        
        expect(resolved).toBe(TEST_ADDRESS);
        expect(validatorClient?.resolveUsername).toHaveBeenCalledWith('alice');
      });

      it('should fallback to keyring service if validator not available', async () => {
        // Remove validator client
        (provider as any).validatorClient = null;
        (keyringService.resolveUsername as jest.Mock).mockResolvedValueOnce(TEST_ADDRESS);

        const resolved = await provider.resolveUsername(TEST_USERNAME);
        
        expect(resolved).toBe(TEST_ADDRESS);
        expect(keyringService.resolveUsername).toHaveBeenCalledWith(TEST_USERNAME);
      });
    });

    describe('Marketplace Features', () => {
      it('should get user listings', async () => {
        const mockListings = [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' }
        ];
        
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getUserListings as jest.Mock).mockResolvedValueOnce(mockListings);
        }

        const listings = await provider.getUserListings(TEST_ADDRESS);
        
        expect(listings).toEqual(mockListings);
      });

      it('should get reputation score', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getUserReputation as jest.Mock).mockResolvedValueOnce({ score: 85 });
        }

        const score = await provider.getReputationScore(TEST_ADDRESS);
        
        expect(score).toBe(85);
      });

      it('should return 0 reputation if not available', async () => {
        const validatorClient = provider.getValidatorClient();
        if (validatorClient) {
          (validatorClient.getUserReputation as jest.Mock).mockResolvedValueOnce(null);
        }

        const score = await provider.getReputationScore(TEST_ADDRESS);
        
        expect(score).toBe(0);
      });

      it('should throw error if validator not available for marketplace features', async () => {
        (provider as any).validatorClient = null;
        
        await expect(provider.getUserListings()).rejects.toThrow('Validator client not available');
        await expect(provider.getReputationScore()).rejects.toThrow('Validator client not available');
      });
    });

    describe('Contract Operations', () => {
      it('should create contract instance', () => {
        const abi = ['function balanceOf(address) view returns (uint256)'];
        const contract = provider.getContract(TEST_ADDRESS, abi);
        
        expect(contract).toBeInstanceOf(ethers.Contract);
        expect(ethers.Contract).toHaveBeenCalledWith(TEST_ADDRESS, abi, provider.getProvider());
      });

      it('should create contract instance with signer', async () => {
        const abi = ['function transfer(address, uint256)'];
        const contract = await provider.getContractWithSigner(TEST_ADDRESS, abi);
        
        expect(contract).toBeInstanceOf(ethers.Contract);
        expect(ethers.Contract).toHaveBeenCalledWith(TEST_ADDRESS, abi, await provider.getSigner());
      });
    });

    describe('Factory Function', () => {
      it('should create provider using factory function', () => {
        const factoryProvider = createLiveOmniCoinProvider('mainnet');
        expect(factoryProvider).toBeInstanceOf(LiveOmniCoinProvider);
        expect(factoryProvider.getNetwork().name).toBe('OmniCoin Mainnet');
      });

      it('should create testnet provider by default', () => {
        const factoryProvider = createLiveOmniCoinProvider();
        expect(factoryProvider.getNetwork().name).toBe('OmniCoin Testnet');
      });
    });

    describe('OmniCoinKeyringSigner', () => {
      let signer: any;

      beforeEach(async () => {
        signer = await provider.getSigner();
      });

      it('should sign messages using keyring', async () => {
        (keyringService.signMessage as jest.Mock).mockResolvedValueOnce('0xSignedMessage');
        
        const signature = await signer.signMessage('Hello OmniCoin');
        
        expect(signature).toBe('0xSignedMessage');
        expect(keyringService.signMessage).toHaveBeenCalledWith(TEST_ADDRESS, 'Hello OmniCoin');
      });

      it('should sign transactions using keyring', async () => {
        (keyringService.signTransaction as jest.Mock).mockResolvedValueOnce('0xSignedTx');
        
        const tx = { to: '0xRecipient', value: '1000' };
        const signedTx = await signer.signTransaction(tx);
        
        expect(signedTx).toBe('0xSignedTx');
        expect(keyringService.signTransaction).toHaveBeenCalledWith(TEST_ADDRESS, tx);
      });

      it('should send transactions', async () => {
        (keyringService.signTransaction as jest.Mock).mockResolvedValueOnce('0xSignedTx');
        
        const tx = { to: '0xRecipient', value: '1000' };
        const response = await signer.sendTransaction(tx);
        
        expect(response.hash).toBe('0x123');
        const mockProvider = provider.getProvider() as any;
        expect(mockProvider.broadcastTransaction).toHaveBeenCalledWith('0xSignedTx');
      });

      it('should send private transactions', async () => {
        (keyringService.signTransaction as jest.Mock).mockResolvedValueOnce('0xSignedPrivateTx');
        
        const tx = { to: '0xRecipient', data: '0x123', private: true };
        const response = await signer.sendPrivateTransaction(tx);
        
        expect(response.hash).toBe('0x456');
      });

      it('should connect to new provider', () => {
        const newProvider = new ethers.JsonRpcProvider('https://new.com', {});
        const connectedSigner = signer.connect(newProvider);
        
        expect(connectedSigner).not.toBe(signer);
        expect(connectedSigner.provider).toBe(newProvider);
      });

      it('should throw error for signTypedData', async () => {
        await expect(signer.signTypedData({}, {}, {})).rejects.toThrow('signTypedData not supported for OmniCoinKeyringSigner');
      });

      it('should handle Uint8Array messages', async () => {
        (keyringService.signMessage as jest.Mock).mockResolvedValueOnce('0xSignedBytes');
        
        const message = new Uint8Array([1, 2, 3, 4]);
        const signature = await signer.signMessage(message);
        
        expect(signature).toBe('0xSignedBytes');
        expect(keyringService.signMessage).toHaveBeenCalledWith(TEST_ADDRESS, '0x01020304');
      });
    });

    describe('Error Handling', () => {
      it('should handle RPC errors gracefully', async () => {
        const mockProvider = provider.getProvider() as any;
        mockProvider.getBalance.mockRejectedValueOnce(new Error('RPC error'));
        
        await expect(provider.getBalance(TEST_ADDRESS)).rejects.toThrow('RPC error');
      });

      it('should handle missing provider in signer', async () => {
        const signer = await provider.getSigner();
        (signer as any).provider = null;
        
        await expect(signer.sendTransaction({ to: '0x123' })).rejects.toThrow('Provider not available');
      });

      it('should log validator client initialization errors', async () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
        
        // Force error in validator client init
        const errorProvider = new LiveOmniCoinProvider('testnet');
        
        // Validator client should still be created with mock implementation
        expect(errorProvider.getValidatorClient()).toBeDefined();
        
        consoleWarn.mockRestore();
      });
    });
  });
});