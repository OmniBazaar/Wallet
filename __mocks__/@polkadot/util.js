// Mock for @polkadot/util in Jest environment
module.exports = {
  hexToU8a: jest.fn((hex) => new Uint8Array([1, 2, 3, 4])),
  u8aToHex: jest.fn((array) => '0x01020304'),
  stringToU8a: jest.fn((str) => new Uint8Array([5, 6, 7, 8])),
  u8aToString: jest.fn((array) => 'mock string'),
  detectPackage: jest.fn(() => ({ name: 'mock-package', version: '1.0.0' }))
};