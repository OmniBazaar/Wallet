/**
 * Jest Configuration for Wallet Tests
 */

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      jsx: 'react-jsx'
    }],
    '^.+\\.vue$': ['@vue/vue3-jest', {
      compilerOptions: {
        propsDestructure: true
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@solana|@polkadot|jayson|bip39|bitcoinjs-lib|elliptic|bs58|ecpair|tiny-secp256k1|vue|@vue)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^ecpair$': '<rootDir>/../__mocks__/ecpair/index.js',
    '^tiny-secp256k1$': '<rootDir>/../__mocks__/tiny-secp256k1.js',
    '^bip32$': '<rootDir>/../__mocks__/bip32.js',
    '^bip39$': '<rootDir>/../__mocks__/bip39.js',
    '^@solana/web3\\.js$': '<rootDir>/../__mocks__/@solana/web3.js.js',
    '^@solana/spl-token$': '<rootDir>/../__mocks__/@solana/spl-token.js'
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: '<rootDir>/coverage',
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 30000,
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"]
  }
};