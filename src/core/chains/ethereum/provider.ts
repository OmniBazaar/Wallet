// OmniBazaar Wallet Ethereum Provider
// Adapted from Enkrypt Ethereum provider for our hybrid architecture

import { ethers } from 'ethers';
import { 
  BackgroundProviderInterface,
  ProviderName,
  ProviderRPCRequest,
  OnMessageResponse,
  EthereumProviderInterface,
  MiddlewareFunction
} from '@/types/provider';
import { EthereumNetwork, BaseNetwork } from '@/types/base-network';
import EventEmitter from 'eventemitter3';

// Default Ethereum networks
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

export class EthereumProvider extends EventEmitter implements EthereumProviderInterface {
  network: EthereumNetwork;
  provider: ethers.providers.JsonRpcProvider;
  namespace: string;
  toWindow: (message: string) => void;
  chainId: string;
  networkVersion: string;
  selectedAddress: string | null = null;
  middlewares: MiddlewareFunction[] = [];

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
    this.provider = new ethers.providers.JsonRpcProvider(this.network.node);
    
    // Set up provider event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for network changes
    this.provider.on('network', (newNetwork: any, oldNetwork: any) => {
      if (oldNetwork) {
        this.emit('chainChanged', '0x' + newNetwork.chainId.toString(16));
        this.sendNotification(JSON.stringify({
          method: 'chainChanged',
          params: ['0x' + newNetwork.chainId.toString(16)]
        }));
      }
    });
  }

  async setRequestProvider(network: BaseNetwork): Promise<void> {
    const ethNetwork = network as EthereumNetwork;
    const oldChainId = this.chainId;
    this.network = ethNetwork;
    this.chainId = ethNetwork.chainID;
    this.networkVersion = parseInt(ethNetwork.chainID, 16).toString();
    
    // Create new provider instance
    this.provider = new ethers.providers.JsonRpcProvider(ethNetwork.node);
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

  async request(request: ProviderRPCRequest): Promise<OnMessageResponse> {
    try {
      const result = await this.handleRPCRequest(request);
      return {
        result: JSON.stringify(result)
      };
    } catch (error: any) {
      return {
        error: JSON.stringify(error.message || 'Unknown error')
      };
    }
  }

  private async handleRPCRequest(request: ProviderRPCRequest): Promise<any> {
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
          return ethers.utils.hexlify(balance);
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
          return ethers.utils.hexlify(gasEstimate);
        }
        throw new Error('Missing transaction object');
      }

      case 'eth_gasPrice': {
        try {
          const gasPrice = await this.provider.getGasPrice();
          return ethers.utils.hexlify(gasPrice);
        } catch (error) {
          // Fallback for older ethers versions
          return '0x' + (20 * 1e9).toString(16); // 20 gwei fallback
        }
      }

      case 'eth_blockNumber': {
        const blockNumber = await this.provider.getBlockNumber();
        return ethers.utils.hexlify(blockNumber);
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

  private async sendTransaction(txParams: any): Promise<string> {
    // This will be integrated with the keyring for signing
    // For now, return a placeholder
    throw new Error('Transaction signing not yet implemented - requires keyring integration');
  }

  private async signTransaction(txParams: any): Promise<string> {
    // This will be integrated with the keyring for signing
    throw new Error('Transaction signing not yet implemented - requires keyring integration');
  }

  private async personalSign(message: string, address: string): Promise<string> {
    // This will be integrated with the keyring for signing
    throw new Error('Message signing not yet implemented - requires keyring integration');
  }

  private async signTypedData(address: string, typedData: string): Promise<string> {
    // This will be integrated with the keyring for signing
    throw new Error('Typed data signing not yet implemented - requires keyring integration');
  }

  private async handleSubscription(type: string, params?: any): Promise<string> {
    // Generate subscription ID
    const subscriptionId = Math.random().toString(16).slice(2);
    
    // Handle different subscription types
    switch (type) {
      case 'newHeads': {
        // Subscribe to new block headers
        this.provider.on('block', (blockNumber: number) => {
          this.sendNotification(JSON.stringify({
            subscription: subscriptionId,
            result: { number: ethers.utils.hexlify(blockNumber) }
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

  private async handleUnsubscription(subscriptionId: string): Promise<boolean> {
    // Remove subscription (simplified for now)
    return true;
  }

  async isPersistentEvent(request: ProviderRPCRequest): Promise<boolean> {
    return request.method === 'eth_subscribe';
  }

  async sendNotification(notif: string): Promise<void> {
    this.toWindow(notif);
  }

  getUIPath(page: string): string {
    return `/ethereum/${page}`;
  }

  // Additional utility methods for OmniBazaar integration
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

  async estimateTokenTransferGas(tokenAddress: string, to: string, amount: string): Promise<string> {
    const tokenABI = ['function transfer(address to, uint256 amount) returns (bool)'];
    const contract = new ethers.Contract(tokenAddress, tokenABI, this.provider);
    
    const gasEstimate = await contract.transfer.estimateGas(to, amount);
    return gasEstimate.toString();
  }

  // NFT-related methods for marketplace integration
  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<any> {
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

  // Format helper methods
  formatBalance(balance: string): string {
    return ethers.utils.formatEther(balance);
  }

  parseAmount(amount: string): ethers.BigNumber {
    return ethers.utils.parseEther(amount);
  }
}

export default EthereumProvider; 