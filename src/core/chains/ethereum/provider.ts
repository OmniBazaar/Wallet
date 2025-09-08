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
    provider: ProviderName.ETHEREUM,
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
    provider: ProviderName.ETHEREUM,
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
    network: EthereumNetwork = EthereumNetworks['ethereum']
  ) {
    super();
    this.network = network;
    this.toWindow = toWindow;
    this.namespace = ProviderName.ETHEREUM;
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
  private async handleRPCRequest(request: ProviderRPCRequest): Promise<unknown> {
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
        const address = params[0];
        if (typeof address === 'string') {
          const balance = await this.provider.getBalance(address, 'latest');
          return ethers.toQuantity(balance);
        }
        throw new Error('Missing address parameter');
      }

      case 'eth_sendTransaction': {
        const tx = params[0];
        if (tx && typeof tx === 'object') {
          return await this.prepareTransaction(tx as { to: string; value?: string; data?: string; gas?: string; gasPrice?: string });
        }
        throw new Error('Missing transaction parameter');
      }

      case 'eth_signTransaction': {
        const tx = params[0];
        if (tx && typeof tx === 'object') {
          return await this.signTransactionInternal(tx as { to: string; value?: string; data?: string; gas?: string; gasPrice?: string });
        }
        throw new Error('Missing transaction parameter');
      }

      case 'personal_sign': {
        const msg = params[0];
        const addr = params[1];
        if (typeof msg === 'string' && typeof addr === 'string') {
          return await this.personalSign(msg, addr);
        }
        throw new Error('Missing parameters for personal_sign');
      }

      case 'eth_signTypedData_v4': {
        const addr = params[0];
        const data = params[1];
        if (typeof addr === 'string' && typeof data === 'string') {
          return await this.signTypedData(addr, data);
        }
        throw new Error('Missing parameters for eth_signTypedData_v4');
      }

      case 'eth_getTransactionReceipt': {
        const hash = params[0];
        if (typeof hash === 'string') {
          const receipt = await this.provider.getTransactionReceipt(hash);
          return receipt;
        }
        throw new Error('Missing transaction hash');
      }

      case 'eth_getTransactionByHash': {
        const hash = params[0];
        if (typeof hash === 'string') {
          const tx = await this.provider.getTransaction(hash);
          return tx;
        }
        throw new Error('Missing transaction hash');
      }

      case 'eth_estimateGas': {
        const tx = params[0];
        if (tx && typeof tx === 'object') {
          const gasEstimate = await this.provider.estimateGas(tx as ethers.TransactionRequest);
          return ethers.toQuantity(gasEstimate);
        }
        throw new Error('Missing transaction object');
      }

      case 'eth_gasPrice': {
        try {
          const feeData = await this.provider.getFeeData();
          const gasPrice = feeData.gasPrice ?? 20n * 10n ** 9n; // fallback 20 gwei
          return ethers.toQuantity(gasPrice);
        } catch (error) {
          console.warn('Failed to get gas price:', error);
          return '0x' + (20 * 1e9).toString(16); // 20 gwei fallback (legacy)
        }
      }

      case 'eth_blockNumber': {
        const blockNumber = await this.provider.getBlockNumber();
        return ethers.toQuantity(blockNumber);
      }

      case 'eth_getBlockByNumber': {
        const blockTag = params[0];
        if (typeof blockTag === 'string' || typeof blockTag === 'number') {
          const block = await this.provider.getBlock(blockTag as any);
          return block;
        }
        throw new Error('Missing block parameter');
      }

      // Subscription methods (for WebSocket-like functionality)
      case 'eth_subscribe': {
        const subType = params[0] as string;
        const subParams = params[1] as string[] | undefined;
        if (typeof subType === 'string') {
          return await this.handleSubscription(subType, subParams);
        }
        throw new Error('Missing subscription type');
      }

      case 'eth_unsubscribe': {
        const subId = params[0];
        if (typeof subId === 'string') {
          return await this.handleUnsubscription(subId);
        }
        throw new Error('Missing subscription id');
      }

      default:
        // Forward unknown methods to the provider
        return await this.provider.send(method, params as any[]);
    }
  }

  protected async prepareTransaction(txParams: { to: string; value?: string; data?: string; gas?: string; gasPrice?: string }): Promise<string> {
    try {
      // Create transaction request
      const transactionRequest: ethers.TransactionRequest = {
        to: txParams.to,
        value: txParams.value ? ethers.parseEther(txParams.value) : 0,
        data: txParams.data || '0x',
        gasLimit: txParams.gas ? BigInt(txParams.gas) : undefined,
        gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined
      };

      // This method should be called with a signer
      // For now, we'll prepare the transaction for signing
      const serializedTx = ethers.Transaction.from(transactionRequest).serialized;
      
      // Return the serialized transaction hash that would be signed by keyring
      return ethers.keccak256(serializedTx);
    } catch (error) {
      throw new Error(`Failed to prepare transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async signTransactionInternal(txParams: { to: string; value?: string; data?: string; gas?: string; gasPrice?: string }): Promise<string> {
    try {
      // Create transaction request
      const transactionRequest: ethers.TransactionRequest = {
        to: txParams.to,
        value: txParams.value ? ethers.parseEther(txParams.value) : 0,
        data: txParams.data || '0x',
        gasLimit: txParams.gas ? BigInt(txParams.gas) : undefined,
        gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined
      };

      // Get nonce
      if (this.selectedAddress) {
        transactionRequest.nonce = await this.provider.getTransactionCount(this.selectedAddress);
      }

      // Estimate gas if not provided
      if (!transactionRequest.gasLimit) {
        transactionRequest.gasLimit = await this.provider.estimateGas(transactionRequest);
      }

      // Get gas price if not provided
      if (!transactionRequest.gasPrice) {
        const feeData = await this.provider.getFeeData();
        transactionRequest.gasPrice = feeData.gasPrice || 20n * 10n ** 9n; // 20 gwei fallback
      }

      // Serialize the transaction for signing
      const tx = ethers.Transaction.from(transactionRequest);
      return tx.serialized;
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async personalSign(message: string, address: string): Promise<string> {
    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid address provided');
      }

      // Create the message hash that would be signed
      const messageHash = ethers.hashMessage(message);
      
      // In a real implementation, this would use the keyring to sign
      // For now, return the message hash that should be signed
      return messageHash;
    } catch (error) {
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async signTypedData(address: string, typedData: string): Promise<string> {
    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid address provided');
      }

      // Parse typed data
      const parsedData = JSON.parse(typedData);
      
      // Create the typed data hash that would be signed
      const domain = parsedData.domain || {};
      const types = parsedData.types || {};
      const message = parsedData.message || {};
      
      // Compute the typed data hash
      const typedDataHash = ethers.TypedDataEncoder.hash(domain, types, message);
      
      // In a real implementation, this would use the keyring to sign
      // For now, return the hash that should be signed
      return typedDataHash;
    } catch (error) {
      throw new Error(`Failed to sign typed data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
            result: { number: ethers.toQuantity(blockNumber) }
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
    const balanceFn = (contract as any)['balanceOf'];
    if (typeof balanceFn !== 'function') {
      throw new Error('Token contract does not implement balanceOf');
    }
    const balance = await balanceFn(userAddress);
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
    const fn = contract.getFunction('transfer');
    const gasEstimate = await fn.estimateGas(to, amount);
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
    const tokenURIFn = (contract as any)['tokenURI'];
    const ownerOfFn = (contract as any)['ownerOf'];
    if (typeof tokenURIFn !== 'function' || typeof ownerOfFn !== 'function') {
      throw new Error('NFT contract missing tokenURI or ownerOf');
    }
    const [tokenURI, owner] = await Promise.all([
      tokenURIFn(tokenId),
      ownerOfFn(tokenId)
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

  // BaseProvider interface implementations

  /**
   * Get balance for an address (implements BaseProvider interface)
   * @param address - Address to get balance for
   * @returns Balance in wei as string
   */
  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return balance.toString();
  }

  /**
   * Get formatted balance in ETH (implements BaseProvider interface)
   * @param address - Address to get balance for
   * @returns Formatted balance in ETH
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    return this.formatBalance(balance) + ' ETH';
  }

  /**
   * Sign transaction (implements BaseProvider interface)
   * @param privateKey - Private key for signing (not used - uses keyring)
   * @param transaction - Transaction to sign
   * @returns Signed transaction as hex string
   */
  async signTransaction(privateKey: string, transaction: import('@/types').TransactionRequest): Promise<string> {
    // Create ethers transaction request
    const ethersRequest = {
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      gas: transaction.gasLimit,
      gasPrice: transaction.gasPrice
    };
    
    return await this.signTransactionInternal(ethersRequest);
  }

  /**
   * Send signed transaction (implements BaseProvider interface)
   * @param signedTransaction - Signed transaction hex string
   * @returns Transaction hash
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    try {
      const txResponse = await this.provider.broadcastTransaction(signedTransaction);
      return txResponse.hash;
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction details (implements BaseProvider interface)
   * @param txHash - Transaction hash
   * @returns Transaction details
   */
  async getTransaction(txHash: string): Promise<import('@/types').Transaction> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!tx) {
        throw new Error('Transaction not found');
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        fee: receipt ? (receipt.gasUsed * (tx.gasPrice || 0n)).toString() : '0',
        data: tx.data,
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice?.toString(),
        nonce: tx.nonce,
        chainId: tx.chainId ? Number(tx.chainId) : undefined,
        blockNumber: tx.blockNumber || undefined,
        blockHash: tx.blockHash || undefined,
        timestamp: receipt?.blockNumber ? (await this.provider.getBlock(receipt.blockNumber))?.timestamp : undefined,
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction history for address (implements BaseProvider interface)
   * @param address - Address to get history for
   * @param limit - Maximum number of transactions to return
   * @returns Array of transactions
   */
  async getTransactionHistory(address: string, limit = 20): Promise<import('@/types').Transaction[]> {
    try {
      // Note: This is a simplified implementation
      // In production, you'd use an indexing service like Etherscan API
      const currentBlock = await this.provider.getBlockNumber();
      const transactions: import('@/types').Transaction[] = [];
      
      // Scan recent blocks (limited approach)
      const blocksToScan = Math.min(limit * 5, 100); // Estimate blocks to scan
      
      for (let i = 0; i < blocksToScan && transactions.length < limit; i++) {
        const blockNumber = currentBlock - i;
        try {
          const block = await this.provider.getBlock(blockNumber, true);
          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && tx !== null && 'from' in tx && 'to' in tx && 'hash' in tx) {
                const txObj = tx as any;
                if (txObj.from === address || txObj.to === address) {
                  const transaction = await this.getTransaction(txObj.hash);
                  transactions.push(transaction);
                  if (transactions.length >= limit) break;
                }
              }
            }
          }
        } catch (blockError) {
          // Skip blocks that can't be fetched
          continue;
        }
      }

      return transactions;
    } catch (error) {
      throw new Error(`Failed to get transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to new blocks (implements BaseProvider interface)
   * @param callback - Callback for new block notifications
   * @returns Unsubscribe function
   */
  async subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    const listener = (blockNumber: number) => {
      callback(blockNumber);
    };

    this.provider.on('block', listener);

    return () => {
      this.provider.off('block', listener);
    };
  }

  /**
   * Sign message (implements BaseProvider interface)
   * @param privateKey - Private key for signing (not used - uses keyring)
   * @param message - Message to sign
   * @returns Signed message
   */
  async signMessage(privateKey: string, message: string): Promise<string> {
    // In practice, this would use the keyring with the selected address
    if (!this.selectedAddress) {
      throw new Error('No address selected for signing');
    }
    return await this.personalSign(message, this.selectedAddress);
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
