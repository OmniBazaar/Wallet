/**
 * Live COTI Provider with Keyring Integration
 * 
 * This provider connects to COTI v2 network and integrates
 * with the KeyringService for transaction signing and privacy features.
 */

import { ethers, type InterfaceAbi, AbstractSigner } from 'ethers';
// Import keyringService lazily to avoid circular dependency

/**
 *
 */
export interface COTINetwork {
  /**
   *
   */
  name: string;
  /**
   *
   */
  chainId: number;
  /**
   *
   */
  rpcUrl: string;
  /**
   *
   */
  blockExplorer?: string;
  /**
   *
   */
  nativeCurrency: {
    /**
     *
     */
    name: string;
    /**
     *
     */
    symbol: string;
    /**
     *
     */
    decimals: number;
  };
  /**
   *
   */
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
 *
 */
export class LiveCOTIProvider {
  private provider: ethers.JsonRpcProvider;
  private network: COTINetwork;
  private signer: COTIKeyringSigner | null = null;
  private privacyMode = false;
  
  /**
   *
   * @param networkName
   */
  constructor(networkName = 'testnet') {
    const network = COTI_NETWORKS[networkName];
    if (!network) {
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
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get network info
   */
  getNetwork(): COTINetwork {
    return this.network;
  }

  /**
   * Enable/disable privacy mode
   * @param enabled
   */
  setPrivacyMode(enabled: boolean): void {
    if (!this.network.privacyEnabled) {
      throw new Error('Privacy not supported on this network');
    }
    this.privacyMode = enabled;
  }

  /**
   * Get privacy mode status
   */
  isPrivacyEnabled(): boolean {
    return this.privacyMode && this.network.privacyEnabled;
  }

  /**
   * Switch to a different network
   * @param networkName
   */
  async switchNetwork(networkName: string): Promise<void> {
    const network = COTI_NETWORKS[networkName];
    if (!network) {
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
   */
  async getSigner(): Promise<COTIKeyringSigner> {
    // Lazy import to avoid circular dependency
    const { keyringService } = await import('../../keyring/KeyringService');
    
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount || activeAccount.chainType !== 'coti') {
      throw new Error('No active COTI account');
    }

    if (!this.signer) {
      // Create a custom signer that uses keyring for signing
      this.signer = new COTIKeyringSigner(activeAccount.address, this.provider, this.privacyMode);
    }
    
    return this.signer;
  }

  /**
   * Get account balance (public or private)
   * @param address
   * @param includePrivate
   */
  async getBalance(address?: string, includePrivate = false): Promise<{ public: bigint; private?: bigint }> {
    let targetAddress = address;
    if (!targetAddress) {
      // Lazy import to avoid circular dependency
      const { keyringService } = await import('../../keyring/KeyringService');
      targetAddress = keyringService.getActiveAccount()?.address;
    }
    if (!targetAddress) {
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
        console.warn('Could not fetch private balance:', error);
      }
    }
    
    return result;
  }

  /**
   * Get private balance (COTI-specific)
   * @param address
   */
  private async getPrivateBalance(address: string): Promise<bigint> {
    // This would use COTI's privacy-preserving balance query
    // Placeholder implementation - actual implementation depends on COTI v2 API
    const result = await this.provider.send('coti_getPrivateBalance', [address]);
    return BigInt(result);
  }

  /**
   * Get formatted balance
   * @param address
   * @param includePrivate
   */
  async getFormattedBalance(address?: string, includePrivate = false): Promise<{ public: string; private?: string }> {
    const balances = await this.getBalance(address, includePrivate);
    
    const result: { public: string; private?: string } = {
      public: ethers.formatEther(balances.public)
    };
    
    if (balances.private) {
      result.private = ethers.formatEther(balances.private);
    }
    
    return result;
  }

  /**
   * Send private transaction (COTI-specific)
   * @param transaction
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
   * @param transaction
   */
  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(transaction);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    const fee = await this.provider.getFeeData();
    return fee.gasPrice ?? 20n * 10n ** 9n;
  }

  /**
   * Get fee data
   */
  async getFeeData(): Promise<ethers.FeeData> {
    return await this.provider.getFeeData();
  }

  /**
   * Send transaction
   * @param transaction
   */
  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    const signer = await this.getSigner();
    return await signer.sendTransaction(transaction);
  }

  /**
   * Get transaction receipt
   * @param txHash
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for transaction confirmation
   * @param txHash
   * @param confirmations
   */
  async waitForTransaction(txHash: string, confirmations = 1): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Create contract instance
   * @param address
   * @param abi
   */
  getContract(address: string, abi: InterfaceAbi): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }

  /**
   * Create contract instance with signer
   * @param address
   * @param abi
   */
  async getContractWithSigner(address: string, abi: InterfaceAbi): Promise<ethers.Contract> {
    const signer = await this.getSigner();
    return new ethers.Contract(address, abi, signer);
  }

  /**
   * Convert public coins to private (COTI-specific)
   * @param amount
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
   * @param amount
   */
  async convertToPublic(amount: bigint): Promise<ethers.TransactionResponse> {
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

  override async getAddress(): Promise<string> {
    return this.address;
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
    const tx: any = { ...(transaction as any) };
    
    // Remove from field for signing
    if ('from' in tx) {
      delete tx.from;
    }
    
    return await keyringService.signTransaction(this.address, tx);
  }

  override async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    // Sign transaction
    const signedTx = await this.signTransaction(transaction);
    
    // Send to network
    if (!this.provider) throw new Error('Provider not available');
    return await (this.provider as ethers.JsonRpcProvider).broadcastTransaction(signedTx);
  }

  // removed duplicate wrong signature

  async sendPrivateTransaction(transaction: ethers.TransactionRequest & { private?: boolean }): Promise<ethers.TransactionResponse> {
    // Sign private transaction with COTI-specific handling
    // This would include privacy-preserving signing
    const signedTx = await this.signTransaction(transaction);
    
    // Send as private transaction
    if (!this.provider) throw new Error('Provider not available');
    return await (this.provider as ethers.JsonRpcProvider).send('coti_sendPrivateTransaction', [signedTx]);
  }

  override connect(provider: ethers.Provider): COTIKeyringSigner {
    return new COTIKeyringSigner(this.address, provider, this.privacyMode);
  }

  override async signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, any>
  ): Promise<string> {
    throw new Error('signTypedData not supported for COTIKeyringSigner');
  }
}

// Factory function to create provider
/**
 *
 * @param networkName
 */
export function createLiveCOTIProvider(networkName?: string): LiveCOTIProvider {
  return new LiveCOTIProvider(networkName);
}

// Default provider instance
export const liveCOTIProvider = createLiveCOTIProvider();
