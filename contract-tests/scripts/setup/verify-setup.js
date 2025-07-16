const fs = require('fs');
const path = require('path');

console.log('🔍 OmniBazaar Wallet Setup Verification\n');

const checks = [
  {
    name: 'Source repositories',
    items: [
      'source-repos/enKrypt',
      'source-repos/browser-extension', 
      'source-repos/frame',
      'source-repos/web3-wallets'
    ]
  },
  {
    name: 'Core directories',
    items: [
      'src/core/chains',
      'src/core/storage',
      'src/core/privacy',
      'src/core/nft',
      'src/core/payments',
      'src/core/hardware',
      'src/core/utils'
    ]
  },
  {
    name: 'Extension structure',
    items: [
      'src/background',
      'src/content',
      'src/popup',
      'src/omnibazaar',
      'src/types'
    ]
  },
  {
    name: 'Configuration files',
    items: [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'manifest/v3/manifest.json',
      'manifest/v2/manifest.json'
    ]
  },
  {
    name: 'Documentation',
    items: [
      'README.md',
      'WALLET_DEVELOPMENT_PLAN.md'
    ]
  }
];

let totalChecks = 0;
let passedChecks = 0;

checks.forEach(category => {
  console.log(`📁 ${category.name}:`);
  
  category.items.forEach(item => {
    totalChecks++;
    const itemPath = path.join(__dirname, '../../', item);
    const exists = fs.existsSync(itemPath);
    
    if (exists) {
      console.log(`   ✅ ${item}`);
      passedChecks++;
    } else {
      console.log(`   ❌ ${item}`);
    }
  });
  
  console.log('');
});

console.log(`📊 Setup Status: ${passedChecks}/${totalChecks} checks passed\n`);

if (passedChecks === totalChecks) {
  console.log('🎉 Perfect! Your OmniBazaar Wallet development environment is ready.');
  console.log('\nNext steps:');
  console.log('   1. Run: npm install');
  console.log('   2. Extract components using the commands in README.md');
  console.log('   3. Start development: npm run dev');
} else {
  console.log('⚠️  Some setup steps are missing. Please:');
  console.log('   1. Check the README.md for complete setup instructions');
  console.log('   2. Ensure all source repositories are cloned');
  console.log('   3. Verify directory structure creation');
} 