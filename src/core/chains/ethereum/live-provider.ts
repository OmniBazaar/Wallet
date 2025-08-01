/**
 * Live Ethereum Provider with Keyring Integration
 * 
 * This provider connects to real Ethereum networks and integrates
 * with the KeyringService for transaction signing and account management.
 */

import { ethers } from 'ethers';
import { keyringService } from '../../keyring/KeyringService';

export interface EthereumNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Production RPC endpoints
export const ETHEREUM_NETWORKS: Record<string, EthereumNetwork> = {
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth',
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
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
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
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
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
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
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
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Optimism Ether',
      symbol: 'ETH',
      decimals: 18
    }
  }
};

export class LiveEthereumProvider {
  private provider: ethers.JsonRpcProvider;
  private network: EthereumNetwork;
  private signer: ethers.Signer | null = null;
  
  constructor(networkName: string = 'mainnet') {
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
   */
  async switchNetwork(networkName: string): Promise<void> {
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
   */
  async getBalance(address?: string): Promise<ethers.BigNumber> {
    const targetAddress = address || keyringService.getActiveAccount()?.address;
    if (!targetAddress) {
      throw new Error('No address provided');
    }
    
    return await this.provider.getBalance(targetAddress);
  }

  /**
   * Get formatted balance
   */
  async getFormattedBalance(address?: string): Promise<string> {
    const balance = await this.getBalance(address);
    return ethers.utils.formatEther(balance);
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(transaction: ethers.providers.TransactionRequest): Promise<ethers.BigNumber> {
    return await this.provider.estimateGas(transaction);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<ethers.BigNumber> {
    return await this.provider.getGasPrice();
  }

  /**
   * Get EIP-1559 fee data
   */
  async getFeeData(): Promise<ethers.providers.FeeData> {
    return await this.provider.getFeeData();
  }

  /**
   * Send transaction
   */
  async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
    const signer = await this.getSigner();
    return await signer.sendTransaction(transaction);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string, confirmations = 1): Promise<ethers.providers.TransactionReceipt> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Call contract method (read-only)
   */
  async call(transaction: ethers.providers.TransactionRequest): Promise<string> {
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
   */
  async getBlock(blockHashOrNumber: string | number): Promise<ethers.providers.Block> {
    return await this.provider.getBlock(blockHashOrNumber);
  }

  /**
   * Get transaction
   */
  async getTransaction(txHash: string): Promise<ethers.providers.TransactionResponse | null> {
    return await this.provider.getTransaction(txHash);
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

  /**
   * Check if address is contract
   */
  async isContract(address: string): Promise<boolean> {
    const code = await this.provider.getCode(address);
    return code !== '0x';
  }

  /**
   * Resolve ENS name
   */
  async resolveName(name: string): Promise<string | null> {
    return await this.provider.resolveName(name);
  }

  /**
   * Lookup ENS address
   */
  async lookupAddress(address: string): Promise<string | null> {
    return await this.provider.lookupAddress(address);
  }
}

/**
 * Custom signer that uses KeyringService for signing
 */
class KeyringSigner extends ethers.Signer {
  readonly address: string;
  
  constructor(address: string, provider: ethers.providers.Provider) {
    super();
    this.address = address;
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

  connect(provider: ethers.providers.Provider): KeyringSigner {
    return new KeyringSigner(this.address, provider);
  }
}

// Factory function to create provider
export function createLiveEthereumProvider(networkName?: string): LiveEthereumProvider {
  return new LiveEthereumProvider(networkName);
}

// Default provider instance
export const liveEthereumProvider = createLiveEthereumProvider();