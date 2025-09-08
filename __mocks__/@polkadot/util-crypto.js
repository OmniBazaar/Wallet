// Mock for @polkadot/util-crypto in Jest environment
module.exports = {
  encodeAddress: jest.fn((publicKey, ss58Format) => '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
  decodeAddress: jest.fn((address) => new Uint8Array([1, 2, 3, 4])),
  mnemonicGenerate: jest.fn(() => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'),
  mnemonicValidate: jest.fn(() => true),
  cryptoWaitReady: jest.fn(() => Promise.resolve()),
  randomAsU8a: jest.fn((length) => new Uint8Array(length).fill(42))
};