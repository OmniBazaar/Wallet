/**
 * Live Ethereum Provider with Keyring Integration
 * 
 * This provider connects to real Ethereum networks and integrates
 * with the KeyringService for transaction signing and account management.
 */

import { ethers, type InterfaceAbi } from 'ethers';
import { keyringService } from '../../keyring/KeyringService';
import { ChainType } from '../../keyring/BIP39Keyring';

/**
 * Represents an Ethereum network configuration with RPC and chain details
 */
export interface EthereumNetwork {
  /** Human-readable network name */
  name: string;
  /** Numeric chain identifier */
  chainId: number;
  /** JSON-RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer base URL */
  blockExplorer?: string;
  /** Native currency configuration */
  nativeCurrency: {
    /** Full currency name */
    name: string;
    /** Currency symbol */
    symbol: string;
    /** Decimal precision */
    decimals: number;
  };
}

// Production RPC endpoints
export const ETHEREUM_NETWORKS = {
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: (process?.env?.['ETHEREUM_RPC_URL']) ?? 'https://rpc.ankr.com/eth',
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
    rpcUrl: (process?.env?.['SEPOLIA_RPC_URL']) ?? 'https://rpc.sepolia.org',
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
    rpcUrl: (process?.env?.['POLYGON_RPC_URL']) ?? 'https://polygon-rpc.com',
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
    rpcUrl: (process?.env?.['ARBITRUM_RPC_URL']) ?? 'https://arb1.arbitrum.io/rpc',
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
    rpcUrl: (process?.env?.['OPTIMISM_RPC_URL']) ?? 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Optimism Ether',
      symbol: 'ETH',
      decimals: 18
    }
  }
} as const;

/**
 * Production Ethereum provider that connects to real networks and integrates with KeyringService
 */
export class LiveEthereumProvider {
  /** Underlying JSON-RPC provider */
  protected provider: ethers.JsonRpcProvider;
  private network: EthereumNetwork;
  private signer: ethers.Signer | null = null;
  
  /**
   * Creates a new LiveEthereumProvider instance
   * @param networkName - The network to connect to (defaults to mainnet)
   */
  constructor(networkName: keyof typeof ETHEREUM_NETWORKS = 'mainnet') {
    const network = ETHEREUM_NETWORKS[networkName];
    if (network === null || network === undefined) {
      throw new Error(`Unknown network: ${networkName}`);
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
  }

  /**
   * Get the underlying JSON-RPC provider instance
   * @returns The ethers JsonRpcProvider instance
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get the current network configuration
   * @returns The current network configuration object
   */
  getNetwork(): EthereumNetwork {
    return this.network;
  }

  /**
   * Switch to a different Ethereum network
   * @param networkName - The name of the network to switch to
   */
  switchNetwork(networkName: keyof typeof ETHEREUM_NETWORKS): void {
    const network = ETHEREUM_NETWORKS[networkName];
    if (network === null || network === undefined) {
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
   * Get a signer instance for the currently active account
   * @returns Promise resolving to an ethers Signer instance
   */
  getSigner(): Promise<ethers.Signer> {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount === null || activeAccount === undefined || activeAccount.chainType !== ChainType.Ethereum) {
      return Promise.reject(new Error('No active Ethereum account'));
    }

    if (this.signer === null || this.signer === undefined) {
      // Create a custom signer that uses keyring for signing
      this.signer = new KeyringSigner(activeAccount.address, this.provider);
    }
    
    return Promise.resolve(this.signer);
  }

  /**
   * Get the ETH balance for an address
   * @param address - The address to query (uses active account if not provided)
   * @returns Promise resolving to the balance in wei as bigint
   */
  async getBalance(address?: string): Promise<bigint> {
    const targetAddress = address ?? keyringService.getActiveAccount()?.address;
    if (targetAddress === null || targetAddress === undefined || targetAddress === '') {
      throw new Error('No address provided');
    }
    return await this.provider.getBalance(targetAddress);
  }

  /**
   * Get the ETH balance formatted as a string in ETH units
   * @param address - The address to query (uses active account if not provided)
   * @returns Promise resolving to the formatted balance string
   */
  async getFormattedBalance(address?: string): Promise<string> {
    const balance = await this.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Estimate gas required for a transaction
   * @param transaction - The transaction to estimate gas for
   * @returns Promise resolving to estimated gas as bigint
   */
  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(transaction);
  }

  /**
   * Get the current gas price
   * @returns Promise resolving to gas price in wei as bigint
   */
  async getGasPrice(): Promise<bigint> {
    const fee = await this.provider.getFeeData();
    return fee.gasPrice !== null && fee.gasPrice !== undefined ? fee.gasPrice : 20n * 10n ** 9n;
  }

  /**
   * Get EIP-1559 fee data including base fee and priority fee
   * @returns Promise resolving to fee data object
   */
  async getFeeData(): Promise<ethers.FeeData> {
    return await this.provider.getFeeData();
  }

  /**
   * Send a signed transaction to the network
   * @param transaction - The transaction request to send
   * @returns Promise resolving to transaction response
   */
  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    const signer = await this.getSigner();
    return await signer.sendTransaction(transaction);
  }

  /**
   * Get the receipt for a transaction by hash
   * @param txHash - The transaction hash to look up
   * @returns Promise resolving to transaction receipt or null if not found
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for a transaction to be confirmed with specified confirmations
   * @param txHash - The transaction hash to wait for
   * @param confirmations - Number of confirmations to wait for (default: 1)
   * @returns Promise resolving to transaction receipt or null if timeout
   */
  async waitForTransaction(txHash: string, confirmations = 1): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Execute a read-only contract call
   * @param transaction - The transaction request for the call
   * @returns Promise resolving to the call result as hex string
   */
  async call(transaction: ethers.TransactionRequest): Promise<string> {
    return await this.provider.call(transaction);
  }

  /**
   * Get the current block number
   * @returns Promise resolving to the latest block number
   */
  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get block information by hash or number
   * @param blockHashOrNumber - Block hash string or block number
   * @returns Promise resolving to block object or null if not found
   */
  async getBlock(blockHashOrNumber: string | number): Promise<ethers.Block | null> {
    return await this.provider.getBlock(blockHashOrNumber);
  }

  /**
   * Get transaction information by hash
   * @param txHash - The transaction hash to look up
   * @returns Promise resolving to transaction response or null if not found
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    return await this.provider.getTransaction(txHash);
  }

  /**
   * Create a read-only contract instance
   * @param address - The contract address
   * @param abi - The contract ABI
   * @returns Contract instance connected to provider
   */
  getContract(address: string, abi: InterfaceAbi): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }

  /**
   * Create a contract instance with signer for transactions
   * @param address - The contract address
   * @param abi - The contract ABI
   * @returns Promise resolving to contract instance connected to signer
   */
  async getContractWithSigner(address: string, abi: InterfaceAbi): Promise<ethers.Contract> {
    const signer = await this.getSigner();
    return new ethers.Contract(address, abi, signer);
  }

  /**
   * Check if an address contains contract code
   * @param address - The address to check
   * @returns Promise resolving to true if address is a contract
   */
  async isContract(address: string): Promise<boolean> {
    const code = await this.provider.getCode(address);
    return code !== '0x';
  }

  /**
   * Resolve an ENS name to an Ethereum address
   * @param name - The ENS name to resolve
   * @returns Promise resolving to address string or null if not found
   */
  async resolveName(name: string): Promise<string | null> {
    return await this.provider.resolveName(name);
  }

  /**
   * Perform reverse ENS lookup to get name from address
   * @param address - The Ethereum address to lookup
   * @returns Promise resolving to ENS name or null if not found
   */
  async lookupAddress(address: string): Promise<string | null> {
    return await this.provider.lookupAddress(address);
  }
}

/**
 * Custom signer implementation that integrates with KeyringService for transaction signing
 */
class KeyringSigner extends ethers.AbstractSigner {
  /** The Ethereum address this signer represents */
  readonly address: string;
  
  /**
   * Creates a new KeyringSigner instance
   * @param address - The Ethereum address to sign for
   * @param provider - The provider to connect to
   */
  constructor(address: string, provider: ethers.Provider) {
    super();
    this.address = address;
    Object.defineProperty(this, 'provider', { value: provider, enumerable: true });
  }

  /**
   * Get the address for this signer
   * @returns Promise resolving to the Ethereum address
   */
  override async getAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  /**
   * Sign a message using the keyring service
   * @param message - The message to sign (string or bytes)
   * @returns Promise resolving to the signature
   */
  override async signMessage(message: string | Uint8Array): Promise<string> {
    const messageString = typeof message === 'string' ? message : ethers.hexlify(message);
    return await keyringService.signMessage(this.address, messageString);
  }

  /**
   * Sign a transaction using the keyring service
   * @param transaction - The transaction to sign
   * @returns Promise resolving to the signed transaction
   */
  override async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    // Populate transaction and create compatible format for keyring service
    const tx: ethers.TransactionRequest = { ...transaction };
    
    // Remove from field for signing
    if ('from' in tx) {
      delete tx.from;
    }
    
    // Create compatible transaction request for keyring service
    const keyringTx: import('../../keyring/KeyringService').TransactionRequest = {
      to: tx.to?.toString() ?? '',
      ...(tx.value !== undefined && tx.value !== null && { value: tx.value.toString() }),
      ...(tx.data !== undefined && tx.data !== null && { data: tx.data }),
      ...(tx.gasLimit !== undefined && tx.gasLimit !== null && { gasLimit: tx.gasLimit.toString() }),
      ...(tx.gasPrice !== undefined && tx.gasPrice !== null && { gasPrice: tx.gasPrice.toString() }),
      ...(tx.nonce !== undefined && tx.nonce !== null && { nonce: Number(tx.nonce) })
    };
    
    return await keyringService.signTransaction(this.address, keyringTx);
  }

  /**
   * Sign and send a transaction to the network
   * @param transaction - The transaction to send
   * @returns Promise resolving to the transaction response
   */
  override async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    // Sign transaction
    const signedTx = await this.signTransaction(transaction);
    
    // Send to network
    if (this.provider === null || this.provider === undefined) {
      throw new Error('Provider not available');
    }
    return await (this.provider as ethers.JsonRpcProvider).broadcastTransaction(signedTx);
  }

  /**
   * Connect this signer to a different provider
   * @param provider - The new provider to connect to
   * @returns A new KeyringSigner instance connected to the provider
   */
  override connect(provider: ethers.Provider): KeyringSigner {
    return new KeyringSigner(this.address, provider);
  }

  /**
   * Sign typed data (EIP-712) - not currently supported
   * @param _domain - The domain separator
   * @param _types - The type definitions
   * @param _value - The data to sign
   * @returns Promise that rejects with not supported error
   */
  override signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, unknown>
  ): Promise<string> {
    return Promise.reject(new Error('signTypedData not supported'));
  }
}

// Factory function to create provider
/**
 * Factory function to create a LiveEthereumProvider instance
 * @param networkName - The network to connect to (defaults to mainnet)
 * @returns A new LiveEthereumProvider instance
 */
export function createLiveEthereumProvider(networkName?: keyof typeof ETHEREUM_NETWORKS): LiveEthereumProvider {
  return new LiveEthereumProvider(networkName);
}

// Default provider instance
export const liveEthereumProvider = createLiveEthereumProvider();
