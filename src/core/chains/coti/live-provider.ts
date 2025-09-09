/**
 * Live COTI Provider with Keyring Integration
 * 
 * This provider connects to COTI v2 network and integrates
 * with the KeyringService for transaction signing and privacy features.
 */

import { ethers, type InterfaceAbi, AbstractSigner } from 'ethers';
// Import keyringService lazily to avoid circular dependency

/**
 * COTI Network configuration interface
 */
export interface COTINetwork {
  /** Network display name */
  name: string;
  /** Network chain ID */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer URL */
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
  /** Whether privacy features are enabled */
  privacyEnabled: boolean;
}

// COTI v2 network configurations
export const COTI_NETWORKS: Record<string, COTINetwork> = {
  mainnet: {
    name: 'COTI v2 Mainnet',
    chainId: 7777777, // To be confirmed
    rpcUrl: (process?.env?.['COTI_RPC_URL']) ?? 'https://mainnet.coti.io/rpc',
    blockExplorer: 'https://explorer.coti.io',
    nativeCurrency: {
      name: 'COTI',
      symbol: 'COTI',
      decimals: 18
    },
    privacyEnabled: true
  },
  testnet: {
    name: 'COTI v2 Testnet',
    chainId: 7777778, // To be confirmed
    rpcUrl: (process?.env?.['COTI_TESTNET_RPC_URL']) ?? 'https://testnet.coti.io/rpc',
    blockExplorer: 'https://testnet-explorer.coti.io',
    nativeCurrency: {
      name: 'Test COTI',
      symbol: 'tCOTI',
      decimals: 18
    },
    privacyEnabled: true
  }
};

/**
 * Live COTI provider with privacy features and keyring integration
 */
export class LiveCOTIProvider {
  private provider: ethers.JsonRpcProvider;
  private network: COTINetwork;
  private signer: COTIKeyringSigner | null = null;
  private privacyMode = false;
  
  /**
   * Create new LiveCOTIProvider instance
   * @param networkName - COTI network name (mainnet/testnet)
   */
  constructor(networkName = 'testnet') {
    const network = COTI_NETWORKS[networkName];
    if (network === null || network === undefined) {
      throw new Error(`Unknown COTI network: ${networkName}`);
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
  }

  /**
   * Get the provider instance
   * @returns The ethers JSON-RPC provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get network info
   * @returns Current network configuration
   */
  getNetwork(): COTINetwork {
    return this.network;
  }

  /**
   * Enable/disable privacy mode
   * @param enabled - Whether to enable privacy mode
   */
  setPrivacyMode(enabled: boolean): void {
    if (!this.network.privacyEnabled) {
      throw new Error('Privacy not supported on this network');
    }
    this.privacyMode = enabled;
  }

  /**
   * Get privacy mode status
   * @returns True if privacy mode is enabled
   */
  isPrivacyEnabled(): boolean {
    return this.privacyMode && this.network.privacyEnabled;
  }

  /**
   * Switch to a different network
   * @param networkName - Target network name
   */
  switchNetwork(networkName: string): void {
    const network = COTI_NETWORKS[networkName];
    if (network === null || network === undefined) {
      throw new Error(`Unknown COTI network: ${networkName}`);
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
    
    // Reset signer
    this.signer = null;
  }

  /**
   * Get signer for active account
   * @returns Promise resolving to COTI keyring signer
   */
  async getSigner(): Promise<COTIKeyringSigner> {
    // Lazy import to avoid circular dependency
    const { keyringService } = await import('../../keyring/KeyringService');
    
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount === null || activeAccount === undefined || String(activeAccount.chainType) !== 'coti') {
      throw new Error('No active COTI account');
    }

    if (this.signer === null || this.signer === undefined) {
      // Create a custom signer that uses keyring for signing
      this.signer = new COTIKeyringSigner(activeAccount.address, this.provider, this.privacyMode);
    }
    
    return this.signer;
  }

  /**
   * Get account balance (public or private)
   * @param address - Target address to get balance for
   * @param includePrivate - Whether to include private balance
   * @returns Promise resolving to balance object with public and optional private amounts
   */
  async getBalance(address?: string, includePrivate = false): Promise<{ public: bigint; private?: bigint }> {
    let targetAddress = address;
    if (targetAddress === null || targetAddress === undefined || targetAddress.length === 0) {
      // Lazy import to avoid circular dependency
      const { keyringService } = await import('../../keyring/KeyringService');
      targetAddress = keyringService.getActiveAccount()?.address;
    }
    if (targetAddress === null || targetAddress === undefined || targetAddress.length === 0) {
      throw new Error('No address provided');
    }
    
    const publicBalance = await this.provider.getBalance(targetAddress);
    
    const result: { public: bigint; private?: bigint } = { public: publicBalance };
    
    // Get private balance if requested and privacy is enabled
    if (includePrivate && this.network.privacyEnabled) {
      try {
        // COTI-specific private balance query
        const privateBalance = await this.getPrivateBalance(targetAddress);
        result.private = privateBalance;
      } catch (error) {
        // In production, use proper logger instead of console
        // console.warn('Could not fetch private balance:', error);
      }
    }
    
    return result;
  }

  /**
   * Get private balance (COTI-specific)
   * @param address - Address to query private balance for
   * @returns Promise resolving to private balance amount
   */
  private async getPrivateBalance(address: string): Promise<bigint> {
    // This would use COTI's privacy-preserving balance query
    // Placeholder implementation - actual implementation depends on COTI v2 API
    const result: unknown = await this.provider.send('coti_getPrivateBalance', [address]);
    if (typeof result !== 'string' && typeof result !== 'number') {
      throw new Error('Invalid balance response from COTI API');
    }
    return BigInt(result);
  }

  /**
   * Get formatted balance
   * @param address - Target address to get balance for
   * @param includePrivate - Whether to include private balance
   * @returns Promise resolving to formatted balance strings
   */
  async getFormattedBalance(address?: string, includePrivate = false): Promise<{ public: string; private?: string }> {
    const balances = await this.getBalance(address, includePrivate);
    
    const result: { public: string; private?: string } = {
      public: ethers.formatEther(balances.public)
    };
    
    if (balances.private !== null && balances.private !== undefined) {
      result.private = ethers.formatEther(balances.private);
    }
    
    return result;
  }

  /**
   * Send private transaction (COTI-specific)
   * @param transaction - Transaction request with privacy flag
   * @returns Promise resolving to transaction response
   */
  async sendPrivateTransaction(transaction: ethers.TransactionRequest & { private?: boolean }): Promise<ethers.TransactionResponse> {
    if (!this.privacyMode) {
      throw new Error('Privacy mode not enabled');
    }
    
    const signer = await this.getSigner();
    
    // Add privacy-specific parameters
    const privateTx = {
      ...transaction,
      private: true,
      // Additional COTI privacy parameters would go here
    };
    
    return await (signer).sendPrivateTransaction(privateTx);
  }

  /**
   * Estimate gas for transaction
   * @param transaction - Transaction request to estimate
   * @returns Promise resolving to estimated gas amount
   */
  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(transaction);
  }

  /**
   * Get current gas price
   * @returns Promise resolving to current gas price
   */
  async getGasPrice(): Promise<bigint> {
    const fee = await this.provider.getFeeData();
    return fee.gasPrice ?? 20n * 10n ** 9n;
  }

  /**
   * Get fee data
   * @returns Promise resolving to current fee data
   */
  async getFeeData(): Promise<ethers.FeeData> {
    return await this.provider.getFeeData();
  }

  /**
   * Send transaction
   * @param transaction - Transaction request to send
   * @returns Promise resolving to transaction response
   */
  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    const signer = await this.getSigner();
    return await signer.sendTransaction(transaction);
  }

  /**
   * Get transaction receipt
   * @param txHash - Transaction hash to get receipt for
   * @returns Promise resolving to transaction receipt or null if not found
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for transaction confirmation
   * @param txHash - Transaction hash to wait for
   * @param confirmations - Number of confirmations to wait for
   * @returns Promise resolving to transaction receipt or null if timeout
   */
  async waitForTransaction(txHash: string, confirmations = 1): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Create contract instance
   * @param address - Contract address
   * @param abi - Contract ABI
   * @returns Contract instance connected to provider
   */
  getContract(address: string, abi: InterfaceAbi): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }

  /**
   * Create contract instance with signer
   * @param address - Contract address
   * @param abi - Contract ABI
   * @returns Promise resolving to contract instance with signer
   */
  async getContractWithSigner(address: string, abi: InterfaceAbi): Promise<ethers.Contract> {
    const signer = await this.getSigner();
    return new ethers.Contract(address, abi, signer);
  }

  /**
   * Convert public coins to private (COTI-specific)
   * @param amount - Amount to convert
   * @returns Promise resolving to conversion transaction response
   */
  async convertToPrivate(amount: bigint): Promise<ethers.TransactionResponse> {
    const signer = await this.getSigner();
    
    // COTI-specific conversion transaction
    const tx: ethers.TransactionRequest = {
      to: '0x0000000000000000000000000000000000000001', // COTI privacy contract
      value: amount,
      data: '0x' // Conversion method selector would go here
    };
    
    return await signer.sendTransaction(tx);
  }

  /**
   * Convert private coins to public (COTI-specific)
   * @param _amount - Amount to convert (currently unused in placeholder)
   * @returns Promise resolving to conversion transaction response
   */
  async convertToPublic(_amount: bigint): Promise<ethers.TransactionResponse> {
    if (!this.privacyMode) {
      throw new Error('Privacy mode not enabled');
    }
    
    const signer = await this.getSigner();
    
    // COTI-specific conversion transaction
    const tx: ethers.TransactionRequest = {
      to: '0x0000000000000000000000000000000000000001', // COTI privacy contract
      value: 0n,
      data: '0x' // Placeholder for encoded params
    };
    
    return await (signer).sendPrivateTransaction(tx);
  }
}

/**
 * Custom signer that uses KeyringService for signing with COTI privacy features
 */
class COTIKeyringSigner extends AbstractSigner {
  readonly address: string;
  private privacyMode: boolean;
  
  constructor(address: string, provider: ethers.Provider, privacyMode = false) {
    super();
    this.address = address;
    this.privacyMode = privacyMode;
    Object.defineProperty(this, 'provider', { value: provider, enumerable: true });
  }

  override getAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  override async signMessage(message: string | Uint8Array): Promise<string> {
    // Lazy import to avoid circular dependency
    const { keyringService } = await import('../../keyring/KeyringService');
    const messageString = typeof message === 'string' ? message : ethers.hexlify(message);
    return await keyringService.signMessage(this.address, messageString);
  }

  override async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    // Lazy import to avoid circular dependency
    const { keyringService } = await import('../../keyring/KeyringService');
    
    // Populate transaction
    const tx = { ...transaction } as Record<string, unknown>;
    
    // Remove from field for signing
    if ('from' in tx) {
      delete tx['from'];
    }
    
    // Convert ethers TransactionRequest to KeyringService TransactionRequest
    const keyringTx: import('../../keyring/KeyringService').TransactionRequest = {
      to: (tx['to'] !== undefined && tx['to'] !== null) ? String(tx['to']) : '',
      ...(tx['value'] !== undefined && tx['value'] !== null && { value: String(tx['value']) }),
      ...(tx['data'] !== undefined && tx['data'] !== null && { data: String(tx['data']) }),
      ...(tx['gasLimit'] !== undefined && tx['gasLimit'] !== null && { gasLimit: String(tx['gasLimit']) }),
      ...(tx['gasPrice'] !== undefined && tx['gasPrice'] !== null && { gasPrice: String(tx['gasPrice']) }),
      ...(tx['maxFeePerGas'] !== undefined && tx['maxFeePerGas'] !== null && { maxFeePerGas: String(tx['maxFeePerGas']) }),
      ...(tx['maxPriorityFeePerGas'] !== undefined && tx['maxPriorityFeePerGas'] !== null && { maxPriorityFeePerGas: String(tx['maxPriorityFeePerGas']) }),
      ...(tx['nonce'] !== undefined && tx['nonce'] !== null && { nonce: Number(tx['nonce']) }),
      ...(tx['chainId'] !== undefined && tx['chainId'] !== null && { chainId: Number(tx['chainId']) })
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

  // removed duplicate wrong signature

  async sendPrivateTransaction(transaction: ethers.TransactionRequest & { private?: boolean }): Promise<ethers.TransactionResponse> {
    // Sign private transaction with COTI-specific handling
    // This would include privacy-preserving signing
    const signedTx = await this.signTransaction(transaction);
    
    // Send as private transaction
    if (this.provider === null || this.provider === undefined) {
      throw new Error('Provider not available');
    }
    const result: unknown = await (this.provider as ethers.JsonRpcProvider).send('coti_sendPrivateTransaction', [signedTx]);
    return result as ethers.TransactionResponse;
  }

  override connect(provider: ethers.Provider): COTIKeyringSigner {
    return new COTIKeyringSigner(this.address, provider, this.privacyMode);
  }

  override signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, unknown>
  ): Promise<string> {
    throw new Error('signTypedData not supported for COTIKeyringSigner');
  }
}

/**
 * Factory function to create COTI provider
 * @param networkName - Network name (mainnet/testnet)
 * @returns New LiveCOTIProvider instance
 */
export function createLiveCOTIProvider(networkName?: string): LiveCOTIProvider {
  return new LiveCOTIProvider(networkName);
}

// Default provider instance
export const liveCOTIProvider = createLiveCOTIProvider();
