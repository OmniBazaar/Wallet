/**
 * NFT Platform Integration Tests
 * Tests wallet integration with NFT minting, trading, and display
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { NFTService } from '../../src/services/NFTService';
import { WalletService } from '../../src/services/WalletService';
import { IPFSService } from '../../src/services/IPFSService';
import { mockWallet, mockNFT } from '../setup';
import { ethers } from 'ethers';

describe('NFT Platform Integration', () => {
  let nftService: NFTService;
  let walletService: WalletService;
  let ipfsService: IPFSService;
  let provider: ethers.JsonRpcProvider;

  beforeAll(async () => {
    // Use mock provider in test environment
    provider = mockWallet.provider;
    walletService = new WalletService(provider);
    nftService = new NFTService(walletService);
    ipfsService = new IPFSService();

    // Initialize services
    try {
      await walletService.init();
    } catch (error) {
      // Continue even if wallet service fails to init in test environment
    }

    await nftService.init();

    // Initialize IPFS service (it will skip real connections in test mode)
    await ipfsService.init();
  });

  afterAll(async () => {
    await ipfsService.disconnect();
    await nftService.cleanup();
    await walletService.cleanup();
  });

  beforeEach(async () => {
    await nftService.clearCache();
  });

  describe('NFT Minting', () => {
    it('should mint NFT for marketplace listing', async () => {
      const listingData = {
        title: 'Digital Artwork',
        description: 'Unique digital art piece',
        image: Buffer.from('image-data'),
        price: '100',
        currency: 'XOM',
        attributes: [
          { trait_type: 'Category', value: 'Art' },
          { trait_type: 'Rarity', value: 'Rare' }
        ]
      };

      // Upload to IPFS
      const ipfsHash = await ipfsService.uploadMetadata(listingData);
      expect(ipfsHash).toMatch(/^Qm[a-zA-Z0-9]{44}$/);

      // Mint NFT
      const nft = await nftService.mintNFT({
        to: mockWallet.address,
        metadataURI: `ipfs://${ipfsHash}`,
        royaltyPercentage: 250 // 2.5%
      });

      expect(nft.tokenId).toBeDefined();
      expect(nft.contractAddress).toBeDefined();
      expect(nft.owner).toBe(mockWallet.address);
      expect(nft.metadataURI).toContain(ipfsHash);
    });

    it('should batch mint multiple NFTs', async () => {
      const nftsToMint = [
        { name: 'NFT 1', description: 'First NFT' },
        { name: 'NFT 2', description: 'Second NFT' },
        { name: 'NFT 3', description: 'Third NFT' }
      ];

      const minted = await nftService.batchMint(nftsToMint, mockWallet.address);
      
      expect(minted).toHaveLength(3);
      minted.forEach((nft, index) => {
        expect(nft.tokenId).toBeDefined();
        expect(nft.metadata.name).toBe(`NFT ${index + 1}`);
      });
    });

    it('should set and update royalties', async () => {
      const nft = await nftService.mintNFT({
        to: mockWallet.address,
        metadataURI: 'ipfs://test',
        royaltyPercentage: 500 // 5%
      });

      const royalties = await nftService.getRoyaltyInfo(
        nft.contractAddress,
        nft.tokenId,
        ethers.parseEther('100')
      );

      expect(royalties.receiver).toBe(mockWallet.address);
      expect(royalties.amount).toBe(ethers.parseEther('5')); // 5% of 100
    });

    it('should mint with lazy minting support', async () => {
      const voucher = await nftService.createLazyMintVoucher({
        tokenId: 1,
        price: ethers.parseEther('1'),
        uri: 'ipfs://metadata',
        royaltyPercentage: 250
      }, mockWallet.address);

      expect(voucher.signature).toBeDefined();
      expect(voucher.voucher).toHaveProperty('tokenId');
      expect(voucher.voucher).toHaveProperty('price');

      // Redeem voucher
      const redeemed = await nftService.redeemVoucher(voucher, '0xbuyer...');
      expect(redeemed.success).toBe(true);
      expect(redeemed.tokenId).toBe(1);
    });
  });

  describe('NFT Trading', () => {
    let testNFT: any;

    beforeEach(async () => {
      testNFT = await nftService.mintNFT({
        to: mockWallet.address,
        metadataURI: 'ipfs://test'
      });
    });

    it('should list NFT for sale', async () => {
      const listing = await nftService.listForSale({
        tokenId: testNFT.tokenId,
        contractAddress: testNFT.contractAddress,
        price: ethers.parseEther('10'),
        currency: 'ETH'
      });

      expect(listing.listingId).toBeDefined();
      expect(listing.seller).toBe(mockWallet.address);
      expect(listing.price).toBe(ethers.parseEther('10'));
      expect(listing.status).toBe('active');
    });

    it('should create auction for NFT', async () => {
      const auction = await nftService.createAuction({
        tokenId: testNFT.tokenId,
        contractAddress: testNFT.contractAddress,
        startingPrice: ethers.parseEther('1'),
        reservePrice: ethers.parseEther('5'),
        duration: 86400 // 24 hours
      });

      expect(auction.auctionId).toBeDefined();
      expect(auction.startTime).toBeDefined();
      expect(auction.endTime).toBe(auction.startTime + 86400);
    });

    it('should place bid on auction', async () => {
      const auction = await nftService.createAuction({
        tokenId: testNFT.tokenId,
        contractAddress: testNFT.contractAddress,
        startingPrice: ethers.parseEther('1')
      });

      const bid = await nftService.placeBid(
        auction.auctionId,
        ethers.parseEther('2'),
        '0xbidder...'
      );

      expect(bid.success).toBe(true);
      expect(bid.bidAmount).toBe(ethers.parseEther('2'));
      expect(bid.bidder).toBe('0xbidder...');
    });

    it('should transfer NFT', async () => {
      const recipient = '0x9876543210987654321098765432109876543210';
      
      const transfer = await nftService.transferNFT({
        tokenId: testNFT.tokenId,
        contractAddress: testNFT.contractAddress,
        from: mockWallet.address,
        to: recipient
      });

      expect(transfer.success).toBe(true);
      expect(transfer.transactionHash).toBeDefined();
      
      const newOwner = await nftService.getOwner(
        testNFT.contractAddress,
        testNFT.tokenId
      );
      expect(newOwner).toBe(recipient);
    });

    it('should handle batch transfers', async () => {
      const nfts = await nftService.batchMint(
        [{ name: 'NFT 1' }, { name: 'NFT 2' }],
        mockWallet.address
      );

      const recipient = '0xrecipient...';
      const transfers = await nftService.batchTransfer(
        nfts.map(n => ({ tokenId: n.tokenId, contractAddress: n.contractAddress })),
        mockWallet.address,
        recipient
      );

      expect(transfers.every(t => t.success)).toBe(true);
    });
  });

  describe('Multi-Chain NFT Support', () => {
    it('should detect NFTs on Ethereum', async () => {
      const ethereumNFTs = await nftService.getNFTsByChain(
        mockWallet.address,
        'ethereum'
      );

      expect(Array.isArray(ethereumNFTs)).toBe(true);
      ethereumNFTs.forEach(nft => {
        expect(nft.chain).toBe('ethereum');
        expect(nft.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('should detect NFTs on Avalanche', async () => {
      const avalancheNFTs = await nftService.getNFTsByChain(
        mockWallet.address,
        'avalanche'
      );

      expect(Array.isArray(avalancheNFTs)).toBe(true);
      avalancheNFTs.forEach(nft => {
        expect(nft.chain).toBe('avalanche');
      });
    });

    it('should detect NFTs on Polygon', async () => {
      const polygonNFTs = await nftService.getNFTsByChain(
        mockWallet.address,
        'polygon'
      );

      expect(Array.isArray(polygonNFTs)).toBe(true);
      polygonNFTs.forEach(nft => {
        expect(nft.chain).toBe('polygon');
      });
    });

    it('should aggregate NFTs from all chains', async () => {
      const allNFTs = await nftService.getAllNFTs(mockWallet.address);
      
      expect(Array.isArray(allNFTs)).toBe(true);
      
      const chains = new Set(allNFTs.map(nft => nft.chain));
      expect(chains.size).toBeGreaterThan(0);
      
      allNFTs.forEach(nft => {
        expect(nft).toHaveProperty('tokenId');
        expect(nft).toHaveProperty('contractAddress');
        expect(nft).toHaveProperty('chain');
        expect(nft).toHaveProperty('metadata');
      });
    });

    it('should bridge NFT cross-chain', async () => {
      const nft = await nftService.mintNFT({
        to: mockWallet.address,
        metadataURI: 'ipfs://test'
      });

      const bridged = await nftService.bridgeNFT({
        tokenId: nft.tokenId,
        contractAddress: nft.contractAddress,
        fromChain: 'ethereum',
        toChain: 'avalanche',
        recipient: mockWallet.address
      });

      expect(bridged.success).toBe(true);
      expect(bridged.destinationTokenId).toBeDefined();
      expect(bridged.destinationChain).toBe('avalanche');
    });
  });

  describe('NFT Metadata and Display', () => {
    it('should fetch and cache metadata', async () => {
      const metadata = await nftService.getMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(metadata).toBeDefined();
      expect(metadata.name).toBeDefined();
      expect(metadata.description).toBeDefined();
      expect(metadata.image).toBeDefined();

      // Check cache
      const cached = await nftService.getCachedMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );
      expect(cached).toEqual(metadata);
    });

    it('should resolve IPFS metadata', async () => {
      const ipfsURI = 'ipfs://QmTest123';
      const metadata = await nftService.resolveIPFSMetadata(ipfsURI);
      
      expect(metadata).toBeDefined();
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('description');
    });

    it('should handle metadata refresh', async () => {
      const refreshed = await nftService.refreshMetadata(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(refreshed.updated).toBe(true);
      expect(refreshed.metadata).toBeDefined();
      expect(refreshed.timestamp).toBeDefined();
    });

    it('should generate thumbnail images', async () => {
      const thumbnail = await nftService.generateThumbnail(
        mockNFT.image,
        { width: 256, height: 256 }
      );

      expect(thumbnail).toBeDefined();
      expect(thumbnail.width).toBe(256);
      expect(thumbnail.height).toBe(256);
      expect(thumbnail.url).toBeDefined();
    });

    it('should handle video NFTs', async () => {
      const videoNFT = {
        ...mockNFT,
        animation_url: 'ipfs://video.mp4'
      };

      const processed = await nftService.processVideoNFT(videoNFT);
      
      expect(processed.thumbnail).toBeDefined();
      expect(processed.duration).toBeDefined();
      expect(processed.format).toBe('mp4');
    });
  });

  describe('NFT Collections', () => {
    it('should create NFT collection', async () => {
      const collection = await nftService.createCollection({
        name: 'Test Collection',
        symbol: 'TC',
        description: 'Test NFT Collection',
        maxSupply: 10000,
        mintPrice: ethers.parseEther('0.1'),
        owner: mockWallet.address
      });

      expect(collection.address).toBeDefined();
      expect(collection.name).toBe('Test Collection');
      expect(collection.owner).toBe(mockWallet.address);
    });

    it('should get collection statistics', async () => {
      const stats = await nftService.getCollectionStats(mockNFT.contractAddress);
      
      expect(stats).toBeDefined();
      expect(stats.totalSupply).toBeDefined();
      expect(stats.owners).toBeDefined();
      expect(stats.floorPrice).toBeDefined();
      expect(stats.volume24h).toBeDefined();
    });

    it('should verify collection ownership', async () => {
      const isOwner = await nftService.isCollectionOwner(
        mockNFT.contractAddress,
        mockWallet.address
      );

      expect(typeof isOwner).toBe('boolean');
    });

    it('should get collection royalties', async () => {
      const royalties = await nftService.getCollectionRoyalties(
        mockNFT.contractAddress
      );

      expect(royalties).toBeDefined();
      expect(royalties.percentage).toBeGreaterThanOrEqual(0);
      expect(royalties.percentage).toBeLessThanOrEqual(10000); // Max 100%
      expect(royalties.recipient).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('NFT Standards Support', () => {
    it('should support ERC-721 NFTs', async () => {
      const erc721 = await nftService.deployERC721({
        name: 'ERC721 Test',
        symbol: 'E721',
        owner: mockWallet.address
      });

      expect(erc721.address).toBeDefined();
      expect(erc721.standard).toBe('ERC721');
      
      const isERC721 = await nftService.isERC721(erc721.address);
      expect(isERC721).toBe(true);
    });

    it('should support ERC-1155 NFTs', async () => {
      const erc1155 = await nftService.deployERC1155({
        uri: 'https://api.example.com/token/{id}',
        owner: mockWallet.address
      });

      expect(erc1155.address).toBeDefined();
      expect(erc1155.standard).toBe('ERC1155');
      
      const isERC1155 = await nftService.isERC1155(erc1155.address);
      expect(isERC1155).toBe(true);
    });

    it('should handle ERC-1155 batch operations', async () => {
      const erc1155Address = '0xerc1155...';
      const tokenIds = [1, 2, 3];
      const amounts = [10, 20, 30];

      const minted = await nftService.batchMintERC1155(
        erc1155Address,
        mockWallet.address,
        tokenIds,
        amounts
      );

      expect(minted.success).toBe(true);
      expect(minted.tokenIds).toEqual(tokenIds);
      expect(minted.amounts).toEqual(amounts);
    });

    it('should support ERC-2981 royalty standard', async () => {
      const supportsRoyalties = await nftService.supportsERC2981(
        mockNFT.contractAddress
      );

      expect(typeof supportsRoyalties).toBe('boolean');
      
      if (supportsRoyalties) {
        const royaltyInfo = await nftService.royaltyInfo(
          mockNFT.contractAddress,
          mockNFT.tokenId,
          ethers.parseEther('100')
        );
        
        expect(royaltyInfo.receiver).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(royaltyInfo.royaltyAmount).toBeDefined();
      }
    });
  });

  describe('NFT Analytics', () => {
    it('should track NFT views', async () => {
      await nftService.trackView(mockNFT.contractAddress, mockNFT.tokenId);
      
      const analytics = await nftService.getAnalytics(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(analytics.views).toBeGreaterThan(0);
      expect(analytics.uniqueViewers).toBeGreaterThan(0);
    });

    it('should get price history', async () => {
      const history = await nftService.getPriceHistory(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(Array.isArray(history)).toBe(true);
      history.forEach(entry => {
        expect(entry).toHaveProperty('price');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('buyer');
        expect(entry).toHaveProperty('seller');
      });
    });

    it('should calculate rarity score', async () => {
      const rarity = await nftService.calculateRarity(
        mockNFT.contractAddress,
        mockNFT.tokenId
      );

      expect(rarity.score).toBeGreaterThanOrEqual(0);
      expect(rarity.score).toBeLessThanOrEqual(100);
      expect(rarity.rank).toBeDefined();
      expect(rarity.traits).toBeDefined();
    });

    it('should get trending NFTs', async () => {
      const trending = await nftService.getTrendingNFTs({
        period: '24h',
        limit: 10
      });

      expect(Array.isArray(trending)).toBe(true);
      expect(trending.length).toBeLessThanOrEqual(10);
      trending.forEach(nft => {
        expect(nft).toHaveProperty('volumeChange');
        expect(nft).toHaveProperty('salesCount');
        expect(nft).toHaveProperty('averagePrice');
      });
    });
  });
});