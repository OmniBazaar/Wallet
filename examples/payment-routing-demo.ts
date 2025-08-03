/**
 * Payment Routing and Bridge Demo
 * Demonstrates DePay-inspired payment routing and cross-chain bridges
 */

import { paymentRouter } from '../src/core/payments/routing';
import { bridgeService } from '../src/core/bridge';
import { providerManager } from '../src/core/providers/ProviderManager';
import { keyringService } from '../src/core/keyring/KeyringService';

async function demo() {
  console.log('OmniBazaar Payment Routing & Bridge Demo\n');

  // Initialize
  await providerManager.initialize('mainnet');
  const mnemonic = await keyringService.createWallet('demo123');
  
  // Create accounts on different chains
  const ethAccount = await keyringService.createAccount('ethereum', 'ETH Main');
  const polygonAccount = await keyringService.createAccount('ethereum', 'Polygon');
  const solanaAccount = await keyringService.createAccount('solana', 'Solana');
  
  console.log('1. Multi-Chain Accounts Created:');
  console.log(`   Ethereum: ${ethAccount.address}`);
  console.log(`   Polygon: ${polygonAccount.address}`);
  console.log(`   Solana: ${solanaAccount.address}\n`);

  // 2. Payment Routing Demo
  console.log('2. Payment Routing - Finding Best Route:');
  
  // Simulate finding payment routes
  const paymentRequest = {
    from: [ethAccount.address, polygonAccount.address, solanaAccount.address],
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7', // Recipient
    amount: '100',
    accept: [
      {
        blockchain: 'ethereum',
        token: 'USDC',
        amount: '100',
        receiver: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7'
      },
      {
        blockchain: 'polygon',
        token: 'USDC',
        amount: '100',
        receiver: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7'
      }
    ]
  };
  
  const bestRoute = await paymentRouter.findBestRoute(paymentRequest);
  
  if (bestRoute) {
    console.log(`   ✓ Best route found:`);
    console.log(`     From: ${bestRoute.fromToken.symbol} on ${bestRoute.blockchain}`);
    console.log(`     To: ${bestRoute.toToken.symbol}`);
    console.log(`     Steps: ${bestRoute.steps.map(s => s.type).join(' → ')}`);
    
    if (bestRoute.exchangeRoutes.length > 0) {
      console.log(`     Exchange: ${bestRoute.exchangeRoutes[0].exchange}`);
      console.log(`     Price Impact: ${bestRoute.exchangeRoutes[0].priceImpact}%`);
    }
  }

  // 3. Cross-Chain Bridge Quotes
  console.log('\n3. Cross-Chain Bridge Quotes:');
  
  const bridgeQuotes = await bridgeService.getQuotes({
    fromChain: 'ethereum',
    toChain: 'polygon',
    fromToken: 'USDC',
    amount: '1000000000', // 1000 USDC (6 decimals)
    fromAddress: ethAccount.address,
    toAddress: polygonAccount.address
  });
  
  console.log(`   Found ${bridgeQuotes.routes.length} bridge routes:`);
  
  bridgeQuotes.routes.slice(0, 3).forEach(route => {
    const fee = parseInt(route.fee.amount) / 1e6; // Convert to USDC
    const time = route.estimatedTime / 60; // Convert to minutes
    
    console.log(`   
   ${route.bridge.toUpperCase()}:
     Fee: ${fee} USDC
     Time: ~${time} minutes
     Steps: ${route.steps.map(s => s.type).join(' → ')}`);
  });
  
  if (bridgeQuotes.bestRoute) {
    console.log(`\n   ✓ Best bridge: ${bridgeQuotes.bestRoute.bridge.toUpperCase()}`);
  }

  // 4. Bridge Fee Comparison
  console.log('\n4. Bridge Fee Comparison:');
  
  const fees = await bridgeService.estimateBridgeFees(
    'ethereum',
    'arbitrum',
    'ETH',
    '1000000000000000000' // 1 ETH
  );
  
  console.log('   ETH → Arbitrum bridges:');
  fees.forEach(({ bridge, fee, time }) => {
    const ethFee = parseInt(fee) / 1e18;
    console.log(`   - ${bridge}: ${ethFee.toFixed(6)} ETH (~${time/60} min)`);
  });

  // 5. Multi-Step Payment Route
  console.log('\n5. Complex Payment Route Example:');
  
  // Simulate a complex route: SOL → ETH → USDC → Bridge to Polygon
  const complexRoute = {
    blockchain: 'solana',
    fromAddress: solanaAccount.address,
    fromToken: { symbol: 'SOL', decimals: 9 },
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7',
    steps: [
      { type: 'bridge' as const, description: 'Bridge SOL to ETH via Wormhole' },
      { type: 'swap' as const, description: 'Swap ETH to USDC on Uniswap' },
      { type: 'bridge' as const, description: 'Bridge USDC to Polygon via Hop' },
      { type: 'transfer' as const, description: 'Transfer USDC to recipient' }
    ]
  };
  
  console.log('   Route: SOL (Solana) → ETH (Ethereum) → USDC → USDC (Polygon)');
  console.log('   Steps:');
  complexRoute.steps.forEach((step, i) => {
    console.log(`     ${i + 1}. ${step.description}`);
  });

  // 6. Supported Chains & Bridges
  console.log('\n6. Ecosystem Support:');
  console.log('   Payment routing supports:');
  console.log('   - Ethereum, Polygon, Arbitrum, Optimism, Base');
  console.log('   - BSC, Avalanche, Solana');
  console.log('   - Uniswap, SushiSwap, PancakeSwap, QuickSwap');
  console.log('   - Orca, Raydium, Jupiter (Solana)');
  
  console.log('\n   Bridge providers:');
  console.log('   - Hop Protocol, Stargate, Across Protocol');
  console.log('   - Synapse, Celer, Multichain');
  console.log('   - Wormhole, LayerZero');
  console.log('   - Native bridges (Polygon, Arbitrum, Optimism)');

  // Summary
  console.log('\n7. Integration Summary:');
  console.log('   ✅ DePay-inspired payment routing');
  console.log('   ✅ Multi-chain payment discovery');
  console.log('   ✅ Cross-chain bridge aggregation');
  console.log('   ✅ Optimal route selection');
  console.log('   ✅ Support for 11+ bridges');
  console.log('   ✅ 8+ blockchain networks');
  console.log('   ✅ Unified payment experience');
  
  console.log('\n✓ Payment routing and bridge demo completed!');
}

// Run demo
demo().catch(console.error);