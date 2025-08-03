import { ethers } from 'ethers';
import { LiveEthereumProvider } from '../ethereum/live-provider';
import { ALL_NETWORKS, EVMNetworkConfig, getRpcUrl } from './networks';
import { KeyringService } from '../../keyring/KeyringService';

/**
 * Multi-chain EVM provider that can handle any EVM-compatible chain
 */
export class MultiChainEVMProvider extends LiveEthereumProvider {
  private currentNetwork: EVMNetworkConfig;
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();

  constructor(networkKey: string = 'ethereum') {
    // Initialize with Ethereum mainnet as base
    super('mainnet');
    
    // Load the requested network
    const network = ALL_NETWORKS[networkKey];
    if (!network) {
      throw new Error(`Unknown network: ${networkKey}`);
    }
    
    this.currentNetwork = network;
    this.initializeProvider();
  }

  /**
   * Initialize provider for current network
   */
  private initializeProvider(): void {
    const rpcUrl = getRpcUrl(this.currentNetwork);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
      chainId: this.currentNetwork.chainId,
      name: this.currentNetwork.name
    });
    
    this.providers.set(this.currentNetwork.chainId, provider);
    this.provider = provider;
  }

  /**
   * Switch to a different EVM network
   */
  async switchNetwork(networkKey: string): Promise<void> {
    const network = ALL_NETWORKS[networkKey];
    if (!network) {
      throw new Error(`Unknown network: ${networkKey}`);
    }

    // Check if we already have a provider for this network
    let provider = this.providers.get(network.chainId);
    if (!provider) {
      const rpcUrl = getRpcUrl(network);
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        chainId: network.chainId,
        name: network.name
      });
      this.providers.set(network.chainId, provider);
    }

    this.currentNetwork = network;
    this.provider = provider;
  }

  /**
   * Get current network info
   */
  getCurrentNetwork(): EVMNetworkConfig {
    return this.currentNetwork;
  }

  /**
   * Get native currency symbol
   */
  getNativeCurrency(): string {
    return this.currentNetwork.currency;
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.currentNetwork.chainId;
  }

  /**
   * Get explorer URL for transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${this.currentNetwork.explorer}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for address
   */
  getAddressExplorerUrl(address: string): string {
    return `${this.currentNetwork.explorer}/address/${address}`;
  }

  /**
   * Add custom network
   */
  async addCustomNetwork(network: EVMNetworkConfig): Promise<void> {
    const rpcUrl = getRpcUrl(network);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });

    // Test the connection
    try {
      await provider.getNetwork();
      this.providers.set(network.chainId, provider);
      
      // Add to ALL_NETWORKS for future use
      ALL_NETWORKS[network.shortName] = network;
    } catch (error) {
      throw new Error(`Failed to connect to network: ${error.message}`);
    }
  }

  /**
   * Get gas price with network-specific adjustments
   */
  async getGasPrice(): Promise<ethers.BigNumber> {
    const gasPrice = await this.provider.getGasPrice();
    
    // Apply network-specific adjustments
    switch (this.currentNetwork.shortName) {
      case 'bsc':
        // BSC often needs slightly higher gas price
        return gasPrice.mul(110).div(100); // +10%
      
      case 'polygon':
        // Polygon can use lower gas price
        return gasPrice.mul(90).div(100); // -10%
      
      default:
        return gasPrice;
    }
  }

  /**
   * Estimate gas with network-specific limits
   */
  async estimateGas(transaction: ethers.providers.TransactionRequest): Promise<ethers.BigNumber> {
    const estimate = await this.provider.estimateGas(transaction);
    
    // Apply network-specific adjustments
    switch (this.currentNetwork.shortName) {
      case 'arbitrum':
      case 'optimism':
        // L2s might need higher gas limits
        return estimate.mul(120).div(100); // +20%
      
      default:
        return estimate.mul(110).div(100); // +10% buffer
    }
  }

  /**
   * Get formatted balance with native currency symbol
   */
  async getFormattedBalance(address?: string): Promise<string> {
    const addr = address || await this.getAddress();
    const balance = await this.provider.getBalance(addr);
    const formatted = ethers.utils.formatEther(balance);
    return `${formatted} ${this.currentNetwork.currency}`;
  }

  /**
   * Send transaction with network-specific handling
   */
  async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
    // Add chain ID to prevent replay attacks
    transaction.chainId = this.currentNetwork.chainId;
    
    // Handle network-specific requirements
    if (this.currentNetwork.shortName === 'bsc' && !transaction.gasPrice) {
      // BSC requires gasPrice
      transaction.gasPrice = await this.getGasPrice();
    }
    
    return super.sendTransaction(transaction);
  }

  /**
   * Get list of supported networks
   */
  static getSupportedNetworks(): EVMNetworkConfig[] {
    return Object.values(ALL_NETWORKS);
  }

  /**
   * Get mainnet networks only
   */
  static getMainnetNetworks(): EVMNetworkConfig[] {
    return Object.values(ALL_NETWORKS).filter(network => !network.testnet);
  }

  /**
   * Get testnet networks only
   */
  static getTestnetNetworks(): EVMNetworkConfig[] {
    return Object.values(ALL_NETWORKS).filter(network => network.testnet === true);
  }
}