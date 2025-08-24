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
/** Represents a marketplace listing on OmniCoin */
export interface MarketplaceListing {
  /** Unique listing identifier */
  id: string;
  /** Listing title */
  title: string;
  /** Item description */
  description: string;
  /** Listing price in XOM */
  price: bigint;
  /** Seller's address */
  seller: string;
  /** Item category */
  category: string;
  /** Array of image URLs */
  images: string[];
  /** IPFS hash for additional metadata */
  metadata: string; // IPFS hash
  /** Whether listing is currently active */
  isActive: boolean;
  /** Timestamp when listing was created */
  createdAt: number;
}

/** Represents a transaction on the OmniCoin blockchain with marketplace features */
export interface OmniCoinTransaction {
  /** Transaction hash */
  hash: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Transaction value in wei */
  value: bigint;
  /** Gas price for the transaction */
  gasPrice: bigint;
  /** Gas limit for the transaction */
  gasLimit: bigint;
  /** Transaction data/input */
  data: string;
  /** Optional marketplace-specific transaction data */
  marketplaceData?: {
    /** Associated listing ID for marketplace transactions */
    listingId?: string;
    /** Type of marketplace action being performed */
    action: 'create_listing' | 'purchase' | 'update_listing' | 'cancel_listing';
    /** Amount held in escrow for the transaction */
    escrowAmount?: bigint;
  };
}

/** Represents escrow information for marketplace transactions */
export interface EscrowInfo {
  /** Unique escrow identifier */
  id: string;
  /** Buyer's wallet address */
  buyer: string;
  /** Seller's wallet address */
  seller: string;
  /** Amount held in escrow */
  amount: bigint;
  /** Associated marketplace listing ID */
  listingId: string;
  /** Current status of the escrow */
  status: 'pending' | 'completed' | 'disputed' | 'released';
  /** Timestamp when escrow was created */
  createdAt: number;
  /** Timestamp when escrow expires */
  expiresAt: number;
}

/** Configuration settings for OmniCoin blockchain connection */
export interface OmniCoinConfig {
  /** RPC endpoint URL for blockchain connection */
  rpcUrl: string;
  /** Chain ID for the OmniCoin network */
  chainId: number;
  /** Native token symbol (XOM) */
  symbol: string;
  /** Human-readable network name */
  name: string;
  /** Optional block explorer URL for transaction viewing */
  blockExplorer?: string;
}

/** Account information for wallet addresses on OmniCoin */
export interface AccountInfo {
  /** Wallet address */
  address: string;
  /** Account balance in XOM */
  balance: string;
  /** Transaction nonce for the account */
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
    provider: ProviderName.ethereum as ProviderName,
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
    provider: ProviderName.ethereum as ProviderName,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/7000\'/0\'/0'
  }
};

/**
 * OmniCoin blockchain provider extending COTI functionality with marketplace features.
 * Handles blockchain interactions, marketplace operations, and escrow management.
 */
export class OmniCoinProvider extends CotiProvider {
  private marketplaceListings: Map<string, MarketplaceListing> = new Map();
  private escrowContracts: Map<string, EscrowInfo> = new Map();
  private nodeConnections: string[] = [];
  private provider: ethers.providers.JsonRpcProvider;
  private config: OmniCoinConfig;
  private wallet?: ethers.Wallet;

  /**
   * Creates a new OmniCoin provider instance
   * @param toWindow - Function to send messages to the window
   * @param network - Ethereum network configuration for OmniCoin
   * @param config - Optional configuration overrides for OmniCoin settings
   */
  constructor(
    toWindow: (message: string) => void,
    network: EthereumNetwork = OmniCoinNetworks.testnet,
    config?: Partial<OmniCoinConfig>
  ) {
    super(toWindow, network);
    this.namespace = ProviderName.ethereum as ProviderName; // OmniCoin is EVM compatible via COTI

    // Default OmniCoin configuration
    this.config = {
      rpcUrl: config?.rpcUrl ?? 'https://rpc.omnicoin.network',
      chainId: config?.chainId ?? 8888, // OmniCoin chain ID
      symbol: 'XOM',
      name: 'OmniCoin',
      blockExplorer: config?.blockExplorer ?? 'https://explorer.omnicoin.network',
      ...config
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl, {
      chainId: this.config.chainId,
      name: this.config.name
    }) as ethers.providers.JsonRpcProvider;
  }

  // Override request method to add OmniCoin-specific methods
  /**
   * Handles RPC requests including OmniCoin-specific marketplace methods
   * @param request - The RPC request containing method and parameters
   * @returns Promise resolving to the response data
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
            result = this.createMarketplaceListing(params[0]);
            break;
          case 'omnicoin_getListing':
            result = this.getMarketplaceListing(params[0]);
            break;
          case 'omnicoin_getListings':
            result = this.getMarketplaceListings(params[0]);
            break;
          case 'omnicoin_updateListing':
            result = this.updateMarketplaceListing(params[0], params[1]);
            break;
          case 'omnicoin_purchaseItem':
            result = await this.purchaseItem(params[0], params[1]);
            break;

          // Escrow methods
          case 'omnicoin_createEscrow':
            result = this.createEscrow(params[0]);
            break;
          case 'omnicoin_releaseEscrow':
            result = this.releaseEscrow(params[0]);
            break;
          case 'omnicoin_getEscrow':
            result = this.getEscrow(params[0]);
            break;

          // Node discovery methods
          case 'omnicoin_discoverNodes':
            result = this.discoverMarketplaceNodes();
            break;
          case 'omnicoin_connectToNode':
            result = this.connectToMarketplaceNode(params[0]);
            break;
          case 'omnicoin_getConnectedNodes':
            result = this.getConnectedNodes();
            break;

          // Balance migration from OmniCoin v1
          case 'omnicoin_migrateBalance':
            result = this.migrateV1Balance(params[0], params[1]);
            break;
          case 'omnicoin_checkMigrationStatus':
            result = this.checkMigrationStatus(params[0]);
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
   * Creates a new marketplace listing on the OmniCoin platform
   * @param listing - Partial listing data to create the listing
   * @returns Promise resolving to the created marketplace listing
   */
  createMarketplaceListing(listing: Partial<MarketplaceListing>): MarketplaceListing {
    if (listing.title == null || listing.price == null || listing.seller == null) {
      throw new Error('Missing required listing fields');
    }

    const id = this.generateId();
    const newListing: MarketplaceListing = {
      id,
      title: listing.title,
      description: listing.description ?? '',
      price: BigInt(listing.price),
      seller: listing.seller,
      category: listing.category ?? 'general',
      images: listing.images ?? [],
      metadata: listing.metadata ?? '',
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
   * Retrieves a marketplace listing by its ID
   * @param listingId - The unique identifier of the listing to retrieve
   * @returns Promise resolving to the listing or null if not found
   */
  getMarketplaceListing(listingId: string): MarketplaceListing | null {
    return this.marketplaceListings.get(listingId) ?? null;
  }

  /**
   * Retrieves marketplace listings with optional filtering
   * @param filter - Optional filter criteria
   * @param filter.category - Filter by listing category
   * @param filter.seller - Filter by seller address
   * @param filter.maxPrice - Filter by maximum price
   * @param filter.search - Filter by search term in title/description
   * @returns Promise resolving to array of matching listings
   */
  getMarketplaceListings(filter?: {
    /** Filter by listing category */
    category?: string;
    /** Filter by seller address */
    seller?: string;
    /** Filter by maximum price */
    maxPrice?: bigint;
    /** Filter by search term in title/description */
    search?: string;
  }): MarketplaceListing[] {
    let listings = Array.from(this.marketplaceListings.values());

    if (filter != null) {
      if (filter.category != null) {
        listings = listings.filter(l => l.category === filter.category);
      }
      if (filter.seller != null) {
        listings = listings.filter(l => l.seller === filter.seller);
      }
      if (filter.maxPrice != null) {
        listings = listings.filter(l => filter.maxPrice != null && l.price <= filter.maxPrice);
      }
      if (filter.search != null) {
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
   * Updates an existing marketplace listing
   * @param listingId - The unique identifier of the listing to update
   * @param updates - Partial listing data with fields to update
   * @returns Promise resolving to the updated marketplace listing
   */
  updateMarketplaceListing(listingId: string, updates: Partial<MarketplaceListing>): MarketplaceListing {
    const listing = this.marketplaceListings.get(listingId);
    if (listing == null) {
      throw new Error('Listing not found');
    }

    const updatedListing = { ...listing, ...updates };
    this.marketplaceListings.set(listingId, updatedListing);

    this.emit('omnicoin_listingUpdated', updatedListing);
    return updatedListing;
  }

  /**
   * Purchases an item from the marketplace using escrow
   * @param listingId - The unique identifier of the listing to purchase
   * @param buyerAddress - The wallet address of the buyer
   * @returns Promise resolving to transaction hash and escrow ID
   */
  async purchaseItem(listingId: string, buyerAddress: string): Promise<{
    /** Transaction hash for the purchase */
    transactionHash: string;
    /** Escrow ID for the purchase protection */
    escrowId: string;
  }> {
    const listing = this.getMarketplaceListing(listingId);
    if (listing == null) {
      throw new Error('Listing not found');
    }

    if (!listing.isActive) {
      throw new Error('Listing is not active');
    }

    // Create escrow for the purchase
    const escrowInfo = this.createEscrow({
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
   * Creates a new escrow contract for a marketplace transaction
   * @param escrowData - The escrow contract data
   * @param escrowData.buyer - Buyer's wallet address
   * @param escrowData.seller - Seller's wallet address
   * @param escrowData.amount - Amount to hold in escrow
   * @param escrowData.listingId - Associated listing ID
   * @returns Promise resolving to the created escrow information
   */
  createEscrow(escrowData: {
    /** Buyer's wallet address */
    buyer: string;
    /** Seller's wallet address */
    seller: string;
    /** Amount to hold in escrow */
    amount: bigint;
    /** Associated listing ID */
    listingId: string;
  }): EscrowInfo {
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
   * Releases funds from an escrow contract to the seller
   * @param escrowId - The unique identifier of the escrow to release
   * @returns Promise resolving to the updated escrow information
   */
  releaseEscrow(escrowId: string): EscrowInfo {
    const escrow = this.escrowContracts.get(escrowId);
    if (escrow == null) {
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
  getEscrow(escrowId: string): EscrowInfo | null {
    return this.escrowContracts.get(escrowId) || null;
  }

  // Node Discovery Methods

  /**
   *
   */
  discoverMarketplaceNodes(): string[] {
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
  connectToMarketplaceNode(nodeUrl: string): boolean {
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
  migrateV1Balance(v1Address: string, v2Address: string): {
    /** Migration ID for tracking the migration process */
    migrationId: string;
    /** Current status of the migration */
    status: string;
  } {
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
  checkMigrationStatus(_migrationId: string): {
    /** Current status of the migration */
    status: string;
    /** Migrated amount if completed */
    amount?: bigint;
    /** Block height when migration completed */
    blockHeight?: number;
  } {
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
    features: string[]
  } {
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
      nftSupport: boolean
    }; /**
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
      migration: string
    }
  } {
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
  getSigner(): ethers.Wallet {
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
  getContract(
    address: string,
    abi: ethers.ContractInterface,
    signer?: ethers.Wallet
  ): ethers.Contract {
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
