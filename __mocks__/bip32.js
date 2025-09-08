/**
 * Mock for bip32 library
 */

const mockBIP32Interface = {
  derivePath: jest.fn(() => mockBIP32Interface),
  derive: jest.fn(() => mockBIP32Interface),
  deriveHardened: jest.fn(() => mockBIP32Interface),
  privateKey: Buffer.from('test-private-key', 'utf8'),
  publicKey: Buffer.from('test-public-key', 'utf8'),
  chainCode: Buffer.from('test-chain-code', 'utf8'),
  depth: 0,
  index: 0,
  parentFingerprint: 0,
  fingerprint: Buffer.from([0, 0, 0, 0]),
  identifier: Buffer.from([0, 0, 0, 0]),
  isNeutered: jest.fn(() => false),
  neutered: jest.fn(() => mockBIP32Interface),
  toBase58: jest.fn(() => 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi'),
  toWIF: jest.fn(() => 'KzvkjCxQuFFmby1HR8H5gf2HJUPs17nCKa5ZnY7AaqD6nJxGU2QD')
};

const BIP32Factory = jest.fn(() => ({
  fromSeed: jest.fn(() => mockBIP32Interface),
  fromBase58: jest.fn(() => mockBIP32Interface),
  fromPrivateKey: jest.fn(() => mockBIP32Interface),
  fromPublicKey: jest.fn(() => mockBIP32Interface)
}));

module.exports = { BIP32Factory };
module.exports.default = BIP32Factory;