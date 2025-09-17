/**
 * Live OmniCoin Provider with Keyring Integration
 * 
 * This provider connects to OmniCoin blockchain (Avalanche subnet) and integrates
 * with the KeyringService for transaction signing and OmniCoin-specific features.
 */

import { ethers, type InterfaceAbi } from 'ethers';
import { keyringService } from '../../keyring/KeyringService';
import { ChainType } from '../../keyring/BIP39Keyring';
// import { AvalancheValidatorClient } from '../../../../Validator/src/client/AvalancheValidatorClient';

/**
 * Interface for validator client operations
 */
export interface ValidatorClient {
  /** Get account information from the validator */
  getAccount(address: string): Promise<{ stakedBalance?: string; privateBalance?: string } | null>;
  /** Resolve username to address */
  resolveUsername(username: string): Promise<string | null>;
  /** Get user's marketplace listings */
  getUserListings(address: string): Promise<unknown[]>;
  /** Get user's reputation score */
  getUserReputation(address: string): Promise<{ score: number } | null>;
  /** Send private transaction through validator */
  sendPrivateTransaction(signedTx: string): Promise<ethers.TransactionResponse | null>;
}

/**
 * OmniCoin network configuration interface
 */
export interface OmniCoinNetwork {
  /** Network display name */
  name: string;
  /** Network chain ID */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Validator service URL */
  validatorUrl: string;
  /** Block explorer URL (optional) */
  blockExplorer?: string;
  /** Native currency configuration */
  nativeCurrency: {
    /** Currency name */
    name: string;
    /** Currency symbol */
    symbol: string;
    /** Currency decimals */
    decimals: number;
  };
  /** Network-specific features */
  features: {
    /** Privacy feature enabled
     */
    privacy: boolean;
    /** Staking feature enabled */
    staking: boolean;
    /** Marketplace feature enabled */
    marketplace: boolean;
  };
}

// OmniCoin network configurations (Avalanche subnet)
export const OMNICOIN_NETWORKS = {
  mainnet: {
    name: 'OmniCoin Mainnet',
    chainId: 999999, // Custom chain ID for OmniCoin
    rpcUrl: (process?.env?.['OMNICOIN_RPC_URL']) ?? 'https://api.omnibazaar.com/rpc',
    validatorUrl: (process?.env?.['VALIDATOR_URL']) ?? 'https://validator.omnibazaar.com',
    blockExplorer: 'https://explorer.omnibazaar.com',
    nativeCurrency: {
      name: 'OmniCoin',
      symbol: 'XOM',
      decimals: 18 // Updated for EVM standard compatibility
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
    rpcUrl: (process?.env?.['OMNICOIN_TESTNET_RPC_URL']) ?? 'https://testnet-api.omnibazaar.com/rpc',
    validatorUrl: (process?.env?.['VALIDATOR_TESTNET_URL']) ?? 'https://testnet-validator.omnibazaar.com',
    blockExplorer: 'https://testnet-explorer.omnibazaar.com',
    nativeCurrency: {
      name: 'Test OmniCoin',
      symbol: 'tXOM',
      decimals: 18
    },
    features: {
      privacy: true,
      staking: true,
      marketplace: true
    }
  }
} as const;

/**
 * Live OmniCoin provider with validator integration and privacy features
 */
export class LiveOmniCoinProvider {
  private provider: ethers.JsonRpcProvider;
  private network: OmniCoinNetwork;
  private signer: ethers.Signer | null = null;
  private validatorClient: ValidatorClient | null = null;
  private privacyMode = false;
  
  /**
   * Create new LiveOmniCoinProvider instance
   * @param networkName - OmniCoin network name (mainnet/testnet)
   */
  constructor(networkName: keyof typeof OMNICOIN_NETWORKS = 'testnet') {
    const network = OMNICOIN_NETWORKS[networkName];
    if (network === null || network === undefined) {
      throw new Error(`Unknown OmniCoin network: ${networkName}`);
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
    
    // Initialize validator client for off-chain features
    void this.initializeValidatorClient();
  }

  /**
   * Initialize validator client for off-chain operations
   */
  private initializeValidatorClient(): void {
    try {
      // Mock validator client for now - would create actual AvalancheValidatorClient
      this.validatorClient = {
        getAccount: () => Promise.resolve(null),
        resolveUsername: () => Promise.resolve(null),
        getUserListings: () => Promise.resolve([]),
        getUserReputation: () => Promise.resolve({ score: 0 }),
        sendPrivateTransaction: () => Promise.resolve(null)
      };
    } catch (error) {
      console.warn('Validator client not available:', error);
    }
  }

  /**
   * Get the provider instance
   * @returns The JSON RPC provider instance
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get network info
   * @returns The OmniCoin network configuration
   */
  getNetwork(): OmniCoinNetwork {
    return this.network;
  }

  /**
   * Get validator client
   * @returns The validator client instance or null if not available
   */
  getValidatorClient(): ValidatorClient | null {
    return this.validatorClient;
  }

  /**
   * Enable/disable privacy mode (XOMP)
   * @param enabled - Whether to enable privacy mode
   */
  setPrivacyMode(enabled: boolean): void {
    if (!this.network.features.privacy) {
      throw new Error('Privacy not supported on this network');
    }
    this.privacyMode = enabled;
  }

  /**
   * Get privacy mode status
   * @returns True if privacy mode is enabled
   */
  isPrivacyEnabled(): boolean {
    return this.privacyMode && this.network.features.privacy;
  }

  /**
   * Switch to a different network
   * @param networkName - The network name to switch to
   */
  switchNetwork(networkName: keyof typeof OMNICOIN_NETWORKS): void {
    const network = OMNICOIN_NETWORKS[networkName];
    if (network === undefined) {
      throw new Error(`Unknown OmniCoin network: ${networkName}`);
    }

    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });

    // Reset signer and reinitialize validator client
    this.signer = null;
    void this.initializeValidatorClient();
  }

  /**
   * Get signer for active account
   * @returns The signer instance for the active account
   */
  getSigner(): OmniCoinKeyringSigner {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount === null || activeAccount.chainType !== ChainType.OMNICOIN) {
      throw new Error('No active OmniCoin account');
    }

    if (this.signer === null) {
      // Create a custom signer that uses keyring for signing
      this.signer = new OmniCoinKeyringSigner(
        activeAccount.address, 
        this.provider, 
        this.privacyMode,
        this.validatorClient
      );
    }
    
    return this.signer as OmniCoinKeyringSigner;
  }

  /**
   * Get account balance (XOM and XOMP)
   * @param address - Address to get balance for (defaults to active account)
   * @param includePrivate - Whether to include private balance
   * @returns Balance information including public, private, and staked amounts
   */
  async getBalance(address?: string, includePrivate = false): Promise<{
    public: bigint;
    private?: bigint;
    staked?: bigint;
  }> {
    const targetAddress = address ?? keyringService.getActiveAccount()?.address;
    if (targetAddress === undefined || targetAddress === '') {
      throw new Error('No address provided');
    }
    
    // Get public balance
    const publicBalance = await this.provider.getBalance(targetAddress);
    
    const result: { public: bigint; private?: bigint; staked?: bigint } = { public: publicBalance };
    
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
    if (this.validatorClient !== null && this.network.features.staking === true) {
      try {
        const account = await this.validatorClient.getAccount(targetAddress);
        if (account !== null && account.stakedBalance !== undefined && account.stakedBalance !== '') {
          result.staked = BigInt(account.stakedBalance);
        }
      } catch (error) {
        console.warn('Could not fetch staked balance:', error);
      }
    }
    
    return result;
  }

  /**
   * Get private balance (XOMP)
   * @param address - Address to get private balance for
   * @returns Private balance in wei
   */
  private async getPrivateBalance(address: string): Promise<bigint> {
    // Query private balance through validator
    if (this.validatorClient === null) {
      throw new Error('Validator client not available');
    }
    
    const account = await this.validatorClient.getAccount(address);
    return BigInt(account?.privateBalance ?? '0');
  }

  /**
   * Get formatted balance
   * @param address - Address to get balance for (defaults to active account)
   * @param includePrivate - Whether to include private balance
   * @returns Formatted balance information
   */
  async getFormattedBalance(address?: string, includePrivate = false): Promise<{ public: string; private?: string; staked?: string }> {
    const balances = await this.getBalance(address, includePrivate);
    
    // Format with 6 decimals for OmniCoin
    const formatOmniCoin = (value: bigint): string => {
      return ethers.formatUnits(value, this.network.nativeCurrency.decimals);
    };
    
    const result: { public: string; private?: string; staked?: string } = { public: formatOmniCoin(balances.public) };
    
    if (balances.private !== undefined) {
      result.private = formatOmniCoin(balances.private);
    }
    
    if (balances.staked !== undefined) {
      result.staked = formatOmniCoin(balances.staked);
    }
    
    return result;
  }

  /**
   * Stake OmniCoin
   * @param amount - Amount to stake in wei
   * @param duration - Staking duration in seconds
   * @returns Transaction response
   */
  async stakeOmniCoin(amount: bigint, duration: number): Promise<ethers.TransactionResponse> {
    if (!this.network.features.staking) {
      throw new Error('Staking not supported on this network');
    }
    
    const signer = this.getSigner();
    
    // Call staking contract
    const stakingContract = this.getContract(
      '0x0000000000000000000000000000000000000002', // OmniCoin staking contract
      ['function stake(uint256 amount, uint256 duration) payable']
    );
    const connectedContract = stakingContract.connect(signer) as ethers.Contract & {
      stake: (amount: bigint, duration: number, options: { value: bigint }) => Promise<ethers.TransactionResponse>;
    };
    const tx = await connectedContract.stake(amount, duration, { value: amount });
    
    return tx;
  }

  /**
   * Unstake OmniCoin
   * @param amount - Amount to unstake in wei
   * @returns Transaction response
   */
  async unstakeOmniCoin(amount: bigint): Promise<ethers.TransactionResponse> {
    if (!this.network.features.staking) {
      throw new Error('Staking not supported on this network');
    }
    
    const signer = this.getSigner();
    
    // Call staking contract
    const stakingContract = this.getContract(
      '0x0000000000000000000000000000000000000002', // OmniCoin staking contract
      ['function unstake(uint256 amount)']
    );
    const connectedContract = stakingContract.connect(signer) as ethers.Contract & {
      unstake: (amount: bigint) => Promise<ethers.TransactionResponse>;
    };
    const tx = await connectedContract.unstake(amount);
    
    return tx;
  }

  /**
   * Convert XOM to XOMP (private)
   * @param amount - Amount to convert in wei
   * @returns Transaction response
   */
  async convertToPrivate(amount: bigint): Promise<ethers.TransactionResponse> {
    if (!this.network.features.privacy) {
      throw new Error('Privacy features not supported on this network');
    }
    
    const signer = this.getSigner();
    
    // Call privacy contract
    const privacyContract = this.getContract(
      '0x0000000000000000000000000000000000000003', // OmniCoin privacy contract
      ['function convertToPrivate() payable']
    );
    const connectedContract = privacyContract.connect(signer) as ethers.Contract & {
      convertToPrivate: (options: { value: bigint }) => Promise<ethers.TransactionResponse>;
    };
    const tx = await connectedContract.convertToPrivate({ value: amount });
    
    return tx;
  }

  /**
   * Convert XOMP to XOM (public)
   * @param _amount - Amount to convert (unused in current implementation)
   * @returns Transaction response
   */
  async convertToPublic(_amount: bigint): Promise<ethers.TransactionResponse> {
    if (!this.network.features.privacy) {
      throw new Error('Privacy features not supported on this network');
    }
    
    const signer = this.getSigner();
    
    // Call privacy contract with private transaction
    const tx = {
      to: '0x0000000000000000000000000000000000000003', // OmniCoin privacy contract
      data: '0x',
      private: true
    };
    
    return await (signer).sendPrivateTransaction(tx);
  }

  /**
   * Resolve OmniCoin username (e.g., "johndoe.omnicoin")
   * @param username - Username to resolve
   * @returns Resolved address or null
   */
  async resolveUsername(username: string): Promise<string | null> {
    if (this.validatorClient === null) {
      // Fallback to on-chain resolution
      return await keyringService.resolveUsername(username);
    }
    
    // Use validator for off-chain resolution
    return await this.validatorClient.resolveUsername(username.replace('.omnicoin', ''));
  }

  /**
   * Get user's marketplace listings
   * @param address - User address (optional, defaults to active account)
   * @returns Array of listings
   */
  async getUserListings(address?: string): Promise<unknown[]> {
    if (this.validatorClient === null) {
      throw new Error('Validator client not available');
    }
    
    const targetAddress = address ?? keyringService.getActiveAccount()?.address;
    if (targetAddress === undefined || targetAddress === '') {
      throw new Error('No address provided');
    }
    
    return await this.validatorClient.getUserListings(targetAddress);
  }

  /**
   * Get user's reputation score
   * @param address - User address (optional, defaults to active account)
   * @returns Reputation score
   */
  async getReputationScore(address?: string): Promise<number> {
    if (this.validatorClient === null) {
      throw new Error('Validator client not available');
    }
    
    const targetAddress = address ?? keyringService.getActiveAccount()?.address;
    if (targetAddress === undefined || targetAddress === '') {
      throw new Error('No address provided');
    }
    
    const reputation = await this.validatorClient.getUserReputation(targetAddress);
    return reputation?.score ?? 0;
  }

  /**
   * Create contract instance
   * @param address - Contract address
   * @param abi - Contract ABI
   * @returns Contract instance
   */
  getContract(address: string, abi: InterfaceAbi): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }

  /**
   * Create contract instance with signer
   * @param address - Contract address
   * @param abi - Contract ABI
   * @returns Contract instance with signer
   */
  getContractWithSigner(address: string, abi: InterfaceAbi): ethers.Contract {
    const signer = this.getSigner();
    return new ethers.Contract(address, abi, signer);
  }
}

/**
 * Custom signer that uses KeyringService for signing with OmniCoin features
 */
class OmniCoinKeyringSigner extends ethers.AbstractSigner {
  readonly address: string;
  private privacyMode: boolean;
  private validatorClient: ValidatorClient | null;
  
  constructor(
    address: string, 
    provider: ethers.Provider, 
    privacyMode = false,
    validatorClient: ValidatorClient | null = null
  ) {
    super();
    this.address = address;
    this.privacyMode = privacyMode;
    this.validatorClient = validatorClient;
    Object.defineProperty(this, 'provider', { value: provider, enumerable: true });
  }

  override getAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  override async signMessage(message: string | Uint8Array): Promise<string> {
    const messageString = typeof message === 'string' ? message : ethers.hexlify(message);
    return await keyringService.signMessage(this.address, messageString);
  }

  override async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    // Resolve the to address if it's a promise or addressable
    let toAddress = '';
    if (transaction.to !== null && transaction.to !== undefined) {
      if (typeof transaction.to === 'string') {
        toAddress = transaction.to;
      } else if ('getAddress' in transaction.to) {
        // Addressable interface
        toAddress = await transaction.to.getAddress();
      } else {
        // Promise<string>
        toAddress = await transaction.to;
      }
    }
    
    // Convert ethers transaction to keyring transaction format
    const keyringTx: Parameters<typeof keyringService.signTransaction>[1] = {
      to: toAddress,
      ...(transaction.value !== null && transaction.value !== undefined && { value: transaction.value.toString() }),
      ...(transaction.data !== null && transaction.data !== undefined && { data: transaction.data }),
      ...(transaction.gasLimit !== null && transaction.gasLimit !== undefined && { gasLimit: transaction.gasLimit.toString() }),
      ...(transaction.gasPrice !== null && transaction.gasPrice !== undefined && { gasPrice: transaction.gasPrice.toString() }),
      ...(transaction.maxFeePerGas !== null && transaction.maxFeePerGas !== undefined && { maxFeePerGas: transaction.maxFeePerGas.toString() }),
      ...(transaction.maxPriorityFeePerGas !== null && transaction.maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas: transaction.maxPriorityFeePerGas.toString() }),
      ...(transaction.nonce !== null && transaction.nonce !== undefined && { nonce: transaction.nonce }),
      ...(transaction.chainId !== null && transaction.chainId !== undefined && { chainId: Number(transaction.chainId) })
    };
    
    return await keyringService.signTransaction(this.address, keyringTx);
  }

  override async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    // Sign transaction
    const signedTx = await this.signTransaction(transaction);
    
    // Send to network
    if (this.provider === null || this.provider === undefined) {
      throw new Error('Provider not available');
    }
    return await (this.provider as ethers.JsonRpcProvider).broadcastTransaction(signedTx);
  }

  async sendPrivateTransaction(transaction: { to: string; data: string; private: boolean }): Promise<ethers.TransactionResponse> {
    // Convert to ethers transaction format for signing
    const ethersTransaction: ethers.TransactionRequest = {
      to: transaction.to,
      data: transaction.data
    };
    
    // Sign private transaction with OmniCoin-specific handling
    const signedTx = await this.signTransaction(ethersTransaction);
    
    // Send as private transaction through validator
    if (this.validatorClient !== null) {
      const res = await this.validatorClient.sendPrivateTransaction(signedTx);
      if (res !== null) return res;
    }
    
    // Fallback to direct RPC
    if (this.provider === null || this.provider === undefined) {
      throw new Error('Provider not available');
    }
    const response = await (this.provider as ethers.JsonRpcProvider).send('omni_sendPrivateTransaction', [signedTx]) as unknown;
    return response as ethers.TransactionResponse;
  }

  override connect(provider: ethers.Provider): OmniCoinKeyringSigner {
    return new OmniCoinKeyringSigner(this.address, provider, this.privacyMode, this.validatorClient);
  }

  override signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, unknown>
  ): Promise<string> {
    return Promise.reject(new Error('signTypedData not supported for OmniCoinKeyringSigner'));
  }
}

/**
 * Factory function to create provider
 * @param networkName - Network name to use
 * @returns Live OmniCoin provider instance
 */
export function createLiveOmniCoinProvider(networkName?: keyof typeof OMNICOIN_NETWORKS): LiveOmniCoinProvider {
  return new LiveOmniCoinProvider(networkName as keyof typeof OMNICOIN_NETWORKS | undefined);
}

// Default provider instance
export const liveOmniCoinProvider = createLiveOmniCoinProvider();
