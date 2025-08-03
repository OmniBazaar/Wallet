/**
 * NFT Manager
 * Manages NFT discovery, caching, and operations across all chains
 */

import { NFTDiscoveryService } from './discovery';
import { NFT, NFTDiscoveryOptions, NFTTransferRequest, SolanaNFT } from './types';
import { providerManager } from '../providers/ProviderManager';
import { keyringService } from '../keyring/KeyringService';
import { ChainType } from '../keyring/BIP39Keyring';

export class NFTManager {
  private discoveryService: NFTDiscoveryService;
  private nftCache: Map<string, NFT[]> = new Map();
  private lastUpdate: Map<string, number> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(apiKeys?: Record<string, string>) {
    this.discoveryService = new NFTDiscoveryService(apiKeys);
  }

  /**
   * Get NFTs for the active account
   */
  async getActiveAccountNFTs(options: NFTDiscoveryOptions = {}): Promise<NFT[]> {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount) {
      throw new Error('No active account');
    }

    return this.getNFTs(activeAccount.address, options);
  }

  /**
   * Get NFTs for a specific address
   */
  async getNFTs(address: string, options: NFTDiscoveryOptions = {}): Promise<NFT[]> {
    const cacheKey = `${address}_${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.discoveryService.discoverNFTs(address, options);
    this.setCache(cacheKey, result.nfts);
    
    return result.nfts;
  }

  /**
   * Get NFTs by chain
   */
  async getNFTsByChain(chain: ChainType | string): Promise<NFT[]> {
    const activeAccount = keyringService.getActiveAccount();
    if (!activeAccount) {
      throw new Error('No active account');
    }

    return this.getNFTs(activeAccount.address, { chains: [chain] });
  }

  /**
   * Get a specific NFT
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
   */
  async transferNFT(request: NFTTransferRequest): Promise<string> {
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
   */
  private async transferEVMNFT(
    nft: NFT,
    to: string,
    amount?: string
  ): Promise<string> {
    const provider = providerManager.getActiveProvider();
    if (!provider) {
      throw new Error('No active provider');
    }

    // Get the correct EVM provider
    if (nft.chain !== 'ethereum') {
      await providerManager.switchEVMNetwork(nft.chain);
    }

    const from = await keyringService.getActiveAccount()?.address;
    if (!from) {
      throw new Error('No active account');
    }

    let data: string;
    
    if (nft.type === 'ERC721') {
      // ERC721 safeTransferFrom(from, to, tokenId)
      const iface = new ethers.utils.Interface([
        'function safeTransferFrom(address from, address to, uint256 tokenId)'
      ]);
      data = iface.encodeFunctionData('safeTransferFrom', [from, to, nft.token_id]);
    } else if (nft.type === 'ERC1155') {
      // ERC1155 safeTransferFrom(from, to, id, amount, data)
      const iface = new ethers.utils.Interface([
        'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)'
      ]);
      data = iface.encodeFunctionData('safeTransferFrom', [
        from,
        to,
        nft.token_id,
        amount || '1',
        '0x'
      ]);
    } else {
      throw new Error(`Unsupported NFT type: ${nft.type}`);
    }

    // Send transaction
    const tx = await providerManager.sendTransaction(
      nft.contract_address,
      '0', // No ETH value
      nft.chain as ChainType,
      data
    );

    return typeof tx === 'string' ? tx : tx.hash;
  }

  /**
   * Transfer Solana NFT
   */
  private async transferSolanaNFT(
    nft: SolanaNFT,
    to: string
  ): Promise<string> {
    const solanaProvider = providerManager.getProvider('solana') as any;
    if (!solanaProvider) {
      throw new Error('Solana provider not initialized');
    }

    const from = await solanaProvider.getAddress();
    const privateKey = await keyringService.exportPrivateKey(from);

    // Import necessary Solana libraries
    const { PublicKey, Transaction } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      createTransferInstruction,
      TOKEN_PROGRAM_ID,
    } = await import('@solana/spl-token');

    const fromPubkey = new PublicKey(from);
    const toPubkey = new PublicKey(to);
    const mintPubkey = new PublicKey(nft.mint);

    // Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const transaction = new Transaction();

    // Check if recipient has token account
    const connection = solanaProvider.connection;
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    
    if (!toAccountInfo) {
      // Create associated token account for recipient
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey,
          toTokenAccount,
          toPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction (NFTs have amount of 1)
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        1, // NFTs always have amount of 1
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    const signedTx = await solanaProvider.signTransaction(privateKey, transaction);
    return await solanaProvider.sendTransaction(signedTx);
  }

  /**
   * Refresh NFT cache
   */
  async refreshCache(): Promise<void> {
    this.nftCache.clear();
    this.lastUpdate.clear();
  }

  /**
   * Get cached NFTs
   */
  private getCached(key: string): NFT[] | null {
    const cached = this.nftCache.get(key);
    const lastUpdate = this.lastUpdate.get(key);
    
    if (cached && lastUpdate && Date.now() - lastUpdate < this.cacheTimeout) {
      return cached;
    }
    
    return null;
  }

  /**
   * Set cache
   */
  private setCache(key: string, nfts: NFT[]): void {
    this.nftCache.set(key, nfts);
    this.lastUpdate.set(key, Date.now());
  }

  /**
   * Get NFT collections
   */
  async getCollections(): Promise<Map<string, NFT[]>> {
    const nfts = await this.getActiveAccountNFTs();
    const collections = new Map<string, NFT[]>();
    
    for (const nft of nfts) {
      const collectionId = nft.collection?.id || 'uncategorized';
      const existing = collections.get(collectionId) || [];
      existing.push(nft);
      collections.set(collectionId, existing);
    }
    
    return collections;
  }

  /**
   * Search NFTs by name
   */
  async searchNFTs(query: string): Promise<NFT[]> {
    const nfts = await this.getActiveAccountNFTs();
    const lowercaseQuery = query.toLowerCase();
    
    return nfts.filter(nft => 
      nft.metadata.name?.toLowerCase().includes(lowercaseQuery) ||
      nft.collection?.name?.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get NFT statistics
   */
  async getStatistics(): Promise<{
    totalNFTs: number;
    byChain: Record<string, number>;
    byCollection: Record<string, number>;
    totalFloorValue?: number;
  }> {
    const nfts = await this.getActiveAccountNFTs();
    
    const byChain: Record<string, number> = {};
    const byCollection: Record<string, number> = {};
    let totalFloorValue = 0;
    
    for (const nft of nfts) {
      // Count by chain
      byChain[nft.chain] = (byChain[nft.chain] || 0) + 1;
      
      // Count by collection
      if (nft.collection?.name) {
        byCollection[nft.collection.name] = (byCollection[nft.collection.name] || 0) + 1;
      }
      
      // Sum floor values
      if (nft.collection?.floor_price?.value) {
        totalFloorValue += nft.collection.floor_price.value;
      }
    }
    
    return {
      totalNFTs: nfts.length,
      byChain,
      byCollection,
      totalFloorValue: totalFloorValue > 0 ? totalFloorValue : undefined
    };
  }
}

// Import ethers for EVM NFT transfers
import { ethers } from 'ethers';

// Export singleton instance
export const nftManager = new NFTManager();