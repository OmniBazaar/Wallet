/**
 * Block Explorer Service for Wallet
 * 
 * Provides blockchain exploration capabilities within the wallet.
 * Allows users to view transactions, blocks, addresses, and token information.
 * Integrates with multiple chain explorers and the OmniCoin validator explorer.
 * 
 * @module services/BlockExplorerService
 */

import { ethers } from 'ethers';

/**
 * Supported blockchain networks
 */
export enum ExplorerNetwork {
  OMNICOIN = 'OMNICOIN',
  ETHEREUM = 'ETHEREUM',
  COTI = 'COTI',
  AVALANCHE = 'AVALANCHE',
  POLYGON = 'POLYGON',
  BSC = 'BSC',
  ARBITRUM = 'ARBITRUM',
  OPTIMISM = 'OPTIMISM'
}

/**
 * Explorer configuration
 */
interface ExplorerConfig {
  /** Network name */
  name: string;
  /** Base URL for explorer */
  baseUrl: string;
  /** API endpoint */
  apiUrl: string;
  /** API key if required */
  apiKey?: string;
  /** Chain ID */
  chainId: number;
  /** Native token symbol */
  nativeToken: string;
  /** Block time in seconds */
  blockTime: number;
}

/**
 * Transaction details
 */
export interface TransactionDetails {
  /** Transaction hash */
  hash: string;
  /** From address */
  from: string;
  /** To address */
  to: string;
  /** Value in native token */
  value: string;
  /** Gas used */
  gasUsed: string;
  /** Gas price */
  gasPrice: string;
  /** Block number */
  blockNumber: number;
  /** Timestamp */
  timestamp: number;
  /** Status (success/failed) */
  status: 'success' | 'failed' | 'pending';
  /** Method called (for contract interactions) */
  method?: string;
  /** Token transfers */
  tokenTransfers?: Array<{
    token: string;
    from: string;
    to: string;
    value: string;
    symbol: string;
  }>;
  /** Input data */
  input?: string;
  /** Transaction fee */
  fee: string;
  /** Confirmations */
  confirmations: number;
}

/**
 * Block details
 */
export interface BlockDetails {
  /** Block number */
  number: number;
  /** Block hash */
  hash: string;
  /** Parent hash */
  parentHash: string;
  /** Timestamp */
  timestamp: number;
  /** Miner/Validator */
  miner: string;
  /** Transaction count */
  transactionCount: number;
  /** Gas used */
  gasUsed: string;
  /** Gas limit */
  gasLimit: string;
  /** Base fee per gas (EIP-1559) */
  baseFeePerGas?: string;
  /** Block size */
  size?: number;
  /** Difficulty */
  difficulty: string;
}

/**
 * Address details
 */
export interface AddressDetails {
  /** Address */
  address: string;
  /** Balance in native token */
  balance: string;
  /** Total transaction count */
  transactionCount: number;
  /** Token balances */
  tokens: Array<{
    address: string;
    balance: string;
    symbol: string;
    decimals: number;
  }>;
  /** NFT holdings */
  nfts: Array<{
    tokenId: string;
    contract: string;
    name: string;
    imageUrl?: string;
  }>;
  /** Is contract address */
  isContract: boolean;
  /** Contract creation transaction */
  creationTx?: string;
  /** ENS name */
  ensName?: string;
}

/**
 * Token details
 */
export interface TokenDetails {
  /** Token address */
  address: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Total supply */
  totalSupply: string;
  /** Holder count */
  holders: number;
  /** Price in USD */
  priceUsd?: number;
  /** Market cap */
  marketCap?: number;
  /** 24h volume */
  volume24h?: number;
  /** Logo URL */
  logoUrl?: string;
  /** Website */
  website?: string;
  /** Social links */
  social?: Record<string, string>;
}

/**
 * Search result
 */
export interface SearchResult {
  /** Result type */
  type: 'transaction' | 'address' | 'block' | 'token';
  /** Display name */
  name: string;
  /** Value/identifier */
  value: string;
  /** Network */
  network: ExplorerNetwork;
  /** Additional info */
  info: string;
}

/**
 * Gas information
 */
export interface GasInfo {
  /** Slow gas price */
  slow: string;
  /** Standard gas price */
  standard: string;
  /** Fast gas price */
  fast: string;
  /** Base fee (EIP-1559) */
  baseFee?: string;
  /** Priority fee (EIP-1559) */
  priorityFee?: string;
}

/**
 * Block Explorer Service
 */
export class BlockExplorerService {
  private provider: ethers.Provider;
  private validatorEndpoint: string;
  private explorerConfigs: Map<ExplorerNetwork, ExplorerConfig>;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minute cache
  
  /**
   * Create a BlockExplorerService with a provider and optional validator endpoint.
   * @param provider Ethers provider used for on-chain reads (non-Omni networks)
   * @param validatorEndpoint Validator REST endpoint for OmniCoin explorer
   */
  constructor(provider: ethers.Provider, validatorEndpoint?: string) {
    this.provider = provider;
    this.validatorEndpoint = validatorEndpoint ?? 'http://localhost:3001/api/explorer';
    
    // Initialize explorer configurations
    this.explorerConfigs = new Map<ExplorerNetwork, ExplorerConfig>([
      [ExplorerNetwork.OMNICOIN, {
        name: 'OmniCoin Explorer',
        baseUrl: 'https://explorer.omnibazaar.com',
        apiUrl: this.validatorEndpoint,
        chainId: 31337,
        nativeToken: 'XOM',
        blockTime: 2
      }],
      [ExplorerNetwork.ETHEREUM, {
        name: 'Etherscan',
        baseUrl: 'https://etherscan.io',
        apiUrl: 'https://api.etherscan.io/api',
        ...(process?.env?.['ETHERSCAN_API_KEY'] !== undefined && process.env['ETHERSCAN_API_KEY'] !== ''
          ? { apiKey: process.env['ETHERSCAN_API_KEY'] }
          : {}),
        chainId: 1,
        nativeToken: 'ETH',
        blockTime: 12
      }],
      [ExplorerNetwork.COTI, {
        name: 'COTI Explorer',
        baseUrl: 'https://explorer.coti.io',
        apiUrl: 'https://api.coti.io/explorer',
        chainId: 65536,
        nativeToken: 'COTI',
        blockTime: 2
      }],
      [ExplorerNetwork.AVALANCHE, {
        name: 'Snowtrace',
        baseUrl: 'https://snowtrace.io',
        apiUrl: 'https://api.snowtrace.io/api',
        ...(process?.env?.['SNOWTRACE_API_KEY'] !== undefined && process.env['SNOWTRACE_API_KEY'] !== ''
          ? { apiKey: process.env['SNOWTRACE_API_KEY'] }
          : {}),
        chainId: 43114,
        nativeToken: 'AVAX',
        blockTime: 2
      }],
      [ExplorerNetwork.POLYGON, {
        name: 'Polygonscan',
        baseUrl: 'https://polygonscan.com',
        apiUrl: 'https://api.polygonscan.com/api',
        ...(process?.env?.['POLYGONSCAN_API_KEY'] !== undefined && process.env['POLYGONSCAN_API_KEY'] !== ''
          ? { apiKey: process.env['POLYGONSCAN_API_KEY'] }
          : {}),
        chainId: 137,
        nativeToken: 'MATIC',
        blockTime: 2
      }],
      [ExplorerNetwork.BSC, {
        name: 'BscScan',
        baseUrl: 'https://bscscan.com',
        apiUrl: 'https://api.bscscan.com/api',
        ...(process?.env?.['BSCSCAN_API_KEY'] !== undefined && process.env['BSCSCAN_API_KEY'] !== ''
          ? { apiKey: process.env['BSCSCAN_API_KEY'] }
          : {}),
        chainId: 56,
        nativeToken: 'BNB',
        blockTime: 3
      }],
      [ExplorerNetwork.ARBITRUM, {
        name: 'Arbiscan',
        baseUrl: 'https://arbiscan.io',
        apiUrl: 'https://api.arbiscan.io/api',
        ...(process?.env?.['ARBISCAN_API_KEY'] !== undefined && process.env['ARBISCAN_API_KEY'] !== ''
          ? { apiKey: process.env['ARBISCAN_API_KEY'] }
          : {}),
        chainId: 42161,
        nativeToken: 'ETH',
        blockTime: 1
      }],
      [ExplorerNetwork.OPTIMISM, {
        name: 'Optimistic Etherscan',
        baseUrl: 'https://optimistic.etherscan.io',
        apiUrl: 'https://api-optimistic.etherscan.io/api',
        ...(process?.env?.['OPTIMISM_API_KEY'] !== undefined && process.env['OPTIMISM_API_KEY'] !== ''
          ? { apiKey: process.env['OPTIMISM_API_KEY'] }
          : {}),
        chainId: 10,
        nativeToken: 'ETH',
        blockTime: 1
      }]
    ]);
  }

  /**
   * Initialize the service (for compatibility)
   */
  async initialize(): Promise<void> {
    // Service is ready to use after construction
    // This method exists for API compatibility
  }
  
  /**
   * Get transaction details for any supported network.
   * @param txHash Transaction hash
   * @param network Target network (defaults to OmniCoin)
   * @returns Transaction details or null if not found
   */
  async getTransaction(
    txHash: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<TransactionDetails | null> {
    const cacheKey = `tx:${network}:${txHash}`;
    const cached = this.getFromCache(cacheKey) as TransactionDetails | undefined;
    if (cached !== undefined) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        // Use validator endpoint
        const response = await fetch(`${this.validatorEndpoint}/transaction/${txHash}`);
        if (!response.ok) throw new Error('Transaction not found');
        
        const data = await response.json() as unknown;
        const details = this.processTransactionData(data);
        this.setCache(cacheKey, details);
        return details;
        
      } else {
        // Use ethers provider for external chains
        const tx = await this.provider.getTransaction(txHash);
        if (tx === null) return null;
        
        const receipt = await this.provider.getTransactionReceipt(txHash);
        const block = tx.blockNumber !== null ? await this.provider.getBlock(tx.blockNumber) : null;
        
        const details: TransactionDetails = {
          hash: tx.hash,
          from: tx.from,
          to: tx.to ?? '0x0000000000000000000000000000000000000000',
          value: ethers.formatEther(tx.value),
          gasUsed: receipt?.gasUsed.toString() ?? '0',
          gasPrice: tx.gasPrice?.toString() ?? '0',
          blockNumber: tx.blockNumber ?? 0,
          timestamp: block?.timestamp ?? 0,
          status: receipt?.status === 1 ? 'success' : receipt?.status === 0 ? 'failed' : 'pending',
          input: tx.data,
          fee: receipt !== null ? (receipt.gasUsed * (tx.gasPrice ?? BigInt(0))).toString() : '0',
          confirmations: 0
        };
        
        this.setCache(cacheKey, details);
        return details;
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }
  
  /**
   * Get block details by number or hash.
   * @param blockId Block number or hash
   * @param network Target network
   * @returns Block details or null if not found
   */
  async getBlock(
    blockId: number | string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<BlockDetails | null> {
    const cacheKey = `block:${network}:${blockId}`;
    const cached = this.getFromCache(cacheKey) as BlockDetails | undefined;
    if (cached !== undefined) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/block/${blockId}`);
        if (!response.ok) throw new Error('Block not found');
        
        const data = await response.json() as unknown;
        const details = this.processBlockData(data);
        this.setCache(cacheKey, details);
        return details;
        
      } else {
        // Use ethers provider
        const block = await this.provider.getBlock(blockId);
        if (block === null) return null;
        
        const details: BlockDetails = {
          number: block.number,
          hash: block.hash ?? '',
          parentHash: block.parentHash,
          timestamp: block.timestamp,
          miner: block.miner,
          transactionCount: block.transactions.length,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          ...(block.baseFeePerGas !== undefined && block.baseFeePerGas !== null && { baseFeePerGas: block.baseFeePerGas.toString() }),
          difficulty: block.difficulty.toString()
        };
        
        this.setCache(cacheKey, details);
        return details;
      }
    } catch (error) {
      console.error('Error fetching block:', error);
      return null;
    }
  }
  
  /**
   * Get address details (balance, tx count, tokens/NFTs when available).
   * @param address Wallet/contract address
   * @param network Target network (defaults to OmniCoin)
   * @returns Address details or null if not found
   */
  async getAddress(
    address: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<AddressDetails | null> {
    const cacheKey = `address:${network}:${address}`;
    const cached = this.getFromCache(cacheKey) as AddressDetails | undefined;
    if (cached !== undefined) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/address/${address}`);
        if (!response.ok) throw new Error('Address not found');
        
        const data = await response.json() as unknown;
        const details = this.processAddressData(data);
        this.setCache(cacheKey, details);
        return details;
        
      } else {
        // Use provider and external APIs
        const [balance, txCount, code] = await Promise.all([
          this.provider.getBalance(address),
          this.provider.getTransactionCount(address),
          this.provider.getCode(address)
        ]);
        
        const ens = await this.provider.lookupAddress(address);
        const baseDetails: AddressDetails = {
          address,
          balance: ethers.formatEther(balance),
          transactionCount: txCount,
          tokens: [], // Would need token balance API
          nfts: [], // Would need NFT API
          isContract: code !== '0x',
        };
        const details: AddressDetails = {
          ...baseDetails,
          ...(ens !== null && { ensName: ens }),
        };
        
        this.setCache(cacheKey, details);
        return details;
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      return null;
    }
  }
  
  /**
   * Get token details (name/symbol/decimals/totalSupply) for ERC‑20‑like tokens.
   * @param tokenAddress Token contract address
   * @param network Target network (defaults to OmniCoin)
   * @returns Token details or null if not found
   */
  async getToken(
    tokenAddress: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<TokenDetails | null> {
    const cacheKey = `token:${network}:${tokenAddress}`;
    const cached = this.getFromCache(cacheKey) as TokenDetails | undefined;
    if (cached !== undefined) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/token/${tokenAddress}`);
        if (!response.ok) throw new Error('Token not found');
        
        const data = await response.json() as unknown;
        const details = this.processTokenData(data, tokenAddress);
        this.setCache(cacheKey, details);
        return details;
        
      } else {
        // Use ERC20 ABI to query token
        const erc20Abi = [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ];
        
        const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
        const nameMethod = contract['name'] as ethers.Contract['name'] | undefined;
        const symbolMethod = contract['symbol'] as ethers.Contract['symbol'] | undefined;
        const decimalsMethod = contract['decimals'] as ethers.Contract['decimals'] | undefined;
        const totalSupplyMethod = contract['totalSupply'] as ethers.Contract['totalSupply'] | undefined;

        if (nameMethod === undefined || symbolMethod === undefined || decimalsMethod === undefined || totalSupplyMethod === undefined) {
          throw new Error('Required ERC20 methods not found on contract');
        }

        const [name, symbol, decimals, totalSupply] = await Promise.all([
          nameMethod() as Promise<string>,
          symbolMethod() as Promise<string>,
          decimalsMethod() as Promise<number>,
          totalSupplyMethod() as Promise<bigint>,
        ]);
        
        const details: TokenDetails = {
          address: tokenAddress,
          name,
          symbol,
          decimals,
          totalSupply: ethers.formatUnits(totalSupply, decimals),
          holders: 0, // Would need additional API
          // priceUsd omitted when unknown
          // marketCap omitted when unknown
          // volume24h omitted when unknown
        };
        
        this.setCache(cacheKey, details);
        return details;
      }
    } catch (error) {
      console.error('Error fetching token:', error);
      return null;
    }
  }
  
  /**
   * Search across supported networks for addresses, tx hashes, blocks, and tokens.
   * @param query Free‑form query string
   * @returns Array of search results
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Detect query type
    const isAddress = ethers.isAddress(query);
    const isTxHash = query.match(/^0x[a-fA-F0-9]{64}$/);
    const isBlockNumber = query.match(/^\d+$/);
    
    if (isAddress) {
      // Search for address across networks
      for (const [network, config] of Array.from(this.explorerConfigs)) {
        results.push({
          type: 'address',
          name: `Address on ${config.name}`,
          value: query,
          network,
          info: 'View address details'
        });
      }
    } else if (isTxHash !== null) {
      // Search for transaction
      for (const [network, config] of Array.from(this.explorerConfigs)) {
        results.push({
          type: 'transaction',
          name: `Transaction on ${config.name}`,
          value: query,
          network,
          info: 'View transaction details'
        });
      }
    } else if (isBlockNumber !== null) {
      // Search for block
      for (const [network, config] of Array.from(this.explorerConfigs)) {
        results.push({
          type: 'block',
          name: `Block #${String(query)} on ${config.name}`,
          value: query,
          network,
          info: 'View block details'
        });
      }
    }
    
    // Also search for tokens by name/symbol
    if (query.length >= 2) {
      try {
        const response = await fetch(
          `${this.validatorEndpoint}/search?q=${encodeURIComponent(query)}`
        );
        
        if (response.ok) {
          const tokens = await response.json() as Array<{
            name: string;
            symbol: string;
            address: string;
            holders: number;
          }>;
          for (const token of tokens) {
            results.push({
              type: 'token',
              name: `${token.name} (${token.symbol})`,
              value: token.address,
              network: ExplorerNetwork.OMNICOIN,
              info: `${token.holders} holders`
            });
          }
        }
      } catch (error) {
        console.error('Error searching tokens:', error);
      }
    }
    
    return results;
  }
  
  /**
   * Get transaction history for an address on OmniCoin or external networks.
   * @param address Wallet address
   * @param network Network (defaults to OmniCoin)
   * @param page Page number (default 1)
   * @param limit Page size (default 20)
   * @returns Array of transaction details
   */
  async getTransactionHistory(
    address: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN,
    page = 1,
    limit = 20
  ): Promise<TransactionDetails[]> {
    const cacheKey = `history:${network}:${address}:${page}:${limit}`;
    const cached = this.getFromCache(cacheKey) as TransactionDetails[] | undefined;
    if (cached !== undefined) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(
          `${this.validatorEndpoint}/address/${address}/transactions?page=${page}&limit=${limit}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json() as unknown;
        const transactions = (data as unknown[]).map((tx) => this.processTransactionData(tx));
        this.setCache(cacheKey, transactions);
        return transactions;
        
      } else {
        // Would need external API for transaction history
        return [];
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }
  
  /**
   * Get latest blocks
   * @param network Target network
   * @param limit Number of blocks to fetch
   * @returns Array of block details
   */
  async getLatestBlocks(
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN,
    limit = 10
  ): Promise<BlockDetails[]> {
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(
          `${this.validatorEndpoint}/blocks/latest?limit=${limit}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch blocks');
        
        const data = await response.json() as unknown;
        return (data as unknown[]).map((block) => this.processBlockData(block));
        
      } else {
        // Use provider
        const currentBlock = await this.provider.getBlockNumber();
        const blocks: BlockDetails[] = [];
        
        for (let i = 0; i < limit && currentBlock - i >= 0; i++) {
          const block = await this.getBlock(currentBlock - i, network);
          if (block !== null) {
            blocks.push(block);
          }
        }
        
        return blocks;
      }
    } catch (error) {
      console.error('Error fetching latest blocks:', error);
      return [];
    }
  }
  
  /**
   * Get gas prices and estimates
   * @param network Target network
   * @returns Gas information including prices and base fee
   */
  async getGasInfo(network: ExplorerNetwork = ExplorerNetwork.OMNICOIN): Promise<GasInfo | null> {
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/gas`);
        if (!response.ok) throw new Error('Failed to fetch gas info');
        
        return await response.json() as GasInfo;
        
      } else {
        // Use provider
        const feeData = await this.provider.getFeeData();
        
        const gasInfo: GasInfo = {
          slow: feeData.gasPrice?.toString() ?? '0',
          standard: feeData.gasPrice?.toString() ?? '0',
          fast: feeData.gasPrice?.toString() ?? '0',
        };
        
        if (feeData.maxFeePerGas !== null) {
          gasInfo.baseFee = feeData.maxFeePerGas.toString();
        }
        
        if (feeData.maxPriorityFeePerGas !== null) {
          gasInfo.priorityFee = feeData.maxPriorityFeePerGas.toString();
        }
        
        return gasInfo;
      }
    } catch (error) {
      console.error('Error fetching gas info:', error);
      return null;
    }
  }
  
  /**
   * Get explorer URL for external viewing
   * @param type Type of resource
   * @param value Resource identifier
   * @param network Target network
   * @returns Explorer URL or null if not found
   */
  getExplorerUrl(
    type: 'tx' | 'address' | 'block' | 'token',
    value: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): string | null {
    const config = this.explorerConfigs.get(network);
    if (config === undefined) return null;
    
    const baseUrl = config.baseUrl;
    switch (type) {
      case 'tx':
        return `${baseUrl}/tx/${value}`;
      case 'address':
        return `${baseUrl}/address/${value}`;
      case 'block':
        return `${baseUrl}/block/${value}`;
      case 'token':
        return `${baseUrl}/token/${value}`;
      default:
        return null;
    }
  }
  
  /**
   * Open resource in external browser/tab
   * @param type Type of resource
   * @param value Resource identifier
   * @param network Target network
   */
  openInExplorer(
    type: 'tx' | 'address' | 'block' | 'token',
    value: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): void {
    const url = this.getExplorerUrl(type, value, network);
    if (url !== null) {
      window.open(url, '_blank');
    }
  }
  
  // Helper methods

  /**
   * Process raw transaction data from OmniCoin validator into TransactionDetails
   * @param data Raw transaction data from validator API
   * @returns Processed transaction details
   */
  private processTransactionData(data: unknown): TransactionDetails {
    const txData = data as {
      hash: string;
      from: string;
      to: string;
      value: string;
      gasUsed: string;
      gasPrice: string;
      blockNumber: number;
      timestamp: number;
      status?: number;
      method?: string;
      tokenTransfers?: Array<{
        token: string;
        from: string;
        to: string;
        value: string;
        symbol: string;
      }>;
      input?: string;
      fee?: string;
      confirmations?: number;
    };
    return {
      hash: txData.hash,
      from: txData.from,
      to: txData.to,
      value: txData.value,
      gasUsed: txData.gasUsed,
      gasPrice: txData.gasPrice,
      blockNumber: txData.blockNumber,
      timestamp: txData.timestamp,
      status: txData.status === 1 ? 'success' : txData.status === 0 ? 'failed' : 'success',
      ...(txData.method !== undefined && txData.method !== null && txData.method !== '' && { method: txData.method }),
      ...(txData.tokenTransfers !== undefined && txData.tokenTransfers !== null && { tokenTransfers: txData.tokenTransfers }),
      ...(txData.input !== undefined && txData.input !== null && txData.input !== '' && { input: txData.input }),
      fee: txData.fee ?? (BigInt(txData.gasUsed) * BigInt(txData.gasPrice)).toString(),
      confirmations: txData.confirmations ?? 0
    };
  }

  /**
   * Process raw transaction data from external blockchain explorers into TransactionDetails
   * @param data Raw transaction data from external explorer API
   * @param _network The network being queried (unused but kept for potential future use)
   * @returns Processed transaction details
   */
  private processExternalTransactionData(data: unknown, _network: ExplorerNetwork): TransactionDetails {
    const txData = data as {
      hash: string;
      from: string;
      to: string;
      value?: string;
      gasUsed: string;
      gasPrice: string;
      blockNumber: string;
      timeStamp: string;
      isError: string;
      functionName?: string;
      input?: string;
      confirmations?: number;
    };
    return {
      hash: txData.hash,
      from: txData.from,
      to: txData.to,
      value: ethers.formatEther(txData.value ?? '0'),
      gasUsed: txData.gasUsed,
      gasPrice: txData.gasPrice,
      blockNumber: parseInt(txData.blockNumber),
      timestamp: parseInt(txData.timeStamp),
      status: txData.isError === '0' ? 'success' : 'failed',
      ...((txData.functionName !== undefined && txData.functionName !== '') ? { method: txData.functionName } : {}),
      ...((txData.input !== undefined && txData.input !== '') ? { input: txData.input } : {}),
      fee: (BigInt(txData.gasUsed) * BigInt(txData.gasPrice)).toString(),
      confirmations: txData.confirmations ?? 0
    };
  }
  /**
   * Process raw block data into BlockDetails format
   * @param data Raw block data from API
   * @returns Processed block details
   */
  private processBlockData(data: unknown): BlockDetails {
    const blockData = data as {
      number: number;
      hash: string;
      parentHash: string;
      timestamp: number;
      miner?: string;
      validator?: string;
      transactionCount?: number;
      transactions?: unknown[];
      gasUsed: string;
      gasLimit: string;
      baseFeePerGas?: string;
      size?: number;
      difficulty?: string;
    };
    return {
      number: blockData.number,
      hash: blockData.hash,
      parentHash: blockData.parentHash,
      timestamp: blockData.timestamp,
      miner: blockData.miner ?? blockData.validator ?? '',
      transactionCount: blockData.transactionCount ?? blockData.transactions?.length ?? 0,
      gasUsed: blockData.gasUsed,
      gasLimit: blockData.gasLimit,
      ...((blockData.baseFeePerGas !== undefined && blockData.baseFeePerGas !== '') ? { baseFeePerGas: blockData.baseFeePerGas } : {}),
      ...(blockData.size !== undefined && { size: blockData.size }),
      difficulty: blockData.difficulty ?? '0'
    };
  }
  /**
   * Process raw address data into AddressDetails format
   * @param data Raw address data from API
   * @returns Processed address details
   */
  private processAddressData(data: unknown): AddressDetails {
    const addressData = data as {
      address: string;
      balance: string;
      transactionCount: number;
      tokens?: Array<{ address: string; balance: string; symbol: string; decimals: number }>;
      nfts?: Array<{ tokenId: string; contract: string; name: string; imageUrl?: string }>;
      isContract?: boolean;
      creationTx?: string;
      ensName?: string;
    };
    return {
      address: addressData.address,
      balance: addressData.balance,
      transactionCount: addressData.transactionCount,
      tokens: addressData.tokens ?? [],
      nfts: addressData.nfts ?? [],
      isContract: addressData.isContract ?? false,
      ...(addressData.creationTx !== undefined && { creationTx: addressData.creationTx }),
      ...(addressData.ensName !== undefined && { ensName: addressData.ensName })
    };
  }
  /**
   * Process raw token data into TokenDetails format
   * @param data Raw token data from API
   * @param tokenAddress The token contract address
   * @returns Processed token details
   */
  private processTokenData(data: unknown, tokenAddress: string): TokenDetails {
    const tokenData = data as {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      totalSupply: string;
      holders?: number;
      priceUsd?: number;
      marketCap?: number;
      volume24h?: number;
      logoUrl?: string;
      website?: string;
      social?: Record<string, string>;
    };
    return {
      address: tokenData.address !== '' ? tokenData.address : tokenAddress,
      name: tokenData.name,
      symbol: tokenData.symbol,
      decimals: tokenData.decimals,
      totalSupply: tokenData.totalSupply,
      holders: tokenData.holders ?? 0,
      ...(tokenData.priceUsd !== undefined && { priceUsd: tokenData.priceUsd }),
      ...(tokenData.marketCap !== undefined && { marketCap: tokenData.marketCap }),
      ...(tokenData.volume24h !== undefined && { volume24h: tokenData.volume24h }),
      ...(tokenData.logoUrl !== undefined && { logoUrl: tokenData.logoUrl }),
      ...(tokenData.website !== undefined && { website: tokenData.website }),
      ...(tokenData.social !== undefined && { social: tokenData.social })
    };
  }
  /**
   * Get data from cache if it exists and hasn't expired
   * @param key Cache key
   * @returns Cached data or undefined if not found or expired
   */
  private getFromCache(key: string): unknown {
    const cached = this.cache.get(key);
    if (cached !== undefined && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return undefined;
  }
  /**
   * Set data in cache with current timestamp
   * @param key Cache key
   * @param data Data to cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
  }
}

export default BlockExplorerService;