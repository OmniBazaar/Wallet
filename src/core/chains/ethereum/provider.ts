/**
 * OmniBazaar Wallet Ethereum Provider.
 *
 * Adapts an Ethers JsonRpcProvider to the wallet’s provider interface
 * and implements request handling, signing, and network switching for
 * our hybrid architecture.
 */

import { ethers } from 'ethers';
import {
  ProviderName,
  ProviderRPCRequest,
  OnMessageResponse,
  EthereumProviderInterface,
  MiddlewareFunction
} from '@/types/provider';
import { EthereumNetwork, BaseNetwork } from '@/types/base-network';
import EventEmitter from 'eventemitter3';

/**
 * Configuration for supported Ethereum networks
 */
export const EthereumNetworks: { [key: string]: EthereumNetwork } = {
  ethereum: {
    name: 'ethereum',
    name_long: 'Ethereum Mainnet',
    homePage: 'https://ethereum.org',
    blockExplorerTX: 'https://etherscan.io/tx/[[txHash]]',
    blockExplorerAddr: 'https://etherscan.io/address/[[address]]',
    isTestNetwork: false,
    currencyName: 'ETH',
    icon: 'ethereum',
    node: 'https://rpc.ankr.com/eth',
    chainID: '0x1',
    slip44: 60,
    coingeckoID: 'ethereum',
    provider: ProviderName.ethereum,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/60\'/0\'/0'
  },
  sepolia: {
    name: 'sepolia',
    name_long: 'Ethereum Sepolia Testnet',
    homePage: 'https://ethereum.org',
    blockExplorerTX: 'https://sepolia.etherscan.io/tx/[[txHash]]',
    blockExplorerAddr: 'https://sepolia.etherscan.io/address/[[address]]',
    isTestNetwork: true,
    currencyName: 'SepoliaETH',
    icon: 'ethereum',
    node: 'https://rpc.sepolia.org',
    chainID: '0xaa36a7',
    slip44: 60,
    provider: ProviderName.ethereum,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/60\'/0\'/0'
  }
};

/**
 * Ethereum provider implementation for OmniBazaar wallet
 * Handles RPC requests, transaction signing, and network management
 */
export class EthereumProvider extends EventEmitter implements EthereumProviderInterface {
  network: EthereumNetwork;
  provider: ethers.JsonRpcProvider;
  namespace: string;
  toWindow: (message: string) => void;
  chainId: string;
  networkVersion: string;
  selectedAddress: string | null = null;
  middlewares: MiddlewareFunction[] = [];

  /**
   * Create a new Ethereum provider instance.
   * @param toWindow Function to send messages to the window/UI
   * @param network Ethereum network configuration (defaults to mainnet)
   */
  constructor(
    toWindow: (message: string) => void,
    network: EthereumNetwork = EthereumNetworks.ethereum
  ) {
    super();
    this.network = network;
    this.toWindow = toWindow;
    this.namespace = ProviderName.ethereum;
    this.chainId = this.network.chainID;
    this.networkVersion = parseInt(this.network.chainID, 16).toString();
    this.provider = new ethers.JsonRpcProvider(this.network.node);

    // Set up provider event listeners
    this.setupEventListeners();
  }

  /** Set up event listeners for provider state changes. */
  private setupEventListeners(): void {
    // Listen for network changes
    (this.provider as any).on('network', (newNetwork: { chainId: number }, oldNetwork: { chainId: number } | null) => {
      if (oldNetwork != null) {
        this.emit('chainChanged', '0x' + newNetwork.chainId.toString(16));
        this.sendNotification(JSON.stringify({
          method: 'chainChanged',
          params: ['0x' + newNetwork.chainId.toString(16)]
        }));
      }
    });
  }

  /**
   * Switch the provider to a different network.
   * @param network Target network configuration
   */
  async setRequestProvider(network: BaseNetwork): Promise<void> {
    const ethNetwork = network as EthereumNetwork;
    const oldChainId = this.chainId;
    this.network = ethNetwork;
    this.chainId = ethNetwork.chainID;
    this.networkVersion = parseInt(ethNetwork.chainID, 16).toString();

    // Create new provider instance
    this.provider = new ethers.JsonRpcProvider(ethNetwork.node);
    this.setupEventListeners();

    // Emit chain changed event if different
    if (oldChainId !== this.chainId) {
      this.emit('chainChanged', this.chainId);
      await this.sendNotification(JSON.stringify({
        method: 'chainChanged',
        params: [this.chainId]
      }));
    }
  }

  /**
   * Handle RPC requests from dApps or the wallet UI.
   * @param request RPC request containing method and params
   * @returns Response object with serialized result or error
   */
  async request(request: ProviderRPCRequest): Promise<OnMessageResponse> {
    try {
      const result = await this.handleRPCRequest(request);
      return {
        result: JSON.stringify(result)
      };
    } catch (error: unknown) {
      return {
        error: JSON.stringify(error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Internal RPC request handler covering common Ethereum methods.
   * @param request RPC request to process
   * @returns Result data for the RPC call
   */
  private async handleRPCRequest(request: ProviderRPCRequest): Promise<string | string[] | number> {
    const { method, params = [] } = request;

    switch (method) {
      case 'eth_chainId':
        return this.chainId;

      case 'eth_networkVersion':
      case 'net_version':
        return this.networkVersion;

      case 'eth_accounts':
      case 'eth_requestAccounts':
        // Return connected accounts (will be integrated with keyring)
        return this.selectedAddress ? [this.selectedAddress] : [];

      case 'eth_getBalance': {
        if (params[0]) {
          const balance = await this.provider.getBalance(params[0], 'latest');
          return ethers.hexlify(balance);
        }
        throw new Error('Missing address parameter');
      }

      case 'eth_sendTransaction': {
        if (params[0]) {
          return await this.sendTransaction(params[0]);
        }
        throw new Error('Missing transaction parameter');
      }

      case 'eth_signTransaction': {
        if (params[0]) {
          return await this.signTransaction(params[0]);
        }
        throw new Error('Missing transaction parameter');
      }

      case 'personal_sign': {
        if (params[0] && params[1]) {
          return await this.personalSign(params[0], params[1]);
        }
        throw new Error('Missing parameters for personal_sign');
      }

      case 'eth_signTypedData_v4': {
        if (params[0] && params[1]) {
          return await this.signTypedData(params[0], params[1]);
        }
        throw new Error('Missing parameters for eth_signTypedData_v4');
      }

      case 'eth_getTransactionReceipt': {
        if (params[0]) {
          const receipt = await this.provider.getTransactionReceipt(params[0]);
          return receipt;
        }
        throw new Error('Missing transaction hash');
      }

      case 'eth_getTransactionByHash': {
        if (params[0]) {
          const tx = await this.provider.getTransaction(params[0]);
          return tx;
        }
        throw new Error('Missing transaction hash');
      }

      case 'eth_estimateGas': {
        if (params[0]) {
          const gasEstimate = await this.provider.estimateGas(params[0]);
          return ethers.hexlify(gasEstimate);
        }
        throw new Error('Missing transaction object');
      }

      case 'eth_gasPrice': {
        try {
          const gasPrice = await this.provider.getGasPrice();
          return ethers.hexlify(gasPrice);
        } catch (error) {
          console.warn('Failed to get gas price:', error);
          return '0x' + (20 * 1e9).toString(16); // 20 gwei fallback
        }
      }

      case 'eth_blockNumber': {
        const blockNumber = await this.provider.getBlockNumber();
        return ethers.hexlify(blockNumber);
      }

      case 'eth_getBlockByNumber': {
        if (params[0] !== undefined) {
          const block = await this.provider.getBlock(params[0]);
          return block;
        }
        throw new Error('Missing block parameter');
      }

      // Subscription methods (for WebSocket-like functionality)
      case 'eth_subscribe':
        return await this.handleSubscription(params[0], params[1]);

      case 'eth_unsubscribe':
        return await this.handleUnsubscription(params[0]);

      default:
        // Forward unknown methods to the provider
        return await this.provider.send(method, params);
    }
  }

  private async sendTransaction(_txParams: { to: string; value?: string; data?: string; gas?: string; gasPrice?: string }): Promise<string> {
    // This will be integrated with the keyring for signing
    // For now, return a placeholder
    throw new Error('Transaction signing not yet implemented - requires keyring integration');
  }

  private async signTransaction(_txParams: { to: string; value?: string; data?: string; gas?: string; gasPrice?: string }): Promise<string> {
    // This will be integrated with the keyring for signing
    throw new Error('Transaction signing not yet implemented - requires keyring integration');
  }

  private async personalSign(_message: string, _address: string): Promise<string> {
    // This will be integrated with the keyring for signing
    throw new Error('Message signing not yet implemented - requires keyring integration');
  }

  private async signTypedData(_address: string, _typedData: string): Promise<string> {
    // This will be integrated with the keyring for signing
    throw new Error('Typed data signing not yet implemented - requires keyring integration');
  }

  private async handleSubscription(type: string, _params?: string[]): Promise<string> {
    // Generate subscription ID
    const subscriptionId = Math.random().toString(16).slice(2);

    // Handle different subscription types
    switch (type) {
      case 'newHeads': {
        // Subscribe to new block headers
        this.provider.on('block', (blockNumber: number) => {
          this.sendNotification(JSON.stringify({
            subscription: subscriptionId,
            result: { number: utils.hexlify(blockNumber) }
          }));
        });
        break;
      }

      case 'logs':
        // Subscribe to logs (will need more sophisticated filtering)
        break;

      default:
        throw new Error(`Unsupported subscription type: ${type}`);
    }

    return subscriptionId;
  }

  private async handleUnsubscription(_subscriptionId: string): Promise<boolean> {
    // Remove subscription (simplified for now)
    return true;
  }

  /**
   * Determines if an RPC request creates a persistent event subscription
   * @param request - RPC request to check
   * @returns True if the request creates a subscription
   */
  async isPersistentEvent(request: ProviderRPCRequest): Promise<boolean> {
    return request.method === 'eth_subscribe';
  }

  /**
   * Sends a notification to the wallet UI
   * @param notif - Notification message as JSON string
   */
  async sendNotification(notif: string): Promise<void> {
    this.toWindow(notif);
  }

  /**
   * Gets the UI path for a specific page
   * @param page - Page name
   * @returns UI path for the page
   */
  getUIPath(page: string): string {
    return `/ethereum/${page}`;
  }

  /**
   * Gets the balance of an ERC-20 token for a user
   * @param tokenAddress - Contract address of the token
   * @param userAddress - User's wallet address
   * @returns Token balance as string
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    const tokenABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];

    const contract = new ethers.Contract(tokenAddress, tokenABI, this.provider);
    const balance = await contract.balanceOf(userAddress);
    return balance.toString();
  }

  /**
   * Estimates gas needed for an ERC-20 token transfer
   * @param tokenAddress - Contract address of the token
   * @param to - Recipient address
   * @param amount - Amount to transfer
   * @returns Estimated gas as string
   */
  async estimateTokenTransferGas(tokenAddress: string, to: string, amount: string): Promise<string> {
    const tokenABI = ['function transfer(address to, uint256 amount) returns (bool)'];
    const contract = new ethers.Contract(tokenAddress, tokenABI, this.provider);

    const gasEstimate = await contract.estimateGas.transfer(to, amount);
    return gasEstimate.toString();
  }

  /**
   * Gets metadata for an NFT from its contract
   * @param contractAddress - NFT contract address
   * @param tokenId - Token ID of the NFT
   * @returns Object containing tokenURI and owner address
   */
  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<{ tokenURI: string; owner: string }> {
    const nftABI = [
      'function tokenURI(uint256 tokenId) view returns (string)',
      'function ownerOf(uint256 tokenId) view returns (address)'
    ];

    const contract = new ethers.Contract(contractAddress, nftABI, this.provider);
    const [tokenURI, owner] = await Promise.all([
      contract.tokenURI(tokenId),
      contract.ownerOf(tokenId)
    ]);

    return { tokenURI, owner };
  }

  /**
   * Formats a balance from wei to ETH
   * @param balance - Balance in wei as string
   * @returns Formatted balance in ETH
   */
  formatBalance(balance: string | bigint): string {
    const b = typeof balance === 'string' ? BigInt(balance) : balance;
    return ethers.formatEther(b);
  }

  /**
   * Parses an amount from ETH to wei
   * @param amount - Amount in ETH as string
   * @returns Amount in wei as BigNumber
   */
  parseAmount(amount: string): bigint {
    return ethers.parseEther(amount);
  }
}

export default EthereumProvider;

// Export live provider
export { LiveEthereumProvider, createLiveEthereumProvider, liveEthereumProvider } from './live-provider';

/**
 * Gets a live Ethereum provider instance
 * @param _networkName - Network name (currently unused)
 * @returns Promise resolving to JsonRpcProvider instance
 */
export async function getProvider(_networkName?: string): Promise<ethers.JsonRpcProvider> {
  const { liveEthereumProvider } = await import('./live-provider');
  return liveEthereumProvider.getProvider();
}
