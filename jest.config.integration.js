/**
 * Jest configuration for integration tests
 * Removes mocks for real API testing
 */

import baseConfig from './jest.config.js';

export default {
  ...baseConfig,
  moduleNameMapper: {
    // Keep the path mappings
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    
    // Remove Solana mocks for integration tests
    // These lines are commented out to use real packages
    // '^@solana/web3\\.js$': '<rootDir>/__mocks__/@solana/web3.js.js',
    // '^@solana/spl-token$': '<rootDir>/__mocks__/@solana/spl-token.js',
    
    // Keep other mocks that are still needed
    '^.*/core/providers/ProviderManager$': '<rootDir>/__mocks__/src/core/providers/ProviderManager.ts',
    '^.*/core/keyring/KeyringService$': '<rootDir>/__mocks__/src/core/keyring/KeyringService.ts',
    '^.*/core/chains/omnicoin/live-provider$': '<rootDir>/__mocks__/src/core/chains/omnicoin/live-provider.js',
    '^.*/core/chains/coti/live-provider$': '<rootDir>/__mocks__/src/core/chains/coti/live-provider.js',
    '^.*/core/nft/NFTService$': '<rootDir>/__mocks__/src/core/nft/NFTService.ts',
    '^ethers$': '<rootDir>/__mocks__/ethers.js',
    '^@polkadot/api$': '<rootDir>/__mocks__/@polkadot/api.js',
    '^@polkadot/keyring$': '<rootDir>/__mocks__/@polkadot/keyring.js',
    '^@polkadot/util$': '<rootDir>/__mocks__/@polkadot/util.js',
    '^@polkadot/util-crypto$': '<rootDir>/__mocks__/@polkadot/util-crypto.js',
    '^@coti-io/coti-sdk-typescript$': '<rootDir>/__mocks__/@coti-io/coti-sdk-typescript.js',
    '^bip32$': '<rootDir>/__mocks__/bip32.js',
    '^tiny-secp256k1$': '<rootDir>/__mocks__/tiny-secp256k1.js',
    '^ecpair$': '<rootDir>/__mocks__/ecpair.js',
    '^bitcoinjs-lib$': '<rootDir>/__mocks__/bitcoinjs-lib.js',
    '^uint8array-tools$': '<rootDir>/__mocks__/uint8array-tools.js'
  },
  // Add Solana packages to transformIgnorePatterns
  transformIgnorePatterns: [
    'node_modules/(?!(vue|@vue|ethers|multiformats|uint8arrays|gun|orbit-db|bip32|tiny-secp256k1|uint8array-tools|ecpair|bitcoinjs-lib|@solana)/)',
  ],
};