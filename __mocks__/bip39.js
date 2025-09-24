/**
 * Mock for bip39 library
 */

const validMnemonics = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
  'test test test test test test test test test test test junk',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
];

module.exports = {
  generateMnemonic: jest.fn((strength = 128) => {
    // Return deterministic test mnemonics based on strength
    if (strength === 256) {
      return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    }
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  }),

  validateMnemonic: jest.fn((mnemonic) => {
    if (typeof mnemonic !== 'string') {
      return false;
    }

    const words = mnemonic.trim().split(/\s+/);

    // Check if it's a known valid test mnemonic
    if (validMnemonics.includes(mnemonic)) {
      return true;
    }

    // Basic validation: word count should be multiple of 3 and between 12-24
    return words.length >= 12 && words.length <= 24 && words.length % 3 === 0;
  }),

  mnemonicToSeed: jest.fn((mnemonic, passphrase = '') => {
    // Return a deterministic seed buffer based on mnemonic
    const seed = Buffer.alloc(64);
    seed.fill(1);
    return seed;
  }),

  mnemonicToSeedSync: jest.fn((mnemonic, passphrase = '') => {
    // Return a deterministic seed buffer based on mnemonic
    const seed = Buffer.alloc(64);
    seed.fill(1);
    return seed;
  }),

  mnemonicToEntropy: jest.fn((mnemonic) => {
    // Return entropy as hex string
    return '00000000000000000000000000000000';
  }),

  entropyToMnemonic: jest.fn((entropy) => {
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  }),

  wordlists: {
    english: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse']
  }
};