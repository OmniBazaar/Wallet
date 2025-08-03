/**
 * Polkadot/Substrate integration demo
 * Shows how to use the wallet with Polkadot ecosystem chains
 */

import { providerManager } from '../src/core/providers/ProviderManager';
import { keyringService } from '../src/core/keyring/KeyringService';

async function demo() {
  console.log('OmniBazaar Polkadot/Substrate Integration Demo\n');

  // Initialize wallet
  console.log('1. Initializing wallet with Polkadot support...');
  await providerManager.initialize('mainnet');
  
  // Create a new wallet
  const mnemonic = await keyringService.createWallet('myPassword123');
  console.log('✓ Wallet created\n');

  // Create Substrate account
  console.log('2. Creating Polkadot account...');
  const polkadotAccount = await keyringService.createAccount('substrate', 'My Polkadot Account');
  console.log(`   Address: ${polkadotAccount.address}`);
  console.log(`   Public Key: ${polkadotAccount.publicKey}\n`);

  // Show supported Polkadot networks
  console.log('3. Supported Polkadot Networks:');
  const polkadotProvider = providerManager.getProvider('substrate') as any;
  const networks = polkadotProvider.constructor.getSupportedNetworks();
  
  console.log('   Mainnets:');
  networks.filter(n => !['westend', 'rococo'].includes(n.chainId)).forEach(network => {
    console.log(`   - ${network.name} (${network.currency})`);
  });
  
  console.log('\n   Testnets:');
  networks.filter(n => ['westend', 'rococo'].includes(n.chainId)).forEach(network => {
    console.log(`   - ${network.name} (${network.currency})`);
  });

  // Switch between different Polkadot networks
  console.log('\n4. Switching between Polkadot networks:');
  
  // Polkadot
  await providerManager.setActiveChain('substrate');
  console.log('   ✓ Polkadot - Balance:', await providerManager.getBalance());
  
  // Switch to Kusama
  await polkadotProvider.switchNetwork('kusama');
  console.log('   ✓ Kusama - Balance:', await providerManager.getBalance());
  
  // Switch to Acala
  await polkadotProvider.switchNetwork('acala');
  console.log('   ✓ Acala - Balance:', await providerManager.getBalance());
  
  // Switch to Astar
  await polkadotProvider.switchNetwork('astar');
  console.log('   ✓ Astar - Balance:', await providerManager.getBalance());

  console.log('\n5. Getting network details:');
  const network = polkadotProvider.getCurrentNetwork();
  console.log(`   Network: ${network.name}`);
  console.log(`   Currency: ${network.currency}`);
  console.log(`   Decimals: ${network.decimals}`);
  console.log(`   SS58 Prefix: ${network.prefix}`);
  console.log(`   Existential Deposit: ${network.existentialDeposit}`);

  console.log('\n6. Multi-chain wallet summary:');
  console.log('   The OmniBazaar wallet now supports:');
  console.log('   - 20+ EVM chains (Ethereum, Arbitrum, Optimism, etc.)');
  console.log('   - 15+ Polkadot/Substrate chains');
  console.log('   - Bitcoin network');
  console.log('   - OmniCoin on COTI');
  console.log('   Total: 40+ blockchain networks!');

  console.log('\n✓ Demo completed!');
}

// Run demo
demo().catch(console.error);