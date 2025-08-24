// OmniBazaar Wallet OmniCoin Provider
// Extends COTI provider for OmniCoin Layer 1 blockchain with marketplace features

import { 
  ProviderRPCRequest,
  OnMessageResponse,
  ProviderName
} from '@/types/provider';
import { EthereumNetwork } from '@/types/base-network';
import { CotiProvider } from '../coti/provider';
import { ethers } from 'ethers';

// OmniCoin specific interfaces
/**
 *
 */
export interface MarketplaceListing {
  /**
   *
   */
  id: string;
  /**
   *
   */
  title: string;
  /**
   *
   */
  description: string;
  /**
   *
   */
  price: bigint;
  /**
   *
   */
  seller: string;
  /**
   *
   */
  category: string;
  /**
   *
   */
  images: string[];
  /**
   *
   */
  metadata: string; // IPFS hash
  /**
   *
   */
  isActive: boolean;
  /**
   *
   */
  createdAt: number;
}

/**
 *
 */
export interface OmniCoinTransaction {
  /**
   *
   */
  hash: string;
  /**
   *
   */
  from: string;
  /**
   *
   */
  to: string;
  /**
   *
   */
  value: bigint;
  /**
   *
   */
  gasPrice: bigint;
  /**
   *
   */
  gasLimit: bigint;
  /**
   *
   */
  data: string;
  /**
   *
   */
  marketplaceData?: {
    /**
     *
     */
    listingId?: string;
    /**
     *
     */
    action: 'create_listing' | 'purchase' | 'update_listing' | 'cancel_listing';
    /**
     *
     */
    escrowAmount?: bigint;
  };
}

/**
 *
 */
export interface EscrowInfo {
  /**
   *
   */
  id: string;
  /**
   *
   */
  buyer: string;
  /**
   *
   */
  seller: string;
  /**
   *
   */
  amount: bigint;
  /**
   *
   */
  listingId: string;
  /**
   *
   */
  status: 'pending' | 'completed' | 'disputed' | 'released';
  /**
   *
   */
  createdAt: number;
  /**
   *
   */
  expiresAt: number;
}

/**
 *
 */
export interface OmniCoinConfig {
  /**
   *
   */
  rpcUrl: string;
  /**
   *
   */
  chainId: number;
  /**
   *
   */
  symbol: string;
  /**
   *
   */
  name: string;
  /**
   *
   */
  blockExplorer?: string;
}

/**
 *
 */
export interface AccountInfo {
  /**
   *
   */
  address: string;
  /**
   *
   */
  balance: string;
  /**
   *
   */
  nonce: number;
}

// OmniCoin Networks
export const OmniCoinNetworks: { [key: string]: EthereumNetwork } = {
  mainnet: {
    name: 'omnicoin-mainnet',
    name_long: 'OmniCoin Mainnet',
    homePage: 'https://omnibazaar.com',
    blockExplorerTX: 'https://explorer.omnicoin.io/tx/[[txHash]]',
    blockExplorerAddr: 'https://explorer.omnicoin.io/address/[[address]]',
    isTestNetwork: false,
    currencyName: 'XOM',
    icon: 'omnicoin',
    node: 'https://mainnet.omnicoin.io',
    chainID: '0x1B58', // 7000 in decimal
    slip44: 7000,
    coingeckoID: 'omnicoin',
    provider: ProviderName.ethereum,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/7000\'/0\'/0'
  },
  testnet: {
    name: 'omnicoin-testnet',
    name_long: 'OmniCoin Testnet',
    homePage: 'https://omnibazaar.com',
    blockExplorerTX: 'https://testnet-explorer.omnicoin.io/tx/[[txHash]]',
    blockExplorerAddr: 'https://testnet-explorer.omnicoin.io/address/[[address]]',
    isTestNetwork: true,
    currencyName: 'tXOM',
    icon: 'omnicoin',
    node: 'https://testnet.omnicoin.io',
    chainID: '0x1B5A', // 7002 in decimal
    slip44: 7000,
    provider: ProviderName.ethereum,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/7000\'/0\'/0'
  }
};

/**
 *
 */
export class OmniCoinProvider extends CotiProvider {
  private marketplaceListings: Map<string, MarketplaceListing> = new Map();
  private escrowContracts: Map<string, EscrowInfo> = new Map();
  private nodeConnections: string[] = [];
  private provider: ethers.providers.JsonRpcProvider;
  private config: OmniCoinConfig;
  private wallet?: ethers.Wallet;

  /**
   *
   * @param toWindow
   * @param network
   * @param config
   */
  constructor(
    toWindow: (message: string) => void,
    network: EthereumNetwork = OmniCoinNetworks.testnet,
    config?: Partial<OmniCoinConfig>
  ) {
    super(toWindow, network);
    this.namespace = ProviderName.ethereum; // OmniCoin is EVM compatible via COTI

    // Default OmniCoin configuration
    this.config = {
      rpcUrl: config?.rpcUrl || 'https://rpc.omnicoin.network',
      chainId: config?.chainId || 8888, // OmniCoin chain ID
      symbol: 'XOM',
      name: 'OmniCoin',
      blockExplorer: config?.blockExplorer || 'https://explorer.omnicoin.network',
      ...config
    };

    this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl, {
      chainId: this.config.chainId,
      name: this.config.name
    });
  }

  // Override request method to add OmniCoin-specific methods
  /**
   *
   * @param request
   */
  async request(request: ProviderRPCRequest): Promise<OnMessageResponse> {
    const { method, params = [] } = request;

    // Handle OmniCoin-specific methods
    if (method.startsWith('omnicoin_')) {
      try {
        let result;
        switch (method) {
          // Marketplace methods
          case 'omnicoin_createListing':
            result = await this.createMarketplaceListing(params[0]);
            break;
          case 'omnicoin_getListing':
            result = await this.getMarketplaceListing(params[0]);
            break;
          case 'omnicoin_getListings':
            result = await this.getMarketplaceListings(params[0]);
            break;
          case 'omnicoin_updateListing':
            result = await this.updateMarketplaceListing(params[0], params[1]);
            break;
          case 'omnicoin_purchaseItem':
            result = await this.purchaseItem(params[0], params[1]);
            break;
          
          // Escrow methods
          case 'omnicoin_createEscrow':
            result = await this.createEscrow(params[0]);
            break;
          case 'omnicoin_releaseEscrow':
            result = await this.releaseEscrow(params[0]);
            break;
          case 'omnicoin_getEscrow':
            result = await this.getEscrow(params[0]);
            break;
          
          // Node discovery methods
          case 'omnicoin_discoverNodes':
            result = await this.discoverMarketplaceNodes();
            break;
          case 'omnicoin_connectToNode':
            result = await this.connectToMarketplaceNode(params[0]);
            break;
          case 'omnicoin_getConnectedNodes':
            result = this.getConnectedNodes();
            break;
          
          // Balance migration from OmniCoin v1
          case 'omnicoin_migrateBalance':
            result = await this.migrateV1Balance(params[0], params[1]);
            break;
          case 'omnicoin_checkMigrationStatus':
            result = await this.checkMigrationStatus(params[0]);
            break;
          
          default:
            throw new Error(`Unknown OmniCoin method: ${method}`);
        }
        return { result: JSON.stringify(result) };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: JSON.stringify(errorMessage) };
      }
    }

    // Fall back to COTI provider for privacy features and standard methods
    return await super.request(request);
  }

  // Marketplace Methods

  /**
   *
   * @param listing
   */
  async createMarketplaceListing(listing: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    if (!listing.title || !listing.price || !listing.seller) {
      throw new Error('Missing required listing fields');
    }

    const id = this.generateId();
    const newListing: MarketplaceListing = {
      id,
      title: listing.title,
      description: listing.description || '',
      price: BigInt(listing.price),
      seller: listing.seller,
      category: listing.category || 'general',
      images: listing.images || [],
      metadata: listing.metadata || '',
      isActive: true,
      createdAt: Date.now()
    };

    // Store listing (in production, this would be on-chain)
    this.marketplaceListings.set(id, newListing);

    // Emit marketplace event
    this.emit('omnicoin_listingCreated', newListing);

    return newListing;
  }

  /**
   *
   * @param listingId
   */
  async getMarketplaceListing(listingId: string): Promise<MarketplaceListing | null> {
    return this.marketplaceListings.get(listingId) || null;
  }

  /**
   *
   * @param filter
   * @param filter.category
   * @param filter.seller
   * @param filter.maxPrice
   * @param filter.search
   */
  async getMarketplaceListings(filter?: { 
    /**
     *
     */
    category?: string; 
    /**
     *
     */
    seller?: string; 
    /**
     *
     */
    maxPrice?: bigint;
    /**
     *
     */
    search?: string;
  }): Promise<MarketplaceListing[]> {
    let listings = Array.from(this.marketplaceListings.values());

    if (filter) {
      if (filter.category) {
        listings = listings.filter(l => l.category === filter.category);
      }
      if (filter.seller) {
        listings = listings.filter(l => l.seller === filter.seller);
      }
      if (filter.maxPrice) {
        listings = listings.filter(l => filter.maxPrice && l.price <= filter.maxPrice);
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        listings = listings.filter(l => 
          l.title.toLowerCase().includes(search) || 
          l.description.toLowerCase().includes(search)
        );
      }
    }

    return listings.filter(l => l.isActive);
  }

  /**
   *
   * @param listingId
   * @param updates
   */
  async updateMarketplaceListing(listingId: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    const listing = this.marketplaceListings.get(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    const updatedListing = { ...listing, ...updates };
    this.marketplaceListings.set(listingId, updatedListing);

    this.emit('omnicoin_listingUpdated', updatedListing);
    return updatedListing;
  }

  /**
   *
   * @param listingId
   * @param buyerAddress
   */
  async purchaseItem(listingId: string, buyerAddress: string): Promise<{ /**
                                                                          *
                                                                          */
  transactionHash: string; /**
                            *
                            */
  escrowId: string }> {
    const listing = await this.getMarketplaceListing(listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (!listing.isActive) {
      throw new Error('Listing is not active');
    }

    // Create escrow for the purchase
    const escrowInfo = await this.createEscrow({
      buyer: buyerAddress,
      seller: listing.seller,
      amount: listing.price,
      listingId: listing.id
    });

    // Simulate transaction hash
    const transactionHash = '0x' + Array.from(
      new Uint8Array(32), 
      () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');

    this.emit('omnicoin_itemPurchased', { listing, buyer: buyerAddress, escrowId: escrowInfo.id });

    return { transactionHash, escrowId: escrowInfo.id };
  }

  // Escrow Methods

  /**
   *
   * @param escrowData
   * @param escrowData.buyer
   * @param escrowData.seller
   * @param escrowData.amount
   * @param escrowData.listingId
   */
  async createEscrow(escrowData: {
    /**
     *
     */
    buyer: string;
    /**
     *
     */
    seller: string;
    /**
     *
     */
    amount: bigint;
    /**
     *
     */
    listingId: string;
  }): Promise<EscrowInfo> {
    const id = this.generateId();
    const escrow: EscrowInfo = {
      id,
      buyer: escrowData.buyer,
      seller: escrowData.seller,
      amount: escrowData.amount,
      listingId: escrowData.listingId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.escrowContracts.set(id, escrow);
    this.emit('omnicoin_escrowCreated', escrow);

    return escrow;
  }

  /**
   *
   * @param escrowId
   */
  async releaseEscrow(escrowId: string): Promise<EscrowInfo> {
    const escrow = this.escrowContracts.get(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    escrow.status = 'released';
    this.escrowContracts.set(escrowId, escrow);

    this.emit('omnicoin_escrowReleased', escrow);
    return escrow;
  }

  /**
   *
   * @param escrowId
   */
  async getEscrow(escrowId: string): Promise<EscrowInfo | null> {
    return this.escrowContracts.get(escrowId) || null;
  }

  // Node Discovery Methods

  /**
   *
   */
  async discoverMarketplaceNodes(): Promise<string[]> {
    // Simulate node discovery (in production, use DHT or other discovery mechanism)
    const simulatedNodes = [
      'https://node1.omnibazaar.com',
      'https://node2.omnibazaar.com',
      'https://node3.omnibazaar.com'
    ];

    this.emit('omnicoin_nodesDiscovered', simulatedNodes);
    return simulatedNodes;
  }

  /**
   *
   * @param nodeUrl
   */
  async connectToMarketplaceNode(nodeUrl: string): Promise<boolean> {
    if (!this.nodeConnections.includes(nodeUrl)) {
      this.nodeConnections.push(nodeUrl);
      this.emit('omnicoin_nodeConnected', nodeUrl);
    }
    return true;
  }

  /**
   *
   */
  getConnectedNodes(): string[] {
    return [...this.nodeConnections];
  }

  // Migration Methods for OmniCoin v1 balances

  /**
   *
   * @param v1Address
   * @param v2Address
   */
  async migrateV1Balance(v1Address: string, v2Address: string): Promise<{ /**
                                                                           *
                                                                           */
  migrationId: string; /**
                        *
                        */
  status: string }> {
    // Simulate migration process (in production, interact with migration contract)
    const migrationId = this.generateId();
    
    this.emit('omnicoin_migrationStarted', { 
      migrationId, 
      v1Address, 
      v2Address 
    });

    return { 
      migrationId, 
      status: 'initiated' 
    };
  }

  /**
   *
   * @param _migrationId
   */
  async checkMigrationStatus(_migrationId: string): Promise<{ /**
                                                               *
                                                               */
  status: string; /**
                   *
                   */
  amount?: bigint; /**
                    *
                    */
  blockHeight?: number }> {
    // Simulate migration status check
    return {
      status: 'completed',
      amount: BigInt('1000000000000000000000'), // 1000 XOM
      blockHeight: 12345
    };
  }

  // Helper Methods

  private generateId(): string {
    return Array.from(
      new Uint8Array(16), 
      () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
  }

  // Override COTI methods to include OmniCoin branding
  /**
   *
   */
  getCotiNetworkInfo(): { /**
                           *
                           */
  chainId: string; /**
                    *
                    */
  networkName: string; /**
                        *
                        */
  isTestNetwork: boolean; /**
                           *
                           */
  hasPrivacyFeatures: boolean; /**
                                *
                                */
  onboardContractAddress: string; /**
                                   *
                                   */
  blockchain: string; /**
                       *
                       */
  layer: string; /**
                  *
                  */
  features: string[] } {
    return {
      ...super.getCotiNetworkInfo(),
      blockchain: 'OmniCoin',
      layer: 'Layer 1 on COTI V2',
      marketplaceIntegrated: true,
      escrowSupport: true,
      migrationSupport: true
    };
  }

  // Get OmniCoin-specific network info
  /**
   *
   */
  getOmniCoinNetworkInfo(): { /**
                               *
                               */
  chainId: string; /**
                    *
                    */
  networkName: string; /**
                        *
                        */
  currencySymbol: string; /**
                           *
                           */
  isTestNetwork: boolean; /**
                           *
                           */
  features: { /**
               *
               */
  marketplace: boolean; /**
                         *
                         */
  escrow: boolean; /**
                    *
                    */
  privacy: boolean; /**
                     *
                     */
  migration: boolean; /**
                       *
                       */
  nftSupport: boolean }; /**
                          *
                          */
  contracts: { /**
                *
                */
  marketplace: string; /**
                        *
                        */
  escrow: string; /**
                   *
                   */
  migration: string } } {
    return {
      chainId: this.chainId,
      networkName: this.network.name_long,
      currencySymbol: this.network.currencyName,
      isTestNetwork: this.network.isTestNetwork,
      features: {
        marketplace: true,
        escrow: true,
        privacy: true, // Inherited from COTI
        migration: true,
        nftSupport: true
      },
      contracts: {
        marketplace: '0x0000000000000000000000000000000000000002',
        escrow: '0x0000000000000000000000000000000000000003',
        migration: '0x0000000000000000000000000000000000000004'
      }
    };
  }

  /**
   * Get the underlying ethers provider
   */
  getProvider(): ethers.providers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Set the wallet for signing transactions
   * @param privateKey
   */
  setWallet(privateKey: string): void {
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Get the current signer
   */
  async getSigner(): Promise<ethers.Wallet> {
    if (!this.wallet) {
      throw new Error('No wallet set. Call setWallet() first.');
    }
    return this.wallet;
  }

  /**
   * Get a contract instance
   * @param address
   * @param abi
   * @param signer
   */
  async getContract(
    address: string,
    abi: ethers.ContractInterface,
    signer?: ethers.Wallet
  ): Promise<ethers.Contract> {
    const contractSigner = signer || this.wallet;
    if (!contractSigner) {
      // Return read-only contract
      return new ethers.Contract(address, abi, this.provider);
    }
    return new ethers.Contract(address, abi, contractSigner);
  }

  /**
   * Get account information
   * @param address
   */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    try {
      const [balance, nonce] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.getTransactionCount(address)
      ]);

      return {
        address,
        balance: ethers.utils.formatEther(balance),
        nonce
      };
    } catch (error) {
      throw new Error(`Failed to get account info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = await this.provider.getFeeData();
      return gasPrice.gasPrice?.toString() || '0';
    } catch (error) {
      throw new Error(`Failed to get gas price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate gas for a transaction
   * @param transaction
   */
  async estimateGas(transaction: ethers.providers.TransactionRequest): Promise<string> {
    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      return gasEstimate.toString();
    } catch (error) {
      throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a transaction
   * @param transaction
   */
  async sendTransaction(transaction: ethers.providers.TransactionRequest): Promise<ethers.providers.TransactionResponse> {
    try {
      if (!this.wallet) {
        throw new Error('No wallet set for signing transaction');
      }

      const tx = await this.wallet.sendTransaction(transaction);
      return tx;
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction receipt
   * @param txHash
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      throw new Error(`Failed to get transaction receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new Error(`Failed to get block number: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get network information
   */
  async getNetwork(): Promise<ethers.providers.Network> {
    try {
      return await this.provider.getNetwork();
    } catch (error) {
      throw new Error(`Failed to get network info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if connected to the correct network
   */
  async isCorrectNetwork(): Promise<boolean> {
    try {
      const network = await this.getNetwork();
      return Number(network.chainId) === this.config.chainId;
    } catch (error) {
      console.error('Failed to check network:', error);
      return false;
    }
  }

  /**
   * Wait for transaction confirmation
   * @param txHash
   * @param confirmations
   * @param timeout
   */
  async waitForTransaction(
    txHash: string, 
    confirmations = 1, 
    timeout = 120000
  ): Promise<ethers.providers.TransactionReceipt | null> {
    try {
      return await this.provider.waitForTransaction(txHash, confirmations, timeout);
    } catch (error) {
      throw new Error(`Transaction wait failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get XOM balance for an address
   * @param address
   */
  async getXOMBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      throw new Error(`Failed to get XOM balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get ERC20 token balance
   * @param tokenAddress
   * @param userAddress
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      const tokenABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, tokenABI, this.provider);
      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.decimals()
      ]);

      return ethers.utils.formatUnits(balance, decimals);
    } catch (error) {
      throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction history for an address
   * @param address
   * @param fromBlock
   * @param _toBlock
   * @param limit
   */
  async getTransactionHistory(
    address: string,
    fromBlock = 0,
    _toBlock: string | number = 'latest',
    limit = 100
  ): Promise<ethers.providers.TransactionResponse[]> {
    try {
      // Note: This is a simplified version. In practice, you'd need to use
      // an indexing service or scan blocks for transactions
      const currentBlock = await this.getBlockNumber();
      const transactions: ethers.providers.TransactionResponse[] = [];
      
      // Scan recent blocks for transactions involving this address
      const startBlock = Math.max(currentBlock - limit, fromBlock);
      
      for (let i = currentBlock; i >= startBlock; i--) {
        try {
          const block = await this.provider.getBlockWithTransactions(i);
          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && (tx.from === address || tx.to === address)) {
                transactions.push({
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value?.toString(),
                  gasPrice: tx.gasPrice?.toString(),
                  gasLimit: tx.gasLimit?.toString(),
                  blockNumber: i,
                  timestamp: block.timestamp
                });
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
   * Validate an address
   * @param address
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.utils.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Format amount in XOM
   * @param amount
   */
  formatXOM(amount: string | bigint): string {
    try {
      return ethers.utils.formatEther(amount);
    } catch (error) {
      return '0';
    }
  }

  /**
   * Parse XOM amount to wei
   * @param amount
   */
  parseXOM(amount: string): bigint {
    try {
      return BigInt(ethers.utils.parseEther(amount).toString());
    } catch (error) {
      return BigInt(0);
    }
  }

  /**
   * Get chain configuration
   */
  getChainConfig(): OmniCoinConfig {
    return { ...this.config };
  }

  /**
   * Update RPC URL
   * @param newUrl
   */
  updateRPCUrl(newUrl: string): void {
    this.config.rpcUrl = newUrl;
    this.provider = new ethers.providers.JsonRpcProvider(newUrl, {
      chainId: this.config.chainId,
      name: this.config.name
    });
    
    // Reconnect wallet if it exists
    if (this.wallet) {
      this.wallet = this.wallet.connect(this.provider);
    }
  }
}

export default OmniCoinProvider;

// Export live provider
export { LiveOmniCoinProvider, createLiveOmniCoinProvider, liveOmniCoinProvider } from './live-provider';

// Export unified getProvider function that returns live provider
/**
 *
 * @param _networkName
 */
export async function getOmniCoinProvider(_networkName?: string): Promise<ethers.providers.JsonRpcProvider> {
  const { liveOmniCoinProvider } = await import('./live-provider');
  return liveOmniCoinProvider.getProvider();
} 