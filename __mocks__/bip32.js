/**
 * Mock for bip32 library
 */

// Mock BIP32 interface that properly implements HD wallet functionality
class MockBIP32Interface {
  constructor(privateKey, publicKey, chainCode, depth = 0, index = 0) {
    this.privateKey = privateKey || Buffer.alloc(32).fill(1);
    this.publicKey = publicKey || Buffer.alloc(33).fill(2);
    this.chainCode = chainCode || Buffer.alloc(32).fill(3);
    this.depth = depth;
    this.index = index;
    this.parentFingerprint = 0;
    this.fingerprint = Buffer.from([0, 0, 0, 0]);
    this.identifier = Buffer.from([0, 0, 0, 0]);
  }

  derivePath(path) {
    // Return a new instance with deterministic keys based on path
    const pathHash = Buffer.from(path).reduce((acc, byte) => acc + byte, 0);
    const privateKey = Buffer.alloc(32);
    privateKey.fill(pathHash % 256);
    const publicKey = Buffer.alloc(33);
    publicKey[0] = 0x02;
    publicKey.fill((pathHash + 1) % 256, 1);
    return new MockBIP32Interface(privateKey, publicKey, this.chainCode, path.split('/').length - 1, 0);
  }

  derive(index) {
    const privateKey = Buffer.alloc(32);
    privateKey.fill((this.privateKey[0] + index) % 256);
    const publicKey = Buffer.alloc(33);
    publicKey[0] = 0x02;
    publicKey.fill((this.publicKey[1] + index) % 256, 1);
    return new MockBIP32Interface(privateKey, publicKey, this.chainCode, this.depth + 1, index);
  }

  deriveHardened(index) {
    return this.derive(index + 0x80000000);
  }

  isNeutered() {
    return !this.privateKey;
  }

  neutered() {
    return new MockBIP32Interface(null, this.publicKey, this.chainCode, this.depth, this.index);
  }

  toBase58() {
    return 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';
  }

  toWIF() {
    return 'KzvkjCxQuFFmby1HR8H5gf2HJUPs17nCKa5ZnY7AaqD6nJxGU2QD';
  }
}

// Create a mock factory that returns the correct interface
const BIP32Factory = jest.fn((ecc) => {
  // Return object with factory methods that bip32 library exports
  return {
    fromSeed: jest.fn((seed) => {
      const seedBuffer = Buffer.isBuffer(seed) ? seed : Buffer.from(seed, 'hex');
      const privateKey = Buffer.alloc(32);
      privateKey.set(seedBuffer.slice(0, 32));
      const publicKey = Buffer.alloc(33);
      publicKey[0] = 0x02;
      publicKey.fill(seedBuffer[0] || 1, 1);
      return new MockBIP32Interface(privateKey, publicKey);
    }),
    fromBase58: jest.fn(() => new MockBIP32Interface()),
    fromPrivateKey: jest.fn((privateKey, chainCode) => new MockBIP32Interface(privateKey, null, chainCode)),
    fromPublicKey: jest.fn((publicKey, chainCode) => new MockBIP32Interface(null, publicKey, chainCode))
  };
});

module.exports = { BIP32Factory };
module.exports.default = { BIP32Factory };