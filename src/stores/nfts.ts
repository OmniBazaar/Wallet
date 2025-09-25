/**
 * NFT Store
 * Manages NFT collections and individual NFTs
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { nftService } from '../background/background';
import { useWalletStore } from './wallet';
import type { NFT as WalletNFT } from '../core/nft/types';
// Removed unused import

/**
 * Individual NFT interface
 */
export interface NFT {
  /** NFT unique identifier */
  id: string;
  /** NFT name */
  name: string;
  /** NFT description */
  description?: string;
  /** NFT image URL */
  image: string;
  /** Collection address */
  collectionAddress: string;
  /** Collection name */
  collectionName?: string;
  /** Token ID */
  tokenId: string;
  /** Owner address */
  owner: string;
  /** NFT attributes */
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  /** External URL */
  externalUrl?: string;
}

/**
 * NFT Collection interface
 */
export interface NFTCollection {
  /** Collection contract address */
  address: string;
  /** Collection name */
  name: string;
  /** Collection symbol */
  symbol?: string;
  /** Collection description */
  description?: string;
  /** Collection image */
  image?: string;
  /** Total number of NFTs in collection */
  totalSupply?: number;
  /** NFTs owned from this collection */
  ownedCount: number;
  /** Collection floor price */
  floorPrice?: number;
}

export const useNFTStore = defineStore('nfts', () => {
  // State
  const nfts = ref<NFT[]>([]);
  const collections = ref<NFTCollection[]>([]);
  const featuredNFTs = ref<NFT[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const totalCount = computed(() => nfts.value.length);

  const collectionsWithNFTs = computed(() => {
    return collections.value.filter(c => c.ownedCount > 0);
  });

  const totalFloorValue = computed(() => {
    return collections.value.reduce((total, collection) => {
      const floorPrice = collection.floorPrice ?? 0;
      const floorValue = floorPrice > 0 ? floorPrice * collection.ownedCount : 0;
      return total + floorValue;
    }, 0);
  });

  // Methods
  /**
   * Fetch NFTs for current wallet
   * @returns Promise that resolves when NFTs are loaded
   */
  async function fetchNFTs(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;

      // Get current wallet address
      const walletStore = useWalletStore();
      const address = walletStore.address;
      
      if (address === '') {
        nfts.value = [];
        featuredNFTs.value = [];
        return;
      }

      // NFTService is already initialized in the constructor

      // Fetch real NFTs from NFTService
      const walletNFTs = await nftService.getNFTs(address);
      
      // Convert WalletNFT to NFT format
      nfts.value = walletNFTs.map((nft: WalletNFT) => ({
        id: nft.id,
        name: nft.name ?? nft.metadata?.name ?? `NFT #${nft.token_id}`,
        image: nft.metadata?.image ?? '',
        collectionAddress: nft.contract_address,
        tokenId: nft.token_id,
        owner: nft.owner ?? address,
        ...(nft.metadata?.description !== undefined && { description: nft.metadata.description }),
        ...(nft.collection?.name !== undefined && { collectionName: nft.collection.name }),
        ...(nft.metadata?.attributes !== undefined && {
          attributes: nft.metadata.attributes.map(attr => ({
            trait_type: attr.trait_type ?? 'Trait',
            value: attr.value
          }))
        }),
        ...(nft.metadata?.external_url !== undefined && { externalUrl: nft.metadata.external_url })
      }));

      // Update featured NFTs (first 3)
      featuredNFTs.value = nfts.value.slice(0, 3);

      // Update collections based on fetched NFTs
      await updateCollectionsFromNFTs();

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch NFTs';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update collections based on owned NFTs
   */
  async function updateCollections(): Promise<void> {
    await updateCollectionsFromNFTs();
  }

  /**
   * Update collections based on owned NFTs and fetch real collection data
   */
  async function updateCollectionsFromNFTs(): Promise<void> {
    const collectionMap = new Map<string, NFTCollection>();

    // Group NFTs by collection
    nfts.value.forEach(nft => {
      const existing = collectionMap.get(nft.collectionAddress);
      if (existing !== undefined) {
        existing.ownedCount++;
      } else {
        collectionMap.set(nft.collectionAddress, {
          address: nft.collectionAddress,
          name: nft.collectionName ?? 'Unknown Collection',
          ownedCount: 1
        });
      }
    });

    // Get current wallet address
    const walletStore = useWalletStore();
    const address = walletStore.address;
    
    if (address !== '') {
      try {
        // Fetch real collection data from NFTService
        const collectionsData = await nftService.getCollections(address);
        
        // Update collection info with real data
        for (const collectionData of collectionsData) {
          const collection = collectionData as {
            /** Collection address */
            address: string;
            /** Collection name */
            name: string;
            /** Collection symbol */
            symbol?: string;
            /** Floor price */
            floorPrice?: number;
            /** Total supply */
            totalSupply?: number;
          };
          
          const existing = collectionMap.get(collection.address);
          if (existing !== undefined) {
            existing.name = collection.name;
            if (collection.symbol !== undefined) {
              existing.symbol = collection.symbol;
            }
            if (collection.floorPrice !== undefined) {
              existing.floorPrice = collection.floorPrice;
            }
            if (collection.totalSupply !== undefined) {
              existing.totalSupply = collection.totalSupply;
            }
          }
        }
      } catch (_err) {
        // If fetching collection data fails, continue with basic info
      }
    }

    collections.value = Array.from(collectionMap.values());
  }

  /**
   * Get NFTs by collection
   * @param collectionAddress - The collection contract address
   * @returns Array of NFTs from the specified collection
   */
  function getNFTsByCollection(collectionAddress: string): NFT[] {
    return nfts.value.filter(nft => 
      nft.collectionAddress.toLowerCase() === collectionAddress.toLowerCase()
    );
  }

  /**
   * Get NFT by ID
   * @param id - The NFT identifier
   * @returns The NFT if found, undefined otherwise
   */
  function getNFTById(id: string): NFT | undefined {
    return nfts.value.find(nft => nft.id === id);
  }

  /**
   * Refresh NFT metadata
   * @param nftId - The NFT identifier to refresh
   * @returns Promise that resolves when metadata is refreshed
   */
  async function refreshNFTMetadata(nftId: string): Promise<void> {
    try {
      const nft = getNFTById(nftId);
      if (nft === undefined) {
        throw new Error('NFT not found');
      }

      // Get current chain ID from wallet
      const walletStore = useWalletStore();
      // TODO: Get actual chainId from network configuration
      const chainId = walletStore.currentNetwork === 'ethereum' ? 1 : 1;

      // Fetch fresh metadata from NFTService
      const metadata = await nftService.getNFTMetadata(
        nft.collectionAddress,
        nft.tokenId,
        chainId
      );

      if (metadata !== null) {
        // Update the NFT in our store with fresh metadata
        const index = nfts.value.findIndex(n => n.id === nftId);
        if (index >= 0) {
          const existingNft = nfts.value[index];
          if (existingNft === undefined) {
            return;
          }
          nfts.value[index] = {
            ...existingNft,
            name: metadata.name ?? metadata.metadata?.name ?? existingNft.name,
            image: metadata.metadata?.image ?? existingNft.image,
            ...(metadata.metadata?.description !== undefined && { description: metadata.metadata.description }),
            ...(metadata.metadata?.attributes !== undefined && {
              attributes: metadata.metadata.attributes.map(attr => ({
                trait_type: attr.trait_type ?? 'Trait',
                value: attr.value
              }))
            })
          };
        }
      }

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh NFT metadata';
      throw err;
    }
  }

  /**
   * Transfer NFT
   * @param nftId - The NFT identifier to transfer
   * @param toAddress - The destination address
   * @returns Promise that resolves to true if successful, false otherwise
   */
  async function transferNFT(nftId: string, toAddress: string): Promise<boolean> {
    try {
      const nft = getNFTById(nftId);
      if (nft === undefined) {
        error.value = 'NFT not found';
        return false;
      }

      // Get current wallet address and chain ID
      const walletStore = useWalletStore();
      const fromAddress = walletStore.address;
      // TODO: Get actual chainId from network configuration
      const chainId = walletStore.currentNetwork === 'ethereum' ? 1 : 1;
      
      if (fromAddress === '') {
        error.value = 'No wallet connected';
        return false;
      }

      // Transfer NFT through NFTService
      const result = await nftService.transferNFT({
        contractAddress: nft.collectionAddress,
        tokenId: nft.tokenId,
        from: fromAddress,
        to: toAddress,
        chainId
      });

      if (result.success) {
        // Remove from local state after successful transfer
        nfts.value = nfts.value.filter(n => n.id !== nftId);
        await updateCollectionsFromNFTs();
        return true;
      } else {
        error.value = result.error ?? 'Transfer failed';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to transfer NFT';
      throw err;
    }
  }

  /**
   * Clear all NFTs
   */
  function clearNFTs(): void {
    nfts.value = [];
    collections.value = [];
    featuredNFTs.value = [];
    error.value = null;
  }

  return {
    // State
    nfts,
    collections,
    featuredNFTs,
    isLoading,
    error,

    // Computed
    totalCount,
    collectionsWithNFTs,
    totalFloorValue,

    // Methods
    fetchNFTs,
    updateCollections,
    getNFTsByCollection,
    getNFTById,
    refreshNFTMetadata,
    transferNFT,
    clearNFTs
  };
});