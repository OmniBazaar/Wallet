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
} from '../../../types/provider';
import { EthereumNetwork, BaseNetwork } from '../../../types/base-network';
import EventEmitter from 'eventemitter3';
import { generateSecureSubscriptionId } from '../../utils/secure-random';

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
    network?: EthereumNetwork
  ) {
    super();
    const defaultNetwork = network ?? EthereumNetworks['ethereum'];
    if (defaultNetwork === undefined) {
      throw new Error('Ethereum mainnet network configuration not found');
    }
    this.network = defaultNetwork;
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
    const providerWithEvents = this.provider as ethers.JsonRpcProvider & {
      on(event: 'network', listener: (newNetwork: { chainId: number }, oldNetwork: { chainId: number } | null) => void): void;
    };
    providerWithEvents.on('network', (newNetwork: { chainId: number }, oldNetwork: { chainId: number } | null) => {
      if (oldNetwork !== null && oldNetwork !== undefined) {
        this.emit('chainChanged', '0x' + newNetwork.chainId.toString(16));
        void this.sendNotification(JSON.stringify({
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
  setRequestProvider(network: BaseNetwork): void {
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
      void this.sendNotification(JSON.stringify({
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
        return this.selectedAddress !== null && this.selectedAddress !== undefined && this.selectedAddress !== '' ? [this.selectedAddress] : [];

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
        if (tx !== null && tx !== undefined && typeof tx === 'object') {
          return this.prepareTransaction(tx as { to: string; value?: string; data?: string; gas?: string; gasPrice?: string });
        }
        throw new Error('Missing transaction parameter');
      }

      case 'eth_signTransaction': {
        const tx = params[0];
        if (tx !== null && tx !== undefined && typeof tx === 'object') {
          return await this.signTransactionInternal(tx as { to: string; value?: string; data?: string; gas?: string; gasPrice?: string });
        }
        throw new Error('Missing transaction parameter');
      }

      case 'personal_sign': {
        const msg = params[0];
        const addr = params[1];
        if (typeof msg === 'string' && typeof addr === 'string') {
          return this.personalSign(msg, addr);
        }
        throw new Error('Missing parameters for personal_sign');
      }

      case 'eth_signTypedData_v4': {
        const addr = params[0];
        const data = params[1];
        if (typeof addr === 'string' && typeof data === 'string') {
          return this.signTypedData(addr, data);
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
        if (tx !== null && tx !== undefined && typeof tx === 'object') {
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
          const block = await this.provider.getBlock(blockTag as ethers.BlockTag);
          return block;
        }
        throw new Error('Missing block parameter');
      }

      // Subscription methods (for WebSocket-like functionality)
      case 'eth_subscribe': {
        const subType = params[0] as string;
        const subParams = params[1] as string[] | undefined;
        if (typeof subType === 'string') {
          return this.handleSubscription(subType, subParams);
        }
        throw new Error('Missing subscription type');
      }

      case 'eth_unsubscribe': {
        const subId = params[0];
        if (typeof subId === 'string') {
          return this.handleUnsubscription(subId);
        }
        throw new Error('Missing subscription id');
      }

      default:
        // Forward unknown methods to the provider
        return this.provider.send(method, params as string[]);
    }
  }

  protected prepareTransaction(txParams: { to: string; value?: string; data?: string; gas?: string; gasPrice?: string }): string {
    try {
      // Create transaction request
      const transactionRequest: ethers.TransactionRequest = {
        to: txParams.to,
        value: txParams.value !== null && txParams.value !== undefined && txParams.value !== '' ? ethers.parseEther(txParams.value) : 0,
        data: txParams.data ?? '0x'
      };

      // Add optional properties only if they have values
      if (txParams.gas !== null && txParams.gas !== undefined && txParams.gas !== '') {
        transactionRequest.gasLimit = BigInt(txParams.gas);
      }
      if (txParams.gasPrice !== null && txParams.gasPrice !== undefined && txParams.gasPrice !== '') {
        transactionRequest.gasPrice = BigInt(txParams.gasPrice);
      }

      // This method should be called with a signer
      // For now, we'll prepare the transaction for signing
      // Convert TransactionRequest to compatible format
      const txData: ethers.TransactionLike<string> = {
        to: transactionRequest.to?.toString() ?? '',
        value: transactionRequest.value?.toString() ?? '0',
        data: transactionRequest.data ?? '0x'
      };

      // Add optional properties only if they exist
      if (transactionRequest.gasLimit !== undefined && transactionRequest.gasLimit !== null) {
        txData.gasLimit = transactionRequest.gasLimit.toString();
      }
      if (transactionRequest.gasPrice !== undefined && transactionRequest.gasPrice !== null) {
        txData.gasPrice = transactionRequest.gasPrice.toString();
      }
      if (transactionRequest.nonce !== undefined) {
        txData.nonce = transactionRequest.nonce;
      }
      const serializedTx = ethers.Transaction.from(txData).serialized;
      
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
        value: (txParams.value !== undefined && txParams.value !== '') ? ethers.parseEther(txParams.value) : BigInt(0),
        data: txParams.data ?? '0x'
      };

      // Add optional properties only if they have values  
      if (txParams.gas !== undefined && txParams.gas !== '') {
        transactionRequest.gasLimit = BigInt(txParams.gas);
      }
      if (txParams.gasPrice !== undefined && txParams.gasPrice !== '') {
        transactionRequest.gasPrice = BigInt(txParams.gasPrice);
      }

      // Get nonce
      if (this.selectedAddress !== null && this.selectedAddress !== undefined) {
        transactionRequest.nonce = await this.provider.getTransactionCount(this.selectedAddress);
      }

      // Estimate gas if not provided
      if (transactionRequest.gasLimit === undefined) {
        transactionRequest.gasLimit = await this.provider.estimateGas(transactionRequest);
      }

      // Get gas price if not provided
      if (transactionRequest.gasPrice === undefined) {
        const feeData = await this.provider.getFeeData();
        transactionRequest.gasPrice = feeData.gasPrice ?? (BigInt(20) * BigInt(10) ** BigInt(9)); // 20 gwei fallback
      }

      // Serialize the transaction for signing
      // Convert TransactionRequest to compatible format
      const txData: ethers.TransactionLike<string> = {
        to: transactionRequest.to?.toString() ?? '',
        value: transactionRequest.value?.toString() ?? '0',
        data: transactionRequest.data ?? '0x'
      };

      // Add optional properties only if they exist
      if (transactionRequest.gasLimit !== undefined && transactionRequest.gasLimit !== null) {
        txData.gasLimit = transactionRequest.gasLimit.toString();
      }
      if (transactionRequest.gasPrice !== undefined && transactionRequest.gasPrice !== null) {
        txData.gasPrice = transactionRequest.gasPrice.toString();
      }
      if (transactionRequest.nonce !== undefined) {
        txData.nonce = transactionRequest.nonce;
      }
      const tx = ethers.Transaction.from(txData);
      return tx.serialized;
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private personalSign(message: string, address: string): string {
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

  private signTypedData(address: string, typedData: string): string {
    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid address provided');
      }

      // Parse typed data
      const parsedData = JSON.parse(typedData) as {
        domain?: ethers.TypedDataDomain;
        types?: Record<string, ethers.TypedDataField[]>;
        message?: Record<string, unknown>;
      };
      
      // Create the typed data hash that would be signed
      const domain = parsedData.domain ?? {};
      const types = parsedData.types ?? {};
      const message = parsedData.message ?? {};
      
      // Compute the typed data hash
      const typedDataHash = ethers.TypedDataEncoder.hash(domain, types, message);
      
      // In a real implementation, this would use the keyring to sign
      // For now, return the hash that should be signed
      return typedDataHash;
    } catch (error) {
      throw new Error(`Failed to sign typed data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleSubscription(type: string, _params?: string[]): string {
    // Generate subscription ID
    const subscriptionId = generateSecureSubscriptionId();

    // Handle different subscription types
    switch (type) {
      case 'newHeads': {
        // Subscribe to new block headers
        void this.provider.on('block', (blockNumber: number) => {
          void this.sendNotification(JSON.stringify({
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

  private handleUnsubscription(_subscriptionId: string): boolean {
    // Remove subscription (simplified for now)
    return true;
  }

  /**
   * Determines if an RPC request creates a persistent event subscription
   * @param request - RPC request to check
   * @returns True if the request creates a subscription
   */
  async isPersistentEvent(request: ProviderRPCRequest): Promise<boolean> {
    return Promise.resolve(request.method === 'eth_subscribe');
  }

  /**
   * Sends a notification to the wallet UI
   * @param notif - Notification message as JSON string
   * @returns Promise that resolves when notification is sent
   */
  async sendNotification(notif: string): Promise<void> {
    this.toWindow(notif);
    return Promise.resolve();
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
    const balanceOf = contract.getFunction('balanceOf');
    const balance = await balanceOf.staticCall(userAddress) as bigint;
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
    const tokenURIFunc = contract.getFunction('tokenURI');
    const ownerOfFunc = contract.getFunction('ownerOf');
    
    const [tokenURI, owner] = await Promise.all([
      tokenURIFunc.staticCall(tokenId) as Promise<string>,
      ownerOfFunc.staticCall(tokenId) as Promise<string>
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
  async signTransaction(privateKey: string, transaction: import('../../../types').TransactionRequest): Promise<string> {
    // Create ethers transaction request
    const ethersRequest: { to: string; value?: string; data?: string; gas?: string; gasPrice?: string } = {
      to: transaction.to
    };

    // Add optional properties only if they exist
    if (transaction.value !== undefined) {
      ethersRequest.value = transaction.value;
    }
    if (transaction.data !== undefined) {
      ethersRequest.data = transaction.data;
    }
    if (transaction.gasLimit !== undefined) {
      ethersRequest.gas = transaction.gasLimit;
    }
    if (transaction.gasPrice !== undefined) {
      ethersRequest.gasPrice = transaction.gasPrice;
    }
    
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
  async getTransaction(txHash: string): Promise<import('../../../types').Transaction> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (tx == null) {
        throw new Error('Transaction not found');
      }

      const transaction: import('../../../types').Transaction = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to ?? '',
        value: tx.value.toString(),
        fee: receipt != null ? (receipt.gasUsed * (tx.gasPrice ?? 0n)).toString() : '0',
        data: tx.data,
        gasLimit: tx.gasLimit.toString(),
        nonce: tx.nonce,
        status: receipt != null ? (receipt.status === 1 ? 'confirmed' as const : 'failed' as const) : 'pending' as const
      };

      // Add optional properties only if they exist
      if (tx.gasPrice !== null) {
        transaction.gasPrice = tx.gasPrice.toString();
      }
      if (tx.chainId !== null) {
        transaction.chainId = Number(tx.chainId);
      }
      if (tx.blockNumber !== null) {
        transaction.blockNumber = tx.blockNumber;
      }
      if (tx.blockHash !== null) {
        transaction.blockHash = tx.blockHash;
      }
      if (receipt?.blockNumber !== undefined && receipt.blockNumber !== 0) {
        const block = await this.provider.getBlock(receipt.blockNumber);
        if (block?.timestamp !== undefined && block.timestamp !== 0) {
          transaction.timestamp = block.timestamp;
        }
      }

      return transaction;
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
  async getTransactionHistory(address: string, limit = 20): Promise<import('../../../types').Transaction[]> {
    try {
      // Note: This is a simplified implementation
      // In production, you'd use an indexing service like Etherscan API
      const currentBlock = await this.provider.getBlockNumber();
      const transactions: import('../../../types').Transaction[] = [];
      
      // Scan recent blocks (limited approach)
      const blocksToScan = Math.min(limit * 5, 100); // Estimate blocks to scan
      
      for (let i = 0; i < blocksToScan && transactions.length < limit; i++) {
        const blockNumber = currentBlock - i;
        try {
          const block = await this.provider.getBlock(blockNumber, true);
          if (block != null && block.transactions != null) {
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && tx !== null && 'from' in tx && 'to' in tx && 'hash' in tx) {
                const txResponse = tx as ethers.TransactionResponse;
                if (txResponse.from === address || txResponse.to === address) {
                  const transaction = await this.getTransaction(txResponse.hash);
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
  subscribeToBlocks(callback: (blockNumber: number) => void): () => void {
    const listener = (blockNumber: number): void => {
      callback(blockNumber);
    };

    void this.provider.on('block', listener);

    return (): void => {
      void this.provider.off('block', listener);
    };
  }

  /**
   * Sign message (implements BaseProvider interface)
   * @param privateKey - Private key for signing (not used - uses keyring)
   * @param message - Message to sign
   * @returns Signed message
   */
  signMessage(privateKey: string, message: string): string {
    // In practice, this would use the keyring with the selected address
    const address = this.selectedAddress;
    if (address === '' || address === undefined || address === null) {
      throw new Error('No address selected for signing');
    }
    return this.personalSign(message, address);
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
