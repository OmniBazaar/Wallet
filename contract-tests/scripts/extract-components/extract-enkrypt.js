#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const SOURCE_DIR = path.join(__dirname, '../../source-repos/enKrypt');
const TARGET_DIR = path.join(__dirname, '../../src');

// Component mappings from Enkrypt to our structure
const COMPONENT_MAPPINGS = [
  // Core chain providers
  {
    source: 'packages/extension/src/providers/ethereum',
    target: 'core/chains/ethereum'
  },
  {
    source: 'packages/extension/src/providers/bitcoin',
    target: 'core/chains/bitcoin'
  },
  {
    source: 'packages/extension/src/providers/solana',
    target: 'core/chains/solana'
  },
  {
    source: 'packages/extension/src/providers/polkadot',
    target: 'core/chains/polkadot'
  },
  {
    source: 'packages/extension/src/types',
    target: 'core/chains/types'
  },
  
  // Storage and keyring
  {
    source: 'packages/extension/src/libs/keyring',
    target: 'core/storage/keyring'
  },
  {
    source: 'packages/extension/src/libs/storage',
    target: 'core/storage'
  },
  
  // Hardware wallet support
  {
    source: 'packages/hw-wallets/src/ledger',
    target: 'core/hardware/ledger'
  },
  {
    source: 'packages/hw-wallets/src/trezor',
    target: 'core/hardware/trezor'
  },
  {
    source: 'packages/hw-wallets/src/types',
    target: 'core/hardware/interfaces'
  },
  
  // Utilities
  {
    source: 'packages/utils/src',
    target: 'core/utils'
  },
  
  // Background services architecture
  {
    source: 'packages/extension/src/background',
    target: 'background/services/_enkrypt-reference'
  },
  
  // Content script architecture
  {
    source: 'packages/extension/src/content-script',
    target: 'content/_enkrypt-reference'
  },
  
  // Popup architecture (for reference)
  {
    source: 'packages/extension/src/ui',
    target: 'popup/_enkrypt-reference'
  }
];

async function copyDirectory(source, target) {
  const sourceExists = fs.existsSync(source);
  if (!sourceExists) {
    console.warn(`⚠️  Source directory does not exist: ${source}`);
    return false;
  }

  // Create target directory if it doesn't exist
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' 
      ? `xcopy "${source}" "${target}" /E /I /Y`
      : `cp -r "${source}" "${target}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error copying ${source} to ${target}:`, error);
        reject(error);
      } else {
        console.log(`✅ Copied ${source} to ${target}`);
        resolve(true);
      }
    });
  });
}

async function extractEnkryptComponents() {
  console.log('🚀 Starting Enkrypt component extraction...\n');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Enkrypt source directory not found at: ${SOURCE_DIR}`);
    console.log('   Please run: cd source-repos && git clone https://github.com/enkryptcom/enKrypt.git');
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const mapping of COMPONENT_MAPPINGS) {
    const sourcePath = path.join(SOURCE_DIR, mapping.source);
    const targetPath = path.join(TARGET_DIR, mapping.target);

    try {
      const success = await copyDirectory(sourcePath, targetPath);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
  }

  console.log(`\n📊 Enkrypt extraction complete:`);
  console.log(`   ✅ Success: ${successCount} components`);
  console.log(`   ❌ Errors: ${errorCount} components`);

  if (errorCount === 0) {
    console.log(`\n🎉 All Enkrypt components extracted successfully!`);
    console.log(`   Next steps:`);
    console.log(`   1. Review extracted code in src/ directories`);
    console.log(`   2. Adapt import/export statements for our architecture`);
    console.log(`   3. Run: npm run extract:rainbow`);
  } else {
    console.log(`\n⚠️  Some components failed to extract. Please check the errors above.`);
  }
}

// Run the extraction
extractEnkryptComponents().catch(console.error); 