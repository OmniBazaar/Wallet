// Simple Node.js test for NFT minting functionality
// Run with: node --loader ts-node/esm simple-minter.test.ts

import assert from 'assert';
import { SimplifiedNFTMinter, type MintingConfig } from '../../src/core/nft/minting/simple-minter';
import type { NFTMintRequest } from '../../src/types/nft';
import type { ListingMetadata, ProductDetails } from '../../src/types/listing';

// Test configuration
const testConfig: MintingConfig = {
  contractAddress: '0x123456789abcdef123456789abcdef123456789a',
  marketplaceAddress: '0x987654321fedcba987654321fedcba987654321',
  ipfsGateway: 'https://ipfs.io/ipfs',
  defaultRoyalty: 5.0,
  rpcUrl: 'https://rpc.omnicoin.network'
};

// Test data
const mockProductDetails: ProductDetails = {
  name: 'Test Product',
  description: 'A test product for the marketplace',
  category: 'electronics',
  subcategory: 'smartphones',
  tags: ['mobile', 'tech'],
  price: {
    amount: '100',
    currency: 'XOM'
  },
  images: ['https://ipfs.io/ipfs/QmProductImage'],
  condition: 'new',
  quantity: 1,
  availability: true
};

const mockListingData: ListingMetadata = {
  id: 'product_listing_1',
  type: 'product',
  seller: {
    address: '0xseller123456789abcdef123456789abcdef123456789',
    name: 'Test Seller',
    location: {
      country: 'USA',
      state: 'CA',
      city: 'San Francisco'
    },
    contactInfo: {
      email: 'seller@test.com'
    },
    rating: 4.5,
    totalSales: 10,
    joinedDate: '2023-01-01',
    verified: true
  },
  details: mockProductDetails,
  listingNode: {
    address: '0xnode123456789abcdef123456789abcdef123456789',
    name: 'Test Node',
    location: {
      country: 'USA'
    },
    status: 'active',
    lastSync: new Date().toISOString()
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'active',
  views: 0,
  favorites: 0
};

const mockMintRequest: NFTMintRequest = {
  name: 'Test Product NFT',
  description: 'An NFT representing a marketplace product',
  image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//test',
  attributes: [
    { trait_type: 'Category', value: 'Electronics' },
    { trait_type: 'Condition', value: 'New' }
  ],
  royalties: 5.0,
  listImmediately: true,
  listingPrice: '100',
  listingCurrency: 'XOM',
  category: 'electronics',
  useIPFS: true,
  pinToIPFS: true
};

async function runTests() {
  console.log('🧪 Starting NFT Minter Tests...\n');

  const minter = new SimplifiedNFTMinter(testConfig);

  try {
    // Test 1: Validate mint request structure
    console.log('Test 1: Validate mint request structure');
    const validation = minter.validateMintRequest(mockMintRequest);
    assert.strictEqual(validation.valid, true, 'Valid mint request should pass validation');
    assert.strictEqual(validation.errors.length, 0, 'Valid mint request should have no errors');
    console.log('✅ Mint request validation passed\n');

    // Test 2: Test invalid mint request
    console.log('Test 2: Test invalid mint request');
    const invalidRequest: NFTMintRequest = {
      name: '', // Empty name should fail
      description: '',
      image: '',
      attributes: [],
      useIPFS: true
    };
    const invalidValidation = minter.validateMintRequest(invalidRequest);
    assert.strictEqual(invalidValidation.valid, false, 'Invalid mint request should fail validation');
    assert(invalidValidation.errors.length > 0, 'Invalid mint request should have errors');
    console.log('✅ Invalid request properly rejected\n');

    // Test 3: Test minting cost estimation
    console.log('Test 3: Test minting cost estimation');
    const costEstimate = await minter.getEstimatedMintingCost();
    assert(costEstimate.gasEstimate, 'Cost estimate should include gas estimate');
    assert(costEstimate.totalCost, 'Cost estimate should include total cost');
    assert.strictEqual(costEstimate.currency, 'XOM', 'Cost should be in XOM currency');
    console.log('✅ Cost estimation works correctly\n');

    // Test 4: Full NFT minting process
    console.log('Test 4: Full NFT minting process');
    const sellerAddress = '0xseller123456789abcdef123456789abcdef123456789';
    
    console.log('  Starting minting process...');
    const mintResult = await minter.mintListingNFT(mockMintRequest, mockListingData, sellerAddress);
    
    // Verify minting result
    assert.strictEqual(mintResult.success, true, 'Minting should succeed');
    assert(mintResult.tokenId, 'Minting should return a token ID');
    assert(mintResult.transactionHash, 'Minting should return a transaction hash');
    assert(mintResult.ipfsHash, 'Minting should return an IPFS hash');
    assert(mintResult.nftItem, 'Minting should return an NFT item');
    
    console.log('  ✅ Minting completed successfully');
    console.log(`  Token ID: ${mintResult.tokenId}`);
    console.log(`  Transaction Hash: ${mintResult.transactionHash}`);
    console.log(`  IPFS Hash: ${mintResult.ipfsHash}\n`);

    // Test 5: Verify NFT item structure
    console.log('Test 5: Verify NFT item structure');
    const nftItem = mintResult.nftItem!;
    
    assert.strictEqual(nftItem.blockchain, 'omnicoin', 'NFT should be on OmniCoin blockchain');
    assert.strictEqual(nftItem.tokenStandard, 'ERC721', 'NFT should use ERC721 standard');
    assert.strictEqual(nftItem.owner, sellerAddress, 'NFT owner should be the seller');
    assert.strictEqual(nftItem.creator, sellerAddress, 'NFT creator should be the seller');
    assert.strictEqual(nftItem.name, mockMintRequest.name, 'NFT name should match request');
    assert(nftItem.attributes.length > mockMintRequest.attributes.length, 'NFT should have additional marketplace attributes');
    
    console.log('✅ NFT item structure is correct\n');

    // Test 6: Verify marketplace-specific attributes
    console.log('Test 6: Verify marketplace-specific attributes');
    const blockchainAttr = nftItem.attributes.find(attr => attr.trait_type === 'Blockchain');
    const categoryAttr = nftItem.attributes.find(attr => attr.trait_type === 'Category');
    const sellerAttr = nftItem.attributes.find(attr => attr.trait_type === 'Seller');
    
    assert(blockchainAttr && blockchainAttr.value === 'OmniCoin', 'Should have OmniCoin blockchain attribute');
    assert(categoryAttr && categoryAttr.value === 'electronics', 'Should have category attribute');
    assert(sellerAttr && sellerAttr.value === mockListingData.seller.name, 'Should have seller attribute');
    
    console.log('✅ Marketplace attributes are correct\n');

    // Test 7: Configuration management
    console.log('Test 7: Configuration management');
    const currentConfig = minter.getConfig();
    assert.deepStrictEqual(currentConfig, testConfig, 'Configuration should be retrievable');
    
    minter.updateConfig({ defaultRoyalty: 10.0 });
    const updatedConfig = minter.getConfig();
    assert.strictEqual(updatedConfig.defaultRoyalty, 10.0, 'Configuration should be updatable');
    
    console.log('✅ Configuration management works correctly\n');

    console.log('🎉 All tests passed successfully!');
    console.log('✅ NFT minting functionality is working correctly');
    console.log('✅ OmniCoin blockchain integration is ready');
    console.log('✅ Marketplace metadata is properly structured');
    console.log('✅ Validation and error handling work as expected');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
} 