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

  constructor() {
    // Initialize the multi-chain NFT display system
    this.nftDisplay = new MultiChainNFTDisplay();
    
    // Initialize the NFT minter for OmniCoin
    this.nftMinter = new SimplifiedNFTMinter({
      blockchain: 'omnicoin',
      rpcUrl: 'http://localhost:8888',
      contractAddress: '0x0000000000000000000000000000000000000000'
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
        alchemyApiKey: process.env.ALCHEMY_ETHEREUM_API_KEY,
        openseaApiKey: process.env.OPENSEA_API_KEY
      },
      polygon: {
        alchemyApiKey: process.env.ALCHEMY_POLYGON_API_KEY
      },
      solana: {
        heliusApiKey: process.env.HELIUS_API_KEY,
        magicEdenApiKey: process.env.MAGICEDEN_API_KEY
      }
    });

    console.log('✅ Multi-chain NFT providers initialized');
  }

  /**
   * Example: Mint a new marketplace NFT on OmniCoin
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
      console.log('🔨 Minting new marketplace NFT...');

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
        to: sellerAddress,
        listImmediately: true,
        price: productData.price,
        currency: 'XOM'
      };

      const result = await this.nftMinter.mintNFT(mintRequest);
      
      console.log('✅ NFT minted successfully:', {
        transactionHash: result.transactionHash,
        tokenId: result.tokenId,
        ipfsHash: result.ipfsHash
      });

      return result.transactionHash;
    } catch (error) {
      console.error('❌ Failed to mint NFT:', error);
      throw error;
    }
  }

  /**
   * Example: Display all NFTs from multiple chains for a user
   */
  async showUserNFTPortfolio(userAddress: string): Promise<void> {
    try {
      console.log(`📱 Loading NFT portfolio for ${userAddress}...`);

      // Get NFTs from all enabled chains
      const portfolio = await this.nftDisplay.getAllNFTs(userAddress);

      console.log(`\n🎨 NFT Portfolio Summary:`);
      console.log(`Total NFTs: ${portfolio.totalCount}`);
      console.log(`Chains with NFTs: ${Object.keys(portfolio.chains).length}`);

      // Display breakdown by chain
      for (const [chainId, nfts] of Object.entries(portfolio.chains)) {
        const chainName = this.getChainName(parseInt(chainId));
        const chainNFTs = nfts as any[];
        
        if (chainNFTs.length > 0) {
          console.log(`\n${chainName}: ${chainNFTs.length} NFTs`);
          
          // Show first few NFTs from each chain
          chainNFTs.slice(0, 3).forEach((nft, index) => {
            console.log(`  ${index + 1}. ${nft.name} - ${nft.price || 'Not Listed'} ${nft.currency || ''}`);
          });
          
          if (chainNFTs.length > 3) {
            console.log(`  ... and ${chainNFTs.length - 3} more`);
          }
        }
      }

      // Show some interesting statistics
      const allNFTs = portfolio.nfts;
      const listedNFTs = allNFTs.filter(nft => nft.isListed);
      const categories = [...new Set(allNFTs.map(nft => 
        nft.attributes.find(attr => attr.trait_type === 'Category')?.value
      ).filter(Boolean))];

      console.log(`\n📊 Portfolio Statistics:`);
      console.log(`Listed for Sale: ${listedNFTs.length}/${allNFTs.length}`);
      console.log(`Categories: ${categories.join(', ')}`);
      console.log(`Blockchains: ${[...new Set(allNFTs.map(nft => nft.blockchain))].join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to load NFT portfolio:', error);
    }
  }

  /**
   * Example: Search for NFTs across all chains
   */
  async searchMarketplaceNFTs(searchTerm: string, filters?: {
    category?: string;
    blockchain?: string;
    priceRange?: { min: number; max: number };
  }): Promise<void> {
    try {
      console.log(`🔍 Searching for "${searchTerm}" across all chains...`);

      const searchQuery = {
        query: searchTerm,
        category: filters?.category,
        blockchain: filters?.blockchain,
        priceRange: filters?.priceRange,
        limit: 20
      };

      const results = await this.nftDisplay.searchNFTs(searchQuery);

      console.log(`\n🎯 Search Results:`);
      console.log(`Found ${results.total} NFTs matching "${searchTerm}"`);
      console.log(`Showing ${results.items.length} results`);

      // Display search results
      results.items.forEach((item: any, index) => {
        const nft = item; // The converted marketplace listing
        console.log(`\n${index + 1}. ${nft.title || nft.name}`);
        console.log(`   Blockchain: ${nft.blockchain || 'Unknown'}`);
        console.log(`   Price: ${nft.price || 'Not Listed'} ${nft.currency || ''}`);
        console.log(`   Category: ${nft.category || 'General'}`);
        console.log(`   Seller: ${nft.seller}`);
      });

      // Show available filters
      if (results.filters) {
        console.log(`\n🔧 Available Filters:`);
        if (results.filters.categories?.length > 0) {
          console.log(`Categories: ${results.filters.categories.map(c => `${c.name} (${c.count})`).join(', ')}`);
        }
        if (results.filters.blockchains?.length > 0) {
          console.log(`Blockchains: ${results.filters.blockchains.map(b => `${b.name} (${b.count})`).join(', ')}`);
        }
        if (results.filters.priceRange) {
          console.log(`Price Range: ${results.filters.priceRange.min} - ${results.filters.priceRange.max}`);
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
      console.log('📊 Loading marketplace statistics...');

      const stats = await this.nftDisplay.getChainStatistics();

      console.log('\n🌐 Multi-Chain NFT Statistics:');
      console.log('═══════════════════════════════════════');

      for (const [chainId, chainStats] of Object.entries(stats)) {
        const status = chainStats.enabled ? '🟢 Enabled' : '🔴 Disabled';
        const connection = chainStats.isConnected ? '🔗 Connected' : '❌ Disconnected';
        
        console.log(`\n${chainStats.name} (Chain ${chainId}):`);
        console.log(`  Status: ${status}`);
        console.log(`  Connection: ${connection}`);
        console.log(`  NFTs: ${chainStats.nftCount}`);
        console.log(`  Collections: ${chainStats.collectionCount}`);
      }

    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
    }
  }

  /**
   * Example: Toggle chain support
   */
  async manageChainSupport(chainId: number, enabled: boolean): Promise<void> {
    const chainName = this.getChainName(chainId);
    console.log(`${enabled ? '🟢 Enabling' : '🔴 Disabling'} ${chainName} support...`);
    
    this.nftDisplay.toggleChain(chainId, enabled);
    
    console.log(`✅ ${chainName} is now ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Helper: Get chain name by ID
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
  console.log('🚀 OmniBazaar Multi-Chain NFT Integration Demo\n');

  const marketplace = new OmniBazaarMarketplaceExample();
  const testUserAddress = '0x1234567890123456789012345678901234567890';

  try {
    // Example 1: Mint a new marketplace NFT
    console.log('📝 Example 1: Minting Marketplace NFT');
    console.log('═══════════════════════════════════════');
    
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
    console.log('\n📱 Example 2: User NFT Portfolio');
    console.log('═══════════════════════════════════════');
    
    await marketplace.showUserNFTPortfolio(testUserAddress);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 3: Search marketplace NFTs
    console.log('\n🔍 Example 3: Marketplace Search');
    console.log('═══════════════════════════════════════');
    
    await marketplace.searchMarketplaceNFTs('jacket', {
      category: 'Fashion',
      priceRange: { min: 10, max: 100 }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 4: Show marketplace statistics
    console.log('\n📊 Example 4: Marketplace Statistics');
    console.log('═══════════════════════════════════════');
    
    await marketplace.showMarketplaceStatistics();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 5: Chain management
    console.log('\n🔧 Example 5: Chain Management');
    console.log('═══════════════════════════════════════');
    
    await marketplace.manageChainSupport(56, false); // Disable BSC
    await marketplace.manageChainSupport(56, true);  // Re-enable BSC

    console.log('\n🎉 Multi-chain NFT integration demo complete!');
    console.log('✅ Ready for production marketplace integration');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Export for use in other modules
export { OmniBazaarMarketplaceExample, demonstrateMultiChainNFT };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateMultiChainNFT().catch(console.error);
} 