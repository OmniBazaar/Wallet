export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      useESM: true
    }
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json'
    }],
    '^.+\\.vue$': ['@vue/vue3-jest', {
      compilerOptions: {
        propsDestructure: true
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(vue|@vue|ethers|multiformats|uint8arrays|gun|orbit-db|bip32|tiny-secp256k1|uint8array-tools|ecpair|bitcoinjs-lib)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^.*/core/providers/ProviderManager$': '<rootDir>/__mocks__/src/core/providers/ProviderManager.ts',
    '^.*/core/contracts/ContractConfig$': '<rootDir>/__mocks__/src/core/contracts/ContractManager.ts',
    '^.*/core/ens/ENSService$': '<rootDir>/__mocks__/src/core/ens/ENSService.ts',
    // '^.*/core/keyring/KeyringService$': '<rootDir>/__mocks__/src/core/keyring/KeyringService.ts',
    // '^.*/core/keyring/BIP39Keyring$': '<rootDir>/__mocks__/src/core/keyring/BIP39Keyring.ts',
    '^.*/core/chains/omnicoin/live-provider$': '<rootDir>/__mocks__/src/core/chains/omnicoin/live-provider.js',
    '^.*/core/chains/coti/live-provider$': '<rootDir>/__mocks__/src/core/chains/coti/live-provider.js',
    '^.*/core/chains/bitcoin/live-provider$': '<rootDir>/__mocks__/src/core/chains/bitcoin/live-provider.ts',
    '^.*/core/chains/ethereum/live-provider$': '<rootDir>/__mocks__/src/core/chains/ethereum/live-provider.js',
    '^.*/core/chains/solana/live-provider$': '<rootDir>/__mocks__/src/core/chains/solana/live-provider.js',
    '^.*/core/chains/solana$': '<rootDir>/__mocks__/src/core/chains/solana/live-provider.js',
    '^.*/core/chains/polkadot/live-provider$': '<rootDir>/__mocks__/src/core/chains/polkadot/live-provider.js',
    '^.*/core/chains/polkadot$': '<rootDir>/__mocks__/src/core/chains/polkadot/live-provider.js',
    '^.*/core/chains/evm$': '<rootDir>/__mocks__/src/core/chains/evm/index.js',
    '^.*/core/chains/bitcoin/provider$': '<rootDir>/__mocks__/src/core/chains/bitcoin/provider.js',
    '^.*/core/nft/NFTService$': '<rootDir>/__mocks__/src/core/nft/NFTService.ts',
    '^ethers$': '<rootDir>/__mocks__/ethers.js',
    '^@polkadot/api$': '<rootDir>/__mocks__/@polkadot/api.js',
    '^@polkadot/keyring$': '<rootDir>/__mocks__/@polkadot/keyring.js',
    '^@polkadot/util$': '<rootDir>/__mocks__/@polkadot/util.js',
    '^@polkadot/util-crypto$': '<rootDir>/__mocks__/@polkadot/util-crypto.js',
    '^@solana/web3\\.js$': '<rootDir>/__mocks__/@solana/web3.js.js',
    '^@solana/spl-token$': '<rootDir>/__mocks__/@solana/spl-token.js',
    '^@coti-io/coti-sdk-typescript$': '<rootDir>/__mocks__/@coti-io/coti-sdk-typescript.js',
    '^bip32$': '<rootDir>/__mocks__/bip32.js',
    '^tiny-secp256k1$': '<rootDir>/__mocks__/tiny-secp256k1.js',
    '^ecpair$': '<rootDir>/__mocks__/ecpair.js',
    '^bitcoinjs-lib$': '<rootDir>/__mocks__/bitcoinjs-lib.js',
    '^uint8array-tools$': '<rootDir>/__mocks__/uint8array-tools.js',
    '^libp2p$': '<rootDir>/__mocks__/libp2p.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/DePay/',
    '/source-repos/',
    '/dist/',
    '/build/',
    '/tests/deprecated/'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,vue}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/assets/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 45000,
  verbose: true,
  maxWorkers: 2,
  workerIdleMemoryLimit: '1GB',
  maxConcurrency: 4,
  bail: false,
  forceExit: true,
  detectOpenHandles: true,
  workerThreads: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'vue', 'json'],
};