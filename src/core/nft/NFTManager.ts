/**
 * NFT Manager
 * Manages NFT discovery, caching, and operations across all chains
 */

import { NFTDiscoveryService } from './discovery';
import { NFT, NFTDiscoveryOptions, SolanaNFT, NFTType } from './types';
import { keyringService } from '../keyring/KeyringService';
import { ChainType } from '../keyring/BIP39Keyring';
import { ethers } from 'ethers';
import { providerManager } from '../providers/ProviderManager';

/** Manages NFT discovery, caching, and operations across all chains */
export class NFTManager {
  private discoveryService: NFTDiscoveryService;
  private nftCache: Map<string, NFT[]> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a new NFT manager
   * @param apiKeys Optional API keys for NFT providers
   */
  constructor(apiKeys?: Record<string, string>) {
    this.discoveryService = new NFTDiscoveryService(apiKeys);
  }

  /**
   * Get NFTs for the active account
   * @param options - Discovery options for filtering NFTs
   * @returns Promise resolving to array of NFTs
   */
  async getActiveAccountNFTs(options: NFTDiscoveryOptions = {}): Promise<NFT[]> {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount == null) {
      throw new Error('No active account');
    }

    return this.getNFTs(activeAccount.address, options);
  }

  /**
   * Get NFTs for a specific address
   * @param address - Wallet address to query NFTs for
   * @param options - Discovery options for filtering NFTs
   * @returns Promise resolving to array of NFTs
   */
  async getNFTs(address: string, options: NFTDiscoveryOptions = {}): Promise<NFT[]> {
    const cacheKey = `${address}_${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);

    if (cached != null) {
      return cached;
    }

    // Set default includeSpam to false if not specified
    const mergedOptions: NFTDiscoveryOptions = {
      includeSpam: false,
      ...options
    };

    const result = await this.discoveryService.discoverNFTs(address, mergedOptions);
    this.setCache(cacheKey, result.nfts);

    return result.nfts;
  }

  /**
   * Get NFTs by chain
   * @param chain - Chain to query NFTs from
   * @returns Promise resolving to array of NFTs for the chain
   */
  async getNFTsByChain(chain: ChainType | string): Promise<NFT[]> {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount == null) {
      throw new Error('No active account');
    }

    return this.getNFTs(activeAccount.address, { chains: [chain] });
  }

  /**
   * Get a specific NFT
   * @param chain - Chain where the NFT exists
   * @param contractAddress - NFT contract address
   * @param tokenId - Token ID
   * @returns Promise resolving to NFT or null if not found
   */
  async getNFT(
    chain: string,
    contractAddress: string,
    tokenId: string
  ): Promise<NFT | null> {
    return this.discoveryService.getNFT(chain, contractAddress, tokenId);
  }

  /**
   * Transfer NFT
   * @param request - Transfer request object
   * @param request.nft - NFT to transfer
   * @param request.from - Address to transfer from
   * @param request.to - Address to transfer to
   * @param request.amount - Optional amount for ERC1155
   * @returns Transaction hash
   */
  async transferNFT(request: { nft: NFT; from: string; to: string; amount?: string }): Promise<string> {
    const { nft, to, amount } = request;
    switch (nft.chain) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
      case 'optimism':
      case 'base':
        return this.transferEVMNFT(nft, to, amount);

      case 'solana':
        return this.transferSolanaNFT(nft as SolanaNFT, to);

      default:
        throw new Error(`NFT transfers not supported on ${nft.chain}`);
    }
  }

  /**
   * Transfer EVM NFT (ERC721/ERC1155)
   * @param nft - NFT to transfer
   * @param to - Recipient address
   * @param amount - Optional amount for ERC1155 tokens
   * @returns Promise resolving to transaction hash
   */
  private async transferEVMNFT(
    nft: NFT,
    to: string,
    amount?: string
  ): Promise<string> {
    // Check active account first
    const from = keyringService.getActiveAccount()?.address;
    if (from === null || from === undefined || from === '') {
      throw new Error('No active account');
    }

    const provider = providerManager.getActiveProvider();
    if (provider === null || provider === undefined) {
      throw new Error('No active provider');
    }

    // Get the correct EVM provider
    if (nft.chain !== 'ethereum') {
      providerManager.switchEVMNetwork(nft.chain);
    }

    let data: string;
    
    const nftType = nft.contract?.type ?? nft.type;

    if (nftType === NFTType.ERC721) {
      // ERC721 safeTransferFrom(from, to, tokenId)
      const iface = new ethers.Interface([
        'function safeTransferFrom(address from, address to, uint256 tokenId)'
      ]);
      data = iface.encodeFunctionData('safeTransferFrom', [from, to, nft.token_id]);
    } else if (nftType === NFTType.ERC1155) {
      // ERC1155 safeTransferFrom(from, to, id, amount, data)
      const iface = new ethers.Interface([
        'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)'
      ]);
      data = iface.encodeFunctionData('safeTransferFrom', [
        from,
        to,
        nft.token_id,
        amount ?? '1',
        '0x'
      ]);
    } else {
      throw new Error(`Unsupported NFT type: ${nftType}`);
    }

    // Get the provider for the specific chain
    const nftProvider = providerManager.getProvider(nft.chain as ChainType);
    if (nftProvider === null || nftProvider === undefined) {
      throw new Error(`No provider for chain ${nft.chain}`);
    }
    
    // Send transaction via the provider
    // For NFT transfers, we need to use the provider directly
    // nftProvider is already checked for null/undefined above
    if ('getSigner' in nftProvider && typeof nftProvider.getSigner === 'function') {
      const signer = await nftProvider.getSigner();
      const tx = await signer.sendTransaction({
        to: nft.contract_address,
        data,
        value: '0x0'
      });
      return tx.hash;
    } else if ('sendTransaction' in nftProvider && typeof nftProvider.sendTransaction === 'function') {
      // Use the ProviderManager sendTransaction method
      const result = await providerManager.sendTransaction(
        nft.contract_address,
        '0', // No ETH value for NFT transfers
        nft.chain as ChainType,
        data
      );
      return typeof result === 'string' ? result : result.hash;
    } else {
      throw new Error(`Provider for chain ${nft.chain} does not support sending transactions`);
    }
  }

  /**
   * Transfer Solana NFT
   * @param _nft - NFT to transfer (unused - not implemented)
   * @param _to - Recipient address (unused - not implemented)
   * @returns Transaction hash
   */
  private transferSolanaNFT(
    _nft: SolanaNFT,
    _to: string
  ): Promise<string> {
    const solanaProvider = providerManager.getProvider(ChainType.SOLANA);
    if (solanaProvider === null || solanaProvider === undefined || !('getAddress' in solanaProvider)) {
      throw new Error('Solana provider not initialized');
    }

    // For now, throw an error as Solana signing is not yet configured
    return Promise.reject(new Error('Solana NFT transfers not yet implemented - requires KeyringService signing integration'));

    // TODO: Implement when KeyringService supports Solana signing
    // This will involve:
    // 1. Getting the active account address
    // 2. Creating the SPL token transfer transaction
    // 3. Signing with KeyringService
    // 4. Sending via the provider
  }

  /**
   * Force refresh NFTs for active account
   * @param options Optional discovery options
   * @returns Refreshed NFT list
   */
  async refreshNFTs(options: NFTDiscoveryOptions = {}): Promise<NFT[]> {
    const activeAccount = keyringService.getActiveAccount();
    if (activeAccount == null) {
      throw new Error('No active account');
    }

    const cacheKey = `${activeAccount.address}_${JSON.stringify(options)}`;
    
    // Clear cache for this key to force refresh
    this.nftCache.delete(cacheKey);
    this.lastFetchTime.delete(cacheKey);
    
    return this.getNFTs(activeAccount.address, options);
  }
  
  /**
   * Refresh NFT cache
   * @returns Promise that resolves when cache is cleared
   */
  refreshCache(): Promise<void> {
    this.nftCache.clear();
    this.lastFetchTime.clear();
    return Promise.resolve();
  }

  /**
   * Get cached NFTs
   * @param key Cache key to lookup
   * @returns Cached NFTs or null if not found/expired
   */
  private getCached(key: string): NFT[] | null {
    const cached = this.nftCache.get(key);
    const lastUpdate = this.lastFetchTime.get(key);

    if (cached != null && lastUpdate != null && Date.now() - lastUpdate < this.cacheTimeout) {
      return cached;
    }

    return null;
  }

  /**
   * Set cache
   * @param key Cache key
   * @param nfts NFTs to cache
   */
  private setCache(key: string, nfts: NFT[]): void {
    this.nftCache.set(key, nfts);
    this.lastFetchTime.set(key, Date.now());
  }

  /**
   * Get NFT collections grouped by collection name
   * @returns Map of collection names to NFT arrays
   */
  async getCollections(): Promise<Map<string, NFT[]>> {
    const nfts = await this.getActiveAccountNFTs();
    const collections = new Map<string, NFT[]>();

    for (const nft of nfts) {
      const collectionName = nft.collection?.name ?? 'Uncategorized';
      const existing = collections.get(collectionName) ?? [];
      existing.push(nft);
      collections.set(collectionName, existing);
    }

    return collections;
  }
  
  /**
   * Get NFTs for a specific collection
   * @param collectionName Name of the collection
   * @returns Array of NFTs in that collection
   */
  async getNFTsForCollection(collectionName: string): Promise<NFT[]> {
    const collections = await this.getCollections();
    return collections.get(collectionName) ?? [];
  }

  /**
   * Search NFTs by name
   * @param query - Search query string
   * @returns Promise resolving to array of matching NFTs
   */
  async searchNFTs(query: string): Promise<NFT[]> {
    const nfts = await this.getActiveAccountNFTs();
    const lowercaseQuery = query.toLowerCase();

    return nfts.filter(nft => {
      const nameMatch = (nft.name?.toLowerCase().includes(lowercaseQuery) ?? false) ||
                        (nft.metadata?.name?.toLowerCase().includes(lowercaseQuery) ?? false);
      const collectionMatch = nft.collection?.name?.toLowerCase().includes(lowercaseQuery) ?? false;
      return nameMatch === true || collectionMatch === true;
    });
  }

  /**
   * Get NFT statistics
   * @returns Statistics including total NFTs, breakdown by chain and collection
   */
  async getStatistics(): Promise<{
    /** Total number of NFTs */
    totalNFTs: number;
    /** NFT count by chain */
    byChain: Record<string, number>;
    /** NFT count by collection */
    byCollection: Record<string, number>;
    /** Total number of unique collections */
    collections: number;
    /** Total floor value across all NFTs */
    totalFloorValue: number;
  }> {
    const nfts = await this.getActiveAccountNFTs();

    const byChain: Record<string, number> = {};
    const byCollection: Record<string, number> = {};
    let totalFloorValue = 0;

    for (const nft of nfts) {
      // Count by chain
      byChain[nft.chain] = (byChain[nft.chain] ?? 0) + 1;

      // Count by collection
      if (nft.collection?.name !== null && nft.collection?.name !== undefined && nft.collection?.name !== '') {
        byCollection[nft.collection.name] = (byCollection[nft.collection.name] ?? 0) + 1;
      }

      // Sum floor values - check both direct floor_price and collection floor_price
      const floorPrice = nft.floor_price ?? nft.collection?.floor_price?.value ?? 0;
      if (typeof floorPrice === 'number') {
        totalFloorValue += floorPrice;
      }
    }

    return {
      totalNFTs: nfts.length,
      byChain,
      byCollection,
      collections: Object.keys(byCollection).length,
      totalFloorValue
    };
  }

  /**
   * Clear the NFT cache
   * @returns Promise that resolves when cache is cleared
   */
  clearCache(): Promise<void> {
    this.nftCache.clear();
    this.lastFetchTime.clear();
    return Promise.resolve();
  }
}

// Export singleton instance
export const nftManager = new NFTManager();
