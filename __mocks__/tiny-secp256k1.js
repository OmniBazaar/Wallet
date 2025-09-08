/**
 * Mock for tiny-secp256k1 library
 */

const mockEcc = {
  isPrivateKey: jest.fn(() => true),
  isPoint: jest.fn(() => true),
  isPointCompressed: jest.fn(() => true),
  pointFromScalar: jest.fn(() => Buffer.from('test-point', 'utf8')),
  pointAddScalar: jest.fn(() => Buffer.from('test-point-add', 'utf8')),
  pointMultiply: jest.fn(() => Buffer.from('test-point-multiply', 'utf8')),
  pointAdd: jest.fn(() => Buffer.from('test-point-add', 'utf8')),
  pointCompress: jest.fn(() => Buffer.from('test-compressed', 'utf8')),
  sign: jest.fn(() => Buffer.from('test-signature', 'utf8')),
  verify: jest.fn(() => true),
  signRecoverable: jest.fn(() => Buffer.from('test-recoverable-signature', 'utf8')),
  recover: jest.fn(() => Buffer.from('test-recovered', 'utf8'))
};

module.exports = mockEcc;
module.exports.default = mockEcc;