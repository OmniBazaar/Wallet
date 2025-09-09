import { ethers } from 'ethers';
import { LiveEthereumProvider } from '../ethereum/live-provider';
import { ALL_NETWORKS, EVMNetworkConfig, getRpcUrl } from './networks';
// import { KeyringService } from '../../keyring/KeyringService'; // TODO: implement if needed

/**
 * Multi-chain EVM provider that can handle any EVM-compatible chain
 */
export class MultiChainEVMProvider extends LiveEthereumProvider {
  private currentNetwork: EVMNetworkConfig;
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

  /**
   * Create a new multi-chain EVM provider
   * @param networkKey Network identifier to initialize with
   */
  constructor(networkKey = 'ethereum') {
    // Initialize with Ethereum mainnet as base
    super('mainnet');

    // Load the requested network
    const network = ALL_NETWORKS[networkKey];
    if (network == null) {
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
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: this.currentNetwork.chainId,
      name: this.currentNetwork.name
    });

    this.providers.set(this.currentNetwork.chainId, provider);
    this.provider = provider;
  }

  /**
   * Switch to a different EVM network
   * @param networkKey Network identifier to switch to
   */
  override switchNetwork(networkKey: string): void {
    const network = ALL_NETWORKS[networkKey];
    if (network == null) {
      throw new Error(`Unknown network: ${networkKey}`);
    }

    // Check if we already have a provider for this network
    let provider = this.providers.get(network.chainId);
    if (provider == null) {
      const rpcUrl = getRpcUrl(network);
      provider = new ethers.JsonRpcProvider(rpcUrl, {
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
   * @returns Current network configuration
   */
  getCurrentNetwork(): EVMNetworkConfig {
    return this.currentNetwork;
  }

  /**
   * Get native currency symbol
   * @returns Native currency symbol
   */
  getNativeCurrency(): string {
    return this.currentNetwork.currency;
  }

  /**
   * Get chain ID
   * @returns Chain ID number
   */
  getChainId(): number {
    return this.currentNetwork.chainId;
  }

  /**
   * Get explorer URL for transaction
   * @param txHash Transaction hash
   * @returns Explorer URL for the transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${this.currentNetwork.explorer}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for address
   * @param address - Ethereum address to get explorer URL for
   * @returns Explorer URL for the address
   */
  getAddressExplorerUrl(address: string): string {
    return `${this.currentNetwork.explorer}/address/${address}`;
  }

  /**
   * Add custom network
   * @param network - Network configuration to add
   */
  async addCustomNetwork(network: EVMNetworkConfig): Promise<void> {
    const rpcUrl = getRpcUrl(network);
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
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
      throw new Error(`Failed to connect to network: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get gas price with network-specific adjustments
   * @returns Promise resolving to gas price with network adjustments
   */
  override async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? 20n * 10n ** 9n; // fallback 20 gwei

    // Apply network-specific adjustments
    switch (this.currentNetwork.shortName) {
      case 'bsc':
        // BSC often needs slightly higher gas price
        return (gasPrice * 110n) / 100n; // +10%

      case 'polygon':
        // Polygon can use lower gas price
        return (gasPrice * 90n) / 100n; // -10%

      default:
        return gasPrice;
    }
  }

  /**
   * Estimate gas with network-specific limits
   * @param transaction - Transaction request to estimate gas for
   * @returns Promise resolving to estimated gas with network adjustments
   */
  override async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    const estimate = await this.provider.estimateGas(transaction);

    // Apply network-specific adjustments
    switch (this.currentNetwork.shortName) {
      case 'arbitrum':
      case 'optimism':
        // L2s might need higher gas limits
        return (estimate * 120n) / 100n; // +20%

      default:
        return (estimate * 110n) / 100n; // +10% buffer
    }
  }

  /**
   * Get the active account address
   * @returns Promise resolving to the active account address
   */
  async getAddress(): Promise<string> {
    const signer = await this.getSigner();
    return await signer.getAddress();
  }

  /**
   * Get formatted balance with native currency symbol
   * @param address - Address to get balance for (optional, uses active account if not provided)
   * @returns Promise resolving to formatted balance with currency symbol
   */
  override async getFormattedBalance(address?: string): Promise<string> {
    const addr = (address !== null && address !== undefined && address.length > 0) ? address : await this.getAddress();
    const balance = await this.provider.getBalance(addr);
    const formatted = ethers.formatEther(balance);
    return `${formatted} ${this.currentNetwork.currency}`;
  }

  /**
   * Send transaction with network-specific handling
   * @param transaction - Transaction request to send
   * @returns Promise resolving to transaction response
   */
  override async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    // Add chain ID to prevent replay attacks
    transaction.chainId = this.currentNetwork.chainId;

    // Handle network-specific requirements
    if (this.currentNetwork.shortName === 'bsc' && (transaction.gasPrice === null || transaction.gasPrice === undefined)) {
      // BSC requires gasPrice
      transaction.gasPrice = await this.getGasPrice();
    }

    return super.sendTransaction(transaction);
  }

  /**
   * Get list of supported networks
   * @returns Array of all supported network configurations
   */
  static getSupportedNetworks(): EVMNetworkConfig[] {
    return Object.values(ALL_NETWORKS);
  }

  /**
   * Get mainnet networks only
   * @returns Array of mainnet network configurations
   */
  static getMainnetNetworks(): EVMNetworkConfig[] {
    return Object.values(ALL_NETWORKS).filter(network => network.testnet !== true);
  }

  /**
   * Get testnet networks only
   * @returns Array of testnet network configurations
   */
  static getTestnetNetworks(): EVMNetworkConfig[] {
    return Object.values(ALL_NETWORKS).filter(network => network.testnet === true);
  }
}
