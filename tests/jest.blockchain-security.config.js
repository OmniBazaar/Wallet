/**
 * Jest Configuration for Blockchain Platform and Security Testing
 * 
 * This configuration is specifically tailored for comprehensive blockchain
 * and security testing with appropriate timeouts, setup, and teardown.
 */

import path from 'path';

export default {
  displayName: 'Blockchain & Security Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  
  // Test patterns for comprehensive blockchain and security tests
  testMatch: [
    '**/blockchain/**/*.test.ts',
    '**/security/**/*.test.ts',
    '**/error-handling/**/*.test.ts',
    '**/performance/**/*.test.ts',
    '**/integration/**/*.test.ts'
  ],

  // TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Transform ignore patterns - allow crypto libraries to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(ethers|bip39|bip32|tiny-secp256k1|uint8array-tools|ecpair|bitcoinjs-lib|@polkadot|@solana)/)',
  ],

  // Extended timeout for blockchain operations
  testTimeout: 60000, // 1 minute per test

  // Setup and teardown
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  globalTeardown: undefined,

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@tests/(.*)$': '<rootDir>/$1'
    // IMPORTANT: Do NOT mock crypto libraries for security tests
    // No ethers, bip39, or other crypto library mocks
  },
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration for security-critical code
  collectCoverageFrom: [
    'src/core/keyring/**/*.ts',
    'src/core/providers/**/*.ts',
    'src/core/security/**/*.ts',
    'src/core/storage/**/*.ts',
    'src/core/blockchain/**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Higher thresholds for security-critical components
    'src/core/keyring/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/core/storage/SecureIndexedDB.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/__mocks__/'
  ],

  // Performance optimization
  maxWorkers: '50%', // Use half of available cores
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error handling
  bail: false, // Don't stop on first failure
  verbose: true,
  detectOpenHandles: true,
  detectLeaks: true,

  // Security testing specific configurations
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
      isolatedModules: true
    },
    // Test environment variables
    TEST_ENVIRONMENT: 'security-testing',
    ENABLE_SECURITY_LOGS: true,
    BLOCKCHAIN_TEST_MODE: true
  },

  // Custom reporters for security testing
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/test-results',
        filename: 'blockchain-security-test-report.html',
        expand: true,
        hideIcon: false
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'blockchain-security-results.xml',
        suiteName: 'Blockchain & Security Tests'
      }
    ]
  ],

  // Memory and performance settings
  logHeapUsage: true,
  workerIdleMemoryLimit: '1GB',
  
  // Custom environment variables for blockchain testing
  setupFiles: []
};