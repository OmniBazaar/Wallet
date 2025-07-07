// OmniBazaar Wallet Development Configuration
// Copy this file to config.js and update the values as needed

module.exports = {
  // Build Configuration
  build: {
    target: process.env.TARGET_BROWSER || 'chrome',
    mode: process.env.NODE_ENV || 'development',
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production'
  },

  // Wallet Configuration
  wallet: {
    name: 'OmniBazaar Wallet',
    version: '1.0.0',
    description: 'Multi-chain privacy wallet with NFT marketplace integration'
  },

  // Chain Configuration
  chains: {
    ethereum: {
      rpcUrl: 'https://rpc.ankr.com/eth',
      chainId: 1,
      enabled: true
    },
    bitcoin: {
      rpcUrl: 'https://blockstream.info/api',
      network: 'mainnet',
      enabled: true
    },
    solana: {
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      cluster: 'mainnet-beta',
      enabled: true
    },
    polkadot: {
      rpcUrl: 'wss://rpc.polkadot.io',
      enabled: true
    },
    coti: {
      rpcUrl: 'https://mainnet.coti.io',
      privacyEnabled: true,
      enabled: false // Enable when COTI V2 is ready
    }
  },

  // IPFS Configuration
  ipfs: {
    gatewayUrl: 'https://ipfs.io/ipfs',
    apiUrl: 'https://api.pinata.cloud',
    enabled: true
  },

  // OmniBazaar Configuration
  omnibazaar: {
    apiUrl: 'http://localhost:3000',
    marketplaceContract: '0x...', // Update with actual contract address
    escrowContract: '0x...', // Update with actual contract address
    enabled: true
  },

  // Development Settings
  development: {
    enableConsole: true,
    enableDebug: true,
    enableTestAccounts: true,
    hotReload: true,
    skipEncryption: false // Only for testing, never in production
  },

  // Browser Extension Settings
  extension: {
    popup: {
      width: 400,
      height: 600
    },
    permissions: [
      'storage',
      'unlimitedStorage',
      'activeTab',
      'tabs',
      'notifications',
      'alarms',
      'webRequest'
    ]
  },

  // Security Settings
  security: {
    enableAnalytics: false,
    enableCrashReporting: false,
    privacyMode: true
  }
}; 