export { getNftCollections } from './collections';
export { useGalleryNFTs } from './galleryNfts';
// export { useNftsForCollection } from './nftsForCollection'; // Disabled - needs refactoring

// New NFT system exports
export * from './types';
export * from './discovery';
export * from './NFTManager';

// Re-export singleton instance
export { nftManager } from './NFTManager';
