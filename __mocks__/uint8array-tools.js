/**
 * Mock for uint8array-tools library
 */

const mockUint8ArrayTools = {
  toUtf8: jest.fn((bytes) => 'test-utf8-string'),
  fromUtf8: jest.fn((str) => new Uint8Array([116, 101, 115, 116])),
  toHex: jest.fn((bytes) => 'deadbeef'),
  fromHex: jest.fn((hex) => new Uint8Array([222, 173, 190, 239])),
  toBase64: jest.fn((bytes) => 'dGVzdA=='),
  fromBase64: jest.fn((base64) => new Uint8Array([116, 101, 115, 116])),
  concat: jest.fn((...arrays) => new Uint8Array([1, 2, 3, 4])),
  equals: jest.fn((a, b) => true)
};

module.exports = mockUint8ArrayTools;
export default mockUint8ArrayTools;