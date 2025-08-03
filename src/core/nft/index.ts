export { useNftCollections } from './collections';
export { useGalleryNfts } from './galleryNfts';
export { useNftsForCollection } from './nftsForCollection';

// New NFT system exports
export * from './types';
export * from './discovery';
export * from './NFTManager';

// Re-export singleton instance
export { nftManager } from './NFTManager';
