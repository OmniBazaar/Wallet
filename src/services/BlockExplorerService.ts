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
  /** Number of transactions */
  transactionCount: number;
  /** Gas used */
  gasUsed: string;
  /** Gas limit */
  gasLimit: string;
  /** Base fee per gas */
  baseFeePerGas?: string;
  /** Size in bytes */
  size: number;
  /** Difficulty/Weight */
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
  /** Transaction count */
  transactionCount: number;
  /** Token balances */
  tokens: Array<{
    contract: string;
    symbol: string;
    name: string;
    balance: string;
    decimals: number;
    value?: string; // USD value
  }>;
  /** NFT holdings */
  nfts: Array<{
    contract: string;
    tokenId: string;
    name: string;
    image?: string;
  }>;
  /** Is contract */
  isContract: boolean;
  /** Contract creation tx */
  creationTx?: string;
  /** ENS/Name */
  ensName?: string;
}

/**
 * Token details
 */
export interface TokenDetails {
  /** Contract address */
  address: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Decimals */
  decimals: number;
  /** Total supply */
  totalSupply: string;
  /** Holder count */
  holders: number;
  /** Price in USD */
  priceUsd?: string;
  /** Market cap */
  marketCap?: string;
  /** 24h volume */
  volume24h?: string;
  /** Logo URL */
  logoUrl?: string;
  /** Website */
  website?: string;
  /** Social links */
  social?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

/**
 * Search result
 */
export interface SearchResult {
  /** Result type */
  type: 'address' | 'transaction' | 'block' | 'token';
  /** Display name */
  name: string;
  /** Value (address/hash/number) */
  value: string;
  /** Network */
  network: ExplorerNetwork;
  /** Additional info */
  info?: string;
}

/**
 * Block Explorer Service
 */
export class BlockExplorerService {
  private provider: ethers.Provider;
  private validatorEndpoint: string;
  private explorerConfigs: Map<ExplorerNetwork, ExplorerConfig>;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minute cache
  
  /**
   * Create a BlockExplorerService with a provider and optional validator endpoint.
   * @param provider Ethers provider used for on-chain reads (non-Omni networks)
   * @param validatorEndpoint Validator REST endpoint for OmniCoin explorer
   */
  constructor(provider: ethers.Provider, validatorEndpoint?: string) {
    this.provider = provider;
    this.validatorEndpoint = validatorEndpoint || 'http://localhost:3001/api/explorer';
    
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
        ...(process?.env?.['ETHERSCAN_API_KEY']
          ? { apiKey: process.env['ETHERSCAN_API_KEY'] as string }
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
        ...(process?.env?.['SNOWTRACE_API_KEY']
          ? { apiKey: process.env['SNOWTRACE_API_KEY'] as string }
          : {}),
        chainId: 43114,
        nativeToken: 'AVAX',
        blockTime: 2
      }],
      [ExplorerNetwork.POLYGON, {
        name: 'Polygonscan',
        baseUrl: 'https://polygonscan.com',
        apiUrl: 'https://api.polygonscan.com/api',
        ...(process?.env?.['POLYGONSCAN_API_KEY']
          ? { apiKey: process.env['POLYGONSCAN_API_KEY'] as string }
          : {}),
        chainId: 137,
        nativeToken: 'MATIC',
        blockTime: 2
      }],
      [ExplorerNetwork.BSC, {
        name: 'BscScan',
        baseUrl: 'https://bscscan.com',
        apiUrl: 'https://api.bscscan.com/api',
        ...(process?.env?.['BSCSCAN_API_KEY']
          ? { apiKey: process.env['BSCSCAN_API_KEY'] as string }
          : {}),
        chainId: 56,
        nativeToken: 'BNB',
        blockTime: 3
      }]
    ]);
  }
  
  /** Initialize internal state (placeholder for future setup). */
  async initialize(): Promise<void> {
    console.log('Block Explorer Service initialized');
  }
  
  /**
   * Get transaction details from OmniCoin or external explorer API.
   * @param hash Transaction hash
   * @param network Target network (defaults to OmniCoin)
   */
  async getTransaction(
    hash: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<TransactionDetails | null> {
    const cacheKey = `tx:${network}:${hash}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        // Use validator explorer API
        const response = await fetch(`${this.validatorEndpoint}/transaction/${hash}`);
        if (!response.ok) throw new Error('Transaction not found');
        
        const data = await response.json();
        const details = this.processTransactionData(data);
        this.setCache(cacheKey, details);
        return details;
        
      } else {
        // Use external explorer APIs
        const config = this.explorerConfigs.get(network);
        if (!config) throw new Error('Unsupported network');
        
        const params = new URLSearchParams({
          module: 'transaction',
          action: 'gettxinfo',
          txhash: hash
        });
        
        if (config.apiKey) {
          params.append('apikey', config.apiKey);
        }
        
        const response = await fetch(`${config.apiUrl}?${params}`);
        const data = await response.json();
        
        if (data.status !== '1') throw new Error('Transaction not found');
        
        const details = this.processExternalTransactionData(data.result, network);
        this.setCache(cacheKey, details);
        return details;
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }
  
  /**
   * Get block details
   * @param blockNumber
   * @param network
   */
  async getBlock(
    blockNumber: number,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<BlockDetails | null> {
    const cacheKey = `block:${network}:${blockNumber}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/block/${blockNumber}`);
        if (!response.ok) throw new Error('Block not found');
        
        const data = await response.json();
        const details = this.processBlockData(data);
        this.setCache(cacheKey, details);
        return details;
        
      } else {
        // Use provider for block data
        const block = await this.provider.getBlock(blockNumber);
        if (!block) throw new Error('Block not found');
        
        const details: BlockDetails = {
          number: block.number,
          hash: block.hash!,
          parentHash: block.parentHash,
          timestamp: block.timestamp,
          miner: block.miner,
          transactionCount: block.transactions.length,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          ...(block.baseFeePerGas != null
            ? { baseFeePerGas: block.baseFeePerGas.toString() }
            : {}),
          size: 0, // Would need additional API call
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
   */
  async getAddress(
    address: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<AddressDetails | null> {
    const cacheKey = `address:${network}:${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/address/${address}`);
        if (!response.ok) throw new Error('Address not found');
        
        const data = await response.json();
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
          ...(ens != null ? { ensName: ens } : {}),
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
   */
  async getToken(
    tokenAddress: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): Promise<TokenDetails | null> {
    const cacheKey = `token:${network}:${tokenAddress}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(`${this.validatorEndpoint}/token/${tokenAddress}`);
        if (!response.ok) throw new Error('Token not found');
        
        const data = await response.json();
        const details = this.processTokenData(data);
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
        
        const contract: any = new (ethers as any).Contract(tokenAddress, erc20Abi, this.provider);
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          (contract['name'] as () => Promise<string>)(),
          (contract['symbol'] as () => Promise<string>)(),
          (contract['decimals'] as () => Promise<number>)(),
          (contract['totalSupply'] as () => Promise<bigint>)(),
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
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Detect query type
    const isAddress = ethers.isAddress(query);
    const isTxHash = query.match(/^0x[a-fA-F0-9]{64}$/);
    const isBlockNumber = query.match(/^\d+$/);
    
    if (isAddress) {
      // Search for address across networks
      for (const [network, config] of this.explorerConfigs) {
        results.push({
          type: 'address',
          name: `Address on ${config.name}`,
          value: query,
          network,
          info: 'View address details'
        });
      }
    } else if (isTxHash) {
      // Search for transaction
      for (const [network, config] of this.explorerConfigs) {
        results.push({
          type: 'transaction',
          name: `Transaction on ${config.name}`,
          value: query,
          network,
          info: 'View transaction details'
        });
      }
    } else if (isBlockNumber) {
      // Search for block
      for (const [network, config] of this.explorerConfigs) {
        results.push({
          type: 'block',
          name: `Block #${query} on ${config.name}`,
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
          const tokens = await response.json();
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
   */
  async getTransactionHistory(
    address: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN,
    page = 1,
    limit = 20
  ): Promise<TransactionDetails[]> {
    const cacheKey = `history:${network}:${address}:${page}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    try {
      if (network === ExplorerNetwork.OMNICOIN) {
        const response = await fetch(
          `${this.validatorEndpoint}/address/${address}/transactions?page=${page}&limit=${limit}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();
        const transactions = data.map((tx: any) => this.processTransactionData(tx));
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
   * @param network
   * @param limit
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
        
        const data = await response.json();
        return data.map((block: any) => this.processBlockData(block));
        
      } else {
        // Get latest block number and work backwards
        const latestBlock = await this.provider.getBlockNumber();
        const blocks: BlockDetails[] = [];
        
        for (let i = 0; i < limit; i++) {
          const block = await this.getBlock(latestBlock - i, network);
          if (block) blocks.push(block);
        }
        
        return blocks;
      }
    } catch (error) {
      console.error('Error fetching latest blocks:', error);
      return [];
    }
  }
  
  /**
   * Get explorer URL for entity
   * @param type
   * @param value
   * @param network
   */
  getExplorerUrl(
    type: 'tx' | 'address' | 'block' | 'token',
    value: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): string {
    const config = this.explorerConfigs.get(network);
    if (!config) return '';
    
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
        return baseUrl;
    }
  }
  
  /**
   * Open explorer in browser
   * @param type
   * @param value
   * @param network
   */
  openInExplorer(
    type: 'tx' | 'address' | 'block' | 'token',
    value: string,
    network: ExplorerNetwork = ExplorerNetwork.OMNICOIN
  ): void {
    const url = this.getExplorerUrl(type, value, network);
    if (url) {
      window.open(url, '_blank');
    }
  }
  
  // Helper methods
  
  private processTransactionData(data: any): TransactionDetails {
    return {
      hash: data.hash,
      from: data.from,
      to: data.to,
      value: data.value,
      gasUsed: data.gasUsed,
      gasPrice: data.gasPrice,
      blockNumber: data.blockNumber,
      timestamp: data.timestamp,
      status: data.status === 1 ? 'success' : 'failed',
      method: data.method,
      tokenTransfers: data.tokenTransfers || [],
      input: data.input,
      fee: data.fee || (BigInt(data.gasUsed) * BigInt(data.gasPrice)).toString(),
      confirmations: data.confirmations || 0
    };
  }
  
  private processExternalTransactionData(data: any, network: ExplorerNetwork): TransactionDetails {
    return {
      hash: data.hash,
      from: data.from,
      to: data.to,
      value: ethers.formatEther(data.value || '0'),
      gasUsed: data.gasUsed,
      gasPrice: data.gasPrice,
      blockNumber: parseInt(data.blockNumber),
      timestamp: parseInt(data.timeStamp),
      status: data.isError === '0' ? 'success' : 'failed',
      method: data.functionName,
      tokenTransfers: [],
      input: data.input,
      fee: (BigInt(data.gasUsed) * BigInt(data.gasPrice)).toString(),
      confirmations: data.confirmations || 0
    };
  }
  
  private processBlockData(data: any): BlockDetails {
    return {
      number: data.number,
      hash: data.hash,
      parentHash: data.parentHash,
      timestamp: data.timestamp,
      miner: data.miner || data.validator,
      transactionCount: data.transactionCount || data.transactions?.length || 0,
      gasUsed: data.gasUsed,
      gasLimit: data.gasLimit,
      baseFeePerGas: data.baseFeePerGas,
      size: data.size,
      difficulty: data.difficulty || '0'
    };
  }
  
  private processAddressData(data: any): AddressDetails {
    return {
      address: data.address,
      balance: data.balance,
      transactionCount: data.transactionCount,
      tokens: data.tokens || [],
      nfts: data.nfts || [],
      isContract: data.isContract || false,
      creationTx: data.creationTx,
      ensName: data.ensName
    };
  }
  
  private processTokenData(data: any): TokenDetails {
    return {
      address: data.address,
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      totalSupply: data.totalSupply,
      holders: data.holders || 0,
      priceUsd: data.priceUsd,
      marketCap: data.marketCap,
      volume24h: data.volume24h,
      logoUrl: data.logoUrl,
      website: data.website,
      social: data.social
    };
  }
  
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }
  
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }
}

export default BlockExplorerService;
