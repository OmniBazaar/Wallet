/**
 * Multi-chain wallet demo
 * Shows how to use the wallet with multiple EVM chains
 */

import { providerManager } from '../src/core/providers/ProviderManager';
import { keyringService } from '../src/core/keyring/KeyringService';

async function demo() {
  console.log('OmniBazaar Multi-Chain Wallet Demo\n');

  // Initialize wallet
  console.log('1. Initializing wallet...');
  await providerManager.initialize('mainnet');
  
  // Create a new wallet
  const mnemonic = await keyringService.createWallet('myPassword123');
  console.log('✓ Wallet created\n');

  // Show supported EVM networks
  console.log('2. Supported EVM Networks:');
  const networks = providerManager.constructor.getSupportedEVMNetworks();
  console.log(`   Total: ${networks.length} networks`);
  console.log('   Major chains:', networks.slice(0, 10).join(', '), '...\n');

  // Switch between different chains
  console.log('3. Switching between chains:');
  
  // Ethereum
  await providerManager.setActiveChain('ethereum');
  console.log('   ✓ Ethereum - Balance:', await providerManager.getBalance());
  
  // Arbitrum
  await providerManager.switchEVMNetwork('arbitrum');
  console.log('   ✓ Arbitrum - Balance:', await providerManager.getBalance());
  
  // Optimism
  await providerManager.switchEVMNetwork('optimism');
  console.log('   ✓ Optimism - Balance:', await providerManager.getBalance());
  
  // Polygon
  await providerManager.switchEVMNetwork('polygon');
  console.log('   ✓ Polygon - Balance:', await providerManager.getBalance());
  
  // Base
  await providerManager.switchEVMNetwork('base');
  console.log('   ✓ Base - Balance:', await providerManager.getBalance());
  
  // Bitcoin
  await providerManager.setActiveChain('bitcoin');
  console.log('   ✓ Bitcoin - Balance:', await providerManager.getBalance());
  
  console.log('\n4. Getting network details:');
  await providerManager.switchEVMNetwork('arbitrum');
  const arbProvider = providerManager.getEVMProvider('arbitrum');
  if (arbProvider) {
    const network = arbProvider.getCurrentNetwork();
    console.log(`   Network: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Currency: ${network.currency}`);
    console.log(`   Explorer: ${network.explorer}`);
  }

  console.log('\n5. Multi-chain balance summary:');
  const chains = ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche'];
  for (const chain of chains) {
    try {
      if (chain === 'ethereum') {
        await providerManager.setActiveChain('ethereum');
      } else {
        await providerManager.switchEVMNetwork(chain);
      }
      const balance = await providerManager.getBalance();
      console.log(`   ${chain.padEnd(12)} ${balance}`);
    } catch (error) {
      console.log(`   ${chain.padEnd(12)} Error: Network not initialized`);
    }
  }

  console.log('\n✓ Demo completed!');
  console.log('The wallet now supports 20+ EVM chains out of the box!');
}

// Run demo
demo().catch(console.error);