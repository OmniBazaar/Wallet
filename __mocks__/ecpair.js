/**
 * Mock for ecpair library
 */

const mockECPair = {
  privateKey: Buffer.from('test-private-key', 'utf8'),
  publicKey: Buffer.from('test-public-key', 'utf8'),
  compressed: true,
  network: {
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
  sign: jest.fn(() => Buffer.from('test-signature', 'utf8')),
  verify: jest.fn(() => true),
  toWIF: jest.fn(() => 'KzvkjCxQuFFmby1HR8H5gf2HJUPs17nCKa5ZnY7AaqD6nJxGU2QD')
};

const ECPairFactory = jest.fn(() => ({
  fromPrivateKey: jest.fn(() => mockECPair),
  fromPublicKey: jest.fn(() => mockECPair),
  fromWIF: jest.fn(() => mockECPair),
  makeRandom: jest.fn(() => mockECPair)
}));

module.exports = { ECPairFactory };