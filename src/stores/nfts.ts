/**
 * NFT Store
 * Manages NFT collections and individual NFTs
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

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
      const floorValue = (collection.floorPrice || 0) * collection.ownedCount;
      return total + floorValue;
    }, 0);
  });

  // Methods
  /**
   * Fetch NFTs for current wallet
   */
  async function fetchNFTs(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;

      // In real implementation, fetch from blockchain or indexer
      // Mock data for now
      nfts.value = [
        {
          id: '1',
          name: 'Cool NFT #1',
          description: 'A very cool NFT',
          image: 'https://via.placeholder.com/300',
          collectionAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
          collectionName: 'Cool Collection',
          tokenId: '1',
          owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f80752',
          attributes: [
            { trait_type: 'Background', value: 'Blue' },
            { trait_type: 'Rarity', value: 'Rare' }
          ]
        },
        {
          id: '2',
          name: 'Cool NFT #2',
          description: 'Another cool NFT',
          image: 'https://via.placeholder.com/300',
          collectionAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
          collectionName: 'Cool Collection',
          tokenId: '2',
          owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f80752'
        },
        {
          id: '3',
          name: 'Awesome NFT #1',
          description: 'An awesome NFT',
          image: 'https://via.placeholder.com/300',
          collectionAddress: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
          collectionName: 'Awesome Collection',
          tokenId: '1',
          owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f80752'
        }
      ];

      // Update featured NFTs
      featuredNFTs.value = nfts.value.slice(0, 3);

      // Update collections
      updateCollections();

    } catch (err) {
      error.value = 'Failed to fetch NFTs';
      console.error('Failed to fetch NFTs:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update collections based on owned NFTs
   */
  function updateCollections(): void {
    const collectionMap = new Map<string, NFTCollection>();

    // Group NFTs by collection
    nfts.value.forEach(nft => {
      const existing = collectionMap.get(nft.collectionAddress);
      if (existing) {
        existing.ownedCount++;
      } else {
        collectionMap.set(nft.collectionAddress, {
          address: nft.collectionAddress,
          name: nft.collectionName || 'Unknown Collection',
          ownedCount: 1,
          floorPrice: 0.1 // Mock floor price
        });
      }
    });

    collections.value = Array.from(collectionMap.values());
  }

  /**
   * Get NFTs by collection
   */
  function getNFTsByCollection(collectionAddress: string): NFT[] {
    return nfts.value.filter(nft => 
      nft.collectionAddress.toLowerCase() === collectionAddress.toLowerCase()
    );
  }

  /**
   * Get NFT by ID
   */
  function getNFTById(id: string): NFT | undefined {
    return nfts.value.find(nft => nft.id === id);
  }

  /**
   * Refresh NFT metadata
   */
  async function refreshNFTMetadata(nftId: string): Promise<void> {
    try {
      const nft = getNFTById(nftId);
      if (!nft) {
        throw new Error('NFT not found');
      }

      // In real implementation, fetch fresh metadata
      console.log('Refreshing metadata for NFT:', nftId);

    } catch (err) {
      console.error('Failed to refresh NFT metadata:', err);
    }
  }

  /**
   * Transfer NFT
   */
  async function transferNFT(nftId: string, toAddress: string): Promise<boolean> {
    try {
      const nft = getNFTById(nftId);
      if (!nft) {
        error.value = 'NFT not found';
        return false;
      }

      // In real implementation, call NFT contract transfer method
      console.log('Transferring NFT:', nftId, 'to:', toAddress);

      // Remove from local state
      nfts.value = nfts.value.filter(n => n.id !== nftId);
      updateCollections();

      return true;
    } catch (err) {
      error.value = 'Failed to transfer NFT';
      console.error('Failed to transfer NFT:', err);
      return false;
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