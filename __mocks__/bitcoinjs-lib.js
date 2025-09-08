/**
 * Mock for bitcoinjs-lib library
 */

const mockTransaction = {
  addInput: jest.fn(),
  addOutput: jest.fn(),
  sign: jest.fn(),
  build: jest.fn(() => ({
    toHex: jest.fn(() => 'test-transaction-hex'),
    getId: jest.fn(() => 'test-transaction-id')
  })),
  setInputScript: jest.fn(),
  virtualSize: jest.fn(() => 100),
  byteLength: jest.fn(() => 250)
};

const mockAddress = {
  toBase58Check: jest.fn(() => '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
  fromBase58Check: jest.fn(() => ({
    version: 0x00,
    hash: Buffer.from('test-hash', 'utf8')
  })),
  toBech32: jest.fn(() => 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
  fromBech32: jest.fn(() => ({
    version: 0,
    data: Buffer.from('test-data', 'utf8')
  }))
};

const mockScript = {
  compile: jest.fn(() => Buffer.from('test-script', 'utf8')),
  decompile: jest.fn(() => []),
  fromASM: jest.fn(() => Buffer.from('test-asm-script', 'utf8')),
  toASM: jest.fn(() => 'OP_DUP OP_HASH160 test OP_EQUALVERIFY OP_CHECKSIG')
};

const mockPayments = {
  p2pkh: jest.fn(() => ({
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    output: Buffer.from('test-p2pkh-output', 'utf8'),
    input: Buffer.from('test-p2pkh-input', 'utf8')
  })),
  p2sh: jest.fn(() => ({
    address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    output: Buffer.from('test-p2sh-output', 'utf8'),
    input: Buffer.from('test-p2sh-input', 'utf8')
  })),
  p2wpkh: jest.fn(() => ({
    address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    output: Buffer.from('test-p2wpkh-output', 'utf8'),
    input: Buffer.from('test-p2wpkh-input', 'utf8')
  })),
  p2wsh: jest.fn(() => ({
    address: 'bc1qrp33g0q4c8d5sjfn0p4fcrj3x7a8w5f4jdp7rnfvsxy2w3a0mj3qvcamqck',
    output: Buffer.from('test-p2wsh-output', 'utf8'),
    input: Buffer.from('test-p2wsh-input', 'utf8')
  }))
};

const mockBitcoin = {
  networks: {
    bitcoin: {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bech32: 'bc',
      bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
      },
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    },
    testnet: {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bech32: 'tb',
      bip32: {
        public: 0x043587cf,
        private: 0x04358394,
      },
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef,
    }
  },
  Transaction: jest.fn(() => mockTransaction),
  TransactionBuilder: jest.fn(() => mockTransaction),
  address: mockAddress,
  script: mockScript,
  payments: mockPayments,
  crypto: {
    hash160: jest.fn(() => Buffer.from('test-hash160', 'utf8')),
    hash256: jest.fn(() => Buffer.from('test-hash256', 'utf8')),
    sha1: jest.fn(() => Buffer.from('test-sha1', 'utf8')),
    sha256: jest.fn(() => Buffer.from('test-sha256', 'utf8')),
    ripemd160: jest.fn(() => Buffer.from('test-ripemd160', 'utf8'))
  },
  initEccLib: jest.fn(),
  ECPair: {
    fromPrivateKey: jest.fn(() => ({
      privateKey: Buffer.from('test-private-key', 'utf8'),
      publicKey: Buffer.from('test-public-key', 'utf8')
    }))
  }
};

// Support both CommonJS and ES6 module imports
module.exports = mockBitcoin;
module.exports.default = mockBitcoin;

// Also export all properties directly for namespace imports
Object.keys(mockBitcoin).forEach(key => {
  module.exports[key] = mockBitcoin[key];
});