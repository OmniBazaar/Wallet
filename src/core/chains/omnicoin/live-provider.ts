/**
 * Live OmniCoin Provider with Keyring Integration
 * 
 * This provider connects to OmniCoin blockchain (Avalanche subnet) and integrates
 * with the KeyringService for transaction signing and OmniCoin-specific features.
 */

import { ethers } from 'ethers';
import { keyringService } from '../../keyring/KeyringService';
import { AvalancheValidatorClient } from '../../../../Validator/src/client/AvalancheValidatorClient';

export interface OmniCoinNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  validatorUrl: string;
  blockExplorer?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  features: {
    privacy: boolean;
    staking: boolean;
    marketplace: boolean;
  };
}

// OmniCoin network configurations (Avalanche subnet)
export const OMNICOIN_NETWORKS: Record<string, OmniCoinNetwork> = {
  mainnet: {
    name: 'OmniCoin Mainnet',
    chainId: 999999, // Custom chain ID for OmniCoin
    rpcUrl: process.env.OMNICOIN_RPC_URL || 'https://api.omnibazaar.com/rpc',
    validatorUrl: process.env.VALIDATOR_URL || 'https://validator.omnibazaar.com',
    blockExplorer: 'https://explorer.omnibazaar.com',
    nativeCurrency: {
      name: 'OmniCoin',
      symbol: 'XOM',
      decimals: 6 // As per OmniBazaar Design Checkpoint
    },
    features: {
      privacy: true,
      staking: true,
      marketplace: true
    }
  },
  testnet: {
    name: 'OmniCoin Testnet',
    chainId: 999998,
    rpcUrl: process.env.OMNICOIN_TESTNET_RPC_URL || 'https://testnet-api.omnibazaar.com/rpc',
    validatorUrl: process.env.VALIDATOR_TESTNET_URL || 'https://testnet-validator.omnibazaar.com',
    blockExplorer: 'https://testnet-explorer.omnibazaar.com',
    nativeCurrency: {
      name: 'Test OmniCoin',
      symbol: 'tXOM',
      decimals: 6
    },
    features: {
      privacy: true,
      staking: true,
      marketplace: true
    }
  }
};

export class LiveOmniCoinProvider {
  private provider: ethers.JsonRpcProvider;
  private network: OmniCoinNetwork;
  private signer: ethers.Signer | null = null;
  private validatorClient: AvalancheValidatorClient | null = null;
  private privacyMode: boolean = false;
  
  constructor(networkName: string = 'testnet') {
    const network = OMNICOIN_NETWORKS[networkName];
    if (!network) {
      throw new Error(`Unknown OmniCoin network: ${networkName}`);
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
    
    // Initialize validator client for off-chain features
    this.initializeValidatorClient();
  }

  /**
   * Initialize validator client for off-chain operations
   */
  private async initializeValidatorClient(): Promise<void> {
    try {
      const { createAvalancheValidatorClient } = await import('../../../../Validator/src/client/AvalancheValidatorClient');
      this.validatorClient = createAvalancheValidatorClient({
        validatorEndpoint: this.network.validatorUrl,
        wsEndpoint: this.network.validatorUrl.replace('https', 'wss') + '/graphql',
        apiKey: process.env.VALIDATOR_API_KEY
      });
    } catch (error) {
      console.warn('Validator client not available:', error);
    }
  }

  /**
   * Get the provider instance
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get network info
   */
  getNetwork(): OmniCoinNetwork {
    return this.network;
  }

  /**
   * Get validator client
   */
  getValidatorClient(): AvalancheValidatorClient | null {
    return this.validatorClient;
  }

  /**
   * Enable/disable privacy mode (XOMP)
   */
  setPrivacyMode(enabled: boolean): void {
    if (!this.network.features.privacy) {
      throw new Error('Privacy not supported on this network');
    }
    this.privacyMode = enabled;
  }

  /**
   * Get privacy mode status
   */
  isPrivacyEnabled(): boolean {
    return this.privacyMode && this.network.features.privacy;
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(networkName: string): Promise<void> {
    const network = OMNICOIN_NETWORKS[networkName];
    if (!network) {
      throw new Error(`Unknown OmniCoin network: ${networkName}`);
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
    
    // Reset signer and reinitialize validator client
    this.signer = null;
    await this.initializeValidatorClient();
  }

  /**
   * Get signer for active account
   */
  async getSigner(): Promise<ethers.Signer> {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount || activeAccount.chainType !== 'omnicoin') {
      throw new Error('No active OmniCoin account');
    }

    if (!this.signer) {
      // Create a custom signer that uses keyring for signing
      this.signer = new OmniCoinKeyringSigner(
        activeAccount.address, 
        this.provider, 
        this.privacyMode,
        this.validatorClient
      );
    }
    
    return this.signer;
  }

  /**
   * Get account balance (XOM and XOMP)
   */
  async getBalance(address?: string, includePrivate: boolean = false): Promise<{
    public: ethers.BigNumber;
    private?: ethers.BigNumber;
    staked?: ethers.BigNumber;
  }> {
    const targetAddress = address || keyringService.getActiveAccount()?.address;
    if (!targetAddress) {
      throw new Error('No address provided');
    }
    
    // Get public balance
    const publicBalance = await this.provider.getBalance(targetAddress);
    
    const result: any = { public: publicBalance };
    
    // Get private balance if requested
    if (includePrivate && this.network.features.privacy) {
      try {
        const privateBalance = await this.getPrivateBalance(targetAddress);
        result.private = privateBalance;
      } catch (error) {
        console.warn('Could not fetch private balance:', error);
      }
    }
    
    // Get staked balance if validator client is available
    if (this.validatorClient && this.network.features.staking) {
      try {
        const account = await this.validatorClient.getAccount(targetAddress);
        if (account && account.stakedBalance) {
          result.staked = ethers.BigNumber.from(account.stakedBalance);
        }
      } catch (error) {
        console.warn('Could not fetch staked balance:', error);
      }
    }
    
    return result;
  }

  /**
   * Get private balance (XOMP)
   */
  private async getPrivateBalance(address: string): Promise<ethers.BigNumber> {
    // Query private balance through validator
    if (!this.validatorClient) {
      throw new Error('Validator client not available');
    }
    
    const account = await this.validatorClient.getAccount(address);
    return ethers.BigNumber.from(account?.privateBalance || '0');
  }

  /**
   * Get formatted balance
   */
  async getFormattedBalance(address?: string, includePrivate: boolean = false): Promise<{
    public: string;
    private?: string;
    staked?: string;
  }> {
    const balances = await this.getBalance(address, includePrivate);
    
    // Format with 6 decimals for OmniCoin
    const formatOmniCoin = (value: ethers.BigNumber) => {
      return ethers.utils.formatUnits(value, this.network.nativeCurrency.decimals);
    };
    
    const result: any = {
      public: formatOmniCoin(balances.public)
    };
    
    if (balances.private) {
      result.private = formatOmniCoin(balances.private);
    }
    
    if (balances.staked) {
      result.staked = formatOmniCoin(balances.staked);
    }
    
    return result;
  }

  /**
   * Stake OmniCoin
   */
  async stakeOmniCoin(amount: ethers.BigNumber, duration: number): Promise<ethers.providers.TransactionResponse> {
    if (!this.network.features.staking) {
      throw new Error('Staking not supported on this network');
    }
    
    const signer = await this.getSigner();
    
    // Call staking contract
    const stakingContract = this.getContract(
      '0x0000000000000000000000000000000000000002', // OmniCoin staking contract
      ['function stake(uint256 amount, uint256 duration) payable']
    );
    
    const tx = await stakingContract.connect(signer).stake(amount, duration, {
      value: amount
    });
    
    return tx;
  }

  /**
   * Unstake OmniCoin
   */
  async unstakeOmniCoin(amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse> {
    if (!this.network.features.staking) {
      throw new Error('Staking not supported on this network');
    }
    
    const signer = await this.getSigner();
    
    // Call staking contract
    const stakingContract = this.getContract(
      '0x0000000000000000000000000000000000000002', // OmniCoin staking contract
      ['function unstake(uint256 amount)']
    );
    
    const tx = await stakingContract.connect(signer).unstake(amount);
    
    return tx;
  }

  /**
   * Convert XOM to XOMP (private)
   */
  async convertToPrivate(amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse> {
    if (!this.network.features.privacy) {
      throw new Error('Privacy features not supported on this network');
    }
    
    const signer = await this.getSigner();
    
    // Call privacy contract
    const privacyContract = this.getContract(
      '0x0000000000000000000000000000000000000003', // OmniCoin privacy contract
      ['function convertToPrivate() payable']
    );
    
    const tx = await privacyContract.connect(signer).convertToPrivate({
      value: amount
    });
    
    return tx;
  }

  /**
   * Convert XOMP to XOM (public)
   */
  async convertToPublic(amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse> {
    if (!this.network.features.privacy) {
      throw new Error('Privacy features not supported on this network');
    }
    
    const signer = await this.getSigner();
    
    // Call privacy contract with private transaction
    const tx = {
      to: '0x0000000000000000000000000000000000000003', // OmniCoin privacy contract
      data: ethers.utils.defaultAbiCoder.encode(['uint256'], [amount]),
      private: true
    };
    
    return await (signer as OmniCoinKeyringSigner).sendPrivateTransaction(tx);
  }

  /**
   * Resolve OmniCoin username (e.g., "johndoe.omnicoin")
   */
  async resolveUsername(username: string): Promise<string | null> {
    if (!this.validatorClient) {
      // Fallback to on-chain resolution
      return await keyringService.resolveUsername(username);
    }
    
    // Use validator for off-chain resolution
    return await this.validatorClient.resolveUsername(username.replace('.omnicoin', ''));
  }

  /**
   * Get user's marketplace listings
   */
  async getUserListings(address?: string): Promise<any[]> {
    if (!this.validatorClient) {
      throw new Error('Validator client not available');
    }
    
    const targetAddress = address || keyringService.getActiveAccount()?.address;
    if (!targetAddress) {
      throw new Error('No address provided');
    }
    
    return await this.validatorClient.getUserListings(targetAddress);
  }

  /**
   * Get user's reputation score
   */
  async getReputationScore(address?: string): Promise<number> {
    if (!this.validatorClient) {
      throw new Error('Validator client not available');
    }
    
    const targetAddress = address || keyringService.getActiveAccount()?.address;
    if (!targetAddress) {
      throw new Error('No address provided');
    }
    
    const reputation = await this.validatorClient.getUserReputation(targetAddress);
    return reputation?.score || 0;
  }

  /**
   * Create contract instance
   */
  getContract(address: string, abi: any[]): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }

  /**
   * Create contract instance with signer
   */
  async getContractWithSigner(address: string, abi: any[]): Promise<ethers.Contract> {
    const signer = await this.getSigner();
    return new ethers.Contract(address, abi, signer);
  }
}

/**
 * Custom signer that uses KeyringService for signing with OmniCoin features
 */
class OmniCoinKeyringSigner extends ethers.Signer {
  readonly address: string;
  private privacyMode: boolean;
  private validatorClient: AvalancheValidatorClient | null;
  
  constructor(
    address: string, 
    provider: ethers.providers.Provider, 
    privacyMode: boolean = false,
    validatorClient: AvalancheValidatorClient | null = null
  ) {
    super();
    this.address = address;
    this.privacyMode = privacyMode;
    this.validatorClient = validatorClient;
    ethers.utils.defineReadOnly(this, 'provider', provider);
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
    const messageString = typeof message === 'string' ? message : ethers.utils.hexlify(message);
    return await keyringService.signMessage(this.address, messageString);
  }

  async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
    // Populate transaction
    const tx = await ethers.utils.resolveProperties(transaction);
    
    // Remove from field for signing
    if ('from' in tx) {
      delete tx.from;
    }
    
    return await keyringService.signTransaction(this.address, tx);
  }

  async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
    // Sign transaction
    const signedTx = await this.signTransaction(transaction);
    
    // Send to network
    return await this.provider!.sendTransaction(signedTx);
  }

  async sendPrivateTransaction(transaction: any): Promise<ethers.providers.TransactionResponse> {
    // Sign private transaction with OmniCoin-specific handling
    const signedTx = await this.signTransaction(transaction);
    
    // Send as private transaction through validator
    if (this.validatorClient) {
      return await this.validatorClient.sendPrivateTransaction(signedTx);
    }
    
    // Fallback to direct RPC
    return await this.provider!.send('omni_sendPrivateTransaction', [signedTx]);
  }

  connect(provider: ethers.providers.Provider): OmniCoinKeyringSigner {
    return new OmniCoinKeyringSigner(this.address, provider, this.privacyMode, this.validatorClient);
  }
}

// Factory function to create provider
export function createLiveOmniCoinProvider(networkName?: string): LiveOmniCoinProvider {
  return new LiveOmniCoinProvider(networkName);
}

// Default provider instance
export const liveOmniCoinProvider = createLiveOmniCoinProvider();