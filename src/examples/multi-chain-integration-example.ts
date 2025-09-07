/**
 * Multi-Chain NFT Integration Example
 *
 * This example demonstrates how to use the OmniBazaar wallet's
 * multi-chain NFT system for marketplace operations.
 */

import { MultiChainNFTDisplay } from '../core/nft/display/multi-chain-display';
import { SimplifiedNFTMinter } from '../core/nft/minting/simple-minter';
import type { NFTMintRequest } from '../types/nft';

/**
 * Example: Complete NFT marketplace integration
 */
class OmniBazaarMarketplaceExample {
  private nftDisplay: MultiChainNFTDisplay;
  private nftMinter: SimplifiedNFTMinter;

  /**
   * Create a new marketplace example instance
   */
  constructor() {
    // Initialize the multi-chain NFT display system
    this.nftDisplay = new MultiChainNFTDisplay();

    // Initialize the NFT minter for OmniCoin
    this.nftMinter = new SimplifiedNFTMinter({
      rpcUrl: 'http://localhost:8888',
      contractAddress: '0x0000000000000000000000000000000000000000',
      marketplaceAddress: '0x1111111111111111111111111111111111111111',
      ipfsGateway: 'https://ipfs.io/ipfs',
      defaultRoyalty: 5
    });

    this.setupMultiChainProviders();
  }

  /**
   * Setup real blockchain providers with API keys
   */
  private setupMultiChainProviders(): void {
    // Initialize providers with actual API keys (replace with real keys)
    this.nftDisplay.initializeProviders({
      ethereum: {
        ...(process?.env?.['ALCHEMY_ETHEREUM_API_KEY'] ? { alchemyApiKey: process.env['ALCHEMY_ETHEREUM_API_KEY'] } : {}),
        ...(process?.env?.['OPENSEA_API_KEY'] ? { openseaApiKey: process.env['OPENSEA_API_KEY'] } : {})
      },
      polygon: {
        ...(process?.env?.['ALCHEMY_POLYGON_API_KEY'] ? { alchemyApiKey: process.env['ALCHEMY_POLYGON_API_KEY'] } : {})
      },
      solana: {
        ...(process?.env?.['HELIUS_API_KEY'] ? { heliusApiKey: process.env['HELIUS_API_KEY'] } : {}),
        ...(process?.env?.['MAGICEDEN_API_KEY'] ? { magicEdenApiKey: process.env['MAGICEDEN_API_KEY'] } : {})
      }
    });

    console.warn('✅ Multi-chain NFT providers initialized');
  }

  /**
   * Example: Mint a new marketplace NFT on OmniCoin
   * @param sellerAddress Address of the seller
   * @param productData Product information
   * @param productData.name Product name
   * @param productData.description Product description
   * @param productData.imageUrl Product image URL
   * @param productData.price Product price
   * @param productData.category Product category
   * @param productData.location Product location (optional)
   * @returns Promise resolving to the minted NFT ID
   */
  async mintMarketplaceNFT(sellerAddress: string, productData: {
    name: string;
    description: string;
    imageUrl: string;
    price: string;
    category: string;
    location?: string;
  }): Promise<string> {
    try {
      console.warn('🔨 Minting new marketplace NFT...');

      const mintRequest: NFTMintRequest = {
        name: productData.name,
        description: productData.description,
        image: productData.imageUrl,
        attributes: [
          { trait_type: 'Category', value: productData.category },
          { trait_type: 'Seller', value: sellerAddress },
          { trait_type: 'Price', value: productData.price },
          { trait_type: 'Currency', value: 'XOM' },
          { trait_type: 'Marketplace', value: 'OmniBazaar' },
          { trait_type: 'Type', value: 'Product Listing' },
          ...(productData.location ? [{ trait_type: 'Location', value: productData.location }] : [])
        ],
        royalties: 5,
        listImmediately: true,
        listingPrice: productData.price,
        listingCurrency: 'XOM',
        category: productData.category,
        useIPFS: true
      };

      const mockListingData: import('../types/listing').ListingMetadata = {
        id: 'test-listing-' + Date.now(),
        type: 'product',
        seller: {
          name: 'Test Seller',
          address: sellerAddress,
          location: {
            city: 'Test City',
            country: 'Test Country'
          },
          contactInfo: {
            email: 'test@example.com'
          },
          rating: 5.0,
          totalSales: 0,
          joinedDate: new Date().toISOString(),
          verified: true
        },
        details: {
          name: productData.name,
          description: productData.description,
          category: productData.category,
          tags: [],
          condition: 'new' as const,
          images: [productData.imageUrl],
          price: {
            amount: productData.price,
            currency: 'XOM'
          },
          quantity: 1,
          availability: true
        },
        listingNode: {
          address: 'test-node-address',
          name: 'Test Node',
          description: 'Test listing node',
          location: {
            country: 'Test Country',
            city: 'Test City'
          },
          status: 'active' as const,
          lastSync: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active' as const,
        views: 0,
        favorites: 0
      };
      
      const result = await this.nftMinter.mintListingNFT(mintRequest, mockListingData, sellerAddress);

      console.warn('✅ NFT minted successfully:', {
        transactionHash: result.transactionHash,
        tokenId: result.tokenId,
        ipfsHash: result.ipfsHash
      });

      return result.transactionHash ?? 'unknown';
    } catch (error) {
      console.error('❌ Failed to mint NFT:', error);
      throw error;
    }
  }

  /**
   * Example: Display all NFTs from multiple chains for a user
   * @param userAddress
   */
  async showUserNFTPortfolio(userAddress: string): Promise<void> {
    try {
      console.warn(`📱 Loading NFT portfolio for ${userAddress}...`);

      // Get NFTs from all enabled chains
      const portfolio = await this.nftDisplay.getAllNFTs(userAddress);

      console.warn(`\n🎨 NFT Portfolio Summary:`);
      console.warn(`Total NFTs: ${portfolio.totalCount}`);
      console.warn(`Chains with NFTs: ${Object.keys(portfolio.chains).length}`);

      // Display breakdown by chain
      for (const [chainId, nfts] of Object.entries(portfolio.chains)) {
        const chainName = this.getChainName(parseInt(chainId));
        const chainNFTs = nfts as Array<{
          name: string;
          price?: string;
          currency?: string;
          isListed: boolean;
          attributes: Array<{ trait_type: string; value: string }>;
          blockchain: string;
        }>;

        if (chainNFTs.length > 0) {
          console.warn(`\n${chainName}: ${chainNFTs.length} NFTs`);

          // Show first few NFTs from each chain
          chainNFTs.slice(0, 3).forEach((nft, index) => {
            console.warn(`  ${index + 1}. ${nft.name} - ${nft.price || 'Not Listed'} ${nft.currency || ''}`);
          });

          if (chainNFTs.length > 3) {
            console.warn(`  ... and ${chainNFTs.length - 3} more`);
          }
        }
      }

      // Show some interesting statistics
      const allNFTs = portfolio.nfts;
      const listedNFTs = allNFTs.filter(nft => nft.isListed);
      const categories = [...new Set(allNFTs.map(nft =>
        nft.attributes.find(attr => attr.trait_type === 'Category')?.value
      ).filter(Boolean))];

      console.warn(`\n📊 Portfolio Statistics:`);
      console.warn(`Listed for Sale: ${listedNFTs.length}/${allNFTs.length}`);
      console.warn(`Categories: ${categories.join(', ')}`);
      console.warn(`Blockchains: ${[...new Set(allNFTs.map(nft => nft.blockchain))].join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to load NFT portfolio:', error);
    }
  }

  /**
   * Example: Search for NFTs across all chains
   * @param searchTerm
   * @param filters
   * @param filters.category
   * @param filters.blockchain
   * @param filters.priceRange
   * @param filters.priceRange.min
   * @param filters.priceRange.max
   */
  async searchMarketplaceNFTs(searchTerm: string, filters?: {
    category?: string;
    blockchain?: string;
    priceRange?: { min: number; max: number };
  }): Promise<void> {
    try {
      console.warn(`🔍 Searching for "${searchTerm}" across all chains...`);

      const searchQuery = {
        query: searchTerm,
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.blockchain ? { blockchain: filters.blockchain } : {}),
        ...(filters?.priceRange ? { priceRange: filters.priceRange } : {}),
        limit: 20
      };

      const results = await this.nftDisplay.searchNFTs(searchQuery);

      console.warn(`\n🎯 Search Results:`);
      console.warn(`Found ${results.total} NFTs matching "${searchTerm}"`);
      console.warn(`Showing ${results.items.length} results`);

      // Display search results
      results.items.forEach((item: {
        title?: string;
        name?: string;
        blockchain?: string;
        price?: string;
        currency?: string;
        category?: string;
        seller?: string;
      }, index) => {
        const nft = item; // The converted marketplace listing
        console.warn(`\n${index + 1}. ${nft.title || nft.name}`);
        console.warn(`   Blockchain: ${nft.blockchain || 'Unknown'}`);
        console.warn(`   Price: ${nft.price || 'Not Listed'} ${nft.currency || ''}`);
        console.warn(`   Category: ${nft.category || 'General'}`);
        console.warn(`   Seller: ${nft.seller}`);
      });

      // Show available filters
      if (results.filters) {
        console.warn(`\n🔧 Available Filters:`);
        if (results.filters.categories?.length > 0) {
          console.warn(`Categories: ${results.filters.categories.map(c => `${c.name} (${c.count})`).join(', ')}`);
        }
        if (results.filters.blockchains?.length > 0) {
          console.warn(`Blockchains: ${results.filters.blockchains.map(b => `${b.name} (${b.count})`).join(', ')}`);
        }
        if (results.filters.priceRange) {
          console.warn(`Price Range: ${results.filters.priceRange.min} - ${results.filters.priceRange.max}`);
        }
      }

    } catch (error) {
      console.error('❌ Search failed:', error);
    }
  }

  /**
   * Example: Get marketplace statistics
   */
  async showMarketplaceStatistics(): Promise<void> {
    try {
      console.warn('📊 Loading marketplace statistics...');

      const stats = await this.nftDisplay.getChainStatistics();

      console.warn('\n🌐 Multi-Chain NFT Statistics:');
      console.warn('═══════════════════════════════════════');

      for (const [chainId, chainStats] of Object.entries(stats)) {
        const status = chainStats.enabled ? '🟢 Enabled' : '🔴 Disabled';
        const connection = chainStats.isConnected ? '🔗 Connected' : '❌ Disconnected';

        console.warn(`\n${chainStats.name} (Chain ${chainId}):`);
        console.warn(`  Status: ${status}`);
        console.warn(`  Connection: ${connection}`);
        console.warn(`  NFTs: ${chainStats.nftCount}`);
        console.warn(`  Collections: ${chainStats.collectionCount}`);
      }

    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
    }
  }

  /**
   * Example: Toggle chain support
   * @param chainId
   * @param enabled
   */
  async manageChainSupport(chainId: number, enabled: boolean): Promise<void> {
    const chainName = this.getChainName(chainId);
    console.warn(`${enabled ? '🟢 Enabling' : '🔴 Disabling'} ${chainName} support...`);

    this.nftDisplay.toggleChain(chainId, enabled);

    console.warn(`✅ ${chainName} is now ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Helper: Get chain name by ID
   * @param chainId
   */
  private getChainName(chainId: number): string {
    const chainNames: { [key: number]: string } = {
      1: 'Ethereum',
      137: 'Polygon',
      56: 'Binance Smart Chain',
      101: 'Solana',
      8888: 'OmniCoin'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  }
}

/**
 * Example usage and demonstration
 */
async function demonstrateMultiChainNFT(): Promise<void> {
  console.warn('🚀 OmniBazaar Multi-Chain NFT Integration Demo\n');

  const marketplace = new OmniBazaarMarketplaceExample();
  const testUserAddress = '0x1234567890123456789012345678901234567890';

  try {
    // Example 1: Mint a new marketplace NFT
    console.warn('📝 Example 1: Minting Marketplace NFT');
    console.warn('═══════════════════════════════════════');

    await marketplace.mintMarketplaceNFT(testUserAddress, {
      name: 'Vintage Leather Jacket',
      description: 'High-quality vintage leather jacket in excellent condition',
      imageUrl: 'https://example.com/jacket.jpg',
      price: '25.50',
      category: 'Fashion',
      location: 'New York, NY'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 2: Show user's NFT portfolio
    console.warn('\n📱 Example 2: User NFT Portfolio');
    console.warn('═══════════════════════════════════════');

    await marketplace.showUserNFTPortfolio(testUserAddress);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 3: Search marketplace NFTs
    console.warn('\n🔍 Example 3: Marketplace Search');
    console.warn('═══════════════════════════════════════');

    await marketplace.searchMarketplaceNFTs('jacket', {
      category: 'Fashion',
      priceRange: { min: 10, max: 100 }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 4: Show marketplace statistics
    console.warn('\n📊 Example 4: Marketplace Statistics');
    console.warn('═══════════════════════════════════════');

    await marketplace.showMarketplaceStatistics();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 5: Chain management
    console.warn('\n🔧 Example 5: Chain Management');
    console.warn('═══════════════════════════════════════');

    await marketplace.manageChainSupport(56, false); // Disable BSC
    await marketplace.manageChainSupport(56, true);  // Re-enable BSC

    console.warn('\n🎉 Multi-chain NFT integration demo complete!');
    console.warn('✅ Ready for production marketplace integration');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Export for use in other modules
export { OmniBazaarMarketplaceExample, demonstrateMultiChainNFT };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateMultiChainNFT().catch(console.warn);
}
