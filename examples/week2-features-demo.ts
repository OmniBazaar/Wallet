/**
 * Week 2 Features Demo
 * Demonstrates NFT discovery, Solana support, and multi-chain capabilities
 */

import { providerManager } from '../src/core/providers/ProviderManager';
import { keyringService } from '../src/core/keyring/KeyringService';
import { nftManager } from '../src/core/nft';

async function demo() {
  console.log('OmniBazaar Week 2 Features Demo\n');

  // Initialize wallet
  console.log('1. Initializing multi-chain wallet...');
  await providerManager.initialize('mainnet');
  
  // Create wallet with all chain support
  const mnemonic = await keyringService.createWallet('myPassword123');
  console.log('✓ Wallet created with multi-chain support\n');

  // Create accounts for different chains
  console.log('2. Creating accounts across ecosystems:');
  
  const ethAccount = await keyringService.createAccount('ethereum', 'Ethereum Main');
  console.log(`   ✓ Ethereum: ${ethAccount.address}`);
  
  const solanaAccount = await keyringService.createAccount('solana', 'Solana Main');
  console.log(`   ✓ Solana: ${solanaAccount.address}`);
  
  const btcAccount = await keyringService.createAccount('bitcoin', 'Bitcoin Main');
  console.log(`   ✓ Bitcoin: ${btcAccount.address}`);
  
  const dotAccount = await keyringService.createAccount('substrate', 'Polkadot Main');
  console.log(`   ✓ Polkadot: ${dotAccount.address}\n`);

  // Demonstrate Solana ecosystem support
  console.log('3. Solana Ecosystem Features:');
  await providerManager.setActiveChain('solana');
  
  const solanaProvider = providerManager.getProvider('solana') as any;
  if (solanaProvider) {
    // Show balance
    const balance = await solanaProvider.getActiveFormattedBalance();
    console.log(`   Balance: ${balance}`);
    
    // Show SPL tokens
    const tokens = await solanaProvider.getActiveTokenBalances();
    console.log(`   SPL Tokens: ${tokens.length} found`);
    
    if (tokens.length > 0) {
      console.log('   Popular tokens:');
      tokens.slice(0, 5).forEach(token => {
        console.log(`     - ${token.symbol || 'Unknown'}: ${
          parseInt(token.amount) / Math.pow(10, token.decimals)
        }`);
      });
    }
  }

  // Demonstrate NFT discovery
  console.log('\n4. Multi-Chain NFT Discovery:');
  
  // Discover NFTs across all chains
  const nfts = await nftManager.getActiveAccountNFTs({
    chains: ['ethereum', 'polygon', 'solana', 'arbitrum', 'optimism'],
    includeSpam: false,
    limit: 100
  });
  
  console.log(`   ✓ Discovered ${nfts.length} NFTs across multiple chains`);
  
  // Show NFT statistics
  const stats = await nftManager.getStatistics();
  console.log('\n   NFT Statistics:');
  console.log(`   - Total NFTs: ${stats.totalNFTs}`);
  console.log('   - By Chain:');
  Object.entries(stats.byChain).forEach(([chain, count]) => {
    console.log(`     ${chain}: ${count}`);
  });
  
  if (stats.totalFloorValue) {
    console.log(`   - Total Floor Value: ${stats.totalFloorValue} ETH`);
  }

  // Show collections
  const collections = await nftManager.getCollections();
  console.log(`\n   Collections: ${collections.size}`);
  
  let shown = 0;
  for (const [collectionId, collectionNfts] of collections) {
    if (shown++ >= 5) break;
    const name = collectionNfts[0]?.collection?.name || 'Unknown';
    console.log(`   - ${name}: ${collectionNfts.length} items`);
  }

  // Demonstrate chain switching
  console.log('\n5. Seamless Chain Switching:');
  
  const chains = [
    { chain: 'ethereum', network: 'ethereum' },
    { chain: 'ethereum', network: 'arbitrum' },
    { chain: 'ethereum', network: 'optimism' },
    { chain: 'ethereum', network: 'polygon' },
    { chain: 'solana', network: null },
    { chain: 'bitcoin', network: null },
    { chain: 'substrate', network: null }
  ];

  for (const { chain, network } of chains) {
    if (network) {
      await providerManager.switchEVMNetwork(network);
      console.log(`   ✓ Switched to ${network}`);
    } else {
      await providerManager.setActiveChain(chain as any);
      console.log(`   ✓ Switched to ${chain}`);
    }
    
    const balance = await providerManager.getBalance().catch(() => '0');
    console.log(`     Balance: ${balance}`);
  }

  // Summary
  console.log('\n6. Week 2 Features Summary:');
  console.log('   ✅ Enhanced NFT discovery across 20+ chains');
  console.log('   ✅ Full Solana ecosystem support (SOL + SPL tokens)');
  console.log('   ✅ 40+ total blockchain networks supported');
  console.log('   ✅ Unified NFT management system');
  console.log('   ✅ Multi-chain statistics and analytics');
  console.log('   ✅ Seamless chain switching');
  
  console.log('\n✓ Demo completed!');
  console.log('The OmniBazaar wallet now supports:');
  console.log('- Complete NFT ecosystem (discovery, display, transfer)');
  console.log('- Solana with SPL tokens and NFTs');
  console.log('- 40+ blockchain networks');
  console.log('- Unified interface for all chains');
}

// Run demo
demo().catch(console.error);