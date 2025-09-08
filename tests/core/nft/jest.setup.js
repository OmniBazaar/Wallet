// Jest setup file for NFT tests - runs before imports
// This prevents the bitcoin.initEccLib error

// Mock the bitcoin provider module before it's imported anywhere
jest.mock('../../../src/core/chains/bitcoin/provider.ts', () => ({
  BitcoinProvider: class MockBitcoinProvider {
    constructor() {}
    async getBalance() { return '100000000'; }
    async sendTransaction() { return 'mock-tx-hash'; }
  }
}));

// Mock tiny-secp256k1 to prevent initialization issues
jest.mock('tiny-secp256k1', () => ({
  isPoint: jest.fn(),
  pointCompress: jest.fn(),
  pointFromScalar: jest.fn(),
  privateAdd: jest.fn(),
  sign: jest.fn()
}));

// Mock bitcoinjs-lib with initEccLib
jest.mock('bitcoinjs-lib', () => ({
  initEccLib: jest.fn(),
  networks: {
    bitcoin: { messagePrefix: '\x18Bitcoin Signed Message:\n' },
    testnet: { messagePrefix: '\x18Bitcoin Signed Message:\n' }
  },
  Transaction: jest.fn(),
  TransactionBuilder: jest.fn(),
  payments: {
    p2pkh: jest.fn(),
    p2sh: jest.fn(),
    p2wpkh: jest.fn()
  }
}));