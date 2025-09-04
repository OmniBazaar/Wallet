/**
 * Live Ethereum Provider with Keyring Integration
 * 
 * This provider connects to real Ethereum networks and integrates
 * with the KeyringService for transaction signing and account management.
 */

import { ethers, type InterfaceAbi } from 'ethers';
import { keyringService } from '../../keyring/KeyringService';

/**
 *
 */
export interface EthereumNetwork {
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
}

// Production RPC endpoints
export const ETHEREUM_NETWORKS = {
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: (process?.env?.ETHEREUM_RPC_URL as string | undefined) ?? 'https://rpc.ankr.com/eth',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: (process?.env?.SEPOLIA_RPC_URL as string | undefined) ?? 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: (process?.env?.POLYGON_RPC_URL as string | undefined) ?? 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: (process?.env?.ARBITRUM_RPC_URL as string | undefined) ?? 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Arbitrum Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: (process?.env?.OPTIMISM_RPC_URL as string | undefined) ?? 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Optimism Ether',
      symbol: 'ETH',
      decimals: 18
    }
  }
} as const;

/**
 *
 */
export class LiveEthereumProvider {
  /** Underlying JSON-RPC provider */
  protected provider: ethers.JsonRpcProvider;
  private network: EthereumNetwork;
  private signer: ethers.Signer | null = null;
  
  /**
   *
   * @param networkName
   */
  constructor(networkName: keyof typeof ETHEREUM_NETWORKS = 'mainnet') {
    const network = ETHEREUM_NETWORKS[networkName];
    if (!network) {
      throw new Error(`Unknown network: ${networkName}`);
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
  getNetwork(): EthereumNetwork {
    return this.network;
  }

  /**
   * Switch to a different network
   * @param networkName
   */
  async switchNetwork(networkName: keyof typeof ETHEREUM_NETWORKS): Promise<void> {
    const network = ETHEREUM_NETWORKS[networkName];
    if (!network) {
      throw new Error(`Unknown network: ${networkName}`);
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
  async getSigner(): Promise<ethers.Signer> {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount || activeAccount.chainType !== 'ethereum') {
      throw new Error('No active Ethereum account');
    }

    if (!this.signer) {
      // Create a custom signer that uses keyring for signing
      this.signer = new KeyringSigner(activeAccount.address, this.provider);
    }
    
    return this.signer;
  }

  /**
   * Get account balance
   * @param address
   */
  async getBalance(address?: string): Promise<bigint> {
    const targetAddress = address || keyringService.getActiveAccount()?.address;
    if (!targetAddress) {
      throw new Error('No address provided');
    }
    return await this.provider.getBalance(targetAddress);
  }

  /**
   * Get formatted balance
   * @param address
   */
  async getFormattedBalance(address?: string): Promise<string> {
    const balance = await this.getBalance(address);
    return ethers.formatEther(balance);
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
   * Get EIP-1559 fee data
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
   * Call contract method (read-only)
   * @param transaction
   */
  async call(transaction: ethers.TransactionRequest): Promise<string> {
    return await this.provider.call(transaction);
  }

  /**
   * Get block number
   */
  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get block
   * @param blockHashOrNumber
   */
  async getBlock(blockHashOrNumber: string | number): Promise<ethers.Block | null> {
    return await this.provider.getBlock(blockHashOrNumber);
  }

  /**
   * Get transaction
   * @param txHash
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    return await this.provider.getTransaction(txHash);
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
   * Check if address is contract
   * @param address
   */
  async isContract(address: string): Promise<boolean> {
    const code = await this.provider.getCode(address);
    return code !== '0x';
  }

  /**
   * Resolve ENS name
   * @param name
   */
  async resolveName(name: string): Promise<string | null> {
    return await this.provider.resolveName(name);
  }

  /**
   * Lookup ENS address
   * @param address
   */
  async lookupAddress(address: string): Promise<string | null> {
    return await this.provider.lookupAddress(address);
  }
}

/**
 * Custom signer that uses KeyringService for signing
 */
class KeyringSigner extends ethers.AbstractSigner {
  readonly address: string;
  
  constructor(address: string, provider: ethers.Provider) {
    super();
    this.address = address;
    Object.defineProperty(this, 'provider', { value: provider, enumerable: true });
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageString = typeof message === 'string' ? message : ethers.hexlify(message);
    return await keyringService.signMessage(this.address, messageString);
  }

  async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    // Populate transaction
    const tx: any = { ...transaction };
    
    // Remove from field for signing
    if ('from' in tx) {
      delete tx.from;
    }
    
    return await keyringService.signTransaction(this.address, tx);
  }

  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    // Sign transaction
    const signedTx = await this.signTransaction(transaction);
    
    // Send to network
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    return await (this.provider as ethers.JsonRpcProvider).broadcastTransaction(signedTx);
  }

  connect(provider: ethers.Provider): KeyringSigner {
    return new KeyringSigner(this.address, provider);
  }

  async signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, any>
  ): Promise<string> {
    throw new Error('signTypedData not supported');
  }
}

// Factory function to create provider
/**
 *
 * @param networkName
 */
export function createLiveEthereumProvider(networkName?: keyof typeof ETHEREUM_NETWORKS): LiveEthereumProvider {
  return new LiveEthereumProvider(networkName as keyof typeof ETHEREUM_NETWORKS | undefined);
}

// Default provider instance
export const liveEthereumProvider = createLiveEthereumProvider();
